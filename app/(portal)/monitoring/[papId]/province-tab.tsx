"use client";

import { useState, useTransition, useCallback, Fragment } from "react";
import {
  Filter,
  Loader2, RefreshCw, Edit2, X, Save, AlertCircle, CheckCircle2, CalendarDays,
} from "lucide-react";
import type { Pap, PapActivity, PapSubmission, PortalRole } from "@/lib/types";
import { upsertSubmission, getActivities, getSubmissions } from "@/lib/monitoring-actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

interface SubGroup {
  key: string;
  title: string;
  periodDisplay: string;
  activities: PapActivity[];
}

interface CategoryGroup {
  key: string;
  title: string;
  colorClass: string;
  badgeClass: string;
  subGroups: SubGroup[];
}

function getActivityMonth(act: PapActivity): string {
  if (act.month && act.month.trim()) {
    const match = MONTHS.find((m) => m.toLowerCase() === act.month!.trim().toLowerCase());
    if (match) return match;
    return act.month.trim();
  }
  if (act.deadline && act.deadline.includes("-")) {
    const parts = act.deadline.split("-");
    const mNum = parseInt(parts[1], 10);
    if (mNum >= 1 && mNum <= 12) {
      return MONTHS[mNum - 1];
    }
  }
  return "General / Unassigned";
}

function getActivityQuarter(act: PapActivity): string {
  if (act.quarter && act.quarter.trim()) {
    const q = act.quarter.trim().toUpperCase();
    if (q.includes("1") || q === "Q1") return "Q1";
    if (q.includes("2") || q === "Q2") return "Q2";
    if (q.includes("3") || q === "Q3") return "Q3";
    if (q.includes("4") || q === "Q4") return "Q4";
    return act.quarter.trim();
  }
  if (act.deadline && act.deadline.includes("-")) {
    const parts = act.deadline.split("-");
    const mNum = parseInt(parts[1], 10);
    if (mNum >= 1 && mNum <= 3) return "Q1";
    if (mNum >= 4 && mNum <= 6) return "Q2";
    if (mNum >= 7 && mNum <= 9) return "Q3";
    if (mNum >= 10 && mNum <= 12) return "Q4";
  }
  return "Q1";
}

function groupActivitiesHierarchical(acts: PapActivity[]): CategoryGroup[] {
  const monthlyActs = acts.filter((a) => (a.activity_type || "").toLowerCase() === "monthly");
  const quarterlyActs = acts.filter((a) => (a.activity_type || "").toLowerCase() === "quarterly");
  const oneTimeActs = acts.filter((a) => (a.activity_type || "").toLowerCase() === "one-time");

  const categories: CategoryGroup[] = [];

  // 1. Monthly
  if (monthlyActs.length > 0) {
    const subGroups: SubGroup[] = [];
    const orderedMonths = [
      ...MONTHS.filter((m) => monthlyActs.some((a) => getActivityMonth(a) === m)),
      ...Array.from(new Set(monthlyActs.map((a) => getActivityMonth(a)).filter((m) => !MONTHS.includes(m)))),
    ];

    for (const m of orderedMonths) {
      const items = monthlyActs.filter((a) => getActivityMonth(a) === m);
      if (items.length > 0) {
        subGroups.push({
          key: `month-${m}`,
          title: m,
          periodDisplay: m,
          activities: items,
        });
      }
    }

    categories.push({
      key: "monthly",
      title: "Monthly",
      colorClass: "bg-blue-50/80 border-blue-200 text-blue-950",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-200/80",
      subGroups,
    });
  }

  // 2. Quarterly
  if (quarterlyActs.length > 0) {
    const subGroups: SubGroup[] = [];
    const qLabels: Record<string, string> = {
      Q1: "First Quarter (Q1)",
      Q2: "Second Quarter (Q2)",
      Q3: "Third Quarter (Q3)",
      Q4: "Fourth Quarter (Q4)",
    };
    const orderedQuarters = [
      ...["Q1", "Q2", "Q3", "Q4"].filter((q) => quarterlyActs.some((a) => getActivityQuarter(a) === q)),
      ...Array.from(new Set(quarterlyActs.map((a) => getActivityQuarter(a)).filter((q) => !["Q1", "Q2", "Q3", "Q4"].includes(q)))),
    ];

    for (const q of orderedQuarters) {
      const items = quarterlyActs.filter((a) => getActivityQuarter(a) === q);
      if (items.length > 0) {
        subGroups.push({
          key: `quarter-${q}`,
          title: qLabels[q] || q,
          periodDisplay: q,
          activities: items,
        });
      }
    }

    categories.push({
      key: "quarterly",
      title: "Quarterly",
      colorClass: "bg-purple-50/80 border-purple-200 text-purple-950",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-200/80",
      subGroups,
    });
  }

  // 3. One-Time
  if (oneTimeActs.length > 0) {
    categories.push({
      key: "one-time",
      title: "One-Time",
      colorClass: "bg-amber-50/80 border-amber-200 text-amber-950",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200/80",
      subGroups: [
        {
          key: "one-time-all",
          title: "One-Time Deliverables",
          periodDisplay: "",
          activities: oneTimeActs,
        },
      ],
    });
  }

  return categories;
}

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

