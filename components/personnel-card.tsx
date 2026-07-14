import { Mail, Phone } from "lucide-react";
import type { StaffMember } from "@/lib/types";

const statusStyles: Record<StaffMember["status"], { label: string; dot: string; text: string }> = {
  "in-office": { label: "In office", dot: "bg-accent", text: "text-accent-600" },
  wfh: { label: "WFH", dot: "bg-warm", text: "text-warm" },
  "on-leave": { label: "On leave", dot: "bg-ink-400", text: "text-ink-400" },
  fieldwork: { label: "Fieldwork", dot: "bg-[#4C7CE0]", text: "text-[#4C7CE0]" },
};

export default function PersonnelCard({ staff }: { staff: StaffMember }) {
  const status = statusStyles[staff.status];
  const initials = staff.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="tick-corners bg-surface border border-border rounded-lg p-5 hover:shadow-[0_2px_16px_-4px_rgba(19,33,59,0.12)] hover:border-accent/30 transition-all">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-full bg-ink-50 text-ink-700 flex items-center justify-center font-display font-semibold text-sm">
          {initials}
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${status.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </div>
      </div>

      <h3 className="font-display font-semibold text-[15px] mt-3 leading-tight">
        {staff.name}
      </h3>
      <p className="text-sm text-ink-400 mt-0.5">{staff.role}</p>
      <p className="font-mono text-[10px] uppercase tracking-wide text-accent mt-2">
        {staff.unit}
      </p>

      <div className="mt-4 pt-4 border-t border-border space-y-1.5">
        <a
          href={`mailto:${staff.email}`}
          className="flex items-center gap-2 text-xs text-ink-400 hover:text-accent transition-colors"
        >
          <Mail size={13} />
          <span className="truncate">{staff.email}</span>
        </a>
        {staff.local_ext && (
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <Phone size={13} />
            <span className="font-mono">local {staff.local_ext}</span>
          </div>
        )}
      </div>
    </div>
  );
}
