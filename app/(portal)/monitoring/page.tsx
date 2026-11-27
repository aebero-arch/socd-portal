import { getPapsOverview } from "@/lib/monitoring-actions";
import PageHeader from "@/components/page-header";
import { pickYear } from "@/lib/types";
import YearSelect from "@/components/year-select";
import PapListClient from "./pap-list-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PAP Monitoring — SOCD Portal",
  description: "Track progress and status of Programs, Activities and Projects",
};

interface Props {
  searchParams: Promise<{ year?: string }>;
}

export default async function MonitoringPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams;
  // One request returns the year info and that year's PAPs.
  const requested = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;
  const overview = await getPapsOverview(requested);
  const yearInfo = overview;
  const year = pickYear(yearParam, overview.year);
  const paps = overview.paps;

  return (
    <div>
      <PageHeader
        title={`${year} PAP Monitoring`}
        actions={
          <YearSelect
            years={[...yearInfo.years, yearInfo.current_year]}
            value={year}
            basePath="/monitoring"
          />
        }
      />

      <PapListClient paps={paps} year={year} />
    </div>
  );
}
