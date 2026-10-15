import { ArrowUpRight, Building2, CircleHelp, Radio, Zap } from "lucide-react";

const rooms = [
  { id: "A-101", label: "Learning studio", state: "active" },
  { id: "A-102", label: "Seminar room", state: "unknown" },
  { id: "A-103", label: "Project lab", state: "unknown" },
  { id: "A-201", label: "Lecture hall", state: "unknown" },
  { id: "A-202", label: "Study commons", state: "unknown" },
  { id: "A-203", label: "Design studio", state: "unknown" },
];

export default function CampusOverview({ backend, settings, onNavigate }) {
  return (
    <section className="campus-panel">
      <div className="section-heading-row"><div><p className="eyebrow">CAMPUS / BUILDING A</p><h2>One room in focus.</h2><p className="section-intro">Explore the building plan. Only A-101 is connected; other rooms have no energy readings yet.</p></div><button type="button" className="text-link" onClick={() => onNavigate("twin")}>Open room twin <ArrowUpRight size={15}/></button></div>
      <div className="campus-content">
        <div className="building-plan" aria-label="Building A room selection map">
          <div className="building-plan-label"><Building2 size={14}/> BUILDING A · FLOOR 01</div>
          <div className="room-grid">{rooms.map((room) => <button type="button" className={`room-cell ${room.state}`} key={room.id} aria-label={`${room.id} ${room.state === "active" ? "connected room" : "energy data unavailable"}`} onClick={() => room.state === "active" && onNavigate("twin")} disabled={room.state !== "active"}><span>{room.id}</span><small>{room.label}</small>{room.state === "active" ? <Zap size={14}/> : <CircleHelp size={14}/>}</button>)}</div>
          <div className="plan-axis"><span>N ↑</span><span>26 m</span><span>LEARNING WING</span></div>
        </div>
        <div className="campus-room-detail"><div className="room-detail-top"><span className="detail-room-index">01</span><span className="tiny-badge">A-101 · CONNECTED</span></div><div className="room-detail-title"><h3>Learning studio</h3><p>North wing · Floor 01</p></div><div className="detail-readings"><div><span>Occupancy</span><strong>{settings.occupancy}<small> people</small></strong></div><div><span>Energy view</span><strong>Estimated</strong></div><div><span>Room state</span><strong>{backend?.status === "online" ? "Connected" : "Offline"}</strong></div></div><div className="heatmap-legend"><p>ENERGY STATUS OVERLAY</p><span><i className="legend-connected"/>Connected room</span><span><i className="legend-unknown"/>Data unavailable</span><span><Radio size={12}/>No room-level meter readings</span></div></div>
      </div>
    </section>
  );
}
