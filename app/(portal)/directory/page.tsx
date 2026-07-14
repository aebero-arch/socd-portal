import { createClient } from "@/lib/supabase/server";
import type { StaffMember } from "@/lib/types";
import PersonnelDirectoryClient from "./personnel-directory-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Personnel Directory — SOCD Portal",
  description: "Internal database of PSA Region XI personnel",
};

export default async function DirectoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("personnel")
    .select("*")
    .order("office")
    .order("name");

  const staff: StaffMember[] = (data || []) as StaffMember[];

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          01 — Directory
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">
          Personnel Directory
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Internal directory of PSA Region XI staff — add, edit, or manage personnel details.
        </p>
      </div>

      <PersonnelDirectoryClient staff={staff} />
    </div>
  );
}
