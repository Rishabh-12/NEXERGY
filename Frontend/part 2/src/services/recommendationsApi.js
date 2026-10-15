
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fetchAIRecommendations(scenario) {
  const response = await fetch(
    `${API_URL}/api/recommendations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        occupancy: scenario.occupancy,
        lights_on: scenario.lightsOn,
        ac_on: scenario.acOn,
        ac_setpoint_c: scenario.acSetpoint,
        operating_hours: scenario.hours,
        baseline_energy_kwh: scenario.baselineEnergyKwh,
        simulated_energy_kwh: scenario.simulatedEnergyKwh,
        estimated_savings_kwh: scenario.estimatedSavingsKwh,
        estimated_savings_rupees: scenario.estimatedSavingsRupees,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch AI recommendations");
  }

  return response.json();
}
