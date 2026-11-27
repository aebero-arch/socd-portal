import { fetchBackend, getServerToken } from "@/lib/api/server";

// Streams the API's JSON backup to the browser. The API allows SuperAdmin only.
export async function GET() {
  if (!(await getServerToken())) return new Response("Please sign in.", { status: 401 });
  const res = await fetchBackend("/api/admin/backup", { cache: "no-store" });
  if (!res.ok) return new Response("The backup could not be created.", { status: res.status });
  return new Response(res.body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": res.headers.get("content-disposition") ?? 'attachment; filename="socd-portal-backup.json"',
      "Cache-Control": "no-store",
    },
  });
}
