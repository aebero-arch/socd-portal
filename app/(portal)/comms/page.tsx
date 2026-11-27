import { getJson } from "@/lib/api/server";
import PageHeader from "@/components/page-header";
import { getMe } from "@/lib/me";
import type { Announcement, PortalRole } from "@/lib/types";
import CommsClient from "./comms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comms & Announcements — SOCD Portal",
  description: "Announcements for the division and the provincial offices",
};

export default async function CommsPage() {
  const [listRes, me] = await Promise.all([getJson<Announcement[]>("/api/announcements"), getMe()]);
  const announcements: Announcement[] = listRes.data ?? [];
  const loadError = !listRes.ok;
  const userRole: PortalRole | null = me?.portal_role ?? null;

  return (
    <div>
      <PageHeader title="Comms & Announcements" />

      {loadError ? (
        <div className="border border-border rounded-xl bg-surface p-10 text-center text-sm text-ink-400">
          Announcements could not be loaded. Please refresh the page or try again later.
        </div>
      ) : (
        <CommsClient initialAnnouncements={announcements} userRole={userRole} />
      )}
    </div>
  );
}
