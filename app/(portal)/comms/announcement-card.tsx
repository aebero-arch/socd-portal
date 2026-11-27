import { ExternalLink, Pin } from "lucide-react";
import type { Announcement } from "@/lib/types";
import { safeHref } from "@/lib/safe-url";

// The API returns times without a zone; they are UTC.
function asUtc(value: string) {
  return /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`;
}

export function formatPosted(value: string) {
  return new Date(asUtc(value)).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function wasEdited(a: Announcement) {
  return new Date(asUtc(a.updated_at)).getTime() - new Date(asUtc(a.created_at)).getTime() > 60_000;
}

export function audienceLabel(audience: string[]) {
  return audience.length === 0 ? "Everyone" : audience.join(", ");
}

// One announcement. `compact` shortens long messages (used on the Dashboard).
export default function AnnouncementCard({
  announcement: a,
  compact = false,
  actions,
}: {
  announcement: Announcement;
  compact?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <article
      className={`bg-surface border rounded-xl p-5 ${
        a.pinned ? "border-accent/40 shadow-[0_2px_16px_-6px_rgba(19,33,59,0.15)]" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {a.pinned && (
              <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded">
                <Pin size={10} /> Pinned
              </span>
            )}
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-400 border border-border px-1.5 py-0.5 rounded">
              For: {audienceLabel(a.audience)}
            </span>
          </div>
          <h3 className="font-display font-semibold text-base text-ink mt-2">{a.title}</h3>
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>

      <p className={`text-sm text-ink mt-2 whitespace-pre-wrap break-words ${compact ? "line-clamp-3" : ""}`}>
        {a.body}
      </p>

      {safeHref(a.link_url) && (
        <a
          href={safeHref(a.link_url)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono text-accent hover:underline break-all"
        >
          <ExternalLink size={12} /> {a.link_url}
        </a>
      )}

      <p className="mt-3 font-mono text-[10px] text-ink-400">
        {a.author_name ? `${a.author_name} · ` : ""}
        {formatPosted(a.created_at)}
        {wasEdited(a) ? " · edited" : ""}
      </p>
    </article>
  );
}
