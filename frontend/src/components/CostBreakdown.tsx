import { useMemo } from "react";
import type { MessageEvent } from "../types";
import { AGENT_COLORS } from "../labels";

interface Props {
  messages: MessageEvent[];
  agents: string[];
}

export function CostBreakdown({ messages, agents }: Props) {
  const stats = useMemo(() => {
    const perAgent: Record<string, { input: number; output: number; cost: number; turns: number }> = {};
    for (const msg of messages) {
      const agent = msg.sender;
      if (!perAgent[agent]) perAgent[agent] = { input: 0, output: 0, cost: 0, turns: 0 };
      perAgent[agent].input += msg.input_tokens;
      perAgent[agent].output += msg.output_tokens;
      perAgent[agent].cost += msg.cost_usd;
      perAgent[agent].turns += 1;
    }
    const totalTokens = Object.values(perAgent).reduce((s, v) => s + v.input + v.output, 0);
    const totalCost = Object.values(perAgent).reduce((s, v) => s + v.cost, 0);
    return { perAgent, totalTokens, totalCost };
  }, [messages]);

  if (stats.totalTokens === 0) return null;

  const maxTokens = Math.max(...Object.values(stats.perAgent).map((v) => v.input + v.output));

  return (
    <div className="rounded-2xl border border-slate-200/30 dark:border-slate-700/20 bg-white/50 dark:bg-slate-800/30 backdrop-blur-xl overflow-hidden">
      {/* Header — minimal */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-medium">Token Usage</span>
        <div className="flex items-center gap-3 text-[10px] text-slate-300 dark:text-slate-600 tabular-nums">
          <span>{stats.totalTokens.toLocaleString()} total</span>
          {stats.totalCost > 0 && <span>${stats.totalCost.toFixed(4)}</span>}
        </div>
      </div>

      {/* Agent bars */}
      <div className="px-5 pt-1 pb-4 space-y-3">
        {agents
          .filter((a) => stats.perAgent[a])
          .map((agent, i) => {
            const s = stats.perAgent[agent];
            const total = s.input + s.output;
            const pct = maxTokens > 0 ? (total / maxTokens) * 100 : 0;
            const inputPct = total > 0 ? (s.input / total) * 100 : 0;
            const color = AGENT_COLORS[i % AGENT_COLORS.length];

            return (
              <div key={agent} className="space-y-1.5 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{agent}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[10px] tabular-nums">
                    <span className="text-slate-400 dark:text-slate-500">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{s.input.toLocaleString()}</span> in
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{s.output.toLocaleString()}</span> out
                    </span>
                    {s.cost > 0 && (
                      <span className="text-slate-500 dark:text-slate-400 font-medium">${s.cost.toFixed(4)}</span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100/60 dark:bg-slate-700/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full flex animate-bar"
                    style={{ width: `${pct}%` }}
                  >
                    <div
                      className="h-full rounded-l-full"
                      style={{ width: `${inputPct}%`, backgroundColor: color, opacity: 0.4 }}
                    />
                    <div
                      className="h-full rounded-r-full"
                      style={{ width: `${100 - inputPct}%`, backgroundColor: color, opacity: 0.7 }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

        {/* Legend — barely there */}
        <div className="flex items-center gap-3 pt-1 text-[9px] text-slate-300 dark:text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded-sm bg-indigo-400/40" /> input
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded-sm bg-indigo-400/70" /> output
          </span>
        </div>
      </div>
    </div>
  );
}
