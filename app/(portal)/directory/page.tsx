import { getJson, getServerToken } from "@/lib/api/server";
import PageHeader from "@/components/page-header";
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
      <PageHeader title="Personnel Directory" />

      <PersonnelDirectoryClient staff={staff} userRole={userRole} userOffice={userOffice} />
    </div>
  );
}
