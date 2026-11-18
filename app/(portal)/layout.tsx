// import Sidebar from "@/components/sidebar";
// import Topbar from "@/components/topbar";
// import { createClient } from "@/lib/supabase/server";
// import { redirect } from "next/navigation";

// export default async function PortalLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   const supabase = await createClient();
//   const { data: { user } } = await supabase.auth.getUser();

//   if (user) {
//     const { data: staff } = await supabase
//       .from("personnel")
//       .select("id")
//       .eq("email", user.email)
//       .single();

//     if (!staff) {
//       await supabase.auth.signOut();
//       redirect("/login?error=unauthorized");
//     }
//   }

//   return (
//     <div className="flex min-h-screen">
//       <Sidebar />
//       <div className="flex-1 flex flex-col min-w-0">
//         <Topbar />
//         <main className="flex-1 p-6 md:p-8">{children}</main>
//       </div>
//     </div>
//   );
// }




import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { fetchBackend, getServerToken } from "@/lib/api/server";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ── Auth check: every portal page needs a valid session ─────────────
  const token = await getServerToken();
  if (!token) redirect("/login");

  let status = 0;
  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    status = res.status;
  } catch {
    status = 0;
  }

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
