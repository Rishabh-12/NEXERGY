import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Building2, Lightbulb, Snowflake, Users, Zap } from "lucide-react";

const chapters = [
  { key: "campus", number: "01", label: "A campus in balance", title: "Every building has a pulse.", body: "A live view of the spaces that shape the campus day — grounded in occupancy signals and transparent energy estimates.", icon: Building2 },
  { key: "occupancy", number: "02", label: "See the room", title: "Presence changes everything.", body: "Occupancy comes from the connected room state. When the service is offline, the interface says so and keeps local controls clearly marked.", icon: Users },
  { key: "waste", number: "03", label: "Spot the opportunity", title: "An empty room. Systems still on.", body: "A waste alert appears only when the backend reports one. The twin makes the active equipment visible, so the next action is easy to understand.", icon: Lightbulb },
  { key: "optimize", number: "04", label: "Test a better state", title: "Change the scenario first.", body: "Switch the lights or cooling in the simulator. The room illustration follows your settings while calculated impact stays labelled as an estimate.", icon: Snowflake },
  { key: "recommendation", number: "05", label: "Choose the next step", title: "Make the next action clear.", body: "Review a recommendation grounded in the room state and the scenario you applied. Energy, cost and carbon values remain clearly labelled as estimates.", icon: Zap },
];

function IsometricBuilding({ settings, backend, stage, active }) {
  const occupancy = Math.min(12, Math.max(0, settings.occupancy || 0));
  const focusedFloor = active >= 1 && active <= 3 ? active : 0;
  const floors = [
    { id: 3, y: 8, room: "A-301" },
    { id: 2, y: 158, room: "A-201" },
    { id: 1, y: 308, room: "A-101" },
  ];
  return (
    <div className={`journey-model building-journey stage-${stage} building-step-${active}`} aria-label={`Illustrative three-floor campus building. Floor ${focusedFloor || "all floors"} in focus. ${settings.occupancy} people are shown in connected room A-101; energy values are estimates.`}>
      <div className="model-grid" />
      <svg className="room-svg building-svg" viewBox="0 0 760 540" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="tower-top" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fffdf7"/><stop offset="1" stopColor="#d8e2ef"/></linearGradient>
          <linearGradient id="tower-wall" x1="0" x2="1"><stop stopColor="#eef0e9"/><stop offset="1" stopColor="#c8d0d1"/></linearGradient>
          <filter id="tower-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="15"/></filter>
        </defs>
        <ellipse cx="385" cy="515" rx="220" ry="24" fill="#233653" opacity=".15" filter="url(#tower-shadow)"/>
        {floors.map(({ id, y, room }) => <g className={`tower-floor ${focusedFloor === id ? "floor-focus" : ""}`} data-floor={id} key={id} transform={`translate(0 ${y})`}>
          <g className="tower-floor-shell">
            <polygon points="380,0 570,78 380,156 190,78" fill="url(#tower-top)" stroke="#aeb9c6" strokeWidth="2"/>
            <polygon points="190,78 380,156 380,203 190,125" fill="url(#tower-wall)" stroke="#aeb9c6" strokeWidth="2"/>
            <polygon points="380,156 570,78 570,125 380,203" fill="#d9dfdc" stroke="#aeb9c6" strokeWidth="2"/>
            <polygon className="tower-floor-slab" points="190,125 380,203 570,125 380,149" fill="#91a2b3" stroke="#e5e8e4" strokeWidth="2"/>
            <path d="M254 104l66 27v41l-66-27zM337 138l32 13v41l-32-13zM410 131l52-21v41l-52 21zM480 102l48-20v41l-48 20z" fill="#8fbdd0" stroke="#f7f6ef" strokeWidth="5"/>
            <path d="M190 78l190 78 190-78M380 156v47" fill="none" stroke="#73859a" strokeWidth="2" opacity=".6"/>
            <g className="tower-room-lights"><path d="M325 34l23 10-18 8-23-10zM372 54l23 10-18 8-23-10zM419 36l23 10-18 8-23-10z" fill={settings.lightsOn ? "#ffe6a3" : "#b7c0c4"}/></g>
            {id === 1 && Array.from({ length: Math.min(3, occupancy) }, (_, i) => <g className="tower-person" key={i} transform={`translate(${300 + i * 34} ${145 + i * 10})`}><circle cy="-14" r="6" fill="#d6a27e"/><path d="M-7 -7q7-8 14 0l4 15H-10z" fill="#3868d4"/></g>)}
            <text x="380" y="192" textAnchor="middle" className="tower-floor-number">0{id} · {room}</text>
          </g>
        </g>)}
      </svg>
      <span className="model-label label-presence"><Building2 size={13}/>03 FLOORS · 09 ROOMS</span>
      <span className="model-label label-light"><Users size={13}/>{settings.occupancy} in A-101</span>
      <span className="model-label label-cooling"><Zap size={13}/>{settings.lightsOn ? "Systems active" : "Systems reduced"}</span>
      <div className="model-status"><span className={`status-led ${backend?.status || "checking"}`} />{backend?.status === "online" ? "ROOM STATE CONNECTED" : "OFFLINE · LOCAL VIEW"}</div>
    </div>
  );
}

