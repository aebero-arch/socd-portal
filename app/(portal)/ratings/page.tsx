import { fetchBackend } from "@/lib/api/server";
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

  let report: RatingsReport | null = null;
  let userRole: PortalRole | null = null;
  let userOffice: string | null = null;

  try {
    const [ratingsRes, meRes] = await Promise.all([
      fetchBackend(`/api/ratings${yearNum ? `?year=${yearNum}` : ""}`, { cache: "no-store" }),
      fetchBackend("/api/me", { cache: "no-store" }),
    ]);
    if (ratingsRes.ok) report = await ratingsRes.json();
    if (meRes.ok) {
      const me = await meRes.json();
      userRole = (me.portal_role as PortalRole) ?? null;
      userOffice = me.office ?? null;
    }
  } catch {
    report = null;
  }

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          08 — PAP Ratings
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">Year-end Ratings</h1>
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
