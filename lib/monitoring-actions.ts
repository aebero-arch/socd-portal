"use server";

import {
  backendUrl,
  getAuthorizationHeaders,
  getServerToken,
} from "@/lib/api/server";
import { revalidatePath } from "next/cache";
import type { Pap, PapActivity, PapSubmission, PapYears, PortalRole } from "@/lib/types";
import { getMe } from "@/lib/me";

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
  // Uses the page load's shared /api/me result instead of a new request.
  const me = await getMe();
  if (!me) return null;
  return { portal_role: me.portal_role ?? null, office: me.office ?? null, name: me.name ?? "" };
}

/** Fetch the logged-in user's role only */
export async function getMyRole(): Promise<PortalRole | null> {
  const profile = await getMyProfile();
  return profile?.portal_role ?? null;
}

/** Years that have PAPs, plus the current and default year */
export async function getPapYears(): Promise<PapYears> {
  const thisYear = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4));
  const fallback: PapYears = { years: [], current_year: thisYear, default_year: thisYear };
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/pap-years`, { headers, cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

/**
 * One request for a year page: year info plus that year's PAPs.
 * Without a year, the API picks the default one.
 */
export async function getPapsOverview(year?: number): Promise<PapYears & { year: number; paps: Pap[] }> {
  const thisYear = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4));
  const fallback = { years: [], current_year: thisYear, default_year: thisYear, year: year ?? thisYear, paps: [] };
  try {
    const headers = await getAuthHeaders();
    const query = year ? `?year=${year}` : "";
    const res = await fetch(`${backendUrl}/api/paps/overview${query}`, { headers, cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

/** Fetch PAPs for the list; pass a year to get only that year's PAPs */
export async function getPaps(year?: number): Promise<Pap[]> {
  try {
    const headers = await getAuthHeaders();
    const query = year ? `?year=${year}` : "";
    const res = await fetch(`${backendUrl}/api/paps${query}`, { headers, cache: "no-store" });
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
