import { useState } from "react";

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

  const cycleToggle = (key: "showFaults" | "showViolations") => {
    const current = filters[key];
    const next = current === null ? true : current === true ? false : null;
    onChange({ ...filters, [key]: next });
  };

  const clearAll = () => onChange(EMPTY_FILTERS);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="1" y1="3.5" x2="13" y2="3.5" />
            <line x1="3" y1="7" x2="11" y2="7" />
            <line x1="5" y1="10.5" x2="9" y2="10.5" />
          </svg>
          Filters
          {active && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          )}
        </button>

        {/* Quick search — always visible */}
        <div className="flex-1 relative ml-2">
          <input
            type="text"
            value={filters.searchText}
            onChange={(e) => onChange({ ...filters, searchText: e.target.value })}
            placeholder="Search messages…"
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 pl-7 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-colors"
          />
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
          >
            <circle cx="5" cy="5" r="3.5" />
            <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" />
          </svg>
        </div>

        {active && (
          <button
            onClick={clearAll}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 flex flex-wrap items-center gap-3">
          {/* Agent chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 font-medium mr-1">Agents:</span>
            {allAgents.map((agent) => {
              const on = filters.agents.size === 0 || filters.agents.has(agent);
              return (
                <button
                  key={agent}
                  onClick={() => toggleAgent(agent)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    on
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  {agent}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-slate-200" />

          {/* Toggle chips */}
          <ToggleChip
            label="Faults"
            state={filters.showFaults}
            onClick={() => cycleToggle("showFaults")}
            activeColor="orange"
          />
          <ToggleChip
            label="Violations"
            state={filters.showViolations}
            onClick={() => cycleToggle("showViolations")}
            activeColor="red"
          />
        </div>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  state,
  onClick,
  activeColor,
}: {
  label: string;
  state: boolean | null;
  onClick: () => void;
  activeColor: "orange" | "red";
}) {
  const colors =
    activeColor === "orange"
      ? { on: "bg-orange-50 border-orange-200 text-orange-700", off: "bg-red-50 border-red-200 text-red-600" }
      : { on: "bg-red-50 border-red-200 text-red-700", off: "bg-emerald-50 border-emerald-200 text-emerald-600" };

  let cls = "bg-slate-50 border-slate-200 text-slate-500";
  let suffix = "";
  if (state === true) {
    cls = colors.on;
    suffix = " only";
  } else if (state === false) {
    cls = colors.off;
    suffix = " hidden";
  }

  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${cls}`}
    >
      {label}{suffix}
    </button>
  );
}
