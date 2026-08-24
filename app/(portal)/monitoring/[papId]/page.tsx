import { notFound } from "next/navigation";
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

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-400/60 mb-4">
        <Link href="/monitoring" className="hover:text-accent transition-colors">
          02 — Monitoring
        </Link>
        <ChevronRight size={12} />
        <span className="text-ink-400">{pap.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          PAP Detail
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1 leading-snug">
          {pap.name}
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Track and update deliverables, deadlines, and response rates for this program.
        </p>
      </div>

      <PapDetailClient
        pap={pap}
        allPaps={allPaps}
        initialActivities={initialActivities}
        initialSubmissions={initialSubmissions}
        userRole={profile?.portal_role ?? null}
        userOffice={profile?.office ?? null}
      />
    </div>
  );
}
