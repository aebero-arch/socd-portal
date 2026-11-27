import { getPapsOverview } from "@/lib/monitoring-actions";
import { getMe } from "@/lib/me";
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
  // One request returns the year info and that year's PAPs; the user comes from the shared lookup.
  const requested = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;
  const [me, overview] = await Promise.all([getMe(), getPapsOverview(requested)]);
  const userRole = me?.portal_role ?? null;
  const yearInfo = overview;
  const year = pickYear(yearParam, overview.year);
  const paps = overview.paps;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            02 — Monitoring
          </p>
          <h1 className="font-display font-semibold text-2xl mt-1">{year} PAP Monitoring</h1>
          <p className="text-sm text-ink-400 mt-1">
            Select a Program, Activity, or Project to view and update its deliverables and deadlines.
          </p>
        </div>
        <YearSelect
          years={[...yearInfo.years, yearInfo.current_year]}
          value={year}
          basePath="/monitoring"
        />
      </div>

      {/* Role badge */}
      {userRole && (
        <p className="font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider inline-flex mb-5
          bg-accent/10 text-accent border border-accent/20">
          {userRole} role
        </p>
      )}

      <PapListClient paps={paps} year={year} />
    </div>
  );
}
