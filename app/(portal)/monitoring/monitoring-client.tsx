"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Plus, Trash2, Save, X, ChevronDown, Filter,
  AlertCircle, Loader2, RefreshCw,
} from "lucide-react";
import type { Pap, PapActivity, PortalRole } from "@/lib/types";
import { patchActivity, deleteActivity, getActivities } from "@/lib/monitoring-actions";
import AddActivityModal from "./add-activity-modal";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

// ── Rating helpers ──────────────────────────────────────────────────────────
function calcQualityRating(rr: number | null): number | null {
  if (rr === null) return null;
  if (rr >= 95) return 5.0;
  if (rr >= 90) return 4.0;
  if (rr >= 80) return 3.0;
  return 2.0;
}

function calcTimelinessRating(deadline: string, actual: string | null): number | null {
  if (!actual) return null;
  return new Date(actual) <= new Date(deadline) ? 5.0 : 3.0;
}

function calcAverage(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v !== null);
  if (!valid.length) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function RatingBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-400/40 text-xs">—</span>;
  const color =
    value >= 4.5 ? "bg-emerald-100 text-emerald-700" :
    value >= 3.5 ? "bg-blue-100 text-blue-700" :
    value >= 2.5 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>
      {value.toFixed(1)}
    </span>
  );
}

// ── Inline editable cell ────────────────────────────────────────────────────
function EditableCell({
  value,
  type = "text",
  disabled = false,
  onSave,
}: {
  value: string | number | null;
  type?: "text" | "date" | "number" | "textarea";
  disabled?: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);

  if (disabled) {
    return (
      <span className="text-xs text-ink-400/40 cursor-not-allowed select-none">
        {value !== null && value !== "" ? String(value) : "—"}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(String(value ?? "")); setEditing(true); }}
        className="text-xs text-ink hover:text-accent transition-colors text-left w-full group"
      >
        {value !== null && value !== "" ? (
          type === "date" ? fmtDate(String(value)) : String(value)
        ) : (
          <span className="text-ink-400/40 group-hover:text-accent/60">Click to edit</span>
        )}
      </button>
    );
  }

  async function handleSave() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  const inputCls =
    "text-xs border border-accent/40 rounded px-2 py-1 bg-background text-ink focus:outline-none focus:ring-1 focus:ring-accent/30 w-full";

  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      {type === "textarea" ? (
        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
      ) : (
        <input
          type={type}
          className={inputCls}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
      )}
      <div className="flex gap-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-0.5 px-2 py-0.5 bg-ink text-white text-[10px] font-mono rounded hover:bg-ink-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="flex items-center gap-0.5 px-2 py-0.5 border border-border text-ink-400 text-[10px] font-mono rounded hover:text-ink transition-colors"
        >
          <X size={10} /> Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
interface Props {
  paps: Pap[];
  initialActivities: PapActivity[];
  userRole: PortalRole | null;
}

