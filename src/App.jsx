import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./layout/Sidebar";
import Dashboard from "./Components/Dashboard";
import DigitalClassroom from "./Components/DigitalClassroom";
import LiveCamera from "./Components/LiveCamera";
import SimulationPanel from "./Components/simulationPanel";
import Recommendations from "./Components/Recommendations";
import EnergyChat from "./Components/EnergyChat";
import { FLOORS } from "./Components/campusData";
import {
  getRoomStateWithSource,
  sendOccupancyWithSource,
  runSimulationWithSource,
} from "./services/api";
import {
  CLASSROOM_CAPACITY,
  buildSimulationPayload,
  calculateEnergy,
  calculateSavings,
  TARIFF_RUPEES_PER_KWH,
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
const initialRoomEquipment = Object.fromEntries(
  FLOORS.flatMap((floor) => floor.rooms).map((room) => [room.id, {
    lights: Array(10).fill(true),
    acs: Array(3).fill(true),
  }]),
);
const initialSampleOccupancy = Object.fromEntries(
  FLOORS.flatMap((floor) => floor.rooms).map((room) => [room.id, room.people]),
);

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedRoom, setSelectedRoom] = useState("A-101");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("nexergy-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [roomEquipment, setRoomEquipment] = useState(initialRoomEquipment);
  const [sampleOccupancy, setSampleOccupancy] = useState(initialSampleOccupancy);
  const [applied, setApplied] = useState(INITIAL_APPLIED);
  const [applying, setApplying] = useState(false);
  const [backend, setBackend] = useState({ status: "checking", message: "", energyWasteAlert: false });
  const [events, setEvents] = useState([]);
  const lastLocalChange = useRef(0);
  const lastRoomState = useRef(null);
  const lastBackendStatus = useRef("checking");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("nexergy-theme", theme); } catch { /* Theme still applies for this session. */ }
  }, [theme]);

  const recordEvent = useCallback((kind, title, detail, source) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setEvents((current) => [{ id: `${Date.now()}-${Math.random()}`, kind, title, detail, source, time }, ...current].slice(0, 6));
  }, []);

  const updateSettings = useCallback(
    (patch) => {
      setSettings((current) => ({ ...current, ...patch }));
      if (typeof patch.lightsOn === "boolean") setRoomEquipment((current) => ({ ...current, "A-101": { ...current["A-101"], lights: Array(10).fill(patch.lightsOn) } }));
      if (typeof patch.acOn === "boolean") setRoomEquipment((current) => ({ ...current, "A-101": { ...current["A-101"], acs: Array(3).fill(patch.acOn) } }));
    },
    [],
  );

  const updateRoomEquipment = useCallback((roomId, patch) => {
    setRoomEquipment((current) => ({ ...current, [roomId]: { ...current[roomId], ...patch } }));
    if (roomId === "A-101" && Array.isArray(patch.lights)) setSettings((current) => ({ ...current, lightsOn: patch.lights.some(Boolean) }));
    if (roomId === "A-101" && Array.isArray(patch.acs)) setSettings((current) => ({ ...current, acOn: patch.acs.some(Boolean) }));
  }, []);

  const updateSampleOccupancy = useCallback((roomId, count) => {
    setSampleOccupancy((current) => ({ ...current, [roomId]: clampOccupancy(count) }));
  }, []);

  // Keep the occupancy in sync with the backend, so counts pushed to
  // /update-occupancy (e.g. by the computer-vision service) show up here.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const { data: state, source } = await getRoomStateWithSource();
        if (cancelled) return;
        if (source !== "backend") {
          if (lastBackendStatus.current !== "offline") {
            recordEvent("offline", "Backend connection unavailable", "Showing local controls and estimates until the service responds.", "INTERFACE");
            lastBackendStatus.current = "offline";
          }
          setBackend((b) => ({ ...b, status: "offline", message: "", energyWasteAlert: false }));
          return;
        }
        if (lastBackendStatus.current !== "online") {
          recordEvent("connection", "Backend connected", "Room-state polling is receiving responses.", "BACKEND");
          lastBackendStatus.current = "online";
        }
        setBackend((b) => ({
          ...b,
          status: "online",
          energyWasteAlert: Boolean(state.energy_waste_alert),
        }));

        const observed = {
          occupancy: Number.isFinite(state.people_count) ? clampOccupancy(state.people_count) : null,
          energyWasteAlert: Boolean(state.energy_waste_alert),
          acOn: typeof state.AC === "boolean" ? state.AC : null,
          lightsOn: typeof state.Lights === "boolean" ? state.Lights : null,
        };
        const previousRoomState = lastRoomState.current;
        if (previousRoomState) {
          const previous = previousRoomState;
          if (observed.occupancy !== null && observed.occupancy !== previous.occupancy) {
            recordEvent("room", "Room state updated", `${observed.occupancy} ${observed.occupancy === 1 ? "person" : "people"} reported by the room-state endpoint.`, "BACKEND");
          }
          if (observed.energyWasteAlert && !previous.energyWasteAlert) {
            recordEvent("alert", "Potential energy waste reported", "The backend raised an energy-waste alert for the room.", "BACKEND");
          }
          if (!observed.energyWasteAlert && previous.energyWasteAlert) {
            recordEvent("room", "Waste alert cleared", "The backend no longer reports an active energy-waste alert.", "BACKEND");
          }
        }
        lastRoomState.current = observed;

        const recentlyChanged =
          Date.now() - lastLocalChange.current < LOCAL_CHANGE_GRACE_MS;
        if (!recentlyChanged && observed.acOn !== null && previousRoomState && observed.acOn !== previousRoomState.acOn) {
          setRoomEquipment((current) => ({ ...current, "A-101": { ...current["A-101"], acs: Array(3).fill(observed.acOn) } }));
        }
        if (!recentlyChanged && observed.lightsOn !== null && previousRoomState && observed.lightsOn !== previousRoomState.lightsOn) {
          setRoomEquipment((current) => ({ ...current, "A-101": { ...current["A-101"], lights: Array(10).fill(observed.lightsOn) } }));
        }
        if (!recentlyChanged && Number.isFinite(state.people_count)) {
          const count = clampOccupancy(state.people_count);
          setSettings((s) => {
            const acOn = typeof state.AC === "boolean" ? state.AC : s.acOn;
            const lightsOn = typeof state.Lights === "boolean" ? state.Lights : s.lightsOn;
            return s.occupancy === count && s.acOn === acOn && s.lightsOn === lightsOn ? s : { ...s, occupancy: count, acOn, lightsOn };
          });
        }
      } catch {
        if (!cancelled) {
          if (lastBackendStatus.current !== "offline") {
            recordEvent("offline", "Backend connection unavailable", "Showing local controls and estimates until the service responds.", "INTERFACE");
            lastBackendStatus.current = "offline";
          }
          setBackend((b) => ({ ...b, status: "offline", message: "", energyWasteAlert: false }));
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [recordEvent]);

  const changeOccupancy = useCallback(async (next) => {
    const count = clampOccupancy(next);
    lastLocalChange.current = Date.now();
    setSettings((s) => ({ ...s, occupancy: count }));

    try {
      const { data: result, source } = await sendOccupancyWithSource(count);
      setBackend((b) => ({
        ...b,
        status: source === "backend" ? "online" : "offline",
        message: source === "backend" ? result.message ?? "" : "",
      }));
    } catch {
      setBackend({ status: "offline", message: "" });
    }
  }, []);

  const changeRoomOccupancy = useCallback((roomId, count) => {
    if (roomId === "A-101") return changeOccupancy(count);
    updateSampleOccupancy(roomId, count);
    return undefined;
  }, [changeOccupancy, updateSampleOccupancy]);

  // Live (not yet applied) estimates for the current switches and hours.
  const selectedEquipment = roomEquipment["A-101"];
  const baselineEnergy = calculateEnergy({ lightsOn: true, acOn: true, hours: settings.hours, activeLights: 10, activeAcUnits: 3 });
  const simulatedEnergy = calculateEnergy({
    lightsOn: settings.lightsOn,
    acOn: settings.acOn,
    hours: settings.hours,
    activeLights: selectedEquipment.lights.filter(Boolean).length,
    activeAcUnits: selectedEquipment.acs.filter(Boolean).length,
  });

  async function applySimulation() {
    setApplying(true);
    try {
      const { data: result, source } = await runSimulationWithSource(buildSimulationPayload({ ...settings, lightUnits: selectedEquipment.lights, acUnits: selectedEquipment.acs }));
      setApplied({
        simulated: result.simulated_energy_kwh,
        savings: result.energy_saved_kwh,
        cost: result.predicted_savings_rupees,
        carbon: result.carbon_saved_kg,
        source,
      });
      recordEvent(
        "simulation",
        source === "backend" ? "Simulation completed" : "Simulation preview applied",
        `${result.energy_saved_kwh.toFixed(2)} kWh estimated savings · ${source === "backend" ? "backend calculation" : "local estimate"}.`,
        source === "backend" ? "BACKEND" : "LOCAL ESTIMATE",
      );
      setBackend((b) => ({ ...b, status: source === "backend" ? "online" : "offline" }));
    } catch {
      const savings = calculateSavings({ baseline: baselineEnergy, simulated: simulatedEnergy });
      setApplied({
        simulated: simulatedEnergy.energyKwh,
        savings: savings.savedKwh,
        cost: savings.savedCost,
        carbon: savings.savedCarbonKg,
        source: "local",
      });
      recordEvent("simulation", "Simulation preview applied", `${savings.savedKwh.toFixed(2)} kWh estimated savings · local calculation.`, "LOCAL ESTIMATE");
      setBackend({ status: "offline", message: "" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Sidebar activePage={page} onNavigate={setPage} backendStatus={backend.status} theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} />

      <main>
        {page === "dashboard" && (
          <Dashboard
            settings={settings}
            applied={applied}
            baseline={baselineEnergy.energyKwh}
            onNavigate={setPage}
            backend={backend}
            events={events}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            roomEquipment={roomEquipment}
            roomOccupancy={sampleOccupancy}
          />
        )}

        {page === "twin" && (
          <DigitalClassroom
            settings={settings}
            backend={backend}
            onOccupancyChange={changeOccupancy}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            roomEquipmentByRoom={roomEquipment}
            roomOccupancy={sampleOccupancy}
            onSampleOccupancyChange={updateSampleOccupancy}
            onRoomEquipmentChange={updateRoomEquipment}
            onNavigate={setPage}
          />
        )}

        {page === "camera" && (
          <LiveCamera backend={backend} settings={settings} energyEstimate={simulatedEnergy.energyKwh} costEstimate={simulatedEnergy.energyKwh * TARIFF_RUPEES_PER_KWH} onNavigate={setPage} />
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
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            roomOccupancy={sampleOccupancy}
            onRoomOccupancyChange={changeRoomOccupancy}
          />
        )}

        {page === "recommendations" && (
          <Recommendations
            settings={settings}
            applied={applied}
            baseline={baselineEnergy.energyKwh}
            simulated={simulatedEnergy.energyKwh}
            backend={backend}
          />
        )}

      </main>
      <EnergyChat
        settings={settings}
        backend={backend}
        selectedRoom={selectedRoom}
        applied={applied}
        baselineEnergy={baselineEnergy.energyKwh}
        simulatedEnergy={simulatedEnergy.energyKwh}
        roomEquipment={roomEquipment[selectedRoom]}
        roomOccupancy={sampleOccupancy}
      />
    </>
  );
}
