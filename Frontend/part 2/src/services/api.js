const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request to ${path} failed (${response.status})`);
  }

  return response.json();
}

export function getRoomState() {
  return request("/room-state");
}

export function sendOccupancy(peopleCount) {
  return request("/update-occupancy", {
    method: "POST",
    body: JSON.stringify({ people_count: peopleCount }),
  });
}

export function runSimulation(appliances) {
  return request("/simulate", {
    method: "POST",
    body: JSON.stringify(appliances),
  });
}

export function fetchRecommendations({ settings, applied, baseline, simulated }) {
  return request("/api/recommendations", {
    method: "POST",
    body: JSON.stringify({
      occupancy: settings.occupancy,
      lights_on: settings.lightsOn,
      ac_on: settings.acOn,
      ac_setpoint_c: settings.setpoint,
      operating_hours: settings.hours,
      baseline_energy_kwh: baseline,
      simulated_energy_kwh: simulated,
      estimated_savings_kwh: applied.savings,
      estimated_savings_rupees: applied.cost,
    }),
  });
}

export function fetchHistoricalData() {
  return request("/historical-data");
}

export function fetchAiInsight({ totalEnergyKwh, totalDailyCost, peopleCount }) {
  return request("/generate-insight", {
    method: "POST",
    body: JSON.stringify({
      total_energy_kwh: totalEnergyKwh,
      total_daily_cost: totalDailyCost,
      people_count: peopleCount,
    }),
  });
}

