import {
  Activity,
  Users,
  Zap,
  TrendingDown,
  Lightbulb,
  Snowflake,
  ArrowUpRight,
} from "lucide-react";
import PageHeader from "./PageHeader";

export default function Dashboard({ settings, applied, baseline, onNavigate }) {
  const stats = [
    {
      label: "Classroom occupancy",
      value: settings.occupancy,
      unit: "people",
      note: "Demo occupancy status",
      icon: Users,
      color: "blue",
    },
    {
      label: "Baseline energy",
      value: baseline.toFixed(2),
      unit: "kWh",
      note: "Before changes",
      icon: Zap,
      color: "amber",
    },
    {
      label: "Simulated energy",
      value: applied.simulated.toFixed(2),
      unit: "kWh",
      note: "After applied settings",
      icon: Activity,
      color: "blue",
    },
    {
      label: "Potential savings",
      value: applied.savings.toFixed(2),
      unit: "kWh",
      note: `₹${applied.cost.toFixed(2)} estimated cost reduction`,
      icon: TrendingDown,
      color: "green",
    },
  ];

  return (
    <section className="page active">
      <PageHeader
        eyebrow="CAMPUS OVERVIEW"
        title="Good energy starts here."
        subtitle="Monitor classroom conditions and explore energy-saving opportunities."
      />

      <div className="grid stats">
        {stats.map(({ label, value, unit, note, icon: Icon, color }) => (
          <article className="stat-card" key={label}>
            <div className={`icon ${color}`}>
              <Icon size={20} />
            </div>
            <p className="label">{label}</p>
            <p className="metric">
              {value} <small>{unit}</small>
            </p>
            <p className="card-note">{note}</p>
          </article>
        ))}
      </div>

      <div className="grid bottom-grid">
        <section className="panel">
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">ROOM STATUS</p>
              <h2>Classroom A-101</h2>
            </div>
            <span className="tiny-badge">Demo data</span>
          </div>

          <div className="room-mini-grid">
            <div className="room-mini">
              <div className="mini-icon">
                <Lightbulb size={20} />
              </div>
              <p>Classroom lights</p>
              <strong>{settings.lightsOn ? "ON" : "OFF"}</strong>
            </div>
            <div className="room-mini">
              <div className="mini-icon">
                <Snowflake size={20} />
              </div>
              <p>Air conditioning</p>
              <strong>{settings.acOn ? "ON" : "OFF"}</strong>
            </div>
            <div className="room-mini">
              <div className="mini-icon">
                <Users size={20} />
              </div>
              <p>Occupancy</p>
              <strong>{settings.occupancy} people</strong>
            </div>
          </div>

          <button
            type="button"
            className="primary action"
            onClick={() => onNavigate("classroom")}
          >
            Open Digital Classroom <ArrowUpRight size={16} />
          </button>
        </section>

        <section className="panel">
          <p className="eyebrow">SAVINGS SUMMARY</p>
          <h2>Your current scenario</h2>
          <p className="label">Estimated energy reduction</p>
          <p className="savings-number">
            <span>{applied.savings.toFixed(2)}</span>{" "}
            <small style={{ font: "500 14px 'DM Sans'", color: "#94a3b8" }}>kWh</small>
          </p>
          <p className="label" style={{ marginTop: 4 }}>
            Estimated cost reduction: <span>₹{applied.cost.toFixed(2)}</span>
          </p>
          <div className="divider" />
          <p style={{ fontSize: 11, color: "#94a3b8" }}>
            Compare settings in the simulator to estimate how operational changes may
            reduce energy use.
          </p>
          <button
            type="button"
            className="secondary action"
            onClick={() => onNavigate("simulator")}
          >
            Open Energy Simulator <ArrowUpRight size={16} />
          </button>
        </section>
      </div>

      <p className="footnote">
        Energy figures are illustrative estimates based on assumed equipment ratings.
        Occupancy and equipment status are demo values until connected to live
        detection and campus data.
      </p>
    </section>
  );
}
