import { useState, useRef, useEffect } from "react";

interface Props {
  text: string;
}

export function InfoTip({ text }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center justify-center flex-shrink-0"
        aria-label="Info"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
          <circle cx="4" cy="1.5" r="0.8" />
          <rect x="3.2" y="3" width="1.6" height="4" rx="0.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-56 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg dark:shadow-slate-900/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pointer-events-none">
          {text}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-slate-800 border-l border-t border-slate-200 dark:border-slate-600" />
        </div>
      )}
    </div>
  );
}
