import { fetchBackend, getServerToken } from "@/lib/api/server";
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
  const token = await getServerToken();

  if (!token) {
    return <div className="text-sm text-ink-400">Unauthorized. Please log in.</div>;
  }

  // 1. Fetch active personnel list (for dropdowns)
  let staff: StaffMember[] = [];
  try {
    const res = await fetchBackend("/api/personnel", { cache: "no-store" });
    if (res.ok) {
      staff = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch staff list:", err);
  }

  // 2. Fetch leave requests
  let leaves: LeaveRequest[] = [];
  try {
    const res = await fetchBackend("/api/leaves", { cache: "no-store" });
    if (res.ok) {
      leaves = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch leaves:", err);
  }

  // 3. Fetch current logged-in user
  let currentUser: { id: string; name: string; email: string; portal_role: PortalRole } | null = null;
  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    if (res.ok) {
      currentUser = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch current user:", err);
  }

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
