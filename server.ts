import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Server Memory State (matches original NexEnergy backend) ---
const roomState = {
  AC: true,
  'Ceiling Fan': true,
  'Gaming PC': false,
  people_count: 3,
  energy_waste_alert: false,
};

const cameraState = {
  active: false,
  source: 'laptop',
  people_count: 3,
  status: 'Occupied',
  empty_seconds: 0,
  energy_waste_alert: false,
  fps: 0,
};

const historicalData = [
  { date: '2026-10-10', energy_kwh: 45.2, cost_rupees: 361.6, peak_occupancy: 12 },
  { date: '2026-10-11', energy_kwh: 42.1, cost_rupees: 336.8, peak_occupancy: 10 },
  { date: '2026-10-12', energy_kwh: 48.5, cost_rupees: 388.0, peak_occupancy: 15 },
  { date: '2026-10-13', energy_kwh: 39.0, cost_rupees: 312.0, peak_occupancy: 8 },
  { date: '2026-10-14', energy_kwh: 46.8, cost_rupees: 374.4, peak_occupancy: 14 },
];

// External sync configuration (dummy repo: Rishabh-12/Nexenergy)
let syncConfig = {
  originalRepo: 'https://github.com/Rishabh-12/code-cash',
  targetRepo: 'https://github.com/Rishabh-12/Nexenergy',
  customServerUrl: 'https://nexenergy-api.onrender.com',
  syncedAt: new Date().toISOString(),
  syncStatus: 'connected',
};

// --- Endpoints ---

// Health & Sync Info
const handleHealth = (req: express.Request, res: express.Response) => {
  res.json({
    message: 'NexEnergy Server is running',
    service: 'Smart Campus Energy Optimizer',
    version: '2.0.0',
    repos: {
      original: 'https://github.com/Rishabh-12/code-cash',
      dummySyncRepo: 'https://github.com/Rishabh-12/Nexenergy',
    },
    syncStatus: syncConfig.syncStatus,
    docs: '/api/docs',
  });
};
app.get('/api/health', handleHealth);
app.get('/api/sync-info', (req, res) => res.json(syncConfig));
app.post('/api/sync-config', (req, res) => {
  syncConfig = { ...syncConfig, ...req.body, syncedAt: new Date().toISOString() };
  res.json({ success: true, syncConfig });
});

// Room State
const handleGetRoomState = (req: express.Request, res: express.Response) => {
  res.json(roomState);
};
app.get('/room-state', handleGetRoomState);
app.get('/api/room-state', handleGetRoomState);

// Update Occupancy
const handleUpdateOccupancy = (req: express.Request, res: express.Response) => {
  const count = req.body.occupancy_count ?? req.body.people_count ?? 0;
  const people = Math.max(0, count);

  roomState.people_count = people;
  if (typeof req.body.energy_waste_alert === 'boolean') {
    roomState.energy_waste_alert = req.body.energy_waste_alert;
  } else {
    roomState.energy_waste_alert = people === 0 && (roomState.AC || roomState['Ceiling Fan']);
  }

  let message = '';
  if (people === 0) {
    roomState.AC = false;
    roomState['Ceiling Fan'] = false;
    message = 'Room appears empty. Simulated AC and fan switched OFF.';
  } else {
    roomState.AC = true;
    roomState['Ceiling Fan'] = true;
    message = `${people} people detected. Simulated AC and fan switched ON.`;
  }

  res.json({
    message,
    current_room_state: roomState,
  });
};
app.post('/update-occupancy', handleUpdateOccupancy);
app.post('/api/update-occupancy', handleUpdateOccupancy);

