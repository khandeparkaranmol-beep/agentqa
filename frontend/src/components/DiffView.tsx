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
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{titleA}</span>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{msgsA.length} turns</span>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{titleB}</span>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{msgsB.length} turns</span>
        </div>
      </div>

      {/* Turn-by-turn comparison */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
        <div className="grid grid-cols-[48px_1fr_1fr] divide-x divide-slate-100 dark:divide-slate-700">
          <div className="bg-slate-50 dark:bg-slate-800 px-2 py-2 text-xs text-slate-400 dark:text-slate-500 font-medium text-center border-b border-slate-200 dark:border-slate-700">#</div>
          <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium border-b border-slate-200 dark:border-slate-700">{titleA}</div>
          <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs text-violet-600 dark:text-violet-400 font-medium border-b border-slate-200 dark:border-slate-700">{titleB}</div>
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
              className={`grid grid-cols-[48px_1fr_1fr] divide-x divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700 ${
                differ ? "bg-amber-50 dark:bg-amber-900/20" : onlyA || onlyB ? "bg-red-50 dark:bg-red-900/20" : ""
              }`}
            >
              <div className="px-2 py-3 text-xs text-slate-400 font-mono text-center self-start pt-3.5">
                {i}
                {differ && <span className="block text-amber-500 text-xs">≠</span>}
                {(onlyA || onlyB) && <span className="block text-red-400 text-xs">!</span>}
              </div>
              <TurnCell msg={a} color="indigo" diffSegments={differ && a && b ? wordDiff(a.content, b.content).filter(s => s.type !== 'added') : undefined} />
              <TurnCell msg={b} color="violet" diffSegments={differ && a && b ? wordDiff(a.content, b.content).filter(s => s.type !== 'removed') : undefined} />
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

interface DiffSegment {
  text: string;
  type: "same" | "added" | "removed";
}

function TurnCell({ msg, color, diffSegments }: { msg: ReturnType<typeof buildMessageEvents>[number] | undefined; color: "indigo" | "violet"; diffSegments?: DiffSegment[] }) {
  if (!msg) return <div className="px-4 py-3 text-xs text-slate-300 dark:text-slate-600 italic">—</div>;
  const textColor = color === "indigo" ? "text-indigo-600" : "text-violet-600";
  return (
    <div className="px-4 py-3">
      <div className={`text-xs font-medium ${textColor} mb-0.5`}>
        {msg.sender} → {msg.receiver}
        {msg.hasFault && <span className="ml-2 text-orange-500">⚡ {msg.faultType}</span>}
        {msg.violatedProperties.length > 0 && <span className="ml-2 text-red-500">✗ violation</span>}
      </div>
      {diffSegments ? (
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
          {diffSegments.map((seg, i) => {
            if (seg.type === "removed") {
              return <span key={i} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 line-through rounded px-0.5">{seg.text} </span>;
            }
            if (seg.type === "added") {
              return <span key={i} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded px-0.5">{seg.text} </span>;
            }
            return <span key={i}>{seg.text} </span>;
          })}
        </p>
      ) : (
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">{msg.content}</p>
      )}
    </div>
  );
}

function PropertyDiffColumn({ title, results, color }: { title: string; results: PropertyResult[]; color: "indigo" | "violet" }) {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const headerColor = color === "indigo" ? "text-indigo-600" : "text-violet-600";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
        <span className={`text-xs font-semibold ${headerColor} truncate`}>{title}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
          <span className="text-emerald-600">{passed}✓</span>
          {failed > 0 && <span className="ml-1 text-red-500">{failed}✗</span>}
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {results.map((r) => (
          <div key={r.property_name} className={`px-4 py-2.5 flex items-start gap-2 ${r.passed ? "" : "bg-red-50 dark:bg-red-900/20"}`}>
            <span className={`text-xs font-bold flex-shrink-0 mt-0.5 ${r.passed ? "text-emerald-500" : "text-red-500"}`}>
              {r.passed ? "✓" : "✗"}
            </span>
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">{r.property_name}</p>
              <p className={`text-xs mt-0.5 ${r.passed ? "text-slate-400 dark:text-slate-500" : "text-red-600 dark:text-red-400"}`}>{r.details}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compute a word-level diff between two strings using LCS (longest common subsequence).
 * Returns segments marked as 'same', 'added', or 'removed'.
 */
function wordDiff(a: string, b: string): DiffSegment[] {
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  const n = wordsA.length;
  const m = wordsB.length;

  // Build LCS DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff segments
  const segments: DiffSegment[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      segments.push({ text: wordsA[i - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      segments.push({ text: wordsB[j - 1], type: "added" });
      j--;
    } else {
      segments.push({ text: wordsA[i - 1], type: "removed" });
      i--;
    }
  }

  return segments.reverse();
}
