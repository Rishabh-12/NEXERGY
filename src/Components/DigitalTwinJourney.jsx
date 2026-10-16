import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Building2, Lightbulb, Radio, Snowflake, Users, Zap } from "lucide-react";
import { CLASSROOM_CAPACITY } from "../services/energyCalculations";
import { FLOORS, getRoomSnapshot } from "./campusData";

const CHAPTERS = [
  {
    id: "campus",
    number: "01",
    eyebrow: "THE CAMPUS",
    title: "One building.\nNine distinct spaces.",
    description: "Move through a three-floor model and choose a room to see how its occupancy and assumed equipment load shape the energy estimate.",
    icon: Building2,
  },
  {
    id: "ground",
    number: "02",
    eyebrow: "GROUND FLOOR · A-101",
    title: "A room leaves a signal.",
    description: "A-101 is the connected room. When the API is online, its people count can reflect browser-camera detection or manual input; energy remains modeled.",
    floorId: 1,
    icon: Users,
  },
  {
    id: "first",
    number: "03",
    eyebrow: "FIRST FLOOR · LEARNING",
    title: "See systems in context.",
    description: "Explore the learning and collaboration rooms. Their occupancy and energy are sample profiles, ready for a future sensor connection.",
    floorId: 2,
    icon: Lightbulb,
  },
  {
    id: "second",
    number: "04",
    eyebrow: "SECOND FLOOR · RESEARCH",
    title: "Test a better state.",
    description: "Select a room to inspect its lights, cooling, seating, and estimated load. Change the model first, then compare a scenario in the simulator.",
    floorId: 3,
    icon: Zap,
  },
];

const BUILDING_LAYERS = [
  { floorId: 3, y: 18 },
  { floorId: 2, y: 188 },
  { floorId: 1, y: 358 },
];

