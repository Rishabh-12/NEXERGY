import PageHeader from "./PageHeader";
import SimulationChart from "./SimulationChart";
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
}) {
  const savings = Math.max(0, baseline - simulated);
  const cost = savings * TARIFF_RUPEES_PER_KWH;

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
