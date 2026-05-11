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
    <div className={`pt-6 pb-6 px-4 sm:px-6 ${centered ? "text-center max-w-screen-xl mx-auto" : ""}`}>
      {/* Title + run label */}
      <div className={`flex items-baseline gap-3 flex-wrap ${centered ? "justify-center" : ""}`}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {prettyTitle}
        </h1>
        {runLabel && (
          <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">
            {runLabel}
          </span>
        )}
      </div>

      {/* Stats line */}
      <div className={`mt-2 flex items-center gap-5 text-[13px] text-slate-400 dark:text-slate-500 ${centered ? "justify-center" : ""}`}>
        {topoLabel && <span>{topoLabel}</span>}
        <span>{messageCount} messages</span>
        <span>{checkCount} checks</span>
      </div>

      {/* Agent pills */}
      <div className={`mt-4 flex flex-wrap gap-2.5 ${centered ? "justify-center" : ""}`}>
        {agents.map((agent, i) => {
          const color = AGENT_COLORS[i % AGENT_COLORS.length];
          const role = agentRoles[agent];
          return (
            <span
              key={agent}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/30 dark:border-slate-700/20 text-slate-600 dark:text-slate-300"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
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
