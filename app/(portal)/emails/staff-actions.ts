"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Office } from "@/lib/types";

export interface AddStaffState {
  success: boolean;
  error: string | null;
  message: string | null;
}

export async function addStaff(
  state: AddStaffState | null,
  formData: FormData
): Promise<AddStaffState> {
  // Verify the caller is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in to add staff.", message: null };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = (formData.get("role") as string)?.trim();
  const unit = (formData.get("unit") as string)?.trim();
  const office = (formData.get("office") as Office) || null;
  const local_ext = (formData.get("local_ext") as string)?.trim() || null;
  const status = (formData.get("status") as string) || "in-office";
  const createAccount = formData.get("create_account") === "on";

  if (!name || !email || !role || !unit) {
    return { success: false, error: "Name, email, position, and unit are required.", message: null };
  }

  const admin = createAdminClient();

  // Insert into personnel table using the admin client (bypasses RLS)
  const { error: insertError } = await admin
    .from("personnel")
    .insert({ name, email, role, unit, office, local_ext, status });

  if (insertError) {
    if (insertError.code === "23505") {
      return { success: false, error: "A staff member with this email already exists.", message: null };
    }
    return { success: false, error: `Failed to add staff: ${insertError.message}`, message: null };
  }

  // Optionally invite the user so they can log in to the portal
  if (createAccount) {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
    });

    if (inviteError) {
      // Personnel was added but invite failed — non-fatal, let the user know
      revalidatePath("/emails");
      revalidatePath("/directory");
      return {
        success: true,
        error: null,
        message: `${name} was added to the directory, but the invite email failed: ${inviteError.message}. You can retry from Supabase Auth settings.`,
      };
    }

    revalidatePath("/emails");
    revalidatePath("/directory");
    return {
      success: true,
      error: null,
      message: `${name} has been added and an invitation email has been sent to ${email}.`,
    };
  }

  revalidatePath("/emails");
  revalidatePath("/directory");
  return {
    success: true,
    error: null,
    message: `${name} has been added to the directory.`,
  };
}
