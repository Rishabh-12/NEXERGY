# NexEnergy

Smart campus energy optimizer: a React dashboard with a digital-twin classroom, a what-if
energy simulator and rule-based recommendations, backed by a FastAPI service.

```
Backend/            FastAPI service (main.py)
Frontend/part 2/    React + Vite app
```

## Run the backend

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Run the frontend

```bash
cd "Frontend/part 2"
npm install
npm run dev
```

The app calls `http://localhost:8000` by default; set `VITE_API_URL` to point elsewhere.
If the backend is unreachable the UI keeps working with local estimates and shows
"Backend offline" in the sidebar.

## How the two sides connect

| Frontend action | Backend endpoint |
| --- | --- |
| Status indicator and occupancy sync (polled every 4 s) | `GET /room-state` |
| Change simulated occupancy | `POST /update-occupancy` |
| Apply simulation | `POST /simulate` |
| Generate recommendations | `POST /api/recommendations` |

Energy figures are estimates from assumed equipment ratings (lights 400 W, AC 1,800 W,
tariff ₹8/kWh), not meter readings. Recommendations are rule-based, not model output.
