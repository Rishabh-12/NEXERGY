from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="NexEnergy API")

# VIP Pass for Member 3's Frontend (Allows the dashboard to talk to your API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Set to "*" during the hackathon so any laptop can connect
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API MEMORY (STATE) ---
room_state = {
    "AC": True,
    "Ceiling Fan": True,
    "Gaming PC": False,
    "people_count": 0,
}

# --- BLUEPRINTS (PYDANTIC SCHEMAS) ---
class Appliance(BaseModel):
    name: str
    power_watts: float
    hours: float

class OccupancyData(BaseModel):
    people_count: Optional[int] = None
    occupancy_count: Optional[int] = None
    is_occupied: Optional[bool] = None

class SimulationAppliance(BaseModel):
    name: str
    power_watts: float
    current_hours: float
    simulated_hours: float

class RecommendationRequest(BaseModel):
    occupancy: int = 0
    lights_on: bool = True
    ac_on: bool = True
    ac_setpoint_c: float = 22
    operating_hours: float = 2
    baseline_energy_kwh: float = 0
    simulated_energy_kwh: float = 0
    estimated_savings_kwh: float = 0
    estimated_savings_rupees: float = 0

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "NexEnergy API is running"}

@app.get("/room-state")
def get_room_state():
    return room_state

# 1. Member 1: Computer Vision Integration
@app.post("/update-occupancy")
def update_occupancy(data: OccupancyData):
    # Safely extract the count whether Member 1 sends 'occupancy_count' or 'people_count'
    count = data.occupancy_count if data.occupancy_count is not None else data.people_count
    people = max(0, count if count is not None else 0)
    
    room_state["people_count"] = people

    # Simulation only: no physical appliances are controlled.
    if people == 0:
        room_state["AC"] = False
        room_state["Ceiling Fan"] = False
        message = "Room appears empty. Simulated AC and fan switched OFF."
    else:
        room_state["AC"] = True
        room_state["Ceiling Fan"] = True
        message = f"{people} people detected. Simulated AC and fan switched ON."

    return {
        "message": message,
        "current_room_state": room_state,
    }

# 2. The Core Energy Calculator
@app.post("/calculate-multiple")
def calculate_multiple(appliances: list[Appliance]):
    total_energy = 0.0
    total_cost = 0.0
    breakdown = []

    for item in appliances:
        is_on = room_state.get(item.name, True)

        energy = (
            (item.power_watts / 1000) * max(0, item.hours)
            if is_on else 0.0
        )
        cost = energy * 8

        total_energy += energy
        total_cost += cost

        breakdown.append({
            "name": item.name,
            "status": "ON" if is_on else "OFF",
            "energy_kwh": round(energy, 2),
            "daily_cost_rupees": round(cost, 2),
        })

    return {
        "total_energy_kwh": round(total_energy, 2),
        "total_daily_cost": round(total_cost, 2),
        "breakdown": breakdown,
    }

# 3. The Digital Twin What-If Simulator
@app.post("/simulate")
def simulate_savings(appliances: list[SimulationAppliance]):
    baseline_energy = 0.0
    simulated_energy = 0.0
    
    for item in appliances:
        # Calculate current real-world energy
        baseline_energy += (item.power_watts / 1000) * item.current_hours
        # Calculate the "What-If" energy
        simulated_energy += (item.power_watts / 1000) * item.simulated_hours
        
    # The Math
    energy_saved = baseline_energy - simulated_energy
    estimated_rupees_saved = energy_saved * 8
    
    # In India, the grid emission factor is roughly 0.82 kg CO2 per kWh
    carbon_saved_kg = energy_saved * 0.82
    
    return {
        "status": "Simulation Complete",
        "baseline_energy_kwh": round(baseline_energy, 2),
        "simulated_energy_kwh": round(simulated_energy, 2),
        "energy_saved_kwh": round(energy_saved, 2),
        "predicted_savings_rupees": round(estimated_rupees_saved, 2),
        "carbon_saved_kg": round(carbon_saved_kg, 2)
    }


# 4. Rule-based recommendations used by the NexEnergy "AI Recommendations" page.
# These are deterministic rules, not model output, and the response says so.
@app.post("/api/recommendations")
def recommendations(data: RecommendationRequest):
    items = []

    if data.occupancy == 0 and data.lights_on:
        items.append({
            "priority": "high",
            "icon": "lights",
            "title": "Switch off lights in an empty classroom",
            "reason": "The room is marked empty while the lights are on. Turning them off may avoid unnecessary lighting energy use.",
            "action": "Turn classroom lights off in the simulator.",
        })

    if data.occupancy == 0 and data.ac_on:
        items.append({
            "priority": "high",
            "icon": "cooling",
            "title": "Review air conditioning in the empty room",
            "reason": "Cooling an unused room may waste energy. Check ventilation and room conditions first.",
            "action": "Test the AC-off scenario and compare estimated usage.",
        })

    if data.ac_on and data.ac_setpoint_c < 24:
        items.append({
            "priority": "medium",
            "icon": "setpoint",
            "title": "Evaluate a higher AC setpoint",
            "reason": "A moderate setpoint may reduce cooling demand depending on weather, humidity, occupancy and equipment efficiency.",
            "action": "Try 24-26°C and compare comfort requirements.",
        })

    if data.estimated_savings_kwh > 0:
        carbon = data.estimated_savings_kwh * 0.82
        items.append({
            "priority": "result",
            "icon": "result",
            "title": "Your scenario reduces estimated energy use",
            "reason": f"The applied settings estimate {data.estimated_savings_kwh:.2f} kWh less energy for the selected period (about {carbon:.2f} kg CO2).",
            "action": f"Estimated cost reduction: ₹{data.estimated_savings_rupees:.2f}. Verify with meter data when available.",
        })

    if not items:
        items.append({
            "priority": "tip",
            "icon": "tip",
            "title": "Test another energy-saving scenario",
            "reason": "No specific action was identified by the current rules. Try reducing operating hours or testing equipment settings.",
            "action": "Change a setting and apply the simulation.",
        })

    return {"source": "rules", "recommendations": items}
