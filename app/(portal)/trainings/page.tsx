import { fetchBackend, getServerToken } from "@/lib/api/server";
import { redirectPSO } from "@/lib/access";
import type { PortalRole } from "@/lib/types";
import TrainingsClient from "./trainings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trainings — SOCD Portal",
  description: "Upcoming and past trainings, materials, and attendance.",
};

export type TrainingMode = "in-person" | "online" | "hybrid";

export interface TrainingAttendee {
  staff_id: string;
  name: string;
  office: string;
  attended: boolean;
}

export interface Training {
  id: string;
  title: string;
  training_date: string; // YYYY-MM-DD
  end_date: string | null;
  mode: TrainingMode;
  venue: string | null;
  organizer: string | null;
  description: string | null;
  materials_url: string | null;
  created_at: string;
  attendees: TrainingAttendee[];
}

export default async function TrainingsPage() {
  await redirectPSO(); // PSO accounts don't use this module

  const token = await getServerToken();

  if (!token) {
    return <div className="text-sm text-ink-400">Unauthorized. Please log in.</div>;
  }

  let trainings: Training[] = [];
  let loadError: string | null = null;
  try {
    const res = await fetchBackend("/api/trainings", { cache: "no-store" });
    if (res.ok) {
      trainings = await res.json();
    } else {
      loadError = "Trainings could not be loaded right now.";
    }
  } catch (err) {
    console.error("Failed to fetch trainings:", err);
    loadError = "The portal server could not be reached.";
  }

  let currentUser: { id: string; portal_role: PortalRole | null } | null = null;
  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    if (res.ok) {
      const me = await res.json();
      currentUser = { id: me.id, portal_role: me.portal_role ?? null };
    }
  } catch (err) {
    console.error("Failed to fetch current user:", err);
  }

  // Today's date in the division's time zone, as YYYY-MM-DD.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          04 — Capacity Building
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">Trainings</h1>
        <p className="text-sm text-ink-400 mt-1">
          See upcoming trainings, sign up, find materials, and keep track of who attended.
        </p>
      </div>

      {loadError && (
        <div className="mb-6 bg-red-50 text-red-700 text-xs px-3.5 py-2.5 rounded-lg border border-red-200/50">
          {loadError}
        </div>
      )}

      <TrainingsClient trainings={trainings} currentUser={currentUser} today={today} />
    </div>
  );
}