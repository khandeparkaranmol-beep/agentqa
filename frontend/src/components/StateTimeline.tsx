import { useState } from "react";
import type { TraceEvent } from "../types";
import { AGENT_COLORS } from "../labels";

interface Props {
  events: TraceEvent[];
  agents: string[];
  visibleUpTo: number;
}

export function StateTimeline({ events, agents, visibleUpTo }: Props) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const stateEvents = events.filter(
    (e) => e.type === "state_change" && e.turn <= visibleUpTo,
  );

  if (stateEvents.length === 0) return null;

  const byAgent = new Map<string, TraceEvent[]>();
  for (const e of stateEvents) {
    const agent = e.agent ?? "unknown";
    const existing = byAgent.get(agent) ?? [];
    existing.push(e);
    byAgent.set(agent, existing);
  }

  return (
    <div className="rounded-2xl border border-slate-200/30 dark:border-slate-700/20 bg-white/50 dark:bg-slate-800/30 backdrop-blur-xl overflow-hidden">
      {/* Header — minimal, no background bar */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-medium">Agent State</span>
        <span className="text-[10px] text-slate-300 dark:text-slate-600 tabular-nums">{stateEvents.length} changes</span>
      </div>

      {/* Agent rows */}
      <div className="px-2 pb-2">
        {agents
          .filter((a) => byAgent.has(a))
          .map((agent, idx) => {
            const changes = byAgent.get(agent)!;
            const latest = changes[changes.length - 1];
            const isExpanded = expandedAgent === agent;
            const color = AGENT_COLORS[idx % AGENT_COLORS.length];

            return (
              <div key={agent}>
                <button
                  onClick={() => setExpandedAgent(isExpanded ? null : agent)}
                  className="w-full px-3 py-2.5 flex items-center gap-3 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors text-left group"
                >
                  <svg
                    width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                    className={`text-slate-300 dark:text-slate-600 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <path d="M2 0.5l4.5 3.5-4.5 3.5z" />
                  </svg>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{agent}</span>
                  <span className="text-[10px] text-slate-300 dark:text-slate-600 ml-auto tabular-nums">
                    {changes.length} {changes.length === 1 ? "change" : "changes"} · T{latest.turn}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-2 ml-5 space-y-1.5 animate-slide-down">
                    {changes.map((change, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-slate-50/50 dark:bg-slate-700/20 border border-slate-200/20 dark:border-slate-700/20 overflow-hidden"
                      >
                        <div className="px-3 py-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">T{change.turn}</span>
                          {typeof change.data.field === "string" && (
                            <span className="text-[10px] font-mono text-indigo-500/70 dark:text-indigo-400/60">
                              {change.data.field}
                            </span>
                          )}
                        </div>
                        <pre className="px-3 pb-2 text-[10px] text-slate-500 dark:text-slate-400 overflow-x-auto font-mono leading-relaxed">
                          {formatStateData(change.data)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function formatStateData(data: Record<string, unknown>): string {
  const display = { ...data };
  delete display.agent;
  if (Object.keys(display).length === 0) return "{}";
  return JSON.stringify(display, null, 2);
}
