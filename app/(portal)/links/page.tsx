import { getJson, getServerToken } from "@/lib/api/server";
import PageHeader from "@/components/page-header";
import { getMe } from "@/lib/me";
import { requireAccess } from "@/lib/access";
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
  // Start loading the links straight away, while the access check runs.
  const linksP = getJson<DivisionLink[]>("/api/links");
  await requireAccess("/links");
  const token = await getServerToken();
  if (!token) {
    return <div className="text-sm text-ink-400">Unauthorized. Please log in.</div>;
  }
  const [linksRes, me] = await Promise.all([linksP, getMe()]);
  const links: DivisionLink[] = linksRes.data ?? [];
  const userRole: PortalRole | null = me?.portal_role ?? null;

  return (
    <div>
      <PageHeader title="Links & Resources" />

      <LinksClient initialLinks={links} userRole={userRole} />
    </div>
  );
}
