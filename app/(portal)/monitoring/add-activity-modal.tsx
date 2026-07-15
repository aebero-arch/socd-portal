"use client";

import { useState, useTransition } from "react";
import { X, Plus, Loader2, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { addActivity } from "@/lib/monitoring-actions";
import type { Pap } from "@/lib/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

interface Props {
  paps: Pap[];
  selectedPapId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddActivityModal({ paps, selectedPapId, onClose, onSuccess }: Props) {
  const [activityType, setActivityType] = useState<"one-time" | "monthly" | "quarterly">("one-time");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    // Clear irrelevant fields based on type
    if (activityType !== "quarterly") formData.delete("quarter");
    if (activityType !== "monthly") formData.delete("month");

    startTransition(async () => {
      const result = await addActivity(formData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => onSuccess(), 1200);
      } else {
        setError(result.error ?? "Unknown error");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-surface border border-border shadow-2xl tick-corners">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              SYS_OP // NEW_ACTIVITY
            </p>
            <h2 className="font-display font-semibold text-lg text-ink mt-0.5">
              Add Monitoring Activity
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink p-1 rounded cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Activity Type */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Activity Frequency <span className="text-warm">*</span>
            </label>
            <select
              name="activity_type"
              required
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as typeof activityType)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer font-body"
            >
              <option value="one-time">One-Time (no quarter/month)</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          {/* PAP Name */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              PAP (Program / Activity / Project) <span className="text-warm">*</span>
            </label>
            <select
              name="pap_id"
              required
              defaultValue={selectedPapId}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer font-body"
            >
              <option value="">— Select PAP —</option>
              {paps.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Quarter / Month row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
                Quarter
              </label>
              <select
                name="quarter"
                disabled={activityType !== "quarterly"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer font-body disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">N/A</option>
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
                Month
              </label>
              <select
                name="month"
                disabled={activityType !== "monthly"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer font-body disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">N/A</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Output / Deliverable */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Output / Deliverable <span className="text-warm">*</span>
            </label>
            <textarea
              name="output_deliverable"
              required
              rows={3}
              placeholder="e.g. Submission of Edited data file to RSSO"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-ink font-body resize-none"
            />
          </div>

          {/* Deadline */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Deadline <span className="text-warm">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                name="deadline"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-body"
              />
            </div>
          </div>

          {/* Response Rate Fillable toggle */}
          <div className="border border-border rounded-md p-4 bg-accent-50/20">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="response_rate_fillable"
                className="mt-0.5 accent-accent w-4 h-4 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-ink group-hover:text-accent transition-colors font-body">
                  Enable Response Rate field
                </p>
                <p className="text-xs text-ink-400 mt-0.5 leading-relaxed font-body">
                  Check this if PSOs are expected to enter a response rate (%) for this activity.
                </p>
              </div>
            </label>
          </div>

          {/* Error / success banners */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border-l-2 border-red-500 p-3 text-xs text-red-700 font-body">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 bg-accent-50 border-l-2 border-accent p-3 text-xs text-accent-600 font-body">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>Activity added successfully!</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-ink-400 hover:text-ink border border-border rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={(e) => {
              const form = (e.currentTarget as HTMLElement)
                .closest(".tick-corners")
                ?.querySelector("form") as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            disabled={isPending || success}
            className="flex items-center gap-2 px-5 py-2 bg-ink hover:bg-ink-700 disabled:bg-ink-400 text-white text-sm font-mono rounded-md transition-colors cursor-pointer shadow-sm"
          >
            {isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : success ? (
              <><CheckCircle2 size={14} /> Done!</>
            ) : (
              <><Plus size={14} /> Add Activity</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
