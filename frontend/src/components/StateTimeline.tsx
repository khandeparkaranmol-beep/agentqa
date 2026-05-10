import { useState } from "react";
import type { TraceEvent } from "../types";
import { InfoTip } from "./InfoTip";

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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Agent State</h2>
          <InfoTip text="Each agent's internal memory and variables (e.g. offer price, counters). Click an agent row to see how their state changed at each turn." />
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{stateEvents.length} changes</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {agents
          .filter((a) => byAgent.has(a))
          .map((agent) => {
            const changes = byAgent.get(agent)!;
            const latest = changes[changes.length - 1];
            const isExpanded = expandedAgent === agent;

            return (
              <div key={agent}>
                <button
                  onClick={() => setExpandedAgent(isExpanded ? null : agent)}
                  className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="currentColor"
                    className={`text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <path d="M3 1l5 4-5 4z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{agent}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
                    {changes.length} change{changes.length !== 1 ? "s" : ""}
                    {" · "}last at T{latest.turn}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-5 pb-3 space-y-2">
                    {changes.map((change, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 overflow-hidden"
                      >
                        <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-600 text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
                          <span className="font-mono">Turn {change.turn}</span>
                          {typeof change.data.field === "string" && (
                            <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                              {change.data.field}
                            </span>
                          )}
                        </div>
                        <pre className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 overflow-x-auto font-mono leading-relaxed">
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
