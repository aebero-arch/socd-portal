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
  // ── Auth check (DEV_SKIP_AUTH: commented out for local dev) ──────────
  // const token = await getServerToken();
  // if (!token) redirect("/login");
  // try {
  //   const res = await fetchBackend("/api/me", { cache: "no-store" });
  //   if (!res.ok) redirect("/login?error=unauthorized");
  // } catch {
  //   redirect("/login?error=unauthorized");
  // }

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
