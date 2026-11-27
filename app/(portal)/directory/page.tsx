import { getJson, getServerToken } from "@/lib/api/server";
import { getMe } from "@/lib/me";
import type { StaffMember, PortalRole } from "@/lib/types";
import PersonnelDirectoryClient from "./personnel-directory-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Personnel Directory — SOCD Portal",
  description: "Internal database of PSA Region XI personnel",
};

export default async function DirectoryPage() {
  const token = await getServerToken();
  if (!token) {
    return <div className="text-sm text-ink-400">Unauthorized. Please log in.</div>;
  }
  // Personnel and the signed-in user load in parallel.
  const [staffRes, me] = await Promise.all([getJson<StaffMember[]>("/api/personnel"), getMe()]);
  const staff: StaffMember[] = staffRes.data ?? [];
  const userRole: PortalRole | null = me?.portal_role ?? null;
  const userOffice: string | null = me?.office ?? null;

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          01 — Directory
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">
          Personnel Directory
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Internal directory of PSA Region XI staff — add, edit, or manage personnel details.
        </p>
      </div>

      <PersonnelDirectoryClient staff={staff} userRole={userRole} userOffice={userOffice} />
    </div>
  );
}
