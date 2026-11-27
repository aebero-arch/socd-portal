/**
 * A link that came from the database, safe to put in href: http(s) and mailto
 * only. Anything else (javascript:, data:, …) becomes undefined, so the link
 * renders as plain text instead of running script. The API also rejects such
 * links when they are saved; this covers rows saved before that check existed.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const value = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(value) ? value : undefined;
}
