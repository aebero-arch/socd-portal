import Link from "next/link";
import {
  Users,
  FileBarChart,
  CalendarClock,
  GraduationCap,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";

const stats = [
  { label: "Staff on record", value: "24", unit: "personnel" },
  { label: "Open leave requests", value: "3", unit: "pending" },
  { label: "Reports due this week", value: "5", unit: "units" },
  { label: "Upcoming trainings", value: "2", unit: "this month" },
];

const shortcuts = [
  { href: "/directory", icon: Users, title: "Personnel Directory", desc: "Look up staff, roles, and contact info" },
  { href: "/reports", icon: FileBarChart, title: "Status Reports", desc: "Weekly submissions by unit" },
  { href: "/meetings", icon: CalendarClock, title: "Meetings & Agendas", desc: "Schedules and linked agenda docs" },
  { href: "/trainings", icon: GraduationCap, title: "Trainings", desc: "Materials and attendance tracking" },
  { href: "/leave", icon: CalendarDays, title: "Leave Schedule", desc: "Who's out, and when" },
];

export default function Home() {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
        00 — Dashboard
      </p>
      <h1 className="font-display font-semibold text-2xl mt-1">
        Good morning, Juan.
      </h1>
      <p className="text-sm text-ink-400 mt-1">
        Here&apos;s where things stand across the division today.
      </p>

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

      <h2 className="font-display font-semibold text-base mt-9 mb-3">
        Jump to a section
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shortcuts.map((s) => {
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
