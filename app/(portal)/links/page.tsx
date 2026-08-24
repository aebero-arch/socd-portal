import { fetchBackend, getServerToken } from "@/lib/api/server";
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
  const token = await getServerToken();

  if (!token) {
    return <div className="text-sm text-ink-400">Unauthorized. Please log in.</div>;
  }

  // Fetch links from FastAPI backend
  let links: DivisionLink[] = [];
  try {
    const res = await fetchBackend("/api/links", {
      cache: "no-store",
    });
    if (res.ok) {
      links = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch links:", err);
  }

  // Fetch logged in user role from FastAPI backend
  let userRole: PortalRole | null = null;
  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    if (res.ok) {
      const me = await res.json();
      userRole = me.portal_role;
    }
  } catch (err) {
    console.error("Failed to fetch user role:", err);
  }

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
