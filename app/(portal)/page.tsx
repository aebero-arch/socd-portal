// import Link from "next/link";
// import {
//   Users,
//   FileBarChart,
//   CalendarClock,
//   GraduationCap,
//   CalendarDays,
//   ArrowUpRight,
// } from "lucide-react";

// const stats = [
//   { label: "Staff on record", value: "24", unit: "personnel" },
//   { label: "Open leave requests", value: "3", unit: "pending" },
//   { label: "Reports due this week", value: "5", unit: "units" },
//   { label: "Upcoming trainings", value: "2", unit: "this month" },
// ];

// const shortcuts = [
//   { href: "/directory", icon: Users, title: "Personnel Directory", desc: "Look up staff, roles, and contact info" },
//   { href: "/reports", icon: FileBarChart, title: "Status Reports", desc: "Weekly submissions by unit" },
//   { href: "/meetings", icon: CalendarClock, title: "Meetings & Agendas", desc: "Schedules and linked agenda docs" },
//   { href: "/trainings", icon: GraduationCap, title: "Trainings", desc: "Materials and attendance tracking" },
//   { href: "/leave", icon: CalendarDays, title: "Leave Schedule", desc: "Who's out, and when" },
// ];

// export default function Home() {
//   return (
//     <div>
//       <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
//         00 — Dashboard
//       </p>
//       <h1 className="font-display font-semibold text-2xl mt-1">
//         Good morning, Juan.
//       </h1>
//       <p className="text-sm text-ink-400 mt-1">
//         Here&apos;s where things stand across the division today.
//       </p>

//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
//         {stats.map((s) => (
//           <div
//             key={s.label}
//             className="tick-corners bg-surface border border-border rounded-lg p-5"
//           >
//             <p className="font-mono text-3xl font-medium text-ink">{s.value}</p>
//             <p className="text-xs text-ink-400 mt-1">{s.label}</p>
//             <p className="font-mono text-[10px] uppercase tracking-wide text-accent mt-2">
//               {s.unit}
//             </p>
//           </div>
//         ))}
//       </div>

//       <h2 className="font-display font-semibold text-base mt-9 mb-3">
//         Jump to a section
//       </h2>
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//         {shortcuts.map((s) => {
//           const Icon = s.icon;
//           return (
//             <Link
//               key={s.href}
//               href={s.href}
//               className="group bg-surface border border-border rounded-lg p-5 hover:border-accent/40 hover:shadow-[0_2px_16px_-4px_rgba(19,33,59,0.12)] transition-all"
//             >
//               <div className="flex items-center justify-between">
//                 <div className="w-9 h-9 rounded-md bg-accent-50 text-accent-600 flex items-center justify-center">
//                   <Icon size={16} />
//                 </div>
//                 <ArrowUpRight
//                   size={16}
//                   className="text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity"
//                 />
//               </div>
//               <h3 className="font-display font-semibold text-sm mt-3">{s.title}</h3>
//               <p className="text-xs text-ink-400 mt-1">{s.desc}</p>
//             </Link>
//           );
//         })}
//       </div>
//     </div>
//   );
// }



import Link from "next/link";
import { fetchBackend, getServerToken } from "@/lib/api/server";
import type { Announcement } from "@/lib/types";
import AnnouncementCard from "./comms/announcement-card";
import {
  Users,
  FileBarChart,
  CalendarClock,
  GraduationCap,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";

type Shortcut = { href: string; icon: typeof Users; title: string; desc: string };

const shortcuts: Shortcut[] = [
  { href: "/directory", icon: Users, title: "Personnel Directory", desc: "Look up staff, roles, and contact info" },
  { href: "/monitoring", icon: FileBarChart, title: "PAP Monitoring", desc: "Track progress and deadlines of division programs" },
  { href: "/meetings", icon: CalendarClock, title: "Meetings & Agendas", desc: "Schedules and linked agenda docs" },
  { href: "/trainings", icon: GraduationCap, title: "Trainings", desc: "Materials and attendance tracking" },
  { href: "/leave", icon: CalendarDays, title: "Leave Schedule", desc: "Who's out, and when" },
];

// PSO (provincial) accounts only get these shortcuts.
const PSO_SHORTCUT_HREFS = ["/directory", "/monitoring"];

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

type Stat = { label: string; value: string; unit: string };

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
  const token = await getServerToken();
  let user: { name: string; role: string; portal_role: string; office: string | null } | null = null;
  if (token) {
    try {
      const res = await fetchBackend("/api/me", { cache: "no-store" });
      if (res.ok) user = await res.json();
    } catch {
      // ignore
    }
  }
  const isPSO = user?.portal_role === "PSO";

  // ── Fetch dynamic stats ──────────────────────────────────────
  let statsData: RegionStats | ProvinceStats | null = null;
  try {
    const res = await fetchBackend("/api/stats", { cache: "no-store" });
    if (res.ok) {
      statsData = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch dashboard stats:", err);
  }

  // ── Latest announcements (pinned first) ─────────────────────
  let announcements: Announcement[] = [];
  try {
    const res = await fetchBackend("/api/announcements?limit=3", { cache: "no-store" });
    if (res.ok) announcements = await res.json();
  } catch (err) {
    console.error("Failed to fetch announcements:", err);
  }

  let stats: Stat[];
  let subtitle: string;
  if (statsData?.scope === "province") {
    const p = statsData;
    subtitle = `Here's where ${p.office} stands on ${p.year} PAP monitoring.`;
    stats = [
      { label: `Staff in ${p.office}`, value: String(p.staff_count), unit: "personnel" },
      {
        label: "Deliverables submitted",
        value: `${p.activities_submitted} / ${p.activities_total}`,
        unit: `${p.paps_count} PAP${p.paps_count !== 1 ? "s" : ""} in ${p.year}`,
      },
      { label: "Overdue deliverables", value: String(p.activities_overdue), unit: "past deadline" },
      { label: "Due in the next 30 days", value: String(p.activities_due_soon), unit: "not yet submitted" },
    ];
  } else {
    const r: RegionStats = statsData?.scope === "region"
      ? statsData
      : { scope: "region", staff_count: 0, pending_leaves: 0, pending_activities: 0, upcoming_trainings: 0 };
    subtitle = "Here's where things stand across the division today.";
    stats = isPSO
      ? []
      : [
          { label: "Staff on record", value: String(r.staff_count), unit: "personnel" },
          { label: "Open leave requests", value: String(r.pending_leaves), unit: "pending" },
          { label: "Pending PAP deliverables", value: String(r.pending_activities), unit: "activities" },
          { label: "Upcoming trainings", value: String(r.upcoming_trainings), unit: "scheduled" },
        ];
  }

  const visibleShortcuts = isPSO
    ? shortcuts.filter((s) => PSO_SHORTCUT_HREFS.includes(s.href))
    : shortcuts;

  return (
    <div>
      <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
        00 — Dashboard
      </p>
      <h1 className="font-display font-semibold text-2xl mt-1">
        {getGreeting()}, {getFirstName(user?.name ?? "")}.
      </h1>
      <p className="text-sm text-ink-400 mt-1">{subtitle}</p>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="tick-corners bg-surface border border-border rounded-lg p-5"
            >
              <p className="font-mono text-3xl font-medium text-ink">{s.value}</p>
              <p className="text-xs text-ink-400 mt-1">{s.label}</p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-accent mt-2">
                {s.unit}
              </p>
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
              <h3 className="font-display font-semibold text-sm mt-3">{s.title}</h3>
              <p className="text-xs text-ink-400 mt-1">{s.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
