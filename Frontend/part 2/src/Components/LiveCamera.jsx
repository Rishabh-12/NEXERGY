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
import { stopCamera, getCameraStatus, getCameraFeedUrl, fetchAiInsight, sendMobileCameraFrame } from "../services/api";

const POLL_MS = 800;

export default function LiveCamera({ backend, settings, energyEstimate, costEstimate, onNavigate }) {
  const [cam, setCam] = useState(null);       // camera status snapshot
  const [loading, setLoading] = useState(false);
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
    async function uploadFrame() {
      const video = phoneVideoRef.current;
      if (cancelled || mobileUploadBusy.current || !video || video.readyState < 2 || !video.videoWidth) return;
      if (backend?.status !== "online") {
        if (!cancelled) setPhoneError("Camera preview is live, but person detection cannot reach the API. Start the local backend or check the deployed service URL, then retry.");
        return;
      }
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
    }
    const video = phoneVideoRef.current;
    video?.addEventListener("loadeddata", uploadFrame);
    const timer = setInterval(uploadFrame, 1400);
    uploadFrame();
    return () => {
      cancelled = true;
      clearInterval(timer);
      video?.removeEventListener("loadeddata", uploadFrame);
    };
  }, [backend?.status, phoneStream]);

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
    await connectPhoneCamera();
  }

  async function handleStop() {
    setLoading(true);
    try {
      disconnectPhoneCamera();
      if (backend?.status === "online") {
        await stopCamera();
        const s = await getCameraStatus();
        setCam(s);
      }
      setPhoneError("");
    } catch (error) {
      setPhoneError(error?.message || "Could not stop the camera cleanly. Refresh the page and try again.");
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
      const reason = !window.isSecureContext ? "Camera access requires HTTPS (or localhost). Open this site securely and try again." : error?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in the browser's site settings and try again." : error?.name === "NotFoundError" ? "No camera was found on this device." : "The camera could not start. Close other apps using it and try again.";
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
  const hasCameraPreview = Boolean(phoneStream);
  const cameraConnected = isActive || hasCameraPreview;
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
        pill={isActive ? "Vision active" : hasCameraPreview ? "Camera preview" : "Camera inactive"}
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
              {!cameraConnected ? (
                <button
                  type="button"
                  className="cv-btn cv-btn-start"
                  disabled={loading || phoneLoading}
                  onClick={handleStart}
                >
                  <Camera size={16} />
                  {loading || phoneLoading ? "Connecting…" : "Start Camera"}
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

          <div className={`cv-feed-container ${cameraConnected ? "" : "cv-inactive"}`}>
            {hasCameraPreview && (
              <video
                ref={phoneVideoRef}
                autoPlay
                playsInline
                muted
                aria-label="Live camera preview"
                className={`cv-feed-img ${isActive && cam?.source === "mobile" ? "cv-camera-capture-hidden" : ""}`}
              />
            )}
            {isActive && (!hasCameraPreview || cam?.source === "mobile") && (
              <img
                src={getCameraFeedUrl()}
                alt="Live camera feed with backend person-detection annotations"
                className="cv-feed-img"
              />
            )}
            {!cameraConnected && (
              <div className="cv-placeholder">
                <Camera size={64} strokeWidth={1} />
                <h3>{loading || phoneLoading ? "Connecting camera" : errorMsg ? "Camera could not start" : "Camera Offline"}</h3>
                <p>
                  {phoneError || (backend?.status !== "online"
                    ? "The API is not reachable. Start the backend locally or deploy the Render service, then try again."
                    : errorMsg || "Click 'Start Camera' and allow browser camera access to begin real-time person detection.")}
                </p>
              </div>
            )}

            {/* Live overlay badges */}
            {cameraConnected && (
              <div className="cv-overlay-badges">
                <span className={`cv-badge ${people > 0 ? "cv-badge-green" : "cv-badge-gray"}`}>
                  <Users size={13} /> {people} {people === 1 ? "person" : "people"}
                </span>
                <span className={`cv-badge ${waste ? "cv-badge-red" : isActive ? "cv-badge-green" : "cv-badge-gray"}`}>
                  <Shield size={13} /> {waste ? "WASTE ALERT" : isActive ? "Detection active" : "Preview only"}
                </span>
                <span className="cv-badge cv-badge-blue">
                  <Gauge size={13} /> {fps} FPS
                </span>
              </div>
            )}
          </div>

          {phoneError && cameraConnected && <p className="phone-camera-error" role="status">{phoneError}</p>}

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

          {cameraConnected && (
            <p className="cv-feed-footer">
              <Radio size={12} className="cv-pulse" />
              {isActive ? "Browser camera frames are being analyzed by YOLO and synced to the digital twin." : "Local camera preview only. Occupancy detection starts when the backend is online."}
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
          <p>Press Start Camera above on this device. On a phone, open NEXERGY over HTTPS to use its rear camera. The browser asks for permission only after you start it.</p>
          <div className="phone-camera-note"><ShieldCheck size={15}/><span>When the backend is online, compressed frames are sent about every 1.4 seconds for YOLO person detection. Occupancy updates sync to the shared room state and digital twin. No audio is captured.</span></div>
          {phoneError && !cameraConnected && <p className="phone-camera-error" role="alert">{phoneError}</p>}
          {phoneLoading && !phoneError && <p className="phone-camera-error" role="status">Waiting for camera access. Allow the browser prompt, or enable Camera for this site in its address-bar settings.</p>}
          <div className="phone-camera-actions">
            {phoneStream ? <button type="button" className="cv-btn cv-btn-stop" onClick={disconnectPhoneCamera}><CameraOff size={15}/> Disconnect phone camera</button> : <button type="button" className="cv-btn cv-btn-start" disabled={phoneLoading} onClick={connectPhoneCamera}><Camera size={15}/>{phoneLoading ? "Connecting…" : "Connect phone camera"}</button>}
            <button type="button" className="phone-twin-link" onClick={() => onNavigate?.("twin")}>Open digital twin <ArrowUpRight size={14}/></button>
          </div>
        </div>
        <div className={`phone-camera-preview ${phoneStream ? "is-connected" : ""}`}>
          <div className="phone-camera-placeholder"><Smartphone size={30}/><span>{phoneStream ? "Camera preview is shown above" : "Camera preview appears above"}</span><small>Connect from the Start Camera button. Open this page over HTTPS on a phone to use its rear camera.</small></div>
          {phoneStream && <span className="phone-live-badge"><i/> CAMERA CONNECTED</span>}
        </div>
      </section>

      <p className="footnote">
        The camera preview stays in your browser. When the backend is online, compressed frames are sent to it for YOLOv8n person detection; occupancy is synced across the dashboard. Energy values remain estimates, not meter readings.
      </p>
    </section>
  );
}
