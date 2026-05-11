import { useState, useEffect, useRef } from "react";
import { formatTitle, TOPOLOGY_LABELS, AGENT_COLORS } from "../labels";

interface Props {
  title: string;
  agents: string[];
  agentRoles?: Record<string, string>;
  topology?: string;
  totalMessages: number;
  totalChecks: number;
  onComplete: () => void;
}

/**
 * Cinematic opening hero — inline, not an overlay.
 *
 * Renders as the top section of the page. Phases:
 *   0 (0–1.2s):       Title fades in large and centered
 *   1 (1.2–2.2s):     Subtitle: topology + message count
 *   2 (2.2–dynamic):  "The Cast" — each agent card appears one by one
 *   After cast:        Calls onComplete to start playback
 */
export function CinematicIntro({ title, agents, agentRoles, topology, totalMessages, totalChecks, onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  const [visibleAgents, setVisibleAgents] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  // Stable ref for onComplete — prevents useEffect from resetting timers
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  // Phase progression — runs once
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Show skip button after 2s
    timers.push(setTimeout(() => setShowSkip(true), 2000));

    // Phase 0 → 1: show subtitle — let the title land first
    timers.push(setTimeout(() => setPhase(1), 1600));

    // Phase 1 → 2: start showing agents
    timers.push(setTimeout(() => setPhase(2), 2800));

    // Reveal agents one by one — deliberate pacing
    agents.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleAgents(i + 1), 2800 + (i + 1) * 600));
    });

    // Start playback after all agents revealed + a breath
    const allAgentsTime = 2800 + (agents.length + 1) * 600;
    timers.push(setTimeout(() => onCompleteRef.current(), allAgentsTime + 1200));

    return () => timers.forEach(clearTimeout);
  }, [agents.length]); // stable dep — only re-run if agent count changes

  const prettyTitle = formatTitle(title.split("—")[0].trim());
  const runLabel = title.includes("—") ? title.split("—")[1].trim() : null;
  const topoLabel = topology ? (TOPOLOGY_LABELS[topology] ?? `${topology} pattern`) : null;

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden pt-24 pb-20">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-purple-500/[0.03] blur-[100px]" />
      </div>

      <div className="relative text-center max-w-2xl px-8">
        {/* Title */}
        <div className={`transition-all duration-[1600ms] ease-out ${phase >= 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            {prettyTitle}
          </h1>
          {runLabel && (
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-3 font-mono tracking-wide">
              {runLabel}
            </p>
          )}
        </div>

        {/* Subtitle: topology + stats */}
        <div className={`mt-8 transition-all duration-[1200ms] ease-out ${phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            {topoLabel && (
              <>
                <span>{topoLabel}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </>
            )}
            <span>{totalMessages} messages</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span>{totalChecks} safety checks</span>
          </div>
        </div>

        {/* Divider */}
        <div className={`mt-14 mb-10 flex items-center gap-4 transition-all duration-[1000ms] ease-out ${phase >= 2 ? "opacity-100" : "opacity-0"}`}>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 font-medium">The Cast</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
        </div>

        {/* Agent cards */}
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {agents.map((agent, i) => {
            const color = AGENT_COLORS[i % AGENT_COLORS.length];
            const isVisible = i < visibleAgents;
            return (
              <div
                key={agent}
                className="flex flex-col items-center gap-3 transition-all ease-out"
                style={{
                  transitionDuration: "1000ms",
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.92)",
                }}
              >
                <div className="relative">
                  <div
                    className="absolute inset-[-4px] rounded-full blur-lg transition-opacity duration-1000 hidden dark:block"
                    style={{ backgroundColor: color, opacity: isVisible ? 0.35 : 0 }}
                  />
                  <div
                    className="relative w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg"
                    style={{
                      backgroundColor: color,
                      boxShadow: isVisible ? `0 4px 24px ${color}50` : "none",
                      transition: "box-shadow 1s ease",
                    }}
                  >
                    {agent.charAt(0).toUpperCase()}
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 capitalize">
                  {agent}
                </span>
                {agentRoles?.[agent] && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[120px] text-center leading-tight">
                    {agentRoles[agent]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Skip button — appears after 2s */}
      <button
        onClick={onComplete}
        className={`absolute top-6 right-6 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-500 ${showSkip ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}
      >
        Skip
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 2.5l5 3.5-5 3.5" />
        </svg>
      </button>

    </div>
  );
}
