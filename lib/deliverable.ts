// A deliverable's state for one office. Same rule as deliverable_state() in
// backend/main.py; docs/STATE.md describes both.
//
//   not submitted:  upcoming → due_soon (within DUE_SOON_DAYS) → overdue (past the deadline)
//   submitted:      on_time (on or before the deadline) | late
export type DeliverableState = "upcoming" | "due_soon" | "overdue" | "on_time" | "late";

export const DUE_SOON_DAYS = 30;

export const DELIVERABLE_LABEL: Record<DeliverableState, string> = {
  upcoming: "Not due",
  due_soon: "Due soon",
  overdue: "Overdue",
  on_time: "On time",
  late: "Late",
};

/** Today in Manila as YYYY-MM-DD. */
export function todayInManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dates are YYYY-MM-DD strings (longer ISO strings are cut to the date). */
export function deliverableState(
  deadline: string,
  actualSubmission: string | null | undefined,
  today: string
): DeliverableState {
  const due = deadline.slice(0, 10);
  if (actualSubmission) return actualSubmission.slice(0, 10) <= due ? "on_time" : "late";
  if (due < today) return "overdue";
  if (due <= addDays(today, DUE_SOON_DAYS)) return "due_soon";
  return "upcoming";
}
