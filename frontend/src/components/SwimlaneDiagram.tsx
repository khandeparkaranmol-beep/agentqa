import { useState, useRef, useEffect } from "react";
import type { MessageEvent } from "../types";

interface Props {
  agents: string[];
  messages: MessageEvent[];
  onSelect: (msg: MessageEvent | null) => void;
  selected: MessageEvent | null;
  visibleUpTo: number;
  highlightedIndices?: Set<number>;
}

const LANE_HEIGHT = 72;
const LANE_HEADER = 160;
const TURN_WIDTH = 120;
const ARROW_Y_OFFSET = 36;
const AGENT_COLORS: string[] = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
];

export function SwimlaneDiagram({ agents, messages, onSelect, selected, visibleUpTo, highlightedIndices }: Props) {
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalTurns = messages.length;
  const svgWidth = LANE_HEADER + totalTurns * TURN_WIDTH + TURN_WIDTH;
  const svgHeight = agents.length * LANE_HEIGHT + 24;

  const agentIndex = (name: string) => agents.indexOf(name);
  const agentColor = (name: string) => AGENT_COLORS[agentIndex(name) % AGENT_COLORS.length];
  const laneY = (name: string) => agentIndex(name) * LANE_HEIGHT + ARROW_Y_OFFSET;

  useEffect(() => {
    if (visibleUpTo < 0 || !containerRef.current) return;
    const x = LANE_HEADER + visibleUpTo * TURN_WIDTH;
    const container = containerRef.current;
    const scrollLeft = container.scrollLeft;
    const clientWidth = container.clientWidth;
    if (x < scrollLeft + LANE_HEADER + 40 || x > scrollLeft + clientWidth - 60) {
      container.scrollTo({ left: Math.max(0, x - clientWidth / 2), behavior: "smooth" });
    }
  }, [visibleUpTo]);

  return (
    <div ref={containerRef} className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <svg
        width={svgWidth}
        height={svgHeight}
        className="block"
        style={{ minWidth: svgWidth }}
      >
        {/* Lane backgrounds */}
        {agents.map((agent, i) => (
          <rect
            key={agent}
            x={0}
            y={i * LANE_HEIGHT}
            width={svgWidth}
            height={LANE_HEIGHT}
            fill={i % 2 === 0 ? "#f8fafc" : "#f1f5f9"}
          />
        ))}

        {/* Lane headers */}
        {agents.map((agent, i) => (
          <g key={agent}>
            <rect x={0} y={i * LANE_HEIGHT} width={LANE_HEADER - 8} height={LANE_HEIGHT} fill={agentColor(agent)} opacity={0.12} rx={4} />
            <circle cx={20} cy={i * LANE_HEIGHT + ARROW_Y_OFFSET} r={10} fill={agentColor(agent)} />
            <text
              x={36}
              y={i * LANE_HEIGHT + ARROW_Y_OFFSET + 5}
              fontSize={13}
              fontWeight={600}
              fill={agentColor(agent)}
              fontFamily="system-ui, sans-serif"
            >
              {agent}
            </text>
          </g>
        ))}

        {/* Lane dividers */}
        {agents.map((_, i) => (
          <line
            key={i}
            x1={0}
            y1={(i + 1) * LANE_HEIGHT}
            x2={svgWidth}
            y2={(i + 1) * LANE_HEIGHT}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}

        {/* Vertical lane header separator */}
        <line x1={LANE_HEADER - 8} y1={0} x2={LANE_HEADER - 8} y2={svgHeight} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 2" />

        {/* Playhead line */}
        {visibleUpTo >= 0 && visibleUpTo < totalTurns && (
          <line
            x1={LANE_HEADER + visibleUpTo * TURN_WIDTH + TURN_WIDTH / 2}
            y1={0}
            x2={LANE_HEADER + visibleUpTo * TURN_WIDTH + TURN_WIDTH / 2}
            y2={svgHeight}
            stroke="#6366f1"
            strokeWidth={2}
            opacity={0.25}
            strokeDasharray="6 3"
          />
        )}

        {/* Messages */}
        {messages.map((msg, idx) => {
          const x = LANE_HEADER + idx * TURN_WIDTH + TURN_WIDTH / 2;
          const fromY = laneY(msg.sender);
          const toY = laneY(msg.receiver);
          const isSelf = msg.sender === msg.receiver || !agents.includes(msg.receiver);
          const isSelected = selected?.turn === msg.turn;
          const isHovered = hoveredTurn === msg.turn;
          const isViolation = msg.violatedProperties.length > 0;
          const isFault = msg.hasFault;
          const isMilestone = msg.milestoneHits.length > 0;

          const isFuture = idx > visibleUpTo;
          const isCurrent = idx === visibleUpTo;
          const isFiltered = highlightedIndices !== undefined && !highlightedIndices.has(idx);

          const dimmed = isFuture || isFiltered;
          const opacity = dimmed ? 0.12 : 1;

          const color = isViolation ? "#ef4444" : isFault ? "#f97316" : agentColor(msg.sender);
          const strokeW = isCurrent ? 3 : isSelected || isHovered ? 2.5 : 1.5;

          return (
            <g
              key={msg.turn}
              onClick={() => !isFuture && onSelect(isSelected ? null : msg)}
              onMouseEnter={() => !isFuture && setHoveredTurn(msg.turn)}
              onMouseLeave={() => setHoveredTurn(null)}
              style={{ cursor: isFuture ? "default" : "pointer", opacity, transition: "opacity 0.2s ease" }}
            >
              {/* Hover/selected highlight column */}
              {(isSelected || isHovered || isCurrent) && !dimmed && (
                <rect
                  x={x - TURN_WIDTH / 2}
                  y={0}
                  width={TURN_WIDTH}
                  height={svgHeight}
                  fill={isCurrent ? "#eef2ff" : isSelected ? "#eff6ff" : "#f8fafc"}
                  opacity={0.7}
                />
              )}

              {/* Arrow line */}
              {!isSelf && (
                <line
                  x1={x}
                  y1={fromY}
                  x2={x}
                  y2={toY}
                  stroke={color}
                  strokeWidth={strokeW}
                  markerEnd={`url(#arrow-${isViolation ? "red" : isFault ? "orange" : "default"})`}
                  strokeDasharray={isFault ? "5 3" : undefined}
                />
              )}

              {/* Self-loop for broadcast/system */}
              {isSelf && (
                <path
                  d={`M ${x} ${fromY - 8} C ${x + 30} ${fromY - 24}, ${x + 30} ${fromY + 8}, ${x} ${fromY + 8}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeW}
                />
              )}

              {/* Sender dot */}
              <circle cx={x} cy={fromY} r={isCurrent ? 8 : isSelected ? 7 : 5} fill={color} stroke="white" strokeWidth={isCurrent ? 2.5 : 1.5} />

              {/* Turn label */}
              <text
                x={x}
                y={svgHeight - 6}
                textAnchor="middle"
                fontSize={10}
                fill={isCurrent ? "#6366f1" : "#94a3b8"}
                fontWeight={isCurrent ? 700 : 400}
                fontFamily="system-ui, sans-serif"
              >
                T{msg.turn}
              </text>

              {/* Fault badge */}
              {isFault && !dimmed && (
                <g>
                  <circle cx={x + 10} cy={fromY - 10} r={7} fill="#f97316" />
                  <text x={x + 10} y={fromY - 6} textAnchor="middle" fontSize={8} fill="white" fontFamily="system-ui">!</text>
                </g>
              )}

              {/* Violation badge */}
              {isViolation && !dimmed && (
                <g>
                  <circle cx={x + 10} cy={fromY - 10} r={7} fill="#ef4444" />
                  <text x={x + 10} y={fromY - 6} textAnchor="middle" fontSize={8} fill="white" fontFamily="system-ui">✗</text>
                </g>
              )}

              {/* Milestone badge */}
              {isMilestone && !isViolation && !isFault && !dimmed && (
                <g>
                  <circle cx={x + 10} cy={fromY - 10} r={7} fill="#10b981" />
                  <text x={x + 10} y={fromY - 6} textAnchor="middle" fontSize={8} fill="white" fontFamily="system-ui">★</text>
                </g>
              )}

              {/* Message preview on hover */}
              {isHovered && !isSelected && !dimmed && (
                <foreignObject x={x - 80} y={Math.min(fromY, toY) - 42} width={160} height={36}>
                  <div
                    style={{
                      background: "rgba(15,23,42,0.9)",
                      color: "white",
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "system-ui",
                    }}
                  >
                    {msg.content.slice(0, 60)}{msg.content.length > 60 ? "…" : ""}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}

        {/* Arrow markers */}
        <defs>
          <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" />
          </marker>
          <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#ef4444" />
          </marker>
          <marker id="arrow-orange" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#f97316" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
