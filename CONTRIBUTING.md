# Contributing to NexEnergy

The application lives at the repository root. It uses React/Vite for the interface and an Express API in `server.ts`; the API and web app run together in development and production.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To verify a production build, run `npm run build`. To check the bundled Python camera agent syntax, run `py -m py_compile detect.py`.

## Camera agent

The browser camera uses the browser person detector and syncs occupancy to the API. For YOLOv8, install `requirements-vision.txt` and run `detect.py` on the device that can access the webcam or phone IP stream. Set `BACKEND_URL` to the API `/update-occupancy` endpoint. Set `CAMERA_INGEST_TOKEN` to the same private value configured on the API host. Never commit the token, webcam images, or downloaded model weights.

## Deployment

GitHub Actions builds the current root frontend for GitHub Pages. `render.yaml` configures the Node API service. Keep its `CORS_ORIGINS` value aligned with the frontend domain.
