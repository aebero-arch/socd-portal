import { fetchBackend, getServerToken } from "@/lib/api/server";
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

  // Fetch personnel from FastAPI backend
  let staff: StaffMember[] = [];
  try {
    const res = await fetchBackend("/api/personnel", {
      cache: "no-store",
    });
    if (res.ok) {
      staff = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch from backend:", err);
  }

  // Fetch logged in user role from FastAPI backend
  let userRole: PortalRole | null = null;
  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    if (res.ok) {
      const me = await res.json();
      userRole = me.portal_role;
    }
  } catch (err) {
    console.error("Failed to fetch user role:", err);
  }

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

      <PersonnelDirectoryClient staff={staff} userRole={userRole} />
    </div>
  );
}
