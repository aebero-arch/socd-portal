import { Search, Bell } from "lucide-react";

export default function Topbar() {
  return (
    <header className="h-16 border-b border-border bg-surface/80 backdrop-blur flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
      <div className="relative w-full max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        <input
          type="text"
          placeholder="Search staff, reports, links…"
          className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          aria-label="Notifications"
          className="relative text-ink-400 hover:text-ink transition-colors"
        >
          <Bell size={18} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warm" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-medium">
            JD
          </div>
          <div className="hidden lg:block leading-tight">
            <p className="text-sm font-medium">Juan Dela Cruz</p>
            <p className="text-xs text-ink-400">Division Chief</p>
          </div>
        </div>
      </div>
    </header>
  );
}
