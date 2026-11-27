import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { getMe } from "@/lib/me";

// Every portal page is behind sign-in (see app/(portal)/layout.tsx), so there is always a user here.
export default async function Topbar() {
  const me = await getMe();
  const name = me?.name ?? "";
  const role = me?.portal_role ? `${me.portal_role}${me.office ? ` · ${me.office}` : ""}` : me?.role ?? "";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur flex items-center justify-end px-6 md:px-8 sticky top-0 z-10">
      <div className="flex items-center gap-3" title={role}>
        <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-medium">
          {initials}
        </div>
        <p className="hidden sm:block text-sm font-medium">{name}</p>
        <Link
          href="/account"
          className="text-ink-400 hover:text-ink transition-colors p-1.5 rounded-md hover:bg-ink/5 flex items-center justify-center"
          title="Change password"
          aria-label="Change password"
        >
          <KeyRound size={16} />
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="text-ink-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50/50 flex items-center justify-center cursor-pointer"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  );
}
