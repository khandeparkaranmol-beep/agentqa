import type { ReplayState } from "../hooks/useReplay";

interface Props {
  replay: ReplayState;
  totalTurns: number;
}

export function ReplayControls({ replay, totalTurns }: Props) {
  const { visibleUpTo, isPlaying, speed } = replay;
  const atStart = visibleUpTo < 0;
  const atEnd = visibleUpTo >= totalTurns - 1;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
      {/* Transport buttons */}
      <div className="flex items-center gap-1">
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
        ) : (
          <Btn onClick={replay.play} disabled={atEnd} title="Play (Space)" accent>
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

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <input
          type="range"
          min={-1}
          max={totalTurns - 1}
          value={visibleUpTo}
          onChange={(e) => replay.jumpTo(Number(e.target.value))}
          className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
          title={`Turn ${visibleUpTo < 0 ? "—" : visibleUpTo}`}
        />
      </div>

      {/* Turn counter */}
      <span className="text-xs font-mono text-slate-500 tabular-nums w-16 text-center flex-shrink-0">
        {visibleUpTo < 0 ? "—" : `T${visibleUpTo}`} / {totalTurns - 1}
      </span>

      {/* Speed selector */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {[0.5, 1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => replay.setSpeed(s)}
            className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
              speed === s
                ? "bg-indigo-100 text-indigo-700"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        accent
          ? "bg-indigo-500 text-white hover:bg-indigo-600 disabled:hover:bg-indigo-500"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
