const DEFAULT_API_URL = "";
let apiAvailable = false;

export function isApiAvailable() {
  return apiAvailable;
}

export function getApiUrl() {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("nexenergy_custom_api_url");
    if (custom && custom.trim()) {
      if (custom.includes("nexenergy-api.onrender.com")) {
        localStorage.removeItem("nexenergy_custom_api_url");
      } else {
        return custom.trim().replace(/\/$/, "");
      }
    }
  }
  return (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

export function setCustomApiUrl(url) {
  if (typeof window !== "undefined") {
    if (url && url.trim()) {
      localStorage.setItem("nexenergy_custom_api_url", url.trim().replace(/\/$/, ""));
    } else {
      localStorage.removeItem("nexenergy_custom_api_url");
    }
  }
}

// Local sample state used only when the shared API is unavailable.
const localBackendState = {
  room_state: {
    AC: true,
    "Ceiling Fan": true,
    "Gaming PC": false,
    people_count: 3,
    energy_waste_alert: false,
  },
  camera_state: {
    active: false,
    source: null,
    people_count: 0,
    status: "Inactive",
    empty_seconds: 0,
    energy_waste_alert: false,
    fps: 0,
  },
  historical_data: [
    { date: "2026-10-10", energy_kwh: 45.2, cost_rupees: 361.6, peak_occupancy: 12 },
    { date: "2026-10-11", energy_kwh: 42.1, cost_rupees: 336.8, peak_occupancy: 10 },
    { date: "2026-10-12", energy_kwh: 48.5, cost_rupees: 388.0, peak_occupancy: 15 },
    { date: "2026-10-13", energy_kwh: 39.0, cost_rupees: 312.0, peak_occupancy: 8 },
    { date: "2026-10-14", energy_kwh: 46.8, cost_rupees: 374.4, peak_occupancy: 14 },
  ],
};

async function request(path, options = {}) {
  const base = getApiUrl();
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    if (!response.ok) {
      throw new Error(`API ${path} returned ${response.status}`);
    }
    apiAvailable = true;
    return await response.json();
  } catch {
    apiAvailable = false;
    // Keep sample data available while disconnected, but expose the real link status.
  }

  return simulateBackendResponse(path, options);
}

