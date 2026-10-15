import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Building2, Lightbulb, Snowflake, Users, Zap } from "lucide-react";

const chapters = [
  { key: "campus", number: "01", label: "A campus in balance", title: "Every building has a pulse.", body: "A live view of the spaces that shape the campus day — grounded in occupancy signals and transparent energy estimates.", icon: Building2 },
  { key: "occupancy", number: "02", label: "See the room", title: "Presence changes everything.", body: "Occupancy comes from the connected room state. When the service is offline, the interface says so and keeps local controls clearly marked.", icon: Users },
  { key: "waste", number: "03", label: "Spot the opportunity", title: "An empty room. Systems still on.", body: "A waste alert appears only when the backend reports one. The twin makes the active equipment visible, so the next action is easy to understand.", icon: Lightbulb },
  { key: "optimize", number: "04", label: "Test a better state", title: "Change the scenario first.", body: "Switch the lights or cooling in the simulator. The room illustration follows your settings while calculated impact stays labelled as an estimate.", icon: Snowflake },
  { key: "recommendation", number: "05", label: "Choose the next step", title: "Make the next action clear.", body: "Review a recommendation grounded in the room state and the scenario you applied. Energy, cost and carbon values remain clearly labelled as estimates.", icon: Zap },
];

function IsometricRoom({ settings, backend, stage }) {
  const occupancy = Math.min(12, Math.max(0, settings.occupancy || 0));
  return (
    <div className={`journey-model stage-${stage}`} aria-label={`Illustrative isometric classroom. ${settings.occupancy} people, lights ${settings.lightsOn ? "on" : "off"}, air conditioning ${settings.acOn ? "on" : "off"}.`}>
      <div className="model-grid" />
      <svg className="room-svg" viewBox="0 0 760 560" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="floor" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#d8d4ca"/><stop offset="1" stopColor="#aaa99f"/></linearGradient>
          <linearGradient id="wall" x1="0" x2="1"><stop stopColor="#fffdf7"/><stop offset="1" stopColor="#ddd9ce"/></linearGradient>
          <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="16"/></filter>
        </defs>
        <ellipse cx="386" cy="457" rx="260" ry="50" fill="#233653" opacity=".13" filter="url(#shadow)"/>
        <polygon points="145,300 380,167 625,302 385,441" fill="url(#floor)" stroke="#a7a69d" strokeWidth="2"/>
        <polygon points="145,300 145,148 380,24 380,167" fill="url(#wall)" stroke="#c7c2b6" strokeWidth="2"/>
        <polygon points="380,167 625,302 625,149 380,24" fill="#ece8de" stroke="#c7c2b6" strokeWidth="2"/>
        <polygon points="380,167 380,24 625,149 625,302" fill="none" stroke="#2855d9" strokeWidth="2" opacity=".2"/>
        <g className="model-windows"><polygon points="184,197 246,164 246,236 184,270" fill="#afd4e8" stroke="#f8f6ef" strokeWidth="8"/><path d="M215 180v74M184 233l62-34" stroke="#f8f6ef" strokeWidth="4"/><polygon points="270,150 332,117 332,188 270,222" fill="#afd4e8" stroke="#f8f6ef" strokeWidth="8"/><path d="M301 134v71M270 186l62-34" stroke="#f8f6ef" strokeWidth="4"/></g>
        <g className="model-board"><polygon points="450,153 560,211 560,251 450,191" fill="#263d3a" stroke="#b6b3a8" strokeWidth="6"/><path d="M468 174l72 38M468 185l53 28" stroke="#d5dfd3" strokeWidth="3" opacity=".55"/></g>
        <g className={`model-lights ${settings.lightsOn ? "is-on" : ""}`}>
          {[0, 1, 2].map((i) => <g key={i}><polygon points={`${261 + i * 59},82 ${297 + i * 59},101 ${280 + i * 59},110 ${244 + i * 59},91`} fill={settings.lightsOn ? "#fff2bc" : "#b8b8af"} stroke="#fffdf7" strokeWidth="4"/><ellipse cx={272 + i * 59} cy="242" rx="52" ry="18" fill="#f1ca6d" opacity={settings.lightsOn ? ".14" : "0"}/></g>)}
        </g>
        <g className={`model-ac ${settings.acOn ? "is-on" : ""}`}><polygon points="479,95 552,134 552,158 479,119" fill={settings.acOn ? "#d4e7ef" : "#b4b8b7"} stroke="#a4abb0" strokeWidth="3"/><path d="M490 108l50 26M490 114l50 26M490 120l50 26" stroke="#75838b" strokeWidth="2"/></g>
        {Array.from({ length: 12 }, (_, i) => {
          const front = i % 4; const row = Math.floor(i / 4); const x = 235 + front * 58 + row * 28; const y = 286 + front * 10 + row * 53; const active = i < occupancy;
          return <g className={`model-desk ${active ? "occupied" : ""}`} key={i} transform={`translate(${x} ${y})`}>
            <polygon points="0,0 56,30 20,50 -36,20" fill="#ad8060" stroke="#86674e" strokeWidth="2"/><path d="M-27 21v30M15 44v29M48 29v29" stroke="#735a47" strokeWidth="4"/>
            {active && <g className="model-person"><ellipse cx="5" cy="-10" rx="9" ry="12" fill="#2855d9"/><path d="M-7 2q12-14 24 0l5 27H-12Z" fill="#4a75e5"/><circle cx="5" cy="-13" r="8" fill="#d6a27e"/></g>}
          </g>;
        })}
      </svg>
      <span className="model-label label-presence"><Users size={13}/>{settings.occupancy} {settings.occupancy === 1 ? "person" : "people"}</span>
      <span className="model-label label-light"><Lightbulb size={13}/>{settings.lightsOn ? "Lighting on" : "Lighting off"}</span>
      <span className="model-label label-cooling"><Snowflake size={13}/>{settings.acOn ? "Cooling active" : "Cooling off"}</span>
      <div className="model-status"><span className={`status-led ${backend?.status || "checking"}`} />{backend?.status === "online" ? "ROOM STATE CONNECTED" : "OFFLINE · LOCAL VIEW"}</div>
    </div>
  );
}

