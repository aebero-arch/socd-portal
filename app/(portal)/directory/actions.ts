"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Office } from "@/lib/types";

export interface ActionState {
  success: boolean;
  error: string | null;
  message: string | null;
}

// 1. Add Staff Member
export async function addStaff(state: ActionState | null, formData: FormData): Promise<ActionState> {
  // Verify user is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "You must be logged in to add staff.", message: null };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = (formData.get("role") as string)?.trim();
  const office = (formData.get("office") as Office) || null;
  const areaCode = (formData.get("area_code") as string)?.trim() || "+63";
  let contactNo = (formData.get("contact_no") as string)?.trim() || "";

  if (contactNo.startsWith("0")) {
    contactNo = contactNo.substring(1);
  }
  contactNo = contactNo.replace(/\D/g, "");

  const local_ext = contactNo ? `${areaCode} ${contactNo}` : null;
  const status = "in-office"; // default status
  const createAccount = formData.get("create_account") === "on";

  // Since unit is redundant, we set unit = office (provinces/division)
  const unit = office || "General";

  if (!name || !email || !role || !office) {
    return { success: false, error: "Name, email, position, and office/province are required.", message: null };
  }

  if (contactNo && contactNo.length !== 10) {
    return { success: false, error: "Contact number must be a 10-digit mobile number.", message: null };
  }

  const admin = createAdminClient();

  // Insert personnel record using admin client (bypasses RLS write restriction)
  const { error: insertError } = await admin
    .from("personnel")
    .insert({ name, email, role, unit, office, local_ext, status });

  if (insertError) {
    if (insertError.code === "23505") {
      return { success: false, error: "A staff member with this email already exists.", message: null };
    }
    return { success: false, error: `Failed to add staff: ${insertError.message}`, message: null };
  }

  // Invite the user to the portal
  if (createAccount) {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
    });

    if (inviteError) {
      revalidatePath("/directory");
      return {
        success: true,
        error: null,
        message: `${name} was added to the directory, but the portal registration email failed: ${inviteError.message}. You can retry from Supabase.`,
      };
    }

    revalidatePath("/directory");
    return {
      success: true,
      error: null,
      message: `${name} has been added and a registration invitation email has been sent to ${email}.`,
    };
  }

  revalidatePath("/directory");
  return {
    success: true,
    error: null,
    message: `${name} has been added to the directory.`,
  };
}

// 2. Edit Staff Member
export async function editStaff(id: string, state: ActionState | null, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "You must be logged in to edit staff.", message: null };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = (formData.get("role") as string)?.trim();
  const office = (formData.get("office") as Office) || null;
  const areaCode = (formData.get("area_code") as string)?.trim() || "+63";
  let contactNo = (formData.get("contact_no") as string)?.trim() || "";

  if (contactNo.startsWith("0")) {
    contactNo = contactNo.substring(1);
  }
  contactNo = contactNo.replace(/\D/g, "");

  const local_ext = contactNo ? `${areaCode} ${contactNo}` : null;
  const unit = office || "General";

  if (!name || !email || !role || !office) {
    return { success: false, error: "Name, email, position, and office/province are required.", message: null };
  }

  if (contactNo && contactNo.length !== 10) {
    return { success: false, error: "Contact number must be a 10-digit mobile number.", message: null };
  }

  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("personnel")
    .update({ name, email, role, unit, office, local_ext })
    .eq("id", id);

  if (updateError) {
    return { success: false, error: `Failed to update staff: ${updateError.message}`, message: null };
  }

  revalidatePath("/directory");
  return { success: true, error: null, message: "Staff member updated successfully!" };
}

// 3. Delete Staff Member
export async function deleteStaff(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("personnel").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/directory");
  return { success: true };
}

// 4. Update Status In-Table
export async function updateStaffStatus(id: string, status: "in-office" | "wfh" | "on-leave" | "fieldwork"): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("personnel").update({ status }).eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/directory");
  return { success: true };
}
