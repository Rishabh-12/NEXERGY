import { useEffect, useRef, useState } from "react";
import { Bot, Check, Eye, EyeOff, KeyRound, MessageCircle, Minimize2, Send, Settings2, Sparkles, X } from "lucide-react";
import { getRoomSnapshot } from "./campusData";
import { sendGeminiChat } from "../services/geminiChat";

const STORAGE_KEY = "nexergy-gemini-api-key";
const SUGGESTIONS = ["Why is energy high in this room?", "What does detect.py measure?", "How can I optimize AC use?", "Summarize this scenario's savings"];

function readKey() {
  try { return sessionStorage.getItem(STORAGE_KEY) || ""; }
  catch { return ""; }
}

function makeTelemetry({ settings, selectedRoom, backend, applied, baselineEnergy, simulatedEnergy, roomEquipment, roomOccupancy }) {
  const room = getRoomSnapshot(selectedRoom, settings, roomEquipment, roomOccupancy?.[selectedRoom]);
  const connected = room.connected;
  const activeLights = roomEquipment?.lights?.filter(Boolean).length ?? (room.lightsOn ? 10 : 0);
  const activeAcUnits = roomEquipment?.acs?.filter(Boolean).length ?? (room.acOn ? 3 : 0);
  const estimatedEnergy = connected ? (simulatedEnergy ?? room.energyKwh) : room.energyKwh;
  const appliedMatchesCurrent = connected && applied?.source && Math.abs((applied.simulated ?? Infinity) - (simulatedEnergy ?? 0)) < 0.005;
  const energyEstimateBasis = connected ? `estimate for ${settings.hours} configured operating hours` : "sample room profile estimate per day";
  return {
    room: `${selectedRoom} · ${room.name}`,
    building: "Building A · 3 floors · 9 modeled rooms",
    occupancy: {
      count: room.occupancy,
      source: connected && backend?.status === "online" ? "backend room-state API; may be CV-fed or manually simulated" : "sample estimate",
    },
    lighting: `${activeLights} of 10 modeled lights active (assumed 40 W each)`,
    airConditioning: `${activeAcUnits} of 3 modeled AC units active (assumed 600 W each)`,
    modeledEquipmentLoadW: activeLights * 40 + activeAcUnits * 600,
    estimatedEnergyKwh: Number(estimatedEnergy.toFixed(2)),
    energyEstimateBasis,
    baselineEnergyKwh: connected ? Number((baselineEnergy ?? 0).toFixed(2)) : null,
    currentScenarioEnergyKwh: connected ? Number((simulatedEnergy ?? room.energyKwh).toFixed(2)) : room.energyKwh,
    simulationSavingsKwh: appliedMatchesCurrent ? Number((applied.savings ?? 0).toFixed(2)) : null,
    simulationResultStatus: !connected ? "No A-101 simulation is applied to this sample room." : !applied?.source ? "No simulation has been applied yet." : appliedMatchesCurrent ? "The applied simulation matches the current equipment settings." : "The equipment settings changed after the last applied simulation; apply it again for current savings.",
    estimatedScenarioCostRupees: Number((estimatedEnergy * 8).toFixed(2)),
    acSetpointC: connected ? settings.setpoint : null,
    operatingHours: connected ? settings.hours : null,
    potentialWasteAlert: connected ? Boolean(backend?.energyWasteAlert) : false,
    projectWorkflow: "Person-only occupancy detection via detect.py → energy estimation from equipment assumptions → multi-floor digital twin → what-if simulation → recommendations.",
    dataNote: connected
      ? "A-101 occupancy comes from the backend room-state API and may be CV-fed or manually simulated. Energy, cost, and savings are estimates, never meter readings. The camera detects people; it does not measure electricity."
      : "This room has no connected camera or meter in the app. Occupancy and energy values are sample estimates. The camera detects people; it does not measure electricity.",
  };
}

