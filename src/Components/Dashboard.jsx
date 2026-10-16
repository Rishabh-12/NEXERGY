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
  GitBranch,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { fetchHistoricalData, fetchSyncInfo } from "../services/api";
import ArchitecturalJourney from "./ArchitecturalJourney";
import CampusOverview from "./CampusOverview";
import EventTimeline from "./EventTimeline";

export default function Dashboard({ settings, applied, baseline, onNavigate, backend, events, selectedRoom, onSelectRoom, roomEquipment }) {
  const [history, setHistory] = useState([]);
  const [syncInfo, setSyncInfo] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const [data, sync] = await Promise.allSettled([fetchHistoricalData(), fetchSyncInfo()]);
        if (!cancelled && data.status === "fulfilled" && Array.isArray(data.value)) {
          setHistory(data.value);
        }
        if (!cancelled && sync.status === "fulfilled" && sync.value) {
          setSyncInfo(sync.value);
        }
      } catch {
        // graceful fallback
      }
    }
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleManualSync() {
    setSyncing(true);
    try {
      const sync = await fetchSyncInfo();
      if (sync) setSyncInfo(sync);
    } catch {}
    finally {
      setTimeout(() => setSyncing(false), 500);
    }
  }

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
      <ArchitecturalJourney settings={settings} backend={backend} applied={applied} onNavigate={onNavigate} />

      <section className="operations-overview">
        <div className="operations-heading"><div><p className="eyebrow">OPERATIONS / ROOM A-101</p><h2>One clear view of today.</h2><p>Live room state where connected; estimates where measured data is unavailable.</p></div><span className={`status-pill ${backend?.status || "checking"}`}><span className="status-dot"/>{backend?.status === "online" ? "Backend connected" : backend?.status === "offline" ? "Offline · local estimates" : "Connecting"}</span></div>

        {/* Sync Server & Repos Status Banner */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          padding: "12px 18px",
          background: "var(--paper, #fbf9f3)",
          border: "1px solid var(--line, #dcd8ce)",
          borderRadius: "10px",
          marginBottom: "18px",
          fontSize: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              borderRadius: "6px",
              background: "rgba(56, 189, 248, 0.15)",
              color: "#0284c7",
              fontWeight: "600",
              fontSize: "11px"
            }}>
              <GitBranch size={13} />
              Synced Repositories
            </span>
            <span>
              <strong>Target:</strong> <a href="https://github.com/Rishabh-12/Nexenergy" target="_blank" rel="noreferrer" style={{ color: "var(--blue, #2563eb)", textDecoration: "underline" }}>Rishabh-12/Nexenergy</a>
            </span>
            <span style={{ color: "#94a3b8" }}>·</span>
            <span>
              <strong>Original:</strong> <a href="https://github.com/Rishabh-12/code-cash" target="_blank" rel="noreferrer" style={{ color: "var(--blue, #2563eb)", textDecoration: "underline" }}>Rishabh-12/code-cash</a>
            </span>
            <span style={{ color: "#94a3b8" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#16a34a" }}>
              <CheckCircle2 size={13} /> Diff Server Active (Port 3000)
            </span>
          </div>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              fontSize: "11px",
              fontWeight: "600",
              background: "transparent",
              border: "1px solid var(--line, #cbd5e1)",
              borderRadius: "6px",
              cursor: "pointer",
              color: "inherit"
            }}
          >
            <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Server State"}
          </button>
        </div>

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
            <strong style={{ color: "#ef4444" }}>POTENTIAL ENERGY WASTE:</strong> The backend reports an empty room while appliances remain on. Review the Digital Twin controls.
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
            onClick={() => onNavigate("twin")}
          >
            Open Digital Twin <ArrowUpRight size={16} />
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
      </section>

      <div className="dashboard-lower-grid">
        <CampusOverview backend={backend} settings={settings} roomEquipment={roomEquipment} onNavigate={onNavigate} selectedRoom={selectedRoom} onSelectRoom={onSelectRoom}/>
        <EventTimeline events={events}/>
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

      <p className="footnote dashboard-footnote">
        Energy figures are illustrative estimates based on assumed equipment ratings.
        Occupancy and equipment status are demo values until connected to live
        detection and campus data.
      </p>
      <footer className="nex-footer">
        <div className="footer-overline">NEXERGY / ARCHITECTURAL INTELLIGENCE</div>
        <div className="footer-content"><div><h2>Better buildings<br/><em>begin with better signals.</em></h2><p>Explore the room, test a scenario, and make the assumptions visible.</p></div><div className="footer-actions"><button type="button" onClick={() => onNavigate("twin")}>Enter digital twin <ArrowUpRight size={15}/></button><button type="button" onClick={() => onNavigate("simulator")}>Run a simulation <ArrowUpRight size={15}/></button></div></div>
        <div className="footer-base"><span>SMART CAMPUS ENERGY OPTIMIZER · ROOM A-101</span><span>Energy and savings shown here are estimates unless identified as historical records.</span></div>
      </footer>
    </section>
  );
}
