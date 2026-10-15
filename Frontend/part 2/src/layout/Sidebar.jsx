import {
  LayoutDashboard,
  Building2,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Leaf,
  Camera,
  Sun,
  Moon,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "twin", label: "Digital Twin", icon: Building2 },
  { id: "camera", label: "Live AI Camera", icon: Camera },
  { id: "simulator", label: "Energy Simulator", icon: SlidersHorizontal },
  { id: "recommendations", label: "AI Recommendations", icon: Sparkles },
];

const statusText = {
  checking: "Connecting to backend…",
  online: "Backend connected",
  offline: "Backend offline · local estimates",
};

export default function Sidebar({ activePage, onNavigate, backendStatus, theme = "light", onToggleTheme }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Zap size={23} />
        </div>
        <div>
          <h2>
            Nex<span>Energy</span>
          </h2>
          <p>ENERGY OPTIMIZER</p>
        </div>
        <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} aria-pressed={theme === "dark"} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          {theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}
        </button>
      </div>

      <p className="nav-heading">WORKSPACE</p>

      <nav className="sidebar-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${activePage === id ? "active" : ""}`}
            onClick={() => onNavigate(id)}
          >
            <span className="ico">
              <Icon size={18} />
            </span>
            <span>{label}</span>
            {activePage === id && <span className="active-dot" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="leaf">
          <Leaf size={23} />
        </div>
        <h3>Smarter spaces.</h3>
        <p>Less energy waste. Better campuses.</p>
        <div className="sidebar-status">
          <span className={backendStatus} />
          {statusText[backendStatus] ?? statusText.checking}
        </div>
      </div>
    </aside>
  );
}