function localAnswer(question, context) {
  const q = question.toLowerCase();
  const occupied = context.occupancy.count;
  const systems = `${context.lighting}; ${context.airConditioning}`;
  const estimate = `${context.estimatedEnergyKwh.toFixed(2)} kWh (${context.energyEstimateBasis})`;
  const savings = context.simulationSavingsKwh > 0
    ? `${context.simulationSavingsKwh.toFixed(2)} kWh and about ₹${(context.simulationSavingsKwh * 8).toFixed(2)} for the applied scenario`
    : context.simulationSavingsKwh === null ? context.simulationResultStatus : "no savings are recorded in the applied simulation";

  if (/^(hi|hello|hey|yo|good morning|good afternoon|good evening)[!.\s]*$/.test(q)) {
    return `Hi! I’m NexEnergy, your campus energy assistant. ${context.room} currently shows ${occupied} ${occupied === 1 ? "person" : "people"}, with ${systems}; ask me about occupancy detection, room controls, or energy savings.`;
  }
  if (/saving|summari|reduce|cost|benefit/.test(q)) {
    return `For ${context.room}, ${savings} Current use is estimated at ${estimate}. These are modeled values, not meter readings.`;
  }
  if (/detect\.py|camera|vision|computer vision/.test(q)) {
    return `NexEnergy uses detect.py for person-only occupancy detection; it does not detect cell phones or measure electricity. ${context.room} currently shows ${occupied} ${occupied === 1 ? "person" : "people"} (${context.occupancy.source}).`;
  }
  if (/ac|cool|temperature|setpoint/.test(q)) {
    const target = context.acSetpointC == null ? "the selected room has no connected AC setpoint" : `the current setpoint is ${context.acSetpointC}°C`;
    return `For ${context.room}, ${target}; ${context.airConditioning}. Try a modest 24–26°C scenario if it fits comfort policy, then compare its estimated energy use (${estimate}).`;
  }
  if (/light|empty|occup|presence/.test(q)) {
    const suggestion = occupied === 0
      ? "The room is currently shown as empty, so switching off lighting and cooling when safe is a useful scenario to compare."
      : `The room is shown with ${occupied} ${occupied === 1 ? "person" : "people"}; consider daylight and occupied-zone lighting before changing the group.`;
    return `${suggestion} Current modeled controls: ${systems}. Occupancy is ${context.occupancy.source}; energy remains an estimate.`;
  }
  if (/high|energy|consum|waste/.test(q)) {
    const alert = context.potentialWasteAlert ? " The backend also reports a potential waste alert." : "";
    return `${context.room} is estimated at ${estimate} with ${occupied} people shown and ${systems}.${alert} Check the room schedule and compare a lights-off or reduced-AC scenario; the camera does not measure energy.`;
  }
  const scenario = context.acSetpointC == null ? "This room uses sample controls" : `The scenario uses a ${context.acSetpointC}°C setpoint for ${context.operatingHours} hours`;
  return `For ${context.room}, the estimate is ${estimate} with ${occupied} people shown and ${systems}. ${scenario}; ask me about detect.py, AC, lighting, or savings.`;
}