export default function ArchitecturalJourney({ settings, backend, applied, onNavigate }) {
  const chapterRefs = useRef([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(Number(visible.target.dataset.chapter));
    }, { rootMargin: "-32% 0px -38% 0px", threshold: [0.1, 0.35, 0.6, 0.85] });
    chapterRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);
  const liveStage = backend?.energyWasteAlert ? "waste" : chapters[active]?.key;
  return (
    <>
      <section className="nex-hero" aria-labelledby="hero-title">
        <div className="hero-blueprint" aria-hidden="true" />
        <div className="hero-copy">
          <p className="hero-kicker"><span className="hero-kicker-dot"/> ARCHITECTURAL INTELLIGENCE · CAMPUS A-101</p>
          <h1 id="hero-title">Energy has<br/><em>a place.</em></h1>
          <p className="hero-summary">A living model of campus spaces — connecting occupancy, energy estimates and better everyday decisions.</p>
          <div className="hero-actions"><button type="button" className="button-dark" onClick={() => onNavigate("twin")}>Enter the digital twin <ArrowUpRight size={16}/></button><span className="hero-note">LIVE CLASSROOM · A-101</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-building"><div className="building-roof"/><div className="building-level"><i/><i/><i/><i/></div><div className="building-ground"/><span className="building-annotation">A—101<br/>LEARNING ZONE</span></div><span className="hero-coordinate coordinate-a">18° 31′ N<br/>73° 51′ E</span><span className="hero-coordinate coordinate-b">NEXERGY / 001</span><div className="hero-scale"><span>ENERGY ESTIMATE</span><strong>{applied?.simulated?.toFixed(2) ?? "0.00"} <small>kWh</small></strong><span>APPLIED SCENARIO</span></div></div>
        <a className="scroll-cue" href="#campus-story"><span>SCROLL TO EXPLORE</span><ArrowDown size={15}/></a>
        <span className="hero-index">01 / 05&nbsp;&nbsp; CAMPUS OVERVIEW</span>
      </section>
      <section className="story-section" id="campus-story" aria-label="How the digital twin works">
        <div className="story-track">
          <div className="story-visual"><div className="story-visual-top"><span>ROOM A-101</span><span>ILLUSTRATIVE DIGITAL TWIN</span></div><IsometricRoom settings={settings} backend={backend} stage={liveStage}/><div className="story-visual-foot"><span>MODEL STATE / {settings.lightsOn ? "LIGHTING ACTIVE" : "LIGHTING INACTIVE"}</span><span>01 — 05</span></div></div>
          <div className="story-chapters">{chapters.map(({ key, number, label, title, body, icon: Icon }, index) => <article className={`story-chapter ${active === index ? "is-current" : ""}`} key={key} data-chapter={index} ref={(node) => { chapterRefs.current[index] = node; }}><div className="chapter-meta"><span>{number} / 05</span><span><Icon size={14}/>{label}</span></div><h2>{title}</h2><p>{body}</p>{index === 0 && <button type="button" className="text-link" onClick={() => onNavigate("twin")}>Explore room A-101 <ArrowUpRight size={15}/></button>}{index === 3 && <button type="button" className="text-link" onClick={() => onNavigate("simulator")}>Open energy simulator <ArrowUpRight size={15}/></button>}{index === 4 && <button type="button" className="text-link" onClick={() => onNavigate("recommendations")}>View AI recommendations <ArrowUpRight size={15}/></button>}</article>)}</div>
        </div>
      </section>
    </>
  );
}
