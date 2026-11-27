"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Building2, ChevronDown, ChevronRight, Download, FolderKanban, UserRound } from "lucide-react";
import type {
  FocalPersonRating,
  PortalRole,
  ProjectRating,
  RatingCounts,
  RatingsReport,
} from "@/lib/types";

type View = "office" | "focal" | "project";

// Same colour scale as the ratings on the monitoring page.
function RatingBadge({ value, size = "sm" }: { value: number | null; size?: "sm" | "lg" }) {
  if (value === null) {
    return <span className={size === "lg" ? "text-2xl text-ink-400/40" : "text-xs text-ink-400/40"}>—</span>;
  }
  const color =
    value >= 4.5 ? "bg-emerald-100 text-emerald-700" :
    value >= 3.5 ? "bg-blue-100 text-blue-700" :
    value >= 2.5 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  const sizeCls = size === "lg" ? "px-3 py-1 text-2xl" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded font-mono font-semibold ${sizeCls} ${color}`}>
      {value.toFixed(2)}
    </span>
  );
}

function Counts({ c }: { c: RatingCounts }) {
  return (
    <span className="font-mono text-[11px] text-ink-400 whitespace-nowrap">
      {c.activities_rated} rated
      {c.activities_missing > 0 && <span className="text-red-600"> · {c.activities_missing} missing</span>}
      {c.activities_pending > 0 && <span> · {c.activities_pending} not yet due</span>}
    </span>
  );
}

const thCls = "px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-ink-400 font-medium";
const tdCls = "px-3 py-2.5 text-sm text-ink";

export default function RatingsClient({
  report,
  userRole,
  userOffice,
}: {
  report: RatingsReport;
  userRole: PortalRole | null;
  userOffice: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("office");
  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [openFocal, setOpenFocal] = useState<Record<string, boolean>>({});
  const [openProject, setOpenProject] = useState<Record<string, boolean>>({});

  const offices = report.offices.map((o) => o.office);
  const isPSO = userRole === "PSO";

  const focalPersons = useMemo(
    () =>
      report.focal_persons.filter((p) => officeFilter === "all" || p.office === officeFilter),
    [report.focal_persons, officeFilter]
  );

  const focalByOffice = useMemo(() => {
    const groups: Record<string, FocalPersonRating[]> = {};
    focalPersons.forEach((p) => {
      (groups[p.office] ??= []).push(p);
    });
    return groups;
  }, [focalPersons]);

  function changeYear(year: string) {
    router.push(`/ratings?year=${year}`);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const officeRows = report.offices.map((o) => ({
      Province: o.office,
      "Final rating": o.rating ?? "",
      "Projects rated": o.projects_rated,
      "Projects with activities this year": o.projects_total,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(officeRows), "By Province");

    const matrix = report.projects.map((p) => {
      const row: Record<string, string | number> = { Project: p.pap_name };
      p.offices.forEach((o) => {
        row[o.office] = o.rating ?? "";
      });
      row["All provinces"] = p.rating ?? "";
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrix), "Province x Project");

    const focalRows: Record<string, string | number>[] = [];
    report.focal_persons.forEach((p) => {
      p.projects.forEach((proj) => {
        focalRows.push({
          "Focal person": p.name,
          Province: p.office,
          "Final rating (all projects)": p.rating ?? "",
          Project: proj.pap_name,
          "Project rating": proj.rating ?? "",
          "Activities rated": proj.activities_rated,
          "Activities missing": proj.activities_missing,
          "Activities not yet due": proj.activities_pending,
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(focalRows), "By Focal Person");

    const projectRows: Record<string, string | number>[] = [];
    report.projects.forEach((p) => {
      p.offices.forEach((o) => {
        projectRows.push({
          Project: p.pap_name,
          "Project rating (all provinces)": p.rating ?? "",
          Province: o.office,
          "Province rating": o.rating ?? "",
          "Focal person": o.focal_name ?? "",
          Alternate: o.alternate_name ?? "",
          "Activities rated": o.activities_rated,
          "Activities missing": o.activities_missing,
          "Activities not yet due": o.activities_pending,
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectRows), "By Project");

    XLSX.writeFile(wb, `PAP-Ratings-${report.year}.xlsx`);
  }

  const tabs: { id: View; label: string; icon: typeof Building2 }[] = [
    { id: "office", label: "By Province", icon: Building2 },
    { id: "focal", label: "By Focal Person", icon: UserRound },
    { id: "project", label: "By Project", icon: FolderKanban },
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-surface border border-border rounded-lg p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                  active ? "bg-accent text-white" : "text-ink-400 hover:text-ink hover:bg-ink/[0.03]"
                }`}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-mono text-ink-400">
            Year
            <select
              value={report.year}
              onChange={(e) => changeYear(e.target.value)}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              {report.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border hover:border-emerald-500 hover:text-emerald-700 bg-surface text-ink text-xs font-mono rounded-md transition-colors"
          >
            <Download size={14} className="text-emerald-600" /> Export to Excel
          </button>
        </div>
      </div>

      {/* ── By Province ── */}
      {view === "office" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {report.offices.map((o) => (
              <div key={o.office} className="bg-surface border border-border rounded-xl p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">{o.office}</p>
                <div className="mt-2">
                  <RatingBadge value={o.rating} size="lg" />
                </div>
                <p className="mt-2 font-mono text-[11px] text-ink-400">
                  {o.projects_rated} of {o.projects_total} project{o.projects_total !== 1 ? "s" : ""} rated
                </p>
              </div>
            ))}
          </div>

          {report.projects.length === 0 ? (
            <EmptyState year={report.year} />
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-border bg-ink/[0.02]">
                  <tr>
                    <th className={thCls}>Project</th>
                    {offices.map((o) => (
                      <th key={o} className={`${thCls} text-center`}>
                        {o}
                      </th>
                    ))}
                    {offices.length > 1 && <th className={`${thCls} text-center`}>All provinces</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {report.projects.map((p) => (
                    <tr key={p.pap_id}>
                      <td className={`${tdCls} font-medium`}>{p.pap_name}</td>
                      {p.offices.map((o) => (
                        <td key={o.office} className={`${tdCls} text-center`}>
                          <RatingBadge value={o.rating} />
                        </td>
                      ))}
                      {offices.length > 1 && (
                        <td className={`${tdCls} text-center`}>
                          <RatingBadge value={p.rating} />
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-ink/[0.02]">
                    <td className={`${tdCls} font-mono text-xs uppercase tracking-wider text-ink-400`}>
                      Province final rating
                    </td>
                    {report.offices.map((o) => (
                      <td key={o.office} className={`${tdCls} text-center`}>
                        <RatingBadge value={o.rating} />
                      </td>
                    ))}
                    {offices.length > 1 && <td />}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── By Focal Person ── */}
      {view === "focal" && (
        <div className="space-y-4">
          {offices.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-mono text-ink-400">
              Province
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="all">All provinces</option>
                {offices.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          )}

          {focalPersons.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl bg-surface p-10 text-center">
              <UserRound size={28} className="mx-auto text-ink-400/30 mb-3" />
              <p className="text-sm text-ink">No focal persons assigned yet.</p>
            </div>
          ) : (
            Object.entries(focalByOffice).map(([office, people]) => (
              <div key={office} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-ink/[0.02] font-mono text-[11px] uppercase tracking-wider text-ink-400">
                  {office}
                </div>
                <table className="w-full">
                  <thead className="border-b border-border/60">
                    <tr>
                      <th className={thCls}>Focal person</th>
                      <th className={`${thCls} text-center`}>Projects</th>
                      <th className={`${thCls} text-center`}>Final rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {people.map((person) => {
                      const isOpen = openFocal[person.staff_id] ?? false;
                      return (
                        <Fragment key={person.staff_id}>
                          <tr
                            className="cursor-pointer hover:bg-ink/[0.02]"
                            onClick={() =>
                              setOpenFocal((prev) => ({ ...prev, [person.staff_id]: !isOpen }))
                            }
                          >
                            <td className={`${tdCls} font-medium`}>
                              <span className="inline-flex items-center gap-1.5">
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {person.name}
                              </span>
                            </td>
                            <td className={`${tdCls} text-center font-mono text-xs`}>
                              {person.projects.length}
                            </td>
                            <td className={`${tdCls} text-center`}>
                              <RatingBadge value={person.rating} />
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={3} className="bg-ink/[0.015] px-4 py-3">
                                <table className="w-full">
                                  <thead>
                                    <tr>
                                      <th className={thCls}>Project</th>
                                      <th className={thCls}>Activities</th>
                                      <th className={`${thCls} text-center`}>Rating</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/50">
                                    {person.projects.map((proj) => (
                                      <tr key={`${proj.pap_id}-${proj.office}`}>
                                        <td className={tdCls}>{proj.pap_name}</td>
                                        <td className={tdCls}>
                                          <Counts c={proj} />
                                        </td>
                                        <td className={`${tdCls} text-center`}>
                                          <RatingBadge value={proj.rating} />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── By Project ── */}
      {view === "project" &&
        (report.projects.length === 0 ? (
          <EmptyState year={report.year} />
        ) : (
          <div className="space-y-3">
            {report.projects.map((p: ProjectRating) => {
              const isOpen = openProject[p.pap_id] ?? false;
              return (
                <div key={p.pap_id} className="bg-surface border border-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenProject((prev) => ({ ...prev, [p.pap_id]: !isOpen }))}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink/[0.02]"
                  >
                    <span className="inline-flex items-center gap-2 font-display font-semibold text-sm text-ink">
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {p.pap_name}
                    </span>
                    <span className="flex items-center gap-2">
                      {offices.length > 1 && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                          All provinces
                        </span>
                      )}
                      <RatingBadge value={p.rating} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border overflow-x-auto">
                      <table className="w-full min-w-[640px]">
                        <thead className="bg-ink/[0.02]">
                          <tr>
                            <th className={thCls}>Province</th>
                            <th className={thCls}>Focal person</th>
                            <th className={thCls}>Alternate</th>
                            <th className={thCls}>Activities</th>
                            <th className={`${thCls} text-center`}>Rating</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {p.offices.map((o) => (
                            <tr key={o.office}>
                              <td className={`${tdCls} font-medium`}>{o.office}</td>
                              <td className={tdCls}>
                                {o.focal_name ?? <span className="text-ink-400/60 text-xs">Not assigned</span>}
                              </td>
                              <td className={tdCls}>
                                {o.alternate_name ?? <span className="text-ink-400/60 text-xs">—</span>}
                              </td>
                              <td className={tdCls}>
                                <Counts c={o} />
                              </td>
                              <td className={`${tdCls} text-center`}>
                                <RatingBadge value={o.rating} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}

function EmptyState({ year }: { year: number }) {
  return (
    <div className="border border-dashed border-border rounded-xl bg-surface p-10 text-center">
      <FolderKanban size={28} className="mx-auto text-ink-400/30 mb-3" />
      <p className="text-sm text-ink">No PAPs with activities in {year}.</p>
    </div>
  );
}
