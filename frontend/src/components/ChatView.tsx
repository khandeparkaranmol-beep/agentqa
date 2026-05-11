import { useRef, useEffect, useState, useCallback } from "react";
import type { MessageEvent } from "../types";
import { getPropertyMeta, getFaultLabel, agentColor as getAgentColor } from "../labels";
import type { PropertyResult } from "../types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
      title="Copy message"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 7.5l2.5 2.5 4.5-5" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="5" width="7" height="7" rx="1.5" />
          <path d="M9 5V3.5A1.5 1.5 0 0 0 7.5 2h-4A1.5 1.5 0 0 0 2 3.5v4A1.5 1.5 0 0 0 3.5 9H5" />
        </svg>
      )}
    </button>
  );
}

interface Props {
  agents: string[];
  agentRoles?: Record<string, string>;
  messages: MessageEvent[];
  results?: PropertyResult[];
  onSelect: (msg: MessageEvent | null) => void;
  selected: MessageEvent | null;
  visibleUpTo: number;
  speed?: number;
}

/**
 * Cinematic conversation view.
 *
 * Dark-first glass-card design. Each message is a translucent card with
 * agent-colored accent bar and glowing avatar. Violations are dramatic
 * red-tinted inline alerts. The whole thing feels like watching a film.
 */