function HeroBuilding({ settings }) {
  const floors = [
    { id: 3, y: 8, room: "A-301" },
    { id: 2, y: 158, room: "A-201" },
    { id: 1, y: 308, room: "A-101" },
  ];
  return (
    <svg className="hero-building" viewBox="0 0 760 540" role="img" aria-label="Three-floor isometric digital twin of a campus building">
      <defs>
        <linearGradient id="hero-building-roof" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fffdf7"/><stop offset="1" stopColor="#c5d5e7"/></linearGradient>
        <linearGradient id="hero-building-wall" x1="0" x2="1"><stop stopColor="#f1f0e8"/><stop offset="1" stopColor="#b9c8d1"/></linearGradient>
        <linearGradient id="hero-building-glass" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#c6edff"/><stop offset="1" stopColor="#528dbe"/></linearGradient>
        <filter id="hero-building-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="15"/></filter>
      </defs>
      <ellipse cx="382" cy="515" rx="230" ry="25" fill="#091a42" opacity=".4" filter="url(#hero-building-shadow)"/>
      {floors.map(({ id, y, room }) => <g className="hero-building-floor" key={id} transform={`translate(0 ${y})`}>
        <polygon points="380,0 570,78 380,156 190,78" fill="url(#hero-building-roof)" stroke="#f6f6f1" strokeWidth="3"/>
        <polygon points="190,78 380,156 380,203 190,125" fill="url(#hero-building-wall)" stroke="#b4c1cc" strokeWidth="2"/>
        <polygon points="380,156 570,78 570,125 380,203" fill="#bdc9ce" stroke="#aebbc7" strokeWidth="2"/>
        <polygon points="190,125 380,203 570,125 380,149" fill="#7289a3" stroke="#edf2f5" strokeWidth="2"/>
        <path d="M254 104l66 27v41l-66-27zM337 138l32 13v41l-32-13zM410 131l52-21v41l-52 21zM480 102l48-20v41l-48 20z" fill="url(#hero-building-glass)" stroke="#f2f5ef" strokeWidth="5"/>
        <path d="M190 78l190 78 190-78M380 156v47" fill="none" stroke="#6e8197" strokeWidth="2" opacity=".8"/>
        <g className="hero-floor-light" fill={settings.lightsOn ? "#ffe6a3" : "#9daab5"}>
          <path d="M325 34l23 10-18 8-23-10zM372 54l23 10-18 8-23-10zM419 36l23 10-18 8-23-10z"/>
        </g>
        <text x="380" y="193" textAnchor="middle" className="hero-floor-label">0{id} · {room}</text>
      </g>)}
    </svg>
  );
}

