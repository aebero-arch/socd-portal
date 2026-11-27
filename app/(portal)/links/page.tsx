import { getJson, getServerToken } from "@/lib/api/server";
import { getMe } from "@/lib/me";
import { redirectPSO } from "@/lib/access";
import type { PortalRole } from "@/lib/types";
import LinksClient from "./links-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Links & Resources — SOCD Portal",
  description: "Quick links to PSA systems, databases, forms, and documents.",
};

export interface DivisionLink {
  id: string;
  label: string;
  url: string;
  category: string;
  description: string | null;
  created_at: string;
}

export default async function LinksPage() {
  // Start loading the links straight away, while the PSO check runs.
  const linksP = getJson<DivisionLink[]>("/api/links");
  await redirectPSO(); // PSO accounts don't use this module
  const token = await getServerToken();
  if (!token) {
    return <div className="text-sm text-ink-400">Unauthorized. Please log in.</div>;
  }
  const [linksRes, me] = await Promise.all([linksP, getMe()]);
  const links: DivisionLink[] = linksRes.data ?? [];
  const userRole: PortalRole | null = me?.portal_role ?? null;

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          07 — Resources
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">
          Links & Resources
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Quick access to PSA systems, reference databases, administrative forms, and division resources.
        </p>
      </div>

      <LinksClient initialLinks={links} userRole={userRole} />
    </div>
  );
}
