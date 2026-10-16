# Contributing to NexEnergy

The application lives at the repository root. It uses React/Vite for the interface and an Express API in `server.ts`. During development, Express hosts Vite middleware. In the hosted deployment, GitHub Pages serves the frontend and Render runs the API; the Node server can also serve a production build from `dist/`.

## Local development

```bash
npm install
npm run dev
```

Open the local address printed in the terminal (normally `http://localhost:3000`). To make the local app use the hosted API, set `VITE_API_URL` before starting Vite. To create a production build, run `npm run build`. To check the Python camera agent syntax, run `py -m py_compile detect.py`.

## Camera agent

The browser camera uses in-browser person detection and syncs occupancy to the API. For YOLOv8, install `requirements-vision.txt` and run `detect.py` on the device that can access the webcam or phone IP stream. Set `BACKEND_URL` to the API `/update-occupancy` endpoint. Set `CAMERA_INGEST_TOKEN` to the same private value configured on the API host. Never commit the token, webcam images, or downloaded model weights. See [the camera setup guide](docs/CAMERA_SETUP.md) for Windows steps and troubleshooting.

## Deployment

GitHub Actions builds and publishes the frontend to GitHub Pages. `render.yaml` configures the Node API service on Render. Keep its `CORS_ORIGINS` value aligned with the frontend origin. Read [the architecture guide](docs/ARCHITECTURE.md) for data flow, energy assumptions, API paths, and deployment behavior.
