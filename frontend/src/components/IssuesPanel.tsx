import { useMemo } from "react";
import type { MessageEvent, RunSummary } from "../types";
import { getPropertyMeta, AGENT_COLORS } from "../labels";

interface Props {
  messages: MessageEvent[];
  agents: string[];
  visibleUpTo: number;
  runSummary?: RunSummary;
}

interface Issue {
  turn: number;
  type: "violation";
  label: string;
  detail: string;
  color: string;
  agentName: string;
}

export function IssuesPanel({ messages, agents, visibleUpTo, runSummary }: Props) {
  const issues = useMemo(() => {
    const result: Issue[] = [];
    for (let i = 0; i <= Math.min(visibleUpTo, messages.length - 1); i++) {
      const msg = messages[i];
      const agentIdx = agents.indexOf(msg.sender);
      const color = AGENT_COLORS[agentIdx >= 0 ? agentIdx % AGENT_COLORS.length : 0];

      if (msg.violatedProperties.length > 0) {
        for (const prop of msg.violatedProperties) {
          const meta = getPropertyMeta(prop);
          result.push({
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
    return result;
  }, [messages, agents, visibleUpTo]);

  if (visibleUpTo < 0) return null;

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
                  T{issue.turn}
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
