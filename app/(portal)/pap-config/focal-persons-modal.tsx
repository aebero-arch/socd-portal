"use client";

import { useState } from "react";
import { AlertCircle, Loader2, UserCheck, X } from "lucide-react";
import { PSO_OFFICES } from "@/lib/types";
import type { FocalAssignment, StaffOption } from "@/lib/types";
import { saveFocalAssignment } from "./actions";

type Row = { focal_id: string; alternate_id: string };

const selectCls =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

export default function FocalPersonsModal({
  papId,
  papName,
  assignments,
  staff,
  onClose,
  onSaved,
}: {
  papId: string;
  papName: string;
  assignments: FocalAssignment[];
  staff: StaffOption[];
  onClose: () => void;
  onSaved: (updated: FocalAssignment[]) => void;
}) {
  const initialRows: Record<string, Row> = {};
  PSO_OFFICES.forEach((office) => {
    const a = assignments.find((x) => x.office === office);
    initialRows[office] = { focal_id: a?.focal_id ?? "", alternate_id: a?.alternate_id ?? "" };
  });

  const [rows, setRows] = useState<Record<string, Row>>(initialRows);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setField(office: string, field: keyof Row, value: string) {
    setRows((prev) => ({ ...prev, [office]: { ...prev[office], [field]: value } }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[office];
      return next;
    });
  }

  async function handleSave() {
    const nextErrors: Record<string, string> = {};
    const changed = PSO_OFFICES.filter(
      (o) =>
        rows[o].focal_id !== initialRows[o].focal_id ||
        rows[o].alternate_id !== initialRows[o].alternate_id
    );
    changed.forEach((o) => {
      if (rows[o].focal_id && rows[o].focal_id === rows[o].alternate_id) {
        nextErrors[o] = "Focal and alternate must be different people.";
      }
    });
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    if (!changed.length) {
      onClose();
      return;
    }

    setSaving(true);
    const updated: FocalAssignment[] = assignments.filter((a) => !(changed as string[]).includes(a.office));
    for (const office of changed) {
      const res = await saveFocalAssignment(
        papId,
        office,
        rows[office].focal_id || null,
        rows[office].alternate_id || null
      );
      if (res.success && res.data) {
        if (res.data.focal_id || res.data.alternate_id) updated.push(res.data);
      } else {
        nextErrors[office] = res.error || "Could not save.";
        const previous = assignments.find((a) => a.office === office);
        if (previous) updated.push(previous);
      }
    }
    setSaving(false);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      onSaved(updated);
      return;
    }
    onSaved(updated);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-3xl bg-surface border border-border shadow-2xl rounded-xl">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <h3 className="font-display font-semibold text-base text-ink">Focal persons · {papName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1 text-ink-400 hover:text-ink rounded-md"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="hidden sm:grid grid-cols-[1.1fr_1fr_1fr] gap-3 font-mono text-[10px] uppercase tracking-wider text-ink-400">
            <span>Province</span>
            <span>Focal person</span>
            <span>Alternate</span>
          </div>
          {PSO_OFFICES.map((office) => {
            const options = staff.filter((s) => s.office === office);
            const row = rows[office];
            return (
              <div key={office} className="border-b border-border/50 pb-3 last:border-0">
                <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr_1fr] gap-2 sm:gap-3 sm:items-center">
                  <div className="text-sm font-medium text-ink">
                    {office}
                    {options.length === 0 && (
                      <span className="block text-[11px] font-normal text-amber-700">
                        No staff listed for this province yet
                      </span>
                    )}
                  </div>
                  <select
                    aria-label={`Focal person for ${office}`}
                    className={selectCls}
                    value={row.focal_id}
                    disabled={saving || options.length === 0}
                    onChange={(e) => setField(office, "focal_id", e.target.value)}
                  >
                    <option value="">— None —</option>
                    {options.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.role ? ` · ${s.role}` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Alternate for ${office}`}
                    className={selectCls}
                    value={row.alternate_id}
                    disabled={saving || options.length === 0}
                    onChange={(e) => setField(office, "alternate_id", e.target.value)}
                  >
                    <option value="">— None —</option>
                    {options
                      .filter((s) => s.id !== row.focal_id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.role ? ` · ${s.role}` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                {errors[office] && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
                    <AlertCircle size={12} /> {errors[office]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-mono text-ink-400 border border-border rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white text-xs font-mono rounded-md hover:bg-accent-600 disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
