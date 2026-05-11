import { useMemo } from "react";
import type { MessageEvent } from "../types";
import { getPropertyMeta, getFaultLabel, AGENT_COLORS } from "../labels";

interface Props {
  messages: MessageEvent[];
  agents: string[];
  visibleUpTo: number;
}

interface Issue {
  turn: number;
  type: "violation" | "fault";
  label: string;
  detail: string;
  color: string;
  agentName: string;
}

export function IssuesPanel({ messages, agents, visibleUpTo }: Props) {
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
      if (msg.hasFault) {
        const faultInfo = getFaultLabel(msg.faultType);
        result.push({
          turn: msg.turn,
          type: "fault",
          label: faultInfo.badgeLabel,
          detail: `${faultInfo.label} — ${msg.sender} → ${msg.receiver}`,
          color,
          agentName: msg.sender,
        });
      }
    }
    return result;
  }, [messages, agents, visibleUpTo]);

  if (visibleUpTo < 0) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-medium">
          Issues
        </span>
        {issues.length > 0 && (
          <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-400">
            {issues.length}
          </span>
        )}
      </div>

      {/* Issue cards */}
      {issues.length === 0 ? (
        <p className="text-[11px] text-slate-300 dark:text-slate-600 px-1 py-2 font-light">
          No issues so far.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
          {issues.map((issue, i) => (
            <div
              key={`${issue.turn}-${issue.type}-${i}`}
              className="rounded-xl px-3 py-2.5 backdrop-blur-sm spotlight-scene-enter"
              style={{
                background: issue.type === "violation"
                  ? "rgba(239,68,68,0.06)"
                  : "rgba(249,115,22,0.06)",
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
                    color: issue.type === "violation" ? "#ef4444" : "#f97316",
                    background: issue.type === "violation"
                      ? "rgba(239,68,68,0.1)"
                      : "rgba(249,115,22,0.1)",
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
