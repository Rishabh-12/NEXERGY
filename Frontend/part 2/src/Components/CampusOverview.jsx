import { ArrowUpRight, Building2, CircleHelp, Radio, Snowflake, Users, Zap } from "lucide-react";
import { FLOORS, getRoomSnapshot } from "./campusData";

const PROFILE = [0.35, 0.58, 0.78, 1, 0.9, 0.7, 0.48, 0.21];
const PERIODS = ["08", "09", "10", "11", "12", "13", "14", "15"];

export default function CampusOverview({ backend, settings, roomEquipment, roomOccupancy, onNavigate, selectedRoom = "A-101", onSelectRoom, variant = "overview" }) {
  const activeFloor = Number(selectedRoom.split("-")[1]?.[0]) || 1;
  const room = getRoomSnapshot(selectedRoom, settings, roomEquipment?.[selectedRoom], roomOccupancy?.[selectedRoom]);
  const connected = room.connected;
  const energy = room.energyKwh;
  const occupancy = room.occupancy;
  const campusRooms = FLOORS.flatMap((floor) => floor.rooms);
  const campusOccupancy = campusRooms.reduce((sum, item) => sum + getRoomSnapshot(item.id, settings, roomEquipment?.[item.id], roomOccupancy?.[item.id]).occupancy, 0);
  const campusEnergy = campusRooms.reduce((sum, item) => sum + getRoomSnapshot(item.id, settings, roomEquipment?.[item.id], roomOccupancy?.[item.id]).energyKwh, 0);
  const energyBars = PROFILE.map((weight) => energy * weight / PROFILE.reduce((sum, value) => sum + value, 0));

  function chooseFloor(nextFloor) {
    if (!nextFloor.rooms.some((item) => item.id === selectedRoom)) onSelectRoom?.(nextFloor.rooms[0].id);
  }

  return (
    <section className={`campus-panel building-twin-panel ${variant === "twin" ? "is-expanded" : ""}`}>
      <div className="section-heading-row building-heading">
        <div><p className="eyebrow">DIGITAL TWIN / BUILDING A</p><h2>Explore the building.</h2><p className="section-intro">Choose a floor, then any room. Every room shows a transparent daily energy estimate.</p></div>
        {onNavigate && <button type="button" className="text-link" onClick={() => onNavigate("twin")}>Full building view <ArrowUpRight size={15}/></button>}
      </div>

      <div className="building-summary" aria-label="Building overview metrics">
        <span><Users size={14}/><strong>{campusOccupancy}</strong> estimated people</span>
        <span><Zap size={14}/><strong>{campusEnergy.toFixed(1)} kWh</strong> estimated daily load</span>
        <span><Building2 size={14}/><strong>9 rooms</strong> across 3 floors</span>
      </div>

      <div className="building-floor-tabs" role="tablist" aria-label="Building floors">
        {FLOORS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={activeFloor === item.id} className={activeFloor === item.id ? "selected" : ""} onClick={() => chooseFloor(item)}><span>0{item.id}</span>{item.label}</button>)}
      </div>

      <div className="campus-content building-content">
        <div className="building-visual-wrap">
          <div className="building-visual" aria-label="Three floor building room selector">
            <div className="building-visual-label"><Building2 size={14}/> NEXERGY CAMPUS · BUILDING A</div>
            <div className="building-stack">
              {[...FLOORS].reverse().map((item) => (
                <div className={`building-level-card ${item.id === activeFloor ? "floor-active" : ""}`} key={item.id}>
                  <button type="button" className="floor-level-label" onClick={() => chooseFloor(item)} aria-label={`Select ${item.label}`}><span>0{item.id}</span><small>{item.label}</small></button>
                  <div className="floor-room-strip">
                    {item.rooms.map((unit) => (
                      <button type="button" key={unit.id} aria-pressed={unit.id === selectedRoom} className={`floor-room ${unit.id === selectedRoom ? "room-selected" : ""} ${unit.id === "A-101" ? "room-connected" : ""}`} onClick={() => onSelectRoom?.(unit.id)}>
                        <span className="room-window"/><strong>{unit.id}</strong><small>{unit.name}</small><small className="room-occupancy-label">{getRoomSnapshot(unit.id, settings, roomEquipment?.[unit.id], roomOccupancy?.[unit.id]).occupancy} people</small>
                        {unit.id === "A-101" && <i aria-label="Connected"/>}
                      </button>
                    ))}
                  </div>
                  <span className="floor-energy-mark"><Zap size={11}/>{item.rooms.reduce((sum, unit) => sum + getRoomSnapshot(unit.id, settings, roomEquipment?.[unit.id], roomOccupancy?.[unit.id]).energyKwh, 0).toFixed(1)} <small>kWh est.</small></span>
                </div>
              ))}
            </div>
            <div className="building-ground-line"><span>ENTRY / NORTH WING</span><span>09 SPACES · 03 LEVELS</span></div>
          </div>
          <div className="building-map-legend"><span><i className="legend-live"/>Live occupancy signal</span><span><i className="legend-estimate"/>Energy estimate</span></div>
        </div>

        <aside className="selected-room-panel" aria-live="polite">
          <div className="room-detail-top"><span className="detail-room-index">0{activeFloor}</span><span className={`room-connection-tag ${connected ? "is-connected" : ""}`}>{connected ? <><Radio size={11}/> CV CONNECTED</> : <><CircleHelp size={11}/> ESTIMATE ONLY</>}</span></div>
          <div className="room-detail-title"><span>SELECTED SPACE / {room.id}</span><h3>{room.name}</h3><p>Building A · {FLOORS.find((item) => item.id === activeFloor)?.label}</p></div>
          <div className="room-energy-value"><strong>{energy.toFixed(2)}</strong><span>kWh <small>/ estimated day</small></span></div>
          <div className="room-energy-chart" role="img" aria-label={`Estimated energy use across eight periods for room ${room.id}`}>
            {energyBars.map((value, index) => <div className="room-energy-column" key={PERIODS[index]}><span className="room-energy-bar" style={{ "--bar-height": `${Math.max(5, value / Math.max(...energyBars, 0.01) * 100)}%`, "--bar-delay": `${index * 45}ms` }}/><small>{PERIODS[index]}</small></div>)}
          </div>
          <div className="room-energy-axis"><span>08:00</span><span>ENERGY PROFILE · ESTIMATE</span><span>16:00</span></div>
          <div className="room-reading-list">
            <div><span><Users size={13}/>Occupancy</span><strong>{occupancy} <small>people</small></strong></div>
            <div><span><Zap size={13}/>Room type</span><strong>{room.kind}</strong></div>
            <div><span><Snowflake size={13}/>Data source</span><strong>{connected && backend?.status === "online" ? "Live people count · model energy" : "Planning estimate"}</strong></div>
          </div>
          {!connected && <p className="room-estimate-note">This room has no live camera or meter connection. Energy and occupancy are sample estimates for the preview.</p>}
          {connected && <p className="room-estimate-note">People count can be live. Energy is estimated from assumed equipment loads; it is not a meter reading.</p>}
        </aside>
      </div>
    </section>
  );
}
