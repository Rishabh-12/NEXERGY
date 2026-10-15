import { Building2, Users, Lightbulb, Snowflake, Info, Minus, Plus } from "lucide-react";
import PageHeader from "./PageHeader";
import { CLASSROOM_CAPACITY } from "../services/energyCalculations";

export default function DigitalClassroom({
  settings,
  backend,
  onOccupancyChange,
  onToggleLights,
  onToggleAc,
}) {
  const { occupancy, lightsOn, acOn } = settings;

  return (
    <section className="page active">
      <PageHeader
        eyebrow="DIGITAL TWIN"
        title="Digital Classroom"
        subtitle="Explore a virtual classroom and see how room settings affect estimated energy use."
      />

      <div className="classroom-page">
        <section className="panel classroom-overview">
          <div>
            <p className="eyebrow">ROOM A-101 · DIGITAL TWIN</p>
            <h2 style={{ marginTop: 7 }}>Classroom live view</h2>
            <p style={{ color: "#94a3b8", fontSize: 12, maxWidth: 540, marginTop: 8 }}>
              Explore a virtual representation of the room. Change demo occupancy and
              equipment states to see the shared dashboard update.
            </p>
            <div className="classroom-badges">
              <span className="classroom-badge">
                <Building2 size={12} /> A-101
              </span>
              <span className="classroom-badge">
                <Users size={12} /> {occupancy} / {CLASSROOM_CAPACITY} seats occupied
              </span>
              <span className="classroom-badge demo">Demo mode</span>
            </div>
          </div>

          <div className="camera-notice">
            <Info size={18} />
            <div>
              <strong>Camera not connected</strong>
              <p>
                Occupancy is set manually here, or received from the backend through
                /update-occupancy.
              </p>
              {backend.status === "online" && backend.message && (
                <p className="backend-line">Backend: {backend.message}</p>
              )}
            </div>
          </div>
        </section>

        <section className="classroom-scene-card">
          <div className="scene-topbar">
            <div>
              <p className="eyebrow">VIRTUAL SPACE</p>
              <h3>Learning zone</h3>
            </div>
            <div className="scene-state-list">
              <span className={`scene-state ${lightsOn ? "on" : "off"}`}>
                <Lightbulb size={12} /> Lights {lightsOn ? "ON" : "OFF"}
              </span>
              <span className={`scene-state ${acOn ? "on" : "off"}`}>
                <Snowflake size={12} /> AC {acOn ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          <div className={`classroom-scene ${lightsOn ? "" : "lights-off"}`}>
            <div className="back-wall">
              <div className="window-row">
                {[0, 1].map((w) => (
                  <div className="window" key={w}>
                    <span />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
              <div className="board">
                <div className="board-line long" />
                <div className="board-line medium" />
                <div className="board-line short" />
                <div className="board-caption">SMART LEARNING</div>
              </div>
              <div className={`ac-unit ${acOn ? "" : "off"}`}>
                ❄ <span>{acOn ? "COOLING" : "STANDBY"}</span>
              </div>
              <div className="light-row">
                <span className="ceiling-light" />
                <span className="ceiling-light" />
                <span className="ceiling-light" />
              </div>
            </div>

            <div className="floor">
              <div className="desk-grid">
                {Array.from({ length: CLASSROOM_CAPACITY }, (_, i) => {
                  const full = i < occupancy;
                  return (
                    <div className={`seat ${full ? "occupied" : ""}`} key={i}>
                      <div className="person">{full ? "♟" : "·"}</div>
                      <div className="desk">
                        ▤<small>DESK {String(i + 1).padStart(2, "0")}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="scene-caption">
              <span>Illustrative room model</span>
              <span>
                Lighting {lightsOn ? "active" : "inactive"} · Cooling{" "}
                {acOn ? "active" : "inactive"}
              </span>
            </div>
          </div>
        </section>

        <div className="grid classroom-controls">
          <section className="panel">
            <p className="eyebrow">OCCUPANCY CONTROL</p>
            <h2>Simulate people in room</h2>
            <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 11 }}>
              Use these controls as a stand-in until computer vision is connected.
            </p>
            <div className="occupancy-control">
              <button
                type="button"
                className="round-control"
                aria-label="Decrease occupancy"
                disabled={occupancy === 0}
                onClick={() => onOccupancyChange(occupancy - 1)}
              >
                <Minus size={18} />
              </button>
              <div className="occupancy-count">
                <strong>{occupancy}</strong>
                <span>people present</span>
              </div>
              <button
                type="button"
                className="round-control"
                aria-label="Increase occupancy"
                disabled={occupancy === CLASSROOM_CAPACITY}
                onClick={() => onOccupancyChange(occupancy + 1)}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="occupancy-track">
              <span style={{ width: `${(occupancy / CLASSROOM_CAPACITY) * 100}%` }} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#64748b",
                fontSize: 10,
              }}
            >
              <span>Empty</span>
              <span>Capacity: {CLASSROOM_CAPACITY}</span>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">EQUIPMENT CONTROLS</p>
            <h2>Room systems</h2>
            <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 11 }}>
              Toggle equipment to update the virtual room and energy estimates.
            </p>
            <div className="equipment-toggle">
              <div className="toggle-icon light">
                <Lightbulb size={20} />
              </div>
              <div className="toggle-copy">
                <strong>Classroom lights</strong>
                <span>Assumed load: 400 W</span>
              </div>
              <button
                type="button"
                className={`toggle ${lightsOn ? "enabled" : ""}`}
                onClick={onToggleLights}
              >
                {lightsOn ? "ON" : "OFF"}
              </button>
            </div>
            <div className="equipment-toggle">
              <div className="toggle-icon cool">
                <Snowflake size={20} />
              </div>
              <div className="toggle-copy">
                <strong>Air conditioning</strong>
                <span>Assumed load: 1,800 W</span>
              </div>
              <button
                type="button"
                className={`toggle ${acOn ? "enabled" : ""}`}
                onClick={onToggleAc}
              >
                {acOn ? "ON" : "OFF"}
              </button>
            </div>
          </section>
        </div>

        <p className="footnote" style={{ marginTop: 0 }}>
          This virtual classroom is an illustrative digital twin, not a live camera
          feed. Occupancy is manually simulated, and energy effects are estimates
          based on assumed equipment ratings.
        </p>
      </div>
    </section>
  );
}
