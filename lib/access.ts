import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";

// PSO (provincial) accounts only use Dashboard, Personnel Directory, PAP Monitoring
// and Comms & Announcements (see the sidebar). Pages for other modules call
// redirectPSO() first, which sends PSO accounts back to the Dashboard.
// It reuses the page load's shared /api/me result, so it adds no extra request.
export async function redirectPSO(): Promise<void> {
  const me = await getMe();
  // If the role can't be read, the page's own checks still apply.
  if (me?.portal_role === "PSO") redirect("/");
}
