from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Smart Campus Energy Optimizer")

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

# --- ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "Energy Calculator API is running"}

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