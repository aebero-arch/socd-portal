"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";

// Optional helper for the Response Rate field:
// response rate (%) = total collected / submitted ÷ total workload × 100
export default function ResponseRateCalculator({
  onUse,
  onClose,
}: {
  onUse: (rate: string) => void;
  onClose: () => void;
}) {
  const [collected, setCollected] = useState("");
  const [workload, setWorkload] = useState("");

  const c = collected.trim() === "" ? null : Number(collected);
  const w = workload.trim() === "" ? null : Number(workload);

  let error: string | null = null;
  let rate: number | null = null;
  if (c !== null && w !== null) {
    if (!Number.isFinite(c) || !Number.isFinite(w) || c < 0 || w < 0) {
      error = "Enter numbers of zero or more.";
    } else if (w === 0) {
      error = "Total workload must be more than zero.";
    } else if (c > w) {
      error = "Total collected can't be more than the total workload.";
    } else {
      rate = Math.round((c / w) * 100 * 100) / 100;
    }
  }

  function handleUse(e: React.FormEvent) {
    e.preventDefault();
    if (rate === null) return;
    onUse(String(rate));
  }

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20";
  const labelCls = "block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-1";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Response rate calculator">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <form
        onSubmit={handleUse}
        className="relative z-10 w-full max-w-sm bg-surface border border-border shadow-2xl rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="flex items-center gap-2 font-display font-semibold text-sm text-ink">
            <Calculator size={15} className="text-accent" /> Response rate calculator
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-ink-400 hover:text-ink rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className={labelCls} htmlFor="rr-collected">Total collected / submitted</label>
            <input
              id="rr-collected"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              autoFocus
              value={collected}
              onChange={(e) => setCollected(e.target.value)}
              placeholder="e.g. 184"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="rr-workload">Total workload</label>
            <input
              id="rr-workload"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={workload}
              onChange={(e) => setWorkload(e.target.value)}
              placeholder="e.g. 200"
              className={inputCls}
            />
          </div>

          <div className="rounded-md border border-border bg-ink-50/40 px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">Response rate</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-ink">
              {rate !== null ? `${rate.toFixed(2)}%` : "—"}
            </p>
            <p className="text-[11px] text-ink-400">Total collected ÷ total workload × 100</p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono text-ink-400 border border-border rounded-md hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={rate === null}
            className="px-4 py-1.5 bg-accent text-white text-xs font-mono rounded-md hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use this rate
          </button>
        </div>
      </form>
    </div>
  );
}
