import Link from "next/link";
import {
  LayoutGrid,
  Users,
  FileBarChart,
  CalendarClock,
  GraduationCap,
  CalendarDays,
  Mail,
  Link2,
  Megaphone,
} from "lucide-react";

const sections = [
  { code: "00", label: "Dashboard", href: "/", icon: LayoutGrid },
  { code: "01", label: "Personnel Directory", href: "/directory", icon: Users },
  { code: "02", label: "Monitoring of PAPs", href: "/monitoring", icon: FileBarChart },
  { code: "03", label: "Meetings & Agendas", href: "/meetings", icon: CalendarClock },
  { code: "04", label: "Trainings", href: "/trainings", icon: GraduationCap },
  { code: "05", label: "Leave Schedule", href: "/leave", icon: CalendarDays },
  { code: "06", label: "Comms & Announcements", href: "/comms", icon: Megaphone },
  { code: "07", label: "Links & Resources", href: "/links", icon: Link2 },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-ink text-white">
      <div className="px-6 py-7 border-b border-white/10">
        <p className="font-mono text-[11px] tracking-widest text-accent-50/70 uppercase">
          SOCD · Internal
        </p>
        <h1 className="font-display font-semibold text-lg leading-snug mt-1">
          Statistical Operations
          <br />& Coordination Division
        </h1>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.code}
              href={s.href}
              className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ink-100 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span className="font-mono text-[10px] text-accent w-5 shrink-0">
                {s.code}
              </span>
              <Icon size={16} className="shrink-0 opacity-80 group-hover:opacity-100" />
              <span className="truncate">{s.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-white/10">
        <p className="font-mono text-[10px] text-ink-100/50">
          v0.1 · built on Next.js + MariaDB
        </p>
      </div>
    </aside>
  );
}
