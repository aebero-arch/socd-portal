import Link from "next/link";
import { Download } from "lucide-react";
import PageHeader from "@/components/page-header";
import { requireAccess } from "@/lib/access";
import { getJson } from "@/lib/api/server";
import { formatPosted } from "../comms/announcement-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity Log — SOCD Portal" };

type AuditEvent = {
  id: number;
  at: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  ip: string | null;
  detail: string | null;
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "login", label: "Sign-ins" },
  { key: "password", label: "Passwords" },
  { key: "personnel", label: "Staff" },
  { key: "leave", label: "Leave" },
  { key: "pap", label: "PAPs" },
  { key: "backup", label: "Backups" },
];

// Shown in red: failed or refused sign-ins and password attempts.
const WARNING = /^(login\.(failed|blocked|denied)|password\.change_failed)$/;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireAccess("/activity");
  const { action = "" } = await searchParams;
  const filter = FILTERS.some((f) => f.key === action) ? action : "";
  const { data } = await getJson<{ events: AuditEvent[]; failed_sign_ins_24h: number }>(
    `/api/audit-log?limit=300${filter ? `&action=${filter}` : ""}`
  );
  const events = data?.events ?? [];

  return (
    <div>
      <PageHeader
        title="Activity Log"
        actions={
          <a
            href="/activity/backup"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border rounded-md text-ink-700 hover:text-ink hover:bg-ink/5"
          >
            <Download size={13} /> Download backup
          </a>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/activity?action=${f.key}` : "/activity"}
            className={`px-3 py-1 text-xs rounded-full border ${
              f.key === filter ? "bg-ink text-white border-ink" : "border-border text-ink-700 hover:bg-ink/5"
            }`}
          >
            {f.label}
          </Link>
        ))}
        {data && data.failed_sign_ins_24h > 0 && (
          <span className="ml-auto text-xs text-red-700">{data.failed_sign_ins_24h} failed sign-ins in 24 hours</span>
        )}
      </div>

      {!data ? (
        <p className="text-sm text-red-700">The activity log could not be loaded.</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-ink-400">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-400 border-b border-border">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">What</th>
                <th className="px-3 py-2 font-medium">On</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-ink-700">{formatPosted(e.at)}</td>
                  <td className="px-3 py-2">{e.actor_email ?? "—"}</td>
                  <td className={`px-3 py-2 font-mono text-xs ${WARNING.test(e.action) ? "text-red-700" : "text-ink"}`}>
                    {e.action}
                    {e.detail && <div className="font-body text-ink-400 mt-0.5">{e.detail}</div>}
                  </td>
                  <td className="px-3 py-2 text-ink-700 break-all">{e.target ?? ""}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-400">{e.ip ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
