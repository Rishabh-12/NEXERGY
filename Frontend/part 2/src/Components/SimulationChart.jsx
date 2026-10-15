
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

export default function SimulationChart({
  baselineKwh = 4.4,
  simulatedKwh = 4.4,
}) {
  const baseline = Number(baselineKwh) || 0;
  const simulated = Number(simulatedKwh) || 0;
  const saved = Math.max(0, baseline - simulated);
  const percentSaved = baseline > 0 ? (saved / baseline) * 100 : 0;

  const data = [
    { name: "Before optimization", energy: baseline, color: "#64748b" },
    { name: "After optimization", energy: simulated, color: "#34d399" },
  ];

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 text-white shadow-xl sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Energy analytics
          </p>
          <h2 className="mt-2 text-2xl font-bold">Energy comparison</h2>
          <p className="mt-2 text-sm text-slate-400">
            Compare estimated energy consumption before and after your changes.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
          <p className="text-xs text-emerald-300">Potential reduction</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">
            {percentSaved.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4">
          <p className="text-sm text-slate-400">Baseline</p>
          <p className="mt-2 text-2xl font-bold">
            {baseline.toFixed(2)}{" "}
            <span className="text-sm font-medium text-slate-400">kWh</span>
          </p>
        </div>

        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
          <p className="text-sm text-slate-400">Simulated</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">
            {simulated.toFixed(2)}{" "}
            <span className="text-sm font-medium text-slate-400">kWh</span>
          </p>
        </div>
      </div>

      <div className="mt-6 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 24, right: 12, left: 0, bottom: 8 }}
            barCategoryGap="38%"
          >
            <CartesianGrid
              vertical={false}
              stroke="#334155"
              strokeDasharray="4 5"
              opacity={0.65}
            />

            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#cbd5e1", fontSize: 12 }}
              interval={0}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickFormatter={(value) => `${value}`}
              width={38}
              domain={[0, (max) => Math.max(1, Math.ceil(max * 1.2))]}
            />

            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "12px",
                color: "#f8fafc",
                padding: "12px",
              }}
              formatter={(value) => [
                `${Number(value).toFixed(2)} kWh`,
                "Estimated energy",
              ]}
              labelStyle={{ color: "#cbd5e1", marginBottom: "5px" }}
            />

            <Bar
              dataKey="energy"
              name="Energy consumption"
              radius={[8, 8, 0, 0]}
              maxBarSize={100}
              isAnimationActive={true}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
              <LabelList
                dataKey="energy"
                position="top"
                formatter={(value) => `${Number(value).toFixed(2)} kWh`}
                fill="#e2e8f0"
                fontSize={12}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-slate-500" />
          Before optimization
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-400" />
          After optimization
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
        <p className="text-sm text-slate-300">
          {saved > 0
            ? `Your current simulation estimates a reduction of ${saved.toFixed(2)} kWh for the selected period.`
            : "No energy reduction is shown in the current simulation. Try changing the classroom settings."}
        </p>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Illustrative estimates based on assumed equipment power ratings, not
        actual electricity meter readings. Results depend on real equipment
        and operating conditions.
      </p>
    </section>
  );
}
