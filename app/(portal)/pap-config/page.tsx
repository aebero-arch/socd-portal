import { fetchBackend, getServerToken } from "@/lib/api/server";
import { redirect } from "next/navigation";
import type { PortalRole } from "@/lib/types";
import { pickYear } from "@/lib/types";
import { getPapYears } from "@/lib/monitoring-actions";
import YearSelect from "@/components/year-select";
import PapConfigClient from "./pap-config-client";
import { getPapsWithActivities, getFocalAssignments, getStaffOptions } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PAP Configuration — SOCD Portal",
  description: "Manage Programs, Activities, and Projects configuration for monitoring.",
};

interface Props {
  searchParams: Promise<{ year?: string }>;
}

export default async function PapConfigPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;
  let userRole: PortalRole | null = null;

  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    if (res.ok) {
      const me = await res.json();
      userRole = (me.portal_role as PortalRole) ?? null;
    }
  } catch {
    // no role: redirected below
  }

  // Guard: PAP Configuration is only accessible to SuperAdmin and RSSO roles
  if (userRole !== "SuperAdmin" && userRole !== "RSSO") {
    redirect("/monitoring");
  }

  const yearInfo = await getPapYears();
  const year = pickYear(yearParam, yearInfo.default_year);

  const [paps, focalAssignments, staff] = await Promise.all([
    getPapsWithActivities(year),
    getFocalAssignments(),
    getStaffOptions(),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            Config — PAPs
          </p>
          <h1 className="font-display font-semibold text-2xl mt-1">
            {year} PAP Configuration
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            Define and manage Programs, Activities, and Projects (PAPs) and their output deliverables for monitoring.
          </p>
        </div>
        {/* Next year is always offered so its PAPs can be set up ahead of time. */}
        <YearSelect
          years={[...yearInfo.years, yearInfo.current_year, yearInfo.current_year + 1]}
          value={year}
          basePath="/pap-config"
        />
      </div>

      <PapConfigClient
        key={year}
        year={year}
        initialPaps={paps}
        userRole={userRole}
        initialFocal={focalAssignments}
        staff={staff}
      />
    </div>
  );
}
