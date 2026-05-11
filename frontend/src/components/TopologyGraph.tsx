import { useMemo } from "react";
import type { MessageEvent } from "../types";
import { AGENT_COLORS } from "../labels";

interface Props {
  messages: MessageEvent[];
  agents: string[];
  topology?: string;
}

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

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 44;
  const nodeR = 14;

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
    <div className="rounded-2xl border border-slate-200/30 dark:border-slate-700/20 bg-white/50 dark:bg-slate-800/30 backdrop-blur-xl overflow-hidden">
      {/* Header — minimal */}
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-medium">Communication Graph</span>
        {topology && (
          <span className="text-[10px] text-slate-300 dark:text-slate-600">
            {topology}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center py-3 pb-5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <marker id="topo-arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
              <path d="M0,0.5 L4.5,2.5 L0,4.5 Z" fill="currentColor" opacity="0.4" />
            </marker>
          </defs>

          {/* Orbital ring — subtle reference */}
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />

          {/* Edges — perpendicular bow curves */}
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / dist;
            const ny = dy / dist;

            const startX = from.x + nx * (nodeR + 2);
            const startY = from.y + ny * (nodeR + 2);
            const endX = to.x - nx * (nodeR + 5);
            const endY = to.y - ny * (nodeR + 5);

            // Perpendicular bow
            const mx = (startX + endX) / 2;
            const my = (startY + endY) / 2;
            const bow = dist * 0.12;
            const perpX = -ny * bow;
            const perpY = nx * bow;

            const strokeWidth = 0.75 + (edge.count / maxCount) * 1.25;
            const opacity = 0.15 + (edge.count / maxCount) * 0.35;

            const fromIdx = agents.indexOf(edge.from);
            const color = AGENT_COLORS[fromIdx % AGENT_COLORS.length];

            return (
              <g key={`${edge.from}→${edge.to}`}>
                <path
                  d={`M ${startX} ${startY} Q ${mx + perpX} ${my + perpY} ${endX} ${endY}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  markerEnd="url(#topo-arrow)"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {agents.map((agent, i) => {
            const pos = positions.get(agent)!;
            const color = AGENT_COLORS[i % AGENT_COLORS.length];
            return (
              <g key={agent}>
                {/* Glow */}
                <circle cx={pos.x} cy={pos.y} r={nodeR + 4} fill={color} opacity={0.06} />
                {/* Ring */}
                <circle cx={pos.x} cy={pos.y} r={nodeR} fill="none" stroke={color} strokeWidth={1} opacity={0.25} />
                {/* Core */}
                <circle cx={pos.x} cy={pos.y} r={4} fill={color} opacity={0.7} />
                {/* Label */}
                <text
                  x={pos.x}
                  y={pos.y + nodeR + 12}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={500}
                  fill="currentColor"
                  opacity={0.4}
                  fontFamily="system-ui, sans-serif"
                >
                  {agent}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
