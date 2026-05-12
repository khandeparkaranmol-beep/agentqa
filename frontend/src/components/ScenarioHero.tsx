import { AGENT_COLORS } from "../labels";
import type { RunSummary, PropertyResult } from "../types";

interface Props {
  prettyTitle: string;
  runLabel: string | null;
  topoLabel: string | null;
  agents: string[];
  agentRoles: Record<string, string>;
  messageCount: number;
  checkCount: number;
  passedChecks: number;
  runSummary?: RunSummary;
  /** Total number of runs available for switching. */
  totalRuns?: number;
  /** Currently active run index (0-based). */
  activeRun?: number;
  /** Per-run results for coloring the run pills. */
  allRunResults?: PropertyResult[][];
  /** Callback when user clicks a run pill. */
  onRunSelect?: (index: number) => void;
  /** Center-align hero (used in Spotlight mode) */
  centered?: boolean;
}

export function ScenarioHero({
  prettyTitle,
  runLabel,
  topoLabel,
  agents,
  agentRoles,
  messageCount,
  checkCount,
  passedChecks,
  runSummary,
  totalRuns,
  activeRun,
  allRunResults,
  onRunSelect,
  centered = false,
}: Props) {
  // Multi-run overall pass rate (average across all properties)
  const multiRunRate = (() => {
    if (!runSummary) return null;
    const props = Object.values(runSummary.properties);
    if (props.length === 0) return null;
    return props.reduce((sum, p) => sum + p.pass_rate, 0) / props.length;
  })();

  // Average CI across all properties (if available)
  const multiRunCI = (() => {
    if (!runSummary) return null;
    const props = Object.values(runSummary.properties);
    if (props.length === 0) return null;
    const hasCI = props.some(p => p.ci_lower !== undefined && p.ci_upper !== undefined);
    if (!hasCI) return null;
    const avgLower = props.reduce((sum, p) => sum + (p.ci_lower ?? 0), 0) / props.length;
    const avgUpper = props.reduce((sum, p) => sum + (p.ci_upper ?? 1), 0) / props.length;
    return { lower: avgLower, upper: avgUpper };
  })();

  // Single-run pass rate (fallback when no multi-run data)
  const allPassed = checkCount > 0 && passedChecks === checkCount;

  // Determine per-run pill color: all checks passed → green, else red
  const runPassed = (idx: number): boolean => {
    if (!allRunResults || !allRunResults[idx]) return true;
    return allRunResults[idx].every(r => r.passed);
  };

  const hasMultiRun = totalRuns !== undefined && totalRuns > 1;

  return (
    <div className={`pt-3 pb-3 px-4 sm:px-6 ${centered ? "text-center max-w-screen-xl mx-auto" : ""}`}>
      {/* Title + stats — single tight line */}
      <div className={`flex items-baseline gap-3 flex-wrap ${centered ? "justify-center" : ""}`}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {prettyTitle}
        </h1>
        {!hasMultiRun && runLabel && (
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {runLabel}
          </span>
        )}
        <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          {topoLabel && <span>{topoLabel}</span>}
          <span>{messageCount} messages</span>
          <span>{checkCount} checks</span>
          {/* Multi-run statistical pass rate */}
          {multiRunRate !== null ? (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className={
                multiRunRate >= 1
                  ? "text-emerald-500 dark:text-emerald-400 font-semibold"
                  : multiRunRate >= 0.8
                    ? "text-amber-500 dark:text-amber-400 font-semibold"
                    : "text-red-500 dark:text-red-400 font-semibold"
              }>
                {Math.round(multiRunRate * 100)}% pass rate
                {multiRunCI && (
                  <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">
                    [{Math.round(multiRunCI.lower * 100)}–{Math.round(multiRunCI.upper * 100)}%]
                  </span>
                )}
                {" "}({runSummary!.total_runs} runs)
              </span>
            </>
          ) : checkCount > 0 ? (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className={
                allPassed
                  ? "text-emerald-500 dark:text-emerald-400 font-semibold"
                  : "text-red-500 dark:text-red-400 font-semibold"
              }>
                {allPassed ? "100% passed" : `${passedChecks}/${checkCount} passed`}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Run picker pills + agent pills row */}
      <div className={`mt-2 flex flex-wrap items-center gap-3 ${centered ? "justify-center" : ""}`}>
        {/* Run pills */}
        {hasMultiRun && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 font-medium mr-1">
              Runs
            </span>
            {Array.from({ length: totalRuns! }, (_, i) => {
              const passed = runPassed(i);
              const isActive = i === activeRun;
              return (
                <button
                  key={i}
                  onClick={() => onRunSelect?.(i)}
                  className={`
                    w-6 h-6 rounded-full text-[11px] font-semibold transition-all duration-150
                    ${isActive
                      ? passed
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                        : "bg-red-500 text-white shadow-sm shadow-red-500/30"
                      : passed
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                        : "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25"
                    }
                  `}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* Separator between runs and agents */}
        {hasMultiRun && (
          <span className="text-slate-200 dark:text-slate-700">|</span>
        )}

        {/* Agent pills */}
        <div className="flex flex-wrap gap-1.5">
          {agents.map((agent, i) => {
            const color = AGENT_COLORS[i % AGENT_COLORS.length];
            const role = agentRoles[agent];
            return (
              <span
                key={agent}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/30 dark:border-slate-700/20 text-slate-600 dark:text-slate-300"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                {agent}
                {role && (
                  <span className="text-slate-400 dark:text-slate-500 font-normal">
                    {role}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
