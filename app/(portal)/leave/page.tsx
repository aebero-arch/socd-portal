import { getJson, getServerToken } from "@/lib/api/server";
import { getMe } from "@/lib/me";
import { redirectPSO } from "@/lib/access";
import type { PortalRole, StaffMember } from "@/lib/types";
import LeaveClient from "./leave-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leave & WFH Schedule — SOCD Portal",
  description: "Track and schedule leaves, WFH, and fieldwork calendars.",
};

export interface LeaveRequest {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_office: string;
  start_date: string;
  end_date: string;
  leave_type: "vacation" | "sick" | "emergency" | "official-business" | "wfh" | "fieldwork";
  status: "pending" | "approved" | "denied";
  approver_id: string | null;
  notes: string | null;
  created_at: string;
}

export default async function LeavePage() {
  // Start loading the data straight away, while the PSO check runs.
  const staffP = getJson<StaffMember[]>("/api/personnel");
  const leavesP = getJson<LeaveRequest[]>("/api/leaves");
  await redirectPSO(); // PSO accounts don't use this module
  const token = await getServerToken();
  if (!token) {
    return <div className="text-sm text-ink-400">Unauthorized. Please log in.</div>;
  }
  const [staffRes, leavesRes, me] = await Promise.all([staffP, leavesP, getMe()]);
  const staff: StaffMember[] = staffRes.data ?? [];
  const leaves: LeaveRequest[] = leavesRes.data ?? [];
  const currentUser: { id: string; name: string; email: string; portal_role: PortalRole } | null = me
    ? { id: me.id, name: me.name, email: me.email, portal_role: me.portal_role as PortalRole }
    : null;

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          05 — Scheduling
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">
          Leave & WFH Schedule
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Plan, log, and approve vacation leaves, WFH schedules, and fieldwork schedules for PSA Region XI staff.
        </p>
      </div>

      <LeaveClient
        staffList={staff}
        initialLeaves={leaves}
        currentUser={currentUser}
      />
    </div>
  );
}