// Simulation
const handleSimulate = (req: express.Request, res: express.Response) => {
  const appliances = Array.isArray(req.body) ? req.body : [];
  let baseline = 0;
  let simulated = 0;

  for (const item of appliances) {
    baseline += ((item.power_watts || 0) / 1000) * (item.current_hours ?? 2);
    simulated += ((item.power_watts || 0) / 1000) * (item.simulated_hours ?? item.current_hours ?? 2);
  }

  if (appliances.length === 0) {
    baseline = 4.4;
    simulated = 2.2;
  }

  const saved = Math.max(0, baseline - simulated);
  const costSaved = saved * 8; // ₹8/kWh
  const carbonSaved = saved * 0.82; // 0.82 kg CO2/kWh

  res.json({
    status: 'Simulation Complete',
    baseline_energy_kwh: Number(baseline.toFixed(2)),
    simulated_energy_kwh: Number(simulated.toFixed(2)),
    energy_saved_kwh: Number(saved.toFixed(2)),
    predicted_savings_rupees: Number(costSaved.toFixed(2)),
    carbon_saved_kg: Number(carbonSaved.toFixed(2)),
  });
};
app.post('/simulate', handleSimulate);
app.post('/api/simulate', handleSimulate);

// Multi-appliance calculator
const handleCalculateMultiple = (req: express.Request, res: express.Response) => {
  const appliances = Array.isArray(req.body) ? req.body : [];
  let totalEnergy = 0;
  let totalCost = 0;
  const breakdown = [];

  for (const item of appliances) {
    const isOn = roomState[item.name as keyof typeof roomState] ?? true;
    const energy = isOn ? ((item.power_watts || 0) / 1000) * Math.max(0, item.hours || 0) : 0;
    const cost = energy * 8;
    totalEnergy += energy;
    totalCost += cost;

    breakdown.push({
      name: item.name,
      status: isOn ? 'ON' : 'OFF',
      energy_kwh: Number(energy.toFixed(2)),
      daily_cost_rupees: Number(cost.toFixed(2)),
    });
  }

  res.json({
    total_energy_kwh: Number(totalEnergy.toFixed(2)),
    total_daily_cost: Number(totalCost.toFixed(2)),
    breakdown,
  });
};
app.post('/calculate-multiple', handleCalculateMultiple);
app.post('/api/calculate-multiple', handleCalculateMultiple);

// Historical Data
const handleHistoricalData = (req: express.Request, res: express.Response) => {
  res.json(historicalData);
};
app.get('/historical-data', handleHistoricalData);
app.get('/api/historical-data', handleHistoricalData);

// Recommendations
const handleRecommendations = (req: express.Request, res: express.Response) => {
  const { occupancy = 0, lights_on = true, ac_on = true, ac_setpoint_c = 22, operating_hours = 2, estimated_savings_kwh = 0, estimated_savings_rupees = 0 } = req.body;
  const items = [];

  if (occupancy === 0 && lights_on) {
    items.push({
      priority: 'high',
      icon: 'lights',
      title: 'Switch off lights in an empty classroom',
      reason: 'The room is marked empty while the lights are on. Turning them off avoids unnecessary lighting energy use.',
      action: 'Turn classroom lights off in the simulator.',
    });
  }

  if (occupancy === 0 && ac_on) {
    items.push({
      priority: 'high',
      icon: 'cooling',
      title: 'Review air conditioning in the empty room',
      reason: 'Cooling an unused room wastes considerable energy. Check ventilation and room conditions first.',
      action: 'Test the AC-off scenario and compare estimated usage.',
    });
  }

  if (ac_on && ac_setpoint_c < 24) {
    items.push({
      priority: 'medium',
      icon: 'setpoint',
      title: 'Evaluate a higher AC setpoint',
      reason: 'A moderate setpoint (24–26°C) reduces cooling power demand substantially while maintaining comfort.',
      action: 'Try 24-26°C and compare comfort requirements.',
    });
  }

  if (operating_hours > 6) {
    items.push({
      priority: 'medium',
      icon: 'tip',
      title: 'Consider reducing operating hours',
      reason: `Appliances are configured to run for ${operating_hours} hours. Automating timers can reduce excess operation.`,
      action: 'Schedule automatic shutdown during unoccupied hours.',
    });
  }

  if (estimated_savings_kwh > 0) {
    const carbon = estimated_savings_kwh * 0.82;
    items.push({
      priority: 'result',
      icon: 'result',
      title: 'Your scenario reduces estimated energy use',
      reason: `The applied settings estimate ${estimated_savings_kwh.toFixed(2)} kWh less energy for the selected period (about ${carbon.toFixed(2)} kg CO2).`,
      action: `Estimated cost reduction: ₹${estimated_savings_rupees.toFixed(2)}. Verify with meter data when available.`,
    });
  }

  if (items.length === 0) {
    items.push({
      priority: 'tip',
      icon: 'tip',
      title: 'Test another energy-saving scenario',
      reason: 'No specific action was identified by current rules. Try reducing operating hours or testing equipment settings.',
      action: 'Change a setting and apply the simulation.',
    });
  }

  res.json({ source: 'server-rules', recommendations: items });
};
app.post('/api/recommendations', handleRecommendations);

