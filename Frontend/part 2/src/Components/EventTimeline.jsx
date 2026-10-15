import { Activity, AlertTriangle, CheckCircle2, CircleOff, History, Users, Zap } from "lucide-react";

const icons = { room: Users, alert: AlertTriangle, simulation: Zap, connection: Activity, offline: CircleOff, local: History };

export default function EventTimeline({ events = [] }) {
  return (
    <section className="timeline-panel">
      <div className="section-heading-row timeline-heading"><div><p className="eyebrow">ROOM ACTIVITY</p><h2>System timeline</h2></div><span className="timeline-tag"><Activity size={12}/> RECENT EVENTS</span></div>
      {events.length ? <ol className="event-list">{events.map((event) => { const Icon = icons[event.kind] || CheckCircle2; return <li key={event.id} className={`event-item event-${event.kind}`}><span className="event-icon"><Icon size={15}/></span><div className="event-copy"><strong>{event.title}</strong><p>{event.detail}</p><span>{event.source} · {event.time}</span></div></li>; })}</ol> : <div className="timeline-empty"><span className="timeline-empty-mark"><Activity size={16}/></span><p>No activity recorded yet.</p><small>Room updates and completed simulations will appear here.</small></div>}
      <p className="timeline-footnote">Events are logged by this interface when state changes are observed. Camera-originated events are labelled only when the backend identifies them.</p>
    </section>
  );
}
