"use client";

import { Fragment } from "react";
import { PSO_OFFICES } from "@/lib/types";
import type { PapActivity, PapSubmission } from "@/lib/types";
import { CheckCircle2, Clock, MinusCircle, CalendarDays } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PROVINCE_SHORT: Record<string, string> = {
  "Davao del Norte": "DDN",
  "Davao del Sur":   "DDS",
  "Davao Oriental":  "DO",
  "Davao de Oro":    "DDO",
  "Davao Occidental":"DOcc",
};

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

interface Props {
  activities: PapActivity[];
  submissions: PapSubmission[];
  onSelectProvince: (office: string) => void;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function StatusChip({
  sub,
  office,
  onSelect,
}: {
  sub: PapSubmission | undefined;
  office: string;
  onSelect: () => void;
}) {
  if (!sub || !sub.actual_submission) {
    return (
      <button
        onClick={onSelect}
        title={`${office} — Not yet submitted`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono
          bg-amber-50 text-amber-600 border border-amber-200/60
          hover:bg-amber-100 transition-colors cursor-pointer"
      >
        <Clock size={10} />
        Pending
      </button>
    );
  }
  return (
    <button
      onClick={onSelect}
      title={`${office} — Submitted ${fmtDate(sub.actual_submission)}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono
        bg-emerald-50 text-emerald-700 border border-emerald-200/60
        hover:bg-emerald-100 transition-colors cursor-pointer"
    >
      <CheckCircle2 size={10} />
      {fmtDate(sub.actual_submission)}
    </button>
  );
}

export default function AllProvincesTab({ activities, submissions, onSelectProvince }: Props) {
  const subMap = new Map<string, PapSubmission>();
  for (const s of submissions) {
    subMap.set(`${s.pap_monitoring_id}__${s.office}`, s);
  }

  if (activities.length === 0) {
    return (
      <div className="py-16 text-center">
        <MinusCircle size={36} className="mx-auto text-ink-400/20 mb-3" />
        <p className="font-mono text-[11px] text-ink-400/50 uppercase tracking-widest">
          No activities defined
        </p>
        <p className="text-xs text-ink-400/40 mt-1">
          Configure activities in PAP Configuration.
        </p>
      </div>
    );
  }

  const hierarchicalGroups = groupActivitiesHierarchical(activities);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-ink/5 border-b border-border">
            <th className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-400 whitespace-nowrap">
              Period
            </th>
            <th className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-400 min-w-[280px]">
              Output / Deliverable
            </th>
            <th className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-ink-400 whitespace-nowrap">
              Deadline
            </th>
            {PSO_OFFICES.map((office) => (
              <th
                key={office}
                className="px-3 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink-400 whitespace-nowrap"
              >
                {PROVINCE_SHORT[office] ?? office}
              </th>
            ))}
          </tr>
        </thead>
        {hierarchicalGroups.map((cat) => (
          <tbody key={cat.key} className="divide-y divide-border/50">
            {/* Level 1 Category Header: Monthly, Quarterly, One-Time */}
            <tr className={`${cat.colorClass} border-t-2 border-border font-display`}>
              <td colSpan={3 + PSO_OFFICES.length} className="px-4 py-2 font-bold text-xs uppercase tracking-wider">
                {cat.title}
              </td>
            </tr>

            {/* Level 2 Sub-groups: Months, Quarters, etc. */}
            {cat.subGroups.map((subGroup) => (
              <Fragment key={subGroup.key}>
                {cat.key !== "one-time" && (
                  <tr className="bg-ink/[0.02] border-t border-border/70">
                    <td colSpan={3 + PSO_OFFICES.length} className="px-4 py-1.5">
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
                  const [y, m, d] = act.deadline.split("-");
                  const periodText = act.activity_type === "monthly"
                    ? getActivityMonth(act)
                    : act.activity_type === "quarterly"
                    ? getActivityQuarter(act)
                    : "";

                  return (
                    <tr key={act.id} className="hover:bg-ink/[0.02] transition-colors">
                      {/* Period */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs text-ink-500 font-mono">
                          {periodText || <span className="text-ink-300">—</span>}
                        </span>
                      </td>

                      {/* Deliverable */}
                      <td className="px-3 py-3 max-w-[280px]">
                        <span className="text-xs text-ink leading-snug line-clamp-2 font-body">
                          {act.output_deliverable}
                        </span>
                      </td>

                      {/* Deadline */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs font-mono text-ink-400">
                          {`${m}/${d}/${y}`}
                        </span>
                      </td>

                      {/* Province status chips */}
                      {PSO_OFFICES.map((office) => {
                        const sub = subMap.get(`${act.id}__${office}`);
                        return (
                          <td key={office} className="px-3 py-3 text-center">
                            <StatusChip
                              sub={sub}
                              office={office}
                              onSelect={() => onSelectProvince(office)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
