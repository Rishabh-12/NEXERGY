# NexEnergy — Smart Campus Energy Optimizer

[![GitHub Pages deployment](https://github.com/Rishabh-12/code-cash/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/Rishabh-12/code-cash/actions/workflows/deploy-pages.yml)

**[Open the live app](https://rishabh-12.github.io/code-cash/)**

NexEnergy is a campus energy-optimization demo that brings together a multi-floor 3D digital twin, camera-based occupancy detection, what-if energy simulations, and energy-saving recommendations.

> **Energy values are estimates.** The camera detects people; it does not measure electricity or equipment power. Consumption, cost, and savings are modeled from equipment assumptions and calibrated benchmarks.

## What it does

- **Campus Dashboard:** Live overview of modeled occupancy, baseline vs. simulated energy, cost savings (in ₹), carbon offset (in kg CO₂), and historical campus benchmark trends.
- **3D Digital Twin:** Interactive Three.js 3D building visualization modeling Building A across 3 floors and 9 distinct spaces, with animated lighting and climate arrays.
- **Digital Classroom Inspection:** Detailed room view for inspecting individual ceiling fixture arrays (10 lights), climate units (3 independent ACs), seating occupancy plans, and temperature setpoints.
- **Live AI Camera & Computer Vision:** Real-time in-browser person detection using MobileNet/Coco-SSD with automated empty-room waste alert detection and support for external phone IP streams.
- **What-If Energy Simulator:** Adjust classroom lighting, cooling, setpoint temperatures, and operating hours to project potential kWh, ₹ cost, and CO₂ reductions before applying changes.
- **AI Recommendations & Gemini Chat:** Rule-based optimization heuristics and live Google Gemini AI insights for context-aware energy management recommendations.

## Tech Stack

- **Framework:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS 4, custom architectural theme engine (Light & Dark modes)
- **3D Graphics:** Three.js
- **Computer Vision:** In-browser TensorFlow.js + Coco-SSD (person-only detection)
- **AI & Reasoning:** Google Gemini API with smart telemetry context

## Getting Started

### Requirements

- Node.js 20 or newer
- npm

### Run locally

```bash
# Install dependencies
npm install

# Start the dev server on port 3000
npm run dev

# Build for production
npm run build
```

### Deployment

GitHub Actions builds and publishes the Vite app to [GitHub Pages](https://rishabh-12.github.io/code-cash/). The workflow is defined in `.github/workflows/deploy-pages.yml`; pushes to `main` and manual workflow dispatches deploy the site.

The `render.yaml` blueprint configures the Node/Express API at `https://campusiq-api.onrender.com`. To deploy the API, create a Render service from this repository using that blueprint and set its private `CAMERA_INGEST_TOKEN` environment variable. The frontend uses the local development API while running locally and the configured Render API on GitHub Pages.

Render's free service can sleep while idle. The first API request after it sleeps may take a little longer while the service starts.

## Run the YOLO camera agent

`detect.py` is a local camera agent based on the supplied YOLOv8 script. Run it on the computer that can access the USB webcam or phone IP stream. It detects people only and posts occupancy, empty-room duration, and inference data to the online API. The hosted backend cannot directly open a camera attached to your computer; the Python agent bridges that camera to the app.

1. Generate a private value with `py -c "import secrets; print(secrets.token_urlsafe(32))"`. Set it as `CAMERA_INGEST_TOKEN` in the Render service settings, then use the same value in the terminal where you launch the agent. Never commit the token.
2. Install Python 3.10 or newer, then run in PowerShell:

   ```powershell
   cd C:\Users\Rishabh\Downloads\code-cash
   py -m pip install -r requirements-vision.txt
   $env:BACKEND_URL = "https://campusiq-api.onrender.com/update-occupancy"
   $env:CAMERA_INGEST_TOKEN = "paste-the-same-private-value-from-Render"
   py detect.py
   ```

3. Choose `1` for a webcam or `2` and enter the phone camera's stream URL. Keep the script running; the Dashboard, Digital Twin, and Live Camera page refresh from the shared backend state.

The camera provides occupancy only. Energy, cost, and potential savings are estimates from modeled lighting and AC loads, not meter readings. The browser camera works separately over HTTPS and also syncs its detections to the API.
