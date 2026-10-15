import os
import csv
from typing import Optional, List
import requests
import pandas as pd
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from camera import camera_state, start_camera, stop_camera, mjpeg_generator

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI(title="NexEnergy API - Smart Campus Energy Optimizer")

# Gemini AI configuration via environment variable (.env)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

def call_gemini(prompt: str) -> Optional[dict]:
    """Call Google Gemini API using REST with fast multi-model fallback."""
    if not GEMINI_API_KEY:
        return None

    # Priority models supported on current Gemini API
    models = [
        os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"),
        "gemini-3.5-flash",
        "gemini-3.8-flash",
        "gemini-flash-latest",
    ]
    for model_name in models:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            res = requests.post(url, json=payload, timeout=6)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text:
                    return {"text": text, "model": model_name}
        except Exception:
            continue
    return None

gemini_available = bool(GEMINI_API_KEY)
try:
    import google.generativeai as genai
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
except Exception:
    genai = None

# CORS middleware for Frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API MEMORY (STATE) ---
room_state = {
    "AC": True,
    "Ceiling Fan": True,
    "Gaming PC": False,
    "people_count": 0,
    "energy_waste_alert": False,
}

# --- BLUEPRINTS (PYDANTIC SCHEMAS) ---
class Appliance(BaseModel):
    name: str
    power_watts: float
    hours: float

class OccupancyData(BaseModel):
    people_count: Optional[int] = None
    occupancy_count: Optional[int] = None
    status: Optional[str] = None
    empty_seconds: Optional[int] = 0
    lights_on: Optional[bool] = None
    ac_on: Optional[bool] = None
    energy_waste_alert: Optional[bool] = False
    is_occupied: Optional[bool] = None

class SimulationAppliance(BaseModel):
    name: str
    power_watts: float
    current_hours: float
    simulated_hours: float

class InsightRequest(BaseModel):
    total_energy_kwh: Optional[float] = None
    total_daily_cost: Optional[float] = None
    people_count: Optional[int] = None
    status: Optional[str] = None
    empty_seconds: Optional[int] = None
    energy_waste_alert: Optional[bool] = None
    lights_on: Optional[bool] = None
    ac_on: Optional[bool] = None
    ac_setpoint_c: Optional[float] = None
    operating_hours: Optional[float] = None

class RecommendationRequest(BaseModel):
    occupancy: int = 0
    lights_on: bool = True
    ac_on: bool = True
    ac_setpoint_c: float = 22.0
    operating_hours: float = 2.0
    baseline_energy_kwh: Optional[float] = 0.0
    simulated_energy_kwh: Optional[float] = 0.0
    estimated_savings_kwh: Optional[float] = 0.0
    estimated_savings_rupees: Optional[float] = 0.0

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {
        "message": "NexEnergy API is running",
        "service": "Smart Campus Energy Optimizer",
        "docs": "/docs"
    }

@app.get("/room-state")
def get_room_state():
    return room_state

# 1. Computer Vision & Manual Occupancy Integration
@app.post("/update-occupancy")
def update_occupancy(data: OccupancyData):
    # Safely extract count from either people_count or occupancy_count
    count = data.occupancy_count if data.occupancy_count is not None else data.people_count
    people = max(0, count if count is not None else 0)
    
    room_state["people_count"] = people
    if data.energy_waste_alert is not None:
        room_state["energy_waste_alert"] = data.energy_waste_alert

    # Automated digital-twin state response
    if people == 0:
        room_state["AC"] = False
        room_state["Ceiling Fan"] = False
        message = "Room appears empty. Simulated AC and fan switched OFF."
    else:
        room_state["AC"] = True
        room_state["Ceiling Fan"] = True
        message = f"{people} people detected. Simulated AC and fan switched ON."

    return {
        "message": message,
        "current_room_state": room_state,
    }

