import { useState } from "react";
import { Sparkles, Zap, Snowflake, Gauge, Check, Bot, CalendarDays, TrendingDown, Leaf, IndianRupee } from "lucide-react";
import PageHeader from "./PageHeader";
import { fetchRecommendations, fetchAiInsight } from "../services/api";

const PRIORITY_LABELS = {
  high: "HIGH PRIORITY",
  medium: "MEDIUM PRIORITY",
  result: "SIMULATION RESULT",
  tip: "OPTIMIZATION TIP",
};

const ICONS = {
  lights: Zap,
  cooling: Snowflake,
  setpoint: Gauge,
  result: Check,
  tip: Sparkles,
};

// Local, rule-based fallback. The backend /api/recommendations endpoint applies
// the same rules, so results are consistent whether or not the API is reachable.
function localRecommendations({ settings, applied }) {
  const items = [];
  const { occupancy, lightsOn, acOn, setpoint } = settings;

  if (occupancy === 0 && lightsOn) {
    items.push({
      priority: "high",
      icon: "lights",
      title: "Switch off lights in an empty classroom",
      reason:
        "The room is marked empty while the lights are on. Turning them off may avoid unnecessary lighting energy use.",
      action: "Turn classroom lights off in the simulator.",
    });
  }
  if (occupancy === 0 && acOn) {
    items.push({
      priority: "high",
      icon: "cooling",
      title: "Review air conditioning in the empty room",
      reason:
        "Cooling an unused room may waste energy. Check ventilation and room conditions first.",
      action: "Test the AC-off scenario and compare estimated usage.",
    });
  }
  if (acOn && setpoint < 24) {
    items.push({
      priority: "medium",
      icon: "setpoint",
      title: "Evaluate a higher AC setpoint",
      reason:
        "A moderate setpoint may reduce cooling demand depending on weather, humidity, occupancy and equipment efficiency.",
      action: "Try 24–26°C and compare comfort requirements.",
    });
  }
  if (applied.savings > 0) {
    items.push({
      priority: "result",
      icon: "result",
      title: "Your scenario reduces estimated energy use",
      reason: `The applied settings estimate ${applied.savings.toFixed(2)} kWh less energy for the selected period.`,
      action: `Estimated cost reduction: ₹${applied.cost.toFixed(2)}. Verify with meter data when available.`,
    });
  }
  if (items.length === 0) {
    items.push({
      priority: "tip",
      icon: "tip",
      title: "Test another energy-saving scenario",
      reason:
        "No specific action was identified by the current rules. Try reducing operating hours or testing equipment settings.",
      action: "Change a setting and apply the simulation.",
    });
  }
  return items;
}

