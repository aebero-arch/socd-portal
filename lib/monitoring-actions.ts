"use server";

import {
  backendUrl,
  getAuthorizationHeaders,
  getServerToken,
} from "@/lib/api/server";
import { revalidatePath } from "next/cache";
import type { Pap, PapActivity, PortalRole } from "@/lib/types";

async function getAuthHeaders() {
  const token = await getServerToken();
  if (!token) throw new Error("Unauthorized: No active session.");
  return {
    "Content-Type": "application/json",
    ...getAuthorizationHeaders(token),
  };
}

/** Fetch the logged-in user's personnel record (includes portal_role) */
export async function getMyRole(): Promise<PortalRole | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/me`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.portal_role as PortalRole) ?? null;
  } catch {
    return null;
  }
}

/** Fetch all PAPs for the dropdown */
export async function getPaps(): Promise<Pap[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/paps`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Fetch monitoring activities with optional filters */
export async function getActivities(
  papId?: string,
  quarter?: string,
  month?: string
): Promise<PapActivity[]> {
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (papId) params.set("pap_id", papId);
    if (quarter) params.set("quarter", quarter);
    if (month) params.set("month", month);
    const url = `${backendUrl}/api/monitoring${params.toString() ? "?" + params : ""}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Add a new monitoring activity (RSSO only) */
export async function addActivity(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const body = {
      pap_id: formData.get("pap_id") as string,
      activity_type: formData.get("activity_type") as string,
      quarter: formData.get("quarter") || null,
      month: formData.get("month") || null,
      output_deliverable: formData.get("output_deliverable") as string,
      deadline: formData.get("deadline") as string,
      response_rate_fillable: formData.get("response_rate_fillable") === "on",
    };
    const res = await fetch(`${backendUrl}/api/monitoring`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to add activity" };
    }
    revalidatePath("/monitoring");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Partial update for an activity (submission, remarks, response rate) */
export async function patchActivity(
  id: string,
  patch: {
    actual_submission?: string | null;
    rsso_remarks?: string | null;
    pso_remarks?: string | null;
    response_rate?: number | null;
    rating_quantity?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/monitoring/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to update activity" };
    }
    revalidatePath("/monitoring");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Delete an activity (RSSO only) */
export async function deleteActivity(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/monitoring/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to delete activity" };
    }
    revalidatePath("/monitoring");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
