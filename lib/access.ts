import { redirect } from "next/navigation";
import { fetchBackend } from "@/lib/api/server";

// PSO (provincial) accounts only use Dashboard, Personnel Directory, PAP Monitoring
// and Comms & Announcements (see the sidebar). Pages for other modules call
// redirectPSO() first, which sends PSO accounts back to the Dashboard.
export async function redirectPSO(): Promise<void> {
  let role: string | null = null;
  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    if (res.ok) {
      const me = await res.json();
      role = me.portal_role ?? null;
    }
  } catch {
    // If the role can't be read, the page's own checks still apply.
  }
  // redirect() works by throwing, so it is called outside the try/catch.
  if (role === "PSO") redirect("/");
}
