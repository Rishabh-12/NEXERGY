
import cv2
import time
import json
import os
import threading
import urllib.request
from collections import deque

import numpy as np
from ultralytics import YOLO

# ================= CONFIGURATION =================

CAMERA_INDEX = 0

MODEL_NAME = "yolov8n.pt"
CONFIDENCE = 0.35
SMOOTHING_FRAMES = 3

# Use 10 seconds for testing; use 300 for a 5-minute alert.
EMPTY_ALERT_SECONDS = 10

# Simulated equipment states. Press L / A to toggle.
LIGHTS_ON = True
AC_ON = True

# Detection zone: normalized coordinates (0.0 to 1.0).
ZONE_POINTS = [
    (0.10, 0.10),
    (0.90, 0.10),
    (0.90, 0.95),
    (0.10, 0.95),
]

# Virtual horizontal entry/exit line.
LINE_Y_PERCENT = 0.55
LINE_X_START = 0.10
LINE_X_END = 0.90

CROSS_COOLDOWN_SECONDS = 1.0
STALE_TRACK_SECONDS = 3.0

# Existing backend endpoint.
BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "https://campusiq-api.onrender.com/update-occupancy"
)
CAMERA_TOKEN = os.getenv("CAMERA_INGEST_TOKEN", "").strip()
ROOM_ID = os.getenv("ROOM_ID", "A-101")
BACKEND_INTERVAL_SECONDS = 1.0

PANEL_FONT_SCALE = 0.42
PANEL_LINE_HEIGHT = 19
PANEL_THICKNESS = 1

WINDOW_NAME = "NexEnergy - YOLO Occupancy Detection"

# ==================================================


def format_duration(seconds):
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def select_video_source():
    """Ask the user to choose webcam or mobile IP camera."""
    print("\n========== SMART CAMPUS CAMERA SETUP ==========")
    print("1. Laptop / USB webcam")
    print("2. Mobile camera via IP stream")

    choice = input("Choose camera source (1 or 2): ").strip()

    if choice == "1":
        return "webcam", CAMERA_INDEX

    if choice == "2":
        url = input(
            "Enter the full mobile camera stream URL "
            "(example: http://192.168.1.100:8080/video): "
        ).strip()

        if not url:
            raise ValueError("No IP camera URL entered. Exiting.")

        if not url.startswith(("http://", "https://", "rtsp://")):
            raise ValueError(
                "Invalid URL format. Use http://, https://, "
                "or rtsp://. Exiting."
            )

        return "ip_camera", url

    raise ValueError(
        "Invalid selection. Run again and enter 1 or 2."
    )


def open_source(source_mode, source_value):
    """Open the selected camera and verify it returns a frame."""

    if source_mode == "ip_camera":
        print(f"\nConnecting to mobile IP camera: {source_value}")

        source = cv2.VideoCapture(
            source_value,
            cv2.CAP_FFMPEG
        )

        if not source.isOpened():
            source.release()
            source = cv2.VideoCapture(source_value)

    elif source_mode == "webcam":
        print("\nConnecting to laptop / USB webcam...")

        source = cv2.VideoCapture(
            source_value,
            cv2.CAP_DSHOW
        )

        if not source.isOpened():
            source.release()
            source = cv2.VideoCapture(source_value)

    else:
        raise ValueError("Unknown camera source selected.")

    if not source.isOpened():
        source.release()
        raise RuntimeError(
            "Could not open the selected camera. Check the IP URL, "
            "camera app, Wi-Fi/network, firewall, or webcam connection. "
            "Exiting."
        )

    print("Checking that the camera is sending video...")

    first_frame = None

    for _ in range(10):
        ok, frame = source.read()

        if ok and frame is not None and frame.size > 0:
            first_frame = frame
            break

        time.sleep(0.2)

    if first_frame is None:
        source.release()
        raise RuntimeError(
            "Camera opened but no valid video frame was received. "
            "The URL may be incorrect or the stream unavailable. Exiting."
        )

    source.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return source, first_frame


def post_payload(payload):
    """Send backend data asynchronously."""

    def send():
        try:
            request = urllib.request.Request(
                BACKEND_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    **({"X-Camera-Token": CAMERA_TOKEN} if CAMERA_TOKEN else {}),
                },
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=10) as response:
                response.read()

        except Exception as exc:
            print(f"\n[Backend] Update failed: {exc}")

    threading.Thread(target=send, daemon=True).start()


def draw_panel(display, lines, color):
    """Draw a readable information panel."""

    font = cv2.FONT_HERSHEY_SIMPLEX
    padding = 8

    max_width = 0

    for text, _ in lines:
        (text_width, _), _ = cv2.getTextSize(
            text,
            font,
            PANEL_FONT_SCALE,
            PANEL_THICKNESS
        )
        max_width = max(max_width, text_width)

    panel_width = max_width + 2 * padding
    panel_height = len(lines) * PANEL_LINE_HEIGHT + 2 * padding

    overlay = display.copy()

    cv2.rectangle(
        overlay,
        (5, 5),
        (5 + panel_width, 5 + panel_height),
        (25, 25, 25),
        -1
    )

    cv2.addWeighted(
        overlay, 0.80, display, 0.20, 0, display
    )

    for index, (text, is_alert) in enumerate(lines):
        cv2.putText(
            display,
            text,
            (
                5 + padding,
                5 + padding + 10 + index * PANEL_LINE_HEIGHT
            ),
            font,
            PANEL_FONT_SCALE,
            (0, 0, 255) if is_alert else color,
            PANEL_THICKNESS,
            cv2.LINE_AA,
        )


