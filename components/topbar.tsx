import { Search, Bell, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Topbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let name = "Guest User";
  let role = "Staff Member";
  let initials = "GU";

  if (user) {
    const { data: staff } = await supabase
      .from("personnel")
      .select("*")
      .eq("email", user.email)
      .single();

    if (staff) {
      name = staff.name;
      role = staff.role;
      initials = staff.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    } else {
      name = user.email?.split("@")[0] || "User";
      role = "Registered User";
      initials = name.slice(0, 2).toUpperCase();
    }
  }

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

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-medium">
            {initials}
          </div>
          <div className="hidden lg:block leading-tight">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-ink-400">{role}</p>
          </div>
          
          <form
            action={async () => {
              "use server";
              const supabase = await createClient();
              await supabase.auth.signOut();
              redirect("/login");
            }}
          >
            <button
              type="submit"
              className="text-ink-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50/50 flex items-center justify-center cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
