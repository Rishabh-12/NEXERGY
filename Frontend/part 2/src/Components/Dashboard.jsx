import { useEffect, useState } from "react";
import {
  Activity,
  Users,
  Zap,
  TrendingDown,
  Lightbulb,
  Snowflake,
  ArrowUpRight,
  AlertTriangle,
  History,
} from "lucide-react";
import PageHeader from "./PageHeader";
import { fetchHistoricalData } from "../services/api";

export default function Dashboard({ settings, applied, baseline, onNavigate, backend }) {
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const data = await fetchHistoricalData();
        if (!cancelled && Array.isArray(data)) {
          setHistory(data);
        }
      } catch {
        // graceful fallback
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const isWasteAlert = Boolean(backend?.energyWasteAlert);

  const stats = [
    {
      label: "Classroom occupancy",
      value: settings.occupancy,
      unit: "people",
      note: backend?.status === "online" ? "Live synced with backend" : "Demo occupancy status",
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

      {isWasteAlert && (
        <div style={{
          background: "linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))",
          border: "1px solid #ef4444",
          color: "#fca5a5",
          padding: "12px 18px",
          borderRadius: "10px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "14px",
          fontWeight: "500"
        }}>
          <AlertTriangle size={20} color="#ef4444" />
          <span>
            <strong style={{ color: "#ef4444" }}>AI WASTE ALERT:</strong> Empty room detected while appliances remain turned ON! Check the Digital Classroom or turn off equipment.
          </span>
        </div>
      )}

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
            <span className="tiny-badge">
              {backend?.status === "online" ? "Live Connected" : "Demo data"}
            </span>
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

      {history.length > 0 && (
        <section className="panel" style={{ marginTop: "24px" }}>
          <div className="panel-title-row">
            <div>
              <p className="eyebrow">CAMPUS BENCHMARKS</p>
              <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <History size={18} color="#38bdf8" /> Historical Energy Consumption
              </h2>
              <p style={{ marginTop: 6, color: "#94a3b8", fontSize: "12px" }}>
                Past daily consumption records from server database (`historical_data.csv`).
              </p>
            </div>
            <span className="tiny-badge">Backend Data</span>
          </div>

          <div style={{ overflowX: "auto", marginTop: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                  <th style={{ padding: "10px 14px" }}>Date</th>
                  <th style={{ padding: "10px 14px" }}>Daily Energy</th>
                  <th style={{ padding: "10px 14px" }}>Daily Cost</th>
                  <th style={{ padding: "10px 14px" }}>Peak Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, idx) => (
                  <tr key={record.date || idx} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "12px 14px", fontWeight: "500" }}>{record.date}</td>
                    <td style={{ padding: "12px 14px", color: "#38bdf8" }}>{record.energy_kwh} kWh</td>
                    <td style={{ padding: "12px 14px", color: "#4ade80" }}>₹{record.cost_rupees}</td>
                    <td style={{ padding: "12px 14px" }}>{record.peak_occupancy} people</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="footnote">
        Energy figures are illustrative estimates based on assumed equipment ratings.
        Occupancy and equipment status are demo values until connected to live
        detection and campus data.
      </p>
    </section>
  );
}
