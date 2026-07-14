"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const BACKEND_URL = "http://127.0.0.1:8000";

export interface ActionState {
  success: boolean;
  error: string | null;
  message: string | null;
}

// Helper to get authenticated headers
async function getAuthHeaders() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Unauthorized: No active session found.");
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.access_token}`,
  };
}

// 1. Add Staff Member
export async function addStaff(state: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const headers = await getAuthHeaders();
    const createAccount = formData.get("create_account") === "on";

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const office = formData.get("office") as string;
    const areaCode = formData.get("area_code") as string;
    let contactNo = formData.get("contact_no") as string;

    if (contactNo.startsWith("0")) {
      contactNo = contactNo.substring(1);
    }
    contactNo = contactNo.replace(/\D/g, "");
    const local_ext = contactNo ? `${areaCode} ${contactNo}` : null;

    const body = { name, email, role, office, local_ext };

    const res = await fetch(`${BACKEND_URL}/api/personnel?create_account=${createAccount}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || "Failed to add staff member", message: null };
    }

    revalidatePath("/directory");
    return { success: true, error: null, message: "Staff member added successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred.", message: null };
  }
}

// 2. Edit Staff Member
export async function editStaff(id: string, state: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const headers = await getAuthHeaders();

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const office = formData.get("office") as string;
    const areaCode = formData.get("area_code") as string;
    let contactNo = formData.get("contact_no") as string;

    if (contactNo.startsWith("0")) {
      contactNo = contactNo.substring(1);
    }
    contactNo = contactNo.replace(/\D/g, "");
    const local_ext = contactNo ? `${areaCode} ${contactNo}` : null;

    const body = { name, email, role, office, local_ext };

    const res = await fetch(`${BACKEND_URL}/api/personnel/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || "Failed to update staff member", message: null };
    }

    revalidatePath("/directory");
    return { success: true, error: null, message: "Staff member updated successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred.", message: null };
  }
}

// 3. Delete Staff Member
export async function deleteStaff(id: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/personnel/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to delete staff member" };
    }

    revalidatePath("/directory");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

// 4. Update Status In-Table
export async function updateStaffStatus(id: string, status: "in-office" | "wfh" | "on-leave" | "fieldwork") {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/personnel/${id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to update status" };
    }

    revalidatePath("/directory");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
