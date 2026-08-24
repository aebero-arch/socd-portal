import { getMyRole, getPaps } from "@/lib/monitoring-actions";
import PapListClient from "./pap-list-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Monitoring of PAPs — SOCD Portal",
  description: "Track progress and status of Programs, Activities and Projects",
};

export default async function MonitoringPage() {
  // DEV_SKIP_AUTH: role is stubbed in layout; no token check needed here
  const userRole = await getMyRole();
  const paps = await getPaps();

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          02 — Monitoring
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">
          Monitoring of PAPs
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Select a Program, Activity, or Project to view and update its deliverables and deadlines.
        </p>
      </div>

      {/* Role badge */}
      {userRole && (
        <p className="font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider inline-flex mb-5
          bg-accent/10 text-accent border border-accent/20">
          {userRole} role
        </p>
      )}

      <PapListClient paps={paps} />
    </div>
  );
}
