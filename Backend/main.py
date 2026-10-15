import os
import csv
from typing import Optional, List
import pandas as pd
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from camera import camera_state, start_camera, stop_camera, mjpeg_generator

app = FastAPI(title="NexEnergy API - Smart Campus Energy Optimizer")

# Gemini AI configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "PASTE_YOUR_API_KEY_HERE")
gemini_model = None
try:
    import google.generativeai as genai
    if GEMINI_API_KEY and GEMINI_API_KEY != "PASTE_YOUR_API_KEY_HERE":
        genai.configure(api_key=GEMINI_API_KEY)
        model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        gemini_model = genai.GenerativeModel(model_name)
    else:
        # Try default configuration if available in environment
        try:
            genai.configure(api_key="PASTE_YOUR_API_KEY_HERE")
            gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        except Exception:
            gemini_model = None
except Exception:
    gemini_model = None

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
    total_energy_kwh: float
    total_daily_cost: float
    people_count: int

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

# 4. Generative AI Insight (Google Gemini with intelligent fallback)
@app.post("/generate-insight")
def generate_insight(data: InsightRequest):
    prompt = f"""
    You are an AI energy optimizer for a smart campus. 
    Current status: There are {data.people_count} people in the room. 
    The current daily energy usage is {data.total_energy_kwh} kWh, costing ₹{data.total_daily_cost}.
    
    Give a short, friendly, 2-sentence recommendation to the campus admin on what to do next. 
    If the room is empty, tell them to turn things off. If it's occupied, tell them it's optimized.
    """

    if gemini_model:
        try:
            response = gemini_model.generate_content(prompt)
            if response and response.text:
                return {
                    "source": "gemini",
                    "ai_insight": response.text.strip()
                }
        except Exception:
            pass

    # Intelligent fallback when Gemini API key is not configured or offline
    if data.people_count == 0:
        insight = (
            f"Classroom is vacant while estimated daily usage is {data.total_energy_kwh:.2f} kWh (₹{data.total_daily_cost:.2f}). "
            "Turn off high-power cooling and lighting immediately to avoid standby waste."
        )
    else:
        insight = (
            f"Classroom has {data.people_count} active occupants with daily consumption around {data.total_energy_kwh:.2f} kWh (₹{data.total_daily_cost:.2f}). "
            "Power levels are well-balanced; keep temperature at 24°C to sustain optimal energy efficiency."
        )

    return {
        "source": "smart-engine",
        "ai_insight": insight
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
