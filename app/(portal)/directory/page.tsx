import PersonnelCard from "@/components/personnel-card";
import type { StaffMember } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("personnel").select("*").order("name");
  const staff: StaffMember[] = (data || []) as StaffMember[];

  const units = Array.from(new Set(staff.map((s) => s.unit)));
  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            01 — Directory
          </p>
          <h1 className="font-display font-semibold text-2xl mt-1">
            Personnel Directory
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            {staff.length} staff across {units.length} units
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {units.map((u) => (
            <span
              key={u}
              className="font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border border-border text-ink-400"
            >
              {u}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map((s) => (
          <PersonnelCard key={s.id} staff={s} />
        ))}
      </div>
    </div>
  );
}
