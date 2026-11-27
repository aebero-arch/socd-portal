"use client";

import { useState } from "react";
import { Dialog, DialogActions, FormError } from "@/components/dialog";
import { useSaveStatus } from "@/lib/form-status";
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
  const { busy: copying, error, run } = useSaveStatus();

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
    const res = await run(() => copyPapsToYear(fromYear, toYear, Array.from(selected)), "Could not copy the PAPs.");
    // Full reload so the list for the target year is fetched fresh.
    if (res) window.location.assign(`/pap-config?year=${toYear}`);
  }

  return (
    <Dialog
      title={`Copy ${fromYear} PAPs to ${toYear}`}
      onClose={onClose}
      busy={copying}
      size="lg"
      footer={
        <DialogActions
          onCancel={onClose}
          busy={copying}
          busyLabel="Copying…"
          label={`Copy ${selected.size} PAP${selected.size !== 1 ? "s" : ""} to ${toYear}`}
          disabled={selected.size === 0}
          onConfirm={handleCopy}
        />
      }
    >
      <div className="flex items-center justify-between gap-3 -mx-6 -mt-4 px-6 py-2.5 border-b border-border bg-ink/[0.02] text-xs font-mono">
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

      <div className="space-y-5">
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
      <FormError message={error} />
    </Dialog>
  );
}
