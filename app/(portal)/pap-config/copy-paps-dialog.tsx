"use client";

import { useState } from "react";
import { AlertCircle, Copy, Loader2, X } from "lucide-react";
import { PAP_SERVICES } from "@/lib/types";
import type { Pap } from "@/lib/types";
import { copyPapsToYear } from "./actions";

const NO_SERVICE = "No service yet";

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Lets the user pick which PAPs of one year to copy into another.
// PAPs whose name already exists in the target year can't be picked (they'd be skipped anyway).
export default function CopyPapsDialog({
  fromYear,
  toYear,
  sourcePaps,
  targetPaps,
  onClose,
}: {
  fromYear: number;
  toYear: number;
  sourcePaps: Pap[];
  targetPaps: Pap[];
  onClose: () => void;
}) {
  const alreadyThere = (pap: Pap) => targetPaps.some((t) => sameName(t.name, pap.name));
  const copyable = sourcePaps.filter((p) => !alreadyThere(p));

  const [selected, setSelected] = useState<Set<string>>(() => new Set(copyable.map((p) => p.id)));
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group by Service in the official order, unassigned last.
  const order: string[] = [...PAP_SERVICES, NO_SERVICE];
  const groups = order
    .map((service) => ({
      service,
      paps: sourcePaps
        .filter((p) => (p.service && PAP_SERVICES.includes(p.service as never) ? p.service : NO_SERVICE) === service)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.paps.length > 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(paps: Pap[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      paps.filter((p) => !alreadyThere(p)).forEach((p) => (on ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
  }

  async function handleCopy() {
    if (selected.size === 0) return;
    setCopying(true);
    setError(null);
    const res = await copyPapsToYear(fromYear, toYear, Array.from(selected));
    if (!res.success) {
      setCopying(false);
      setError(res.error || "Could not copy the PAPs.");
      return;
    }
    // Full reload so the list for the target year is fetched fresh.
    window.location.assign(`/pap-config?year=${toYear}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={copying ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-surface border border-border shadow-2xl rounded-xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
              Copy {fromYear} → {toYear}
            </p>
            <h3 className="font-display font-semibold text-base text-ink mt-0.5">Choose the PAPs to copy</h3>
            <p className="text-xs text-ink-400 mt-1">
              Each PAP keeps its Service, activities and focal persons, and its deadlines move to {toYear}.
              Submissions and ratings are not copied.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={copying}
            className="p-1 text-ink-400 hover:text-ink rounded-md"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-2.5 border-b border-border bg-ink/[0.02] text-xs font-mono">
          <span className="text-ink-400">
            <span className="text-ink font-semibold">{selected.size}</span> of {copyable.length} selected
          </span>
          <span className="flex gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set(copyable.map((p) => p.id)))}
              className="text-accent hover:underline disabled:opacity-50"
              disabled={copying}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-accent hover:underline disabled:opacity-50"
              disabled={copying}
            >
              Select none
            </button>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {sourcePaps.length === 0 && (
            <p className="text-sm text-ink-400">There are no PAPs in {fromYear} to copy.</p>
          )}
          {groups.map((group) => {
            const pickable = group.paps.filter((p) => !alreadyThere(p));
            const allOn = pickable.length > 0 && pickable.every((p) => selected.has(p.id));
            return (
              <section key={group.service}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h4
                    className={`font-mono text-[10px] uppercase tracking-widest font-semibold ${
                      group.service === NO_SERVICE ? "text-amber-700" : "text-ink"
                    }`}
                  >
                    {group.service}
                  </h4>
                  {pickable.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.paps, !allOn)}
                      className="font-mono text-[10px] text-accent hover:underline"
                      disabled={copying}
                    >
                      {allOn ? "Clear group" : "Select group"}
                    </button>
                  )}
                </div>
                <ul className="space-y-1">
                  {group.paps.map((pap) => {
                    const exists = alreadyThere(pap);
                    return (
                      <li key={pap.id}>
                        <label
                          className={`flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm ${
                            exists ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-ink/[0.02]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-accent"
                            checked={!exists && selected.has(pap.id)}
                            disabled={exists || copying}
                            onChange={() => toggle(pap.id)}
                          />
                          <span className="flex-1 text-ink">{pap.name}</span>
                          {exists && (
                            <span className="font-mono text-[10px] text-ink-400">already in {toYear}</span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={copying}
            className="px-3 py-1.5 text-xs font-mono text-ink-400 border border-border rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={copying || selected.size === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white text-xs font-mono rounded-md hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
            {copying
              ? "Copying…"
              : `Copy ${selected.size} PAP${selected.size !== 1 ? "s" : ""} to ${toYear}`}
          </button>
        </div>
      </div>
    </div>
  );
}
