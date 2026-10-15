import os
import cv2
import requests
import time
from ultralytics import YOLO

# --- CONFIGURATION ---
# Points to local FastAPI server running in another terminal (or configured via BACKEND_URL)
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000/update-occupancy")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_MODEL = os.path.join(SCRIPT_DIR, "yolov8n.pt")
MODEL_NAME = LOCAL_MODEL if os.path.exists(LOCAL_MODEL) else "yolov8n.pt"

print("Loading AI Vision Model...")
model = YOLO(MODEL_NAME)
cap = cv2.VideoCapture(0)  # 0 is the default laptop webcam

# --- STATE TRACKING ---
empty_start_time = None
EMPTY_THRESHOLD_SECONDS = 3  # Wait 3 seconds of empty room before triggering alert

print(f"Camera active. Sending live data to {BACKEND_URL}...")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab camera frame.")
        break

    # 1. Run YOLO object detection
    results = model(frame, verbose=False)
    
    # 2. Count people (Class 0 in the COCO dataset is 'person')
    people_count = 0
    for box in results[0].boxes:
        if int(box.cls[0]) == 0:
            people_count += 1

    # 3. Calculate alerts and delays
    energy_waste_alert = False
    empty_seconds = 0
    
    if people_count == 0:
        if empty_start_time is None:
            empty_start_time = time.time()
        else:
            empty_seconds = int(time.time() - empty_start_time)
            if empty_seconds >= EMPTY_THRESHOLD_SECONDS:
                energy_waste_alert = True
    else:
        empty_start_time = None  # Reset the timer immediately if someone walks in

    status = "Occupied" if people_count > 0 else "Empty"

    # 4. Package the data to perfectly match Member 2's OccupancyData schema
    payload = {
        "people_count": people_count,
        "status": status,
        "empty_seconds": empty_seconds,
        "lights_on": people_count > 0,
        "ac_on": people_count > 0,
        "energy_waste_alert": energy_waste_alert
    }

    # 5. Send to the FastAPI Backend
    try:
        response = requests.post(BACKEND_URL, json=payload, timeout=1)
        print(f"Detected: {people_count} | Alert: {energy_waste_alert} | Server Status: {response.status_code}")
    except requests.exceptions.RequestException:
        print("Backend unreachable! Ensure 'uvicorn main:app' is running in Terminal 1.")

    # 6. Display the live video feed with bounding boxes
    annotated_frame = results[0].plot()
    cv2.putText(annotated_frame, f"People: {people_count}", (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    
    if energy_waste_alert:
        cv2.putText(annotated_frame, "WASTE ALERT!", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

    cv2.imshow('CampusIQ - Member 1 Vision', annotated_frame)

    # Press 'q' on your keyboard to close the camera window
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()