export default function EnergyChat({ settings, backend, selectedRoom, applied, baselineEnergy, simulatedEnergy, roomEquipment, roomOccupancy }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(readKey);
  const [keyDraft, setKeyDraft] = useState(readKey);
  const [showKey, setShowKey] = useState(false);
  const [keyNotice, setKeyNotice] = useState("");
  const [apiStatus, setApiStatus] = useState(readKey() ? "ready" : "local");
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: readKey() ? "Hi, I’m NexEnergy. Gemini is ready for questions about this campus, room telemetry, and energy scenarios." : "Hi, I’m NexEnergy. I can answer room and energy questions locally; connect a Gemini key in the top-right settings for live generative answers." },
  ]);
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function saveKey(event) {
    event.preventDefault();
    const nextKey = keyDraft.trim();
    try {
      if (nextKey) sessionStorage.setItem(STORAGE_KEY, nextKey);
      else sessionStorage.removeItem(STORAGE_KEY);
      setApiKey(nextKey);
      setApiStatus(nextKey ? "ready" : "local");
      setKeyNotice(nextKey ? "API key saved for this browser tab." : "API key removed. NexEnergy will use local answers.");
    } catch {
      setKeyNotice("Session storage is unavailable. Check browser privacy settings and try again.");
    }
  }

  async function sendQuestion(value = question) {
    const text = value.trim();
    if (!text || sending) return;
    const nextHistory = [...messages, { role: "user", text }];
    setQuestion("");
    setMessages(nextHistory);
    setSending(true);
    const context = makeTelemetry({ settings, selectedRoom, backend, applied, baselineEnergy, simulatedEnergy, roomEquipment, roomOccupancy });
    try {
      if (!apiKey) {
        setMessages([...nextHistory, { role: "assistant", text: localAnswer(text, context), source: "Local energy assistant · add a Gemini key for generative chat" }]);
      } else {
        const answer = await sendGeminiChat({ apiKey, history: nextHistory, context });
        setMessages([...nextHistory, { role: "assistant", text: answer, source: "Gemini · live room context" }]);
        setApiStatus("connected");
      }
    } catch (error) {
      setApiStatus("error");
      const errorMessage = error instanceof Error ? error.message.slice(0, 180) : "network or API error";
      setMessages([...nextHistory, {
        role: "assistant",
        text: `${localAnswer(text, context)}\n\nGemini could not be reached (${errorMessage}). This is the local fallback; check the API key, model access, quota, and network connection in Settings.`,
        source: "Local fallback",
      }]);
    } finally {
      setSending(false);
    }
  }

  const room = getRoomSnapshot(selectedRoom, settings, roomEquipment, roomOccupancy?.[selectedRoom]);
  const currentRoomEnergy = room.connected ? (simulatedEnergy ?? room.energyKwh) : room.energyKwh;
  const status = apiStatus === "connected" ? "Gemini connected" : apiStatus === "ready" ? "Gemini key saved · send a message" : apiStatus === "error" ? "Gemini unavailable · local answers" : "Connect Gemini for live AI";

  return (
    <div className={`energy-chat ${open ? "is-open" : ""}`}>
      {open && <section className="energy-chat-panel" aria-label="NexEnergy AI chat">
        <header className="energy-chat-header">
          <span className="energy-chat-avatar"><Bot size={18}/></span>
          <div><strong>NexEnergy assistant</strong><button type="button" className={`chat-status status-${apiStatus}`} onClick={() => { setKeyDraft(apiKey); setKeyNotice(""); setSettingsOpen(true); }}><i/>{status}</button></div>
          <button type="button" aria-label="Gemini API key settings" title="Gemini API key settings" onClick={() => { setKeyDraft(apiKey); setKeyNotice(""); setSettingsOpen(true); }}><Settings2 size={15}/></button>
          <button type="button" aria-label="Minimize chat" onClick={() => setOpen(false)}><Minimize2 size={15}/></button>
          <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}><X size={16}/></button>
        </header>
        <div className="energy-chat-context"><Sparkles size={13}/> <span>ROOM</span><strong>{selectedRoom}</strong><span className="chat-context-energy">{currentRoomEnergy.toFixed(2)} kWh est.</span></div>
        <div className="energy-chat-messages" ref={listRef} aria-live="polite">
          {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><div>{message.text}</div>{message.source && <small>{message.source}</small>}</article>)}
          {sending && <article className="chat-message assistant" aria-label="NexEnergy is thinking"><div className="chat-typing"><i/><i/><i/></div></article>}
        </div>
        <div className="energy-chat-suggestions" aria-label="Suggested questions">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} disabled={sending} onClick={() => sendQuestion(suggestion)}>{suggestion}</button>)}</div>
        <form className="energy-chat-form" onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about energy or this room…" aria-label="Ask NexEnergy a question" disabled={sending}/><button type="submit" aria-label="Send message" disabled={!question.trim() || sending}><Send size={16}/></button></form>
        <p className="energy-chat-disclaimer">Estimates are not meter readings. Your key is used only in this tab and sent directly to Google Gemini.</p>
      </section>}
      {settingsOpen && <div className="chat-settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
        <section className="chat-settings-modal" role="dialog" aria-modal="true" aria-labelledby="chat-settings-title">
          <header><span className="chat-settings-icon"><KeyRound size={17}/></span><div><h2 id="chat-settings-title">Gemini connection</h2><p>Bring your own API key for live AI responses.</p></div><button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={17}/></button></header>
          <form onSubmit={saveKey}>
            <label htmlFor="gemini-api-key">Gemini API key</label>
            <div className="chat-key-input"><input id="gemini-api-key" type={showKey ? "text" : "password"} autoComplete="off" spellCheck="false" value={keyDraft} onChange={(event) => { setKeyDraft(event.target.value); setKeyNotice(""); }} placeholder="Paste your Google AI Studio key"/><button type="button" aria-label={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey((value) => !value)}>{showKey ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
            <p className="chat-key-help">Saved in sessionStorage until this tab closes. It is sent directly to Google, never to the NexEnergy backend.</p>
            {keyNotice && <p className="chat-key-notice" role="status">{keyNotice}</p>}
            <div className="chat-settings-actions"><button type="button" className="chat-key-clear" onClick={() => { setKeyDraft(""); setApiKey(""); setApiStatus("local"); try { sessionStorage.removeItem(STORAGE_KEY); setKeyNotice("API key removed."); } catch { setKeyNotice("Could not clear session storage."); } }}>Clear key</button><button type="submit" className="chat-key-save"><Check size={15}/> Save for this session</button></div>
          </form>
          <div className="chat-settings-local"><Sparkles size={14}/><span>No key? Local energy-aware answers remain available for your demo.</span></div>
        </section>
      </div>}
      <button type="button" className="energy-chat-launcher" aria-label={open ? "Close NexEnergy assistant" : "Open NexEnergy assistant"} aria-expanded={open} onClick={() => setOpen((current) => !current)}>{open ? <X size={20}/> : <><MessageCircle size={19}/><span>Ask NexEnergy</span><i/></>}</button>
    </div>
  );
}
