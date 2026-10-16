import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Lightbulb, Minus, Plus, Snowflake, Users, Zap } from "lucide-react";
import PageHeader from "./PageHeader";
import { CLASSROOM_CAPACITY } from "../services/energyCalculations";
import { FLOORS, getRoomSnapshot } from "./campusData";
import DigitalTwinJourney from "./DigitalTwinJourney";

const allOn = (length, enabled) => Array.from({ length }, () => enabled);

export default function DigitalClassroom({ settings, backend, onOccupancyChange, roomEquipmentByRoom, roomOccupancy, onSampleOccupancyChange, onRoomEquipmentChange, selectedRoom, onSelectRoom, onNavigate }) {
  const [viewingRoomId, setViewingRoomId] = useState(null);
  const [setpoints, setSetpoints] = useState({});
  const snapshot = getRoomSnapshot(selectedRoom, settings, roomEquipmentByRoom?.[selectedRoom], roomOccupancy?.[selectedRoom]);
  const roomEquipment = roomEquipmentByRoom?.[selectedRoom];
  const lights = roomEquipment?.lights ?? allOn(10, snapshot.lightsOn);
  const acs = roomEquipment?.acs ?? allOn(3, snapshot.acOn);
  const occupancy = snapshot.occupancy;
  const setpoint = setpoints[selectedRoom] ?? settings.setpoint ?? 22;
  const activeFloor = FLOORS.find((floor) => floor.rooms.some((room) => room.id === selectedRoom));
  const watts = lights.filter(Boolean).length * 40 + acs.filter(Boolean).length * 600;
  const connected = snapshot.connected && backend.status === "online";

  const roomView = viewingRoomId === selectedRoom;
  const roomLabel = useMemo(() => `${activeFloor?.label ?? "Campus"} · ${snapshot.name}`, [activeFloor, snapshot.name]);
  const toggleLight = (index) => {
    const next = lights.map((on, i) => i === index ? !on : on);
    onRoomEquipmentChange(selectedRoom, { lights: next });
  };
  const toggleAc = (index) => {
    const next = acs.map((on, i) => i === index ? !on : on);
    onRoomEquipmentChange(selectedRoom, { acs: next });
  };
  const setPeople = (next) => {
    const count = Math.max(0, Math.min(CLASSROOM_CAPACITY, next));
    if (snapshot.connected) onOccupancyChange(count);
    else onSampleOccupancyChange(selectedRoom, count);
  };

  return (
    <section className="page active">
      {!roomView ? (
        <DigitalTwinJourney
          settings={settings}
          backend={backend}
          roomEquipment={roomEquipmentByRoom}
          roomOccupancy={roomOccupancy}
          selectedRoom={selectedRoom}
          onSelectRoom={onSelectRoom}
          onEnterRoom={() => setViewingRoomId(selectedRoom)}
          onNavigate={onNavigate}
        />
      ) : (
        <>
          <PageHeader eyebrow="DIGITAL TWIN / ROOM INSPECTION" title={snapshot.name} subtitle="Inspect the selected room model, occupancy, and assumed equipment load." pill={connected ? "Connected room state" : "Illustrative room model"} />
          <div className="twin-room-transition">
            <div className="twin-room-toolbar">
              <button type="button" className="secondary action" onClick={() => setViewingRoomId(null)}><ArrowLeft size={15}/> Back to building</button>
              <div><span className="eyebrow">BUILDING A · ROOM {selectedRoom}</span><h2>{roomLabel}</h2></div>
              <span className={`room-connection-tag ${connected ? "is-connected" : ""}`}>{connected ? "LIVE OCCUPANCY" : "ESTIMATE ONLY"}</span>
            </div>
            <section className="classroom-scene-card twin-interior-card">
              <div className="scene-topbar"><div><p className="eyebrow">ILLUSTRATIVE DIGITAL TWIN</p><h3>{snapshot.name}</h3></div><div className="scene-state-list"><span className={`scene-state ${lights.some(Boolean) ? "on" : "off"}`}><Lightbulb size={12}/>Lights {lights.filter(Boolean).length}/10</span><span className={`scene-state ${acs.some(Boolean) ? "on" : "off"}`}><Snowflake size={12}/>AC {acs.filter(Boolean).length}/3</span></div></div>
              <div className={`classroom-scene twin-interior ${lights.some(Boolean) ? "" : "lights-off"}`}>
              <div className="twin-wall-panel">
                <div className="twin-ceiling-array"><span>CEILING ARRAY · 10 FIXTURES</span><div>{lights.map((on, index) => <button type="button" key={index} title={`Toggle ceiling light ${index + 1}`} aria-label={`Toggle ceiling light ${index + 1}`} aria-pressed={on} className={`twin-light-unit ${on ? "is-on" : ""}`} onClick={() => toggleLight(index)} />)}</div></div>
                <div className="twin-wall-devices">
                  <div className="twin-ac-array"><span>CLIMATE · 3 INDEPENDENT UNITS</span><div>{acs.map((on, index) => <button type="button" key={index} aria-pressed={on} className={`twin-ac-unit ${on ? "is-on" : ""}`} onClick={() => toggleAc(index)}><Snowflake size={17}/><strong>AC {index + 1}</strong><small>{on ? `${setpoint}°C · ON` : "STANDBY"}</small></button>)}</div></div>
                  <div className="twin-board"><span>SMART LEARNING ZONE</span><small>ENERGY-AWARE ROOM MODEL</small></div>
                  <div className="twin-temp-control"><span>TARGET TEMP</span><strong>{setpoint}°C</strong><div><button type="button" aria-label="Increase target temperature" onClick={() => setSetpoints((current) => ({ ...current, [selectedRoom]: Math.min(30, setpoint + 1) }))}><Plus size={12}/></button><button type="button" aria-label="Decrease target temperature" onClick={() => setSetpoints((current) => ({ ...current, [selectedRoom]: Math.max(16, setpoint - 1) }))}><Minus size={12}/></button></div></div>
                </div>
              </div>
              <div className="twin-seating-head"><div><span>SEATING PLAN</span><small>Tap a desk to change its simulated occupancy</small></div><strong>{occupancy} <small>/ {CLASSROOM_CAPACITY} occupied</small></strong></div>
              <div className="twin-seat-grid">{Array.from({ length: CLASSROOM_CAPACITY }, (_, index) => { const occupied = index < occupancy; return <button type="button" key={index} aria-pressed={occupied} className={`twin-seat ${occupied ? "is-occupied" : ""}`} onClick={() => setPeople(occupied ? occupancy - 1 : occupancy + 1)}><Users size={15}/><strong>DESK {String(index + 1).padStart(2, "0")}</strong><small>{occupied ? "OCCUPIED" : "VACANT"}</small></button>; })}</div>
              <div className="twin-room-footer"><span><Building2 size={13}/>Illustrative room model · occupancy {connected ? "from connected room state" : "sample estimate"}</span><span><Zap size={13}/>{watts} W assumed load · energy is estimated, not metered</span></div>
              </div>
            </section>
            <p className="footnote">Room equipment uses illustrative ratings of 40 W per light and 600 W per AC unit. The connected A-101 master controls stay synchronized with the existing app state; other rooms remain local sample scenarios.</p>
          </div>
        </>
      )}
    </section>
  );
}
