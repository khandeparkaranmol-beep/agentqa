import type { PropertyResult } from "../types";
import { getPropertyMeta, TOPOLOGY_LABELS, formatTitle } from "../labels";

interface Props {
  results: PropertyResult[];
  title: string;
  topology?: string;
  onJumpToTurn: (turn: number) => void;
}

/* ── Component ───────────────────────────────────────────────────────── */

export function VerdictBanner({ results, title, topology, onJumpToTurn }: Props) {
  const failures = results.filter((r) => !r.passed);
  const passes = results.filter((r) => r.passed);
  const allPassed = failures.length === 0 && results.length > 0;
  const hasResults = results.length > 0;

  return (
    <div className="animate-fade-in">
      <div
        className={`relative overflow-hidden rounded-2xl border shadow-lg ${
          allPassed
            ? "bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-teal-50 border-emerald-200/60 dark:from-emerald-950/40 dark:via-emerald-950/20 dark:to-teal-950/30 dark:border-emerald-800/40"
            : failures.length > 0
            ? "bg-gradient-to-br from-slate-50 via-white to-red-50/30 border-slate-200/80 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-red-950/20 dark:border-slate-700/60"
            : "bg-gradient-to-br from-slate-50 via-white to-slate-50 border-slate-200/80 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-800/40 dark:border-slate-700/60"
        }`}
      >
        {/* Decorative gradient orb */}
        <div
          className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none ${
            allPassed ? "bg-emerald-400" : failures.length > 0 ? "bg-red-400" : "bg-indigo-400"
          }`}
        />

        <div className="relative px-6 py-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                {formatTitle(title)}
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {topology && TOPOLOGY_LABELS[topology]
                  ? TOPOLOGY_LABELS[topology]
                  : topology
                  ? `${topology} communication pattern`
                  : null}
                {topology && hasResults && " · "}
                {hasResults && `${results.length} safety checks ran`}
              </p>
            </div>

            {/* Verdict badge */}
            {hasResults && (
              <div
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm ${
                  allPassed
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                }`}
              >
                {allPassed ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    All Clear
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 4.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
                    </svg>
                    {failures.length} Issue{failures.length !== 1 ? "s" : ""} Found
                  </>
                )}
              </div>
            )}
          </div>

          {/* Failure cards — human readable */}
          {failures.length > 0 && (
            <div
              className="mt-4 grid gap-2"
              style={{ gridTemplateColumns: `repeat(${Math.min(failures.length, 3)}, 1fr)` }}
            >
              {failures.map((f, i) => {
                const meta = getPropertyMeta(f.property_name);
                return (
                  <button
                    key={f.property_name}
                    onClick={() => f.turn !== undefined && onJumpToTurn(f.turn)}
                    className="group text-left rounded-xl border border-red-200/60 dark:border-red-800/30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-3 hover:border-red-300 dark:hover:border-red-700/50 hover:shadow-md transition-all duration-200 animate-fade-in"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    {/* Human-readable title */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {meta.label}
                      </span>
                      {f.turn !== undefined && (
                        <span className="ml-auto text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded flex-shrink-0">
                          Turn {f.turn}
                        </span>
                      )}
                    </div>

                    {/* Plain English explanation */}
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {meta.failedLabel}
                    </p>

                    {/* Technical detail (smaller, secondary) */}
                    <p className="text-[11px] leading-relaxed text-red-500/70 dark:text-red-400/60 mt-1 line-clamp-2">
                      {f.details}
                    </p>

                    {f.turn !== undefined && (
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                        See what happened
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="group-hover:translate-x-0.5 transition-transform">
                          <path d="M3 1l5 4-5 4z" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Passed checks — natural language, not code names */}
          {passes.length > 0 && (
            <div className={`${failures.length > 0 ? "mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50" : "mt-3"}`}>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-emerald-500 flex-shrink-0">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  {passes.map((p, i) => {
                    const meta = getPropertyMeta(p.property_name);
                    const isLast = i === passes.length - 1;
                    const isSecondToLast = i === passes.length - 2;
                    return (
                      <span key={p.property_name}>
                        <span className="text-emerald-600 dark:text-emerald-500">{meta.passedLabel}</span>
                        {isLast ? "." : isSecondToLast ? ", and " : ", "}
                      </span>
                    );
                  })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
