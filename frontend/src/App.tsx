import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getAppData, buildMessageEvents, getAgents, getAgentRoles } from "./data";
import { useReplay } from "./hooks/useReplay";
import { formatTitle, TOPOLOGY_LABELS } from "./labels";
import { SpotlightView } from "./components/SpotlightView";
import { SwimlaneDiagram } from "./components/SwimlaneDiagram";
import { ConstellationView } from "./components/ConstellationView";
import { ReplayControls } from "./components/ReplayControls";
import { MessagePanel } from "./components/MessagePanel";
import { FilterBar, EMPTY_FILTERS, hasActiveFilters } from "./components/FilterBar";
import type { Filters } from "./components/FilterBar";
import { StateTimeline } from "./components/StateTimeline";
import { CostBreakdown } from "./components/CostBreakdown";
import { TopologyGraph } from "./components/TopologyGraph";
import { ScenarioHero } from "./components/ScenarioHero";
import { IssuesPanel } from "./components/IssuesPanel";
import { DiffView } from "./components/DiffView";
import { Dashboard } from "./components/Dashboard";
import type { MessageEvent } from "./types";

type ViewMode = "spotlight" | "constellation" | "timeline";

export function App() {
  const data = getAppData();
  const [selected, setSelected] = useState<MessageEvent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("spotlight");
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("riftcheck-theme");
    if (stored) return stored === "dark";
    return true; // dark by default — cinematic
  });
  const [easterEgg, setEasterEgg] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showDetails, setShowDetails] = useState(false);

  // Multi-run: which run is currently displayed (0-based). Start at last run.
  const [activeRunIndex, setActiveRunIndex] = useState(() => {
    const d = getAppData();
    return d.all_runs && d.all_runs.length > 1 ? d.all_runs.length - 1 : 0;
  });

  // Track main stage column bounds for centering controls
  const [stageBounds, setStageBounds] = useState<{ left: number; width: number } | null>(null);
  const stageCleanupRef = useRef<(() => void) | null>(null);
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    // Cleanup previous
    if (stageCleanupRef.current) { stageCleanupRef.current(); stageCleanupRef.current = null; }
    if (!el) { setStageBounds(null); return; }
    const update = () => {
      const rect = el.getBoundingClientRect();
      setStageBounds({ left: rect.left, width: rect.width });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    stageCleanupRef.current = () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  // Easter egg
  useEffect(() => {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let pos = 0;
    const handler = (e: KeyboardEvent) => {
      if (e.key === code[pos]) { pos++; if (pos === code.length) { setEasterEgg(true); pos = 0; setTimeout(() => setEasterEgg(false), 3000); } } else { pos = 0; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Dark mode persistence
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("riftcheck-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const isTrace = data.mode === "trace";
  const isDiff = data.mode === "diff";
  const isDashboard = data.mode === "dashboard";

  // Resolve active run's events and results
  const hasMultiRun = isTrace && data.all_runs && data.all_runs.length > 1;
  const activeEvents = useMemo(() => {
    if (hasMultiRun && data.all_runs![activeRunIndex]) {
      return data.all_runs![activeRunIndex].events;
    }
    return data.events;
  }, [hasMultiRun, data, activeRunIndex]);
  const activeResults = useMemo(() => {
    if (hasMultiRun && data.all_runs![activeRunIndex]) {
      return data.all_runs![activeRunIndex].results;
    }
    return data.results;
  }, [hasMultiRun, data, activeRunIndex]);

  const agents = isTrace ? getAgents(activeEvents) : [];
  const messages = isTrace ? buildMessageEvents(activeEvents, activeResults) : [];
  const agentRoles = useMemo(() => isTrace ? getAgentRoles(agents, data.agent_roles) : {}, [isTrace, agents, data.agent_roles]);

  // Per-run results for coloring run pills
  const allRunResults = useMemo(() => {
    if (!data.all_runs) return undefined;
    return data.all_runs.map(r => r.results);
  }, [data.all_runs]);

  // Filter indices for Timeline view
  const highlightedIndices = useMemo(() => {
    if (!hasActiveFilters(filters)) return undefined;
    const set = new Set<number>();
    messages.forEach((m, i) => {
      const agentMatch = filters.agents.size === 0 || filters.agents.has(m.sender) || filters.agents.has(m.receiver);
      const faultMatch = filters.showFaults === null || (filters.showFaults ? m.hasFault : !m.hasFault);
      const violationMatch = filters.showViolations === null || (filters.showViolations ? m.violatedProperties.length > 0 : m.violatedProperties.length === 0);
      const textMatch = filters.searchText.length === 0 || m.content.toLowerCase().includes(filters.searchText.toLowerCase());
      if (agentMatch && faultMatch && violationMatch && textMatch) set.add(i);
    });
    return set;
  }, [filters, messages]);

  const replay = useReplay(messages.length);

  // Reset replay when switching runs
  const handleRunSelect = useCallback((idx: number) => {
    setActiveRunIndex(idx);
    replay.jumpToStart();
  }, [replay]);

  // Derived title info
  const prettyTitle = isTrace ? formatTitle(data.title.split("—")[0].trim()) : "";
  const runLabel = isTrace && data.title.includes("—") ? data.title.split("—")[1].trim() : null;
  const topoLabel = data.topology ? (TOPOLOGY_LABELS[data.topology] ?? `${data.topology} pattern`) : null;

  // Keyboard shortcuts — space toggles playback, arrows step
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isTrace) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          replay.isPlaying ? replay.pause() : replay.play();
          break;
        case "ArrowRight":
          e.preventDefault();
          replay.stepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          replay.stepBack();
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

  // Shared hero props
  const heroProps = {
    prettyTitle,
    runLabel,
    topoLabel,
    agents,
    agentRoles,
    messageCount: messages.length,
    checkCount: activeResults.length,
    passedChecks: activeResults.filter(r => r.passed).length,
    runSummary: data.run_summary,
    totalRuns: data.all_runs?.length,
    activeRun: activeRunIndex,
    allRunResults,
    onRunSelect: handleRunSelect,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Confetti easter egg */}
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

      {/* Header — always visible */}
      <header className="sticky top-0 z-20 animate-fade-in">
        <div className="px-6 py-3 flex items-center gap-3">
          <span className="opacity-25 hover:opacity-60 transition-opacity duration-500 inline-flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 110 110" fill="none">
              <rect width="110" height="110" rx="22" fill="#6366f1" />
              <ellipse cx="55" cy="55" rx="32" ry="11" stroke="white" strokeWidth="2.5" opacity="0.25" transform="rotate(-35 55 55)"/>
              <ellipse cx="55" cy="55" rx="32" ry="11" stroke="white" strokeWidth="2.5" opacity="0.25" transform="rotate(35 55 55)"/>
              <ellipse cx="55" cy="55" rx="32" ry="11" stroke="white" strokeWidth="2.5" opacity="0.25" transform="rotate(90 55 55)"/>
              <circle cx="55" cy="23" r="6" fill="white" opacity="0.95"/>
              <circle cx="83" cy="71" r="5.5" fill="white" opacity="0.85"/>
              <circle cx="27" cy="71" r="5" fill="white" opacity="0.75"/>
              <circle cx="55" cy="55" r="8" fill="white" opacity="0.95"/>
              <circle cx="55" cy="55" r="3.5" fill="#6366f1"/>
            </svg>
            <span className="font-semibold text-slate-600 dark:text-slate-400 text-xs tracking-tight">Riftcheck</span>
          </span>

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* View toggle */}
            {isTrace && (
              <div className="flex items-center bg-slate-200/50 dark:bg-slate-800/40 rounded-full p-0.5 backdrop-blur-sm">
                {([
                  { key: "spotlight" as const, label: "Spotlight" },
                  { key: "constellation" as const, label: "Constellation" },
                  { key: "timeline" as const, label: "Timeline" },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all duration-200 ${
                      viewMode === key
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all duration-200 text-slate-400 dark:text-slate-500 opacity-40 hover:opacity-80"
              title={darkMode ? "Light mode" : "Dark mode"}
            >
              {darkMode ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 1zm0 11a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 12zM1 8a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1A.5.5 0 0 1 1 8zm11 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1A.5.5 0 0 1 12 8zm-9.5-4a.5.5 0 0 1 .707 0l.707.707a.5.5 0 0 1-.707.707L2.5 4.707A.5.5 0 0 1 2.5 4zm9.293.707a.5.5 0 0 0-.707-.707l-.707.707a.5.5 0 0 0 .707.707l.707-.707zM4.914 12.5a.5.5 0 0 1-.707 0l-.707-.707a.5.5 0 0 1 .707-.707l.707.707a.5.5 0 0 1 0 .707zm6.879-.707a.5.5 0 0 0-.707.707l.707.707a.5.5 0 0 0 .707-.707l-.707-.707zM8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* === Trace mode: Hero + Stage === */}
      {isTrace && (
        <>
          {/* The stage */}
          <main className="animate-fade-in-delay-1 pb-24">
            {/* ── Spotlight: full width, pure cinema, hero centered ── */}
            {viewMode === "spotlight" && (
              <div className="relative">
                <ScenarioHero {...heroProps} centered />
                <SpotlightView
                  agents={agents}
                  agentRoles={agentRoles}
                  messages={messages}
                  results={activeResults}
                  visibleUpTo={replay.visibleUpTo}
                  speed={replay.speed}
                />
              </div>
            )}

            {/* ── Constellation + Timeline: stage + instrument sidebar ── */}
            {(viewMode === "constellation" || viewMode === "timeline") && (
              <div className="flex flex-col lg:flex-row gap-0 px-3 sm:px-5 max-w-screen-2xl mx-auto">
                {/* Main stage — 75% on desktop */}
                <div ref={stageRef} className="flex-1 min-w-0 lg:pr-4">
                  {/* Hero — aligned with main stage, not full viewport */}
                  <ScenarioHero {...heroProps} />
                  {viewMode === "constellation" && (
                    <ConstellationView
                      agents={agents}
                      agentRoles={agentRoles}
                      messages={messages}
                      results={activeResults}
                      visibleUpTo={replay.visibleUpTo}
                      speed={replay.speed}
                    />
                  )}

                  {viewMode === "timeline" && (
                    <div className="space-y-5">
                      <FilterBar allAgents={agents} filters={filters} onChange={setFilters} />
                      <SwimlaneDiagram
                        agents={agents}
                        messages={messages}
                        onSelect={setSelected}
                        selected={selected}
                        visibleUpTo={replay.visibleUpTo}
                        highlightedIndices={highlightedIndices}
                        darkMode={darkMode}
                      />
                    </div>
                  )}

                </div>

                {/* Instrument sidebar — 25% on desktop, stacked on mobile */}
                <aside className="w-full lg:w-[280px] xl:w-[320px] flex-shrink-0 mt-6 lg:mt-0">
                  <div className="lg:sticky lg:top-14 space-y-3 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:pr-1" style={{ scrollbarWidth: "thin" }}>
                    <div className="hidden lg:flex items-center gap-3 pb-1">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200/30 dark:via-slate-700/20 to-transparent" />
                      <span className="text-[9px] uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600 font-medium">Details</span>
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200/30 dark:via-slate-700/20 to-transparent" />
                    </div>

                    {/* Mobile: collapsible toggle */}
                    <div className="lg:hidden">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200/40 dark:via-slate-700/30 to-transparent" />
                        <button
                          onClick={() => setShowDetails(!showDetails)}
                          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-medium text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
                        >
                          <svg
                            width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                            className={`transition-transform duration-200 ${showDetails ? "rotate-90" : ""}`}
                          >
                            <path d="M2 0.5l4.5 3.5-4.5 3.5z" />
                          </svg>
                          {showDetails ? "Hide" : "Show"} Details
                        </button>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200/40 dark:via-slate-700/30 to-transparent" />
                      </div>
                    </div>

                    {/* Panels — always visible on desktop, toggled on mobile */}
                    <div className={`space-y-3 ${showDetails ? "" : "hidden lg:block"}`}>
                      <IssuesPanel messages={messages} agents={agents} visibleUpTo={replay.visibleUpTo} runSummary={data.run_summary} />
                      <StateTimeline events={activeEvents} agents={agents} visibleUpTo={replay.visibleUpTo} />
                      <CostBreakdown messages={messages} agents={agents} />
                      <TopologyGraph messages={messages} agents={agents} topology={data.topology} />
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </main>

          {/* Floating controls — OUTSIDE <main> to avoid transform containing block */}
          {/* Use a portal-like approach: render directly with no animation transforms */}
          <div
            style={{
              position: "fixed",
              bottom: 24,
              zIndex: 30,
              pointerEvents: "none",
              left: (viewMode !== "spotlight" && stageBounds) ? stageBounds.left : 0,
              width: (viewMode !== "spotlight" && stageBounds) ? stageBounds.width : "100vw",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "min(92vw, 560px)", pointerEvents: "auto" }} className="floating-controls">
              <ReplayControls replay={replay} totalTurns={messages.length} />
            </div>
          </div>

          {/* Side panel — message detail (timeline interactions) */}
          {selected && (
            <>
              <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
                onClick={() => setSelected(null)}
              />
              <div className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] lg:fixed lg:right-6 lg:top-16 lg:bottom-6 lg:left-auto lg:inset-x-auto lg:max-h-none lg:w-96 rounded-t-2xl lg:rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl dark:shadow-slate-950/50 overflow-hidden flex flex-col animate-fade-in">
                <MessagePanel message={selected} onClose={() => setSelected(null)} />
              </div>
            </>
          )}
        </>
      )}

      {/* === Diff mode === */}
      {isDiff && data.trace_b && (
        <main className="px-3 sm:px-6 py-5 max-w-screen-2xl mx-auto animate-fade-in">
          <DiffView
            titleA={data.title}
            titleB={data.title_b ?? "Trace B"}
            eventsA={data.events}
            eventsB={data.trace_b}
            resultsA={data.results}
            resultsB={data.results_b ?? []}
          />
        </main>
      )}

      {/* === Dashboard mode === */}
      {isDashboard && data.scenarios && (
        <main className="px-3 sm:px-6 py-5 max-w-screen-2xl mx-auto animate-fade-in">
          <Dashboard scenarios={data.scenarios} />
        </main>
      )}
    </div>
  );
}
