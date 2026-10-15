"""
Camera vision module for NexEnergy.

Runs YOLOv8 person detection in a background thread, updates shared state,
and provides an MJPEG generator so the FastAPI server can stream annotated
frames directly to the browser — no OpenCV window needed.
"""

import os
import time
import threading
from dataclasses import dataclass, field

try:
    import cv2
except ImportError:
    cv2 = None

# ---------------------------------------------------------------------------
# Shared detection state — read by the /camera-status endpoint
# ---------------------------------------------------------------------------

@dataclass
class CameraState:
    active: bool = False
    people_count: int = 0
    status: str = "Inactive"          # "Occupied" | "Empty" | "Inactive"
    energy_waste_alert: bool = False
    empty_seconds: int = 0
    fps: float = 0.0
    error: str = ""
    source: str = "none"            # "laptop" | "mobile" | "none"
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

# ---------------------------------------------------------------------------
# Globals managed by the background thread
# ---------------------------------------------------------------------------

_latest_frame: bytes = b""           # JPEG-encoded annotated frame
_frame_lock = threading.Lock()
_thread: threading.Thread | None = None
_stop_event = threading.Event()

EMPTY_THRESHOLD_SECONDS = 3
_mobile_model = None
_mobile_model_lock = threading.Lock()
_mobile_empty_start: float | None = None


