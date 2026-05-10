import { useMemo } from "react";
import type { MessageEvent } from "../types";
import { InfoTip } from "./InfoTip";

interface Props {
  messages: MessageEvent[];
  agents: string[];
  topology?: string;
}

const AGENT_COLORS: string[] = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
];

interface Edge {
  from: string;
  to: string;
  count: number;
}

export function TopologyGraph({ messages, agents, topology }: Props) {
  const edges = useMemo(() => {
    const counts = new Map<string, number>();
    for (const msg of messages) {
      if (msg.sender === msg.receiver) continue;
      const key = `${msg.sender}→${msg.receiver}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const result: Edge[] = [];
    for (const [key, count] of counts) {
      const [from, to] = key.split("→");
      result.push({ from, to, count });
    }
    return result;
  }, [messages]);

  if (agents.length === 0) return null;

  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const nodeRadius = 18;

  const positions = new Map<string, { x: number; y: number }>();
  agents.forEach((agent, i) => {
    const angle = (2 * Math.PI * i) / agents.length - Math.PI / 2;
    positions.set(agent, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  const maxCount = Math.max(1, ...edges.map((e) => e.count));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Communication Graph</h2>
          <InfoTip text="Shows who talked to whom and how often. Thicker arrows = more messages. Numbers on edges show message count. Topology label (star/chain/tree/mesh) is auto-detected from the communication pattern." />
        </div>
        {topology && (
          <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            Topology: <span className="font-medium text-slate-700 dark:text-slate-300">{topology}</span>
          </span>
        )}
      </div>
      <div className="flex items-center justify-center py-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Edges */}
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / len;
            const ny = dy / len;

            const startX = from.x + nx * nodeRadius;
            const startY = from.y + ny * nodeRadius;
            const endX = to.x - nx * (nodeRadius + 6);
            const endY = to.y - ny * (nodeRadius + 6);

            const strokeWidth = 1 + (edge.count / maxCount) * 2.5;
            const opacity = 0.3 + (edge.count / maxCount) * 0.5;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const perpX = -ny * 8;
            const perpY = nx * 8;

            return (
              <g key={`${edge.from}→${edge.to}`}>
                <path
                  d={`M ${startX} ${startY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  markerEnd="url(#topo-arrow)"
                />
                <text
                  x={midX + perpX * 1.8}
                  y={midY + perpY * 1.8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="#94a3b8"
                  fontFamily="system-ui, sans-serif"
                >
                  {edge.count}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {agents.map((agent, i) => {
            const pos = positions.get(agent)!;
            const color = AGENT_COLORS[i % AGENT_COLORS.length];
            return (
              <g key={agent}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={nodeRadius}
                  fill={color}
                  opacity={0.15}
                  stroke={color}
                  strokeWidth={2}
                />
                <circle cx={pos.x} cy={pos.y} r={6} fill={color} />
                <text
                  x={pos.x}
                  y={pos.y + nodeRadius + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={color}
                  fontFamily="system-ui, sans-serif"
                >
                  {agent}
                </text>
              </g>
            );
          })}

          <defs>
            <marker id="topo-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>
      </div>
    </div>
  );
}
