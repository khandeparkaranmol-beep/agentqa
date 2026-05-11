import { AGENT_COLORS } from "../labels";

interface Props {
  prettyTitle: string;
  runLabel: string | null;
  topoLabel: string | null;
  agents: string[];
  agentRoles: Record<string, string>;
  messageCount: number;
  checkCount: number;
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
  centered = false,
}: Props) {
  return (
    <div className={`pt-3 pb-3 px-4 sm:px-6 ${centered ? "text-center max-w-screen-xl mx-auto" : ""}`}>
      {/* Title + run label + stats — single tight line */}
      <div className={`flex items-baseline gap-3 flex-wrap ${centered ? "justify-center" : ""}`}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {prettyTitle}
        </h1>
        {runLabel && (
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {runLabel}
          </span>
        )}
        <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          {topoLabel && <span>{topoLabel}</span>}
          <span>{messageCount} messages</span>
          <span>{checkCount} checks</span>
        </div>
      </div>

      {/* Agent pills — compact */}
      <div className={`mt-2 flex flex-wrap gap-1.5 ${centered ? "justify-center" : ""}`}>
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
  );
}