# 2. Multi-Appliance Energy Calculator
@app.post("/calculate-multiple")
def calculate_multiple(appliances: List[Appliance]):
    total_energy = 0.0
    total_cost = 0.0
    breakdown = []

    for item in appliances:
        is_on = room_state.get(item.name, True)
        energy = ((item.power_watts / 1000) * max(0, item.hours)) if is_on else 0.0
        cost = energy * 8

        total_energy += energy
        total_cost += cost

        breakdown.append({
            "name": item.name,
            "status": "ON" if is_on else "OFF",
            "energy_kwh": round(energy, 2),
            "daily_cost_rupees": round(cost, 2),
        })

    return {
        "total_energy_kwh": round(total_energy, 2),
        "total_daily_cost": round(total_cost, 2),
        "breakdown": breakdown,
    }

# 3. Digital Twin What-If Simulator
@app.post("/simulate")
def simulate_savings(appliances: List[SimulationAppliance]):
    baseline_energy = 0.0
    simulated_energy = 0.0

    for item in appliances:
        baseline_energy += (item.power_watts / 1000) * item.current_hours
        simulated_energy += (item.power_watts / 1000) * item.simulated_hours

    energy_saved = baseline_energy - simulated_energy
    estimated_rupees_saved = energy_saved * 8
    # In India, grid emission factor is approx 0.82 kg CO2 per kWh
    carbon_saved_kg = energy_saved * 0.82

    return {
        "status": "Simulation Complete",
        "baseline_energy_kwh": round(baseline_energy, 2),
        "simulated_energy_kwh": round(simulated_energy, 2),
        "energy_saved_kwh": round(energy_saved, 2),
        "predicted_savings_rupees": round(estimated_rupees_saved, 2),
        "carbon_saved_kg": round(carbon_saved_kg, 2)
    }

