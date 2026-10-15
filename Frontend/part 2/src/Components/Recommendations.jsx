
import { useState } from "react";
import { fetchAIRecommendations } from "../services/recommendationsApi";

function generateRecommendations(scenario = {}) {
  const items = [];
  const occupancy = scenario.occupancy ?? 0;
  const lightsOn = scenario.lightsOn ?? true;
  const acOn = scenario.acOn ?? true;
  const setpoint = scenario.acSetpoint ?? 22;
  const savings = scenario.estimatedSavingsKwh ?? 0;
  const savedRupees = scenario.estimatedSavingsRupees ?? 0;

  if (occupancy === 0 && lightsOn) {
    items.push({
      priority: "High priority",
      title: "Switch off lights in an empty classroom",
      reason:
        "The classroom is marked as empty while its lights are on. Turning them off can avoid unnecessary lighting energy use.",
      action: "Turn classroom lights off in the simulator.",
      type: "saving",
    });
  }

  if (occupancy === 0 && acOn) {
    items.push({
      priority: "High priority",
      title: "Review air conditioning in the empty room",
      reason:
        "Cooling an unused room may waste energy. Check room conditions and ventilation requirements before switching the AC off.",
      action: "Test the AC-off scenario and compare estimated usage.",
      type: "saving",
    });
  }

  if (acOn && setpoint < 24) {
    items.push({
      priority: "Medium priority",
      title: "Evaluate a slightly higher AC setpoint",
      reason:
        "A moderate cooling setpoint may reduce cooling demand, depending on weather, occupancy, humidity, and equipment efficiency.",
      action: "Try 24–26°C and compare comfort requirements.",
      type: "efficiency",
    });
  }

  if (savings > 0) {
    items.push({
      priority: "Simulation result",
      title: "Your current scenario reduces estimated energy use",
      reason:
        `The applied settings estimate ${savings.toFixed(2)} kWh less energy use for the selected period.`,
      action:
        `Estimated cost reduction: ₹${savedRupees.toFixed(2)}. Verify with actual meter data when available.`,
      type: "result",
    });
  }

  if (items.length === 0) {
    items.push({
      priority: "Optimization tip",
      title: "Test another energy-saving scenario",
      reason:
        "No specific action was identified by the current rules. Try reducing operating hours or testing lighting and cooling settings.",
      action: "Change a setting and apply the simulation to compare results.",
      type: "efficiency",
    });
  }

  return items;
}

const styles = {
  saving: {
    icon: "⚡",
    accent: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  efficiency: {
    icon: "❄",
    accent: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  },
  result: {
    icon: "✓",
    accent: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  },
};

export default function Recommendations({ scenario }) {
  const [aiItems, setAiItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const localItems = generateRecommendations(scenario);
  const items = aiItems ?? localItems;

  async function requestAI() {
    setLoading(true);
    setError("");

    try {
      const result = await fetchAIRecommendations(scenario);
      setAiItems(result.recommendations);
    } catch {
      setAiItems(null);
      setError(
        "AI service is unavailable. Showing local recommendations instead."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 text-white shadow-xl sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Smart insights
          </p>
          <h2 className="mt-2 text-2xl font-bold">AI recommendations</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Practical actions to reduce unnecessary classroom energy use.
          </p>
        </div>

        <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
          {aiItems ? "AI response" : "Local rules"}
        </span>
      </div>

      <button
        type="button"
        onClick={requestAI}
        disabled={loading}
        className="mt-5 w-full rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 font-semibold text-emerald-300 hover:bg-emerald-400/20 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Generating recommendations..." : "✦ Generate AI Recommendations"}
      </button>

      {error && (
        <p
          role="status"
          className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200"
        >
          {error}
        </p>
      )}

      <div className="mt-5 space-y-4">
        {items.map((item, index) => {
          const type = styles[item.type] ? item.type : "efficiency";
          const style = styles[type];

          return (
            <article
              key={`${item.title}-${index}`}
              className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg ${style.accent}`}
                >
                  {style.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.accent}`}
                  >
                    {item.priority ?? "Recommendation"}
                  </span>

                  <h3 className="mt-2 text-base font-semibold leading-6 text-slate-100">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {item.reason}
                  </p>

                  <div className="mt-3 rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Suggested action
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {item.action ?? item.description ?? "Review this action and verify its impact."}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-500">
        Local recommendations are rule-based suggestions, not verified AI
        output. Energy and cost reductions are estimates from the simulator.
        Follow campus safety, ventilation, and comfort policies.
      </p>
    </section>
  );
}