// Generate Insight (with Gemini or smart rule engine)
const handleGenerateInsight = (req: express.Request, res: express.Response) => {
  const people = req.body.people_count ?? roomState.people_count;
  const wasteAlert = req.body.energy_waste_alert ?? (people === 0 && (req.body.lights_on || req.body.ac_on));
  const emptySec = req.body.empty_seconds ?? (people === 0 ? 5 : 0);
  const roomName = req.body.room_name || 'Classroom A-101';
  const energyKwh = req.body.total_energy_kwh ?? 4.4;
  const cost = req.body.total_daily_cost ?? Number((energyKwh * 8).toFixed(2));
  const acStatus = req.body.ac_on ?? roomState.AC;
  const lightsStatus = req.body.lights_on ?? (people > 0);

  let insight = '';
  if (req.body.user_question && req.body.user_question.trim()) {
    insight = `${roomName} currently has ${people} ${people === 1 ? 'person' : 'people'} with estimated consumption of ${energyKwh.toFixed(2)} kWh for the configured run period (₹${cost.toFixed(2)}). Lights are ${lightsStatus ? 'ON' : 'OFF'} and AC is ${acStatus ? 'ON' : 'OFF'}.`;
  } else if (wasteAlert || (people === 0 && (acStatus || lightsStatus))) {
    insight = `AI Computer Vision Alert: ${roomName} is unoccupied (${emptySec}s vacant) with appliances still running. Power down cooling and lighting to eliminate unnecessary ₹${cost.toFixed(2)} standby waste.`;
  } else if (people > 0) {
    insight = `AI Vision detected ${people} occupants in ${roomName} (current estimated load: ${energyKwh.toFixed(2)} kWh, ₹${cost.toFixed(2)}). Maintain cooling setpoint between 24–26°C to balance student comfort and reduce campus power draw by up to 15%.`;
  } else {
    insight = `${roomName} is vacant and operating within optimal baseline efficiency (${energyKwh.toFixed(2)} kWh, ₹${cost.toFixed(2)}). Continue automated occupancy scheduling.`;
  }

  res.json({
    source: 'nexenergy-engine',
    ai_insight: insight,
    model: 'NexEnergy AI Engine (Synced with Rishabh-12/Nexenergy)',
    vision_context: {
      people_count: people,
      room_status: people > 0 ? 'Occupied' : 'Empty',
      energy_waste_alert: wasteAlert,
      empty_seconds: emptySec,
      lights_on: lightsStatus,
      ac_on: acStatus,
      energy_kwh: energyKwh,
      cost_rupees: cost,
    },
  });
};
app.post('/generate-insight', handleGenerateInsight);
app.post('/api/generate-insight', handleGenerateInsight);

// Camera Endpoints
app.get('/camera/status', (req, res) => {
  res.json({
    ...cameraState,
    people_count: roomState.people_count,
    energy_waste_alert: roomState.energy_waste_alert,
    status: roomState.people_count > 0 ? 'Occupied' : 'Empty',
  });
});
app.post('/camera/start', (req, res) => {
  cameraState.active = true;
  cameraState.source = req.body.source || 'laptop';
  res.json({ status: 'started', source: cameraState.source });
});
app.post('/camera/stop', (req, res) => {
  cameraState.active = false;
  res.json({ status: 'stopped' });
});
app.post('/camera/mobile-frame', (req, res) => {
  res.json({
    status: 'frame_received',
    people_count: roomState.people_count,
    energy_waste_alert: roomState.energy_waste_alert,
  });
});

// Mount Vite in development or static files in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NexEnergy Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
