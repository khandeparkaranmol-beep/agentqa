import type { PropertyResult } from "../types";

interface Props {
  results: PropertyResult[];
}

export function PropertiesPanel({ results }: Props) {
  if (results.length === 0) return null;

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Property Assertions</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-600 font-medium">{passed.length} passed</span>
          {failed.length > 0 && <span className="text-red-500 font-medium">{failed.length} failed</span>}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {[...failed, ...passed].map((r) => (
          <div
            key={r.property_name}
            className={`px-5 py-3 flex items-start gap-3 ${r.passed ? "" : "bg-red-50"}`}
          >
            <span className={`mt-0.5 text-sm font-bold flex-shrink-0 ${r.passed ? "text-emerald-500" : "text-red-500"}`}>
              {r.passed ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800 font-mono">{r.property_name}</span>
                {r.turn !== undefined && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">turn {r.turn}</span>
                )}
              </div>
              <p className={`text-xs mt-0.5 leading-relaxed ${r.passed ? "text-slate-500" : "text-red-600"}`}>
                {r.details}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
