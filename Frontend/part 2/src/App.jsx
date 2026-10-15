
import { useState } from "react";
import SimulationPanel from "./Components/simulationPanel";
import Recommendations from "./Components/Recommendations";
import SimulationChart from "./Components/SimulationChart";
import Sidebar from "./layout/Sidebar";
import Dashboard from "./Components/Dashboard";

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [scenario, setScenario] = useState({
    occupancy: 0,
    lightsOn: true,
    acOn: true,
    acSetpoint: 22,
    hours: 2,
    estimatedSavingsKwh: 0,
    estimatedSavingsRupees: 0,
  });

  function handleSimulationChange(results) {
    setScenario((previous) => ({
      ...previous,
      ...results,
    }));
  }

return (
  <>
    <Sidebar
      activePage={activePage}
      onNavigate={setActivePage}
    />

    <main className="min-h-screen">
    <header className="mb-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-2xl">
            ⚡
          </div>
          <div>
            <p className="text-sm font-bold tracking-widest text-emerald-400">
              SMART CAMPUS
            </p>
            <p className="text-xs text-slate-400">ENERGY OPTIMIZER</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
          ● Simulation mode
        </span>
      </div>

      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Energy management platform
      </p>
      <h1 className="text-4xl font-bold text-white">
        Energy Optimization Center
      </h1>
      <p className="mt-3 max-w-2xl text-slate-400">
        Explore classroom energy usage, simulate smarter settings, and discover
        opportunities to reduce estimated costs.
      </p>
    </header>

    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
        <p className="text-sm text-slate-400">Baseline energy</p>
        <p className="mt-3 text-3xl font-bold text-white">
          {(scenario.baselineEnergyKwh ?? 4.4).toFixed(2)}{" "}
          <span className="text-sm font-medium text-slate-400">kWh</span>
        </p>
        <p className="mt-2 text-xs text-slate-500">Before changes</p>
      </div>

      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
        <p className="text-sm text-slate-400">Simulated energy</p>
        <p className="mt-3 text-3xl font-bold text-white">
          {(scenario.simulatedEnergyKwh ?? 4.4).toFixed(2)}{" "}
          <span className="text-sm font-medium text-slate-400">kWh</span>
        </p>
        <p className="mt-2 text-xs text-slate-500">After changes are applied</p>
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
        <p className="text-sm text-emerald-300">Potential savings</p>
        <p className="mt-3 text-3xl font-bold text-emerald-300">
          {(scenario.estimatedSavingsKwh ?? 0).toFixed(2)}{" "}
          <span className="text-sm font-medium">kWh</span>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          ₹{(scenario.estimatedSavingsRupees ?? 0).toFixed(2)} estimated cost savings
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <SimulationPanel onSimulationChange={handleSimulationChange} />
      <Recommendations scenario={scenario} />
    </div>

    <div className="mt-6">
      <SimulationChart
        baselineKwh={scenario.baselineEnergyKwh ?? 4.4}
        simulatedKwh={scenario.simulatedEnergyKwh ?? 4.4}
      />
    </div>

    <footer className="mt-8 border-t border-slate-800 pt-5 text-xs leading-6 text-slate-500">
      Smart Campus Energy Optimizer · Energy values are estimates based on
      assumed equipment ratings, not actual meter readings. Potential savings
      are illustrative and depend on real equipment and usage.
    </footer>
        </main>
      </>
    );
}