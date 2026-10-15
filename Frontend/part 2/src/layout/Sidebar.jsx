
import {
  LayoutDashboard,
  Building2,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Leaf,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "classroom", label: "Digital Classroom", icon: Building2 },
  { id: "simulator", label: "Energy Simulator", icon: SlidersHorizontal },
  { id: "recommendations", label: "AI Recommendations", icon: Sparkles },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Zap size={23} />
        </div>
        <div>
          <h2>Campus<span>IQ</span></h2>
          <p>ENERGY OPTIMIZER</p>
        </div>
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
            <Icon size={19} />
            <span>{label}</span>
            {activePage === id && <span className="active-dot" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="eco-icon"><Leaf size={20} /></div>
        <h3>Smarter spaces.</h3>
        <p>Less energy waste. Better campuses.</p>
        <div className="sidebar-status">
          <span />
          Frontend preview
        </div>
      </div>
    </aside>
  );
}
