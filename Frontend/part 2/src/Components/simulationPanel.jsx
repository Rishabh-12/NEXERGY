
import { useState } from "react";
import {
  calculateEnergy,
  calculateSavings,
} from "../services/energyCalculations";

export default function SimulationPanel({
  onSimulationChange,
}) {
  const [lightsOn, setLightsOn] = useState(true);
  const [acOn, setAcOn] = useState(true);
  const [acSetpoint, setAcSetpoint] = useState(22);
  const [hours, setHours] = useState(2);

  const baseline = calculateEnergy({
    lightsOn: true,
    acOn: true,
    hours,
  });

  const simulated = calculateEnergy({
    lightsOn,
    acOn,
    hours,
  });

  const savings = calculateSavings({
    baseline,
    simulated,
  });

  function applySimulation() {
    onSimulationChange?.({
      lightsOn,
      acOn,
      acSetpoint,
      hours,
      baselineEnergyKwh: baseline.energyKwh,
      simulatedEnergyKwh: simulated.energyKwh,
      estimatedSavingsKwh: savings.savedKwh,
      estimatedSavingsRupees: savings.savedCost,
      dataMode: "simulated",
    });
  }

  return (
    <section className="space-y-6 rounded-2xl border
      border-slate-700 bg-slate-900 p-6 text-white">

      <div>
        <p className="text-sm text-emerald-400">
          ENERGY OPTIMIZATION
        </p>
        <h2 className="mt-1 text-2xl font-bold">
          What-if Simulator
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Change classroom settings to estimate potential savings.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Classroom lights</p>
          <p className="text-sm text-slate-400">
            Assumed load: 400 W
          </p>
        </div>

        <button
          onClick={() => setLightsOn((v) => !v)}
          className={`rounded-lg px-5 py-2 ${
            lightsOn ? "bg-emerald-600" : "bg-slate-700"
          }`}
        >
          {lightsOn ? "ON" : "OFF"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Air conditioning</p>
          <p className="text-sm text-slate-400">
            Assumed load: 1800 W
          </p>
        </div>

        <button
          onClick={() => setAcOn((v) => !v)}
          className={`rounded-lg px-5 py-2 ${
            acOn ? "bg-emerald-600" : "bg-slate-700"
          }`}
        >
          {acOn ? "ON" : "OFF"}
        </button>
      </div>

      <div>
        <div className="flex justify-between">
          <label htmlFor="setpoint">AC setpoint</label>
          <span>{acSetpoint}°C</span>
        </div>

        <input
          id="setpoint"
          type="range"
          min="18"
          max="28"
          value={acSetpoint}
          onChange={(e) =>
            setAcSetpoint(Number(e.target.value))
          }
          className="mt-3 w-full accent-emerald-500"
        />

        <p className="mt-1 text-xs text-slate-400">
          Setpoint changes are displayed but are not yet
          included in the energy calculation.
        </p>
      </div>

      <div>
        <div className="flex justify-between">
          <label htmlFor="hours">Operating hours</label>
          <span>{hours} hours</span>
        </div>

        <input
          id="hours"
          type="range"
          min="1"
          max="12"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="mt-3 w-full accent-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          title="Baseline"
          value={baseline.energyKwh}
          unit="kWh"
        />

        <Metric
          title="Simulated"
          value={simulated.energyKwh}
          unit="kWh"
        />

        <Metric
          title="Potential savings"
          value={savings.savedKwh}
          unit="kWh"
        />
      </div>

      <div className="rounded-xl bg-slate-800 p-4">
        <p className="text-sm text-slate-400">
          Estimated cost savings
        </p>
        <p className="mt-1 text-2xl font-bold text-emerald-400">
          ₹{savings.savedCost.toFixed(2)}
        </p>
        <p className="text-xs text-slate-400">
          Assumed tariff: ₹8/kWh
        </p>
      </div>

      <button
        onClick={applySimulation}
        className="w-full rounded-xl bg-emerald-500
          px-4 py-3 font-semibold text-slate-950
          hover:bg-emerald-400"
      >
        Apply simulation
      </button>

      <p className="text-xs text-slate-400">
        Illustrative estimates based on assumed equipment ratings,
        not actual electricity meter readings.
      </p>
    </section>
  );
}

function Metric({ title, value, unit }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-xl font-bold">
        {value.toFixed(2)}{" "}
        <span className="text-sm font-normal">{unit}</span>
      </p>
    </div>
  );
}
