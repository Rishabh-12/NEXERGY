# NexEnergy — Smart Campus Energy Optimizer

NexEnergy is a campus energy dashboard that combines a multi-floor digital twin, person-only camera occupancy detection, what-if energy simulations, and project-aware AI guidance. It helps campus teams explore possible energy waste and compare modeled scenarios.

> **Energy values are estimates.** The camera detects people; it does not measure electricity or equipment power. Unless a meter is connected, consumption, cost, and savings are modeled from equipment assumptions.

## Live site

- **Web app:** [rishabh-12.github.io/code-cash](https://rishabh-12.github.io/code-cash/)
- **API deployment:** GitHub Pages serves the frontend only. Camera inference, shared room state, and backend-generated recommendations need the FastAPI service deployed separately; see [Deployment](#deployment).
- **Releases:** [GitHub Releases](https://github.com/Rishabh-12/code-cash/releases). No versioned release has been published yet; project changes are tracked in [CHANGELOG.md](CHANGELOG.md).

![GitHub Pages deployment workflow](https://github.com/Rishabh-12/code-cash/actions/workflows/deploy-pages.yml/badge.svg?branch=main)

## What it does

- **Campus dashboard:** overview of modeled occupancy, energy estimates, recommendations, and savings.
- **Digital twin:** explore three floors and nine modeled rooms; A-101 is the room currently connected to the backend room-state API. Other room profiles are sample data.
- **Live camera:** request access to a browser camera and send frames to the backend for YOLO person detection. Detection can update A-101 occupancy; the camera does not detect cell phones or read energy meters.
- **Energy simulator:** adjust lighting, air-conditioning, temperature, and operating hours to compare estimated scenarios.
- **AI recommendations and chat:** use local rule-based guidance without a key, or connect Gemini for generated answers. The chat uses the selected room and current app telemetry as context.
- **Historical data:** view the sample campus energy data supplied with the project.

## How it works

```text
Browser camera ──frames──▶ FastAPI + detect.py / YOLO ──occupancy──▶ A-101 room state
       │                                                               │
       └──────────────────── React + Vite dashboard ◀──────────────────┘
                                      │
             equipment assumptions ─┴─▶ estimated energy and scenarios
                                      │
                         local guidance or Gemini AI
```

The live camera feature needs a reachable backend. Camera permission is available on `localhost` and secure (`https`) sites. Gemini chat can call Google directly from the browser using a key entered in the app; that key is kept in the current browser tab's `sessionStorage` and sent to Google for the request. Do not commit API keys or put secrets in `VITE_*` variables.

The backend currently keeps room state in process memory, without a persistent database. A service restart resets that state; the API is intended for a single demonstration room, not concurrent multi-building production use.

## Technology

- Frontend: React 19, Vite 8, Tailwind CSS 4, Recharts, Lucide
- Backend: Python 3.11, FastAPI, Uvicorn
- Vision: OpenCV and Ultralytics YOLOv8, restricted to person detections
- AI: Google Gemini API, with local/backend rule-based fallbacks
- Hosting: GitHub Pages for the static frontend; Render Blueprint (`render.yaml`) for the API

## Run locally

Install Node.js 22 and Python 3.11. Start the backend and frontend in separate terminals.

### 1. Backend

From the repository root, create a virtual environment and install the Python packages.

**Windows PowerShell:**

```powershell
cd Backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-desktop.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

**macOS / Linux:**

```bash
cd Backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-desktop.txt
python -m uvicorn main:app --reload --port 8000
```

The API should be available at [http://localhost:8000](http://localhost:8000); interactive API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs).

Optional backend Gemini configuration (set before starting Uvicorn):

```powershell
# PowerShell
$env:GEMINI_API_KEY = "your-key"
$env:GEMINI_MODEL = "gemini-3.1-flash-lite"
```

```bash
# macOS / Linux
export GEMINI_API_KEY="your-key"
export GEMINI_MODEL="gemini-3.1-flash-lite"
```

The key enables Gemini-backed API recommendations. Without it, the backend uses its rule-based fallback. The chat widget has a separate key setting in the app.

### 2. Frontend

Open a second terminal at the repository root.

**Windows PowerShell:**

```powershell
cd "Frontend/part 2"
npm.cmd ci
npm.cmd run dev
```

Using `npm.cmd` also works on Windows systems where PowerShell blocks the `npm.ps1` script. On macOS or Linux, use `npm ci` and `npm run dev` instead.

Open the local URL printed by Vite, usually [http://localhost:5173](http://localhost:5173). By default, local development connects to the API at `http://localhost:8000`.

### Frontend environment variables

Set these before starting Vite, or configure them as repository variables for the GitHub Pages workflow:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_URL` | Base URL for the FastAPI backend | Development: `http://localhost:8000`; production: `https://nexenergy-api.onrender.com` |
| `VITE_BASE_PATH` | Site path prefix used by Vite | `/` locally; `/code-cash/` in the Pages workflow |
| `VITE_GEMINI_MODEL` | Gemini model used by the browser chat | `gemini-3.8-flash` |

Frontend variables are included in the built JavaScript and must never contain secrets. The user's Gemini chat key is entered in the app and stored only for the current tab session.

## Deployment

### Frontend on GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` installs dependencies, runs frontend lint and build, then publishes the `dist` folder when frontend files on `main` change.

1. In the repository settings, open **Pages** and select **GitHub Actions** as the publishing source.
2. Push frontend changes to `main` or run the **Build and deploy NexEnergy to GitHub Pages** workflow manually from the **Actions** tab.
3. Open [the live site](https://rishabh-12.github.io/code-cash/) after the workflow succeeds.

### Backend on Render

`render.yaml` defines the FastAPI web service. Create a Render Blueprint for this repository and deploy the `nexenergy-api` service. Add `GEMINI_API_KEY` in the Render service's environment settings if backend AI insights should use Gemini. If Render gives the service a different URL, set the repository Actions variable `VITE_API_URL` to that HTTPS API URL and rerun the Pages workflow.

If deploying a fork or changing the frontend domain, update `CORS_ORIGINS` in `render.yaml` to include the frontend origin. The default production frontend expects `https://nexenergy-api.onrender.com`. Free Render services may sleep when idle, so the first request may take longer. Confirm the service is reachable at its `/` health endpoint and `/docs` before testing camera detection.

## Backend API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | Service health |
| `GET` | `/room-state` | Current in-memory room state |
| `POST` | `/update-occupancy` | Update occupancy and modeled room response |
| `POST` | `/simulate` | Calculate a what-if scenario |
| `POST` | `/calculate-multiple` | Calculate energy for multiple appliances |
| `POST` | `/generate-insight` | Generate an AI or fallback insight |
| `GET` | `/historical-data` | Read supplied historical data |
| `POST` | `/api/recommendations` | Return scenario recommendations |
| `POST` | `/camera/start` | Start backend camera detection where a camera source is available |
| `POST` | `/camera/mobile-frame` | Send a browser-captured frame for person detection |
| `POST` | `/camera/stop` | Stop camera processing |
| `GET` | `/camera/status` | Read detection status and occupancy |
| `GET` | `/camera/feed` | Read the annotated MJPEG feed |

Full request and response schemas are available at `/docs` when the API is running.

## Repository layout

```text
.
├── .github/
│   └── workflows/deploy-pages.yml  # Frontend checks and GitHub Pages deployment
├── Backend/
│   ├── main.py                     # FastAPI routes, estimates, and recommendations
│   ├── camera.py                   # Camera/API integration
│   ├── detect.py                   # Person-only YOLO inference
│   ├── yolov8n.pt                  # YOLOv8 nano model weights
│   ├── historical_data.csv         # Example historical data
│   └── requirements.txt            # Python dependencies
├── Frontend/part 2/
│   ├── src/                        # React app, components, and services
│   ├── package.json                # Frontend scripts and dependencies
│   └── vite.config.js              # Vite and deployment base path
├── render.yaml                     # Render API service definition
├── CHANGELOG.md                    # Release notes
└── CONTRIBUTING.md                 # Local workflow and contribution guide
```

## Checks

Run these from `Frontend/part 2` before submitting frontend changes:

```bash
npm run lint
npm run build
```

The GitHub Pages workflow runs both checks automatically. The repository does not currently define an automated backend test suite.

## Release notes

There is not yet a published, versioned GitHub release. Release history and unreleased changes are recorded in [CHANGELOG.md](CHANGELOG.md); published versions will appear on the [GitHub Releases page](https://github.com/Rishabh-12/code-cash/releases).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and contribution guidance. When changing energy calculations, camera behavior, or AI context, keep estimates clearly identified and preserve the person-only detection behavior.
