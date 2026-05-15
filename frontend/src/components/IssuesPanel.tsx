import { useMemo } from "react";
import type { MessageEvent, PropertyResult, RunSummary } from "../types";
import { getPropertyMeta, AGENT_COLORS } from "../labels";

interface Props {
  messages: MessageEvent[];
  agents: string[];
  visibleUpTo: number;
  /** Canonical source of truth for property failures. Includes both
   *  turn-attributed failures (e.g. step_repetition at turn 9) and
   *  trace-level failures (e.g. converges_within, no_deadlock — no turn).
   *  When omitted, falls back to message.violatedProperties for legacy callers. */
  results?: PropertyResult[];
  runSummary?: RunSummary;
}

interface Issue {
  turn: number;        // -1 sentinel for trace-level (post-hoc) failures
  type: "violation";
  label: string;
  detail: string;
  color: string;
  agentName: string;
}

export function IssuesPanel({ messages, agents, visibleUpTo, results, runSummary }: Props) {
  const issues = useMemo(() => {
    const out: Issue[] = [];

    // Primary path: read directly from property results. This catches both
    // turn-attributed failures (e.g. step_repetition at turn 9) AND
    // trace-level failures (e.g. converges_within, no_deadlock) which have
    // no message attachment and are otherwise invisible.
    if (results && results.length > 0) {
      for (const r of results) {
        if (r.passed) continue;
        const hasTurn = typeof r.turn === "number" && r.turn >= 0;
        const turn = hasTurn ? (r.turn as number) : -1;
        // For turn-attributed failures, hide until playback has scrubbed
        // past that turn. Trace-level failures (turn === -1) appear as
        // soon as playback starts since they have no time anchor.
        if (hasTurn && turn > visibleUpTo) continue;

        const meta = getPropertyMeta(r.property_name);
        const agentName = (hasTurn && messages[turn]) ? messages[turn].sender : "";
        const agentIdx = agentName ? agents.indexOf(agentName) : -1;
        const color = agentIdx >= 0
          ? AGENT_COLORS[agentIdx % AGENT_COLORS.length]
          : "#94a3b8";  // neutral slate for trace-level

        out.push({
          turn,
          type: "violation",
          label: meta.badgeLabel,
          detail: r.details || meta.failedLabel,
          color,
          agentName,
        });
      }
      return out;
    }

    // Legacy fallback: only for callers that don't yet pass `results`.
    // Reads message.violatedProperties (which itself only sees turn-attributed
    // failures with non-null turn — won't catch trace-level ones).
    for (let i = 0; i <= Math.min(visibleUpTo, messages.length - 1); i++) {
      const msg = messages[i];
      const agentIdx = agents.indexOf(msg.sender);
      const color = AGENT_COLORS[agentIdx >= 0 ? agentIdx % AGENT_COLORS.length : 0];

      if (msg.violatedProperties.length > 0) {
        for (const prop of msg.violatedProperties) {
          const meta = getPropertyMeta(prop);
          out.push({
            turn: msg.turn,
            type: "violation",
            label: meta.badgeLabel,
            detail: meta.failedLabel,
            color,
            agentName: msg.sender,
          });
        }
      }
      // Faults are intentional test inputs, not failures — omit from issues
    }
    return out;
  }, [results, messages, agents, visibleUpTo]);

  // Hide the panel only before playback starts AND when we have nothing
  // useful to show. Trace-level failures from `results` should appear
  // even at visibleUpTo === -1 (they have no time anchor).
  const hasTraceLevel = !!results?.some(r => !r.passed && (r.turn === undefined || r.turn === null || r.turn < 0));
  if (visibleUpTo < 0 && !hasTraceLevel) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-medium">
          Failed Checks
        </span>
        {issues.length > 0 && (
          <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-400">
            {issues.length}
          </span>
        )}
      </div>

      {/* Per-property pass rates with CI */}
      {runSummary && Object.keys(runSummary.properties).length > 0 && (
        <div className="space-y-1 mb-3">
          <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-medium px-1">
            Pass Rates ({runSummary.total_runs} runs)
          </span>
          <div className="space-y-1">
            {Object.entries(runSummary.properties).map(([name, stats]) => {
              const meta = getPropertyMeta(name);
              const hasCI = stats.ci_lower !== undefined && stats.ci_upper !== undefined;
              const passed = stats.pass_rate >= 1.0;
              const barColor = passed
                ? "bg-emerald-500/70"
                : stats.pass_rate >= 0.8
                  ? "bg-amber-500/70"
                  : "bg-red-500/70";
              return (
                <div key={name} className="rounded-lg px-2.5 py-1.5 bg-white/30 dark:bg-slate-800/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate mr-2">
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0">
                      {Math.round(stats.pass_rate * 100)}%
                      {hasCI && (
                        <span className="text-slate-300 dark:text-slate-600 ml-0.5">
                          [{Math.round(stats.ci_lower! * 100)}–{Math.round(stats.ci_upper! * 100)}]
                        </span>
                      )}
                    </span>
                  </div>
                  {/* CI bar visualization */}
                  <div className="relative h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/40 overflow-hidden">
                    {/* Pass rate fill */}
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
                      style={{ width: `${stats.pass_rate * 100}%` }}
                    />
                    {/* CI range overlay */}
                    {hasCI && (
                      <div
                        className="absolute inset-y-0 rounded-full border border-slate-400/30 dark:border-slate-500/30"
                        style={{
                          left: `${stats.ci_lower! * 100}%`,
                          width: `${(stats.ci_upper! - stats.ci_lower!) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Issue cards */}
      {issues.length === 0 ? (
        <p className="text-[11px] text-slate-300 dark:text-slate-600 px-1 py-2 font-light">
          All checks passing.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
          {issues.map((issue, i) => (
            <div
              key={`${issue.turn}-${issue.type}-${i}`}
              className="rounded-xl px-3 py-2.5 backdrop-blur-sm spotlight-scene-enter"
              style={{
                background: "rgba(239,68,68,0.06)",
                animationDelay: `${i * 80}ms`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {/* Colored dot for agent */}
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: issue.color }}
                />
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  {issue.turn >= 0 ? `T${issue.turn}` : "trace"}
                </span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{
                    color: "#ef4444",
                    background: "rgba(239,68,68,0.1)",
                  }}
                >
                  {issue.label}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {issue.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
