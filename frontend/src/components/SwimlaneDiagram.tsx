import { useState, useRef, useEffect, useMemo } from "react";
import type { MessageEvent } from "../types";
import { getPropertyMeta, getFaultLabel, AGENT_COLORS } from "../labels";

interface Props {
  agents: string[];
  messages: MessageEvent[];
  onSelect: (msg: MessageEvent | null) => void;
  selected: MessageEvent | null;
  visibleUpTo: number;
  highlightedIndices?: Set<number>;
  darkMode?: boolean;
}

const LANE_HEIGHT = 88;
const LANE_HEADER = 150;
const TURN_WIDTH = 140;
const ARROW_Y_OFFSET = 36;
const MESSAGE_PREVIEW_CHARS = 50;

/* ── SVG animation keyframes ────────────────────────────────────────── */
const SVG_STYLES = `
  @keyframes drawArrow {
    from { stroke-dashoffset: var(--arrow-len); }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes nodePopIn {
    0%   { transform: scale(0); opacity: 0; }
    50%  { transform: scale(1.3); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes dotFadeIn {
    from { opacity: 0; transform: scale(0); }
    to   { opacity: 0.35; transform: scale(1); }
  }
  @keyframes badgePopIn {
    0%   { transform: scale(0) translateY(4px); opacity: 0; }
    60%  { transform: scale(1.1) translateY(-1px); opacity: 1; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes textSlideUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseRing {
    0%   { r: 5; opacity: 0.6; stroke-width: 2; }
    100% { r: 18; opacity: 0; stroke-width: 0.5; }
  }
  @keyframes glowPulse {
    0%, 100% { opacity: 0.06; }
    50%      { opacity: 0.12; }
  }
  @keyframes playheadPulse {
    0%, 100% { opacity: 0.12; }
    50%      { opacity: 0.22; }
  }
  @keyframes columnFlash {
    0%   { opacity: 0; }
    30%  { opacity: 1; }
    100% { opacity: 1; }
  }
`;

