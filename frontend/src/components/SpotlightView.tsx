import { useState, useEffect, useRef } from "react";
import type { MessageEvent, PropertyResult } from "../types";
import { getPropertyMeta, getFaultLabel, agentColor as getAgentColor, AGENT_COLORS } from "../labels";

interface Props {
  agents: string[];
  agentRoles?: Record<string, string>;
  messages: MessageEvent[];
  results?: PropertyResult[];
  visibleUpTo: number;
  speed?: number;
}

/**
 * Spotlight View — cinematic, one interaction at a time.
 *
 * The cast sits at the top of the stage. The speaker lights up.
 * The dialogue takes center screen — large, unhurried, the star.
 * Each new turn is a scene cut. The verdict is the finale.
 *
 * This is a film, not a feed.
 */
export function SpotlightView({ agents, agentRoles: _agentRoles, messages, results, visibleUpTo, speed = 1 }: Props) {
  const [isTyping, setIsTyping] = useState(false);
  // Mount mid-playback: show content up to current turn immediately
  const [displayedIdx, setDisplayedIdx] = useState(visibleUpTo);
  const [showVerdict, setShowVerdict] = useState(false);
  const prevVisibleRef = useRef(visibleUpTo);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agentColor = (name: string) => getAgentColor(agents, name);

  // When visibleUpTo advances: typing indicator → reveal
  // When stepping back: instant reveal
  useEffect(() => {
    const prev = prevVisibleRef.current;
    if (visibleUpTo > prev && visibleUpTo >= 0) {
      // Forward — show typing, then reveal
      setShowVerdict(false);
      setIsTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      const duration = Math.max(150, 800 / speed);
      typingTimerRef.current = setTimeout(() => {
        setIsTyping(false);
        setDisplayedIdx(visibleUpTo);
      }, duration);
    } else if (visibleUpTo < prev) {
      // Backward — instant
      setShowVerdict(false);
      setIsTyping(false);
      setDisplayedIdx(visibleUpTo);
    } else if (visibleUpTo === -1 && prev !== -1) {
      // Reset
      setShowVerdict(false);
      setIsTyping(false);
      setDisplayedIdx(-1);
    }
    prevVisibleRef.current = visibleUpTo;
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [visibleUpTo, speed]);

  // Verdict: appears after the last message has been displayed for a moment
  useEffect(() => {
    if (displayedIdx === messages.length - 1 && !isTyping && results) {
      const t = setTimeout(() => setShowVerdict(true), 2000);
      return () => clearTimeout(t);
    }
  }, [displayedIdx, isTyping, messages.length, results]);

  const currentMsg = displayedIdx >= 0 && displayedIdx < messages.length
    ? messages[displayedIdx]
    : null;

  return (
    <div className="relative flex flex-col items-center min-h-[65vh]">

      {/* ── The Cast — always present at the top of the stage ── */}
      <div className="flex items-center justify-center gap-5 sm:gap-8 py-8 w-full">
        {agents.map((agent, i) => {
          const color = AGENT_COLORS[i % AGENT_COLORS.length];
          const isSpeaking = currentMsg?.sender === agent;
          const isReceiving = currentMsg?.receiver === agent;
          const isActive = isSpeaking || isReceiving;
          return (
            <div key={agent} className="flex flex-col items-center gap-2 transition-all duration-700 ease-out">
              <div className="relative">
                {/* Glow — only for the speaker */}
                <div
                  className="absolute inset-[-5px] rounded-full blur-lg transition-all duration-700 hidden dark:block"
                  style={{ backgroundColor: color, opacity: isSpeaking ? 0.35 : 0 }}
                />
                <div
                  className="relative w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold transition-all duration-700 ease-out"
                  style={{
                    backgroundColor: color,
                    opacity: isSpeaking ? 1 : isReceiving ? 0.6 : 0.2,
                    transform: isSpeaking ? "scale(1.2)" : "scale(1)",
                  }}
                >
                  {agent.charAt(0).toUpperCase()}
                </div>
              </div>
              <span
                className="text-[11px] font-medium capitalize transition-all duration-700"
                style={{
                  color: undefined,
                  opacity: isSpeaking ? 1 : isActive ? 0.5 : 0.25,
                }}
              >
                <span className={isSpeaking ? "text-slate-700 dark:text-white" : "text-slate-400 dark:text-slate-600"}>
                  {agent}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Thin line separating cast from stage */}
      <div className="w-full max-w-md mx-auto h-px bg-gradient-to-r from-transparent via-slate-200/50 dark:via-slate-700/30 to-transparent" />

      {/* ── The Stage — one scene at a time ── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-6 sm:px-12 py-12 sm:py-16">

        {/* Pre-play — anticipation */}
        {visibleUpTo < 0 && !isTyping && (
          <p className="text-base font-light text-slate-400 dark:text-slate-500 tracking-wide spotlight-scene-enter">
            The conversation is about to begin.
          </p>
        )}

        {/* Typing — the held breath before a scene */}
        {isTyping && visibleUpTo >= 0 && visibleUpTo < messages.length && (
          <div className="flex flex-col items-center gap-3 spotlight-scene-enter">
            <div className="flex items-center gap-2">
              <span className="typing-dot" style={{ backgroundColor: agentColor(messages[visibleUpTo].sender), animationDelay: "0ms" }} />
              <span className="typing-dot" style={{ backgroundColor: agentColor(messages[visibleUpTo].sender), animationDelay: "200ms" }} />
              <span className="typing-dot" style={{ backgroundColor: agentColor(messages[visibleUpTo].sender), animationDelay: "400ms" }} />
            </div>
          </div>
        )}

        {/* The Scene — the message */}
        {!isTyping && currentMsg && !showVerdict && (
          <div key={displayedIdx} className="text-center space-y-8 spotlight-scene-enter w-full">

            {/* Fault — a stage direction */}
            {currentMsg.hasFault && (
              <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-orange-500/60 dark:text-orange-400/50 spotlight-scene-enter">
                {getFaultLabel(currentMsg.faultType).label} injected
              </p>
            )}

            {/* Attribution — who speaks, to whom */}
            <div className="flex items-center justify-center gap-3">
              <span
                className="text-lg sm:text-xl font-semibold tracking-tight"
                style={{ color: agentColor(currentMsg.sender) }}
              >
                {currentMsg.sender}
              </span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-300 dark:text-slate-600 flex-shrink-0">
                <path d="M4 2l6 5-6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-lg sm:text-xl font-medium text-slate-400 dark:text-slate-500">
                {currentMsg.receiver}
              </span>
            </div>

            {/* The dialogue — the star of every scene */}
            <p className="text-base sm:text-lg text-slate-700 dark:text-slate-200/90 leading-[1.9] font-light max-w-xl mx-auto spotlight-content-reveal">
              {currentMsg.content}
            </p>

            {/* Violation — red annotation beneath */}
            {currentMsg.violatedProperties.length > 0 && (
              <div className="pt-2 space-y-1 spotlight-content-reveal" style={{ animationDelay: "0.4s" }}>
                {currentMsg.violatedProperties.map(prop => (
                  <p key={prop} className="text-[13px] text-red-500/70 dark:text-red-400/60 font-medium">
                    {getPropertyMeta(prop).failedLabel}
                  </p>
                ))}
              </div>
            )}

            {/* Milestone — chapter marker */}
            {currentMsg.milestoneHits.length > 0 && (
              <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-emerald-500/60 dark:text-emerald-400/50 spotlight-content-reveal" style={{ animationDelay: "0.3s" }}>
                {currentMsg.milestoneHits.map(m => m.replace(/_/g, " ")).join(" · ")}
              </p>
            )}
          </div>
        )}

        {/* ── The Verdict — the finale ── */}
        {showVerdict && results && <VerdictReveal results={results} messageCount={messages.length} />}
      </div>

      {/* Turn counter — whisper quiet */}
      {visibleUpTo >= 0 && !showVerdict && (
        <div className="pb-8">
          <span className="text-[11px] font-mono text-slate-300 dark:text-slate-600 tracking-widest">
            {visibleUpTo + 1} / {messages.length}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Verdict — the finale of the film.
 * Centered, large, dramatic. The "one more thing" moment.
 */
function VerdictReveal({ results, messageCount }: { results: PropertyResult[]; messageCount: number }) {
  const failures = results.filter(r => !r.passed);
  const passes = results.filter(r => r.passed);
  const allPassed = failures.length === 0;

  if (allPassed) {
    return (
      <div className="text-center space-y-6 spotlight-scene-enter">
        <div className="verdict-glow-pass rounded-3xl py-12 px-8">
          <div className="verdict-checkmark-reveal mb-6">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="mx-auto">
              <circle cx="28" cy="28" r="26" stroke="#10b981" strokeWidth="1.5" opacity="0.25" />
              <path d="M16 28l8 8 16-16" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">
            All checks passed
          </h2>
          <p className="text-sm text-emerald-600/50 dark:text-emerald-400/40 font-light mt-2">
            {passes.length} safety {passes.length === 1 ? "check" : "checks"} verified across {messageCount} messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-8 spotlight-scene-enter max-w-lg mx-auto">
      <div className="verdict-glow-fail rounded-3xl py-12 px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-red-700 dark:text-red-400 tracking-tight">
          {failures.length} {failures.length === 1 ? "check" : "checks"} failed
        </h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 font-light mt-3">
          {passes.length} passed · {failures.length} failed
        </p>
      </div>

      {/* Individual failures — staggered entrance */}
      <div className="space-y-3 text-left">
        {failures.map((f, i) => {
          const meta = getPropertyMeta(f.property_name);
          return (
            <div
              key={f.property_name}
              className="rounded-2xl bg-red-50/30 dark:bg-red-500/[0.03] px-6 py-4 verdict-failure-card"
              style={{ animationDelay: `${(i + 1) * 300}ms` }}
            >
              <p className="text-[13px] font-semibold text-red-700 dark:text-red-400">{meta.failedLabel}</p>
              <p className="text-xs text-red-500/50 dark:text-red-400/40 mt-1.5 leading-relaxed">{f.details}</p>
            </div>
          );
        })}
      </div>

      {/* Passed — understated */}
      {passes.length > 0 && (
        <p className="text-xs text-slate-400/60 dark:text-slate-500/60 font-light leading-relaxed">
          Passed: {passes.map(p => getPropertyMeta(p.property_name).label).join(", ")}
        </p>
      )}
    </div>
  );
}
