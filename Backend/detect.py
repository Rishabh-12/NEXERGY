
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

# Select: "ip_camera", "webcam", or "video"
SOURCE_MODE = "ip_camera"

CAMERA_INDEX = 0
VIDEO_PATH = "classroom_backup.mp4"

# IMPORTANT: Replace this with your actual IP camera stream URL.
IP_CAMERA_URL = "http://192.168.29.40:8080/video"

MODEL_NAME = "yolov8n.pt"
CONFIDENCE = 0.35
SMOOTHING_FRAMES = 3

# Use 10 seconds for testing; restore to 300 for a 5-minute alert.
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

# Backend endpoint for live CV synchronization.
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000/update-occupancy")
BACKEND_INTERVAL_SECONDS = 2.0

# Compact display panel.
PANEL_FONT_SCALE = 0.42
PANEL_LINE_HEIGHT = 19
PANEL_THICKNESS = 1

WINDOW_NAME = "Smart Campus - IP Camera CV"

# ==================================================


def format_duration(seconds):
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def open_source():
    """Open the selected video source."""
    if SOURCE_MODE == "ip_camera":
        print("Connecting to IP camera...")
        source = cv2.VideoCapture(IP_CAMERA_URL, cv2.CAP_FFMPEG)

        if not source.isOpened():
            source.release()
            source = cv2.VideoCapture(IP_CAMERA_URL)

    elif SOURCE_MODE == "webcam":
        source = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)

        if not source.isOpened():
            source.release()
            source = cv2.VideoCapture(CAMERA_INDEX)

    elif SOURCE_MODE == "video":
        source = cv2.VideoCapture(VIDEO_PATH)

    else:
        raise ValueError(
            "SOURCE_MODE must be ip_camera, webcam, or video"
        )

    if not source.isOpened():
        source.release()
        raise RuntimeError(
            "Could not open video source. Check the IP stream URL, "
            "network, camera app, or video file."
        )

    source.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return source


def post_payload(payload):
    """Send a JSON update asynchronously so the camera loop keeps running."""
    def send():
        try:
            request = urllib.request.Request(
                BACKEND_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=2) as response:
                response.read()

        except Exception as exc:
            print(f"\n[Backend] Update failed: {exc}")

    threading.Thread(target=send, daemon=True).start()


def draw_panel(display, lines, color):
    """Draw a readable panel sized to fit its contents."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    padding = 8

    max_width = 0
    for text, _ in lines:
        (text_width, _), _ = cv2.getTextSize(
            text, font, PANEL_FONT_SCALE, PANEL_THICKNESS
        )
        max_width = max(max_width, text_width)

    panel_width = max_width + 2 * padding
    panel_height = len(lines) * PANEL_LINE_HEIGHT + 2 * padding

    overlay = display.copy()
    cv2.rectangle(
        overlay, (5, 5), (5 + panel_width, 5 + panel_height),
        (25, 25, 25), -1
    )
    cv2.addWeighted(overlay, 0.80, display, 0.20, 0, display)

    for index, (text, is_alert) in enumerate(lines):
        cv2.putText(
            display,
            text,
            (5 + padding, 5 + padding + 10 + index * PANEL_LINE_HEIGHT),
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
        print("Loading YOLOv8 Nano...")
        model = YOLO(MODEL_NAME)

        camera = open_source()
        print(f"Video source connected: {SOURCE_MODE}")
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
        read_failures = 0

        # Use real elapsed time for occupancy timers even for recorded video.
        while True:
            ok, frame = camera.read()

            if not ok or frame is None:
                if SOURCE_MODE in ("webcam", "ip_camera"):
                    read_failures += 1
                    if read_failures < 30:
                        time.sleep(0.1)
                        continue

                print("\nVideo source unavailable or video ended.")
                break

            read_failures = 0
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

            # YOLO person detection and ByteTrack tracking.
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

            # Draw detection zone and crossing line.
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
                        display, (foot_x, foot_y), 4, (0, 255, 0), -1
                    )

                if track_id is None:
                    continue

                track_id = int(track_id)
                last_seen[track_id] = now

                if inside_zone:
                    tracked_in_zone += 1

                previous = previous_positions.get(track_id)

                # Count line crossings only when the foot point crosses
                # within the configured horizontal segment.
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
                track_id for track_id, seen_time in last_seen.items()
                if now - seen_time > STALE_TRACK_SECONDS
            ]

            for track_id in stale_ids:
                last_seen.pop(track_id, None)
                previous_positions.pop(track_id, None)
                last_cross.pop(track_id, None)

            # 1. Smooth occupancy over consecutive frames.
            recent_states.append(people_in_zone > 0)

            if (
                len(recent_states) == SMOOTHING_FRAMES
                and all(state == recent_states[0] for state in recent_states)
            ):
                confirmed_state = recent_states[0]

            # 2. Empty-room duration.
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

            # 3. Potential energy-waste alert.
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

            # 4. FPS.
            fps_frames += 1
            elapsed = time.perf_counter() - fps_started

            if elapsed >= 1.0:
                fps = fps_frames / elapsed
                fps_frames = 0
                fps_started = time.perf_counter()

            # 5. Send data to the existing backend periodically.
            if (
                BACKEND_URL
                and now - last_backend_send >= BACKEND_INTERVAL_SECONDS
            ):
                last_backend_send = now

                post_payload({
                    "people_count": int(people_in_zone),
                    "status": status,
                    "empty_seconds": int(empty_seconds),
                    "lights_on": LIGHTS_ON,
                    "ac_on": AC_ON,
                    "energy_waste_alert": waste_alert,
                })

            # 6. Visible information panel.
            color = (
                (0, 255, 0) if confirmed_state is True
                else (0, 0, 255) if confirmed_state is False
                else (0, 255, 255)
            )

            panel_lines = [
                (f"People in zone: {people_in_zone}", False),
                (f"Tracked IDs: {tracked_in_zone}", False),
                (f"Room status: {status}", False),
                (f"Empty duration: {format_duration(empty_seconds)}", False),
                (f"Entries: {entries} | Exits: {exits}", False),
                (f"FPS: {fps:.1f} | Inference: {inference_ms:.0f} ms", False),
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
                        WINDOW_NAME, cv2.WND_PROP_VISIBLE
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
