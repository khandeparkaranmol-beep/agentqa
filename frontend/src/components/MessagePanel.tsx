import type { MessageEvent } from "../types";

interface Props {
  message: MessageEvent;
  onClose: () => void;
}

export function MessagePanel({ message, onClose }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded">Turn {message.turn}</span>
          <span className="text-sm font-semibold text-slate-800">{message.sender}</span>
          <span className="text-slate-400">→</span>
          <span className="text-sm font-semibold text-slate-800">{message.receiver}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 text-lg leading-none font-light"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {message.hasFault && (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              ⚡ fault: {message.faultType}
            </span>
          )}
          {message.violatedProperties.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              ✗ {p}
            </span>
          ))}
          {message.milestoneHits.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              ★ {m}
            </span>
          ))}
        </div>

        {/* Content */}
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1 font-medium">Message</p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-mono">
            {message.content}
          </div>
        </div>

        {/* Cost */}
        {(message.input_tokens > 0 || message.output_tokens > 0) && (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1 font-medium">Tokens</p>
            <div className="flex gap-4 text-sm">
              <span className="text-slate-600"><span className="font-medium text-slate-800">{message.input_tokens}</span> in</span>
              <span className="text-slate-600"><span className="font-medium text-slate-800">{message.output_tokens}</span> out</span>
              {message.cost_usd > 0 && (
                <span className="text-slate-600"><span className="font-medium text-slate-800">${message.cost_usd.toFixed(5)}</span></span>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        {Object.keys(message.metadata).length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1 font-medium">Metadata</p>
            <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 overflow-x-auto">
              {JSON.stringify(message.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
