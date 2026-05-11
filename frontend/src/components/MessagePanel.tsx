import type { MessageEvent } from "../types";
import { getPropertyMeta, getFaultLabel } from "../labels";

interface Props {
  message: MessageEvent;
  onClose: () => void;
}

export function MessagePanel({ message, onClose }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md font-medium">
            T{message.turn}
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
              {message.sender}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 text-slate-300 dark:text-slate-600">
              <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
              {message.receiver}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Status badges */}
        {(message.hasFault || message.violatedProperties.length > 0 || message.milestoneHits.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {message.hasFault && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/30 px-2.5 py-1 rounded-lg">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 0L6.5 3.5L10 5L6.5 6.5L5 10L3.5 6.5L0 5L3.5 3.5Z" /></svg>
                {getFaultLabel(message.faultType).label}
              </span>
            )}
            {message.violatedProperties.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/30 px-2.5 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {getPropertyMeta(p).failedLabel}
              </span>
            ))}
            {message.milestoneHits.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/30 px-2.5 py-1 rounded-lg">
                ★ {m}
              </span>
            ))}
          </div>
        )}

        {/* Message body */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 font-semibold">
            Message
          </p>
          <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600/50 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-mono">
            {message.content}
          </div>
        </div>

        {/* Token usage */}
        {(message.input_tokens > 0 || message.output_tokens > 0) && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 font-semibold">
              Tokens
            </p>
            <div className="flex gap-4 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{message.input_tokens.toLocaleString()}</span> in
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{message.output_tokens.toLocaleString()}</span> out
              </span>
              {message.cost_usd > 0 && (
                <span className="text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">${message.cost_usd.toFixed(5)}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        {Object.keys(message.metadata).length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 font-semibold">
              Metadata
            </p>
            <pre className="bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600/50 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto font-mono leading-relaxed">
              {JSON.stringify(message.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
