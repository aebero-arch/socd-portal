import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { getMeResult } from "@/lib/me";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ── Auth check: every portal page needs a valid session ─────────────
  // Shared with the sidebar, top bar and page, so /api/me is called once per load.
  const { status } = await getMeResult();

  // redirect() works by throwing, so it is called outside the try/catch.
  if (status === 401) redirect("/login?error=session");
  if (status === 403) redirect("/login?error=unauthorized");
  if (status < 200 || status >= 300) redirect("/login?error=unavailable");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