def main():
    global LIGHTS_ON, AC_ON

    camera = None

    try:
        # Ask for camera choice before loading the AI model.
        source_mode, source_value = select_video_source()

        # Invalid/unreachable source causes an error and exits.
        camera, first_frame = open_source(
            source_mode,
            source_value
        )

        print(f"Camera connected successfully: {source_mode}")
        print(f"Occupancy updates will be sent to: {BACKEND_URL}")
        print(f"Room: {ROOM_ID} | API token: {'configured' if CAMERA_TOKEN else 'not configured'}")
        print("Loading YOLOv8 Nano...")

        model = YOLO(MODEL_NAME)

        print("Q/ESC = quit | L = toggle lights | A = toggle AC")
        print("R = reset entry/exit counters")

        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)

        recent_states = deque(maxlen=SMOOTHING_FRAMES)
        confirmed_state = None
        empty_since = None
        empty_seconds = 0

        # Tracking data for entry/exit counts.
        previous_positions = {}
        last_seen = {}
        last_cross = {}

        entries = 0
        exits = 0

        # Performance metrics.
        fps = 0.0
        fps_frames = 0
        fps_started = time.perf_counter()

        last_backend_send = 0.0
        previous_alert = False

        # Process the first frame already read during connection testing.
        pending_frame = first_frame

        while True:
            if pending_frame is not None:
                frame = pending_frame
                pending_frame = None
            else:
                ok, frame = camera.read()

                if not ok or frame is None:
                    print(
                        "\nCamera stream stopped returning frames. Exiting."
                    )
                    break

            now = time.monotonic()
            height, width = frame.shape[:2]

            zone = np.array(
                [
                    (int(x * width), int(y * height))
                    for x, y in ZONE_POINTS
                ],
                dtype=np.int32,
            )

            line_y = int(LINE_Y_PERCENT * height)
            line_x1 = int(LINE_X_START * width)
            line_x2 = int(LINE_X_END * width)

            # YOLO person detection and tracking.
            inference_start = time.perf_counter()

            result = model.track(
                frame,
                persist=True,
                tracker="bytetrack.yaml",
                classes=[0],
                conf=CONFIDENCE,
                imgsz=640,
                verbose=False,
            )[0]

            inference_ms = (
                time.perf_counter() - inference_start
            ) * 1000

            display = result.plot()

            # Draw detection zone and entry/exit line.
            cv2.polylines(
                display, [zone], True, (255, 200, 0), 2
            )

            cv2.line(
                display,
                (line_x1, line_y),
                (line_x2, line_y),
                (255, 0, 255),
                2,
            )

            cv2.putText(
                display,
                "ENTRY / EXIT LINE",
                (line_x1, max(20, line_y - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 0, 255),
                1,
            )

            people_in_zone = 0
            tracked_in_zone = 0

            boxes = result.boxes
            box_count = len(boxes) if boxes is not None else 0

            if box_count:
                coordinates = boxes.xyxy.cpu().numpy()
                ids = boxes.id

                track_ids = (
                    ids.int().cpu().tolist()
                    if ids is not None
                    else [None] * box_count
                )
            else:
                coordinates = []
                track_ids = []

            for coords, track_id in zip(coordinates, track_ids):
                x1, y1, x2, y2 = map(int, coords)

                # Bottom-center approximates the person's floor position.
                foot_x = (x1 + x2) // 2
                foot_y = y2

                inside_zone = cv2.pointPolygonTest(
                    zone,
                    (float(foot_x), float(foot_y)),
                    False,
                ) >= 0

                if inside_zone:
                    people_in_zone += 1

                    cv2.circle(
                        display,
                        (foot_x, foot_y),
                        4,
                        (0, 255, 0),
                        -1
                    )

                if track_id is None:
                    continue

                track_id = int(track_id)
                last_seen[track_id] = now

                if inside_zone:
                    tracked_in_zone += 1

                previous = previous_positions.get(track_id)

                # Count crossings of the horizontal line.
                if (
                    previous is not None
                    and line_x1 <= foot_x <= line_x2
                ):
                    previous_y = previous[1]

                    cooled_down = (
                        now - last_cross.get(track_id, -1e9)
                        >= CROSS_COOLDOWN_SECONDS
                    )

                    if cooled_down:
                        if previous_y < line_y <= foot_y:
                            entries += 1
                            last_cross[track_id] = now
                            print(f"\nEntry detected: ID {track_id}")

                        elif previous_y >= line_y > foot_y:
                            exits += 1
                            last_cross[track_id] = now
                            print(f"\nExit detected: ID {track_id}")

                previous_positions[track_id] = (foot_x, foot_y)

            # Forget tracks that have disappeared.
            stale_ids = [
                track_id
                for track_id, seen_time in last_seen.items()
                if now - seen_time > STALE_TRACK_SECONDS
            ]

            for track_id in stale_ids:
                last_seen.pop(track_id, None)
                previous_positions.pop(track_id, None)
                last_cross.pop(track_id, None)

            # Smooth occupancy over consecutive frames.
            recent_states.append(people_in_zone > 0)

            if (
                len(recent_states) == SMOOTHING_FRAMES
                and all(state == recent_states[0] for state in recent_states)
            ):
                confirmed_state = recent_states[0]

            # Track how long the room has been empty.
            if confirmed_state is True:
                empty_since = None
                empty_seconds = 0

            elif confirmed_state is False:
                if empty_since is None:
                    empty_since = now

                empty_seconds = int(now - empty_since)

            else:
                empty_seconds = 0

            status = (
                "OCCUPIED" if confirmed_state is True
                else "EMPTY" if confirmed_state is False
                else "CHECKING"
            )

            # Potential energy-waste alert.
            waste_alert = (
                confirmed_state is False
                and empty_seconds >= EMPTY_ALERT_SECONDS
                and (LIGHTS_ON or AC_ON)
            )

            if waste_alert and not previous_alert:
                equipment = []

                if LIGHTS_ON:
                    equipment.append("Lights")

                if AC_ON:
                    equipment.append("AC")

                print(
                    "\nPOTENTIAL ENERGY WASTE: empty room; "
                    + ", ".join(equipment)
                    + " marked ON"
                )

            if previous_alert and not waste_alert:
                print("\nEnergy-waste alert cleared.")

            previous_alert = waste_alert

            # FPS.
            fps_frames += 1
            elapsed = time.perf_counter() - fps_started

            if elapsed >= 1.0:
                fps = fps_frames / elapsed
                fps_frames = 0
                fps_started = time.perf_counter()

            # Send data to the existing backend.
            if (
                BACKEND_URL
                and now - last_backend_send >= BACKEND_INTERVAL_SECONDS
            ):
                last_backend_send = now

                post_payload({
                    "people_count": int(people_in_zone),
                    "room_id": ROOM_ID,
                    "source": "python-yolo",
                    "status": status,
                    "empty_seconds": int(empty_seconds),
                    "lights_on": LIGHTS_ON,
                    "ac_on": AC_ON,
                    "energy_waste_alert": waste_alert,
                    "fps": round(fps, 1),
                    "inference_ms": round(inference_ms, 1),
                    "operating_hours": 2,
                })

            # Information panel.
            color = (
                (0, 255, 0) if confirmed_state is True
                else (0, 0, 255) if confirmed_state is False
                else (0, 255, 255)
            )

            panel_lines = [
                (f"Source: {source_mode}", False),
                (f"People in zone: {people_in_zone}", False),
                (f"Tracked IDs: {tracked_in_zone}", False),
                (f"Room status: {status}", False),
                (
                    f"Empty duration: {format_duration(empty_seconds)}",
                    False
                ),
                (f"Entries: {entries} | Exits: {exits}", False),
                (
                    f"FPS: {fps:.1f} | Inference: {inference_ms:.0f} ms",
                    False
                ),
                (
                    f"Lights: {'ON' if LIGHTS_ON else 'OFF'} | "
                    f"AC: {'ON' if AC_ON else 'OFF'} (simulated)",
                    False,
                ),
            ]

            if waste_alert:
                panel_lines.append(
                    ("ALERT: POTENTIAL ENERGY WASTE", True)
                )

            draw_panel(display, panel_lines, color)
            cv2.imshow(WINDOW_NAME, display)

            print(
                f"\rCount: {people_in_zone} | {status} | "
                f"Tracked: {tracked_in_zone} | "
                f"In: {entries} Out: {exits} | "
                f"FPS: {fps:.1f} | "
                f"Empty: {format_duration(empty_seconds)}   ",
                end="",
                flush=True,
            )

            key = cv2.waitKey(1) & 0xFF

            if key in (ord("q"), 27):
                print("\nExit requested.")
                break

            elif key in (ord("l"), ord("L")):
                LIGHTS_ON = not LIGHTS_ON

            elif key in (ord("a"), ord("A")):
                AC_ON = not AC_ON

            elif key in (ord("r"), ord("R")):
                entries = 0
                exits = 0
                print("\nEntry/exit counters reset.")

            try:
                if (
                    cv2.getWindowProperty(
                        WINDOW_NAME,
                        cv2.WND_PROP_VISIBLE
                    ) < 1
                ):
                    break
            except cv2.error:
                break

    except KeyboardInterrupt:
        print("\nStopped by user.")

    except (RuntimeError, FileNotFoundError, ValueError) as exc:
        print(f"\nERROR: {exc}")

    finally:
        if camera is not None:
            camera.release()

        cv2.destroyAllWindows()
        print("\nVideo source released. Program closed.")


if __name__ == "__main__":
    main()
