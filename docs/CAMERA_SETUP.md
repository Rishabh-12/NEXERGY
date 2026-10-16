# Camera setup and troubleshooting

There are two camera paths in NexEnergy:

1. **Browser camera:** the Live AI Camera page asks for browser camera permission, performs person detection in the browser, and sends the resulting occupancy to the API. Use the hosted site over HTTPS or `localhost`; browsers generally block camera access on plain HTTP remote sites.
2. **YOLO camera agent:** `detect.py` runs on a computer that can access a webcam or phone IP camera. YOLOv8 person detections happen locally; the script posts occupancy telemetry to the shared API. The backend cannot directly open your laptop camera.

This guide covers the optional Python agent.

## Before you start

- Windows 10/11, Python 3.10 or newer, and PowerShell.
- A webcam connected to the computer, or a phone camera stream reachable from that computer.
- The repository cloned locally and the Render API deployed.
- A private ingest token configured as `CAMERA_INGEST_TOKEN` on the Render `campusiq-api` service. A token is already configured for the current deployment; for a fresh Render environment, make a new random value and save it in the service’s Environment settings.

## Install the vision dependencies

Open PowerShell in the cloned repository folder (the one containing `detect.py` and `requirements-vision.txt`):

```powershell
py --version
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-vision.txt
```

Calling the virtual environment’s `python.exe` directly avoids PowerShell activation-script policy issues. The first run downloads the small `yolov8n.pt` model from Ultralytics; this needs an internet connection. The `.pt` file is excluded from Git.

## Connect it to the hosted API

In PowerShell, set the API address and the **same** private token stored in Render. Replace the placeholder with your secret; do not paste the secret into a source file, issue, or screenshot.

```powershell
$env:BACKEND_URL = "https://campusiq-api-tskc.onrender.com/update-occupancy"
$env:CAMERA_INGEST_TOKEN = "paste-your-private-render-token-here"
.\.venv\Scripts\python.exe detect.py
```

Choose `1` for the laptop/USB webcam, or `2` for a phone IP stream and enter its full stream URL (for example `http://192.168.1.100:8080/video`). The exact URL depends on the phone camera app. Keep the phone and computer on a network that permits devices to reach each other; a guest Wi-Fi network may isolate them. Keep the PowerShell process open while you want occupancy updates.

The console/window controls are:

- `Q` or `Esc`: stop the agent and release the camera.
- `L`: toggle the modeled classroom lights.
- `A`: toggle the modeled classroom AC.
- `R`: reset the local entry/exit counter.

The local detector recognizes/tracks YOLO class `0` (person). It does not detect cell phones or measure energy. The server receives occupancy, equipment toggles, empty duration, FPS, and inference timing. It returns modeled energy and potential waste estimates from the assumed equipment ratings.

## Configure the token in Render

For a new token, generate one in a local PowerShell window:

```powershell
py -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy it directly into Render Dashboard → `campusiq-api` → **Environment** → add/update `CAMERA_INGEST_TOKEN` → save and wait for the deploy to become live. Then set that exact value in the PowerShell window running the agent. Render stores the value as an environment secret; it is deliberately absent from `render.yaml` and the repo. Do not rotate the current live token unless you can update the local agent command with the new value.

## Check whether it is connected

1. Open the [API health response](https://campusiq-api-tskc.onrender.com/api/health). It should report the service as running and `cameraIngestConfigured` as `true`; it does not reveal the token.
2. Start the camera agent and confirm the preview window shows people boxes/counts.
3. Open the Live AI Camera or Digital Twin page. It polls the API for the shared A-101 occupancy state. If the Render service was sleeping, its first response may be delayed while it wakes up.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `py` is not recognized | Install Python from python.org or the Microsoft Store and enable the Python launcher; reopen PowerShell. |
| `No module named cv2` or `ultralytics` | Install requirements using the virtual environment Python command above. |
| PowerShell refuses `Activate.ps1` | Activation is optional. Use `\.venv\Scripts\python.exe` directly as shown above. |
| Camera cannot open | Allow camera access in Windows Privacy settings, close other camera apps, and try webcam index `0`. |
| Phone stream cannot open | Verify the full URL in the phone camera app, same Wi-Fi/LAN, phone screen awake, and firewall/network access. Test the stream URL from the computer first. |
| API returns HTTP 401 | The `CAMERA_INGEST_TOKEN` in this PowerShell session differs from Render’s value. Copy the value again and restart `detect.py`. |
| API returns HTTP 503 | Render has no `CAMERA_INGEST_TOKEN` configured, or the service has not restarted after saving it. Check the health response and Render deploy status. |
| No occupancy changes in the app | Confirm the script says it connected, check for backend update errors in its terminal, then wait for the page’s next polling cycle and reload. |
| Initial detection is slow | The model may be downloading/loading or CPU inference may be slow. Let the first run finish and close other video workloads. |

## Camera and data handling

The Python agent processes video frames locally and sends JSON counts/telemetry; it does not upload raw video or still images. The browser camera path performs inference in the browser and sends detection state. The camera token authenticates the Python agent’s occupancy write. Do not use this demo for identity recognition, attendance, or high-stakes decisions.
