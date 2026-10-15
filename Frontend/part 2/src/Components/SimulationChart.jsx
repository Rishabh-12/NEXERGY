export default function SimulationChart({ baselineKwh = 4.4, simulatedKwh = 4.4 }) {
  const baseline = Number(baselineKwh) || 0;
  const simulated = Number(simulatedKwh) || 0;
  const saved = Math.max(0, baseline - simulated);
  const percent = baseline > 0 ? (saved / baseline) * 100 : 0;
  const max = Math.max(baseline, simulated, 0.1);

  const barHeight = (value) => `${Math.max(4, (value / max) * 158)}px`;

  return (
    <section className="panel">
      <div className="panel-title-row">
        <div>
          <p className="eyebrow">ENERGY ANALYTICS</p>
          <h2>Energy comparison</h2>
        </div>
        <span className="tiny-badge">Estimated kWh</span>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 8 }}>
        Compare estimated energy consumption before and after the scenario.
      </p>

      <div className="chart-wrap">
        <div className="bar-col">
          <div className="bar-value">{baseline.toFixed(2)} kWh</div>
          <div className="bar" style={{ "--height": barHeight(baseline) }} />
          <div className="bar-label">Before optimization</div>
        </div>
        <div className="bar-col">
          <div className="bar-value">{simulated.toFixed(2)} kWh</div>
          <div className="bar green" style={{ "--height": barHeight(simulated) }} />
          <div className="bar-label">After optimization</div>
        </div>
      </div>
      <div className="chart-axis" />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 18,
        }}
      >
        <span style={{ fontSize: 11, color: "#94a3b8" }}>Potential reduction</span>
        <strong style={{ color: "#6ee7b7", fontSize: 20 }}>{percent.toFixed(1)}%</strong>
      </div>
      <p className="chart-caption">
        Illustrative estimates based on assumed equipment power ratings, not actual
        electricity meter readings.
      </p>
    </section>
  );
}
