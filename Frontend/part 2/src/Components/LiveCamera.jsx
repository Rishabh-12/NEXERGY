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
  Smartphone,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import PageHeader from "./PageHeader";
import { startCamera, stopCamera, getCameraStatus, getCameraFeedUrl, fetchAiInsight, sendMobileCameraFrame } from "../services/api";

const POLL_MS = 800;

export default function LiveCamera({ backend, settings, energyEstimate, costEstimate, onNavigate }) {
  const [cam, setCam] = useState(null);       // camera status snapshot
  const [loading, setLoading] = useState(false);
  const [feedKey, setFeedKey] = useState(0);   // bump to reload <img>
  const [aiAdvice, setAiAdvice] = useState(null);
  const [askingAi, setAskingAi] = useState(false);
  const [phoneStream, setPhoneStream] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const pollRef = useRef(null);
  const phoneVideoRef = useRef(null);
  const mobileUploadBusy = useRef(false);

  useEffect(() => {
    if (phoneVideoRef.current && phoneStream) phoneVideoRef.current.srcObject = phoneStream;
  }, [phoneStream]);

  useEffect(() => {
    if (!phoneStream) return undefined;
    return () => {
      phoneStream.getTracks().forEach((track) => track.stop());
      getCameraStatus().then((status) => status?.source === "mobile" ? stopCamera() : null).catch(() => {});
    };
  }, [phoneStream]);

  useEffect(() => {
    if (!phoneStream) return undefined;
    let cancelled = false;
    const timer = setInterval(async () => {
      const video = phoneVideoRef.current;
      if (cancelled || mobileUploadBusy.current || !video || video.readyState < 2 || !video.videoWidth) return;
      mobileUploadBusy.current = true;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(video.videoWidth, 640);
        canvas.height = Math.round((video.videoHeight / video.videoWidth) * canvas.width);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to capture a camera frame.");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL("image/jpeg", 0.58).split(",")[1];
        await sendMobileCameraFrame(frame);
        if (!cancelled) setPhoneError("");
      } catch (error) {
        if (!cancelled) setPhoneError(error?.message || "Backend frame upload failed. Set VITE_API_URL to a reachable HTTPS backend and check that it has OpenCV and Ultralytics installed.");
      } finally {
        mobileUploadBusy.current = false;
      }
    }, 1400);
    return () => { cancelled = true; clearInterval(timer); };
  }, [phoneStream]);

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
        lightsOn: settings?.lightsOn,
        acOn: settings?.acOn,
        setpoint: settings?.setpoint,
        hours: settings?.hours,
        totalEnergyKwh: energyEstimate,
        totalDailyCost: costEstimate,
      });
      if (res?.ai_insight) {
        const source = res.source || "rules";
        setAiAdvice({
          text: res.ai_insight,
          source,
          model: res.model || (source === "gemini" ? "Gemini" : "Not used"),
          visionContext: res.vision_context,
        });
      }
    } catch {
      /* graceful */
    } finally {
      setAskingAi(false);
    }
  }

  async function connectPhoneCamera() {
    setPhoneError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPhoneError("Camera access requires a secure page (HTTPS). Open NEXERGY on your phone over HTTPS, then allow camera access. Plain HTTP LAN addresses are usually blocked by browsers.");
      return;
    }
    setPhoneLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      setPhoneStream(stream);
    } catch (error) {
      const reason = error?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in the browser's site settings and try again." : error?.name === "NotFoundError" ? "No camera was found on this device." : "The camera could not start. Close other apps using it and try again.";
      setPhoneError(reason);
    } finally {
      setPhoneLoading(false);
    }
  }

  function disconnectPhoneCamera() {
    phoneStream?.getTracks().forEach((track) => track.stop());
    setPhoneStream(null);
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
              {askingAi ? "Analyzing camera and room data…" : "Ask the AI service for live advice"}
            </button>
          </div>

          {aiAdvice && (
            <div className="camera-ai-advice">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <div className="camera-ai-heading">
                  <Bot size={17} /> {aiAdvice.source === "gemini" ? "GOOGLE GEMINI INSIGHT" : "BACKEND FALLBACK ADVISORY"}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span className="tiny-badge camera-ai-meta">
                    {aiAdvice.model}
                  </span>
                  <span className="tiny-badge camera-ai-vision">
                    Detected: {aiAdvice.visionContext?.people_count ?? people} people
                  </span>
                </div>
              </div>
              <p className="camera-ai-copy">
                {aiAdvice.text}
              </p>
              <div className="camera-ai-source">
                Uses the active camera headcount and estimated energy scenario sent to the backend. Energy is an estimate, not a meter reading.
              </div>
            </div>
          )}

          {isActive && (
            <p className="cv-feed-footer">
              <Radio size={12} className="cv-pulse" />
              Live stream from {cam?.source === "mobile" ? "mobile camera" : "laptop webcam"} · YOLOv8n detection · Occupancy synced to digital twin
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

      <section className="phone-camera-panel">
        <div className="phone-camera-copy">
          <div className="phone-camera-heading"><span className="phone-camera-icon"><Smartphone size={19}/></span><div><p className="eyebrow">PHONE CAMERA / ON THIS DEVICE</p><h2>Use your phone as the camera.</h2></div></div>
          <p>Open NEXERGY on your phone over HTTPS and connect its rear camera. The browser asks for permission only after you press the button.</p>
          <div className="phone-camera-note"><ShieldCheck size={15}/><span>Compressed frames are sent about once every 1.4 seconds to the configured backend for YOLO detection. The detected occupancy and waste alert update the shared room state and digital twin. No audio is captured.</span></div>
          {phoneError && <p className="phone-camera-error" role="alert">{phoneError}</p>}
          <div className="phone-camera-actions">
            {phoneStream ? <button type="button" className="cv-btn cv-btn-stop" onClick={disconnectPhoneCamera}><CameraOff size={15}/> Disconnect phone camera</button> : <button type="button" className="cv-btn cv-btn-start" disabled={phoneLoading} onClick={connectPhoneCamera}><Camera size={15}/>{phoneLoading ? "Connecting…" : "Connect phone camera"}</button>}
            <button type="button" className="phone-twin-link" onClick={() => onNavigate?.("twin")}>Open digital twin <ArrowUpRight size={14}/></button>
          </div>
        </div>
        <div className={`phone-camera-preview ${phoneStream ? "is-connected" : ""}`}>
          {phoneStream ? <video ref={phoneVideoRef} autoPlay playsInline muted aria-label="Phone camera preview"/> : <div className="phone-camera-placeholder"><Smartphone size={30}/><span>Phone camera preview</span><small>Open NEXERGY on your phone over HTTPS to connect.</small></div>}
          {phoneStream && <span className="phone-live-badge"><i/> CAMERA ACTIVE</span>}
        </div>
      </section>

      <p className="footnote">
        Computer vision runs locally using YOLOv8n. Video never leaves your machine.
        Occupancy data is synced to the backend and reflected across all dashboard pages in real time.
      </p>
    </section>
  );
}