export default function ArchitecturalJourney({ settings, backend, applied, onNavigate }) {
  const chapterRefs = useRef([]);
  const heroArtRef = useRef(null);
  const pointerFrame = useRef(0);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(Number(visible.target.dataset.chapter));
    }, { rootMargin: "-32% 0px -38% 0px", threshold: [0.1, 0.35, 0.6, 0.85] });
    chapterRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => window.cancelAnimationFrame(pointerFrame.current), []);

  function handleHeroPointerMove(event) {
    if (event.pointerType !== "mouse" || !heroArtRef.current) return;
    const bounds = heroArtRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    window.cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = window.requestAnimationFrame(() => {
      heroArtRef.current?.style.setProperty("--pointer-tilt-x", `${(x * 9).toFixed(2)}deg`);
      heroArtRef.current?.style.setProperty("--pointer-tilt-y", `${(-y * 7).toFixed(2)}deg`);
      heroArtRef.current?.style.setProperty("--pointer-shift-x", `${(x * 10).toFixed(1)}px`);
      heroArtRef.current?.style.setProperty("--pointer-shift-y", `${(y * 8).toFixed(1)}px`);
    });
  }

  function resetHeroPointer() {
    if (!heroArtRef.current) return;
    window.cancelAnimationFrame(pointerFrame.current);
    heroArtRef.current.style.setProperty("--pointer-tilt-x", "0deg");
    heroArtRef.current.style.setProperty("--pointer-tilt-y", "0deg");
    heroArtRef.current.style.setProperty("--pointer-shift-x", "0px");
    heroArtRef.current.style.setProperty("--pointer-shift-y", "0px");
  }

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
        <div className="hero-art" ref={heroArtRef} onPointerMove={handleHeroPointerMove} onPointerLeave={resetHeroPointer} aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><HeroBuilding settings={settings}/><span className="hero-coordinate coordinate-a">18° 31′ N<br/>73° 51′ E</span><span className="hero-coordinate coordinate-b">NEXERGY / 001</span><div className="hero-scale"><span>ENERGY ESTIMATE</span><strong>{applied?.simulated?.toFixed(2) ?? "0.00"} <small>kWh</small></strong><span>APPLIED SCENARIO</span></div><span className="hero-cursor-hint">MOVE TO EXPLORE</span></div>
        <a className="scroll-cue" href="#campus-story"><span>SCROLL TO EXPLORE</span><ArrowDown size={15}/></a>
        <span className="hero-index">01 / 05&nbsp;&nbsp; CAMPUS OVERVIEW</span>
      </section>
      <section className="story-section" id="campus-story" aria-label="How the digital twin works">
        <div className="story-track">
        <div className="story-visual"><div className="story-visual-top"><span>BUILDING A · 03 LEVELS</span><span>SCROLL-DRIVEN DIGITAL TWIN</span></div><IsometricBuilding settings={settings} backend={backend} stage={liveStage} active={active}/><div className="story-visual-foot"><span>FLOOR {active >= 1 && active <= 3 ? `0${active}` : "01—03"} / {settings.lightsOn ? "SYSTEMS ACTIVE" : "SYSTEMS REDUCED"}</span><span>0{active + 1} — 05</span></div></div>
          <div className="story-chapters">{chapters.map(({ key, number, label, title, body, icon: Icon }, index) => <article className={`story-chapter ${active === index ? "is-current" : ""}`} key={key} data-chapter={index} ref={(node) => { chapterRefs.current[index] = node; }}><div className="chapter-meta"><span>{number} / 05</span><span><Icon size={14}/>{label}</span></div><h2>{title}</h2><p>{body}</p>{index === 0 && <button type="button" className="text-link" onClick={() => onNavigate("twin")}>Explore room A-101 <ArrowUpRight size={15}/></button>}{index === 3 && <button type="button" className="text-link" onClick={() => onNavigate("simulator")}>Open energy simulator <ArrowUpRight size={15}/></button>}{index === 4 && <button type="button" className="text-link" onClick={() => onNavigate("recommendations")}>View AI recommendations <ArrowUpRight size={15}/></button>}</article>)}</div>
        </div>
      </section>
    </>
  );
}
