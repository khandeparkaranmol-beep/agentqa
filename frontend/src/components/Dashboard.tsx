import type { ScenarioSummary } from "../types";

interface Props {
  scenarios: ScenarioSummary[];
}

const TOPOLOGY_ICONS: Record<string, string> = {
  star: "✦",
  chain: "⟶",
  tree: "⌥",
  mesh: "⬡",
};

export function Dashboard({ scenarios }: Props) {
  const totalScenarios = scenarios.length;
  const totalRuns = scenarios.reduce((s, sc) => s + sc.total_runs, 0);
  const allProps = scenarios.flatMap((sc) => Object.entries(sc.properties));
  const overallPassRate =
    allProps.length > 0
      ? allProps.reduce((s, [, v]) => s + v.pass_rate, 0) / allProps.length
      : 1;

  // Most frequently failing properties
  const propFailures: Record<string, { failures: number; total: number }> = {};
  for (const sc of scenarios) {
    for (const [name, stats] of Object.entries(sc.properties)) {
      if (!propFailures[name]) propFailures[name] = { failures: 0, total: 0 };
      propFailures[name].failures += stats.failures;
      propFailures[name].total += stats.passes + stats.failures;
    }
  }
  const topFailures = Object.entries(propFailures)
    .filter(([, v]) => v.failures > 0)
    .sort((a, b) => b[1].failures - a[1].failures)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Scenarios" value={totalScenarios} />
        <StatCard label="Total Runs" value={totalRuns} />
        <StatCard
          label="Overall Pass Rate"
          value={`${(overallPassRate * 100).toFixed(1)}%`}
          color={overallPassRate >= 1 ? "emerald" : overallPassRate >= 0.8 ? "amber" : "red"}
        />
      </div>

      {/* Top failures */}
      {topFailures.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Most Common Failures</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {topFailures.map(([name, stats]) => {
              const rate = stats.total > 0 ? (stats.failures / stats.total) * 100 : 0;
              return (
                <div key={name} className="px-5 py-3 flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-800 font-mono flex-1">{name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs text-red-500 font-medium w-16 text-right">
                      {stats.failures}/{stats.total} runs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-scenario table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Scenarios</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-2.5 text-xs font-medium text-slate-500">Scenario</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Runs</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Topology</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Properties</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scenarios.map((sc) => {
                const props = Object.values(sc.properties);
                const passRate = props.length > 0 ? props.reduce((s, p) => s + p.pass_rate, 0) / props.length : 1;
                const passing = props.filter((p) => p.pass_rate === 1).length;
                const rateColor = passRate >= 1 ? "text-emerald-600" : passRate >= 0.8 ? "text-amber-600" : "text-red-600";

                return (
                  <tr key={sc.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{sc.name}</td>
                    <td className="px-4 py-3 text-slate-500">{sc.total_runs}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {sc.topology ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-slate-400">{TOPOLOGY_ICONS[sc.topology] ?? "?"}</span>
                          <span className="text-xs">{sc.topology}</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      <span className="text-emerald-600 font-medium">{passing}</span>
                      <span className="text-slate-400">/{props.length} pass</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${passRate >= 1 ? "bg-emerald-400" : passRate >= 0.8 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${passRate * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${rateColor}`}>{(passRate * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "slate" }: { label: string; value: string | number; color?: string }) {
  const valueColor = color === "emerald" ? "text-emerald-600" : color === "amber" ? "text-amber-600" : color === "red" ? "text-red-600" : "text-slate-800";
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-4">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
    </div>
  );
}
