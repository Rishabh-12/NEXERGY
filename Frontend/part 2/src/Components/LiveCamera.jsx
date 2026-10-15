import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Users,
  AlertTriangle,
  Activity,
  Gauge,
  Shield,
  Lightbulb,
  Snowflake,
  Eye,
  Radio,
  Sparkles,
  Bot,
} from "lucide-react";
import PageHeader from "./PageHeader";
import { startCamera, stopCamera, getCameraStatus, getCameraFeedUrl, fetchAiInsight } from "../services/api";

const POLL_MS = 800;

export default function LiveCamera({ backend }) {
  const [cam, setCam] = useState(null);       // camera status snapshot
  const [loading, setLoading] = useState(false);
  const [feedKey, setFeedKey] = useState(0);   // bump to reload <img>
  const [aiAdvice, setAiAdvice] = useState(null);
  const [askingAi, setAskingAi] = useState(false);
  const pollRef = useRef(null);

  // Poll camera status while mounted
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const s = await getCameraStatus();
        if (!cancelled) setCam(s);
      } catch {
        if (!cancelled) setCam(null);
      }
    }

    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, []);

  async function handleStart() {
    setLoading(true);
    try {
      await startCamera();
      // Give the thread a moment then refresh
      await new Promise((r) => setTimeout(r, 1200));
      const s = await getCameraStatus();
      setCam(s);
      setFeedKey((k) => k + 1);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    try {
      await stopCamera();
      const s = await getCameraStatus();
      setCam(s);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }

  async function handleAskGemini() {
    setAskingAi(true);
    try {
      const res = await fetchAiInsight({
        peopleCount: cam?.people_count ?? 0,
        status: cam?.status ?? "Empty",
        emptySeconds: cam?.empty_seconds ?? 0,
        energyWasteAlert: cam?.energy_waste_alert ?? false,
        lightsOn: (cam?.people_count ?? 0) > 0,
        acOn: (cam?.people_count ?? 0) > 0,
        totalEnergyKwh: 4.4,
        totalDailyCost: 35.2,
      });
      if (res?.ai_insight) {
        setAiAdvice({
          text: res.ai_insight,
          source: res.source || "gemini",
          model: res.model || "gemini-3.8-flash",
          visionContext: res.vision_context,
        });
      }
    } catch {
      /* graceful */
    } finally {
      setAskingAi(false);
    }
  }

  const isActive = cam?.active === true;
  const people = cam?.people_count ?? 0;
  const waste = cam?.energy_waste_alert ?? false;
  const empty = cam?.empty_seconds ?? 0;
  const fps = cam?.fps ?? 0;
  const status = cam?.status ?? "Inactive";
  const errorMsg = cam?.error ?? "";

  return (
    <section className="page active">
      <PageHeader
        eyebrow="AI COMPUTER VISION"
        title="Live Camera Feed"
        subtitle="Real-time YOLOv8 person detection with automated energy-waste monitoring."
        pill={isActive ? "Camera active" : "Camera inactive"}
      />

      {/* Waste alert banner */}
      {waste && (
        <div className="cv-alert-banner">
          <AlertTriangle size={20} />
          <span>
            <strong>ENERGY WASTE DETECTED</strong> — Room empty for {empty}s while
            appliances are running. Equipment should be turned off.
          </span>
        </div>
      )}

      <div className="cv-layout">
        {/* ---- LEFT: Video feed ---- */}
        <div className="cv-feed-panel">
          <div className="cv-feed-header">
            <div>
              <p className="eyebrow">LIVE MJPEG STREAM</p>
              <h2 style={{ marginTop: 4 }}>Room A-101 Camera</h2>
            </div>
            <div className="cv-feed-controls">
              {!isActive ? (
                <button
                  type="button"
                  className="cv-btn cv-btn-start"
                  disabled={loading || backend?.status !== "online"}
                  onClick={handleStart}
                >
                  <Camera size={16} />
                  {loading ? "Starting…" : "Start Camera"}
                </button>
              ) : (
                <button
                  type="button"
                  className="cv-btn cv-btn-stop"
                  disabled={loading}
                  onClick={handleStop}
                >
                  <CameraOff size={16} />
                  {loading ? "Stopping…" : "Stop Camera"}
                </button>
              )}
            </div>
          </div>

          <div className={`cv-feed-container ${isActive ? "" : "cv-inactive"}`}>
            {isActive ? (
              <img
                key={feedKey}
                src={getCameraFeedUrl()}
                alt="Live camera feed"
                className="cv-feed-img"
              />
            ) : (
              <div className="cv-placeholder">
                <Camera size={64} strokeWidth={1} />
                <h3>Camera Offline</h3>
                <p>
                  {backend?.status !== "online"
                    ? "Backend must be online to start the camera."
                    : errorMsg || "Click 'Start Camera' to begin real-time AI detection."}
                </p>
              </div>
            )}

            {/* Live overlay badges */}
            {isActive && (
              <div className="cv-overlay-badges">
                <span className={`cv-badge ${people > 0 ? "cv-badge-green" : "cv-badge-gray"}`}>
                  <Users size={13} /> {people} {people === 1 ? "person" : "people"}
                </span>
                <span className={`cv-badge ${waste ? "cv-badge-red" : "cv-badge-green"}`}>
                  <Shield size={13} /> {waste ? "WASTE ALERT" : "Normal"}
                </span>
                <span className="cv-badge cv-badge-blue">
                  <Gauge size={13} /> {fps} FPS
                </span>
              </div>
            )}
          </div>

          <div style={{ marginTop: "14px", display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="cv-btn"
              style={{ background: "#38bdf8", color: "#082f49", borderColor: "#38bdf8", cursor: "pointer" }}
              disabled={askingAi}
              onClick={handleAskGemini}
            >
              <Sparkles size={15} />
              {askingAi ? "Gemini AI is analyzing vision feed…" : "✨ Ask Gemini AI for Live Advice"}
            </button>
          </div>

          {aiAdvice && (
            <div style={{
              marginTop: "14px",
              padding: "16px 18px",
              borderRadius: "14px",
              border: "1px solid #38bdf8",
              background: "linear-gradient(145deg, rgba(56, 189, 248, 0.08), rgba(14, 165, 233, 0.03))",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontWeight: "700", fontSize: "12px" }}>
                  <Bot size={17} /> GOOGLE GEMINI 3.8 FLASH VISION ADVISORY
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span className="tiny-badge" style={{ color: "#38bdf8", borderColor: "#0284c7" }}>
                    {aiAdvice.model}
                  </span>
                  <span className="tiny-badge" style={{ color: "#a7f3d0", borderColor: "#059669" }}>
                    Detected: {aiAdvice.visionContext?.people_count ?? people} people
                  </span>
                </div>
              </div>
              <p style={{ color: "#f8fafc", fontSize: "13px", lineHeight: "1.65", margin: "6px 0" }}>
                {aiAdvice.text}
              </p>
              <div style={{ marginTop: "10px", color: "#64748b", fontSize: "10px" }}>
                Synthesized by Google Gemini AI analyzing real-time YOLOv8 camera headcount and classroom telemetry.
              </div>
            </div>
          )}

          {isActive && (
            <p className="cv-feed-footer">
              <Radio size={12} className="cv-pulse" />
              Live stream from laptop webcam · YOLOv8n model · Occupancy auto-synced to dashboard
            </p>
          )}
        </div>

        {/* ---- RIGHT: Stats sidebar ---- */}
        <div className="cv-stats-panel">
          {/* Detection status */}
          <div className="cv-stat-card">
            <p className="eyebrow">DETECTION STATUS</p>
            <div className="cv-stat-row">
              <Eye size={20} />
              <div>
                <span className="cv-stat-label">Room Status</span>
                <strong className={`cv-stat-value ${
                  status === "Occupied" ? "cv-text-green"
                  : status === "Empty" ? "cv-text-amber"
                  : "cv-text-gray"
                }`}>
                  {status}
                </strong>
              </div>
            </div>
          </div>

          {/* People count */}
          <div className="cv-stat-card">
            <p className="eyebrow">OCCUPANCY</p>
            <div className="cv-stat-row">
              <Users size={20} />
              <div>
                <span className="cv-stat-label">People Detected</span>
                <strong className="cv-stat-value cv-stat-big">{people}</strong>
              </div>
            </div>
          </div>

          {/* Empty timer */}
          <div className="cv-stat-card">
            <p className="eyebrow">EMPTY ROOM TIMER</p>
            <div className="cv-stat-row">
              <Activity size={20} />
              <div>
                <span className="cv-stat-label">Seconds Empty</span>
                <strong className={`cv-stat-value cv-stat-big ${
                  empty >= 3 ? "cv-text-red" : ""
                }`}>
                  {empty}s
                </strong>
              </div>
            </div>
            <div className="cv-timer-bar">
              <div
                className={`cv-timer-fill ${empty >= 3 ? "cv-fill-red" : "cv-fill-green"}`}
                style={{ width: `${Math.min(100, (empty / 10) * 100)}%` }}
              />
            </div>
            <p className="cv-stat-hint">Alert triggers after 3 s empty</p>
          </div>

          {/* Energy waste */}
          <div className={`cv-stat-card ${waste ? "cv-card-danger" : ""}`}>
            <p className="eyebrow">ENERGY WASTE</p>
            <div className="cv-stat-row">
              <AlertTriangle size={20} />
              <div>
                <span className="cv-stat-label">Waste Alert</span>
                <strong className={`cv-stat-value ${waste ? "cv-text-red" : "cv-text-green"}`}>
                  {waste ? "ACTIVE" : "None"}
                </strong>
              </div>
            </div>
          </div>

          {/* Appliance states synced from detection */}
          <div className="cv-stat-card">
            <p className="eyebrow">AUTO APPLIANCE CONTROL</p>
            <div className="cv-appliance-row">
              <Lightbulb size={16} />
              <span>Lights</span>
              <span className={`cv-pill ${people > 0 ? "cv-pill-on" : "cv-pill-off"}`}>
                {people > 0 ? "ON" : "OFF"}
              </span>
            </div>
            <div className="cv-appliance-row">
              <Snowflake size={16} />
              <span>AC</span>
              <span className={`cv-pill ${people > 0 ? "cv-pill-on" : "cv-pill-off"}`}>
                {people > 0 ? "ON" : "OFF"}
              </span>
            </div>
            <p className="cv-stat-hint">Auto-controlled by AI vision occupancy</p>
          </div>

          {/* Camera FPS */}
          <div className="cv-stat-card">
            <p className="eyebrow">PERFORMANCE</p>
            <div className="cv-stat-row">
              <Gauge size={20} />
              <div>
                <span className="cv-stat-label">Frame Rate</span>
                <strong className="cv-stat-value">{fps} FPS</strong>
              </div>
            </div>
            <p className="cv-stat-hint">YOLOv8 nano on CPU</p>
          </div>
        </div>
      </div>

      <p className="footnote">
        Computer vision runs locally using YOLOv8n. Video never leaves your machine.
        Occupancy data is synced to the backend and reflected across all dashboard pages in real time.
      </p>
    </section>
  );
}
