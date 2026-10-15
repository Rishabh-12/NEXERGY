# NexEnergy - Smart Campus Energy Optimizer

Smart campus energy optimizer: a React dashboard with a digital-twin classroom, real-time AI Computer Vision occupancy detection (YOLOv8), Google Gemini AI insights, what-if energy simulator, and rule-based recommendations, backed by a FastAPI service.

```
Backend/
  main.py              FastAPI service with Gemini AI and Historical Data
  camera.py            YOLOv8 Computer Vision live webcam occupancy & waste tracking
  yolov8n.pt           YOLOv8 nano vision model weights
  historical_data.csv  Historical energy usage records
  requirements.txt     Backend and CV dependencies
Frontend/part 2/       React + Vite dashboard
```

## Quick Start

### 1. Run the Backend (Terminal 1)

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> **Optional Gemini AI Setup**: Set your Gemini API key in your environment before starting:
> ```bash
> export GEMINI_API_KEY="your-api-key"   # Linux/macOS
> $env:GEMINI_API_KEY="your-api-key"     # PowerShell
> ```
> If not provided, an intelligent built-in advisory engine serves as a fallback.

### 2. Live Web Camera & Computer Vision

You can start and view the camera directly in the web dashboard!
- Navigate to **Live AI Camera** from the sidebar
- Click **"Start Camera"** to stream live YOLOv8 person detection with real-time bounding boxes directly in the browser
- Live occupancy, waste timer (3s empty threshold), and appliances auto-sync directly into the digital twin

*(Alternatively, run `python camera.py` from `Backend/` for standalone detection)*

### 3. Run the Frontend (Terminal 2)

```bash
cd "Frontend/part 2"
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser. The app connects to `http://localhost:8000` by default (set `VITE_API_URL` to configure custom host).

## Publish the integrated site

The frontend is published to GitHub Pages by `.github/workflows/deploy-pages.yml` after changes reach `main`. The FastAPI service runs separately from the static site and is described in `render.yaml`.

1. In GitHub, open **Settings → Pages** for this repository and choose **GitHub Actions** as the publishing source.
2. In Render, create a new Blueprint from this repository and select `render.yaml`. The API is created as `https://nexenergy-api.onrender.com`; if Render assigns a different hostname, add a repository variable named `VITE_API_URL` with that API URL before the Pages workflow builds.
3. Set `GEMINI_API_KEY` in the Render service environment if server-generated recommendations should use Gemini. The service has a rule-based fallback when no key is set.
4. Once Pages is enabled, merge or push changes to `main` to publish. The site URL is `https://rishabh-12.github.io/code-cash/`.

The API uses the configured `CORS_ORIGINS` value in `render.yaml`, which allows the published Pages origin and local Vite development. Render's free web service may sleep while idle; the first request after inactivity can take longer. YOLO camera inference requires sufficient memory and a working camera source. A cloud service cannot access a laptop's built-in camera; use the browser's **Live AI Camera** page to submit camera frames from the device instead. Energy values remain estimates unless connected meter data is available.

## How the Components Connect

| Action / Feature | Endpoint |
| --- | --- |
| Status indicator and live occupancy sync (polled every 4s) | `GET /room-state` |
| Real-time occupancy update from Camera AI or manual input | `POST /update-occupancy` |
| Start YOLOv8 background camera detection | `POST /camera/start` |
| Stop YOLOv8 camera detection | `POST /camera/stop` |
| Live camera detection status (people, FPS, alerts) | `GET /camera/status` |
| Real-time MJPEG video stream with bounding boxes | `GET /camera/feed` |
| What-if Digital Twin Simulation | `POST /simulate` |
| Multi-appliance energy calculation | `POST /calculate-multiple` |
| Google Gemini Live AI Advisory Insight | `POST /generate-insight` |
| Historical campus energy records | `GET /historical-data` |
| Explainable scenario recommendations | `POST /api/recommendations` |
| API Documentation (Swagger) | `GET /docs` |

Energy figures are estimates from equipment ratings (lights 400 W, AC 1,800 W, tariff ₹8/kWh).

