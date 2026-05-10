import { useState, type ReactNode } from "react";
import type { ScenarioSummary } from "../types";
import { InfoTip } from "./InfoTip";

interface Props {
  scenarios: ScenarioSummary[];
}

const TOPOLOGY_ICONS: Record<string, string> = {
  star: "✦",
  chain: "⟶",
  tree: "⌥",
  mesh: "⬡",
};

/* ── SVG icons for stat cards ── */

function ScenariosIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="6" rx="1.5" />
      <rect x="4" y="10" width="16" height="6" rx="1.5" opacity="0.6" />
      <rect x="4" y="18" width="16" height="4" rx="1.5" opacity="0.3" />
    </svg>
  );
}

function RunsIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="6,4 20,12 6,20" fill="currentColor" opacity="0.15" />
      <polygon points="6,4 20,12 6,20" />
      <path d="M20 4 C22 6, 22 18, 20 20" opacity="0.5" />
    </svg>
  );
}

function PassRateIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L12 5" />
      <path d="M12 2 C7 2 3 6.5 3 12 C3 17.5 7 22 12 22 C17 22 21 17.5 21 12 C21 6.5 17 2 12 2Z" />
      <path d="M9 12 L11 14 L15 10" strokeWidth="2" />
    </svg>
  );
}

/* ── Circular gauge for pass rate ── */

