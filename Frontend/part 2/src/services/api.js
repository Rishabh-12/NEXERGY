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
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `Request to ${path} failed (${response.status})`);
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

export function fetchAiInsight(params = {}) {
  return request("/generate-insight", {
    method: "POST",
    body: JSON.stringify({
      total_energy_kwh: params.totalEnergyKwh,
      total_daily_cost: params.totalDailyCost,
      people_count: params.peopleCount,
      status: params.status,
      empty_seconds: params.emptySeconds,
      energy_waste_alert: params.energyWasteAlert,
      lights_on: params.lightsOn,
      ac_on: params.acOn,
      ac_setpoint_c: params.setpoint,
      operating_hours: params.hours,
      user_question: params.question,
      room_name: params.roomName,
    }),
  });
}

// --- Camera / Computer Vision ---

export function startCamera() {
  return request("/camera/start", { method: "POST" });
}

export function stopCamera() {
  return request("/camera/stop", { method: "POST" });
}

export function getCameraStatus() {
  return request("/camera/status");
}

export function sendMobileCameraFrame(imageBase64) {
  return request("/camera/mobile-frame", {
    method: "POST",
    body: JSON.stringify({ image_base64: imageBase64 }),
  });
}

/** Returns the full URL for the MJPEG stream (use as <img src={...}>). */
export function getCameraFeedUrl() {
  return `${API_URL}/camera/feed`;
}
