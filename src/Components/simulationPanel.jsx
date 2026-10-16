import PageHeader from "./PageHeader";
import SimulationChart from "./SimulationChart";
import { Building2, Minus, Plus, Users } from "lucide-react";
import { FLOORS } from "./campusData";
import {
  TARIFF_RUPEES_PER_KWH,
  CARBON_KG_PER_KWH,
} from "../services/energyCalculations";

export default function SimulationPanel({
  settings,
  onChange,
  baseline,
  simulated,
  applied,
  applying,
  onApply,
  selectedRoom,
  onSelectRoom,
  roomOccupancy,
  onRoomOccupancyChange,
}) {
  const savings = Math.max(0, baseline - simulated);
  const cost = savings * TARIFF_RUPEES_PER_KWH;
  const selectedRoomData = FLOORS.flatMap((floor) => floor.rooms).find((room) => room.id === selectedRoom) || FLOORS[0].rooms[0];
  const occupancy = selectedRoom === "A-101" ? settings.occupancy : (roomOccupancy[selectedRoom] ?? selectedRoomData.people);

  return (
    <section className="page active">
      <PageHeader
        eyebrow="ENERGY OPTIMIZATION"
        title="What-if Simulator"
        subtitle="Test equipment settings and operating hours before applying a possible energy-saving change."
      />

      <div className="grid two-col">
        <section className="panel">
          <p className="eyebrow">SCENARIO CONTROLS</p>
          <h2>Classroom settings</h2>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
            Change the equipment configuration to estimate energy use.
          </p>

          <section className="sim-room-occupancy" aria-labelledby="sim-occupancy-title">
            <div className="sim-occupancy-heading">
              <span className="sim-occupancy-icon"><Users size={18}/></span>
              <div><p className="eyebrow">ROOM OCCUPANCY</p><h3 id="sim-occupancy-title">People in a room</h3></div>
            </div>
            <label className="sim-room-select-label" htmlFor="sim-room-select"><Building2 size={15}/> Choose a room</label>
            <select id="sim-room-select" className="sim-room-select" value={selectedRoom} onChange={(event) => onSelectRoom(event.target.value)}>
              {FLOORS.map((floor) => <optgroup key={floor.id} label={floor.label}>{floor.rooms.map((room) => <option key={room.id} value={room.id}>{room.id} · {room.name}</option>)}</optgroup>)}
            </select>
            <div className="sim-occupancy-control">
              <div><strong>{occupancy}</strong><span> / 12 people</span><small>{selectedRoomData.id} · {selectedRoomData.name}</small></div>
              <div className="sim-occupancy-buttons">
                <button type="button" aria-label={`Remove one person from ${selectedRoom}`} disabled={occupancy <= 0} onClick={() => onRoomOccupancyChange(selectedRoom, occupancy - 1)}><Minus size={16}/></button>
                <button type="button" aria-label={`Add one person to ${selectedRoom}`} disabled={occupancy >= 12} onClick={() => onRoomOccupancyChange(selectedRoom, occupancy + 1)}><Plus size={16}/></button>
              </div>
            </div>
            <p className="sim-occupancy-note">Updates this room in the Digital Twin. Equipment scenario controls below are modeled for A-101.</p>
          </section>

          <div className="control-row">
            <div>
              <strong style={{ fontSize: 12 }}>Classroom lights</strong>
              <p>Assumed load: 400 W</p>
            </div>
            <button
              type="button"
              className="switch"
              onClick={() => onChange({ lightsOn: !settings.lightsOn })}
            >
              {settings.lightsOn ? "ON" : "OFF"}
            </button>
          </div>

          <div className="control-row">
            <div>
              <strong style={{ fontSize: 12 }}>Air conditioning</strong>
              <p>Assumed load: 1,800 W</p>
            </div>
            <button
              type="button"
              className="switch"
              onClick={() => onChange({ acOn: !settings.acOn })}
            >
              {settings.acOn ? "ON" : "OFF"}
            </button>
          </div>

          <div style={{ padding: "18px 0", borderBottom: "1px solid #263449" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <strong>AC setpoint</strong>
              <span>{settings.setpoint}°C</span>
            </div>
            <input
              className="range"
              type="range"
              min="18"
              max="28"
              value={settings.setpoint}
              aria-label="AC setpoint"
              onChange={(e) => onChange({ setpoint: Number(e.target.value) })}
            />
            <p style={{ color: "#8493a8", fontSize: 10, marginTop: 4 }}>
              Displayed setting only; not included in the current energy calculation.
            </p>
          </div>

          <div style={{ padding: "18px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <strong>Operating hours</strong>
              <span>{settings.hours} hours</span>
            </div>
            <input
              className="range"
              type="range"
              min="1"
              max="12"
              value={settings.hours}
              aria-label="Operating hours"
              onChange={(e) => onChange({ hours: Number(e.target.value) })}
            />
          </div>

          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 5 }}
          >
            <div className="room-mini">
              <p>Baseline</p>
              <strong>{baseline.toFixed(2)} kWh</strong>
            </div>
            <div className="room-mini">
              <p>Simulated</p>
              <strong>{simulated.toFixed(2)} kWh</strong>
            </div>
            <div className="room-mini">
              <p>Savings</p>
              <strong>{savings.toFixed(2)} kWh</strong>
            </div>
          </div>

          <div className="room-mini" style={{ marginTop: 12 }}>
            <p>Estimated cost savings</p>
            <strong style={{ color: "#6ee7b7", fontSize: 24 }}>₹{cost.toFixed(2)}</strong>
            <p>Assumed tariff: ₹{TARIFF_RUPEES_PER_KWH}/kWh</p>
          </div>

          <button
            type="button"
            className="primary action"
            style={{ width: "100%" }}
            disabled={applying}
            onClick={onApply}
          >
            {applying ? "Applying…" : "Apply simulation"}
          </button>
          {applied.source && (
            <p className="backend-line">
              {applied.source === "backend"
                ? `Calculated by the backend · ${applied.carbon.toFixed(2)} kg CO₂ avoided (${CARBON_KG_PER_KWH} kg/kWh grid factor)`
                : "Backend unavailable · calculated locally"}
            </p>
          )}
        </section>

        <SimulationChart baselineKwh={baseline} simulatedKwh={simulated} />
      </div>
    </section>
  );
}
