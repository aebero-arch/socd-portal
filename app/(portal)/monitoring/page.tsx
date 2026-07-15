import { getServerToken } from "@/lib/api/server";
import { getMyRole, getPaps, getActivities } from "@/lib/monitoring-actions";
import MonitoringClient from "./monitoring-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Monitoring of PAPs — SOCD Portal",
  description: "Track progress and status of Programs, Activities and Projects",
};

export default async function MonitoringPage() {
  const token = await getServerToken();

  if (!token) {
    return <div className="text-sm text-ink-400">Unauthorized. Please log in.</div>;
  }

  const userRole = await getMyRole();
  const paps = await getPaps();
  const initialActivities = await getActivities();

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
          Track and update deliverables, deadlines, and response rates for division programs.
        </p>
      </div>

      <MonitoringClient
        paps={paps}
        initialActivities={initialActivities}
        userRole={userRole}
      />
    </div>
  );
}
