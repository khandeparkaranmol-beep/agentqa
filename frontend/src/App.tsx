import { useState, useEffect, useMemo, useCallback } from "react";
import { getAppData, buildMessageEvents, getAgents } from "./data";
import { useReplay } from "./hooks/useReplay";
import { SwimlaneDiagram } from "./components/SwimlaneDiagram";
import { ReplayControls } from "./components/ReplayControls";
import { FilterBar, EMPTY_FILTERS, hasActiveFilters } from "./components/FilterBar";
import type { Filters } from "./components/FilterBar";
import { MessagePanel } from "./components/MessagePanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { StateTimeline } from "./components/StateTimeline";
import { DiffView } from "./components/DiffView";
import { Dashboard } from "./components/Dashboard";
import type { MessageEvent } from "./types";

const TOPOLOGY_BADGES: Record<string, string> = {
  star: "bg-indigo-100 text-indigo-700",
  chain: "bg-violet-100 text-violet-700",
  tree: "bg-amber-100 text-amber-700",
  mesh: "bg-emerald-100 text-emerald-700",
};

export function App() {
  const data = getAppData();
  const [selected, setSelected] = useState<MessageEvent | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const isTrace = data.mode === "trace";
  const isDiff = data.mode === "diff";
  const isDashboard = data.mode === "dashboard";

  const agents = isTrace ? getAgents(data.events) : [];
  const messages = isTrace ? buildMessageEvents(data.events, data.results) : [];

  const replay = useReplay(messages.length);

  const highlightedIndices = useMemo(() => {
    if (!hasActiveFilters(filters)) return undefined;
    const indices = new Set<number>();
    const searchLower = filters.searchText.toLowerCase();
    messages.forEach((msg, i) => {
      if (filters.agents.size > 0 && !filters.agents.has(msg.sender) && !filters.agents.has(msg.receiver)) return;
      if (filters.showFaults === true && !msg.hasFault) return;
      if (filters.showFaults === false && msg.hasFault) return;
      if (filters.showViolations === true && msg.violatedProperties.length === 0) return;
      if (filters.showViolations === false && msg.violatedProperties.length > 0) return;
      if (searchLower && !msg.content.toLowerCase().includes(searchLower) && !msg.sender.toLowerCase().includes(searchLower) && !msg.receiver.toLowerCase().includes(searchLower)) return;
      indices.add(i);
    });
    return indices;
  }, [filters, messages]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isTrace) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          replay.stepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          replay.stepBack();
          break;
        case " ":
          e.preventDefault();
          replay.isPlaying ? replay.pause() : replay.play();
          break;
        case "Home":
          e.preventDefault();
          replay.jumpToStart();
          break;
        case "End":
          e.preventDefault();
          replay.jumpToEnd();
          break;
        case "Escape":
          e.preventDefault();
          setSelected(null);
          break;
      }
    },
    [isTrace, replay, setSelected],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const passCount = data.results.filter((r) => r.passed).length;
  const failCount = data.results.filter((r) => !r.passed).length;
  const totalCost = data.events.reduce((s, e) => s + e.cost_usd, 0);
  const totalTokens = data.events.reduce((s, e) => s + e.input_tokens + e.output_tokens, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2 flex-shrink-0">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect width="22" height="22" rx="6" fill="#6366f1" />
            <circle cx="7" cy="11" r="2.5" fill="white" />
            <circle cx="15" cy="7" r="2.5" fill="white" />
            <circle cx="15" cy="15" r="2.5" fill="white" />
            <line x1="9.2" y1="10" x2="13" y2="8" stroke="white" strokeWidth="1.5" />
            <line x1="9.2" y1="12" x2="13" y2="14" stroke="white" strokeWidth="1.5" />
          </svg>
          <span className="font-bold text-slate-800 text-sm">AgentQA</span>
          <span className="text-slate-300 text-sm">/</span>
          <span className="text-sm text-slate-600 truncate max-w-md">{data.title}</span>
        </div>

        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {data.topology && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TOPOLOGY_BADGES[data.topology] ?? "bg-slate-100 text-slate-600"}`}>
              {data.topology}
            </span>
          )}
          {isTrace && (
            <>
              {failCount > 0 && (
                <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {failCount} failed
                </span>
              )}
              {passCount > 0 && (
                <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {passCount} passed
                </span>
              )}
              {totalTokens > 0 && (
                <span className="text-xs text-slate-400">
                  {totalTokens.toLocaleString()} tokens
                  {totalCost > 0 && <span> · ${totalCost.toFixed(4)}</span>}
                </span>
              )}
            </>
          )}
          {data.agentqa_version && (
            <span className="text-xs text-slate-300">v{data.agentqa_version}</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="px-6 py-6 max-w-screen-2xl mx-auto">
        {isTrace && (
          <div className="flex gap-6">
            {/* Swimlane + controls + properties */}
            <div className="flex-1 min-w-0 space-y-4">
              <FilterBar allAgents={agents} filters={filters} onChange={setFilters} />
              <ReplayControls replay={replay} totalTurns={messages.length} />
              <SwimlaneDiagram
                agents={agents}
                messages={messages}
                onSelect={setSelected}
                selected={selected}
                visibleUpTo={replay.visibleUpTo}
                highlightedIndices={highlightedIndices}
              />
              <StateTimeline
                events={data.events}
                agents={agents}
                visibleUpTo={replay.visibleUpTo}
              />
              <PropertiesPanel results={data.results} />
            </div>

            {/* Side panel */}
            {selected && (
              <div className="w-96 flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden sticky top-20 self-start max-h-[calc(100vh-6rem)] flex flex-col">
                <MessagePanel message={selected} onClose={() => setSelected(null)} />
              </div>
            )}
          </div>
        )}

        {isDiff && data.trace_b && (
          <DiffView
            titleA={data.title}
            titleB={data.title_b ?? "Trace B"}
            eventsA={data.events}
            eventsB={data.trace_b}
            resultsA={data.results}
            resultsB={data.results_b ?? []}
          />
        )}

        {isDashboard && data.scenarios && (
          <Dashboard scenarios={data.scenarios} />
        )}
      </main>

      {/* Keyboard shortcut hint */}
      {isTrace && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity z-30 pointer-events-none">
          <span><kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">←</kbd> <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">→</kbd> step</span>
          <span><kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">Space</kbd> play/pause</span>
          <span><kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">Esc</kbd> deselect</span>
        </div>
      )}
    </div>
  );
}
