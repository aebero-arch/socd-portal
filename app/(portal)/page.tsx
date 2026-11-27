import Link from "next/link";
import { getJson } from "@/lib/api/server";
import { getMe } from "@/lib/me";
import type { Announcement } from "@/lib/types";
import AnnouncementCard from "./comms/announcement-card";
import { ArrowUpRight } from "lucide-react";
import { modulesFor } from "@/lib/nav";


type RegionStats = {
  scope: "region";
  staff_count: number;
  pending_leaves: number;
  pending_activities: number;
  upcoming_trainings: number;
};

type ProvinceStats = {
  scope: "province";
  office: string;
  year: number;
  staff_count: number;
  paps_count: number;
  activities_total: number;
  activities_submitted: number;
  activities_overdue: number;
  activities_due_soon: number;
};

type Stat = { label: string; value: string };

function getGreeting() {
  const h = Number(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour: "numeric", hour12: false })
  );
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string) {
  return fullName?.split(" ")[0] || "there";
}

export default async function Home() {
  // The user, the stats and the latest announcements load in parallel.
  const [user, statsRes, announcementsRes] = await Promise.all([
    getMe(),
    getJson<RegionStats | ProvinceStats>("/api/stats"),
    getJson<Announcement[]>("/api/announcements?limit=3"),
  ]);
  const isPSO = user?.portal_role === "PSO";
  const statsData = statsRes.data;
  const announcements: Announcement[] = announcementsRes.data ?? [];

  let stats: Stat[];
  if (statsData?.scope === "province") {
    const p = statsData;
    stats = [
      { label: `Staff in ${p.office}`, value: String(p.staff_count) },
      { label: "Deliverables submitted", value: `${p.activities_submitted} / ${p.activities_total}` },
      { label: "Overdue deliverables", value: String(p.activities_overdue) },
      { label: "Due in the next 30 days", value: String(p.activities_due_soon) },
    ];
  } else {
    const r: RegionStats = statsData?.scope === "region"
      ? statsData
      : { scope: "region", staff_count: 0, pending_leaves: 0, pending_activities: 0, upcoming_trainings: 0 };
    stats = isPSO
      ? []
      : [
          { label: "Staff on record", value: String(r.staff_count) },
          { label: "Open leave requests", value: String(r.pending_leaves) },
          { label: "Pending PAP deliverables", value: String(r.pending_activities) },
          { label: "Upcoming trainings", value: String(r.upcoming_trainings) },
        ];
  }

  const visibleShortcuts = modulesFor(user?.portal_role ?? null).filter((m) => m.shortcut);

  return (
    <div>
      <h1 className="font-display font-semibold text-2xl">
        {getGreeting()}, {getFirstName(user?.name ?? "")}.
      </h1>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="tick-corners bg-surface border border-border rounded-lg p-5"
            >
              <p className="font-mono text-3xl font-medium text-ink">{s.value}</p>
              <p className="text-xs text-ink-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-9 mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display font-semibold text-base">Announcements</h2>
        <Link href="/comms" className="font-mono text-[11px] text-accent hover:underline">
          View all
        </Link>
      </div>
      {announcements.length === 0 ? (
        <p className="text-sm text-ink-400">No announcements right now.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} compact />
          ))}
        </div>
      )}

      <h2 className="font-display font-semibold text-base mt-9 mb-3">
        Jump to a section
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleShortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group bg-surface border border-border rounded-lg p-5 hover:border-accent/40 hover:shadow-[0_2px_16px_-4px_rgba(19,33,59,0.12)] transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-md bg-accent-50 text-accent-600 flex items-center justify-center">
                  <Icon size={16} />
                </div>
                <ArrowUpRight
                  size={16}
                  className="text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <h3 className="font-display font-semibold text-sm mt-3">{s.label}</h3>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
