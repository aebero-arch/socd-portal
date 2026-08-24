"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Plus, Trash2, AlertCircle, CheckCircle2,
  Settings2, ChevronRight, ChevronDown, Loader2, X, ToggleLeft, ToggleRight,
  Calendar, FileText, Activity, Edit2, CalendarDays, Check,
  FileSpreadsheet, Upload, Download, FileUp, Info,
} from "lucide-react";
import type { PortalRole, ActivityType, PapActivity } from "@/lib/types";
import {
  createPap,
  updatePap,
  deletePap,
  addActivityToPap,
  addActivitiesBulk,
  updateActivity,
  deleteActivity,
} from "./actions";
import type { PapWithDetails, ActivityTemplateItem } from "./actions";

export function downloadActivityTemplate() {
  const headers = [
    "Activity Frequency",
    "Month",
    "Quarter",
    "Output / Deliverable",
    "Deadline",
    "Requires Response Rate",
  ];

  // Blank template: only headers, no pre-filled sample rows
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws["!cols"] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 50 },
    { wch: 18 },
    { wch: 26 },
  ];

  // Make header row bold on Activities Template
  headers.forEach((_, idx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true, sz: 11 },
        alignment: { vertical: "center", horizontal: "left" },
      };
    }
  });

  const instructionHeaders = ["Column / Field", "Required?", "Accepted Values", "Notes / Instructions"];
  const instructionRows = [
    [
      "Activity Frequency",
      "Yes",
      "Monthly, Quarterly, or One-Time",
      "Select cadence for this deliverable",
    ],
    [
      "Month",
      "If Monthly",
      "January, February, March, April, May, June, July, August, September, October, November, December",
      "Specify which month the activity belongs to (e.g. March)",
    ],
    [
      "Quarter",
      "If Quarterly",
      "Q1, Q2, Q3, Q4",
      "Specify which quarter (e.g. Q1 or First Quarter)",
    ],
    [
      "Output / Deliverable",
      "Yes",
      "Text (e.g. Weekly Status Report - 1st Week)",
      "The full description or title of the deliverable",
    ],
    [
      "Deadline",
      "Yes",
      "YYYY-MM-DD (e.g. 2026-03-15) or standard date",
      "Target submission deadline date",
    ],
    [
      "Requires Response Rate",
      "No",
      "Yes or No (or TRUE / FALSE)",
      "Set to 'Yes' if provinces must submit a response rate (%)",
    ],
  ];

  const wsInst = XLSX.utils.aoa_to_sheet([instructionHeaders, ...instructionRows]);
  wsInst["!cols"] = [
    { wch: 26 },
    { wch: 16 },
    { wch: 60 },
    { wch: 48 },
  ];

  // Make header row bold on Instructions sheet
  instructionHeaders.forEach((_, idx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
    if (wsInst[cellRef]) {
      wsInst[cellRef].s = {
        font: { bold: true, sz: 11 },
        alignment: { vertical: "center", horizontal: "left" },
      };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activities Template");
  XLSX.utils.book_append_sheet(wb, wsInst, "Instructions");

  XLSX.writeFile(wb, "PAP_Activities_Import_Template.xlsx");
}

function parseExcelDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    // Excel date serial (days since 1899-12-30)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split("T")[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return str;
}

interface Props {
  initialPaps: PapWithDetails[];
  userRole: PortalRole | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const QUARTERS = [
  { id: "Q1", label: "First Quarter (Q1)" },
  { id: "Q2", label: "Second Quarter (Q2)" },
  { id: "Q3", label: "Third Quarter (Q3)" },
  { id: "Q4", label: "Fourth Quarter (Q4)" },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
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

// ── Activity Row Item in builder ─────────────────────────────────────────────
function BuilderActivityRow({
  index,
  item,
  onChange,
  onRemove,
}: {
  index: number;
  item: ActivityTemplateItem;
  onChange: (field: keyof ActivityTemplateItem, value: any) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border/80 rounded-lg p-3.5 bg-surface space-y-2.5 relative group shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
          Activity #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-400 hover:text-red-500 transition-colors p-1 rounded cursor-pointer"
          title="Remove this output"
        >
          <X size={14} />
        </button>
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
          Output / Deliverable Description <span className="text-warm">*</span>
        </label>
        <textarea
          value={item.output_deliverable}
          onChange={(e) => onChange("output_deliverable", e.target.value)}
          required
          rows={2}
          placeholder="e.g. Submission of Edited data file to RSSO"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none font-body"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
            Deadline <span className="text-warm">*</span>
          </label>
          <div className="relative">
            <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="date"
              value={item.deadline}
              onChange={(e) => onChange("deadline", e.target.value)}
              required
              className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-body"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
            Response Rate
          </label>
          <button
            type="button"
            onClick={() => onChange("response_rate_fillable", !item.response_rate_fillable)}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
              item.response_rate_fillable
                ? "bg-accent-50 border-accent/40 text-accent-600"
                : "bg-surface border-border text-ink-400 hover:border-ink-400/50"
            }`}
          >
            {item.response_rate_fillable ? (
              <><ToggleRight size={15} /> Requires Response Rate</>
            ) : (
              <><ToggleLeft size={15} /> Submission Date Only</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add PAP Modal (with multi-frequency builder) ─────────────────────────────
function AddPapModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (pap: PapWithDetails) => void;
}) {
  const [name, setName] = useState("");
  const [enabledFrequencies, setEnabledFrequencies] = useState<{
    monthly: boolean;
    quarterly: boolean;
    "one-time": boolean;
  }>({
    monthly: true,
    quarterly: false,
    "one-time": false,
  });

  const [activeMonth, setActiveMonth] = useState<string>("January");
  const [activeQuarter, setActiveQuarter] = useState<string>("Q1");

  // Flat list of outputs created in the builder
  const [outputs, setOutputs] = useState<ActivityTemplateItem[]>([
    {
      activity_type: "monthly",
      month: "January",
      quarter: null,
      output_deliverable: "",
      deadline: "",
      response_rate_fillable: false,
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggleFrequency(type: "monthly" | "quarterly" | "one-time") {
    setEnabledFrequencies((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      // If toggled on and no outputs exist for it, create a starter output
      if (next[type] && !outputs.some((o) => o.activity_type === type)) {
        if (type === "monthly") {
          setOutputs((curr) => [
            ...curr,
            {
              activity_type: "monthly",
              month: activeMonth,
              quarter: null,
              output_deliverable: "",
              deadline: "",
              response_rate_fillable: false,
            },
          ]);
        } else if (type === "quarterly") {
          setOutputs((curr) => [
            ...curr,
            {
              activity_type: "quarterly",
              month: null,
              quarter: activeQuarter,
              output_deliverable: "",
              deadline: "",
              response_rate_fillable: false,
            },
          ]);
        } else {
          setOutputs((curr) => [
            ...curr,
            {
              activity_type: "one-time",
              month: null,
              quarter: null,
              output_deliverable: "",
              deadline: "",
              response_rate_fillable: false,
            },
          ]);
        }
      }
      return next;
    });
  }

  function addOutputFor(type: ActivityType, periodValue?: string) {
    const newItem: ActivityTemplateItem = {
      activity_type: type,
      month: type === "monthly" ? periodValue || activeMonth : null,
      quarter: type === "quarterly" ? periodValue || activeQuarter : null,
      output_deliverable: "",
      deadline: "",
      response_rate_fillable: false,
    };
    setOutputs((prev) => [...prev, newItem]);
  }

  function updateOutput(index: number, field: keyof ActivityTemplateItem, value: any) {
    setOutputs((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  function removeOutput(index: number) {
    setOutputs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Filter outputs to only those whose frequency is currently enabled
    const activeOutputs = outputs.filter(
      (o) => enabledFrequencies[o.activity_type]
    );

    if (activeOutputs.length === 0) {
      setError("Please enable at least one frequency and add at least one deliverable.");
      return;
    }

    const incompleteIdx = activeOutputs.findIndex(
      (o) => !o.output_deliverable.trim() || !o.deadline
    );
    if (incompleteIdx >= 0) {
      const inc = activeOutputs[incompleteIdx];
      const periodLabel = inc.month ? ` (${inc.month})` : inc.quarter ? ` (${inc.quarter})` : "";
      setError(`Deliverable #${incompleteIdx + 1}${periodLabel} is missing a description or deadline.`);
      return;
    }

    setLoading(true);
    const res = await createPap({
      name: name.trim(),
      outputs: activeOutputs,
    });
    setLoading(false);

    if (res.success && res.data) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess({
          ...res.data!,
          activities: activeOutputs.map((o, idx) => ({
            id: `temp-${idx}`,
            pap_id: res.data!.id,
            activity_type: o.activity_type,
            quarter: o.quarter || null,
            month: o.month || null,
            output_deliverable: o.output_deliverable,
            deadline: o.deadline,
            response_rate_fillable: o.response_rate_fillable,
            created_at: new Date().toISOString(),
          })),
        });
      }, 700);
    } else {
      setError(res.error || "Failed to create PAP.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl bg-surface border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-ink-50 shrink-0">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              Config // New PAP
            </p>
            <h2 className="font-display font-semibold text-lg text-ink mt-0.5">
              Add Program / Activity / Project
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink p-1 rounded cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* PAP Name */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-700 font-semibold mb-1.5">
              PAP Name <span className="text-warm">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Labor Force Survey (LFS)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-body"
            />
          </div>

          {/* Multiple Activity Frequency Toggles */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-700 font-semibold mb-1.5">
              Activity Frequencies Included <span className="text-warm">*</span>
              <span className="text-ink-400 font-normal ml-1.5 normal-case">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2.5">
              {(["monthly", "quarterly", "one-time"] as const).map((t) => {
                const isSelected = enabledFrequencies[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleFrequency(t)}
                    className={`flex items-center gap-2 py-2 px-4 rounded-lg border text-xs font-mono font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-accent text-white border-accent shadow-sm"
                        : "bg-surface border-border text-ink-400 hover:border-ink-400/50 hover:text-ink"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                      isSelected ? "border-white bg-white/20" : "border-ink-300"
                    }`}>
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                    {t === "one-time" ? "One-Time Activity" : `${t.charAt(0).toUpperCase() + t.slice(1)} Activities`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Monthly Section ─────────────────────────────── */}
          {enabledFrequencies.monthly && (
            <div className="border border-blue-200/80 rounded-xl p-4 bg-blue-50/20 space-y-4">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <h3 className="font-display font-semibold text-sm text-blue-950 uppercase tracking-wide">
                    Monthly Activities
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => addOutputFor("monthly", activeMonth)}
                  className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-mono font-semibold transition-colors cursor-pointer"
                >
                  <Plus size={13} /> Add to {activeMonth}
                </button>
              </div>

              {/* Month Selector Pills */}
              <div className="flex flex-wrap gap-1.5">
                {MONTHS.map((m) => {
                  const count = outputs.filter((o) => o.activity_type === "monthly" && o.month === m).length;
                  const isCurrent = activeMonth === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setActiveMonth(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? "bg-blue-600 text-white font-semibold shadow-sm"
                          : count > 0
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-surface border border-border text-ink-400 hover:text-ink"
                      }`}
                    >
                      {m}
                      {count > 0 && (
                        <span className={`text-[9px] px-1 rounded-full ${
                          isCurrent ? "bg-white/30 text-white" : "bg-blue-200 text-blue-800 font-bold"
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Outputs list for selected activeMonth */}
              <div className="space-y-3 pt-1">
                <p className="font-mono text-[11px] text-blue-900/80 font-semibold flex items-center justify-between">
                  <span>Deliverables for {activeMonth}:</span>
                </p>
                {outputs
                  .map((out, idx) => ({ out, idx }))
                  .filter(({ out }) => out.activity_type === "monthly" && out.month === activeMonth)
                  .map(({ out, idx }, listIdx) => (
                    <BuilderActivityRow
                      key={idx}
                      index={listIdx}
                      item={out}
                      onChange={(f, v) => updateOutput(idx, f, v)}
                      onRemove={() => removeOutput(idx)}
                    />
                  ))}
                {outputs.filter((o) => o.activity_type === "monthly" && o.month === activeMonth).length === 0 && (
                  <div className="text-center py-5 border border-dashed border-blue-200 rounded-lg bg-surface/60">
                    <p className="text-xs text-ink-400 font-mono">No deliverables added for {activeMonth} yet.</p>
                    <button
                      type="button"
                      onClick={() => addOutputFor("monthly", activeMonth)}
                      className="mt-2 text-xs font-mono text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add first deliverable for {activeMonth}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Quarterly Section ─────────────────────────────── */}
          {enabledFrequencies.quarterly && (
            <div className="border border-purple-200/80 rounded-xl p-4 bg-purple-50/20 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <h3 className="font-display font-semibold text-sm text-purple-950 uppercase tracking-wide">
                    Quarterly Activities
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => addOutputFor("quarterly", activeQuarter)}
                  className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-mono font-semibold transition-colors cursor-pointer"
                >
                  <Plus size={13} /> Add to {activeQuarter}
                </button>
              </div>

              {/* Quarter Selector Pills */}
              <div className="flex flex-wrap gap-2">
                {QUARTERS.map((q) => {
                  const count = outputs.filter((o) => o.activity_type === "quarterly" && o.quarter === q.id).length;
                  const isCurrent = activeQuarter === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setActiveQuarter(q.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-pointer flex items-center gap-2 ${
                        isCurrent
                          ? "bg-purple-600 text-white font-semibold shadow-sm"
                          : count > 0
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : "bg-surface border border-border text-ink-400 hover:text-ink"
                      }`}
                    >
                      {q.label}
                      {count > 0 && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                          isCurrent ? "bg-white/30 text-white" : "bg-purple-200 text-purple-800 font-bold"
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Outputs list for selected activeQuarter */}
              <div className="space-y-3 pt-1">
                {outputs
                  .map((out, idx) => ({ out, idx }))
                  .filter(({ out }) => out.activity_type === "quarterly" && out.quarter === activeQuarter)
                  .map(({ out, idx }, listIdx) => (
                    <BuilderActivityRow
                      key={idx}
                      index={listIdx}
                      item={out}
                      onChange={(f, v) => updateOutput(idx, f, v)}
                      onRemove={() => removeOutput(idx)}
                    />
                  ))}
                {outputs.filter((o) => o.activity_type === "quarterly" && o.quarter === activeQuarter).length === 0 && (
                  <div className="text-center py-5 border border-dashed border-purple-200 rounded-lg bg-surface/60">
                    <p className="text-xs text-ink-400 font-mono">No deliverables added for {activeQuarter} yet.</p>
                    <button
                      type="button"
                      onClick={() => addOutputFor("quarterly", activeQuarter)}
                      className="mt-2 text-xs font-mono text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add first deliverable for {activeQuarter}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── One-Time Section ─────────────────────────────── */}
          {enabledFrequencies["one-time"] && (
            <div className="border border-amber-200/80 rounded-xl p-4 bg-amber-50/20 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  <h3 className="font-display font-semibold text-sm text-amber-950 uppercase tracking-wide">
                    One-Time Deliverables
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => addOutputFor("one-time")}
                  className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-mono font-semibold transition-colors cursor-pointer"
                >
                  <Plus size={13} /> Add One-Time Output
                </button>
              </div>

              <div className="space-y-3">
                {outputs
                  .map((out, idx) => ({ out, idx }))
                  .filter(({ out }) => out.activity_type === "one-time")
                  .map(({ out, idx }, listIdx) => (
                    <BuilderActivityRow
                      key={idx}
                      index={listIdx}
                      item={out}
                      onChange={(f, v) => updateOutput(idx, f, v)}
                      onRemove={() => removeOutput(idx)}
                    />
                  ))}
                {outputs.filter((o) => o.activity_type === "one-time").length === 0 && (
                  <div className="text-center py-5 border border-dashed border-amber-200 rounded-lg bg-surface/60">
                    <p className="text-xs text-ink-400 font-mono">No one-time deliverables added yet.</p>
                    <button
                      type="button"
                      onClick={() => addOutputFor("one-time")}
                      className="mt-2 text-xs font-mono text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add first one-time deliverable
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border-l-2 border-red-500 p-3 text-xs text-red-700 rounded">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 bg-accent-50 border-l-2 border-accent p-3 text-xs text-accent-600 rounded">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>PAP created successfully!</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-surface shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-ink-400 hover:text-ink border border-border rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || success}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-mono rounded-md transition-colors cursor-pointer shadow-sm"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Creating…</>
            ) : success ? (
              <><CheckCircle2 size={14} /> Done!</>
            ) : (
              <><Plus size={14} /> Create PAP</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Activity to existing PAP Modal ───────────────────────────────────────
function AddActivityToPapModal({
  pap,
  onClose,
  onSuccess,
}: {
  pap: PapWithDetails;
  onClose: () => void;
  onSuccess: (newAct: PapActivity) => void;
}) {
  const [activityType, setActivityType] = useState<ActivityType>("monthly");
  const [month, setMonth] = useState<string>("January");
  const [quarter, setQuarter] = useState<string>("Q1");
  const [deliverable, setDeliverable] = useState("");
  const [deadline, setDeadline] = useState("");
  const [responseRateFillable, setResponseRateFillable] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await addActivityToPap({
      pap_id: pap.id,
      activity_type: activityType,
      month: activityType === "monthly" ? month : null,
      quarter: activityType === "quarterly" ? quarter : null,
      output_deliverable: deliverable.trim(),
      deadline,
      response_rate_fillable: responseRateFillable,
    });
    setLoading(false);

    if (res.success && res.data) {
      setSuccess(true);
      setTimeout(() => onSuccess(res.data!), 600);
    } else {
      setError(res.error || "Failed to add activity.");
    }
  }

  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-body";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border shadow-2xl rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-ink-50">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              {pap.name}
            </p>
            <h2 className="font-display font-semibold text-base text-ink mt-0.5">
              Add Activity / Deliverable
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink p-1 rounded cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          {/* Frequency picker */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
              Activity Frequency <span className="text-warm">*</span>
            </label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as ActivityType)}
              className={inputCls}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="one-time">One-Time</option>
            </select>
          </div>

          {/* Month or Quarter */}
          {activityType === "monthly" && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
                Month <span className="text-warm">*</span>
              </label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {activityType === "quarterly" && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
                Quarter <span className="text-warm">*</span>
              </label>
              <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className={inputCls}>
                {QUARTERS.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
              </select>
            </div>
          )}

          {/* Deliverable text */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
              Output / Deliverable <span className="text-warm">*</span>
            </label>
            <textarea
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              required
              rows={3}
              placeholder="e.g. 1st Week Status Report (10:00am)"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
              Deadline <span className="text-warm">*</span>
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          {/* Response Rate Toggle */}
          <div className="border border-border rounded-md p-3.5 bg-accent-50/20">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={responseRateFillable}
                onChange={(e) => setResponseRateFillable(e.target.checked)}
                className="mt-0.5 accent-accent w-4 h-4 cursor-pointer"
              />
              <div>
                <p className="text-xs font-semibold text-ink">Enable Response Rate Field</p>
                <p className="text-[11px] text-ink-400 mt-0.5">Check if provinces are required to submit response rate (%) for this activity.</p>
              </div>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border-l-2 border-red-500 p-3 text-xs text-red-700 rounded">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 bg-accent-50 border-l-2 border-accent p-3 text-xs text-accent-600 rounded">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>Activity added successfully!</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-mono text-ink-400 hover:text-ink border border-border rounded-md">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-mono rounded-md shadow-sm"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Plus size={14} /> Add Activity</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Activity Modal ──────────────────────────────────────────────────────
function EditActivityModal({
  activity,
  onClose,
  onSuccess,
}: {
  activity: PapActivity;
  onClose: () => void;
  onSuccess: (updated: PapActivity) => void;
}) {
  const [activityType, setActivityType] = useState<ActivityType>(activity.activity_type);
  const [month, setMonth] = useState<string>(activity.month || "January");
  const [quarter, setQuarter] = useState<string>(activity.quarter || "Q1");
  const [deliverable, setDeliverable] = useState(activity.output_deliverable);
  const [deadline, setDeadline] = useState(activity.deadline);
  const [responseRateFillable, setResponseRateFillable] = useState(activity.response_rate_fillable);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await updateActivity(activity.id, {
      activity_type: activityType,
      month: activityType === "monthly" ? month : null,
      quarter: activityType === "quarterly" ? quarter : null,
      output_deliverable: deliverable.trim(),
      deadline,
      response_rate_fillable: responseRateFillable,
    });
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess({
          ...activity,
          activity_type: activityType,
          month: activityType === "monthly" ? month : null,
          quarter: activityType === "quarterly" ? quarter : null,
          output_deliverable: deliverable.trim(),
          deadline,
          response_rate_fillable: responseRateFillable,
        });
      }, 500);
    } else {
      setError(res.error || "Failed to update activity.");
    }
  }

  const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-body";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border shadow-2xl rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-ink-50">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              Edit Deliverable
            </p>
            <h2 className="font-display font-semibold text-base text-ink mt-0.5">
              Activity Configuration
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink p-1 rounded cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
              Activity Frequency
            </label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as ActivityType)}
              className={inputCls}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="one-time">One-Time</option>
            </select>
          </div>

          {activityType === "monthly" && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
                Month
              </label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {activityType === "quarterly" && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
                Quarter
              </label>
              <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className={inputCls}>
                {QUARTERS.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
              Output / Deliverable <span className="text-warm">*</span>
            </label>
            <textarea
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              required
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-700 mb-1">
              Deadline <span className="text-warm">*</span>
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="border border-border rounded-md p-3.5 bg-accent-50/20">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={responseRateFillable}
                onChange={(e) => setResponseRateFillable(e.target.checked)}
                className="mt-0.5 accent-accent w-4 h-4 cursor-pointer"
              />
              <div>
                <p className="text-xs font-semibold text-ink">Enable Response Rate Field</p>
                <p className="text-[11px] text-ink-400 mt-0.5">Check if provinces are required to submit response rate (%) for this activity.</p>
              </div>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border-l-2 border-red-500 p-3 text-xs text-red-700 rounded">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 bg-accent-50 border-l-2 border-accent p-3 text-xs text-accent-600 rounded">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>Saved changes!</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-mono text-ink-400 hover:text-ink border border-border rounded-md">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-mono rounded-md shadow-sm"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rename PAP Modal ────────────────────────────────────────────────────────
function EditPapModal({
  pap,
  onClose,
  onSuccess,
}: {
  pap: PapWithDetails;
  onClose: () => void;
  onSuccess: (newName: string) => void;
}) {
  const [name, setName] = useState(pap.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const res = await updatePap(pap.id, name.trim());
    setLoading(false);
    if (res.success) {
      onSuccess(name.trim());
    } else {
      setError(res.error || "Failed to update PAP name.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-surface border border-border shadow-2xl rounded-xl p-6">
        <h3 className="font-display font-semibold text-base text-ink mb-4">Rename PAP</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-1">
              PAP Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-ink-400 border border-border rounded-md">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-accent text-white text-xs font-mono rounded-md hover:bg-accent-600"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Import Activities Modal ──────────────────────────────────────────────────
interface ParsedActivityItem {
  activity_type: ActivityType;
  quarter: string | null;
  month: string | null;
  output_deliverable: string;
  deadline: string;
  response_rate_fillable: boolean;
  isValid: boolean;
  errors: string[];
}

function ImportActivitiesModal({
  pap,
  onClose,
  onSuccess,
}: {
  pap: PapWithDetails;
  onClose: () => void;
  onSuccess: (newActivities: PapActivity[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array" });
        const sheetName = wb.SheetNames.find((s) => s.toLowerCase().includes("activit")) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        if (!ws) throw new Error("No readable worksheet found in the Excel file.");

        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rawRows.length === 0) {
          throw new Error("The worksheet appears to be empty. Please fill in the template with activities.");
        }

        const items: ParsedActivityItem[] = rawRows.map((row) => {
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              const foundKey = Object.keys(row).find(
                (rk) => rk.trim().toLowerCase() === k.toLowerCase()
              );
              if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== "") {
                return row[foundKey];
              }
            }
            return "";
          };

          const rawFreq = String(getVal(["Activity Frequency", "Frequency", "Type", "Activity Type"])).trim().toLowerCase();
          const rawMonth = String(getVal(["Month", "Month Name", "Period Month"])).trim();
          const rawQuarter = String(getVal(["Quarter", "Quarter Name", "Period Quarter"])).trim();
          const rawOutput = String(getVal(["Output / Deliverable", "Output/Deliverable", "Deliverable", "Output", "Activity", "Activity Name", "Title"])).trim();
          const rawDeadline = getVal(["Deadline", "Deadline Date", "Due Date", "Due"]);
          const rawResp = String(getVal(["Requires Response Rate", "Response Rate", "Response Rate Required", "Response Rate (Yes/No)", "Response Rate (%)"])).trim().toLowerCase();

          const parsedDeadline = parseExcelDate(rawDeadline);
          const isRespRequired = ["yes", "true", "1", "y"].includes(rawResp);

          let activityType: ActivityType = "monthly";
          let month: string | null = null;
          let quarter: string | null = null;

          if (rawFreq.includes("quarter") || (!rawFreq && rawQuarter)) {
            activityType = "quarterly";
            const qUpper = rawQuarter.toUpperCase();
            if (qUpper.includes("1") || qUpper === "Q1") quarter = "Q1";
            else if (qUpper.includes("2") || qUpper === "Q2") quarter = "Q2";
            else if (qUpper.includes("3") || qUpper === "Q3") quarter = "Q3";
            else if (qUpper.includes("4") || qUpper === "Q4") quarter = "Q4";
            else quarter = rawQuarter || "Q1";
          } else if (rawFreq.includes("one") || rawFreq.includes("time") || (!rawFreq && !rawMonth && !rawQuarter)) {
            activityType = "one-time";
          } else {
            activityType = "monthly";
            const matchedMonth = MONTHS.find((m) => m.toLowerCase() === rawMonth.toLowerCase());
            month = matchedMonth || rawMonth || (parsedDeadline && parsedDeadline.includes("-") ? MONTHS[parseInt(parsedDeadline.split("-")[1], 10) - 1] : "January");
          }

          const errs: string[] = [];
          if (!rawOutput) errs.push("Missing deliverable");
          if (!parsedDeadline || !/^\d{4}-\d{2}-\d{2}$/.test(parsedDeadline)) errs.push("Invalid deadline");

          return {
            activity_type: activityType,
            quarter,
            month,
            output_deliverable: rawOutput,
            deadline: parsedDeadline,
            response_rate_fillable: isRespRequired,
            isValid: errs.length === 0,
            errors: errs,
          };
        });

        const validRows = items.filter((it) => it.output_deliverable || it.deadline);
        if (validRows.length === 0) {
          throw new Error("No valid activity rows found in the file.");
        }
        setParsedItems(validRows);
      } catch (err: any) {
        setError(err.message || "Failed to parse Excel file.");
        setParsedItems([]);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsArrayBuffer(selected);
  }

  async function handleImport() {
    const validActivities = parsedItems.filter((it) => it.isValid);
    if (validActivities.length === 0) {
      setError("Please fix errors in the file before importing.");
      return;
    }

    setLoading(true);
    setError(null);
    const res = await addActivitiesBulk(
      pap.id,
      validActivities.map((a) => ({
        activity_type: a.activity_type,
        quarter: a.quarter,
        month: a.month,
        output_deliverable: a.output_deliverable,
        deadline: a.deadline,
        response_rate_fillable: a.response_rate_fillable,
      }))
    );
    setLoading(false);

    if (res.success && res.data) {
      setSuccessCount(res.count ?? validActivities.length);
      setTimeout(() => {
        onSuccess(res.data!);
      }, 700);
    } else {
      setError(res.error || "Failed to import activities.");
    }
  }

  const validCount = parsedItems.filter((i) => i.isValid).length;
  const invalidCount = parsedItems.filter((i) => !i.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-surface border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-ink-50 shrink-0">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              Bulk Import // {pap.name}
            </p>
            <h2 className="font-display font-semibold text-base text-ink mt-0.5">
              Import Activities from Excel (.xlsx)
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink p-1 rounded cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Instructions banner */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-900">
            <div className="flex items-start gap-2.5">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-950">Upload Excel Spreadsheet (.xlsx, .csv)</p>
                <p className="text-blue-800/80 mt-0.5 leading-relaxed">
                  The spreadsheet should include Activity Frequency, Month (if monthly), Quarter (if quarterly), Output/Deliverable description, Deadline, and Response Rate Required.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadActivityTemplate}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 hover:border-blue-500 text-blue-900 text-[11px] font-mono font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
            >
              <Download size={12} className="text-blue-600" />
              <span>Get Template</span>
            </button>
          </div>

          {/* File Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file ? "border-accent bg-accent-50/10" : "border-border hover:border-accent/60 hover:bg-ink/[0.01]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileSpreadsheet size={32} className={`mx-auto mb-2 ${file ? "text-accent" : "text-ink-400/40"}`} />
            {file ? (
              <div>
                <p className="text-xs font-mono font-semibold text-ink">{file.name}</p>
                <p className="text-[10px] font-mono text-ink-400 mt-1">
                  {(file.size / 1024).toFixed(1)} KB • Click to choose a different file
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-ink">Click to select an Excel spreadsheet (.xlsx, .csv)</p>
                <p className="text-[11px] text-ink-400 mt-1">Or drag and drop your file here</p>
              </div>
            )}
          </div>

          {parsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs font-mono text-ink-400">
              <Loader2 size={14} className="animate-spin text-accent" />
              <span>Parsing spreadsheet...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border-l-2 border-red-500 p-3 text-xs text-red-700 rounded">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="flex items-start gap-2 bg-emerald-50 border-l-2 border-emerald-500 p-3 text-xs text-emerald-800 rounded">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>Successfully imported {successCount} activities!</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-ink">
                  Preview ({parsedItems.length} activities found)
                </span>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    {validCount} ready
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold border border-red-200">
                      {invalidCount} invalid
                    </span>
                  )}
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border/60 bg-surface text-xs">
                {parsedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 flex items-start justify-between gap-3 ${
                      !item.isValid ? "bg-red-50/40" : "hover:bg-ink/[0.01]"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold ${
                          item.activity_type === "monthly" ? "bg-blue-100 text-blue-800" :
                          item.activity_type === "quarterly" ? "bg-purple-100 text-purple-800" :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {item.activity_type}
                        </span>
                        {(item.month || item.quarter) && (
                          <span className="text-[10px] font-mono text-ink-500 font-medium">
                            {item.activity_type === "monthly" ? item.month : item.quarter}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-ink-400">
                          Due: {fmtDate(item.deadline)}
                        </span>
                        {item.response_rate_fillable && (
                          <span className="text-[9px] font-mono text-accent-600 bg-accent-50 px-1 py-0.2 rounded border border-accent/20">
                            Rate Required
                          </span>
                        )}
                      </div>
                      <p className="text-ink font-medium mt-1 leading-snug">{item.output_deliverable || "<Missing Output Name>"}</p>
                      {item.errors.length > 0 && (
                        <p className="text-[10px] text-red-600 font-mono mt-0.5">
                          ⚠️ {item.errors.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-surface shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-ink-400 hover:text-ink border border-border rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={loading || parsedItems.length === 0 || validCount === 0 || successCount !== null}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-mono rounded-md shadow-sm transition-colors cursor-pointer"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Importing…</>
            ) : successCount !== null ? (
              <><CheckCircle2 size={14} /> Imported!</>
            ) : (
              <><Upload size={14} /> Import {validCount > 0 ? `${validCount} Activities` : ""}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main PAP Configuration Client ───────────────────────────────────────────
export default function PapConfigClient({ initialPaps, userRole }: Props) {
  const [paps, setPaps] = useState<PapWithDetails[]>(initialPaps);
  const [showAddPapModal, setShowAddPapModal] = useState(false);
  const [addActivityPap, setAddActivityPap] = useState<PapWithDetails | null>(null);
  const [importPap, setImportPap] = useState<PapWithDetails | null>(null);
  const [editingActivity, setEditingActivity] = useState<PapActivity | null>(null);
  const [editingPap, setEditingPap] = useState<PapWithDetails | null>(null);
  const [expandedPaps, setExpandedPaps] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    initialPaps.forEach((p) => { initial[p.id] = true; });
    return initial;
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    setExpandedPaps((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSection(sectionKey: string) {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: prev[sectionKey] === undefined ? false : !prev[sectionKey],
    }));
  }

  function isSectionOpen(sectionKey: string) {
    return expandedSections[sectionKey] !== false; // open by default
  }

  async function handleDeletePap(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its deliverables? This cannot be undone.`)) return;
    setDeletingId(id);
    setDeleteError(null);
    const res = await deletePap(id);
    setDeletingId(null);
    if (res.success) {
      setPaps((prev) => prev.filter((p) => p.id !== id));
    } else {
      setDeleteError(res.error || "Failed to delete PAP.");
    }
  }

  async function handleDeleteActivity(actId: string, papId: string) {
    if (!confirm("Delete this activity? All submissions will also be deleted.")) return;
    const res = await deleteActivity(actId);
    if (res.success) {
      setPaps((prev) =>
        prev.map((p) =>
          p.id === papId
            ? { ...p, activities: p.activities.filter((a) => a.id !== actId) }
            : p
        )
      );
    } else {
      alert(res.error || "Failed to delete activity.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-400">
          <span className="font-mono text-ink font-semibold">{paps.length}</span>{" "}
          PAP{paps.length !== 1 ? "s" : ""} configured
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadActivityTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-border hover:border-emerald-500 hover:text-emerald-700 bg-surface text-ink text-xs font-mono rounded-md transition-colors cursor-pointer shadow-2xs"
            title="Download Excel (.xlsx) template for bulk activity import"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>Download XLSX Template</span>
          </button>
          <button
            onClick={() => setShowAddPapModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-600 text-white text-sm font-mono rounded-md transition-colors cursor-pointer shadow-sm"
          >
            <Plus size={15} />
            Add PAP
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* PAP List */}
      {paps.length === 0 ? (
        <div className="tick-corners border border-border rounded-xl bg-surface p-16 text-center">
          <Settings2 size={36} className="mx-auto text-ink-400/30 mb-4" />
          <h3 className="font-display font-semibold text-base text-ink">No PAPs configured yet</h3>
          <p className="text-sm text-ink-400 mt-1 max-w-sm mx-auto">
            Create your first PAP to define its output deliverables and schedule.
          </p>
          <button
            onClick={() => setShowAddPapModal(true)}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-600 text-white text-sm font-mono rounded-md transition-colors cursor-pointer"
          >
            <Plus size={14} /> Add First PAP
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paps.map((pap) => {
            const isExpanded = expandedPaps[pap.id] ?? true;
            const monthlyCount = pap.activities.filter((a) => a.activity_type === "monthly").length;
            const quarterlyCount = pap.activities.filter((a) => a.activity_type === "quarterly").length;
            const oneTimeCount = pap.activities.filter((a) => a.activity_type === "one-time").length;

            const isMonthlyOpen = isSectionOpen(`${pap.id}__monthly`);
            const isQuarterlyOpen = isSectionOpen(`${pap.id}__quarterly`);
            const isOneTimeOpen = isSectionOpen(`${pap.id}__onetime`);

            return (
              <div
                key={pap.id}
                className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* PAP Card Header */}
                <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 bg-surface border-b border-border/60">
                  <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                    <button
                      type="button"
                      onClick={() => toggleExpand(pap.id)}
                      className="p-1 rounded text-ink-400 hover:text-ink transition-colors cursor-pointer"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold text-base text-ink">
                          {pap.name}
                        </h3>
                        <button
                          onClick={() => setEditingPap(pap)}
                          className="p-1 text-ink-400/60 hover:text-ink transition-colors"
                          title="Rename PAP"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {monthlyCount > 0 && (
                          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                            Monthly ({monthlyCount})
                          </span>
                        )}
                        {quarterlyCount > 0 && (
                          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60">
                            Quarterly ({quarterlyCount})
                          </span>
                        )}
                        {oneTimeCount > 0 && (
                          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/60">
                            One-Time ({oneTimeCount})
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-ink-400 ml-1">
                          • {pap.activities.length} total deliverable{pap.activities.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setImportPap(pap)}
                      className="flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300/80 hover:bg-emerald-100/80 px-3 py-1.5 rounded-md transition-all cursor-pointer shadow-2xs"
                      title={`Import activities from Excel (.xlsx) into ${pap.name}`}
                    >
                      <Upload size={13} className="text-emerald-600" /> Import
                    </button>
                    <button
                      onClick={() => setAddActivityPap(pap)}
                      className="flex items-center gap-1.5 text-xs font-mono font-semibold text-accent bg-accent-50 border border-accent/30 hover:bg-accent-100 px-3 py-1.5 rounded-md transition-all cursor-pointer"
                    >
                      <Plus size={13} /> Add Activity
                    </button>
                    <a
                      href={`/monitoring/${pap.id}`}
                      className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink font-mono border border-border px-3 py-1.5 rounded-md transition-all"
                    >
                      Monitoring <ChevronRight size={12} />
                    </a>
                    <button
                      onClick={() => handleDeletePap(pap.id, pap.name)}
                      disabled={deletingId === pap.id}
                      className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                      title="Delete PAP"
                    >
                      {deletingId === pap.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>

                {/* PAP Expanded Activities Content */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-4 bg-ink/[0.01]">
                    {pap.activities.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-border rounded-lg bg-surface">
                        <p className="text-xs font-mono text-ink-400">No activities configured for this PAP yet.</p>
                        <button
                          onClick={() => setAddActivityPap(pap)}
                          className="mt-2 text-xs font-mono text-accent hover:underline inline-flex items-center gap-1"
                        >
                          <Plus size={13} /> Add first activity
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 1. Monthly Collapsible Section */}
                        {monthlyCount > 0 && (
                          <div className="border border-blue-200/80 rounded-xl overflow-hidden bg-surface shadow-2xs">
                            {/* Collapsible Header */}
                            <button
                              type="button"
                              onClick={() => toggleSection(`${pap.id}__monthly`)}
                              className="w-full px-4 py-3 bg-blue-50/70 hover:bg-blue-100/50 border-b border-blue-200/70 flex items-center justify-between transition-colors cursor-pointer text-left"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="p-1 rounded bg-blue-600 text-white">
                                  <CalendarDays size={13} />
                                </div>
                                <span className="font-display font-semibold text-xs text-blue-950 uppercase tracking-wider">
                                  Monthly Deliverables
                                </span>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-blue-200/70 text-blue-900 font-bold">
                                  {monthlyCount} {monthlyCount === 1 ? "activity" : "activities"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-blue-700 text-xs font-mono font-medium">
                                <span>{isMonthlyOpen ? "Hide" : "Show"}</span>
                                {isMonthlyOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </div>
                            </button>

                            {/* Monthly Items List */}
                            {isMonthlyOpen && (
                              <div className="divide-y divide-border/60">
                                {[
                                  ...MONTHS.filter((m) =>
                                    pap.activities.some((a) => (a.activity_type || "").toLowerCase() === "monthly" && getActivityMonth(a) === m)
                                  ),
                                  ...Array.from(
                                    new Set(
                                      pap.activities
                                        .filter((a) => (a.activity_type || "").toLowerCase() === "monthly")
                                        .map((a) => getActivityMonth(a))
                                        .filter((m) => !MONTHS.includes(m))
                                    )
                                  ),
                                ].map((m) => {
                                  const monthActs = pap.activities.filter(
                                    (a) => (a.activity_type || "").toLowerCase() === "monthly" && getActivityMonth(a) === m
                                  );
                                  return (
                                    <div key={m} className="p-3.5 bg-surface">
                                      <p className="font-mono text-xs font-bold text-blue-900 mb-2.5 flex items-center gap-1.5">
                                        <CalendarDays size={13} className="text-blue-600" />
                                        {m}
                                      </p>
                                      <div className="space-y-2 pl-3 border-l-2 border-blue-200">
                                        {monthActs.map((act) => (
                                          <div
                                            key={act.id}
                                            className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 px-3 bg-background border border-border/70 rounded-lg hover:border-accent/40 transition-all"
                                          >
                                            <div className="flex-1 min-w-[200px]">
                                              <p className="font-medium text-ink leading-snug">{act.output_deliverable}</p>
                                              <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-ink-400">
                                                <span>Deadline: <strong className="text-ink">{fmtDate(act.deadline)}</strong></span>
                                                {act.response_rate_fillable && (
                                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent-50 text-accent-600 border border-accent/20 font-semibold">
                                                    Response Rate Required
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                onClick={() => setEditingActivity(act)}
                                                className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded bg-surface border border-border hover:border-accent hover:text-accent transition-colors shadow-2xs cursor-pointer"
                                                title="Edit deliverable, deadline, or period"
                                              >
                                                <Edit2 size={12} className="text-accent" />
                                                <span>Edit</span>
                                              </button>
                                              <button
                                                onClick={() => handleDeleteActivity(act.id, pap.id)}
                                                className="p-1 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                title="Delete activity"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. Quarterly Collapsible Section */}
                        {quarterlyCount > 0 && (
                          <div className="border border-purple-200/80 rounded-xl overflow-hidden bg-surface shadow-2xs">
                            {/* Collapsible Header */}
                            <button
                              type="button"
                              onClick={() => toggleSection(`${pap.id}__quarterly`)}
                              className="w-full px-4 py-3 bg-purple-50/70 hover:bg-purple-100/50 border-b border-purple-200/70 flex items-center justify-between transition-colors cursor-pointer text-left"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="p-1 rounded bg-purple-600 text-white">
                                  <CalendarDays size={13} />
                                </div>
                                <span className="font-display font-semibold text-xs text-purple-950 uppercase tracking-wider">
                                  Quarterly Deliverables
                                </span>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-purple-200/70 text-purple-900 font-bold">
                                  {quarterlyCount} {quarterlyCount === 1 ? "activity" : "activities"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-purple-700 text-xs font-mono font-medium">
                                <span>{isQuarterlyOpen ? "Hide" : "Show"}</span>
                                {isQuarterlyOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </div>
                            </button>

                            {/* Quarterly Items List */}
                            {isQuarterlyOpen && (
                              <div className="divide-y divide-border/60">
                                {[
                                  ...["Q1", "Q2", "Q3", "Q4"].filter((q) =>
                                    pap.activities.some((a) => (a.activity_type || "").toLowerCase() === "quarterly" && getActivityQuarter(a) === q)
                                  ),
                                  ...Array.from(
                                    new Set(
                                      pap.activities
                                        .filter((a) => (a.activity_type || "").toLowerCase() === "quarterly")
                                        .map((a) => getActivityQuarter(a))
                                        .filter((q) => !["Q1", "Q2", "Q3", "Q4"].includes(q))
                                    )
                                  ),
                                ].map((q) => {
                                  const qObj = QUARTERS.find((item) => item.id === q);
                                  const qLabel = qObj ? qObj.label : q;
                                  const qActs = pap.activities.filter(
                                    (a) => (a.activity_type || "").toLowerCase() === "quarterly" && getActivityQuarter(a) === q
                                  );
                                  return (
                                    <div key={q} className="p-3.5 bg-surface">
                                      <p className="font-mono text-xs font-bold text-purple-900 mb-2.5 flex items-center gap-1.5">
                                        <CalendarDays size={13} className="text-purple-600" />
                                        {qLabel}
                                      </p>
                                      <div className="space-y-2 pl-3 border-l-2 border-purple-200">
                                        {qActs.map((act) => (
                                          <div
                                            key={act.id}
                                            className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 px-3 bg-background border border-border/70 rounded-lg hover:border-accent/40 transition-all"
                                          >
                                            <div className="flex-1 min-w-[200px]">
                                              <p className="font-medium text-ink leading-snug">{act.output_deliverable}</p>
                                              <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-ink-400">
                                                <span>Deadline: <strong className="text-ink">{fmtDate(act.deadline)}</strong></span>
                                                {act.response_rate_fillable && (
                                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent-50 text-accent-600 border border-accent/20 font-semibold">
                                                    Response Rate Required
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                onClick={() => setEditingActivity(act)}
                                                className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded bg-surface border border-border hover:border-accent hover:text-accent transition-colors shadow-2xs cursor-pointer"
                                                title="Edit deliverable, deadline, or period"
                                              >
                                                <Edit2 size={12} className="text-accent" />
                                                <span>Edit</span>
                                              </button>
                                              <button
                                                onClick={() => handleDeleteActivity(act.id, pap.id)}
                                                className="p-1 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                title="Delete activity"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. One-Time Collapsible Section */}
                        {oneTimeCount > 0 && (
                          <div className="border border-amber-200/80 rounded-xl overflow-hidden bg-surface shadow-2xs">
                            {/* Collapsible Header */}
                            <button
                              type="button"
                              onClick={() => toggleSection(`${pap.id}__onetime`)}
                              className="w-full px-4 py-3 bg-amber-50/70 hover:bg-amber-100/50 border-b border-amber-200/70 flex items-center justify-between transition-colors cursor-pointer text-left"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="p-1 rounded bg-amber-600 text-white">
                                  <CalendarDays size={13} />
                                </div>
                                <span className="font-display font-semibold text-xs text-amber-950 uppercase tracking-wider">
                                  One-Time Deliverables
                                </span>
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 font-bold">
                                  {oneTimeCount} {oneTimeCount === 1 ? "activity" : "activities"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-amber-700 text-xs font-mono font-medium">
                                <span>{isOneTimeOpen ? "Hide" : "Show"}</span>
                                {isOneTimeOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </div>
                            </button>

                            {/* One-time Items List */}
                            {isOneTimeOpen && (
                              <div className="p-3.5 space-y-2 bg-surface">
                                {pap.activities
                                  .filter((a) => a.activity_type === "one-time")
                                  .map((act) => (
                                    <div
                                      key={act.id}
                                      className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 px-3 bg-background border border-border/70 rounded-lg hover:border-accent/40 transition-all"
                                    >
                                      <div className="flex-1 min-w-[200px]">
                                        <p className="font-medium text-ink leading-snug">{act.output_deliverable}</p>
                                        <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-ink-400">
                                          <span>Deadline: <strong className="text-ink">{fmtDate(act.deadline)}</strong></span>
                                          {act.response_rate_fillable && (
                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent-50 text-accent-600 border border-accent/20 font-semibold">
                                              Response Rate Required
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => setEditingActivity(act)}
                                          className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded bg-surface border border-border hover:border-accent hover:text-accent transition-colors shadow-2xs cursor-pointer"
                                          title="Edit deliverable, deadline, or period"
                                        >
                                          <Edit2 size={12} className="text-accent" />
                                          <span>Edit</span>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteActivity(act.id, pap.id)}
                                          className="p-1 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                          title="Delete activity"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add PAP Modal */}
      {showAddPapModal && (
        <AddPapModal
          onClose={() => setShowAddPapModal(false)}
          onSuccess={(newPap) => {
            setPaps((prev) => [newPap, ...prev]);
            setShowAddPapModal(false);
          }}
        />
      )}

      {/* Add Activity to Existing PAP Modal */}
      {addActivityPap && (
        <AddActivityToPapModal
          pap={addActivityPap}
          onClose={() => setAddActivityPap(null)}
          onSuccess={(newAct) => {
            setPaps((prev) =>
              prev.map((p) =>
                p.id === addActivityPap.id
                  ? { ...p, activities: [...p.activities, newAct] }
                  : p
              )
            );
            setAddActivityPap(null);
          }}
        />
      )}

      {/* Edit Activity Modal */}
      {editingActivity && (
        <EditActivityModal
          activity={editingActivity}
          onClose={() => setEditingActivity(null)}
          onSuccess={(updated) => {
            setPaps((prev) =>
              prev.map((p) => ({
                ...p,
                activities: p.activities.map((a) => (a.id === updated.id ? updated : a)),
              }))
            );
            setEditingActivity(null);
          }}
        />
      )}

      {/* Rename PAP Modal */}
      {editingPap && (
        <EditPapModal
          pap={editingPap}
          onClose={() => setEditingPap(null)}
          onSuccess={(newName) => {
            setPaps((prev) =>
              prev.map((p) => (p.id === editingPap.id ? { ...p, name: newName } : p))
            );
            setEditingPap(null);
          }}
        />
      )}

      {/* Import Activities from Excel Modal */}
      {importPap && (
        <ImportActivitiesModal
          pap={importPap}
          onClose={() => setImportPap(null)}
          onSuccess={(freshActivities) => {
            setPaps((prev) =>
              prev.map((p) =>
                p.id === importPap.id
                  ? { ...p, activities: freshActivities }
                  : p
              )
            );
            setImportPap(null);
          }}
        />
      )}
    </div>
  );
}