function RoomBuilding({ focusFloor, selectedRoom, settings, stage }) {
  return (
    <svg className="twin-building-art" viewBox="0 0 800 575" role="img" aria-labelledby="twin-building-title twin-building-desc">
      <title id="twin-building-title">NexEnergy three-floor building model</title>
      <desc id="twin-building-desc">An isometric three-floor campus with three selectable modeled rooms on each floor.</desc>
      <defs>
        <linearGradient id="twin-roof" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eaf3ff"/><stop offset=".52" stopColor="#8eb8de"/><stop offset="1" stopColor="#426a91"/></linearGradient>
        <linearGradient id="twin-wall-left" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b7d5e8" stopOpacity=".82"/><stop offset="1" stopColor="#386489" stopOpacity=".6"/></linearGradient>
        <linearGradient id="twin-wall-right" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#82b0d1" stopOpacity=".76"/><stop offset="1" stopColor="#183b5e" stopOpacity=".82"/></linearGradient>
        <linearGradient id="twin-floor-edge" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9cc3dd"/><stop offset="1" stopColor="#365477"/></linearGradient>
        <radialGradient id="twin-ground-glow"><stop stopColor="#4389c8" stopOpacity=".34"/><stop offset="1" stopColor="#4389c8" stopOpacity="0"/></radialGradient>
        <filter id="twin-soft-shadow" x="-40%" y="-50%" width="180%" height="220%"><feGaussianBlur stdDeviation="15"/></filter>
        <filter id="twin-window-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="402" cy="530" rx="245" ry="29" fill="#030914" opacity=".86" filter="url(#twin-soft-shadow)"/>
      <ellipse cx="402" cy="521" rx="240" ry="27" fill="url(#twin-ground-glow)"/>
      <ellipse className="twin-orbit twin-orbit-a" cx="402" cy="492" rx="248" ry="59" fill="none" stroke="#6ab3e7" strokeOpacity=".28"/>
      <ellipse className="twin-orbit twin-orbit-b" cx="402" cy="492" rx="208" ry="43" fill="none" stroke="#73d7d0" strokeOpacity=".15"/>
      {BUILDING_LAYERS.map(({ floorId, y }) => {
        const floor = FLOORS.find((item) => item.id === floorId);
        const highlighted = focusFloor === floorId;
        const selected = floor?.rooms.some((room) => room.id === selectedRoom);
        const lights = floor?.rooms.some((room) => {
          const roomSnapshot = getRoomSnapshot(room.id, settings, undefined, undefined);
          return roomSnapshot.lightsOn;
        });
        return (
          <g
            key={floorId}
            className={`twin-building-floor ${highlighted ? "is-in-focus" : ""} ${selected ? "contains-selection" : ""}`}
            data-floor={floorId}
            transform={`translate(0 ${y})`}
          >
            <polygon points="400,4 598,82 400,160 202,82" fill="url(#twin-roof)" stroke="#d6ebf8" strokeOpacity=".82" strokeWidth="2"/>
            <polygon points="202,82 400,160 400,202 202,124" fill="url(#twin-wall-left)" stroke="#b1d0e4" strokeOpacity=".7" strokeWidth="1.5"/>
            <polygon points="400,160 598,82 598,124 400,202" fill="url(#twin-wall-right)" stroke="#8ebad8" strokeOpacity=".65" strokeWidth="1.5"/>
            <polygon points="202,124 400,202 598,124 400,154" fill="url(#twin-floor-edge)" stroke="#c8e2f1" strokeOpacity=".9" strokeWidth="2"/>
            <path d="M202 82 400 160 598 82M400 160v42" fill="none" stroke="#d5ebf6" strokeOpacity=".48" strokeWidth="1.5"/>
            <path d="M255 104l58 23v38l-58-23zM335 136l33 13v38l-33-13z" fill="#99d6ed" fillOpacity=".82" stroke="#d7f4ff" strokeOpacity=".85" strokeWidth="4"/>
            <path d="M435 146l57-22v38l-57 22zM505 118l47-19v38l-47 19z" fill="#75bada" fillOpacity=".82" stroke="#c6eafa" strokeOpacity=".82" strokeWidth="4"/>
            <path d="M287 90l19 8-14 6-19-8zM380 126l19 8-14 6-19-8zM443 91l19 8-14 6-19-8z" className={`twin-ceiling-glow ${lights ? "is-on" : ""}`} filter="url(#twin-window-glow)"/>
            <path d="M214 123 400 197 586 123" fill="none" stroke="#173550" strokeOpacity=".5" strokeWidth="4"/>
            <text x="400" y="190" textAnchor="middle" className="twin-svg-floor-label">0{floorId} · {floor?.rooms.length ?? 0} ROOMS</text>
            {selected && <circle className="twin-selected-floor-marker" cx="400" cy="178" r="5"/>}
          </g>
        );
      })}
      <path className={`twin-signal-path stage-${stage}`} d="M400 510C467 476 341 441 400 405S460 338 400 320 350 256 400 235 456 175 400 124" fill="none" stroke="#62dcce" strokeWidth="2" strokeDasharray="5 10" strokeLinecap="round"/>
      <circle className="twin-signal-node node-ground" cx="400" cy="480" r="5"/>
      <circle className="twin-signal-node node-first" cx="400" cy="311" r="5"/>
      <circle className="twin-signal-node node-second" cx="400" cy="141" r="5"/>
      <g className="twin-model-coordinates"><text x="80" y="80">NEXERGY / CAMPUS A</text><text x="610" y="500">MODEL VIEW · 03 LEVELS</text></g>
    </svg>
  );
}

function getRoomMetrics(roomId, settings, roomEquipment, roomOccupancy) {
  const equipment = roomEquipment?.[roomId];
  const room = getRoomSnapshot(roomId, settings, equipment, roomOccupancy?.[roomId]);
  const activeLights = equipment?.lights?.filter(Boolean).length ?? (room.lightsOn ? 10 : 0);
  const activeAcUnits = equipment?.acs?.filter(Boolean).length ?? (room.acOn ? 3 : 0);
  return {
    room,
    activeLights,
    activeAcUnits,
    watts: activeLights * 40 + activeAcUnits * 600,
  };
}