# 4. Generative AI Insight (Google Gemini with Computer Vision & Telemetry Analysis)
@app.post("/generate-insight")
def generate_insight(data: InsightRequest):
    # Resolve live telemetry from payload or live camera state
    if camera_state.active:
        cam_snap = camera_state.snapshot()
        people = data.people_count if data.people_count is not None else cam_snap["people_count"]
        waste_alert = data.energy_waste_alert if data.energy_waste_alert is not None else cam_snap["energy_waste_alert"]
        empty_sec = data.empty_seconds if data.empty_seconds is not None else cam_snap["empty_seconds"]
        room_status = cam_snap["status"]
    else:
        people = data.people_count if data.people_count is not None else room_state.get("people_count", 0)
        waste_alert = data.energy_waste_alert if data.energy_waste_alert is not None else room_state.get("energy_waste_alert", False)
        empty_sec = data.empty_seconds if data.empty_seconds is not None else 0
        room_status = "Occupied" if people > 0 else "Empty"

    energy_kwh = data.total_energy_kwh if data.total_energy_kwh is not None else 4.4
    cost = data.total_daily_cost if data.total_daily_cost is not None else round(energy_kwh * 8, 2)
    ac_status = data.ac_on if data.ac_on is not None else room_state.get("AC", True)
    lights_status = data.lights_on if data.lights_on is not None else (people > 0)
    fan_status = room_state.get("Ceiling Fan", True)

    # Read historical benchmarks
    hist_avg_kwh = 44.3
    hist_avg_cost = 354.5
    try:
        csv_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "historical_data.csv")
        if os.path.exists(csv_file):
            df = pd.read_csv(csv_file)
            if not df.empty and "energy_kwh" in df:
                hist_avg_kwh = float(df["energy_kwh"].mean())
                hist_avg_cost = float(df["cost_rupees"].mean())
    except Exception:
        pass

    prompt = f"""You are NexEnergy Gemini AI, a smart campus energy management advisor.
Analyze the following real-time computer vision detection and classroom telemetry:

[LIVE COMPUTER VISION DATA]
- Location: Classroom A-101
- People Detected: {people} {'person' if people == 1 else 'people'}
- Room Status: {room_status}
- Empty Room Duration: {empty_sec} seconds
- Energy Waste Alert: {'ACTIVE (appliances running in an empty classroom!)' if waste_alert else 'NORMAL'}

[APPLIANCES & TELEMETRY]
- Air Conditioning: {'ON' if ac_status else 'OFF'}{f' @ {data.ac_setpoint_c}°C' if data.ac_setpoint_c else ''}
- Lighting: {'ON' if lights_status else 'OFF'}
- Ceiling Fan: {'ON' if fan_status else 'OFF'}
- Simulated Daily Energy: {energy_kwh:.2f} kWh
- Simulated Daily Cost: ₹{cost:.2f}
- Campus Historical Average (Past 5 days): {hist_avg_kwh:.1f} kWh/day (₹{hist_avg_cost:.1f}/day)

Based on this computer vision detection and electrical telemetry:
Provide a concise, direct, and actionable 2-sentence energy recommendation for the facility manager.
If an energy waste alert is active or the room is empty while appliances run, give a clear urgent directive to power down specific idle equipment. If occupied, provide optimal setpoint and lighting guidance for student comfort and power savings."""

    # Call Gemini AI with real-time computer vision and electrical telemetry
    gemini_res = call_gemini(prompt)
    if gemini_res:
        return {
            "source": "gemini",
            "model": f"Google Gemini ({gemini_res['model']})",
            "ai_insight": gemini_res["text"],
            "vision_context": {
                "people_count": people,
                "room_status": room_status,
                "energy_waste_alert": waste_alert,
                "empty_seconds": empty_sec,
                "lights_on": lights_status,
                "ac_on": ac_status,
                "energy_kwh": energy_kwh,
                "cost_rupees": cost,
            }
        }

    # Intelligent data-driven fallback when API rate limit / quota is reached
    if waste_alert or (people == 0 and (ac_status or lights_status)):
        fallback = (
            f"AI Computer Vision Alert: Classroom A-101 is vacant ({empty_sec}s empty) but cooling and lighting are still active. "
            f"Immediately power down the AC and lighting to eliminate unnecessary ₹{cost:.2f}/day standby waste."
        )
    elif people > 0:
        fallback = (
            f"AI Vision detected {people} occupants in Classroom A-101 (current load: {energy_kwh:.2f} kWh, ₹{cost:.2f}/day). "
            f"Maintain cooling setpoint between 24–26°C to balance student comfort and reduce campus power draw by up to 15%."
        )
    else:
        fallback = (
            f"Classroom A-101 is vacant and operating within optimal baseline efficiency ({energy_kwh:.2f} kWh, ₹{cost:.2f}/day). "
            "Continue automated occupancy scheduling."
        )

    return {
        "source": "smart-engine",
        "ai_insight": fallback,
        "vision_context": {
            "people_count": people,
            "room_status": room_status,
            "energy_waste_alert": waste_alert,
            "empty_seconds": empty_sec,
            "lights_on": lights_status,
            "ac_on": ac_status,
            "energy_kwh": energy_kwh,
            "cost_rupees": cost,
        }
    }

