export default function PageHeader({ eyebrow, title, subtitle, pill = "Simulation preview" }) {
  return (
    <header className="heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="sub">{subtitle}</p>
      </div>
      <span className="status-pill">
        <span className="status-dot" />
        {pill}
      </span>
    </header>
  );
}
