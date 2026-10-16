import os
import csv
import base64
import binascii
import time
import threading
from typing import Optional, List
from dataclasses import dataclass, field

import requests
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import cv2
except Exception:
    cv2 = None

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI(title="NexEnergy API - Smart Campus Energy Optimizer")

# ───────────────────────────────────────────────────────────────────
# Camera state & detection helpers (previously in camera.py)
# Uses the same YOLO person-detection approach as detect.py
# ───────────────────────────────────────────────────────────────────

PERSON_CLASS_ID = 0
CONFIDENCE = 0.35
EMPTY_THRESHOLD_SECONDS = 3


@dataclass
class CameraState:
    active: bool = False
    people_count: int = 0
    status: str = "Inactive"          # "Occupied" | "Empty" | "Inactive"
    energy_waste_alert: bool = False
    empty_seconds: int = 0
    fps: float = 0.0
    error: str = ""
    source: str = "none"            # "laptop" | "mobile" | "ip_camera" | "none"
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "active": self.active,
                "people_count": self.people_count,
                "status": self.status,
                "energy_waste_alert": self.energy_waste_alert,
                "empty_seconds": self.empty_seconds,
                "fps": round(self.fps, 1),
                "error": self.error,
                "source": self.source,
            }


camera_state = CameraState()

# Globals for the background camera thread
_latest_frame: bytes = b""
_frame_lock = threading.Lock()
_thread: threading.Thread | None = None
_stop_event = threading.Event()

# Mobile camera globals
_mobile_model = None
_mobile_model_lock = threading.Lock()
_mobile_inference_lock = threading.Lock()
_mobile_empty_start: float | None = None
_mobile_last_frame_at: float | None = None


def _detect_people(model, frame, *, persist=False):
    """Run person-only YOLO inference (mirrors detect.py's approach)."""
    options = {
        "classes": [PERSON_CLASS_ID],
        "conf": CONFIDENCE,
        "imgsz": 640,
        "verbose": False,
    }
    if persist:
        options.update(persist=True, tracker="bytetrack.yaml")
        return model.track(frame, **options)[0]
    return model.predict(frame, **options)[0]


def _mark_camera_inactive(error: str = "") -> None:
    """Clear stale camera telemetry."""
    global _latest_frame
    with camera_state._lock:
        camera_state.active = False
        camera_state.people_count = 0
        camera_state.status = "Inactive"
        camera_state.energy_waste_alert = False
        camera_state.empty_seconds = 0
        camera_state.fps = 0.0
        camera_state.error = error
        camera_state.source = "none"
    with _frame_lock:
        _latest_frame = b""


def expire_mobile_camera() -> None:
    """Mark a lost browser stream offline if no frames arrive for a while."""
    global _mobile_empty_start, _mobile_last_frame_at
    with camera_state._lock:
        is_stale = (
            camera_state.active
            and camera_state.source == "mobile"
            and _mobile_last_frame_at is not None
            and time.monotonic() - _mobile_last_frame_at > 8
        )
    if is_stale:
        with _mobile_inference_lock:
            with camera_state._lock:
                still_stale = (
                    camera_state.active
                    and camera_state.source == "mobile"
                    and _mobile_last_frame_at is not None
                    and time.monotonic() - _mobile_last_frame_at > 8
                )
            if still_stale:
                _mobile_empty_start = None
                _mobile_last_frame_at = None
                _mark_camera_inactive("No frames received for 8 seconds. Reconnect the browser camera.")