# 5. Historical Energy Records
@app.get("/historical-data")
def get_historical_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "historical_data.csv")
    if not os.path.exists(csv_path):
        csv_path = "historical_data.csv"

    if os.path.exists(csv_path):
        try:
            df = pd.read_csv(csv_path)
            return df.to_dict(orient="records")
        except Exception:
            try:
                with open(csv_path, mode="r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    records = []
                    for row in reader:
                        records.append({
                            "date": row.get("date"),
                            "energy_kwh": float(row.get("energy_kwh", 0)),
                            "cost_rupees": float(row.get("cost_rupees", 0)),
                            "peak_occupancy": int(row.get("peak_occupancy", 0)),
                        })
                    return records
            except Exception as read_err:
                return {"error": f"Failed reading historical data: {str(read_err)}"}

    return {"error": "historical_data.csv not found on the server."}

# 6. Rule-based recommendations for frontend Recommendations view
@app.post("/api/recommendations")
def recommendations(data: RecommendationRequest):
    items = []

    if data.occupancy == 0 and data.lights_on:
        items.append({
            "priority": "high",
            "icon": "lights",
            "title": "Switch off lights in an empty classroom",
            "reason": "The room is marked empty while the lights are on. Turning them off avoids unnecessary lighting energy use.",
            "action": "Turn classroom lights off in the simulator.",
        })

    if data.occupancy == 0 and data.ac_on:
        items.append({
            "priority": "high",
            "icon": "cooling",
            "title": "Review air conditioning in the empty room",
            "reason": "Cooling an unused room wastes considerable energy. Check ventilation and room conditions first.",
            "action": "Test the AC-off scenario and compare estimated usage.",
        })

    if data.ac_on and data.ac_setpoint_c < 24:
        items.append({
            "priority": "medium",
            "icon": "setpoint",
            "title": "Evaluate a higher AC setpoint",
            "reason": "A moderate setpoint (24–26°C) reduces cooling power demand substantially while maintaining comfort.",
            "action": "Try 24-26°C and compare comfort requirements.",
        })

    if data.operating_hours > 6:
        items.append({
            "priority": "medium",
            "icon": "tip",
            "title": "Consider reducing operating hours",
            "reason": f"Appliances are configured to run for {data.operating_hours} hours. Automating timers can reduce excess operation.",
            "action": "Schedule automatic shutdown during unoccupied hours.",
        })

    savings_kwh = data.estimated_savings_kwh or 0
    savings_rupees = data.estimated_savings_rupees or 0
    if savings_kwh > 0:
        carbon = savings_kwh * 0.82
        items.append({
            "priority": "result",
            "icon": "result",
            "title": "Your scenario reduces estimated energy use",
            "reason": f"The applied settings estimate {savings_kwh:.2f} kWh less energy for the selected period (about {carbon:.2f} kg CO2).",
            "action": f"Estimated cost reduction: ₹{savings_rupees:.2f}. Verify with meter data when available.",
        })

    if not items:
        items.append({
            "priority": "tip",
            "icon": "tip",
            "title": "Test another energy-saving scenario",
            "reason": "No specific action was identified by current rules. Try reducing operating hours or testing equipment settings.",
            "action": "Change a setting and apply the simulation.",
        })

    return {"source": "rules", "recommendations": items}

# ---------------------------------------------------------------------------
# 7. Live Computer-Vision Camera Endpoints
# ---------------------------------------------------------------------------

@app.post("/camera/start")
def api_start_camera():
    """Start the YOLOv8 webcam detection thread."""
    result = start_camera()
    return result

@app.post("/camera/stop")
def api_stop_camera():
    """Stop the webcam detection thread."""
    result = stop_camera()
    return result

@app.get("/camera/status")
def api_camera_status():
    """Return current camera detection state (people count, alerts, FPS, etc.)."""
    snap = camera_state.snapshot()
    # Also sync the live detection into room_state so the rest of the app
    # picks it up automatically via /room-state polling.
    if snap["active"]:
        room_state["people_count"] = snap["people_count"]
        room_state["energy_waste_alert"] = snap["energy_waste_alert"]
        if snap["people_count"] == 0:
            room_state["AC"] = False
            room_state["Ceiling Fan"] = False
        else:
            room_state["AC"] = True
            room_state["Ceiling Fan"] = True
    return snap

@app.get("/camera/feed")
def api_video_feed():
    """MJPEG video stream — embed as <img src="/camera/feed"> in the browser."""
    if not camera_state.active:
        return {"error": "Camera is not active. POST /camera/start first."}
    return StreamingResponse(
        mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
