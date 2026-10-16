import { useEffect, useRef, useState, useCallback } from "react";
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
  Settings,
} from "lucide-react";
import PageHeader from "./PageHeader";
import {
  startCamera,
  stopCamera,
  getCameraStatus,
  getCameraFeedUrl,
  fetchAiInsight,
  sendOccupancy,
  getApiUrl,
  setCustomApiUrl,
} from "../services/api";

const POLL_MS = 1200;

// Lazy global loader for in-browser coco-ssd detection model
let cachedCocoModel = null;
let modelLoadingPromise = null;

async function getCocoModel() {
  if (cachedCocoModel) return cachedCocoModel;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    // If window.cocoSsd is not loaded yet, wait briefly for the defer script or inject dynamically
    if (typeof window !== "undefined" && !window.cocoSsd) {
      await new Promise((resolve) => {
        let attempts = 0;
        const check = setInterval(() => {
          attempts++;
          if (window.cocoSsd || attempts > 25) {
            clearInterval(check);
            resolve();
          }
        }, 120);
      });
    }

    if (typeof window !== "undefined" && window.cocoSsd) {
      try {
        const loaded = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
        cachedCocoModel = loaded;
        return loaded;
      } catch (err) {
        console.warn("Could not initialize coco-ssd in browser:", err);
      }
    }
    return null;
  })();

  return modelLoadingPromise;
}

