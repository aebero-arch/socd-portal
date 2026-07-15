"use server";

import {
  backendUrl,
  getAuthorizationHeaders,
  getServerToken,
} from "@/lib/api/server";
import { revalidatePath } from "next/cache";

export interface ActionState {
  success: boolean;
  error: string | null;
  message: string | null;
}

// Helper to get authenticated headers
async function getAuthHeaders() {
  const token = await getServerToken();
  if (!token) {
    throw new Error("Unauthorized: No active session found.");
  }
  return {
    "Content-Type": "application/json",
    ...getAuthorizationHeaders(token),
  };
}

// 1. Add Staff Member
export async function addStaff(state: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const headers = await getAuthHeaders();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const office = formData.get("office") as string;
    const portal_role = formData.get("portal_role") as string | null;
    const areaCode = formData.get("area_code") as string;
    let contactNo = formData.get("contact_no") as string;

    if (contactNo.startsWith("0")) {
      contactNo = contactNo.substring(1);
    }
    contactNo = contactNo.replace(/\D/g, "");
    const local_ext = contactNo ? `${areaCode} ${contactNo}` : null;

    const body = { name, email, role, office, local_ext, portal_role };

    const res = await fetch(`${backendUrl}/api/personnel`, {
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
    const portal_role = formData.get("portal_role") as string | null;
    const areaCode = formData.get("area_code") as string;
    let contactNo = formData.get("contact_no") as string;

    if (contactNo.startsWith("0")) {
      contactNo = contactNo.substring(1);
    }
    contactNo = contactNo.replace(/\D/g, "");
    const local_ext = contactNo ? `${areaCode} ${contactNo}` : null;

    const body = { name, email, role, office, local_ext, portal_role };

    const res = await fetch(`${backendUrl}/api/personnel/${id}`, {
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
    const res = await fetch(`${backendUrl}/api/personnel/${id}`, {
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
    const res = await fetch(`${backendUrl}/api/personnel/${id}/status`, {
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
