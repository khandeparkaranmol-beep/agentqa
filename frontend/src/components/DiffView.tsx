import type { TraceEvent, PropertyResult } from "../types";
import { buildMessageEvents } from "../data";

interface Props {
  titleA: string;
  titleB: string;
  eventsA: TraceEvent[];
  eventsB: TraceEvent[];
  resultsA: PropertyResult[];
  resultsB: PropertyResult[];
}

export function DiffView({ titleA, titleB, eventsA, eventsB, resultsA, resultsB }: Props) {
  const msgsA = buildMessageEvents(eventsA, resultsA);
  const msgsB = buildMessageEvents(eventsB, resultsB);
  const maxTurns = Math.max(msgsA.length, msgsB.length);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Headers */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-700 truncate">{titleA}</span>
          <span className="ml-auto text-xs text-slate-400">{msgsA.length} turns</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-700 truncate">{titleB}</span>
          <span className="ml-auto text-xs text-slate-400">{msgsB.length} turns</span>
        </div>
      </div>

      {/* Turn-by-turn comparison */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[48px_1fr_1fr] divide-x divide-slate-100">
          <div className="bg-slate-50 px-2 py-2 text-xs text-slate-400 font-medium text-center border-b border-slate-200">#</div>
          <div className="bg-slate-50 px-4 py-2 text-xs text-indigo-600 font-medium border-b border-slate-200">{titleA}</div>
          <div className="bg-slate-50 px-4 py-2 text-xs text-violet-600 font-medium border-b border-slate-200">{titleB}</div>
        </div>
        {Array.from({ length: maxTurns }).map((_, i) => {
          const a = msgsA[i];
          const b = msgsB[i];
          const differ = a && b && (a.content !== b.content || a.sender !== b.sender || a.receiver !== b.receiver);
          const onlyA = a && !b;
          const onlyB = !a && b;

          return (
            <div
              key={i}
              className={`grid grid-cols-[48px_1fr_1fr] divide-x divide-slate-100 border-t border-slate-100 ${
                differ ? "bg-amber-50" : onlyA || onlyB ? "bg-red-50" : ""
              }`}
            >
              <div className="px-2 py-3 text-xs text-slate-400 font-mono text-center self-start pt-3.5">
                {i}
                {differ && <span className="block text-amber-500 text-xs">≠</span>}
                {(onlyA || onlyB) && <span className="block text-red-400 text-xs">!</span>}
              </div>
              <TurnCell msg={a} color="indigo" />
              <TurnCell msg={b} color="violet" />
            </div>
          );
        })}
      </div>

      {/* Property diff */}
      <div className="grid grid-cols-2 gap-4">
        <PropertyDiffColumn title={titleA} results={resultsA} color="indigo" />
        <PropertyDiffColumn title={titleB} results={resultsB} color="violet" />
      </div>
    </div>
  );
}

function TurnCell({ msg, color }: { msg: ReturnType<typeof buildMessageEvents>[number] | undefined; color: "indigo" | "violet" }) {
  if (!msg) return <div className="px-4 py-3 text-xs text-slate-300 italic">—</div>;
  const textColor = color === "indigo" ? "text-indigo-600" : "text-violet-600";
  return (
    <div className="px-4 py-3">
      <div className={`text-xs font-medium ${textColor} mb-0.5`}>
        {msg.sender} → {msg.receiver}
        {msg.hasFault && <span className="ml-2 text-orange-500">⚡ {msg.faultType}</span>}
        {msg.violatedProperties.length > 0 && <span className="ml-2 text-red-500">✗ violation</span>}
      </div>
      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{msg.content}</p>
    </div>
  );
}

function PropertyDiffColumn({ title, results, color }: { title: string; results: PropertyResult[]; color: "indigo" | "violet" }) {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const headerColor = color === "indigo" ? "text-indigo-600" : "text-violet-600";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <span className={`text-xs font-semibold ${headerColor} truncate`}>{title}</span>
        <span className="text-xs text-slate-500 flex-shrink-0">
          <span className="text-emerald-600">{passed}✓</span>
          {failed > 0 && <span className="ml-1 text-red-500">{failed}✗</span>}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {results.map((r) => (
          <div key={r.property_name} className={`px-4 py-2.5 flex items-start gap-2 ${r.passed ? "" : "bg-red-50"}`}>
            <span className={`text-xs font-bold flex-shrink-0 mt-0.5 ${r.passed ? "text-emerald-500" : "text-red-500"}`}>
              {r.passed ? "✓" : "✗"}
            </span>
            <div>
              <p className="text-xs font-medium text-slate-700 font-mono">{r.property_name}</p>
              <p className={`text-xs mt-0.5 ${r.passed ? "text-slate-400" : "text-red-600"}`}>{r.details}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
