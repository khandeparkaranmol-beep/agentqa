import { useState, useEffect, useRef, useMemo } from "react";
import type { MessageEvent, PropertyResult } from "../types";
import { getFaultLabel, getPropertyMeta, agentColor as getAgentColor, AGENT_COLORS } from "../labels";

interface Props {
  agents: string[];
  agentRoles?: Record<string, string>;
  messages: MessageEvent[];
  results?: PropertyResult[];
  visibleUpTo: number;
  speed?: number;
}

interface ConnectionData {
  from: string;
  to: string;
  count: number;
  hasViolation: boolean;
}

/**
 * Constellation View — agents as stars, connections as light.
 *
 * Agents rest on a faint orbital ring. As messages flow,
 * thin lines of light connect them — brightening with use,
 * glowing on the current turn. The active pair illuminates;
 * the rest hold a quiet vigil.
 *
 * Below the constellation, the current message appears.
 * This is a map of relationships, not a transcript.
 */
export function ConstellationView({ agents, agentRoles: _agentRoles, messages, results: _results, visibleUpTo, speed = 1 }: Props) {
  const [isTyping, setIsTyping] = useState(false);
  // Mount mid-playback: show content up to current turn immediately
  const [displayedIdx, setDisplayedIdx] = useState(visibleUpTo);
  const prevVisibleRef = useRef(visibleUpTo);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agentColor = (name: string) => getAgentColor(agents, name);

  // Typing state machine
  useEffect(() => {
    const prev = prevVisibleRef.current;
    if (visibleUpTo > prev && visibleUpTo >= 0) {

      setIsTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      const duration = Math.max(150, 800 / speed);
      typingTimerRef.current = setTimeout(() => {
        setIsTyping(false);
        setDisplayedIdx(visibleUpTo);
      }, duration);
    } else if (visibleUpTo < prev) {

      setIsTyping(false);
      setDisplayedIdx(visibleUpTo);
    } else if (visibleUpTo === -1 && prev !== -1) {

      setIsTyping(false);
      setDisplayedIdx(-1);
    }
    prevVisibleRef.current = visibleUpTo;
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [visibleUpTo, speed]);

  // No verdict in Constellation — the sidebar's Failed Checks panel handles this

  const currentMsg = displayedIdx >= 0 && displayedIdx < messages.length
    ? messages[displayedIdx]
    : null;

  // Build connection map from all visible messages
  const connections = useMemo(() => {
    const map = new Map<string, ConnectionData>();
    for (let i = 0; i <= Math.min(displayedIdx, messages.length - 1); i++) {
      if (i < 0) continue;
      const msg = messages[i];
      const key = [msg.sender, msg.receiver].sort().join("↔");
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (msg.violatedProperties.length > 0) existing.hasViolation = true;
      } else {
        map.set(key, {
          from: msg.sender,
          to: msg.receiver,
          count: 1,
          hasViolation: msg.violatedProperties.length > 0,
        });
      }
    }
    return Array.from(map.values());
  }, [displayedIdx, messages]);

  const maxCount = useMemo(() => Math.max(1, ...connections.map(c => c.count)), [connections]);

  // Layout constants
  const SIZE = 380;
  const CENTER = SIZE / 2;
  const RADIUS = 140;
  const NODE_R = 20;

  const agentPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    agents.forEach((agent, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / agents.length;
      positions[agent] = {
        x: CENTER + RADIUS * Math.cos(angle),
        y: CENTER + RADIUS * Math.sin(angle),
      };
    });
    return positions;
  }, [agents]);

  // Gentle arc — curves perpendicular to the straight line, not toward center
  // Starts/ends at node edge (offset by NODE_R), not at center
  const connectionPath = (from: string, to: string): string => {
    const p1 = agentPositions[from];
    const p2 = agentPositions[to];
    if (!p1 || !p2) return "";

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return "";

    // Unit vector from → to
    const ux = dx / dist;
    const uy = dy / dist;

    // Offset start/end to node edges (+ small gap for arrowhead at receiver)
    const startX = p1.x + ux * (NODE_R + 2);
    const startY = p1.y + uy * (NODE_R + 2);
    const endX = p2.x - ux * (NODE_R + 5);
    const endY = p2.y - uy * (NODE_R + 5);

    // Perpendicular bow — 12% of distance
    const bow = dist * 0.12;
    const nx = -uy;
    const ny = ux;
    const mx = (startX + endX) / 2 + nx * bow;
    const my = (startY + endY) / 2 + ny * bow;

    return `M ${startX} ${startY} Q ${mx} ${my} ${endX} ${endY}`;
  };

  return (
    <div className="relative flex flex-col items-center min-h-[55vh] pb-16">

      {/* ── The Constellation ── */}
      <div className="w-full flex justify-center pt-2 pb-2">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[340px] sm:max-w-[380px]"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Soft glow for active connection */}
            <filter id="conn-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
            </filter>
            {/* Soft glow for active node */}
            <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
            {/* Direction arrowheads — per agent color */}
            {AGENT_COLORS.map((color, i) => (
              <marker key={`arr-${i}`} id={`constellation-arrow-${i}`} markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <path d="M0,0.8 L5,3 L0,5.2" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />
              </marker>
            ))}
            <marker id="constellation-arrow-violation" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0.8 L5,3 L0,5.2" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />
            </marker>
            <marker id="constellation-arrow-muted" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0.8 L5,3 L0,5.2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
            </marker>
          </defs>

          {/* Orbital ring — whisper-thin structure */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-slate-200 dark:text-slate-800"
            strokeDasharray="2 6"
          />

          {/* Connections — thin lines of light */}
          {connections.map((conn) => {
            const path = connectionPath(conn.from, conn.to);
            const isActive = currentMsg && (
              (currentMsg.sender === conn.from && currentMsg.receiver === conn.to) ||
              (currentMsg.sender === conn.to && currentMsg.receiver === conn.from)
            );
            // Thickness: 0.75px base → 2px for heaviest connections
            const thickness = 0.75 + (conn.count / maxCount) * 1.25;
            // Opacity: scales with message count, active gets a boost
            const baseOpacity = 0.08 + (conn.count / maxCount) * 0.15;
            const senderIdx = agents.indexOf(conn.from);
            const color = conn.hasViolation
              ? "#ef4444"
              : isActive && currentMsg
                ? agentColor(currentMsg.sender)
                : "currentColor";
            const arrowId = conn.hasViolation
              ? "url(#constellation-arrow-violation)"
              : isActive
                ? `url(#constellation-arrow-${senderIdx % AGENT_COLORS.length})`
                : "url(#constellation-arrow-muted)";

            return (
              <g key={`${conn.from}↔${conn.to}`}>
                {/* Glow layer — active only */}
                {isActive && (
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={thickness + 3}
                    strokeLinecap="round"
                    opacity="0.15"
                    filter="url(#conn-glow)"
                  />
                )}
                {/* The connection line */}
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  markerEnd={arrowId}
                  opacity={isActive ? 0.6 : baseOpacity}
                  className={isActive ? "" : "text-slate-400 dark:text-slate-500"}
                />
              </g>
            );
          })}

          {/* Agent nodes */}
          {agents.map((agent, i) => {
            const pos = agentPositions[agent];
            const color = AGENT_COLORS[i % AGENT_COLORS.length];
            const isSpeaking = currentMsg?.sender === agent;
            const isReceiving = currentMsg?.receiver === agent;
            const nodeOpacity = isSpeaking ? 1 : isReceiving ? 0.75 : displayedIdx >= 0 ? 0.35 : 0.55;

            return (
              <g key={agent}>
                {/* Glow — speaker only, behind everything */}
                {isSpeaking && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={NODE_R + 4}
                    fill={color}
                    opacity="0.2"
                    filter="url(#node-glow)"
                    className="constellation-node-breathe"
                  />
                )}

                {/* Active ring — speaker gets a bright ring, receiver gets a subtle one */}
                {(isSpeaking || isReceiving) && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={NODE_R + 3}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSpeaking ? 1.5 : 0.75}
                    opacity={isSpeaking ? 0.5 : 0.25}
                  />
                )}

                {/* Node circle — fixed size, opacity communicates state */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={NODE_R}
                  fill={color}
                  opacity={nodeOpacity}
                />

                {/* Initial letter */}
                <text
                  x={pos.x}
                  y={pos.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="12"
                  fontWeight="600"
                  fill="white"
                  opacity={nodeOpacity}
                >
                  {agent.charAt(0).toUpperCase()}
                </text>

                {/* Agent name */}
                <text
                  x={pos.x}
                  y={pos.y + NODE_R + 14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="500"
                  opacity={isSpeaking ? 0.9 : isReceiving ? 0.5 : 0.3}
                  className="fill-slate-600 dark:fill-slate-400"
                  style={{ textTransform: "capitalize" }}
                >
                  {agent}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Thin separator */}
      <div className="w-full max-w-md mx-auto h-px bg-gradient-to-r from-transparent via-slate-200/50 dark:via-slate-700/30 to-transparent" />

      {/* ── The Scene — message content ── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-6 sm:px-12 py-4 sm:py-6">

        {/* Pre-play */}
        {visibleUpTo < 0 && !isTyping && (
          <p className="text-base font-light text-slate-400 dark:text-slate-500 tracking-wide spotlight-scene-enter">
            Connections will appear as agents interact.
          </p>
        )}

        {/* Typing */}
        {isTyping && visibleUpTo >= 0 && visibleUpTo < messages.length && (
          <div className="flex flex-col items-center gap-3 spotlight-scene-enter">
            <div className="flex items-center gap-2">
              <span className="typing-dot" style={{ backgroundColor: agentColor(messages[visibleUpTo].sender), animationDelay: "0ms" }} />
              <span className="typing-dot" style={{ backgroundColor: agentColor(messages[visibleUpTo].sender), animationDelay: "200ms" }} />
              <span className="typing-dot" style={{ backgroundColor: agentColor(messages[visibleUpTo].sender), animationDelay: "400ms" }} />
            </div>
          </div>
        )}

        {/* Current message */}
        {!isTyping && currentMsg && (
          <div key={displayedIdx} className="text-center space-y-6 spotlight-scene-enter w-full">

            {currentMsg.hasFault && (
              <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-orange-500/60 dark:text-orange-400/50">
                {getFaultLabel(currentMsg.faultType).label} injected
              </p>
            )}

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

            <p className="text-base sm:text-lg text-slate-700 dark:text-slate-200/90 leading-[1.9] font-light max-w-xl mx-auto spotlight-content-reveal">
              {currentMsg.content}
            </p>

            {currentMsg.violatedProperties.length > 0 && (
              <div className="pt-2 space-y-1 spotlight-content-reveal" style={{ animationDelay: "0.4s" }}>
                {currentMsg.violatedProperties.map(prop => (
                  <p key={prop} className="text-[13px] text-red-500/70 dark:text-red-400/60 font-medium">
                    {getPropertyMeta(prop).failedLabel}
                  </p>
                ))}
              </div>
            )}

            {currentMsg.milestoneHits.length > 0 && (
              <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-emerald-500/60 dark:text-emerald-400/50 spotlight-content-reveal" style={{ animationDelay: "0.3s" }}>
                {currentMsg.milestoneHits.map(m => m.replace(/_/g, " ")).join(" · ")}
              </p>
            )}
          </div>
        )}

      </div>

      {/* Turn counter */}
      {visibleUpTo >= 0 && (
        <div className="pb-8">
          <span className="text-[11px] font-mono text-slate-300 dark:text-slate-600 tracking-widest">
            {visibleUpTo + 1} / {messages.length}
          </span>
        </div>
      )}
    </div>
  );
}

