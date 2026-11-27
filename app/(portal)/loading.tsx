// Shown immediately when moving between portal pages, while the next page loads.
// The sidebar and top bar stay in place; only the main area shows this placeholder.
export default function PortalLoading() {
  return (
    <div className="animate-pulse" role="status" aria-live="polite" aria-label="Loading">
      <div className="h-3 w-28 rounded bg-ink/10" />
      <div className="mt-3 h-7 w-72 max-w-full rounded bg-ink/10" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-ink/[0.07]" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-border bg-surface" />
        ))}
      </div>

      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg border border-border bg-surface" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