// ── Edit Submission Modal ───────────────────────────────────────────────────
interface EditModalProps {
  activity: PapActivity;
  submission: PapSubmission | undefined;
  office: string;
  userRole: PortalRole | null;
  onClose: () => void;
  onSave: (patch: Parameters<typeof upsertSubmission>[2]) => Promise<void>;
}

function SubmissionEditModal({ activity, submission, office, userRole, onClose, onSave }: EditModalProps) {
  const isRSSO = userRole === "RSSO" || userRole === "SuperAdmin";
  const isPSO  = userRole === "PSO";

  const [actualSubmission, setActualSubmission] = useState(submission?.actual_submission ?? "");
  const [psoRemarks, setPsoRemarks]             = useState(submission?.pso_remarks ?? "");
  const [rssoRemarks, setRssoRemarks]           = useState(submission?.rsso_remarks ?? "");
  const [responseRate, setResponseRate]         = useState(
    submission?.response_rate != null ? String(submission.response_rate) : ""
  );
  const [ratingQty, setRatingQty] = useState(
    submission?.rating_quantity != null ? String(submission.rating_quantity) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [saved, setSaved]   = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const patch: Parameters<typeof upsertSubmission>[2] = {};
    patch.actual_submission = actualSubmission || null;
    if (isPSO || isRSSO) {
      patch.pso_remarks = psoRemarks || null;
      if (activity.response_rate_fillable) {
        patch.response_rate = responseRate ? parseFloat(responseRate) : null;
      }
    }
    if (isRSSO) {
      patch.rsso_remarks    = rssoRemarks || null;
      patch.rating_quantity = ratingQty ? parseFloat(ratingQty) : null;
    }
    try {
      await onSave(patch);
      setSaved(true);
      setTimeout(onClose, 600);
    } catch (err: any) {
      setError(err.message || "Failed to save.");
    }
    setSaving(false);
  }

  const inputCls  = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-body disabled:opacity-40 disabled:cursor-not-allowed";
  const labelCls  = "block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border shadow-2xl rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-ink-50">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              {office} — Submission
            </p>
            <h2 className="font-display font-semibold text-base text-ink mt-0.5 line-clamp-2">
              {activity.output_deliverable}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink p-1 rounded cursor-pointer transition-colors ml-4 shrink-0">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Deadline context */}
          <div className="flex items-center gap-3 bg-ink-50/40 border border-border rounded-md px-3 py-2 text-xs">
            <span className="font-mono text-ink-400 uppercase tracking-wider text-[10px] shrink-0">Deadline</span>
            <span className="font-mono text-ink font-semibold">{fmtDate(activity.deadline)}</span>
          </div>

          {/* Actual Submission — all roles */}
          <div>
            <label className={labelCls}>Actual Date of Submission</label>
            <input
              type="date"
              value={actualSubmission}
              onChange={(e) => setActualSubmission(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* PSO Remarks — PSO + RSSO/SuperAdmin */}
          {(isPSO || isRSSO) && (
            <div>
              <label className={labelCls}>PSO Remarks</label>
              <textarea
                value={psoRemarks}
                onChange={(e) => setPsoRemarks(e.target.value)}
                rows={3}
                placeholder="Enter PSO remarks or notes..."
                className={`${inputCls} resize-none`}
              />
            </div>
          )}

          {/* Response Rate — PSO + RSSO, only if fillable */}
          {(isPSO || isRSSO) && activity.response_rate_fillable && (
            <div>
              <label className={labelCls}>
                Response Rate (%)
                <span className="ml-2 text-accent normal-case tracking-normal">required for this output</span>
              </label>
              <input
                type="number" min="0" max="100" step="0.01"
                value={responseRate}
                onChange={(e) => setResponseRate(e.target.value)}
                placeholder="e.g. 92.5"
                className={inputCls}
              />
            </div>
          )}

          {/* RSSO Remarks — RSSO/SuperAdmin only */}
          {isRSSO && (
            <div>
              <label className={labelCls}>RSSO Remarks</label>
              <textarea
                value={rssoRemarks}
                onChange={(e) => setRssoRemarks(e.target.value)}
                rows={3}
                placeholder="Enter RSSO remarks or notes..."
                className={`${inputCls} resize-none`}
              />
            </div>
          )}

          {/* Rating Quantity — RSSO only */}
          {isRSSO && (
            <div>
              <label className={labelCls}>Rating — Quantity (manual)</label>
              <input
                type="number" min="0" max="5" step="0.1"
                value={ratingQty}
                onChange={(e) => setRatingQty(e.target.value)}
                placeholder="e.g. 4.5"
                className={inputCls}
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border-l-2 border-red-500 p-3 text-xs text-red-700 rounded">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {saved && (
            <div className="flex items-start gap-2 bg-accent-50 border-l-2 border-accent p-3 text-xs text-accent-600 rounded">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>Saved!</span>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-ink-400 hover:text-ink border border-border rounded-md transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave as any} disabled={saving || saved}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-mono rounded-md transition-colors cursor-pointer shadow-sm">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : saved  ? <><CheckCircle2 size={14} /> Saved!</>
              : <><Save size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Province Tab Component ─────────────────────────────────────────────
interface Props {
  pap: Pap;
  office: string;
  activities: PapActivity[];
  submissions: PapSubmission[];
  userRole: PortalRole | null;
  onActivitiesChange: (acts: PapActivity[]) => void;
  onSubmissionsChange: (subs: PapSubmission[]) => void;
}

export default function ProvinceTab({
  pap,
  office,
  activities,
  submissions,
  userRole,
  onActivitiesChange,
  onSubmissionsChange,
}: Props) {
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [selectedMonth,   setSelectedMonth]   = useState("");
  const [editingAct,      setEditingAct]       = useState<PapActivity | null>(null);
  const [isPending,       startTransition]     = useTransition();

  const isRSSO = userRole === "RSSO" || userRole === "SuperAdmin";

  const subMap = new Map<string, PapSubmission>();
  for (const s of submissions) {
    if (s.office === office) subMap.set(s.pap_monitoring_id, s);
  }

  const reload = useCallback(() => {
    startTransition(async () => {
      const [freshActs, freshSubs] = await Promise.all([
        getActivities(pap.id, selectedQuarter || undefined, selectedMonth || undefined),
        getSubmissions(pap.id),
      ]);
      onActivitiesChange(freshActs);
      onSubmissionsChange(freshSubs);
    });
  }, [pap.id, selectedQuarter, selectedMonth, onActivitiesChange, onSubmissionsChange]);

  function handleQuarterChange(q: string) {
    setSelectedQuarter(q);
    startTransition(async () => {
      const fresh = await getActivities(pap.id, q || undefined, selectedMonth || undefined);
      onActivitiesChange(fresh);
    });
  }

  function handleMonthChange(m: string) {
    setSelectedMonth(m);
    startTransition(async () => {
      const fresh = await getActivities(pap.id, selectedQuarter || undefined, m || undefined);
      onActivitiesChange(fresh);
    });
  }

  async function handleSave(activityId: string, patch: Parameters<typeof upsertSubmission>[2]) {
    const result = await upsertSubmission(activityId, office, patch);
    if (!result.success) throw new Error(result.error);
    const freshSubs = await getSubmissions(pap.id);
    onSubmissionsChange(freshSubs);
  }

  const displayed = activities.filter((a) => {
    if (selectedQuarter && a.quarter !== selectedQuarter) return false;
    if (selectedMonth   && a.month   !== selectedMonth)   return false;
    return true;
  });

  const baseHeaders = [
    "Period", "Output / Deliverable", "Deadline",
    "Actual Submission", "RSSO Remarks", "PSO Remarks", "Response Rate (%)"
  ];
  const rssoHeaders = ["Rating — Qty", "Rating — Quality", "Rating — Timeliness", "Avg Rating"];
  const headers = isRSSO ? [...baseHeaders, ...rssoHeaders, ""] : [...baseHeaders, ""];

  const hierarchicalGroups = groupActivitiesHierarchical(displayed);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-ink-400" />
          <select
            value={selectedQuarter}
            onChange={(e) => handleQuarterChange(e.target.value)}
            className="appearance-none rounded-md border border-border bg-surface px-3 py-1.5 pr-7 text-xs text-ink font-body focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
          >
            <option value="">All Quarters</option>
            {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="appearance-none rounded-md border border-border bg-surface px-3 py-1.5 pr-7 text-xs text-ink font-body focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
        >
          <option value="">All Months</option>
          {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button
          onClick={reload}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs font-mono text-ink-400 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isPending ? "animate-spin" : ""} />
          Refresh
        </button>
        <span className={`ml-auto font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${
          isRSSO ? "bg-accent/10 text-accent border border-accent/20" : "bg-ink/10 text-ink-400 border border-border"
        }`}>
          {userRole ?? "Guest"} role
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-ink/5 border-b border-border">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          {displayed.length === 0 ? (
            <tbody className="divide-y divide-border/50">
              <tr>
                <td colSpan={headers.length} className="px-4 py-12 text-center">
                  <p className="font-mono text-[11px] text-ink-400/60 uppercase tracking-widest">No activities found</p>
                  <p className="text-xs text-ink-400/40 mt-1 font-body">
                    Configure activities in PAP Configuration.
                  </p>
                </td>
              </tr>
            </tbody>
          ) : (
            hierarchicalGroups.map((cat) => (
              <tbody key={cat.key} className="divide-y divide-border/50">
                {/* Level 1 Category Header: Monthly, Quarterly, One-Time */}
                <tr className={`${cat.colorClass} border-t-2 border-border font-display`}>
                  <td colSpan={headers.length} className="px-4 py-2 font-bold text-xs uppercase tracking-wider">
                    {cat.title}
                  </td>
                </tr>

                {/* Level 2 Sub-groups: Months, Quarters, etc. */}
                {cat.subGroups.map((subGroup) => (
                  <Fragment key={subGroup.key}>
                    {cat.key !== "one-time" && (
                      <tr className="bg-ink/[0.02] border-t border-border/70">
                        <td colSpan={headers.length} className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <CalendarDays size={12} className="text-accent" />
                            <span className="font-mono font-semibold text-xs text-ink-700">
                              {subGroup.title}
                            </span>
                            <span className="text-[10px] font-mono text-ink-400">
                              ({subGroup.activities.length} item{subGroup.activities.length !== 1 ? "s" : ""})
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {subGroup.activities.map((act) => {
                      const sub             = subMap.get(act.id);
                      const qualityRating   = calcQualityRating(sub?.response_rate ?? null);
                      const timelinessRating = calcTimelinessRating(act.deadline, sub?.actual_submission ?? null);
                      const avgRating       = calcAverage([sub?.rating_quantity ?? null, qualityRating, timelinessRating]);

                      const periodText = act.activity_type === "monthly"
                        ? getActivityMonth(act)
                        : act.activity_type === "quarterly"
                        ? getActivityQuarter(act)
                        : "";

                      return (
                        <tr key={act.id} className="hover:bg-ink/[0.02] transition-colors group">
                          {/* Period (Month or Quarter, blank for one-time) */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs text-ink-500 font-mono">
                              {periodText || <span className="text-ink-300">—</span>}
                            </span>
                          </td>

                          {/* Deliverable */}
                          <td className="px-3 py-3 max-w-[260px]">
                            <span className="text-xs text-ink leading-snug line-clamp-3 font-body">{act.output_deliverable}</span>
                          </td>

                          {/* Deadline */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-xs font-mono text-ink-400">{fmtDate(act.deadline)}</span>
                          </td>

                          {/* Actual Submission */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            {sub?.actual_submission
                              ? <span className="text-xs font-mono text-ink font-medium">{fmtDate(sub.actual_submission)}</span>
                              : <span className="text-xs text-ink-400/40 italic">Not yet submitted</span>}
                          </td>

                          {/* RSSO Remarks */}
                          <td className="px-3 py-3 max-w-[160px]">
                            <span className="text-xs text-ink-400 line-clamp-2 leading-relaxed">
                              {sub?.rsso_remarks || <span className="text-ink-400/30">—</span>}
                            </span>
                          </td>

                          {/* PSO Remarks */}
                          <td className="px-3 py-3 max-w-[160px]">
                            <span className="text-xs text-ink-400 line-clamp-2 leading-relaxed">
                              {sub?.pso_remarks || <span className="text-ink-400/30">—</span>}
                            </span>
                          </td>

                          {/* Response Rate */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            {act.response_rate_fillable
                              ? sub?.response_rate != null
                                ? <span className="text-xs font-mono text-ink">{sub.response_rate}%</span>
                                : <span className="text-xs text-ink-400/40 italic">—</span>
                              : <span className="text-[10px] text-ink-400/30 font-mono">N/A</span>}
                          </td>

                          {/* Ratings (RSSO) */}
                          {isRSSO && (
                            <>
                              <td className="px-3 py-3"><RatingBadge value={sub?.rating_quantity ?? null} /></td>
                              <td className="px-3 py-3"><RatingBadge value={qualityRating} /></td>
                              <td className="px-3 py-3"><RatingBadge value={timelinessRating} /></td>
                              <td className="px-3 py-3"><RatingBadge value={avgRating} /></td>
                            </>
                          )}

                          {/* Action - Edit only */}
                          <td className="px-3 py-3">
                            <button
                              onClick={() => setEditingAct(act)}
                              className="p-1.5 text-ink-400 hover:text-accent hover:bg-accent-50 rounded transition-colors"
                              title="Edit submission"
                            >
                              <Edit2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            ))
          )}
        </table>
      </div>

      <p className="text-[11px] font-mono text-ink-400/60">
        {displayed.length} activit{displayed.length === 1 ? "y" : "ies"} shown
      </p>

      {editingAct && (
        <SubmissionEditModal
          activity={editingAct}
          submission={subMap.get(editingAct.id)}
          office={office}
          userRole={userRole}
          onClose={() => setEditingAct(null)}
          onSave={(patch) => handleSave(editingAct.id, patch)}
        />
      )}
    </div>
  );
}