export default function LiveCamera({ backend, settings, energyEstimate, costEstimate, onNavigate }) {
  // Mode: "webcam" (browser AI vision) | "backend" (backend YOLOv8 stream)
  const [streamMode, setStreamMode] = useState("webcam");
  const [cam, setCam] = useState(null); // backend camera status snapshot
  const [loading, setLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [askingAi, setAskingAi] = useState(false);

  // Local webcam & in-browser AI vision
  const [webcamStream, setWebcamStream] = useState(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState("");
  const [livePeople, setLivePeople] = useState(0);
  const [liveEmptySec, setLiveEmptySec] = useState(0);
  const [liveWaste, setLiveWaste] = useState(false);
  const [liveFps, setLiveFps] = useState(0);
  const [detectionStatus, setDetectionStatus] = useState("Inactive");

  // Phone IP Camera state
  const [phoneIp, setPhoneIp] = useState(() => {
    try {
      return localStorage.getItem("nexenergy_phone_camera_ip") || "http://192.168.29.40:8080/video";
    } catch {
      return "http://192.168.29.40:8080/video";
    }
  });
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [phoneStreamUrl, setPhoneStreamUrl] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // Backend API configuration UI
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [customApiUrlInput, setCustomApiUrlInput] = useState(() => getApiUrl());
  const [apiSaveMsg, setApiSaveMsg] = useState("");

  const pollRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastDetectTimeRef = useRef(0);
  const lastBackendPostRef = useRef(0);
  const emptyStartRef = useRef(null);
  const frameCountRef = useRef(0);
  const fpsTimerRef = useRef(performance.now());
  const isDetectingRef = useRef(false);

  // Attach webcam stream to <video> element
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream;
      videoRef.current.play().catch(() => {});
    }
  }, [webcamStream]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [webcamStream]);

  // Poll camera status from backend while mounted
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

  // Continuous in-browser Person Detection Loop
  const runDetection = useCallback(async () => {
    if (!isDetectingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
      const now = performance.now();
      // Run AI detection roughly every 200ms (~5 FPS detection, 30 FPS rendering)
      if (now - lastDetectTimeRef.current >= 180) {
        lastDetectTimeRef.current = now;

        // Ensure canvas dimensions match video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let detectedPeopleCount = 0;
          let model = null;

          try {
            model = await getCocoModel();
          } catch {
            model = null;
          }

          if (model) {
            try {
              const predictions = await model.detect(video);
              const persons = predictions.filter(
                (p) => p.class === "person" && p.score >= 0.35
              );
              detectedPeopleCount = persons.length;

              // Draw green bounding boxes and confidence badges
              for (const p of persons) {
                const [x, y, w, h] = p.bbox;
                ctx.strokeStyle = "#22c55e";
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, w, h);

                const label = `Person ${Math.round(p.score * 100)}%`;
                ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
                const textWidth = ctx.measureText(label).width;
                ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
                ctx.fillRect(x, Math.max(0, y - 22), textWidth + 10, 22);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(label, x + 5, Math.max(16, y - 6));
              }
            } catch (err) {
              console.warn("Detection cycle error:", err);
            }
          }

          // Occupancy & Empty Room Timer calculation
          let emptySec = 0;
          if (detectedPeopleCount > 0) {
            emptyStartRef.current = null;
            emptySec = 0;
          } else {
            if (!emptyStartRef.current) {
              emptyStartRef.current = Date.now();
            }
            emptySec = Math.floor((Date.now() - emptyStartRef.current) / 1000);
          }

          const isWaste =
            detectedPeopleCount === 0 &&
            emptySec >= 3 &&
            Boolean(settings?.lightsOn || settings?.acOn);

          const statusStr = detectedPeopleCount > 0 ? "Occupied" : "Empty";

          setLivePeople(detectedPeopleCount);
          setLiveEmptySec(emptySec);
          setLiveWaste(isWaste);
          setDetectionStatus(statusStr);

          // Calculate visual FPS
          frameCountRef.current++;
          const elapsedFps = (now - fpsTimerRef.current) / 1000;
          if (elapsedFps >= 1.0) {
            setLiveFps(Math.round((frameCountRef.current / elapsedFps) * 10) / 10);
            frameCountRef.current = 0;
            fpsTimerRef.current = now;
          }

          // Send detected occupancy data to the backend periodically (~every 1.5s)
          if (now - lastBackendPostRef.current >= 1500) {
            lastBackendPostRef.current = now;

            sendOccupancy(detectedPeopleCount, {
              status: statusStr,
              empty_seconds: emptySec,
              energy_waste_alert: isWaste,
              lights_on: settings?.lightsOn,
              ac_on: settings?.acOn,
            }).catch(() => {});

          }
        }
      }
    }

    if (isDetectingRef.current) {
      animFrameRef.current = requestAnimationFrame(runDetection);
    }
  }, [backend?.status, settings?.lightsOn, settings?.acOn]);

  // Start the live camera (Webcam with in-browser AI detection & backend sync)
  async function handleStart() {
    setWebcamError("");
    setLoading(true);

    try {
      if (streamMode === "backend") {
        await startCamera();
        const s = await getCameraStatus();
        setCam(s);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        setWebcamStream(stream);
        setWebcamActive(true);
        startCamera("browser").then(setCam).catch(() => {});
        isDetectingRef.current = true;
        animFrameRef.current = requestAnimationFrame(runDetection);
      }
    } catch (error) {
      const reason = !window.isSecureContext
        ? "Camera access requires HTTPS or localhost. Open this site securely and try again."
        : error?.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in site settings."
        : error?.name === "NotFoundError"
        ? "No camera was found on this device."
        : error?.message || "Could not open camera.";
      setWebcamError(reason);
    } finally {
      setLoading(false);
    }
  }

  // Stop the live camera cleanly
  async function handleStop() {
    setLoading(true);
    try {
      isDetectingRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
        setWebcamStream(null);
      }
      setWebcamActive(false);

      await stopCamera();
      const s = await getCameraStatus();
      setCam(s);
      setDetectionStatus("Inactive");
      setLivePeople(0);
      setLiveEmptySec(0);
      setLiveWaste(false);
      setLiveFps(0);
    } catch (error) {
      console.warn("Error stopping camera:", error);
    } finally {
      setLoading(false);
    }
  }

  // Handle Phone IP Camera connection: asks for IP address, connects without opening laptop webcam
  async function handleConnectPhoneIp() {
    setPhoneError("");
    let url = (phoneIp || "").trim();

    // If user clicked without an IP or wants to change, ask for the IP address
    if (!url || url === "http://192.168.29.40:8080/video") {
      const entered = window.prompt(
        "Enter your Phone's IP Camera stream address (from IP Webcam or DroidCam app):\n\nExample: http://192.168.29.40:8080/video or 192.168.29.40:8080",
        phoneIp || "http://192.168.29.40:8080/video"
      );
      if (entered === null) return; // user cancelled
      if (entered.trim()) url = entered.trim();
    }

    if (!url) {
      setPhoneError("Please enter a valid Phone IP address.");
      return;
    }

    // Normalize URL
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("rtsp://")) {
      url = `http://${url}`;
    }
    try {
      const parsed = new URL(url);
      if (!parsed.pathname || parsed.pathname === "/") {
        parsed.pathname = "/video";
        url = parsed.toString();
      }
    } catch {
      if (!url.endsWith("/video")) url += "/video";
    }

    setPhoneIp(url);
    try {
      localStorage.setItem("nexenergy_phone_camera_ip", url);
    } catch {}

    if (window.location.protocol === "https:" && url.startsWith("http://")) {
      setPhoneError("This secure website cannot display an HTTP phone stream. Run detect.py on this computer and choose option 2 to send YOLO occupancy to the live site.");
      return;
    }

    setPhoneLoading(true);
    try {
      setPhoneStreamUrl(url);
      setPhoneConnected(true);
      setPhoneError("");
    } finally {
      setPhoneLoading(false);
    }
  }

  // Disconnect Phone IP Camera
  async function handleDisconnectPhoneIp() {
    setPhoneLoading(true);
    try {
      if (backend?.status === "online") {
        await stopCamera();
      }
    } catch {}
    setPhoneConnected(false);
    setPhoneStreamUrl("");
    setPhoneLoading(false);
  }

  // Ask Gemini AI for recommendations based on live camera context
  async function handleAskGemini() {
    setAskingAi(true);
    try {
      const activePeople = isDetectingRef.current ? livePeople : cam?.people_count ?? 0;
      const activeStatus = isDetectingRef.current ? detectionStatus : cam?.status ?? "Empty";
      const activeEmpty = isDetectingRef.current ? liveEmptySec : cam?.empty_seconds ?? 0;
      const activeWaste = isDetectingRef.current ? liveWaste : cam?.energy_waste_alert ?? false;

      const res = await fetchAiInsight({
        peopleCount: activePeople,
        status: activeStatus,
        emptySeconds: activeEmpty,
        energyWasteAlert: activeWaste,
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
          model: res.model || (source === "gemini" ? "Gemini" : "Smart Engine"),
          visionContext: res.vision_context,
        });
      }
    } catch {
      /* graceful */
    } finally {
      setAskingAi(false);
    }
  }

  function handleSaveCustomApiUrl() {
    setCustomApiUrl(customApiUrlInput);
    setApiSaveMsg("Backend URL saved! Reloading state…");
    setTimeout(() => {
      window.location.reload();
    }, 600);
  }

  // Active status resolution
  const isBackendStreamActive = cam?.active === true;
  const isWebcamLive = webcamActive && Boolean(webcamStream);
  const cameraConnected = isWebcamLive || isBackendStreamActive || phoneConnected;

  const people = isWebcamLive ? livePeople : cam?.people_count ?? 0;
  const waste = isWebcamLive ? liveWaste : cam?.energy_waste_alert ?? false;
  const empty = isWebcamLive ? liveEmptySec : cam?.empty_seconds ?? 0;
  const fps = isWebcamLive ? liveFps : cam?.fps ?? 0;
  const status = isWebcamLive ? detectionStatus : cam?.status ?? (cameraConnected ? "Occupied" : "Inactive");
  const currentEnergyKwh = Number.isFinite(cam?.estimated_energy_kwh) ? cam.estimated_energy_kwh : energyEstimate;
  const idleSavingsKwh = waste ? currentEnergyKwh : 0;
  const emptyAlertThreshold = cam?.source === "python-yolo" ? 10 : 3;

  return (
    <section className="page active">
      <PageHeader
        eyebrow="AI COMPUTER VISION"
        title="Live Camera Feed"
        subtitle="Browser person detection or connected YOLOv8 camera agent, synced to room estimates."
        pill={cameraConnected ? "Vision active" : "Camera inactive"}
      />

      {/* Backend API Configuration banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          marginBottom: "14px",
          background: "var(--paper, #fff)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: "6px",
          fontSize: "11px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: backend?.status === "online" ? "#22c55e" : "#f59e0b",
              boxShadow: backend?.status === "online" ? "0 0 8px #22c55e" : "none",
            }}
          />
          <span>
            <strong>Backend API:</strong> <code>{getApiUrl()}</code>
            <span style={{ opacity: 0.7, marginLeft: "6px" }}>
              ({backend?.status === "online" ? "Online & Connected" : "Local / Offline mode"})
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowApiConfig(!showApiConfig)}
          style={{
            background: "transparent",
            border: "1px solid var(--line, #ccc)",
            padding: "3px 9px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "10px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            color: "var(--ink, #111)",
          }}
        >
          <Settings size={12} />
          {showApiConfig ? "Hide Config" : "Change Backend IP / URL"}
        </button>
      </div>

      {showApiConfig && (
        <div
          style={{
            padding: "12px 14px",
            marginBottom: "14px",
            background: "var(--paper, #f8fafc)",
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: "6px",
            fontSize: "11px",
          }}
        >
          <label style={{ display: "block", marginBottom: "6px", fontWeight: "600" }}>
            Backend API base URL (leave the default unless your API is hosted elsewhere):
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="text"
              value={customApiUrlInput}
              onChange={(e) => setCustomApiUrlInput(e.target.value)}
              placeholder="https://campusiq-api.onrender.com"
              style={{
                flex: "1 1 280px",
                padding: "6px 10px",
                fontSize: "12px",
                border: "1px solid var(--line, #ccc)",
                borderRadius: "4px",
                background: "var(--paper, #fff)",
                color: "var(--ink, #111)",
              }}
            />
            <button
              type="button"
              className="cv-btn cv-btn-start"
              style={{ padding: "6px 12px", fontSize: "11px" }}
              onClick={handleSaveCustomApiUrl}
            >
              Save & Connect
            </button>
            <button
              type="button"
              className="cv-btn"
              style={{ padding: "6px 12px", fontSize: "11px", border: "1px solid var(--line)" }}
              onClick={() => {
                setCustomApiUrl("");
                setCustomApiUrlInput(import.meta.env.PROD ? "https://campusiq-api.onrender.com" : "http://localhost:3000");
                window.location.reload();
              }}
            >
              Reset to Default
            </button>
          </div>
          {apiSaveMsg && <p style={{ marginTop: "6px", color: "#16a34a" }}>{apiSaveMsg}</p>}
        </div>
      )}

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
              <p className="eyebrow">LIVE VISION STREAM</p>
              <h2 style={{ marginTop: 4 }}>Room A-101 Camera</h2>
            </div>
            <div className="cv-feed-controls">
              {!cameraConnected ? (
                <button
                  type="button"
                  className="cv-btn cv-btn-start"
                  disabled={loading}
                  onClick={handleStart}
                >
                  <Camera size={16} />
                  {loading ? "Starting Camera…" : "Start Camera"}
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

          <div className={`cv-feed-container ${cameraConnected ? "" : "cv-inactive"}`} style={{ position: "relative" }}>
            {cam?.active && cam?.source === "python-yolo" ? (
              <div className="cv-placeholder">
                <Users size={54} strokeWidth={1.2} />
                <h3>YOLO camera agent connected</h3>
                <p>The Python detector is running on the camera device. Live occupancy and estimated energy are updating from the shared backend.</p>
                {Number.isFinite(cam?.inference_ms) && cam.inference_ms > 0 && <small>{cam.inference_ms.toFixed(0)} ms inference · {cam.fps || 0} FPS</small>}
              </div>
            ) : streamMode === "backend" && isBackendStreamActive ? (
              <img
                src={getCameraFeedUrl()}
                alt="Live camera feed from backend"
                className="cv-feed-img"
              />
            ) : isWebcamLive ? (
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  aria-label="Live camera preview"
                  className="cv-feed-img"
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                />
              </div>
            ) : (
              <div className="cv-placeholder">
                <Camera size={64} strokeWidth={1} />
                <h3>Camera Offline</h3>
                <p>
                  {webcamError || "Click 'Start Camera' to begin real-time AI person detection and sync occupancy with the backend."}
                </p>
              </div>
            )}

            {/* Live overlay badges */}
            {cameraConnected && (
              <div className="cv-overlay-badges">
                <span className={`cv-badge ${people > 0 ? "cv-badge-green" : "cv-badge-gray"}`}>
                  <Users size={13} /> {people} {people === 1 ? "person" : "people"}
                </span>
                <span className={`cv-badge ${waste ? "cv-badge-red" : "cv-badge-green"}`}>
                  <Shield size={13} /> {waste ? "WASTE ALERT" : "Detection Active"}
                </span>
                <span className="cv-badge cv-badge-blue">
                  <Gauge size={13} /> {fps} FPS
                </span>
              </div>
            )}
          </div>

          {webcamError && <p className="phone-camera-error" role="status">{webcamError}</p>}

          <div style={{ marginTop: "14px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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
                  <Bot size={17} /> {aiAdvice.source === "gemini" ? "GOOGLE GEMINI INSIGHT" : "BACKEND ADVISORY"}
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
                Uses the active camera headcount and estimated energy scenario sent to the backend.
              </div>
            </div>
          )}

          {cameraConnected && (
            <p className="cv-feed-footer">
              <Radio size={12} className="cv-pulse" />
              Live person detection active · Occupancy and energy waste alerts synced to the backend and digital twin.
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
            <p className="cv-stat-hint">Alert threshold: {emptyAlertThreshold} s empty</p>
          </div>

          {/* Modeled energy */}
          <div className="cv-stat-card">
            <p className="eyebrow">MODELED ENERGY · 2 HOURS</p>
            <div className="cv-stat-row">
              <Gauge size={20} />
              <div>
                <span className="cv-stat-label">Estimated room use</span>
                <strong className="cv-stat-value">{Number(currentEnergyKwh || 0).toFixed(2)} kWh</strong>
              </div>
            </div>
            <p className="cv-stat-hint">{idleSavingsKwh.toFixed(2)} kWh potential saving if the empty-room alert is resolved · estimate, not meter data.</p>
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
            <p className="eyebrow">ENERGY SCENARIO</p>
            <div className="cv-appliance-row">
              <Lightbulb size={16} />
              <span>Lights</span>
              <span className={`cv-pill ${settings?.lightsOn ? "cv-pill-on" : "cv-pill-off"}`}>
                {settings?.lightsOn ? "ON" : "OFF"}
              </span>
            </div>
            <div className="cv-appliance-row">
              <Snowflake size={16} />
              <span>AC</span>
              <span className={`cv-pill ${settings?.acOn ? "cv-pill-on" : "cv-pill-off"}`}>
                {settings?.acOn ? "ON" : "OFF"}
              </span>
            </div>
            <p className="cv-stat-hint">Modeled equipment states. The camera reports people; it does not switch physical equipment.</p>
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
            <p className="cv-stat-hint">AI Vision inference</p>
          </div>
        </div>
      </div>

      {/* ---- PHONE IP CAMERA PANEL ---- */}
      <section className="phone-camera-panel">
        <div className="phone-camera-copy">
          <div className="phone-camera-heading">
            <span className="phone-camera-icon">
              <Smartphone size={19} />
            </span>
            <div>
              <p className="eyebrow">PHONE CAMERA / IP STREAM</p>
              <h2>Use your phone as the camera.</h2>
            </div>
          </div>
          <p>
            You can preview a phone IP stream when your phone and computer share a network. For reliable hosted occupancy updates with YOLO, run the included <code>detect.py</code> on the computer connected to the phone stream; the agent sends counts to the online backend.
          </p>

          <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "11px", fontWeight: "600", color: "inherit", display: "flex", alignItems: "center", gap: "6px" }}>
              <Radio size={14} /> Phone IP Address:
            </label>
            <input
              type="text"
              value={phoneIp}
              onChange={(e) => {
                setPhoneIp(e.target.value);
                try {
                  localStorage.setItem("nexenergy_phone_camera_ip", e.target.value);
                } catch {}
              }}
              placeholder="http://192.168.29.40:8080/video"
              aria-label="Phone IP address"
              style={{
                flex: "1 1 240px",
                padding: "7px 10px",
                fontSize: "12px",
                border: "1px solid var(--line, #ccc)",
                borderRadius: "4px",
                background: "var(--paper, #fff)",
                color: "var(--ink, #111)",
              }}
            />
          </div>

          <div className="phone-camera-note">
            <ShieldCheck size={15} />
            <span>
              Phone preview depends on local network and browser security. YOLO detections from <code>detect.py</code> update the backend and digital twin.
            </span>
          </div>

          {phoneError && <p className="phone-camera-error" role="alert">{phoneError}</p>}

          <div className="phone-camera-actions">
            {phoneConnected ? (
              <button
                type="button"
                className="cv-btn cv-btn-stop"
                disabled={phoneLoading}
                onClick={handleDisconnectPhoneIp}
              >
                <CameraOff size={15} /> Disconnect phone camera
              </button>
            ) : (
              <button
                type="button"
                className="cv-btn cv-btn-start"
                disabled={phoneLoading}
                onClick={handleConnectPhoneIp}
              >
                <Camera size={15} />
                {phoneLoading ? "Connecting to IP…" : "Connect phone camera"}
              </button>
            )}
            <button
              type="button"
              className="phone-twin-link"
              onClick={() => onNavigate?.("twin")}
            >
              Open digital twin <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        <div className={`phone-camera-preview ${phoneConnected ? "is-connected" : ""}`}>
          {phoneConnected ? (
            <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img
                src={backend?.status === "online" ? getCameraFeedUrl() : phoneStreamUrl}
                alt="Phone IP Camera Feed"
                className="phone-camera-stream"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => {
                  setPhoneError(`Could not reach ${phoneStreamUrl}. Ensure your phone's IP Webcam app is running and your laptop is on the same network.`);
                }}
              />
              <span className="phone-live-badge">
                <i /> IP CAMERA CONNECTED
              </span>
            </div>
          ) : (
            <div className="phone-camera-placeholder">
              <Smartphone size={30} />
              <span>Phone IP Camera</span>
              <small>
                Click "Connect phone camera" to specify your phone's IP address. It will connect to your phone camera stream directly.
              </small>
            </div>
          )}
        </div>
      </section>

      <p className="footnote">
        Browser vision or the local YOLO agent updates occupancy in the backend. Energy and potential savings are estimates based on modeled equipment loads, not meter readings.
      </p>
    </section>
  );
}
