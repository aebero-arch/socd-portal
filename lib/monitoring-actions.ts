"use server";

import {
  backendUrl,
  getAuthorizationHeaders,
  getServerToken,
} from "@/lib/api/server";
import { revalidatePath } from "next/cache";
import type { Pap, PapActivity, PapSubmission, PortalRole } from "@/lib/types";

async function getAuthHeaders() {
  const token = await getServerToken();
  if (!token) throw new Error("Unauthorized: No active session.");
  return {
    "Content-Type": "application/json",
    ...getAuthorizationHeaders(token),
  };
}

/** Fetch the logged-in user's personnel record (includes portal_role + office) */
export async function getMyProfile(): Promise<{ portal_role: PortalRole | null; office: string | null; name: string } | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/me`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      portal_role: (data?.portal_role as PortalRole) ?? null,
      office: data?.office ?? null,
      name: data?.name ?? "",
    };
  } catch {
    return null;
  }
}

/** Fetch the logged-in user's role only */
export async function getMyRole(): Promise<PortalRole | null> {
  const profile = await getMyProfile();
  return profile?.portal_role ?? null;
}

/** Fetch all PAPs for the list */
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

/** Fetch a single PAP by ID */
export async function getPap(papId: string): Promise<Pap | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/paps/${papId}`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch monitoring activities (template rows) for a PAP */
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

/**
 * Fetch per-province submissions for a PAP.
 * RSSO/SuperAdmin receive all offices; PSO receives only their own.
 */
export async function getSubmissions(papId: string): Promise<PapSubmission[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/submissions?pap_id=${papId}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Add a new monitoring activity (RSSO/SuperAdmin only) */
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
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Delete an activity template (RSSO/SuperAdmin only). Cascades to all province submissions. */
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
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Create or update a province's submission for one activity.
 * PSO: can only update their own office + PSO fields.
 * RSSO/SuperAdmin: can update any office + all fields.
 */
export async function upsertSubmission(
  activityId: string,
  office: string,
  patch: {
    actual_submission?: string | null;
    pso_remarks?: string | null;
    response_rate?: number | null;
    rsso_remarks?: string | null;
    rating_quantity?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const encodedOffice = encodeURIComponent(office);
    const res = await fetch(`${backendUrl}/api/submissions/${activityId}/${encodedOffice}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to save submission" };
    }
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
