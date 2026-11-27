import { getJson } from "@/lib/api/server";
import { getMe } from "@/lib/me";
import { redirectPSO } from "@/lib/access";
import type { PortalRole, RatingsReport } from "@/lib/types";
import RatingsClient from "./ratings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PAP Ratings — SOCD Portal",
  description: "Year-end ratings per province, per focal person and per project.",
};

interface Props {
  searchParams: Promise<{ year?: string }>;
}

export default async function RatingsPage({ searchParams }: Props) {
  const { year } = await searchParams;
  const yearNum = year && /^\d{4}$/.test(year) ? Number(year) : null;

  // Start loading the ratings straight away, while the PSO check runs.
  const ratingsP = getJson<RatingsReport>(`/api/ratings${yearNum ? `?year=${yearNum}` : ""}`);
  await redirectPSO(); // PSO accounts don't use this module

  const [ratingsRes, me] = await Promise.all([ratingsP, getMe()]);
  const report: RatingsReport | null = ratingsRes.data;
  const userRole: PortalRole | null = me?.portal_role ?? null;
  const userOffice: string | null = me?.office ?? null;

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          08 — PAP Ratings
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">
          {report ? `${report.year} ` : ""}Year-end Ratings
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Final ratings per province, per focal person and per project, computed from the monitoring
          submissions.
        </p>
      </div>

      {report ? (
        <RatingsClient report={report} userRole={userRole} userOffice={userOffice} />
      ) : (
        <div className="border border-border rounded-xl bg-surface p-10 text-center text-sm text-ink-400">
          Ratings could not be loaded. Please refresh the page or try again later.
        </div>
      )}
    </div>
  );
}
