
import {
  Activity,
  Users,
  Zap,
  TrendingDown,
  Lightbulb,
  Snowflake,
  ArrowUpRight,
} from "lucide-react";

export default function Dashboard({ scenario, onNavigate }) {
  const baseline = scenario.baselineEnergyKwh ?? 4.4;
  const simulated = scenario.simulatedEnergyKwh ?? 4.4;
  const savings = scenario.estimatedSavingsKwh ?? 0;
  const cost = scenario.estimatedSavingsRupees ?? 0;

  const stats = [
    {
      label: "Classroom occupancy",
      value: scenario.occupancy ?? 0,
      unit: "people",
      icon: Users,
      color: "blue",
    },
    {
      label: "Baseline energy",
      value: baseline.toFixed(2),
      unit: "kWh",
      icon: Zap,
      color: "amber",
    },
    {
      label: "Simulated energy",
      value: simulated.toFixed(2),
      unit: "kWh",
      icon: Activity,
      color: "blue",
    },
    {
      label: "Potential savings",
      value: savings.toFixed(2),
      unit: "kWh",
      icon: TrendingDown,
      color: "green",
    },
  ];

  return (
    <div className="space-y-7">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">CAMPUS OVERVIEW</p>
          <h1>Good energy starts here.</h1>
          <p className="mt-2 text-slate-400">
            Monitor classroom conditions and explore energy-saving opportunities.
          </p>
        </div>
        <span className="status-pill">
          <span className="status-dot" />
          Simulation preview
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, unit, icon: Icon, color }) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${color}`}>
              <Icon size={21} />
            </div>
            <p className="mt-5 text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-white">
              {value} <span className="text-sm font-medium text-slate-400">{unit}</span>
            </p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="overview-card xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">ROOM STATUS</p>
              <h2 className="mt-2 text-xl font-bold">Classroom A-101</h2>
            </div>
            <span className="status-pill">
              <span className="status-dot" />
              Demo data
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="equipment-card">
              <Lightbulb size={22} />
              <p>Classroom lights</p>
              <strong>{scenario.lightsOn ? "ON" : "OFF"}</strong>
            </div>
            <div className="equipment-card">
              <Snowflake size={22} />
              <p>Air conditioning</p>
              <strong>{scenario.acOn ? "ON" : "OFF"}</strong>
            </div>
            <div className="equipment-card">
              <Users size={22} />
              <p>Occupancy</p>
              <strong>{scenario.occupancy ?? 0} people</strong>
            </div>
          </div>

          <button
            className="primary-action mt-6"
            onClick={() => onNavigate("classroom")}
          >
            Open Digital Classroom <ArrowUpRight size={17} />
          </button>
        </section>

        <section className="overview-card">
          <p className="eyebrow">SAVINGS SUMMARY</p>
          <h2 className="mt-2 text-xl font-bold">Your current scenario</h2>

          <div className="mt-6">
            <p className="text-sm text-slate-400">Estimated energy reduction</p>
            <p className="mt-2 text-4xl font-bold text-emerald-300">
              {savings.toFixed(2)} <span className="text-base">kWh</span>
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Estimated cost reduction: ₹{cost.toFixed(2)}
            </p>
          </div>

          <div className="mt-5 border-t border-slate-700 pt-4">
            <p className="text-sm leading-6 text-slate-400">
              Compare settings in the simulator to estimate how operational
              changes may reduce energy use.
            </p>
            <button
              className="secondary-action mt-4"
              onClick={() => onNavigate("simulator")}
            >
              Open Energy Simulator <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Energy figures are illustrative estimates based on assumed equipment
        ratings. Occupancy and equipment status are demo values until connected
        to live detection and campus data.
      </p>
    </div>
  );
}