function PassRateGauge({ rate, size = 48 }: { rate: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * rate;
  const color =
    rate >= 1 ? "text-emerald-500" : rate >= 0.8 ? "text-amber-500" : "text-red-500";
  const trackColor = "text-slate-200 dark:text-slate-700";

  return (
    <div className={`relative ${rate >= 1 ? "glow-pulse" : ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="4"
          className={`stroke-current ${trackColor}`}
        />
        {/* fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={`stroke-current ${color} transition-all duration-700`}
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${color}`}
      >
        {(rate * 100).toFixed(0)}%
      </span>
    </div>
  );
}

/* ── Dot indicators for pass/fail ── */

function PassFailDots({ passes, failures }: { passes: number; failures: number }) {
  const dots: ReactNode[] = [];
  for (let i = 0; i < passes; i++) {
    dots.push(
      <span
        key={`p-${i}`}
        className="inline-block w-2 h-2 rounded-full bg-emerald-400"
        title="Pass"
      />
    );
  }
  for (let i = 0; i < failures; i++) {
    dots.push(
      <span
        key={`f-${i}`}
        className="inline-block w-2 h-2 rounded-full bg-red-400"
        title="Fail"
      />
    );
  }
  return <span className="inline-flex items-center gap-0.5 flex-wrap">{dots}</span>;
}

/* ── Main Dashboard ── */

export function Dashboard({ scenarios }: Props) {
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const totalScenarios = scenarios.length;
  const totalRuns = scenarios.reduce((s, sc) => s + sc.total_runs, 0);
  const allProps = scenarios.flatMap((sc) => Object.entries(sc.properties));
  const overallPassRate =
    allProps.length > 0
      ? allProps.reduce((s, [, v]) => s + v.pass_rate, 0) / allProps.length
      : 1;

  // Check if all scenarios are at 100%
  const allPerfect =
    scenarios.length > 0 &&
    scenarios.every((sc) => {
      const props = Object.values(sc.properties);
      return props.length > 0 && props.every((p) => p.pass_rate === 1);
    });

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
      {/* Celebratory banner */}
      {allPerfect && (
        <div className="animate-fade-in-delay-1 flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-5 py-3 shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            All systems nominal
          </span>
          <span className="text-sm" aria-hidden="true">🚀</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Scenarios"
          value={totalScenarios}
          icon={<ScenariosIcon />}
          accentColor="border-indigo-400 dark:border-indigo-500"
          iconColor="text-indigo-500 dark:text-indigo-400"
          hint="Number of distinct test scenarios in this batch"
          animClass="animate-fade-in"
        />
        <StatCard
          label="Total Runs"
          value={totalRuns}
          icon={<RunsIcon />}
          accentColor="border-violet-400 dark:border-violet-500"
          iconColor="text-violet-500 dark:text-violet-400"
          hint="Total simulation executions across all scenarios (each scenario runs N times)"
          animClass="animate-fade-in-delay-1"
        />
        <StatCard
          label="Overall Pass Rate"
          value={`${(overallPassRate * 100).toFixed(1)}%`}
          icon={<PassRateIcon />}
          accentColor={
            overallPassRate >= 1
              ? "border-emerald-400 dark:border-emerald-500"
              : overallPassRate >= 0.8
                ? "border-amber-400 dark:border-amber-500"
                : "border-red-400 dark:border-red-500"
          }
          iconColor={
            overallPassRate >= 1
              ? "text-emerald-500 dark:text-emerald-400"
              : overallPassRate >= 0.8
                ? "text-amber-500 dark:text-amber-400"
                : "text-red-500 dark:text-red-400"
          }
          color={overallPassRate >= 1 ? "emerald" : overallPassRate >= 0.8 ? "amber" : "red"}
          hint="Average pass rate across all property checks. 100% = all checks passed in every run"
          animClass="animate-fade-in-delay-2"
          gauge={<PassRateGauge rate={overallPassRate} />}
        />
      </div>

      {/* Top failures */}
      {topFailures.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Most Common Failures</h2>
              <InfoTip text="Properties that failed most often across all scenarios. The bar shows failure rate. Fix these first for the biggest impact." />
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {topFailures.map(([name, stats], idx) => {
              const rate = stats.total > 0 ? (stats.failures / stats.total) * 100 : 0;
              return (
                <div
                  key={name}
                  className="group px-5 py-3 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-150 hover:scale-[1.005] cursor-default"
                >
                  {/* Rank badge */}
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-xs font-bold text-red-600 dark:text-red-400">
                    #{idx + 1}
                  </span>
                  <span
                    className="text-sm font-medium text-slate-800 dark:text-slate-200 font-mono flex-1 truncate"
                    title={name}
                  >
                    <span className="group-hover:whitespace-normal">{name}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500 animate-bar"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-red-500 dark:text-red-400 font-medium w-16 text-right">
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
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Scenarios</h2>
            <InfoTip text="Each row is one test scenario. Click a row to expand and see individual property pass/fail results. Topology shows how agents communicated (star, chain, tree, or mesh)." />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                <th className="px-5 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">Scenario</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">Runs</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">Topology</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">Properties</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {scenarios.map((sc, rowIdx) => {
                const props = Object.values(sc.properties);
                const passRate = props.length > 0 ? props.reduce((s, p) => s + p.pass_rate, 0) / props.length : 1;
                const passing = props.filter((p) => p.pass_rate === 1).length;
                const rateColor =
                  passRate >= 1
                    ? "text-emerald-600 dark:text-emerald-400"
                    : passRate >= 0.8
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400";
                const statusDotColor =
                  passRate >= 1
                    ? "bg-emerald-400"
                    : passRate >= 0.8
                      ? "bg-amber-400"
                      : "bg-red-400";
                const isExpanded = expandedScenario === sc.name;
                const hasMilestones = Object.keys(sc.milestones).length > 0;
                const rowBg =
                  rowIdx % 2 === 1
                    ? "bg-slate-25 dark:bg-slate-800/60"
                    : "";

                return (
                  <>
                    <tr
                      key={sc.name}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${rowBg}`}
                      onClick={() => setExpandedScenario(isExpanded ? null : sc.name)}
                    >
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">
                        <span className="inline-flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor}`} />
                          <svg
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {sc.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{sc.total_runs}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {sc.topology ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-400">{TOPOLOGY_ICONS[sc.topology] ?? "?"}</span>
                            <span className="text-xs">{sc.topology}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{passing}</span>
                        <span className="text-slate-400 dark:text-slate-500">/{props.length} pass</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full animate-bar ${passRate >= 1 ? "bg-emerald-400" : passRate >= 0.8 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${passRate * 100}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${rateColor}`}>{(passRate * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${sc.name}-detail`}>
                        <td colSpan={5} className="px-5 py-4 bg-slate-50/60 dark:bg-slate-900/40">
                          <div className="animate-slide-down space-y-4">
                            {/* Properties section */}
                            <div>
                              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                Properties
                              </h3>
                              <div className="space-y-1.5">
                                {Object.entries(sc.properties).map(([name, stats]) => {
                                  const barColor =
                                    stats.pass_rate >= 1
                                      ? "bg-emerald-400"
                                      : stats.pass_rate >= 0.8
                                        ? "bg-amber-400"
                                        : "bg-red-400";
                                  const textColor =
                                    stats.pass_rate >= 1
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : stats.pass_rate >= 0.8
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400";
                                  return (
                                    <div key={name} className="flex items-center gap-4 py-1.5">
                                      <span
                                        className="text-sm font-mono text-slate-700 dark:text-slate-300 w-48 truncate"
                                        title={name}
                                      >
                                        {name}
                                      </span>
                                      <PassFailDots passes={stats.passes} failures={stats.failures} />
                                      <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full animate-bar ${barColor}`}
                                          style={{ width: `${stats.pass_rate * 100}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-medium w-12 text-right ${textColor}`}>
                                        {(stats.pass_rate * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Milestones section */}
                            {hasMilestones && (
                              <div>
                                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                  Milestones
                                </h3>
                                <div className="space-y-1.5">
                                  {Object.entries(sc.milestones).map(([name, stats]) => {
                                    const barColor =
                                      stats.pass_rate >= 1
                                        ? "bg-emerald-400"
                                        : stats.pass_rate >= 0.8
                                          ? "bg-amber-400"
                                          : "bg-red-400";
                                    const textColor =
                                      stats.pass_rate >= 1
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : stats.pass_rate >= 0.8
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-red-600 dark:text-red-400";
                                    return (
                                      <div key={name} className="flex items-center gap-4 py-1.5">
                                        <span
                                          className="text-sm font-mono text-slate-700 dark:text-slate-300 w-48 truncate"
                                          title={name}
                                        >
                                          {name}
                                        </span>
                                        <PassFailDots passes={stats.passes} failures={stats.failures} />
                                        <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full animate-bar ${barColor}`}
                                            style={{ width: `${stats.pass_rate * 100}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs font-medium w-12 text-right ${textColor}`}>
                                          {(stats.pass_rate * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── StatCard ── */

function StatCard({
  label,
  value,
  color = "slate",
  hint,
  icon,
  accentColor,
  iconColor,
  animClass,
  gauge,
}: {
  label: string;
  value: string | number;
  color?: string;
  hint?: string;
  icon?: ReactNode;
  accentColor?: string;
  iconColor?: string;
  animClass?: string;
  gauge?: ReactNode;
}) {
  const valueColor =
    color === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : color === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : color === "red"
          ? "text-red-600 dark:text-red-400"
          : "text-slate-800 dark:text-slate-200";

  return (
    <div
      className={`relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 px-5 py-4 overflow-hidden border-l-4 ${accentColor ?? ""} ${animClass ?? ""}`}
    >
      {/* Shimmer background layer */}
      <div className="stat-shimmer absolute inset-0 pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {icon && <span className={`flex-shrink-0 ${iconColor ?? "text-slate-400"}`}>{icon}</span>}
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {label}
            </p>
            {hint && <InfoTip text={hint} />}
          </div>
          {gauge ? (
            <div className="mt-2">
              {gauge}
            </div>
          ) : (
            <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
          )}
        </div>
        {gauge && (
          <p className={`text-2xl font-bold ${valueColor} sr-only`}>{value}</p>
        )}
      </div>
    </div>
  );
}
