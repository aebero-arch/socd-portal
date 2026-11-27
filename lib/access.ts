import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { canOpen, moduleFor } from "@/lib/nav";

/**
 * Call first in a module's page. Accounts that can't open the module (see
 * lib/nav.ts) go back to the Dashboard. Reuses the page load's shared /api/me
 * result, so it adds no request.
 */
export async function requireAccess(href: string): Promise<void> {
  const { access } = moduleFor(href);
  const me = await getMe();
  if (!me) {
    // Role unknown: admin modules stay closed; for the rest the page's own checks apply.
    if (access === "admin") redirect("/");
    return;
  }
  if (!canOpen(access, me.portal_role ?? null)) redirect("/");
}
