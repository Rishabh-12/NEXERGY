# NexEnergy — Smart Campus Energy Optimizer

NexEnergy is a production-grade campus energy optimizer that combines a 3D multi-floor digital twin (Three.js), real-time computer-vision occupancy tracking (in-browser Coco-SSD / mobile IP stream), what-if energy simulations, and project-aware Gemini AI guidance. It helps campus facilities teams identify energy waste and model operational savings.

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

```bash
# Install dependencies
npm install

# Start the dev server on port 3000
npm run dev

# Build for production
npm run build
```