export function ChatView({ agents, agentRoles: _agentRoles, messages, results, onSelect, selected, visibleUpTo, speed = 1 }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevVisibleRef = useRef(visibleUpTo);
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agentColor = (name: string) => getAgentColor(agents, name);

  const agentInitial = (name: string) => name.charAt(0).toUpperCase();

  // When visibleUpTo advances, show typing indicator first, then reveal
  useEffect(() => {
    const prev = prevVisibleRef.current;
    if (visibleUpTo > prev && visibleUpTo >= 0) {
      setTypingIdx(visibleUpTo);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      const typingDuration = Math.max(150, 800 / speed);
      typingTimerRef.current = setTimeout(() => setTypingIdx(null), typingDuration);
    }
    prevVisibleRef.current = visibleUpTo;
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [visibleUpTo, speed]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (visibleUpTo >= 0 && bottomRef.current) {
      const t = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [visibleUpTo]);

  return (
    <div className="space-y-5">
      {/* Empty state — anticipation, not placeholder */}
      {visibleUpTo < 0 && typingIdx === null && (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center chat-entrance">
          <p className="text-base font-light text-slate-400 dark:text-slate-500 tracking-wide">
            The conversation is about to begin.
          </p>
        </div>
      )}

      {/* Message list */}
      {messages.map((msg, idx) => {
        const isVisible = idx <= visibleUpTo;
        const isNew = idx === visibleUpTo;
        const isTyping = idx === typingIdx;
        const isRevealing = isNew && !isTyping;
        const isSelected = selected?.turn === msg.turn;
        const color = agentColor(msg.sender);
        const isViolation = msg.violatedProperties.length > 0;
        const isFault = msg.hasFault;
        const isMilestone = msg.milestoneHits.length > 0;

        if (!isVisible) return null;

        // Typing indicator — minimal, like a held breath
        if (isTyping) {
          return (
            <div key={`typing-${msg.turn}`} className="chat-entrance">
              <div className="flex gap-4 items-center px-5 py-5 pl-6">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-[-3px] rounded-full blur-md hidden dark:block transition-opacity duration-1000" style={{ backgroundColor: color, opacity: 0.15 }} />
                  <div
                    className="relative w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold chat-avatar-pop"
                    style={{ backgroundColor: color }}
                  >
                    {agentInitial(msg.sender)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg">
                    <span className="typing-dot" style={{ backgroundColor: color, animationDelay: "0ms" }} />
                    <span className="typing-dot" style={{ backgroundColor: color, animationDelay: "200ms" }} />
                    <span className="typing-dot" style={{ backgroundColor: color, animationDelay: "400ms" }} />
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={msg.turn}>
            {/* Fault injection — a stage direction, not an alert */}
            {isFault && (
              <div className={`flex items-center justify-center py-3 ${isRevealing ? "chat-entrance" : ""}`}>
                <span className="text-[11px] font-medium tracking-wide text-orange-500/70 dark:text-orange-400/60 uppercase">
                  {getFaultLabel(msg.faultType).label} injected
                </span>
              </div>
            )}

            {/* Main message — quiet surface, color speaks through the avatar */}
            <div
              onClick={() => onSelect(isSelected ? null : msg)}
              className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 ${
                isSelected
                  ? "bg-indigo-50/50 dark:bg-indigo-500/[0.06] ring-1 ring-indigo-300/40 dark:ring-indigo-500/20"
                  : isViolation
                    ? "bg-red-50/30 dark:bg-red-500/[0.03]"
                    : "bg-white/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04]"
              } ${isRevealing ? "chat-entrance" : ""}`}
              style={{
                boxShadow: isSelected
                  ? undefined
                  : isViolation
                    ? "0 1px 3px rgba(239,68,68,0.06)"
                    : "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              {/* Agent color accent — a thin breath of color, not a bar */}
              <div
                className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-full ${isRevealing ? "chat-color-bar" : ""}`}
                style={{
                  backgroundColor: isViolation ? "#ef4444" : color,
                  opacity: isViolation ? 0.5 : 0.35,
                }}
              />

              <div className="flex gap-4 px-5 py-5 pl-6">
                {/* Avatar — restrained glow, the color is the identity */}
                <div className={`relative flex-shrink-0 mt-0.5 ${isRevealing ? "chat-avatar-pop" : ""}`}>
                  <div
                    className="absolute inset-[-3px] rounded-full blur-md hidden dark:block transition-opacity duration-1000"
                    style={{ backgroundColor: color, opacity: 0.15 }}
                  />
                  <div
                    className="relative w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold"
                    style={{ backgroundColor: color }}
                  >
                    {agentInitial(msg.sender)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header — clean attribution line */}
                  <div className={`flex items-center gap-2 mb-2.5 ${isRevealing ? "chat-name-slide" : ""}`}>
                    <span className="text-[13px] font-semibold tracking-tight" style={{ color }}>
                      {msg.sender}
                    </span>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-slate-300 dark:text-slate-600 flex-shrink-0">
                      <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[13px] font-medium text-slate-400 dark:text-slate-500">
                      {msg.receiver}
                    </span>
                    <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-mono text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        {msg.turn}
                      </span>
                      <CopyButton text={msg.content} />
                    </span>
                  </div>

                  {/* Body — the content is the product */}
                  <div className={isRevealing ? "chat-body-reveal" : ""}>
                    <p className="text-[15px] text-slate-700 dark:text-slate-200/90 leading-[1.8] whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>

                  {/* Token info — whisper-quiet metadata */}
                  {(msg.input_tokens > 0 || msg.output_tokens > 0) && (
                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      <span className="text-[10px] text-slate-400/70 dark:text-slate-500/70 tracking-wide">
                        {msg.input_tokens.toLocaleString()} in · {msg.output_tokens.toLocaleString()} out
                        {msg.cost_usd > 0 && ` · $${msg.cost_usd.toFixed(4)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Violation annotation — quiet but clear */}
            {isViolation && (
              <div className={`ml-[3.25rem] mt-1 ${isRevealing ? "chat-annotation-reveal" : ""}`}>
                {msg.violatedProperties.map((prop) => {
                  const meta = getPropertyMeta(prop);
                  return (
                    <div key={prop} className="flex items-center gap-2 py-1.5">
                      <div className="w-1 h-1 rounded-full bg-red-400 dark:bg-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-600/80 dark:text-red-400/70">
                        {meta.failedLabel}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Milestone — a quiet chapter break */}
            {isMilestone && (
              <div className={`flex items-center justify-center py-3 ${isRevealing ? "chat-entrance" : ""}`}>
                <span className="text-[11px] font-medium tracking-wide text-emerald-500/70 dark:text-emerald-400/60 uppercase">
                  {msg.milestoneHits.map((m) => m.replace(/_/g, " ")).join(" · ")}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />

      {/* ── The Verdict — the "one more thing" ── */}
      {visibleUpTo >= 0 && visibleUpTo >= messages.length - 1 && typingIdx === null && results && (() => {
        const failures = results.filter(r => !r.passed);
        const passes = results.filter(r => r.passed);
        const allPassed = failures.length === 0;
        return (
          <div className="chat-entrance pt-10 pb-6">
            {/* Dramatic spacing — let the last message settle before the reveal */}
            <div className="max-w-lg mx-auto text-center space-y-8">
              {/* The verdict headline — big, bold, unmissable */}
              {allPassed ? (
                <div className="verdict-glow-pass rounded-3xl py-10 px-8">
                  <div className="verdict-checkmark-reveal mb-5">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto">
                      <circle cx="24" cy="24" r="22" stroke="#10b981" strokeWidth="1.5" opacity="0.3" />
                      <path d="M14 24l7 7 13-13" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">
                    All checks passed
                  </h2>
                  <p className="text-sm text-emerald-600/60 dark:text-emerald-400/50 mt-3 font-light">
                    {passes.length} safety {passes.length === 1 ? "check" : "checks"} verified across {messages.length} messages
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="verdict-glow-fail rounded-3xl py-10 px-8">
                    <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 tracking-tight">
                      {failures.length} {failures.length === 1 ? "check" : "checks"} failed
                    </h2>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-3 font-light">
                      {passes.length} passed · {failures.length} failed
                    </p>
                  </div>

                  {/* Failure details — staggered entrance, each one a quiet punch */}
                  <div className="space-y-3 text-left">
                    {failures.map((f, i) => {
                      const meta = getPropertyMeta(f.property_name);
                      return (
                        <div
                          key={f.property_name}
                          className="rounded-2xl bg-red-50/30 dark:bg-red-500/[0.03] px-5 py-4 verdict-failure-card"
                          style={{ animationDelay: `${(i + 1) * 250}ms` }}
                        >
                          <p className="text-[13px] font-semibold text-red-700 dark:text-red-400">{meta.failedLabel}</p>
                          <p className="text-xs text-red-500/60 dark:text-red-400/40 mt-1 leading-relaxed">{f.details}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Passed checks — understated */}
                  {passes.length > 0 && (
                    <p className="text-xs text-slate-400/70 dark:text-slate-500/70 font-light leading-relaxed">
                      Passed: {passes.map(p => getPropertyMeta(p.property_name).label).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
