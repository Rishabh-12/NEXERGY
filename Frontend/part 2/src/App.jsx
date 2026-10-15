import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./layout/Sidebar";
import Dashboard from "./Components/Dashboard";
import DigitalClassroom from "./Components/DigitalClassroom";
import SimulationPanel from "./Components/simulationPanel";
import Recommendations from "./Components/Recommendations";
import {
  getRoomState,
  sendOccupancy,
  runSimulation,
} from "./services/api";
import {
  CLASSROOM_CAPACITY,
  buildSimulationPayload,
  calculateEnergy,
  calculateSavings,
} from "./services/energyCalculations";

const INITIAL_SETTINGS = {
  occupancy: 0,
  lightsOn: true,
  acOn: true,
  setpoint: 22,
  hours: 2,
};

const INITIAL_APPLIED = {
  simulated: 4.4,
  savings: 0,
  cost: 0,
  carbon: 0,
  source: null,
};

const POLL_INTERVAL_MS = 4000;
const LOCAL_CHANGE_GRACE_MS = 2000;

const clampOccupancy = (n) => Math.min(CLASSROOM_CAPACITY, Math.max(0, n));

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [applied, setApplied] = useState(INITIAL_APPLIED);
  const [applying, setApplying] = useState(false);
  const [backend, setBackend] = useState({ status: "checking", message: "", energyWasteAlert: false });
  const lastLocalChange = useRef(0);

  const updateSettings = useCallback(
    (patch) => setSettings((current) => ({ ...current, ...patch })),
    [],
  );

  // Keep the occupancy in sync with the backend, so counts pushed to
  // /update-occupancy (e.g. by the computer-vision service) show up here.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const state = await getRoomState();
        if (cancelled) return;
        setBackend((b) => ({
          ...b,
          status: "online",
          energyWasteAlert: Boolean(state.energy_waste_alert),
        }));

        const recentlyChanged =
          Date.now() - lastLocalChange.current < LOCAL_CHANGE_GRACE_MS;
        if (!recentlyChanged && Number.isFinite(state.people_count)) {
          const count = clampOccupancy(state.people_count);
          setSettings((s) => (s.occupancy === count ? s : { ...s, occupancy: count }));
        }
      } catch {
        if (!cancelled) setBackend((b) => ({ ...b, status: "offline", message: "", energyWasteAlert: false }));
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const changeOccupancy = useCallback(async (next) => {
    const count = clampOccupancy(next);
    lastLocalChange.current = Date.now();
    setSettings((s) => ({ ...s, occupancy: count }));

    try {
      const result = await sendOccupancy(count);
      setBackend({ status: "online", message: result.message ?? "" });
    } catch {
      setBackend({ status: "offline", message: "" });
    }
  }, []);

  // Live (not yet applied) estimates for the current switches and hours.
  const baselineEnergy = calculateEnergy({ lightsOn: true, acOn: true, hours: settings.hours });
  const simulatedEnergy = calculateEnergy({
    lightsOn: settings.lightsOn,
    acOn: settings.acOn,
    hours: settings.hours,
  });

  async function applySimulation() {
    setApplying(true);
    try {
      const result = await runSimulation(buildSimulationPayload(settings));
      setApplied({
        simulated: result.simulated_energy_kwh,
        savings: result.energy_saved_kwh,
        cost: result.predicted_savings_rupees,
        carbon: result.carbon_saved_kg,
        source: "backend",
      });
      setBackend((b) => ({ ...b, status: "online" }));
    } catch {
      const savings = calculateSavings({ baseline: baselineEnergy, simulated: simulatedEnergy });
      setApplied({
        simulated: simulatedEnergy.energyKwh,
        savings: savings.savedKwh,
        cost: savings.savedCost,
        carbon: savings.savedCarbonKg,
        source: "local",
      });
      setBackend({ status: "offline", message: "" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Sidebar activePage={page} onNavigate={setPage} backendStatus={backend.status} />

      <main>
        {page === "dashboard" && (
          <Dashboard
            settings={settings}
            applied={applied}
            baseline={baselineEnergy.energyKwh}
            onNavigate={setPage}
            backend={backend}
          />
        )}

        {page === "classroom" && (
          <DigitalClassroom
            settings={settings}
            backend={backend}
            onOccupancyChange={changeOccupancy}
            onToggleLights={() => updateSettings({ lightsOn: !settings.lightsOn })}
            onToggleAc={() => updateSettings({ acOn: !settings.acOn })}
          />
        )}

        {page === "simulator" && (
          <SimulationPanel
            settings={settings}
            onChange={updateSettings}
            baseline={baselineEnergy.energyKwh}
            simulated={simulatedEnergy.energyKwh}
            applied={applied}
            applying={applying}
            onApply={applySimulation}
          />
        )}

        {page === "recommendations" && (
          <Recommendations
            settings={settings}
            applied={applied}
            baseline={baselineEnergy.energyKwh}
            simulated={simulatedEnergy.energyKwh}
          />
        )}
      </main>
    </>
  );
}
