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
import { CostBreakdown } from "./components/CostBreakdown";
import { TopologyGraph } from "./components/TopologyGraph";
import { DiffView } from "./components/DiffView";
import { Dashboard } from "./components/Dashboard";
import { InfoTip } from "./components/InfoTip";
import type { MessageEvent } from "./types";

const TOPOLOGY_BADGES: Record<string, string> = {
  star: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  chain: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  tree: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  mesh: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export function App() {
  const data = getAppData();
  const [selected, setSelected] = useState<MessageEvent | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("agentqa-theme");
    if (stored) return stored === "dark";
    return false;
  });
  const [easterEgg, setEasterEgg] = useState(false);

  useEffect(() => {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let pos = 0;
    const handler = (e: KeyboardEvent) => {
      if (e.key === code[pos]) { pos++; if (pos === code.length) { setEasterEgg(true); pos = 0; setTimeout(() => setEasterEgg(false), 3000); } } else { pos = 0; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("agentqa-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {easterEgg && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'][i % 6],
                animationDelay: `${Math.random() * 1.5}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* Top bar */}
      <header className="bg-white/80 backdrop-blur-xl dark:bg-slate-800/80 dark:backdrop-blur-xl sticky top-0 z-20 shadow-sm dark:shadow-slate-900/50">
        <div className="px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hover:scale-110 transition-transform duration-200 inline-flex">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect width="22" height="22" rx="6" fill="#6366f1" />
              <circle cx="7" cy="11" r="2.5" fill="white" />
              <circle cx="15" cy="7" r="2.5" fill="white" />
              <circle cx="15" cy="15" r="2.5" fill="white" />
              <line x1="9.2" y1="10" x2="13" y2="8" stroke="white" strokeWidth="1.5" />
              <line x1="9.2" y1="12" x2="13" y2="14" stroke="white" strokeWidth="1.5" />
            </svg>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">AgentQA</span>
          <span className="text-slate-300 dark:text-slate-500 text-sm">/</span>
          <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-md">{data.title}</span>
        </div>

        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {data.topology && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TOPOLOGY_BADGES[data.topology] ?? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
              {data.topology}
            </span>
          )}
          {isTrace && (
            <>
              {failCount > 0 && (
                <span className="text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
                  {failCount} failed
                </span>
              )}
              {passCount > 0 && (
                <span className="text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  {passCount} passed
                </span>
              )}
              {totalTokens > 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {totalTokens.toLocaleString()} tokens
                  {totalCost > 0 && <span> · ${totalCost.toFixed(4)}</span>}
                </span>
              )}
            </>
          )}
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors transition-transform duration-200 hover:scale-110 active:rotate-180 text-slate-500 dark:text-slate-400"
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 1zm0 11a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 12zM1 8a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1A.5.5 0 0 1 1 8zm11 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1A.5.5 0 0 1 12 8zm-9.5-4a.5.5 0 0 1 .707 0l.707.707a.5.5 0 0 1-.707.707L2.5 4.707A.5.5 0 0 1 2.5 4zm9.293.707a.5.5 0 0 0-.707-.707l-.707.707a.5.5 0 0 0 .707.707l.707-.707zM4.914 12.5a.5.5 0 0 1-.707 0l-.707-.707a.5.5 0 0 1 .707-.707l.707.707a.5.5 0 0 1 0 .707zm6.879-.707a.5.5 0 0 0-.707.707l.707.707a.5.5 0 0 0 .707-.707l-.707-.707zM8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z" />
              </svg>
            )}
          </button>
          {data.agentqa_version && (
            <span className="text-xs text-slate-300 dark:text-slate-500">v{data.agentqa_version}</span>
          )}
        </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      </header>

      {/* Main content */}
      <main className="px-6 py-6 max-w-screen-2xl mx-auto">
        {isTrace && (
          <div className="flex gap-6">
            {/* Swimlane + controls + properties */}
            <div className="flex-1 min-w-0 space-y-4">
              <FilterBar allAgents={agents} filters={filters} onChange={setFilters} />
              <ReplayControls replay={replay} totalTurns={messages.length} />
              <SectionLabel title="Message Timeline" tip="Each arrow is one message between agents. Vertical position = which agent. Horizontal = turn order. Click any arrow to see full message details in the side panel. Orange badge = fault injected, red = property violation." />
              <SwimlaneDiagram
                agents={agents}
                messages={messages}
                onSelect={setSelected}
                selected={selected}
                visibleUpTo={replay.visibleUpTo}
                highlightedIndices={highlightedIndices}
                darkMode={darkMode}
              />
              <StateTimeline
                events={data.events}
                agents={agents}
                visibleUpTo={replay.visibleUpTo}
              />
              <div className="grid grid-cols-2 gap-4">
                <CostBreakdown messages={messages} agents={agents} />
                <TopologyGraph messages={messages} agents={agents} topology={data.topology} />
              </div>
              <PropertiesPanel results={data.results} />
            </div>

            {/* Side panel */}
            {selected && (
              <div className="w-96 flex-shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden sticky top-20 self-start max-h-[calc(100vh-6rem)] flex flex-col">
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-700 backdrop-blur-sm text-slate-300 text-xs px-5 py-2.5 rounded-full shadow-lg border border-slate-700/50 flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity z-30 pointer-events-none">
          <span><kbd className="bg-slate-700 dark:bg-slate-600 px-1.5 py-0.5 rounded text-white font-mono">←</kbd> <kbd className="bg-slate-700 dark:bg-slate-600 px-1.5 py-0.5 rounded text-white font-mono">→</kbd> step</span>
          <span><kbd className="bg-slate-700 dark:bg-slate-600 px-1.5 py-0.5 rounded text-white font-mono">Space</kbd> play/pause</span>
          <span><kbd className="bg-slate-700 dark:bg-slate-600 px-1.5 py-0.5 rounded text-white font-mono">Esc</kbd> deselect</span>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ title, tip }: { title: string; tip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</h2>
      <InfoTip text={tip} />
    </div>
  );
}
