"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Edit2,
  ExternalLink,
  GraduationCap,
  MapPin,
  Monitor,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import type { PortalRole } from "@/lib/types";
import { Dialog, DialogActions, FormError, type EditDialog } from "@/components/dialog";
import { useSaveStatus } from "@/lib/form-status";
import type { Training, TrainingMode } from "./page";
import {
  deleteTraining,
  saveTraining,
  setTrainingAttendance,
  signUpForTraining,
  withdrawFromTraining,
  type TrainingActionResult,
} from "./actions";

interface TrainingsClientProps {
  trainings: Training[];
  currentUser: { id: string; portal_role: PortalRole | null } | null;
  today: string; // YYYY-MM-DD
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MODE_LABELS: Record<TrainingMode, string> = {
  "in-person": "In person",
  online: "Online",
  hybrid: "Hybrid",
};

const MODE_STYLES: Record<TrainingMode, string> = {
  "in-person": "bg-accent-50 text-accent-600 border-accent/20",
  online: "bg-sky-50 text-sky-700 border-sky-200/50",
  hybrid: "bg-warm-50 text-amber-800 border-warm/30",
};

// Dates arrive as YYYY-MM-DD; they are formatted by hand so the server
// and the browser always show the same text.
function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

function formatDate(iso: string) {
  const { y, m, d } = parts(iso);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function formatRange(start: string, end: string | null) {
  if (!end || end.slice(0, 10) === start.slice(0, 10)) return formatDate(start);
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m) return `${MONTHS[a.m - 1]} ${a.d}–${b.d}, ${a.y}`;
  if (a.y === b.y) return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${a.y}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function lastDay(t: Training) {
  return (t.end_date ?? t.training_date).slice(0, 10);
}

const inputClass =
  "w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all";
const labelClass = "block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5";

export default function TrainingsClient({ trainings, currentUser, today }: TrainingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<EditDialog<Training>>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [openAttendance, setOpenAttendance] = useState<string | null>(null);

  const canManage = currentUser?.portal_role === "SuperAdmin" || currentUser?.portal_role === "RSSO";

  const { upcoming, past } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (t: Training) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.venue ?? "").toLowerCase().includes(q) ||
      (t.organizer ?? "").toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q);
    const list = trainings.filter(matches);
    return {
      upcoming: list
        .filter((t) => lastDay(t) >= today)
        .sort((a, b) => a.training_date.localeCompare(b.training_date)),
      past: list
        .filter((t) => lastDay(t) < today)
        .sort((a, b) => b.training_date.localeCompare(a.training_date)),
    };
  }, [trainings, search, today]);

  const shown = tab === "upcoming" ? upcoming : past;

  function run(action: () => Promise<TrainingActionResult>, onDone?: () => void) {
    setPageError(null);
    startTransition(async () => {
      const res = await action();
      if (res.success) {
        onDone?.();
        router.refresh();
      } else {
        setPageError(res.error ?? "Something went wrong.");
      }
    });
  }

  const openAdd = () => setDialog({ kind: "new" });
  const openEdit = (t: Training) => setDialog({ kind: "edit", item: t });

  function handleDelete(t: Training) {
    if (!confirm(`Delete "${t.title}"? Its sign-ups and attendance will be removed too.`)) return;
    run(() => deleteTraining(t.id));
  }

  return (
    <div>
      {/* Search, tabs and actions */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-6">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 self-start">
          {(["upcoming", "past"] as const).map((key) => {
            const count = key === "upcoming" ? upcoming.length : past.length;
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  active ? "bg-accent text-white" : "text-ink-400 hover:text-ink"
                }`}
              >
                {key === "upcoming" ? "Upcoming" : "Past"}
                <span className={`ml-1.5 font-mono ${active ? "text-white/80" : "text-ink-400/70"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 lg:justify-end flex-1">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search trainings, venues, organizers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent focus:outline-none transition-all placeholder:text-ink-400"
            />
          </div>
          {canManage && (
            <button
              onClick={openAdd}
              className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-600 text-white font-medium rounded-lg text-sm px-4 py-2 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Training</span>
            </button>
          )}
        </div>
      </div>

      {pageError && (
        <div className="mb-5 bg-red-50 text-red-700 text-xs px-3.5 py-2.5 rounded-lg border border-red-200/50">
          {pageError}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="tick-corners bg-surface border border-border rounded-lg p-12 text-center">
          <GraduationCap size={32} className="mx-auto text-ink-400/40 mb-3" />
          <h3 className="font-display font-semibold text-sm text-ink">
            {search ? "No trainings match your search" : tab === "upcoming" ? "No upcoming trainings" : "No past trainings yet"}
          </h3>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((t) => {
            const start = parts(t.training_date);
            const ongoing = t.training_date.slice(0, 10) <= today && lastDay(t) >= today;
            const isPast = lastDay(t) < today;
            const signedUp = !!currentUser && t.attendees.some((a) => a.staff_id === currentUser.id);
            const attendedCount = t.attendees.filter((a) => a.attended).length;
            const showAttendance = openAttendance === t.id;

            return (
              <div
                key={t.id}
                className="tick-corners group bg-surface border border-border rounded-lg p-5 hover:border-accent/40 transition-colors"
              >
                <div className="flex gap-5">
                  {/* Date block */}
                  <div className="w-16 shrink-0 text-center border border-border rounded-md py-2 bg-ink-50/60 self-start">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-accent">{MONTHS[start.m - 1]}</p>
                    <p className="font-mono text-2xl font-medium text-ink leading-tight">{start.d}</p>
                    <p className="font-mono text-[10px] text-ink-400">{start.y}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${MODE_STYLES[t.mode] ?? MODE_STYLES["in-person"]}`}>
                            {MODE_LABELS[t.mode] ?? t.mode}
                          </span>
                          {ongoing && (
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200/50">
                              Happening now
                            </span>
                          )}
                        </div>
                        <h3 className="font-display font-semibold text-base text-ink">{t.title}</h3>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1.5 text-ink-400 hover:text-accent rounded hover:bg-ink-50 transition-colors cursor-pointer"
                            title="Edit training"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            disabled={isPending}
                            className="p-1.5 text-ink-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                            title="Delete training"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-ink-400">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} /> {formatRange(t.training_date, t.end_date)}
                      </span>
                      {t.venue && (
                        <span className="inline-flex items-center gap-1.5">
                          {t.mode === "online" ? <Monitor size={13} /> : <MapPin size={13} />} {t.venue}
                        </span>
                      )}
                      {t.organizer && (
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={13} /> {t.organizer}
                        </span>
                      )}
                    </div>

                    {t.description && (
                      <p className="text-sm text-ink-700/90 mt-3 leading-relaxed whitespace-pre-line">{t.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border">
                      <span className="font-mono text-[11px] text-ink-400">
                        {isPast
                          ? `${attendedCount} of ${t.attendees.length} attended`
                          : `${t.attendees.length} signed up`}
                      </span>

                      {t.materials_url && (
                        <a
                          href={t.materials_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        >
                          Materials <ExternalLink size={12} />
                        </a>
                      )}

                      <div className="flex-1" />

                      {canManage && t.attendees.length > 0 && (
                        <button
                          onClick={() => setOpenAttendance(showAttendance ? null : t.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-ink-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          <UserCheck size={13} />
                          {showAttendance ? "Hide attendance" : "Attendance"}
                        </button>
                      )}

                      {currentUser && !isPast && (
                        signedUp ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 size={14} /> You&apos;re signed up
                            </span>
                            <button
                              onClick={() => run(() => withdrawFromTraining(t.id))}
                              disabled={isPending}
                              className="px-3 py-1.5 border border-border hover:bg-ink-50 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Withdraw
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => run(() => signUpForTraining(t.id))}
                            disabled={isPending}
                            className="px-3.5 py-1.5 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            Sign up
                          </button>
                        )
                      )}
                    </div>

                    {canManage && showAttendance && (
                      <div className="mt-3 border border-border rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-ink-50 text-[10px] font-mono uppercase tracking-widest text-ink-400 flex justify-between">
                          <span>Participant</span>
                          <span>Attended</span>
                        </div>
                        <ul className="divide-y divide-border">
                          {t.attendees.map((a) => (
                            <li key={a.staff_id} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <p className="truncate text-ink">{a.name}</p>
                                <p className="text-[11px] text-ink-400">{a.office}</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={a.attended}
                                disabled={isPending}
                                onChange={(e) => run(() => setTrainingAttendance(t.id, a.staff_id, e.target.checked))}
                                className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                                aria-label={`Mark ${a.name} as attended`}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog && (
        <TrainingForm
          existing={dialog.kind === "edit" ? dialog.item : null}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
function TrainingForm({
  existing,
  onClose,
  onSaved,
}: {
  existing: Training | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { busy, error, run } = useSaveStatus();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (await run(() => saveTraining(existing?.id ?? null, formData))) onSaved();
  }

  return (
    <Dialog
      title={existing ? "Edit training" : "Add training"}
      onClose={onClose}
      busy={busy}
      onSubmit={handleSubmit}
      footer={<DialogActions onCancel={onClose} busy={busy} label={existing ? "Save changes" : "Add training"} />}
    >
      <div>
        <label className={labelClass} htmlFor="tr-title">Title</label>
        <input id="tr-title" type="text" name="title" required autoFocus defaultValue={existing?.title ?? ""} className={inputClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="tr-start">Start date</label>
          <input id="tr-start" type="date" name="training_date" required defaultValue={existing?.training_date?.slice(0, 10) ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="tr-end">End date</label>
          <input id="tr-end" type="date" name="end_date" defaultValue={existing?.end_date?.slice(0, 10) ?? ""} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="tr-mode">Mode</label>
          <select id="tr-mode" name="mode" defaultValue={existing?.mode ?? "in-person"} className={inputClass}>
            <option value="in-person">In person</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="tr-venue">Venue or meeting link</label>
          <input id="tr-venue" type="text" name="venue" defaultValue={existing?.venue ?? ""} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="tr-organizer">Organizer</label>
        <input id="tr-organizer" type="text" name="organizer" defaultValue={existing?.organizer ?? ""} className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="tr-materials">Materials link</label>
        <input id="tr-materials" type="url" name="materials_url" defaultValue={existing?.materials_url ?? ""} placeholder="https://" className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="tr-description">Description</label>
        <textarea id="tr-description" name="description" rows={3} defaultValue={existing?.description ?? ""} className={`${inputClass} resize-none`} />
      </div>

      <FormError message={error} />
    </Dialog>
  );
}
