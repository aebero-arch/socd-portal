import { notFound } from "next/navigation";
import PageHeader from "@/components/page-header";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getMyProfile,
  getPap,
  getActivities,
  getPaps,
  getSubmissions,
} from "@/lib/monitoring-actions";
import PapDetailClient from "./pap-detail-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ papId: string }>;
}

export default async function PapDetailPage({ params }: Props) {
  const { papId } = await params;

  const [pap, profile, initialActivities, allPaps, initialSubmissions] = await Promise.all([
    getPap(papId),
    getMyProfile(),
    getActivities(papId),
    getPaps(),
    getSubmissions(papId),
  ]);

  if (!pap) notFound();

  // Only offer PAPs from the same year when switching between PAPs.
  const sameYearPaps = allPaps.filter((p) => p.year === pap.year);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-400/60 mb-4">
        <Link href={`/monitoring?year=${pap.year}`} className="hover:text-accent transition-colors">
          {pap.year} PAP Monitoring
        </Link>
        <ChevronRight size={12} />
        <span className="text-ink-400">{pap.name}</span>
      </div>

      <PageHeader title={pap.name} />

      <PapDetailClient
        pap={pap}
        allPaps={sameYearPaps}
        initialActivities={initialActivities}
        initialSubmissions={initialSubmissions}
        userRole={profile?.portal_role ?? null}
        userOffice={profile?.office ?? null}
      />
    </div>
  );
}
