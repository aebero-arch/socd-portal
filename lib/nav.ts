import {
  Award,
  CalendarDays,
  FileBarChart,
  GraduationCap,
  LayoutGrid,
  Link2,
  Megaphone,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PortalRole } from "@/lib/types";

/**
 * Who can open a module:
 * - everyone: every signed-in account
 * - regional: everyone except PSO (provincial) accounts
 * - admin:    SuperAdmin and RSSO only
 * - superadmin: SuperAdmin only
 */
export type Access = "everyone" | "regional" | "admin" | "superadmin";

export type Module = {
  href: string;
  label: string;
  icon: LucideIcon;
  access: Access;
  /** Listed under "Jump to" on the Dashboard. */
  shortcut?: boolean;
  /** Shown apart from the main list in the sidebar. */
  settings?: boolean;
};

// The single list of portal modules. The sidebar, the Dashboard shortcuts and
// each page's access check all read from it, so a module is added, renamed or
// restricted here and nowhere else.
export const MODULES: Module[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid, access: "everyone" },
  { href: "/directory", label: "Personnel Directory", icon: Users, access: "everyone", shortcut: true },
  { href: "/monitoring", label: "PAP Monitoring", icon: FileBarChart, access: "everyone", shortcut: true },
  { href: "/trainings", label: "Trainings", icon: GraduationCap, access: "regional", shortcut: true },
  { href: "/leave", label: "Leave Schedule", icon: CalendarDays, access: "regional", shortcut: true },
  { href: "/comms", label: "Comms & Announcements", icon: Megaphone, access: "everyone" },
  { href: "/links", label: "Links & Resources", icon: Link2, access: "regional" },
  { href: "/ratings", label: "PAP Ratings", icon: Award, access: "regional" },
  { href: "/pap-config", label: "PAP Configuration", icon: Settings2, access: "admin", settings: true },
  { href: "/activity", label: "Activity Log", icon: ShieldCheck, access: "superadmin", settings: true },
];

export function canOpen(access: Access, role: PortalRole | null): boolean {
  if (access === "everyone") return true;
  if (access === "regional") return role !== "PSO";
  if (access === "superadmin") return role === "SuperAdmin";
  return role === "SuperAdmin" || role === "RSSO";
}

export function modulesFor(role: PortalRole | null): Module[] {
  return MODULES.filter((m) => canOpen(m.access, role));
}

export function moduleFor(href: string): Module {
  const m = MODULES.find((x) => x.href === href);
  if (!m) throw new Error(`No module is registered for ${href} in lib/nav.ts`);
  return m;
}
