import { useMemo, useState } from "react";
import type { MessageEvent } from "../types";
import { InfoTip } from "./InfoTip";

interface Props {
  messages: MessageEvent[];
  agents: string[];
}

const AGENT_COLORS: string[] = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
];

export function CostBreakdown({ messages, agents }: Props) {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Token Usage</h2>
          <InfoTip text="How many LLM tokens each agent used. Lighter bar = input tokens (prompt), darker bar = output tokens (response). Cost is estimated from token counts." />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
          <span>{stats.totalTokens.toLocaleString()} total</span>
          {stats.totalCost > 0 && <span>${stats.totalCost.toFixed(4)}</span>}
        </div>
      </div>
      {/* Total summary */}
      <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-4">
          <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {stats.totalTokens.toLocaleString()} tokens
          </span>
          {stats.totalCost > 0 && (
            <span className="text-base font-semibold text-slate-600 dark:text-slate-400">
              ${stats.totalCost.toFixed(4)}
            </span>
          )}
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        {agents
          .filter((a) => stats.perAgent[a])
          .map((agent, i) => {
            const s = stats.perAgent[agent];
            const total = s.input + s.output;
            const pct = maxTokens > 0 ? (total / maxTokens) * 100 : 0;
            const inputPct = total > 0 ? (s.input / total) * 100 : 0;
            const outputPct = total > 0 ? (s.output / total) * 100 : 0;
            const tokenSharePct = stats.totalTokens > 0 ? (total / stats.totalTokens) * 100 : 0;
            const color = AGENT_COLORS[i % AGENT_COLORS.length];

            return (
              <div
                key={agent}
                className="space-y-1 relative"
                onMouseEnter={() => setHoveredAgent(agent)}
                onMouseLeave={() => setHoveredAgent(null)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{agent}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{s.input.toLocaleString()}</span> in
                    </span>
                    <span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{s.output.toLocaleString()}</span> out
                    </span>
                    {s.cost > 0 && (
                      <span className="font-medium text-slate-700 dark:text-slate-300">${s.cost.toFixed(4)}</span>
                    )}
                    <span className="text-slate-400 dark:text-slate-500">{s.turns} turns</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full flex animate-bar"
                    style={{ width: `${pct}%` }}
                  >
                    <div
                      className="h-full rounded-l-full"
                      style={{ width: `${inputPct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, opacity: 0.7 }}
                    />
                    <div
                      className="h-full rounded-r-full"
                      style={{ width: `${100 - inputPct}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}
                    />
                  </div>
                </div>
                {/* Hover tooltip card */}
                {hoveredAgent === agent && (
                  <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg px-4 py-3 text-xs space-y-1 min-w-[200px] animate-fade-in">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{agent}</div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Input tokens</span>
                      <span className="font-medium">{inputPct.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Output tokens</span>
                      <span className="font-medium">{outputPct.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-600 pt-1 mt-1">
                      <span>Share of total</span>
                      <span className="font-medium">{tokenSharePct.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        <div className="flex items-center gap-4 pt-1 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-indigo-300" /> input
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-indigo-500" /> output
          </span>
        </div>
      </div>
    </div>
  );
}
