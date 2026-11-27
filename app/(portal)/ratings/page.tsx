import { getJson } from "@/lib/api/server";
import PageHeader from "@/components/page-header";
import { getMe } from "@/lib/me";
import { requireAccess } from "@/lib/access";
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

  // Start loading the ratings straight away, while the access check runs.
  const ratingsP = getJson<RatingsReport>(`/api/ratings${yearNum ? `?year=${yearNum}` : ""}`);
  await requireAccess("/ratings");

  const [ratingsRes, me] = await Promise.all([ratingsP, getMe()]);
  const report: RatingsReport | null = ratingsRes.data;
  const userRole: PortalRole | null = me?.portal_role ?? null;
  const userOffice: string | null = me?.office ?? null;

  return (
    <div>
      <PageHeader title={`${report ? `${report.year} ` : ""}PAP Ratings`} />

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
