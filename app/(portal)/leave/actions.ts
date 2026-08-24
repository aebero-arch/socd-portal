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

// Add Leave / Schedule Request
export async function addLeave(state: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const headers = await getAuthHeaders();
    const staff_id = formData.get("staff_id") as string;
    const start_date = formData.get("start_date") as string;
    const end_date = formData.get("end_date") as string;
    const leave_type = formData.get("leave_type") as string;
    const remarks = formData.get("remarks") as string | null;

    const body = { staff_id, start_date, end_date, leave_type, remarks };

    const res = await fetch(`${backendUrl}/api/leaves`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || "Failed to submit request", message: null };
    }

    revalidatePath("/leave");
    revalidatePath("/directory");
    revalidatePath("/");
    return { success: true, error: null, message: "Leave/Schedule logged successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred.", message: null };
  }
}

// Update Leave Status (Approve / Deny)
export async function updateLeaveStatus(id: string, status: "approved" | "denied") {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/leaves/${id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to update status" };
    }

    revalidatePath("/leave");
    revalidatePath("/directory");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

// Delete Leave Request
export async function deleteLeave(id: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/leaves/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to cancel request" };
    }

    revalidatePath("/leave");
    revalidatePath("/directory");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
