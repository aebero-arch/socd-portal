import { fetchBackend, getServerToken } from "@/lib/api/server";
import { redirect } from "next/navigation";
import type { PortalRole } from "@/lib/types";
import PapConfigClient from "./pap-config-client";
import { getPapsWithActivities } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PAP Configuration — SOCD Portal",
  description: "Manage Programs, Activities, and Projects configuration for monitoring.",
};

export default async function PapConfigPage() {
  let userRole: PortalRole | null = "SuperAdmin";

  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    if (res.ok) {
      const me = await res.json();
      userRole = (me.portal_role as PortalRole) ?? null;
    }
  } catch {
    // keep default
  }

  // Guard: PAP Configuration is only accessible to SuperAdmin and RSSO roles
  if (userRole && userRole !== "SuperAdmin" && userRole !== "RSSO") {
    redirect("/monitoring");
  }

  const paps = await getPapsWithActivities();

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          Config — PAPs
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">
          PAP Configuration
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Define and manage Programs, Activities, and Projects (PAPs) and their output deliverables for monitoring.
        </p>
      </div>

      <PapConfigClient initialPaps={paps} userRole={userRole} />
    </div>
  );
}