function simulateBackendResponse(path, options) {
  const body = options?.body ? JSON.parse(options.body) : {};

  if (path === "/room-state") {
    return { ...localBackendState.room_state };
  }

  if (path === "/update-occupancy") {
    const people = Math.max(0, body.people_count ?? body.occupancy_count ?? 0);
    localBackendState.room_state.people_count = people;
    if (typeof body.energy_waste_alert === "boolean") {
      localBackendState.room_state.energy_waste_alert = body.energy_waste_alert;
    } else {
      localBackendState.room_state.energy_waste_alert = people === 0 && (localBackendState.room_state.AC || localBackendState.room_state["Ceiling Fan"]);
    }

    let message;
    if (people === 0) {
      localBackendState.room_state.AC = false;
      localBackendState.room_state["Ceiling Fan"] = false;
      message = "Room appears empty. Simulated AC and fan switched OFF.";
    } else {
      localBackendState.room_state.AC = true;
      localBackendState.room_state["Ceiling Fan"] = true;
      message = `${people} people detected. Simulated AC and fan switched ON.`;
    }

    return {
      message,
      current_room_state: { ...localBackendState.room_state },
    };
  }

  if (path === "/simulate") {
    const appliances = Array.isArray(body) ? body : [];
    let baseline_energy = 0;
    let simulated_energy = 0;

    for (const item of appliances) {
      baseline_energy += (item.power_watts / 1000) * (item.current_hours || 2);
      simulated_energy += (item.power_watts / 1000) * (item.simulated_hours ?? item.current_hours ?? 2);
    }

    if (appliances.length === 0) {
      baseline_energy = 4.4;
      simulated_energy = 2.2;
    }

    const energy_saved = Math.max(0, baseline_energy - simulated_energy);
    const predicted_savings_rupees = energy_saved * 8;
    const carbon_saved_kg = energy_saved * 0.82;

    return {
      status: "Simulation Complete",
      baseline_energy_kwh: Number(baseline_energy.toFixed(2)),
      simulated_energy_kwh: Number(simulated_energy.toFixed(2)),
      energy_saved_kwh: Number(energy_saved.toFixed(2)),
      predicted_savings_rupees: Number(predicted_savings_rupees.toFixed(2)),
      carbon_saved_kg: Number(carbon_saved_kg.toFixed(2)),
    };
  }

  if (path === "/historical-data") {
    return localBackendState.historical_data;
  }

  if (path === "/api/recommendations") {
    const { occupancy = 0, lights_on = true, ac_on = true, ac_setpoint_c = 22, operating_hours = 2, estimated_savings_kwh = 0, estimated_savings_rupees = 0 } = body;
    const items = [];

    if (occupancy === 0 && lights_on) {
      items.push({
        priority: "high",
        icon: "lights",
        title: "Switch off lights in an empty classroom",
        reason: "The room is marked empty while the lights are on. Turning them off avoids unnecessary lighting energy use.",
        action: "Turn classroom lights off in the simulator.",
      });
    }

    if (occupancy === 0 && ac_on) {
      items.push({
        priority: "high",
        icon: "cooling",
        title: "Review air conditioning in the empty room",
        reason: "Cooling an unused room wastes considerable energy. Check ventilation and room conditions first.",
        action: "Test the AC-off scenario and compare estimated usage.",
      });
    }

    if (ac_on && ac_setpoint_c < 24) {
      items.push({
        priority: "medium",
        icon: "setpoint",
        title: "Evaluate a higher AC setpoint",
        reason: "A moderate setpoint (24–26°C) reduces cooling power demand substantially while maintaining comfort.",
        action: "Try 24-26°C and compare comfort requirements.",
      });
    }

    if (operating_hours > 6) {
      items.push({
        priority: "medium",
        icon: "tip",
        title: "Consider reducing operating hours",
        reason: `Appliances are configured to run for ${operating_hours} hours. Automating timers can reduce excess operation.`,
        action: "Schedule automatic shutdown during unoccupied hours.",
      });
    }

    if (estimated_savings_kwh > 0) {
      const carbon = estimated_savings_kwh * 0.82;
      items.append?.({
        priority: "result",
        icon: "result",
        title: "Your scenario reduces estimated energy use",
        reason: `The applied settings estimate ${estimated_savings_kwh.toFixed(2)} kWh less energy for the selected period (about ${carbon.toFixed(2)} kg CO2).`,
        action: `Estimated cost reduction: ₹${estimated_savings_rupees.toFixed(2)}. Verify with meter data when available.`,
      }) || items.push({
        priority: "result",
        icon: "result",
        title: "Your scenario reduces estimated energy use",
        reason: `The applied settings estimate ${estimated_savings_kwh.toFixed(2)} kWh less energy for the selected period (about ${carbon.toFixed(2)} kg CO2).`,
        action: `Estimated cost reduction: ₹${estimated_savings_rupees.toFixed(2)}. Verify with meter data when available.`,
      });
    }

    if (items.length === 0) {
      items.push({
        priority: "tip",
        icon: "tip",
        title: "Test another energy-saving scenario",
        reason: "No specific action was identified by current rules. Try reducing operating hours or testing equipment settings.",
        action: "Change a setting and apply the simulation.",
      });
    }

    return { source: "rules", recommendations: items };
  }

  if (path === "/generate-insight") {
    const people = body.people_count ?? localBackendState.room_state.people_count;
    const wasteAlert = body.energy_waste_alert ?? (people === 0 && (body.lights_on || body.ac_on));
    const emptySec = body.empty_seconds ?? (people === 0 ? 5 : 0);
    const roomName = body.room_name || "Classroom A-101";
    const energyKwh = body.total_energy_kwh ?? 4.4;
    const cost = body.total_daily_cost ?? Number((energyKwh * 8).toFixed(2));
    const acStatus = body.ac_on ?? localBackendState.room_state.AC;
    const lightsStatus = body.lights_on ?? (people > 0);

    let insightText = "";
    if (body.user_question && body.user_question.trim()) {
      insightText = `${roomName} currently has ${people} ${people === 1 ? "person" : "people"} with an estimated consumption of ${energyKwh.toFixed(2)} kWh for the configured run period (approx ₹${cost.toFixed(2)}). Lights are ${lightsStatus ? "ON" : "OFF"} and AC is ${acStatus ? "ON" : "OFF"}. Operational adjustments in the simulator can help project additional savings.`;
    } else if (wasteAlert || (people === 0 && (acStatus || lightsStatus))) {
      insightText = `AI Vision Alert: ${roomName} is unoccupied (${emptySec}s vacant) with appliances still drawing power. Switch off the cooling and lighting to eliminate unnecessary ₹${cost.toFixed(2)} standby waste.`;
    } else if (people > 0) {
      insightText = `AI Vision detected ${people} occupants in ${roomName} (current estimated load: ${energyKwh.toFixed(2)} kWh, ₹${cost.toFixed(2)}/session). Maintaining cooling setpoints between 24–26°C can trim cooling demand by up to 15% without sacrificing comfort.`;
    } else {
      insightText = `${roomName} is vacant and operating within optimal baseline standby efficiency (${energyKwh.toFixed(2)} kWh, ₹${cost.toFixed(2)}). Continue automated occupancy scheduling.`;
    }

    return {
      source: "smart-engine",
      ai_insight: insightText,
      model: "Smart Campus Engine (Gemini Fallback)",
      vision_context: {
        people_count: people,
        room_status: people > 0 ? "Occupied" : "Empty",
        energy_waste_alert: wasteAlert,
        empty_seconds: emptySec,
        lights_on: lightsStatus,
        ac_on: acStatus,
        energy_kwh: energyKwh,
        cost_rupees: cost,
      },
    };
  }

  if (path === "/camera/status") {
    return {
      ...localBackendState.camera_state,
      people_count: localBackendState.room_state.people_count,
      energy_waste_alert: localBackendState.room_state.energy_waste_alert,
      status: localBackendState.room_state.people_count > 0 ? "Occupied" : "Empty",
    };
  }

  if (path === "/camera/start") {
    localBackendState.camera_state.active = true;
    localBackendState.camera_state.source = body.source || "laptop";
    return { status: "started", source: localBackendState.camera_state.source };
  }

  if (path === "/camera/stop") {
    localBackendState.camera_state.active = false;
    return { status: "stopped" };
  }

  if (path === "/camera/mobile-frame") {
    return {
      status: "frame_received",
      people_count: localBackendState.room_state.people_count,
      energy_waste_alert: localBackendState.room_state.energy_waste_alert,
    };
  }

  return { message: "OK" };
}

export function getRoomState() {
  return request("/room-state");
}

export function sendOccupancy(peopleCount, extra = {}) {
  return request("/update-occupancy", {
    method: "POST",
    body: JSON.stringify({
      people_count: peopleCount,
      occupancy_count: peopleCount,
      ...extra,
    }),
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

export function startCamera(source = null) {
  return request("/camera/start", {
    method: "POST",
    body: JSON.stringify(source ? { source } : {}),
  });
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
  const base = getApiUrl();
  return base ? `${base}/camera/feed` : "/camera/feed";
}

export function fetchSyncInfo() {
  return request("/api/sync-info");
}

export function saveSyncConfig(config) {
  return request("/api/sync-config", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