export default function Recommendations({ settings, applied, baseline, simulated, backend }) {
  const scenarioKey = JSON.stringify([settings, applied.savings, applied.cost, backend?.energyWasteAlert]);
  const [remote, setRemote] = useState(null); // { key, items }
  const [aiInsight, setAiInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  // Backend results are only shown while they still match the current scenario.
  const remoteItems = remote && remote.key === scenarioKey ? remote.items : null;
  const items = remoteItems ?? localRecommendations({ settings, applied });
  const currentInsight = aiInsight?.key === scenarioKey ? aiInsight : null;
  const monthlyBaseline = Math.max(0, Number(baseline) || 0) * 30;
  const monthlyScenario = Math.max(0, Number(simulated) || 0) * 30;
  const monthlySaved = Math.max(0, monthlyBaseline - monthlyScenario);
  const monthlyCost = monthlyScenario * 8;
  const monthlyCarbon = monthlySaved * 0.82;

  async function generate() {
    setLoading(true);
    setNotice("");
    try {
      const [recResult, insightResult] = await Promise.allSettled([
        fetchRecommendations({ settings, applied, baseline, simulated }),
        fetchAiInsight({
          totalEnergyKwh: simulated,
          totalDailyCost: applied.cost > 0 ? applied.cost : simulated * 8,
          peopleCount: settings.occupancy,
          energyWasteAlert: backend?.energyWasteAlert,
          lightsOn: settings.lightsOn,
          acOn: settings.acOn,
          setpoint: settings.setpoint,
          hours: settings.hours,
        }),
      ]);

      if (recResult.status === "fulfilled") {
        setRemote({ key: scenarioKey, items: recResult.value.recommendations });
      } else {
        setRemote(null);
        setNotice("Showing local rule-based recommendations.");
      }

      if (insightResult.status === "fulfilled" && insightResult.value?.ai_insight) {
        const source = insightResult.value.source || "rules";
        setAiInsight({
          key: scenarioKey,
          text: insightResult.value.ai_insight,
          source,
          model: insightResult.value.model || (source === "gemini" ? "Gemini" : "Not used"),
          visionContext: insightResult.value.vision_context,
        });
      }
    } catch {
      setRemote(null);
      setNotice("Backend unavailable. Showing local rule-based recommendations instead.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page active">
      <PageHeader
        eyebrow="SMART INSIGHTS"
        title="AI Recommendations"
        subtitle="Review explainable suggestions based on available room state, energy estimates, and the backend insight service."
        pill={currentInsight ? (currentInsight.source === "gemini" ? "Gemini insight" : "Backend fallback") : (remoteItems ? "Backend rules" : "Local rules")}
      />

      <section className="panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">ENERGY EFFICIENCY & VISION TELEMETRY</p>
            <h2>Recommended actions</h2>
            <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 11 }}>
              Recommendations use the current scenario and may come from the backend rules or its configured AI provider.
            </p>
          </div>
          <span className="tiny-badge">{backend?.status === "online" ? "Live room context" : "Local context"}</span>
        </div>

        <div className="recommendation-context" aria-label="Current room context">
          <article><span>Room occupancy</span><strong>{settings.occupancy}</strong><small>{settings.occupancy === 1 ? "person" : "people"} · {backend?.status === "online" ? "connected" : "local preview"}</small></article>
          <article><span>Estimated energy</span><strong>{simulated.toFixed(2)} kWh</strong><small>for the selected period</small></article>
          <article><span>Cooling setpoint</span><strong>{settings.setpoint}°C</strong><small>comfort and efficiency</small></article>
          <article><span>Scenario savings</span><strong>{applied.savings.toFixed(2)} kWh</strong><small>estimated vs. baseline</small></article>
        </div>

        <button
          type="button"
          className="primary action recommendations-generate"
          disabled={loading}
          onClick={generate}
        >
          <Sparkles size={15} />
          {loading ? "Analyzing with Gemini AI…" : "Generate AI Recommendations"}
        </button>

        {notice && <p className="ai-message">{notice}</p>}

        {currentInsight && (
          <article className="rec-item rec-ai-item">
            <div className="rec-top" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="rec-icon rec-ai-icon">
                  <Bot size={18} />
                </div>
                <span className="priority rec-ai-priority">
                  {currentInsight.source === "gemini" ? "GOOGLE GEMINI AI INSIGHT" : "BACKEND RULE-BASED INSIGHT"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span className="tiny-badge rec-ai-meta">
                  Model: {currentInsight.model}
                </span>
                <span className="tiny-badge rec-ai-vision">
                  Vision: {currentInsight.visionContext?.people_count ?? settings.occupancy} people
                </span>
                {(currentInsight.visionContext?.energy_waste_alert || backend?.energyWasteAlert) && (
                  <span className="tiny-badge rec-ai-alert">
                    Waste Alert Active
                  </span>
                )}
              </div>
            </div>
            <h3 className="rec-ai-title">Live Camera & Energy Optimization Strategy</h3>
            <p className="rec-ai-copy">{currentInsight.text}</p>
            <div className="action-box">
                <strong>{currentInsight.source === "gemini" ? "GEMINI INSIGHT SOURCE" : "BACKEND FALLBACK SOURCE"}</strong>
                {currentInsight.source === "gemini" ? "Generated by the configured Gemini service from the data supplied to the backend." : "Generated by the backend fallback from the available room and scenario state."}
            </div>
            <section className="monthly-report" aria-label="30-day estimated energy report">
              <div className="monthly-report-heading">
                <span className="monthly-report-icon"><CalendarDays size={17}/></span>
                <div><p className="eyebrow">AI SUMMARY · SCENARIO OUTLOOK</p><h4>30-day energy report</h4></div>
                <span className="monthly-report-tag">Estimated</span>
              </div>
              <div className="monthly-report-grid">
                <article><span>Baseline run-rate</span><strong>{monthlyBaseline.toFixed(1)} <small>kWh</small></strong><i>Current settings × 30 days</i></article>
                <article><span>Scenario run-rate</span><strong>{monthlyScenario.toFixed(1)} <small>kWh</small></strong><i>Applied scenario × 30 days</i></article>
                <article className="monthly-report-saving"><span><TrendingDown size={13}/> Potential energy saved</span><strong>{monthlySaved.toFixed(1)} <small>kWh</small></strong><i>Compared with baseline</i></article>
                <article><span><IndianRupee size={13}/> Estimated cost</span><strong>₹{monthlyCost.toFixed(0)}</strong><i>At ₹8 per kWh</i></article>
              </div>
              <div className="monthly-report-foot"><span><Leaf size={13}/> Up to {monthlyCarbon.toFixed(1)} kg CO₂ avoided at 0.82 kg/kWh</span><span>Run-rate projection, not historical meter data</span></div>
              <p>Assumes today’s occupancy, equipment controls, and configured hours repeat each day. Actual energy, cost, and emissions may differ.</p>
            </section>
          </article>
        )}

        <div className="recommendation-list">
          {items.map((item, index) => {
            const Icon = ICONS[item.icon] ?? Sparkles;
            return (
              <article className="rec-item" key={`${item.title}-${index}`}>
                <div className="rec-top">
                  <div className="rec-icon">
                    <Icon size={18} />
                  </div>
                  <span className="priority">
                    {PRIORITY_LABELS[item.priority] ?? "RECOMMENDATION"}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.reason}</p>
                <div className="action-box">
                  <strong>SUGGESTED ACTION</strong>
                  {item.action}
                </div>
              </article>
            );
          })}
        </div>

        <p className="footnote">
          Recommendations are rule-based suggestions, not verified AI output. Energy
          and cost reductions are estimates. Follow campus safety, ventilation, and
          comfort policies.
        </p>
      </section>
    </section>
  );
}
