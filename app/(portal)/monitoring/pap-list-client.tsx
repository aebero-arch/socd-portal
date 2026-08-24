"use client";

import Link from "next/link";
import { ArrowRight, FileBarChart, Clock } from "lucide-react";
import type { Pap } from "@/lib/types";

interface Props {
  paps: Pap[];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export default function PapListClient({ paps }: Props) {
  if (paps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileBarChart size={40} className="text-ink-400/30 mb-4" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-400/50">
          No PAPs configured
        </p>
        <p className="text-xs text-ink-400/40 mt-1">
          Add Programs, Activities, and Projects in PAP Configuration first.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {paps.map((pap) => (
        <Link
          key={pap.id}
          href={`/monitoring/${pap.id}`}
          className="group relative bg-surface border border-border rounded-xl p-5 hover:border-accent/40 hover:shadow-[0_4px_20px_-4px_rgba(19,33,59,0.12)] transition-all duration-200 flex flex-col gap-3"
        >
          {/* Icon + arrow */}
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-accent/8 text-accent flex items-center justify-center shrink-0">
              <FileBarChart size={18} />
            </div>
            <ArrowRight
              size={16}
              className="text-ink-400/40 group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-200 mt-1"
            />
          </div>

          {/* PAP name */}
          <div className="flex-1">
            <h2 className="font-display font-semibold text-sm text-ink leading-snug line-clamp-3">
              {pap.name}
            </h2>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-ink-400/60">
            <Clock size={11} />
            <span>Added {fmtDate(pap.created_at)}</span>
          </div>

          {/* Hover accent bar */}
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent rounded-b-xl scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
        </Link>
      ))}
    </div>
  );
}
