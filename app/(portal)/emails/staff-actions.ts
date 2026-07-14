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
  const office = (formData.get("office") as Office) || null;
  const areaCode = (formData.get("area_code") as string)?.trim() || "+63";
  let contactNo = (formData.get("contact_no") as string)?.trim() || "";

  // Strip leading 0 and non-digits from contact number
  if (contactNo.startsWith("0")) {
    contactNo = contactNo.substring(1);
  }
  contactNo = contactNo.replace(/\D/g, "");

  // Format phone number e.g., +63 9171234567
  const local_ext = contactNo ? `${areaCode} ${contactNo}` : null;
  
  // Set default status to 'in-office' (since we removed it from the add staff modal)
  const status = "in-office";
  const createAccount = formData.get("create_account") === "on";

  // Since unit is redundant with office/province, set unit = office
  const unit = office || "General";

  if (!name || !email || !role || !office) {
    return { success: false, error: "Name, email, position, and office/province are required.", message: null };
  }

  // Validate contact number length if provided
  if (contactNo && contactNo.length !== 10) {
    return { success: false, error: "Contact number must be a 10-digit mobile number (excluding leading 0).", message: null };
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

export async function updateStaffStatus(id: string, status: "in-office" | "wfh" | "on-leave" | "fieldwork") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("personnel")
    .update({ status })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/emails");
  revalidatePath("/directory");
  return { success: true };
}
