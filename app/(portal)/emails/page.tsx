import { createClient } from "@/lib/supabase/server";
import type { StaffMember } from "@/lib/types";
import EmailDirectoryClient from "./email-directory-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email Directory — SOCD Portal",
  description: "Contact directory for PSA Region XI staff, organized by office and province",
};

export default async function EmailDirectoryPage() {
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
          06 — Email Directory
        </p>
        <h1 className="font-display font-semibold text-2xl mt-1">
          Contact Directory
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          {staff.length} staff across PSA Region XI — click any email to copy
        </p>
      </div>

      <EmailDirectoryClient staff={staff} />
    </div>
  );
}