export default function MonitoringClient({ paps, initialActivities, userRole }: Props) {
  const [activities, setActivities] = useState<PapActivity[]>(initialActivities);
  const [selectedPapId, setSelectedPapId] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isRSSO = userRole === "RSSO";

  // ── Reload from server ────────────────────────────────────────────────────
  const reload = useCallback(() => {
    startTransition(async () => {
      const fresh = await getActivities(
        selectedPapId || undefined,
        selectedQuarter || undefined,
        selectedMonth || undefined,
      );
      setActivities(fresh);
    });
  }, [selectedPapId, selectedQuarter, selectedMonth]);

  // Apply filters when changed
  function handlePapChange(id: string) {
    setSelectedPapId(id);
    setSelectedQuarter("");
    setSelectedMonth("");
    startTransition(async () => {
      const fresh = await getActivities(id || undefined);
      setActivities(fresh);
    });
  }

  function handleQuarterChange(q: string) {
    setSelectedQuarter(q);
    startTransition(async () => {
      const fresh = await getActivities(selectedPapId || undefined, q || undefined, selectedMonth || undefined);
      setActivities(fresh);
    });
  }

  function handleMonthChange(m: string) {
    setSelectedMonth(m);
    startTransition(async () => {
      const fresh = await getActivities(selectedPapId || undefined, selectedQuarter || undefined, m || undefined);
      setActivities(fresh);
    });
  }

  // ── Patch helpers ─────────────────────────────────────────────────────────
  async function handlePatch(id: string, patch: Parameters<typeof patchActivity>[1]) {
    const result = await patchActivity(id, patch);
    if (result.success) reload();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteActivity(id);
    setDeletingId(null);
    reload();
  }

  // ── filtered view ─────────────────────────────────────────────────────────
  const displayed = activities.filter((a) => {
    if (selectedPapId && a.pap_id !== selectedPapId) return false;
    if (selectedQuarter && a.quarter !== selectedQuarter) return false;
    if (selectedMonth && a.month !== selectedMonth) return false;
    return true;
  });

  // ── Table header config ───────────────────────────────────────────────────
  const baseHeaders = [
    "PAP Name", "Quarter", "Month", "Output / Deliverable",
    "Deadline", "Actual Submission", "RSSO Remarks", "PSO Remarks", "Response Rate (%)",
  ];
  const rssoHeaders = ["Rating — Quantity", "Rating — Quality", "Rating — Timeliness", "Avg Rating"];
  const headers = isRSSO ? [...baseHeaders, ...rssoHeaders, ""] : [...baseHeaders, ""];

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* PAP Selector */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400 shrink-0">PAP</span>
          <div className="relative">
            <select
              value={selectedPapId}
              onChange={(e) => handlePapChange(e.target.value)}
              className="appearance-none rounded-md border border-border bg-surface px-3 py-2 pr-8 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer min-w-[280px]"
            >
              <option value="">— All PAPs —</option>
              {paps.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>
        </div>

        {/* Quarter Filter */}
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-ink-400" />
          <select
            value={selectedQuarter}
            onChange={(e) => handleQuarterChange(e.target.value)}
            className="appearance-none rounded-md border border-border bg-surface px-3 py-2 pr-7 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
          >
            <option value="">All Quarters</option>
            {QUARTERS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <select
          value={selectedMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="appearance-none rounded-md border border-border bg-surface px-3 py-2 pr-7 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
        >
          <option value="">All Months</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Refresh */}
        <button
          onClick={reload}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs font-mono text-ink-400 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={isPending ? "animate-spin" : ""} />
          Refresh
        </button>

        {/* Role badge */}
        <span className={`ml-auto font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${
          isRSSO
            ? "bg-accent/10 text-accent border border-accent/20"
            : "bg-ink/10 text-ink-400 border border-border"
        }`}>
          {userRole ?? "Guest"} role
        </span>

        {/* Add Activity (RSSO only) */}
        {isRSSO && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-600 text-white text-sm font-mono rounded-md transition-colors shadow-sm"
          >
            <Plus size={15} />
            Add Activity
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-ink/5 border-b border-border">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-400 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-12 text-center">
                  <p className="font-mono text-[11px] text-ink-400/60 uppercase tracking-widest">
                    No activities found
                  </p>
                  <p className="text-xs text-ink-400/40 mt-1 font-body">
                    {isRSSO ? 'Use "Add Activity" to create one.' : "No activities have been added yet."}
                  </p>
                </td>
              </tr>
            ) : (
              displayed.map((row) => {
                const qualityRating = calcQualityRating(row.response_rate);
                const timelinessRating = calcTimelinessRating(row.deadline, row.actual_submission);
                const avgRating = calcAverage([row.rating_quantity, qualityRating, timelinessRating]);

                return (
                  <tr key={row.id} className="hover:bg-ink/[0.02] transition-colors group">
                    {/* 1 — PAP Name */}
                    <td className="px-3 py-3 max-w-[180px]">
                      <span className="text-xs font-medium text-ink leading-snug line-clamp-2">
                        {row.pap_name ?? "—"}
                      </span>
                    </td>

                    {/* 2 — Quarter */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs text-ink-400">{row.quarter ?? "—"}</span>
                    </td>

                    {/* 3 — Month */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs text-ink-400">{row.month ?? "—"}</span>
                    </td>

                    {/* 4 — Output/Deliverable */}
                    <td className="px-3 py-3 max-w-[220px]">
                      <span className="text-xs text-ink leading-snug line-clamp-3">
                        {row.output_deliverable}
                      </span>
                    </td>

                    {/* 5 — Deadline */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-ink-400">{fmtDate(row.deadline)}</span>
                    </td>

                    {/* 6 — Actual Submission (editable: RSSO + PSO) */}
                    <td className="px-3 py-3 min-w-[130px]">
                      <EditableCell
                        value={row.actual_submission}
                        type="date"
                        onSave={(v) => handlePatch(row.id, { actual_submission: v || null })}
                      />
                    </td>

                    {/* 7 — RSSO Remarks (editable: RSSO only) */}
                    <td className="px-3 py-3 min-w-[160px] max-w-[200px]">
                      <EditableCell
                        value={row.rsso_remarks}
                        type="textarea"
                        disabled={!isRSSO}
                        onSave={(v) => handlePatch(row.id, { rsso_remarks: v })}
                      />
                    </td>

                    {/* 8 — PSO Remarks (editable: PSO only) */}
                    <td className="px-3 py-3 min-w-[160px] max-w-[200px]">
                      <EditableCell
                        value={row.pso_remarks}
                        type="textarea"
                        disabled={isRSSO}
                        onSave={(v) => handlePatch(row.id, { pso_remarks: v })}
                      />
                    </td>

                    {/* 9 — Response Rate (editable if fillable; RSSO + PSO) */}
                    <td className="px-3 py-3 min-w-[110px]">
                      <EditableCell
                        value={row.response_rate}
                        type="number"
                        disabled={!row.response_rate_fillable}
                        onSave={(v) => handlePatch(row.id, { response_rate: v ? parseFloat(v) : null })}
                      />
                    </td>

                    {/* 10–12 — Ratings (RSSO only) */}
                    {isRSSO && (
                      <>
                        {/* Quantity — RSSO can manually set */}
                        <td className="px-3 py-3 min-w-[110px]">
                          <EditableCell
                            value={row.rating_quantity}
                            type="number"
                            onSave={(v) => handlePatch(row.id, { rating_quantity: v ? parseFloat(v) : null })}
                          />
                        </td>
                        {/* Quality — auto */}
                        <td className="px-3 py-3">
                          <RatingBadge value={qualityRating} />
                        </td>
                        {/* Timeliness — auto */}
                        <td className="px-3 py-3">
                          <RatingBadge value={timelinessRating} />
                        </td>
                        {/* 13 — Average */}
                        <td className="px-3 py-3">
                          <RatingBadge value={avgRating} />
                        </td>
                      </>
                    )}

                    {/* Delete (RSSO only) */}
                    <td className="px-3 py-3">
                      {isRSSO && (
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 transition-all p-1 rounded disabled:opacity-50"
                          title="Delete activity"
                        >
                          {deletingId === row.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Row count */}
      <p className="text-[11px] font-mono text-ink-400/60">
        {displayed.length} activit{displayed.length === 1 ? "y" : "ies"} shown
      </p>

      {/* Add Activity Modal */}
      {showAddModal && (
        <AddActivityModal
          paps={paps}
          selectedPapId={selectedPapId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
