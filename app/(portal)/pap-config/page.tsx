import { requireAccess } from "@/lib/access";
import { getMe } from "@/lib/me";
import PageHeader from "@/components/page-header";
import type { PortalRole } from "@/lib/types";
import { pickYear } from "@/lib/types";
import YearSelect from "@/components/year-select";
import PapConfigClient from "./pap-config-client";
import { getPapConfigOverview, getFocalAssignments, getStaffOptions } from "./actions";

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
  const requested = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;

  // Start loading the page data straight away, while the access check runs.
  const overviewP = getPapConfigOverview(requested);
  const focalP = getFocalAssignments();
  const staffP = getStaffOptions();

  await requireAccess("/pap-config");
  const userRole: PortalRole | null = (await getMe())?.portal_role ?? null;

  const [overview, focalAssignments, staff] = await Promise.all([overviewP, focalP, staffP]);
  const yearInfo = overview;
  const year = pickYear(yearParam, overview.year);
  const paps = overview.paps;

  return (
    <div>
      <PageHeader
        title={`${year} PAP Configuration`}
        actions={
          <YearSelect
            years={[...yearInfo.years, yearInfo.current_year, yearInfo.current_year + 1]}
            value={year}
            basePath="/pap-config"
          />
        }
      />

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
