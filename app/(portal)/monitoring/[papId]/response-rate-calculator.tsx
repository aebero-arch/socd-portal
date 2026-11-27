"use client";

import { useState } from "react";
import { Dialog, DialogActions } from "@/components/dialog";

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
    <Dialog
      title="Response rate calculator"
      onClose={onClose}
      onSubmit={handleUse}
      size="sm"
      stacked
      footer={<DialogActions onCancel={onClose} label="Use this rate" disabled={rate === null} />}
    >
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
          className={inputCls}
        />
      </div>

      <div className="rounded-md border border-border bg-ink-50/40 px-3 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">Response rate</p>
        <p className="mt-0.5 font-mono text-lg font-semibold text-ink">
          {rate !== null ? `${rate.toFixed(2)}%` : "—"}
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </Dialog>
  );
}
