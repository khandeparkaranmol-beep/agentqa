import type { PropertyResult } from "../types";
import { InfoTip } from "./InfoTip";

interface Props {
  results: PropertyResult[];
}

export function PropertiesPanel({ results }: Props) {
  if (results.length === 0) return null;

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const total = results.length;
  const passedPct = total > 0 ? (passed.length / total) * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Property Assertions</h2>
          <InfoTip text="Safety and correctness checks that ran against this trace. Green = passed, Red = failed and needs fixing. Each property tests for a specific failure mode (e.g. information leak, deadlock)." />
        </div>
        <div className="flex items-center gap-3 text-xs flex-shrink-0">
          <span className="text-emerald-600 font-medium">{passed.length} passed</span>
          {failed.length > 0 && <span className="text-red-500 font-medium">{failed.length} failed</span>}
        </div>
      </div>
      {/* Summary progress bar */}
      <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
          {passed.length > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${passedPct}%` }}
            />
          )}
          {failed.length > 0 && (
            <div
              className="h-full bg-red-400 transition-all duration-500"
              style={{ width: `${100 - passedPct}%` }}
            />
          )}
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {[...failed, ...passed].map((r, index) => (
          <div
            key={r.property_name}
            className={`animate-fade-in px-5 py-3 flex items-start gap-3 hover:shadow-md transition-shadow ${r.passed ? "" : "bg-red-50 dark:bg-red-900/20"}`}
            style={{
              animationDelay: `${index * 0.05}s`,
              ...(r.passed ? {} : { borderLeftWidth: 3, borderLeftColor: "#f87171" }),
            }}
          >
            <span className={`mt-0.5 text-sm font-bold flex-shrink-0 ${r.passed ? "text-emerald-500" : "text-red-500"}`}>
              {r.passed ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 font-mono">{r.property_name}</span>
                {r.turn !== undefined && (
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">turn {r.turn}</span>
                )}
              </div>
              <p className={`text-xs mt-0.5 leading-relaxed ${r.passed ? "text-slate-500 dark:text-slate-400" : "text-red-600 dark:text-red-400"}`}>
                {r.details}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