export function SwimlaneDiagram({ agents, messages, onSelect, selected, visibleUpTo, highlightedIndices, darkMode }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevVisibleRef = useRef(visibleUpTo);
  const isDark = darkMode ?? false;

  const totalTurns = messages.length;
  const svgWidth = totalTurns * TURN_WIDTH + TURN_WIDTH;
  const svgHeight = agents.length * LANE_HEIGHT + 32;

  const agentIndex = (name: string) => agents.indexOf(name);
  const agentColor = (name: string) => AGENT_COLORS[agentIndex(name) % AGENT_COLORS.length];
  const laneY = (name: string) => agentIndex(name) * LANE_HEIGHT + ARROW_Y_OFFSET;

  // Track which messages are "newly revealed" for entrance animations
  const newlyRevealed = useMemo(() => {
    const prev = prevVisibleRef.current;
    const set = new Set<number>();
    if (visibleUpTo > prev) {
      for (let i = prev + 1; i <= visibleUpTo; i++) {
        set.add(i);
      }
    }
    return set;
  }, [visibleUpTo]);

  // Update prev ref AFTER render so animations trigger on the right frame
  useEffect(() => {
    prevVisibleRef.current = visibleUpTo;
  }, [visibleUpTo]);

  // Auto-scroll to keep current turn visible
  useEffect(() => {
    if (visibleUpTo < 0 || !scrollRef.current) return;
    const x = visibleUpTo * TURN_WIDTH + TURN_WIDTH / 2;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const clientWidth = container.clientWidth;
    if (x < scrollLeft + 40 || x > scrollLeft + clientWidth - 60) {
      container.scrollTo({ left: Math.max(0, x - clientWidth / 2), behavior: "smooth" });
    }
  }, [visibleUpTo]);

  return (
    <div
      className="rounded-2xl border border-slate-200/30 dark:border-slate-700/20 bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl shadow-sm shadow-black/[0.03] dark:shadow-black/20 flex"
    >
      {/* ── Frozen agent name column ── */}
      <div className="flex-shrink-0 z-10 border-r" style={{ width: LANE_HEADER, borderColor: isDark ? "rgba(51,65,85,0.3)" : "rgba(229,231,235,0.6)" }}>
        {agents.map((agent, i) => {
          const color = AGENT_COLORS[i % AGENT_COLORS.length];
          const initial = agent.charAt(0).toUpperCase();
          return (
            <div
              key={agent}
              className="flex items-center gap-2.5 px-3"
              style={{
                height: LANE_HEIGHT,
                background: isDark
                  ? (i % 2 === 0 ? "rgba(30,41,59,0.5)" : "rgba(26,35,50,0.5)")
                  : (i % 2 === 0 ? "rgba(250,251,252,0.6)" : "rgba(246,247,249,0.6)"),
                borderLeft: `3px solid`,
                borderLeftColor: color,
                borderLeftStyle: "solid",
                opacity: 0.999, // force compositing layer
              }}
            >
              <div className="relative flex-shrink-0" style={{ width: 28, height: 28 }}>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: color, opacity: 0.1 }}
                />
                <div
                  className="absolute inset-0 rounded-full border-[1.5px]"
                  style={{ borderColor: color, opacity: 0.35 }}
                />
                <span
                  className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                  style={{ color, fontFamily: "system-ui, sans-serif" }}
                >
                  {initial}
                </span>
              </div>
              <span
                className="text-[13px] font-semibold truncate"
                style={{ color: isDark ? "#cbd5e1" : "#334155", fontFamily: "system-ui, sans-serif" }}
              >
                {agent}
              </span>
            </div>
          );
        })}
        {/* Bottom spacer for turn labels row */}
        <div style={{ height: 32 }} />
      </div>

      {/* ── Scrollable timeline area ── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto flex-1 min-w-0"
        style={{ scrollbarWidth: "thin" }}
      >
      <svg
        width={svgWidth}
        height={svgHeight}
        className="block select-none"
        style={{ minWidth: svgWidth }}
      >
        <defs>
          <style>{SVG_STYLES}</style>

          {/* Arrow markers per agent color */}
          {AGENT_COLORS.map((color, i) => (
            <marker key={`arrow-${i}`} id={`arrow-agent-${i}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,1 L7,4 L0,7 Z" fill={color} opacity="0.8" />
            </marker>
          ))}
          <marker id="arrow-violation" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,1 L7,4 L0,7 Z" fill="#ef4444" />
          </marker>
          <marker id="arrow-fault" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,1 L7,4 L0,7 Z" fill="#f97316" />
          </marker>

          {/* Column glow gradients */}
          <linearGradient id="violation-glow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="violation-glow-dark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.06" />
            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="fault-glow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.03" />
            <stop offset="50%" stopColor="#f97316" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="current-glow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.04" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.04" />
          </linearGradient>

          {/* Playhead gradient */}
          <linearGradient id="playhead-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
            <stop offset="20%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="80%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Lane backgrounds */}
        {agents.map((agent, i) => (
          <rect
            key={`lane-${agent}`}
            x={0}
            y={i * LANE_HEIGHT}
            width={svgWidth}
            height={LANE_HEIGHT}
            fill={isDark ? (i % 2 === 0 ? "rgba(30,41,59,0.5)" : "rgba(26,35,50,0.5)") : (i % 2 === 0 ? "rgba(250,251,252,0.6)" : "rgba(246,247,249,0.6)")}
          />
        ))}

        {/* Lane dividers */}
        {agents.map((_, i) => (
          <line
            key={`div-${i}`}
            x1={0}
            y1={(i + 1) * LANE_HEIGHT}
            x2={svgWidth}
            y2={(i + 1) * LANE_HEIGHT}
            stroke={isDark ? "rgba(51,65,85,0.3)" : "rgba(226,232,240,0.4)"}
            strokeWidth={1}
          />
        ))}

        {/* (Agent headers are in the frozen HTML column outside the SVG) */}

        {/* Playhead — gradient line with pulse */}
        {visibleUpTo >= 0 && visibleUpTo < totalTurns && (
          <g>
            <rect
              x={visibleUpTo * TURN_WIDTH + TURN_WIDTH / 2 - 1}
              y={0}
              width={2}
              height={svgHeight - 32}
              fill="url(#playhead-grad)"
              style={{ animation: "playheadPulse 1.5s ease-in-out infinite" }}
            />
          </g>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => {
          const x = idx * TURN_WIDTH + TURN_WIDTH / 2;
          const fromY = laneY(msg.sender);
          const toY = laneY(msg.receiver);
          const isSelf = msg.sender === msg.receiver || !agents.includes(msg.receiver);
          const isSelected = selected?.turn === msg.turn;
          const isHovered = hoveredIdx === idx;
          const isViolation = msg.violatedProperties.length > 0;
          const isFault = msg.hasFault;
          const isMilestone = msg.milestoneHits.length > 0;
          const isFuture = idx > visibleUpTo;
          const isCurrent = idx === visibleUpTo;
          const isFiltered = highlightedIndices !== undefined && !highlightedIndices.has(idx);
          const dimmed = isFuture || isFiltered;
          const opacity = dimmed ? 0.06 : 1;
          const color = isViolation ? "#ef4444" : isFault ? "#f97316" : agentColor(msg.sender);
          const agentIdx = agentIndex(msg.sender);
          const markerEnd = isViolation ? "url(#arrow-violation)" : isFault ? "url(#arrow-fault)" : `url(#arrow-agent-${agentIdx % AGENT_COLORS.length})`;

          // Is this message freshly entering the viewport?
          const isEntering = newlyRevealed.has(idx);
          const arrowLen = Math.abs(toY - fromY);

          const preview = msg.content.length > MESSAGE_PREVIEW_CHARS
            ? msg.content.slice(0, MESSAGE_PREVIEW_CHARS) + "…"
            : msg.content;

          return (
            <g
              key={msg.turn}
              onClick={() => !isFuture && onSelect(isSelected ? null : msg)}
              onMouseEnter={() => !isFuture && setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                cursor: isFuture ? "default" : "pointer",
                opacity,
                transition: isFuture ? "opacity 0.15s ease" : "opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {/* Column glow zones with flash-in */}
              {isViolation && !dimmed && (
                <rect
                  x={x - TURN_WIDTH / 2} y={0}
                  width={TURN_WIDTH} height={svgHeight - 32}
                  fill={isDark ? "url(#violation-glow-dark)" : "url(#violation-glow)"}
                  style={isEntering ? { animation: "columnFlash 0.4s ease-out both" } : undefined}
                />
              )}
              {isFault && !isViolation && !dimmed && (
                <rect
                  x={x - TURN_WIDTH / 2} y={0}
                  width={TURN_WIDTH} height={svgHeight - 32}
                  fill="url(#fault-glow)"
                  style={isEntering ? { animation: "columnFlash 0.4s ease-out both" } : undefined}
                />
              )}
              {isCurrent && !dimmed && !isViolation && !isFault && (
                <rect
                  x={x - TURN_WIDTH / 2} y={0}
                  width={TURN_WIDTH} height={svgHeight - 32}
                  fill="url(#current-glow)"
                  style={{ animation: "glowPulse 2s ease-in-out infinite" }}
                />
              )}

              {/* Selected border */}
              {isSelected && !dimmed && (
                <rect x={x - TURN_WIDTH / 2 + 2} y={2} width={TURN_WIDTH - 4} height={svgHeight - 36} fill="none" stroke={isDark ? "#6366f180" : "#6366f140"} strokeWidth={1.5} rx={8} />
              )}

              {/* Sender node — pops in FIRST */}
              <g style={isEntering ? {
                animation: "nodePopIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                transformOrigin: `${x}px ${fromY}px`,
              } as React.CSSProperties : undefined}>
                <circle
                  cx={x} cy={fromY}
                  r={isCurrent || isSelected || isHovered ? 7 : 5}
                  fill={isDark ? "rgba(30,41,59,0.8)" : "white"}
                  stroke={color}
                  strokeWidth={isCurrent ? 2.5 : 2}
                  style={{ transition: "r 0.15s ease" }}
                />
                <circle cx={x} cy={fromY} r={2.5} fill={color} />
              </g>

              {/* Arrow line — draws AFTER sender node appears (0.25s delay) */}
              {!isSelf && (
                <line
                  x1={x} y1={fromY} x2={x} y2={toY + (toY > fromY ? -6 : 6)}
                  stroke={color}
                  strokeWidth={isSelected || isHovered ? 2.5 : isCurrent ? 2 : 1.5}
                  strokeOpacity={isSelected || isHovered || isCurrent ? 1 : 0.6}
                  markerEnd={markerEnd}
                  strokeDasharray={isFault ? "6 3" : (isEntering ? `${arrowLen}` : undefined)}
                  strokeDashoffset={0}
                  style={{
                    ...(isEntering && !isFault ? {
                      '--arrow-len': `${arrowLen}`,
                      animation: `drawArrow 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both`,
                    } as React.CSSProperties : {}),
                    ...(isEntering && isFault ? {
                      opacity: 0,
                      animation: `dotFadeIn 0.3s ease 0.25s both`,
                    } : {}),
                    transition: "stroke-width 0.15s ease, stroke-opacity 0.15s ease",
                  }}
                />
              )}

              {/* Self-loop — delayed to match */}
              {isSelf && (
                <path
                  d={`M ${x} ${fromY - 6} C ${x + 28} ${fromY - 24}, ${x + 28} ${fromY + 12}, ${x} ${fromY + 12}`}
                  fill="none" stroke={color}
                  strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                  strokeOpacity={0.55}
                  style={isEntering ? {
                    strokeDasharray: "80",
                    '--arrow-len': '80',
                    animation: `drawArrow 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both`,
                  } as React.CSSProperties : undefined}
                />
              )}

              {/* Pulse ring on current turn — radiates outward */}
              {isCurrent && !dimmed && (
                <circle
                  cx={x} cy={fromY}
                  r={5}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.5}
                  style={{
                    animation: "pulseRing 1.2s ease-out infinite",
                    transformOrigin: `${x}px ${fromY}px`,
                  }}
                />
              )}

              {/* Receiver dot — appears AFTER arrow arrives (0.65s delay) */}
              {!isSelf && !dimmed && (
                <circle
                  cx={x} cy={toY} r={3}
                  fill={color} opacity={isEntering ? 0 : 0.35}
                  style={isEntering ? {
                    animation: "dotFadeIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) 0.65s both",
                    transformOrigin: `${x}px ${toY}px`,
                  } as React.CSSProperties : undefined}
                />
              )}

              {/* Inline message preview — appears after arrow arrives */}
              {!dimmed && (
                <foreignObject
                  x={x - TURN_WIDTH / 2 + 8}
                  y={Math.max(fromY, toY) + 8}
                  width={TURN_WIDTH - 16}
                  height={LANE_HEIGHT - ARROW_Y_OFFSET - 4}
                  style={isEntering ? {
                    animation: "textSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) 0.6s both",
                  } : undefined}
                >
                  <div
                    style={{
                      fontSize: 10,
                      lineHeight: "13px",
                      color: isDark ? "#94a3b8" : "#64748b",
                      fontFamily: "system-ui, sans-serif",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical" as const,
                      padding: "2px 4px",
                      borderRadius: 4,
                      background: isHovered || isSelected
                        ? (isDark ? "rgba(51,65,85,0.5)" : "rgba(241,245,249,0.8)")
                        : "transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {preview}
                  </div>
                </foreignObject>
              )}

              {/* Turn label */}
              <text
                x={x} y={svgHeight - 10}
                textAnchor="middle" fontSize={10}
                fill={isViolation && !dimmed ? "#ef4444" : isFault && !dimmed ? "#f97316" : isCurrent ? "#6366f1" : isDark ? "#475569" : "#94a3b8"}
                fontWeight={isCurrent || isViolation ? 700 : 400}
                fontFamily="system-ui, sans-serif"
                style={isEntering ? { animation: "textSlideUp 0.3s ease 0.55s both" } : undefined}
              >
                T{msg.turn}
              </text>

              {/* Status badges — pop in after arrow arrives */}
              {isViolation && !dimmed && (() => {
                const badgeText = msg.violatedProperties.length > 0
                  ? getPropertyMeta(msg.violatedProperties[0]).badgeLabel
                  : "Issue Found";
                const badgeWidth = Math.max(60, badgeText.length * 6.5 + 16);
                const bx = x - badgeWidth / 2;
                const by = Math.min(fromY, toY) - 22;
                return (
                  <g style={isEntering ? {
                    animation: "badgePopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s both",
                    transformOrigin: `${x}px ${by + 9}px`,
                  } as React.CSSProperties : undefined}>
                    <rect x={bx} y={by} width={badgeWidth} height={18} rx={9} fill="#ef4444" opacity={0.9} />
                    <text x={x} y={by + 12.5} textAnchor="middle" fontSize={9} fontWeight={600} fill="white" fontFamily="system-ui, sans-serif">{badgeText}</text>
                  </g>
                );
              })()}
              {isFault && !isViolation && !dimmed && (() => {
                const faultInfo = getFaultLabel(msg.faultType);
                const badgeWidth = Math.max(50, faultInfo.badgeLabel.length * 6.5 + 16);
                const bx = x - badgeWidth / 2;
                const by = Math.min(fromY, toY) - 22;
                return (
                  <g style={isEntering ? {
                    animation: "badgePopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s both",
                    transformOrigin: `${x}px ${by + 9}px`,
                  } as React.CSSProperties : undefined}>
                    <rect x={bx} y={by} width={badgeWidth} height={18} rx={9} fill="#f97316" opacity={0.85} />
                    <text x={x} y={by + 12.5} textAnchor="middle" fontSize={9} fontWeight={600} fill="white" fontFamily="system-ui, sans-serif">{faultInfo.badgeLabel}</text>
                  </g>
                );
              })()}
              {isMilestone && !isViolation && !isFault && !dimmed && (
                <g style={isEntering ? {
                  animation: "badgePopIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s both",
                  transformOrigin: `${x}px ${Math.min(fromY, toY) - 12}px`,
                } as React.CSSProperties : undefined}>
                  <rect x={x - 8} y={Math.min(fromY, toY) - 20} width={16} height={16} rx={8} fill="#10b981" opacity={0.85} />
                  <text x={x} y={Math.min(fromY, toY) - 9} textAnchor="middle" fontSize={9} fill="white" fontFamily="system-ui, sans-serif">★</text>
                </g>
              )}

              {/* Hover tooltip */}
              {isHovered && !isSelected && !dimmed && (
                <foreignObject x={x - 120} y={Math.min(fromY, toY) - (isViolation || isFault ? 82 : 68)} width={240} height={isViolation || isFault ? 60 : 46}>
                  <div
                    style={{
                      background: isDark ? "rgba(15,23,42,0.95)" : "rgba(15,23,42,0.92)",
                      backdropFilter: "blur(8px)",
                      color: "white",
                      fontSize: 11,
                      padding: "6px 10px",
                      borderRadius: 10,
                      fontFamily: "system-ui, sans-serif",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                      lineHeight: "15px",
                      animation: "textSlideUp 0.15s ease both",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 10, opacity: 0.6, marginBottom: 2 }}>
                      {msg.sender} → {msg.receiver}
                    </div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {msg.content.slice(0, 100)}{msg.content.length > 100 ? "…" : ""}
                    </div>
                    {isViolation && (
                      <div style={{ fontSize: 9, color: "#fca5a5", marginTop: 3, fontWeight: 500 }}>
                        {msg.violatedProperties.map(p => getPropertyMeta(p).failedLabel).join(", ")}
                      </div>
                    )}
                    {isFault && !isViolation && (
                      <div style={{ fontSize: 9, color: "#fdba74", marginTop: 3, fontWeight: 500 }}>
                        {getFaultLabel(msg.faultType).label}
                      </div>
                    )}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}
