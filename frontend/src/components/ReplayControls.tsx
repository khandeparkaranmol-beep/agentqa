import type { ReplayState } from "../hooks/useReplay";

interface Props {
  replay: ReplayState;
  totalTurns: number;
}

export function ReplayControls({ replay, totalTurns }: Props) {
  const { visibleUpTo, isPlaying, speed } = replay;
  const atStart = visibleUpTo < 0;
  const atEnd = visibleUpTo >= totalTurns - 1;
  const progress = totalTurns > 1 ? Math.max(0, (visibleUpTo + 1) / totalTurns) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-full shadow-lg shadow-black/[0.08] dark:shadow-black/30 border border-slate-200/50 dark:border-slate-700/30">
      {/* Transport buttons */}
      <div className="flex items-center gap-0.5">
        <Btn onClick={replay.jumpToStart} disabled={atStart} title="Jump to start (Home)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 2h2v10H2zm3 5 7 5V2z" /></svg>
        </Btn>
        <Btn onClick={replay.stepBack} disabled={atStart} title="Step back (Left arrow)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M10 2 3 7l7 5z" /></svg>
        </Btn>
        {isPlaying ? (
          <Btn onClick={replay.pause} title="Pause (Space)" accent>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10" rx="1" /><rect x="8" y="2" width="3" height="10" rx="1" /></svg>
          </Btn>
        ) : atEnd ? (
          <Btn onClick={replay.play} title="Replay (Space)" accent>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 7a6 6 0 0 1 10.2-4.3" /><path d="M13 7A6 6 0 0 1 2.8 11.3" />
              <path d="M11 1v3h-3" fill="currentColor" stroke="none" /><path d="M3 13v-3h3" fill="currentColor" stroke="none" />
            </svg>
          </Btn>
        ) : (
          <Btn onClick={replay.play} title="Play (Space)" accent>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l9 5-9 5z" /></svg>
          </Btn>
        )}
        <Btn onClick={replay.stepForward} disabled={atEnd} title="Step forward (Right arrow)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M4 2l7 5-7 5z" /></svg>
        </Btn>
        <Btn onClick={replay.jumpToEnd} disabled={atEnd} title="Jump to end (End)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 2l7 5-7 5zm8-0h2v10h-2z" /></svg>
        </Btn>
      </div>

      {/* Progress bar with visible thumb */}
      <div className="group flex-1 relative h-6 flex items-center min-w-0 cursor-pointer">
        <div className="absolute inset-x-0 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Thumb dot */}
        <div
          className="absolute w-3 h-3 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/30 border-2 border-white dark:border-slate-800 transition-all duration-150 ease-out opacity-0 group-hover:opacity-100 pointer-events-none"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
        <input
          type="range"
          min={-1}
          max={totalTurns - 1}
          value={visibleUpTo}
          onChange={(e) => replay.jumpTo(Number(e.target.value))}
          className="absolute inset-x-0 w-full h-6 opacity-0 cursor-pointer"
          title={`Turn ${visibleUpTo < 0 ? "—" : visibleUpTo + 1} of ${totalTurns}`}
        />
      </div>

      {/* Turn counter — human readable */}
      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums w-20 text-center flex-shrink-0">
        {visibleUpTo < 0 ? "—" : visibleUpTo + 1} of {totalTurns}
      </span>

      {/* Speed selector */}
      <div className="flex items-center gap-0.5 flex-shrink-0 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-0.5">
        {[0.25, 0.5, 1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => replay.setSpeed(s)}
            className={`text-xs px-2 py-1 rounded-md font-medium transition-all duration-150 ${
              speed === s
                ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  title,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed ${
        accent
          ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm shadow-indigo-500/25 disabled:hover:bg-indigo-500"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
