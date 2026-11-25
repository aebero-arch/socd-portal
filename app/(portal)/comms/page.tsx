import { fetchBackend } from "@/lib/api/server";
import type { Announcement, PortalRole } from "@/lib/types";
import CommsClient from "./comms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comms & Announcements — SOCD Portal",
  description: "Announcements for the division and the provincial offices",
};

export default async function CommsPage() {
  let announcements: Announcement[] = [];
  let loadError = false;
  let userRole: PortalRole | null = null;

  try {
    const [listRes, meRes] = await Promise.all([
      fetchBackend("/api/announcements", { cache: "no-store" }),
      fetchBackend("/api/me", { cache: "no-store" }),
    ]);
    if (listRes.ok) announcements = await listRes.json();
    else loadError = true;
    if (meRes.ok) userRole = (await meRes.json()).portal_role ?? null;
  } catch {
    loadError = true;
  }

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          06 — Comms
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">Comms &amp; Announcements</h1>
        <p className="text-sm text-ink-400 mt-1">
          Notices for the division and the provincial offices.
        </p>
      </div>

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
