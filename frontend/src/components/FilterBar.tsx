import { useState } from "react";
import { AGENT_COLORS } from "../labels";

export interface Filters {
  agents: Set<string>;
  showFaults: boolean | null;
  showViolations: boolean | null;
  searchText: string;
}

export const EMPTY_FILTERS: Filters = {
  agents: new Set(),
  showFaults: null,
  showViolations: null,
  searchText: "",
};

export function hasActiveFilters(f: Filters): boolean {
  return f.agents.size > 0 || f.showFaults !== null || f.showViolations !== null || f.searchText.length > 0;
}

interface Props {
  allAgents: string[];
  filters: Filters;
  onChange: (f: Filters) => void;
}

export function FilterBar({ allAgents, filters, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const active = hasActiveFilters(filters);

  const toggleAgent = (agent: string) => {
    const next = new Set(filters.agents);
    if (next.has(agent)) next.delete(agent);
    else next.add(agent);
    onChange({ ...filters, agents: next });
  };

  const clearAll = () => onChange(EMPTY_FILTERS);

  return (
    <div className="space-y-2">
      {/* Primary bar — floating pill style */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-full border border-slate-200/40 dark:border-slate-700/30 shadow-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full transition-all duration-200 ${
            expanded || active
              ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="3" x2="11" y2="3" />
            <line x1="3" y1="6" x2="9" y2="6" />
            <line x1="4.5" y1="9" x2="7.5" y2="9" />
          </svg>
          Filters
          {active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
        </button>

        {/* Search — inline, minimal */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={filters.searchText}
            onChange={(e) => onChange({ ...filters, searchText: e.target.value })}
            placeholder="Search messages..."
            className="w-full text-[11px] bg-transparent border-none rounded-full px-3 py-1 pl-6 text-slate-700 dark:text-slate-300 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none"
          />
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600"
          >
            <circle cx="4.5" cy="4.5" r="3" />
            <line x1="6.5" y1="6.5" x2="9" y2="9" />
          </svg>
        </div>

        {active && (
          <button
            onClick={clearAll}
            className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-400 dark:hover:text-red-400 transition-colors px-2 py-0.5 rounded-full hover:bg-red-50/50 dark:hover:bg-red-500/10"
          >
            Clear
          </button>
        )}
      </div>

      {/* Expanded filters — glass panel */}
      {expanded && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-slate-200/30 dark:border-slate-700/20 animate-fade-in flex-wrap">
          {/* Agent chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-slate-300 dark:text-slate-600 font-medium">Agents</span>
            {allAgents.map((agent, i) => {
              const on = filters.agents.size === 0 || filters.agents.has(agent);
              const color = AGENT_COLORS[i % AGENT_COLORS.length];
              return (
                <button
                  key={agent}
                  onClick={() => toggleAgent(agent)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    on
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-300 dark:text-slate-600"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 transition-opacity duration-200"
                    style={{ backgroundColor: color, opacity: on ? 1 : 0.25 }}
                  />
                  {agent}
                </button>
              );
            })}
          </div>

          <div className="w-px h-4 bg-slate-200/40 dark:bg-slate-700/30" />

          {/* Fault / Violation toggles */}
          <FilterToggle
            label="Faults"
            state={filters.showFaults}
            onChange={(v) => onChange({ ...filters, showFaults: v })}
            accentColor="orange"
          />
          <FilterToggle
            label="Violations"
            state={filters.showViolations}
            onChange={(v) => onChange({ ...filters, showViolations: v })}
            accentColor="red"
          />
        </div>
      )}
    </div>
  );
}

function FilterToggle({
  label,
  state,
  onChange,
  accentColor,
}: {
  label: string;
  state: boolean | null;
  onChange: (v: boolean | null) => void;
  accentColor: "orange" | "red";
}) {
  const options: { value: boolean | null; text: string }[] = [
    { value: null, text: "All" },
    { value: true, text: "Only" },
    { value: false, text: "Hide" },
  ];

  const dotColor = accentColor === "orange" ? "bg-orange-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-300 dark:text-slate-600 font-medium flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {label}
      </span>
      <div className="flex items-center bg-slate-100/50 dark:bg-slate-700/30 rounded-full p-0.5">
        {options.map((opt) => {
          const isActive = state === opt.value;
          return (
            <button
              key={String(opt.value)}
              onClick={() => onChange(opt.value)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all duration-150 ${
                isActive
                  ? "bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-sm"
                  : "text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300"
              }`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