export default function DigitalTwinJourney({ settings, backend, roomEquipment, roomOccupancy, selectedRoom, onSelectRoom, onEnterRoom, onNavigate }) {
  const chapterRefs = useRef([]);
  const artRef = useRef(null);
  const pointerFrame = useRef(0);
  const [activeChapter, setActiveChapter] = useState(0);
  const chapter = CHAPTERS[activeChapter] ?? CHAPTERS[0];
  const selectedFloor = FLOORS.find((floor) => floor.rooms.some((room) => room.id === selectedRoom)) ?? FLOORS[0];
  const focusFloor = chapter.floorId ?? selectedFloor.id;
  const focusFloorData = FLOORS.find((floor) => floor.id === focusFloor) ?? selectedFloor;
  const selected = getRoomMetrics(selectedRoom, settings, roomEquipment, roomOccupancy);
  const selectedConnected = selected.room.connected && backend?.status === "online";
  const currentRoomDetails = useMemo(() => {
    const current = getRoomMetrics(selectedRoom, settings, roomEquipment, roomOccupancy);
    return current;
  }, [selectedRoom, settings, roomEquipment, roomOccupancy]);

  const floorSummaries = useMemo(() => FLOORS.map((floor) => {
    const rooms = floor.rooms.map((room) => getRoomMetrics(room.id, settings, roomEquipment, roomOccupancy));
    return {
      ...floor,
      people: rooms.reduce((sum, item) => sum + item.room.occupancy, 0),
      energy: rooms.reduce((sum, item) => sum + item.room.energyKwh, 0),
    };
  }), [settings, roomEquipment, roomOccupancy]);
  const campusSummary = useMemo(() => ({
    people: floorSummaries.reduce((sum, floor) => sum + floor.people, 0),
    energy: floorSummaries.reduce((sum, floor) => sum + floor.energy, 0),
  }), [floorSummaries]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveChapter(Number(visible.target.dataset.twinChapter));
    }, { rootMargin: "-34% 0px -40% 0px", threshold: [0.1, 0.35, 0.6, 0.85] });
    chapterRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => window.cancelAnimationFrame(pointerFrame.current), []);

  function goToChapter(index) {
    const target = chapterRefs.current[index];
    if (!target) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  function chooseRoom(roomId) {
    onSelectRoom(roomId);
    const floor = FLOORS.find((item) => item.rooms.some((room) => room.id === roomId));
    if (floor) goToChapter(floor.id);
  }

  function handlePointerMove(event) {
    if (event.pointerType !== "mouse" || !artRef.current) return;
    const bounds = artRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    window.cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = window.requestAnimationFrame(() => {
      artRef.current?.style.setProperty("--twin-tilt-x", `${(x * 6).toFixed(2)}deg`);
      artRef.current?.style.setProperty("--twin-tilt-y", `${(-y * 4).toFixed(2)}deg`);
      artRef.current?.style.setProperty("--twin-shift-x", `${(x * 5).toFixed(1)}px`);
      artRef.current?.style.setProperty("--twin-shift-y", `${(y * 4).toFixed(1)}px`);
    });
  }

  function resetPointer() {
    if (!artRef.current) return;
    window.cancelAnimationFrame(pointerFrame.current);
    artRef.current.style.setProperty("--twin-tilt-x", "0deg");
    artRef.current.style.setProperty("--twin-tilt-y", "0deg");
    artRef.current.style.setProperty("--twin-shift-x", "0px");
    artRef.current.style.setProperty("--twin-shift-y", "0px");
  }

  return (
    <div className="digital-twin-experience">
      <header className="twin-intro">
        <div className="twin-intro-copy">
          <p className="twin-overline"><span className="twin-overline-dot"/> CAMPUS INTELLIGENCE · BUILDING A</p>
          <h1>See the space.<br/><em>Understand its energy.</em></h1>
          <p>Explore three connected floors, move between nine modeled rooms, and follow the signals that shape each energy estimate.</p>
        </div>
        <div className="twin-intro-aside">
          <span><Building2 size={15}/>03 FLOORS</span>
          <span><Users size={15}/>09 MODELED ROOMS</span>
          <a href="#twin-story">Scroll to explore <ArrowDown size={14}/></a>
        </div>
      </header>

      <section className="twin-scroll-story" id="twin-story" aria-label="Scroll through the digital twin">
        <aside className="twin-stage-shell" data-story-step={activeChapter} aria-label="Interactive campus model">
          <div className="twin-stage-topline">
            <span><span className="twin-live-dot"/>{selectedConnected ? "ROOM STATE CONNECTED" : "ILLUSTRATIVE CAMPUS MODEL"}</span>
            <span>01 / BUILDING A</span>
          </div>
          <div className="twin-stage-art" ref={artRef} onPointerMove={handlePointerMove} onPointerLeave={resetPointer}>
            <div className="twin-stage-grid" aria-hidden="true"/>
            <span className="twin-stage-coordinate twin-coordinate-north">18° 31′ N<br/>73° 51′ E</span>
            <span className="twin-stage-coordinate twin-coordinate-east">NEXERGY / 001</span>
            <RoomBuilding focusFloor={focusFloor} selectedRoom={selectedRoom} settings={settings} stage={activeChapter}/>
            <div className="twin-model-callout"><span>SCROLL FOCUS</span><strong>0{focusFloor} / {focusFloorData.label}</strong></div>
          </div>
          <div className="twin-stage-progress" aria-label="Digital twin story chapters">
            {CHAPTERS.map((item, index) => (
              <button type="button" key={item.id} className={activeChapter === index ? "is-active" : ""} aria-label={`Go to chapter ${item.number}: ${item.eyebrow}`} aria-current={activeChapter === index ? "step" : undefined} onClick={() => goToChapter(index)}>
                <span style={{ "--chapter-fill": activeChapter > index ? "100%" : activeChapter === index ? "56%" : "0%" }}/>
              </button>
            ))}
          </div>
          <div className="twin-floor-selector">
            <span className="twin-selector-label">SELECT A FLOOR</span>
            <div role="tablist" aria-label="Select a campus floor">
              {[...FLOORS].reverse().map((floor) => (
                <button type="button" role="tab" id={`twin-floor-tab-${floor.id}`} aria-controls="twin-room-picker-panel" aria-selected={focusFloor === floor.id} className={focusFloor === floor.id ? "is-selected" : ""} key={floor.id} onClick={() => { if (!floor.rooms.some((room) => room.id === selectedRoom)) onSelectRoom(floor.rooms[0].id); goToChapter(floor.id); }}>
                  <strong>0{floor.id}</strong><span>{floor.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="twin-room-picker" id="twin-room-picker-panel" role="tabpanel" aria-labelledby={`twin-floor-tab-${focusFloor}`}>
            <div className="twin-room-picker-heading"><span>ROOMS ON FLOOR 0{focusFloor}</span><span>{focusFloorData.rooms.length} SPACES</span></div>
            <div>
              {focusFloorData.rooms.map((room) => {
                const metrics = getRoomMetrics(room.id, settings, roomEquipment, roomOccupancy);
                return <button type="button" key={room.id} aria-pressed={selectedRoom === room.id} className={selectedRoom === room.id ? "is-selected" : ""} onClick={() => chooseRoom(room.id)}><strong>{room.id}</strong><span>{room.name}</span><small>{metrics.room.occupancy} people</small></button>;
              })}
            </div>
          </div>
          <div className="twin-selected-readout" aria-live="polite">
            <div><span>SELECTED SPACE</span><strong>{selectedRoom} · {currentRoomDetails.room.name}</strong></div>
            <div><span>PEOPLE</span><strong>{currentRoomDetails.room.occupancy}</strong></div>
            <div><span>ENERGY ESTIMATE</span><strong>{currentRoomDetails.room.energyKwh.toFixed(2)} <small>kWh/day</small></strong></div>
          </div>
          <div className="twin-stage-actions">
            <span><Radio size={13}/>{selectedConnected ? "Connected room state" : "Sample room profile"}</span>
            <button type="button" onClick={onEnterRoom}>Enter selected room <ArrowUpRight size={14}/></button>
          </div>
        </aside>

        <div className="twin-story-chapters">
          {CHAPTERS.map(({ id, number, eyebrow, title, description, floorId, icon: Icon }, index) => {
            const floor = floorId ? floorSummaries.find((item) => item.id === floorId) : null;
            return (
              <article className={`twin-story-chapter ${activeChapter === index ? "is-current" : ""}`} key={id} data-twin-chapter={index} ref={(node) => { chapterRefs.current[index] = node; }}>
                <div className="twin-chapter-meta"><span>{number} / 04</span><span><Icon size={14}/>{eyebrow}</span></div>
                <h2>{title.split("\n").map((line, lineIndex) => <span key={line}>{line}{lineIndex < title.split("\n").length - 1 && <br/>}</span>)}</h2>
                <p>{description}</p>
                <div className="twin-chapter-reading">
                  {floor ? <><span>MODELED PEOPLE <strong>{floor.people}</strong></span><span>DAILY ENERGY ESTIMATE <strong>{floor.energy.toFixed(1)} kWh</strong></span></> : <><span>MODELED PEOPLE <strong>{campusSummary.people}</strong></span><span>DAILY ENERGY ESTIMATE <strong>{campusSummary.energy.toFixed(1)} kWh</strong></span></>}
                </div>
                {index === 0 && <p className="twin-chapter-note">The model currently connects room A-101 to the backend. The remaining rooms use sample occupancy and equipment profiles.</p>}
                {index === 3 && <div className="twin-chapter-actions"><button type="button" className="twin-primary-action" onClick={onEnterRoom}>Inspect {selectedRoom} <ArrowUpRight size={15}/></button><button type="button" className="twin-text-action" onClick={() => onNavigate("simulator")}>Compare an energy scenario <ArrowUpRight size={14}/></button></div>}
              </article>
            );
          })}
        </div>
      </section>

      <div className="twin-data-note"><span><Zap size={14}/>All energy, cost, and savings values are modeled estimates, not meter readings.</span><span><Snowflake size={14}/>Room defaults: {CLASSROOM_CAPACITY} seats · 10 lights · 3 AC units.</span></div>
    </div>
  );
}
