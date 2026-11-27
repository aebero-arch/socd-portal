import Link from "next/link";
import { getMe } from "@/lib/me";
import { modulesFor, type Module } from "@/lib/nav";

function NavLink({ m }: { m: Module }) {
  const Icon = m.icon;
  return (
    <Link
      href={m.href}
      className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-100 hover:bg-white/10 hover:text-white transition-colors"
    >
      <Icon size={16} className="shrink-0 opacity-80 group-hover:opacity-100" />
      <span className="truncate">{m.label}</span>
    </Link>
  );
}

export default async function Sidebar() {
  const modules = modulesFor((await getMe())?.portal_role ?? null);
  const main = modules.filter((m) => !m.settings);
  const settings = modules.filter((m) => m.settings);

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-ink text-white">
      <div className="px-6 py-5 border-b border-white/10">
        <p className="font-display font-semibold text-base">SOCD Portal</p>
      </div>
      <nav className="flex-1 py-3 px-3 flex flex-col overflow-y-auto">
        <div className="space-y-0.5">
          {main.map((m) => (
            <NavLink key={m.href} m={m} />
          ))}
        </div>
        {settings.length > 0 && (
          <div className="mt-auto pt-3 border-t border-white/10 space-y-0.5">
            {settings.map((m) => (
              <NavLink key={m.href} m={m} />
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
