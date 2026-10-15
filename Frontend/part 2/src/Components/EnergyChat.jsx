import { useEffect, useRef, useState } from "react";
import { Bot, Check, Eye, EyeOff, KeyRound, MessageCircle, Minimize2, Send, Settings2, Sparkles, X } from "lucide-react";
import { getRoomSnapshot } from "./campusData";
import { sendGeminiChat } from "../services/geminiChat";

const STORAGE_KEY = "nexergy-gemini-api-key";
const SUGGESTIONS = ["Why is energy high?", "How do I optimize AC usage?", "Summarize potential savings"];

function readKey() {
  try { return sessionStorage.getItem(STORAGE_KEY) || ""; }
  catch { return ""; }
}

function makeTelemetry({ settings, selectedRoom, backend, applied, baselineEnergy, simulatedEnergy }) {
  const room = getRoomSnapshot(selectedRoom, settings);
  return {
    room: `${selectedRoom} · ${room.name}`,
    occupancy: {
      count: room.occupancy,
      source: room.connected && backend?.status === "online" ? "live people count" : "sample estimate",
    },
    lighting: `${settings.lightsOn ? 10 : 0} of 10 modeled lights active`,
    airConditioning: `${settings.acOn ? 2 : 0} of 2 modeled AC units active`,
    estimatedEnergyKwhPerDay: Number(room.energyKwh.toFixed(2)),
    baselineEnergyKwh: Number((baselineEnergy ?? 0).toFixed(2)),
    currentScenarioEnergyKwh: Number((simulatedEnergy ?? room.energyKwh).toFixed(2)),
    simulationSavingsKwh: Number((applied?.savings ?? 0).toFixed(2)),
    estimatedDailyCostRupees: Number((room.energyKwh * 8).toFixed(2)),
    acSetpointC: settings.setpoint,
    operatingHours: settings.hours,
    potentialWasteAlert: room.connected ? Boolean(backend?.energyWasteAlert) : false,
    dataNote: room.connected
      ? "Occupancy may be live. Energy and savings are model estimates, not meter readings."
      : "Room occupancy and energy values are sample estimates, not live telemetry or meter readings.",
  };
}

function localAnswer(question, context) {
  const q = question.toLowerCase();
  const occupied = context.occupancy.count;
  const systems = `${context.lighting}; ${context.airConditioning}`;
  const savings = context.simulationSavingsKwh > 0
    ? `${context.simulationSavingsKwh.toFixed(2)} kWh and about ₹${(context.simulationSavingsKwh * 8).toFixed(2)} per day`
    : "no savings are recorded in the applied simulation yet";

  if (/saving|summari|reduce|cost|benefit/.test(q)) {
    return `For ${context.room}, the applied scenario shows ${savings}. Current use is estimated at ${context.estimatedEnergyKwhPerDay.toFixed(2)} kWh/day. ${context.dataNote}`;
  }
  if (/ac|cool|temperature|setpoint/.test(q)) {
    return `The room is set to ${context.acSetpointC}°C with ${context.airConditioning}. Try a modest setpoint around 24–26°C, then compare the simulated use while keeping comfort and campus policy in mind. The room’s current ${context.estimatedEnergyKwhPerDay.toFixed(2)} kWh/day is an estimate. ${context.dataNote}`;
  }
  if (/light|empty|occup|presence/.test(q)) {
    const suggestion = occupied === 0
      ? "The room is currently shown as empty, so switching off lighting and cooling when safe is a useful scenario to compare."
      : `The room is shown with ${occupied} ${occupied === 1 ? "person" : "people"}; consider daylight and occupied-zone lighting before changing the group.`;
    return `${suggestion} Controls currently show ${systems}. ${context.dataNote}`;
  }
  if (/high|energy|consum|waste/.test(q)) {
    const alert = context.potentialWasteAlert ? "The connected room service also reports a potential energy-waste alert. " : "";
    return `${context.room} is estimated at ${context.estimatedEnergyKwhPerDay.toFixed(2)} kWh/day with ${occupied} people shown and ${systems}. ${alert}Compare the current schedule and equipment settings in the simulator; the app does not measure electricity with its camera. ${context.dataNote}`;
  }
  return `For ${context.room}, the current estimate is ${context.estimatedEnergyKwhPerDay.toFixed(2)} kWh/day with ${occupied} people shown. The scenario uses ${systems}, a ${context.acSetpointC}°C AC setpoint, and ${context.operatingHours} operating hours. Ask about AC, lighting, occupancy, or savings to explore it. ${context.dataNote}`;
}

export default function EnergyChat({ settings, backend, selectedRoom, applied, baselineEnergy, simulatedEnergy }) {
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
    { role: "assistant", text: "Hi, I’m NexEnergy. I can explain this room’s telemetry, compare the current scenario, and suggest ways to reduce energy use." },
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
    const context = makeTelemetry({ settings, selectedRoom, backend, applied, baselineEnergy, simulatedEnergy });
    try {
      if (!apiKey) {
        setMessages([...nextHistory, { role: "assistant", text: localAnswer(text, context), source: "Local energy assistant · add a Gemini key for generative chat" }]);
      } else {
        const answer = await sendGeminiChat({ apiKey, history: nextHistory, context });
        setMessages([...nextHistory, { role: "assistant", text: answer, source: "Gemini · live room context" }]);
        setApiStatus("connected");
      }
    } catch {
      setApiStatus("error");
      setMessages([...nextHistory, {
        role: "assistant",
        text: `${localAnswer(text, context)}\n\nGemini could not be reached, so this answer was generated locally. Check the key, model access, and network connection in Settings.`,
        source: "Local fallback",
      }]);
    } finally {
      setSending(false);
    }
  }

  const room = getRoomSnapshot(selectedRoom, settings);
  const status = apiStatus === "connected" ? "Gemini connected" : apiStatus === "ready" ? "Gemini ready" : apiStatus === "error" ? "Gemini unavailable · local answers" : "Local energy assistant";

  return (
    <div className={`energy-chat ${open ? "is-open" : ""}`}>
      {open && <section className="energy-chat-panel" aria-label="NexEnergy AI chat">
        <header className="energy-chat-header">
          <span className="energy-chat-avatar"><Bot size={18}/></span>
          <div><strong>NexEnergy assistant</strong><small className={`chat-status status-${apiStatus}`}><i/>{status}</small></div>
          <button type="button" aria-label="Gemini API key settings" title="Gemini API key settings" onClick={() => { setKeyDraft(apiKey); setKeyNotice(""); setSettingsOpen(true); }}><Settings2 size={15}/></button>
          <button type="button" aria-label="Minimize chat" onClick={() => setOpen(false)}><Minimize2 size={15}/></button>
          <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}><X size={16}/></button>
        </header>
        <div className="energy-chat-context"><Sparkles size={13}/> <span>ROOM</span><strong>{selectedRoom}</strong><span className="chat-context-energy">{room.energyKwh.toFixed(2)} kWh est.</span></div>
        <div className="energy-chat-messages" ref={listRef} aria-live="polite">
          {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><div>{message.text}</div>{message.source && <small>{message.source}</small>}</article>)}
          {sending && <article className="chat-message assistant" aria-label="NexEnergy is thinking"><div className="chat-typing"><i/><i/><i/></div></article>}
        </div>
        {messages.length === 1 && <div className="energy-chat-suggestions">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => sendQuestion(suggestion)}>{suggestion}</button>)}</div>}
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
