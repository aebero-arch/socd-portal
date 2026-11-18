"use client";

import { useRouter } from "next/navigation";

// Year dropdown that reloads the current page for the chosen year (?year=YYYY).
export default function YearSelect({
  years,
  value,
  basePath,
}: {
  years: number[];
  value: number;
  basePath: string;
}) {
  const router = useRouter();
  const options = Array.from(new Set([...years, value])).sort((a, b) => b - a);

  return (
    <label className="inline-flex items-center gap-2 text-xs font-mono text-ink-400">
      Year
      <select
        value={value}
        onChange={(e) => router.push(`${basePath}?year=${e.target.value}`)}
        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20"
      >
        {options.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