def process_mobile_frame(frame_bytes: bytes) -> dict:
    """Run one JPEG frame uploaded by a phone browser through the shared YOLO state."""
    global cv2, _mobile_model, _mobile_empty_start, _latest_frame
    if len(frame_bytes) > 2_000_000:
        raise ValueError("Frame is too large. Send a JPEG under 2 MB.")

    if cv2 is None:
        try:
            import cv2
        except ImportError as exc:
            raise RuntimeError("OpenCV is not installed on the backend.") from exc

    try:
        import numpy as np
        image = cv2.imdecode(np.frombuffer(frame_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception as exc:
        raise ValueError("The uploaded image could not be decoded.") from exc
    if image is None:
        raise ValueError("The uploaded image is not a valid JPEG frame.")

    with _mobile_model_lock:
        if _mobile_model is None:
            try:
                from ultralytics import YOLO
            except ImportError as exc:
                raise RuntimeError("Ultralytics is not installed on the backend.") from exc
            script_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(script_dir, "yolov8n.pt")
            if not os.path.exists(model_path):
                model_path = "yolov8n.pt"
            _mobile_model = YOLO(model_path)
        model = _mobile_model

    now = time.time()
    from detect import detect_people
    results = detect_people(model, image)
    people = len(results.boxes) if results.boxes is not None else 0
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
    if ok:
        with _frame_lock:
            _latest_frame = buffer.tobytes()
    with camera_state._lock:
        camera_state.active = True
        camera_state.source = "mobile"
        camera_state.people_count = people
        camera_state.status = "Occupied" if people > 0 else "Empty"
        camera_state.energy_waste_alert = waste_alert
        camera_state.empty_seconds = elapsed
        camera_state.fps = 0.0
        camera_state.error = ""

    return {
        "message": "Mobile camera frame processed.",
        "source": "mobile",
        "people_count": people,
        "status": "Occupied" if people > 0 else "Empty",
        "energy_waste_alert": waste_alert,
        "empty_seconds": elapsed,
    }

# ---------------------------------------------------------------------------
# Background capture + detection loop
# ---------------------------------------------------------------------------

def _detection_loop() -> None:
    """Capture frames, run YOLO, update shared state, encode JPEG."""
    global _latest_frame, cv2

    if cv2 is None:
        try:
            import cv2
        except ImportError:
            camera_state.error = "OpenCV (cv2) not installed – run: pip install opencv-python"
            camera_state.active = False
            return

    # Lazy-import ultralytics so the server starts fast even when torch
    # is loading.
    try:
        from ultralytics import YOLO
    except ImportError:
        camera_state.error = "ultralytics not installed – pip install ultralytics"
        camera_state.active = False
        return

    try:
        from detect import detect_people
    except ImportError as exc:
        camera_state.error = f"Could not load Backend/detect.py: {exc}"
        camera_state.active = False
        return

    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, "yolov8n.pt")
    if not os.path.exists(model_path):
        model_path = "yolov8n.pt"

    try:
        model = YOLO(model_path)
    except Exception as exc:
        camera_state.error = f"Model load failed: {exc}"
        camera_state.active = False
        return

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        camera_state.error = "Cannot open webcam (index 0)"
        camera_state.active = False
        return

    with camera_state._lock:
        camera_state.active = True
        camera_state.source = "laptop"
        camera_state.error = ""
    empty_start: float | None = None
    prev_time = time.time()

    while not _stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            camera_state.error = "Failed to grab frame"
            break

        # --- YOLO detection ---
        result = detect_people(model, frame, persist=True)
        people = len(result.boxes) if result.boxes is not None else 0

        # --- Empty-room timer ---
        if people == 0:
            if empty_start is None:
                empty_start = time.time()
            elapsed = int(time.time() - empty_start)
            waste_alert = elapsed >= EMPTY_THRESHOLD_SECONDS
        else:
            empty_start = None
            elapsed = 0
            waste_alert = False

        # --- FPS ---
        now = time.time()
        dt = now - prev_time
        fps = 1.0 / dt if dt > 0 else 0
        prev_time = now

        # --- Update shared state ---
        with camera_state._lock:
            camera_state.people_count = people
            camera_state.status = "Occupied" if people > 0 else "Empty"
            camera_state.energy_waste_alert = waste_alert
            camera_state.empty_seconds = elapsed
            camera_state.fps = fps

        # --- Annotate frame ---
        annotated = result.plot()
        h, w = annotated.shape[:2]

        # People count overlay
        cv2.putText(annotated, f"People: {people}", (20, 45),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 255, 0), 2)

        # Waste alert overlay
        if waste_alert:
            overlay = annotated.copy()
            cv2.rectangle(overlay, (0, 0), (w, 70), (0, 0, 180), -1)
            annotated = cv2.addWeighted(overlay, 0.45, annotated, 0.55, 0)
            cv2.putText(annotated, "ENERGY WASTE ALERT", (20, 48),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)

        # FPS badge
        cv2.putText(annotated, f"{fps:.0f} FPS", (w - 130, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)

        # Status bar at bottom
        bar_color = (0, 180, 0) if people > 0 else ((0, 0, 220) if waste_alert else (80, 80, 80))
        cv2.rectangle(annotated, (0, h - 36), (w, h), bar_color, -1)
        status_text = f"  NexEnergy AI Vision  |  {camera_state.status}  |  {people} detected  |  Empty {elapsed}s"
        cv2.putText(annotated, status_text, (10, h - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        # --- Encode JPEG ---
        ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
        if ok:
            with _frame_lock:
                _latest_frame = buf.tobytes()

    cap.release()
    with camera_state._lock:
        camera_state.active = False
        camera_state.source = "none"


# ---------------------------------------------------------------------------
# Public helpers called from main.py
# ---------------------------------------------------------------------------

def start_camera() -> dict:
    """Launch the detection thread (idempotent)."""
    global _thread
    if camera_state.active and camera_state.source == "mobile":
        return {"message": "A mobile camera is already connected."}
    if _thread is not None and _thread.is_alive():
        return {"message": "Camera already running"}
    _stop_event.clear()
    _thread = threading.Thread(target=_detection_loop, daemon=True)
    _thread.start()
    # Give it a moment to initialise
    time.sleep(0.8)
    if camera_state.error:
        return {"message": f"Camera failed: {camera_state.error}"}
    return {"message": "Camera started"}


def stop_camera() -> dict:
    """Signal the detection thread to stop."""
    _stop_event.set()
    if _thread is not None:
        _thread.join(timeout=3)
    with camera_state._lock:
        camera_state.active = False
        camera_state.status = "Inactive"
        camera_state.source = "none"
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