def process_mobile_frame(frame_bytes: bytes) -> dict:
    """Run one JPEG frame uploaded by a phone browser through YOLO."""
    global cv2, _mobile_model, _mobile_empty_start, _mobile_last_frame_at, _latest_frame
    if len(frame_bytes) > 2_000_000:
        raise ValueError("Frame is too large. Send a JPEG under 2 MB.")

    if cv2 is None:
        try:
            import cv2
        except Exception as exc:
            raise RuntimeError("OpenCV could not load on the backend.") from exc

    try:
        import numpy as np
        image = cv2.imdecode(np.frombuffer(frame_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception as exc:
        raise ValueError("The uploaded image could not be decoded.") from exc
    if image is None:
        raise ValueError("The uploaded image is not a valid JPEG frame.")

    try:
        with _mobile_inference_lock:
            with _mobile_model_lock:
                if _mobile_model is None:
                    try:
                        from ultralytics import YOLO
                    except ImportError as exc:
                        raise RuntimeError("Ultralytics is not installed on the backend.") from exc
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    model_path = os.path.join(script_dir, "yolov8n.pt")
                    if not os.path.exists(model_path):
                        raise RuntimeError("YOLO model Backend/yolov8n.pt is missing.")
                    _mobile_model = YOLO(model_path)
                model = _mobile_model

            results = _detect_people(model, image)
            people = len(results.boxes) if results.boxes is not None else 0
            now = time.monotonic()
            if people == 0:
                if _mobile_empty_start is None:
                    _mobile_empty_start = now
                elapsed = int(now - _mobile_empty_start)
                waste_alert = elapsed >= EMPTY_THRESHOLD_SECONDS
            else:
                _mobile_empty_start = None
                elapsed = 0
                waste_alert = False

            annotated = results.plot()
            ok, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if not ok:
                raise RuntimeError("Could not encode the annotated camera frame.")
            with _frame_lock:
                _latest_frame = buffer.tobytes()
            fps = 1 / (now - _mobile_last_frame_at) if _mobile_last_frame_at is not None and now > _mobile_last_frame_at else 0.0
            _mobile_last_frame_at = now
            with camera_state._lock:
                camera_state.active = True
                camera_state.source = "mobile"
                camera_state.people_count = people
                camera_state.status = "Occupied" if people > 0 else "Empty"
                camera_state.energy_waste_alert = waste_alert
                camera_state.empty_seconds = elapsed
                camera_state.fps = fps
                camera_state.error = ""
    except Exception as exc:
        _mark_camera_inactive(f"Person detection failed: {exc}")
        raise RuntimeError(f"Person detection failed: {exc}") from exc

    return {
        "message": "Mobile camera frame processed.",
        "source": "mobile",
        "people_count": people,
        "status": "Occupied" if people > 0 else "Empty",
        "energy_waste_alert": waste_alert,
        "empty_seconds": elapsed,
        "fps": round(fps, 1),
    }


def _detection_loop(source=0) -> None:
    """Capture frames, run YOLO, update shared state, encode JPEG."""
    global _latest_frame, cv2

    if cv2 is None:
        try:
            import cv2
        except Exception:
            _mark_camera_inactive("OpenCV is not installed.")
            return

    try:
        from ultralytics import YOLO
    except ImportError:
        _mark_camera_inactive("Ultralytics is not installed.")
        return

    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, "yolov8n.pt")
    if not os.path.exists(model_path):
        model_path = "yolov8n.pt"

    try:
        model = YOLO(model_path)
    except Exception as exc:
        _mark_camera_inactive(f"Model load failed: {exc}")
        return

    is_ip = isinstance(source, str) and any(source.lower().startswith(p) for p in ("http://", "https://", "rtsp://"))
    if is_ip:
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            cap.release()
            cap = cv2.VideoCapture(source)
    else:
        cam_idx = 0
        try:
            cam_idx = int(source)
        except (ValueError, TypeError):
            cam_idx = 0
        cap = cv2.VideoCapture(cam_idx)

    if not cap.isOpened():
        _mark_camera_inactive(f"Cannot open camera source: {source}")
        return

    with camera_state._lock:
        camera_state.active = True
        camera_state.source = "ip_camera" if is_ip else "laptop"
        camera_state.error = ""
    empty_start: float | None = None
    prev_time = time.time()

    while not _stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            _mark_camera_inactive("Failed to read a frame from the camera.")
            break

        try:
            result = _detect_people(model, frame, persist=True)
        except Exception as exc:
            _mark_camera_inactive(f"Person detection failed: {exc}")
            break
        people = len(result.boxes) if result.boxes is not None else 0

        if people == 0:
            if empty_start is None:
                empty_start = time.time()
            elapsed = int(time.time() - empty_start)
            waste_alert = elapsed >= EMPTY_THRESHOLD_SECONDS
        else:
            empty_start = None
            elapsed = 0
            waste_alert = False

        now = time.time()
        dt = now - prev_time
        fps = 1.0 / dt if dt > 0 else 0
        prev_time = now

        with camera_state._lock:
            camera_state.people_count = people
            camera_state.status = "Occupied" if people > 0 else "Empty"
            camera_state.energy_waste_alert = waste_alert
            camera_state.empty_seconds = elapsed
            camera_state.fps = fps

        annotated = result.plot()
        h, w = annotated.shape[:2]

        cv2.putText(annotated, f"People: {people}", (20, 45),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 255, 0), 2)

        if waste_alert:
            overlay = annotated.copy()
            cv2.rectangle(overlay, (0, 0), (w, 70), (0, 0, 180), -1)
            annotated = cv2.addWeighted(overlay, 0.45, annotated, 0.55, 0)
            cv2.putText(annotated, "ENERGY WASTE ALERT", (20, 48),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)

        cv2.putText(annotated, f"{fps:.0f} FPS", (w - 130, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)

        bar_color = (0, 180, 0) if people > 0 else ((0, 0, 220) if waste_alert else (80, 80, 80))
        cv2.rectangle(annotated, (0, h - 36), (w, h), bar_color, -1)
        status_text = f"  NexEnergy AI Vision  |  {camera_state.status}  |  {people} detected  |  Empty {elapsed}s"
        cv2.putText(annotated, status_text, (10, h - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
        if ok:
            with _frame_lock:
                _latest_frame = buf.tobytes()

    cap.release()
    with camera_state._lock:
        camera_state.active = False
        camera_state.source = "none"


def start_camera(source=0) -> dict:
    """Launch the detection thread (idempotent)."""
    global _thread
    if camera_state.active and camera_state.source == "mobile":
        return {"message": "A mobile camera is already connected."}
    if _thread is not None and _thread.is_alive():
        return {"message": "Camera already running"}
    _stop_event.clear()
    _thread = threading.Thread(target=_detection_loop, args=(source,), daemon=True)
    _thread.start()
    time.sleep(0.8)
    if camera_state.error:
        return {"message": f"Camera failed: {camera_state.error}"}
    return {"message": f"Camera started ({camera_state.source})"}


def stop_camera() -> dict:
    """Signal the detection thread to stop."""
    _stop_event.set()
    if _thread is not None:
        _thread.join(timeout=3)
    global _mobile_empty_start, _mobile_last_frame_at
    with _mobile_inference_lock:
        _mobile_empty_start = None
        _mobile_last_frame_at = None
        _mark_camera_inactive()
    return {"message": "Camera stopped"}


def mjpeg_generator():
    """Yield multipart MJPEG frames for StreamingResponse."""
    while camera_state.active:
        with _frame_lock:
            frame = _latest_frame
        if frame:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            )
        time.sleep(0.04)  # ~25 fps cap


# ───────────────────────────────────────────────────────────────────
# Gemini AI configuration via environment variable (.env)
# ───────────────────────────────────────────────────────────────────

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

def configured_cors_origins() -> list[str]:
    """Allow the deployed UI and local development origins to call this API."""
    raw_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()]


# Keep API access limited to the configured frontend origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_cors_origins(),
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
    user_question: Optional[str] = None
    room_name: Optional[str] = None
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

class MobileCameraFrame(BaseModel):
    image_base64: str

class CameraStartRequest(BaseModel):
    source: Optional[str] = None

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

_last_occupancy_update: float = 0.0

# 1. Computer Vision & Manual Occupancy Integration
@app.post("/update-occupancy")
def update_occupancy(data: OccupancyData):
    global _last_occupancy_update
    _last_occupancy_update = time.time()
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

    # Keep camera_state in sync with detect.py or external CV
    if not camera_state.active or camera_state.source in ("detect.py", "external_cv", "none"):
        with camera_state._lock:
            camera_state.active = True
            camera_state.source = "detect.py"
            camera_state.people_count = people
            camera_state.status = data.status or ("Occupied" if people > 0 else "Empty")
            camera_state.energy_waste_alert = bool(data.energy_waste_alert)
            camera_state.empty_seconds = data.empty_seconds or 0

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

    room_name = data.room_name or "Classroom A-101"
    question_instruction = (
        f"The user asks: {data.user_question.strip()}\nAnswer this specific question directly in 2–4 short sentences. "
        "Use only the supplied room and energy context, explain that energy figures are estimates, and say when the available data cannot answer."
        if data.user_question and data.user_question.strip()
        else "Provide a concise, direct, and actionable 2-sentence energy recommendation for the facility manager. "
        "If an energy waste alert is active or the room is empty while appliances run, give a clear urgent directive to power down specific idle equipment. If occupied, provide optimal setpoint and lighting guidance for student comfort and power savings."
    )
    prompt = f"""You are NexEnergy Gemini AI, a smart campus energy management advisor.
Analyze the following real-time computer vision detection and classroom telemetry:

[LIVE COMPUTER VISION DATA]
- Location: {room_name}
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
{question_instruction}"""

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
    if data.user_question and data.user_question.strip():
        fallback = (
            f"{room_name} currently has {people} {'person' if people == 1 else 'people'} and an estimated energy use of "
            f"{energy_kwh:.2f} kWh for the selected period (about ₹{cost:.2f}). "
            f"Lights are {'on' if lights_status else 'off'} and cooling is {'on' if ac_status else 'off'}; these are estimates unless live room telemetry is connected."
        )
    elif waste_alert or (people == 0 and (ac_status or lights_status)):
        fallback = (
            f"AI Computer Vision Alert: {room_name} is vacant ({empty_sec}s empty) but cooling and lighting are still active. "
            f"Immediately power down the AC and lighting to eliminate unnecessary ₹{cost:.2f}/day standby waste."
        )
    elif people > 0:
        fallback = (
            f"AI Vision detected {people} occupants in {room_name} (current load: {energy_kwh:.2f} kWh, ₹{cost:.2f}/day). "
            f"Maintain cooling setpoint between 24–26°C to balance student comfort and reduce campus power draw by up to 15%."
        )
    else:
        fallback = (
            f"{room_name} is vacant and operating within optimal baseline efficiency ({energy_kwh:.2f} kWh, ₹{cost:.2f}/day). "
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
def api_start_camera(req: Optional[CameraStartRequest] = None):
    """Start the YOLOv8 webcam or IP camera detection thread."""
    source = req.source if req and req.source else 0
    result = start_camera(source)
    return result

@app.post("/camera/mobile-frame")
def api_mobile_camera_frame(data: MobileCameraFrame):
    """Accept a compressed JPEG frame from the phone browser and update shared YOLO state."""
    if camera_state.active and camera_state.source == "laptop":
        raise HTTPException(status_code=409, detail="Stop the laptop camera before connecting a mobile camera.")
    if len(data.image_base64) > 2_700_000:
        raise HTTPException(status_code=413, detail="Frame is too large. Send a JPEG under 2 MB.")
    try:
        frame_bytes = base64.b64decode(data.image_base64, validate=True)
        result = process_mobile_frame(frame_bytes)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The vision service could not process this frame. Check the backend logs and camera dependencies.") from exc

    room_state["people_count"] = result["people_count"]
    room_state["energy_waste_alert"] = result["energy_waste_alert"]
    room_state["AC"] = result["people_count"] > 0
    room_state["Ceiling Fan"] = result["people_count"] > 0
    return result

@app.post("/camera/stop")
def api_stop_camera():
    """Stop the webcam detection thread."""
    result = stop_camera()
    return result

@app.get("/camera/status")
def api_camera_status():
    """Return current camera detection state (people count, alerts, FPS, etc.)."""
    expire_mobile_camera()
    # If detect.py hasn't sent updates in over 6 seconds and camera thread isn't running, mark inactive
    if camera_state.source == "detect.py" and time.time() - _last_occupancy_update > 6.0:
        with camera_state._lock:
            camera_state.active = False
            camera_state.status = "Inactive"
            camera_state.source = "none"

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
