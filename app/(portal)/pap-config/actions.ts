"use server";

import { backendUrl, getAuthorizationHeaders, getServerToken } from "@/lib/api/server";
import { revalidatePath } from "next/cache";
import type { Pap, PapActivity, ActivityType } from "@/lib/types";

async function getAuthHeaders() {
  const token = await getServerToken();
  if (!token) throw new Error("Unauthorized: No active session.");
  return {
    "Content-Type": "application/json",
    ...getAuthorizationHeaders(token),
  };
}

export interface ActivityTemplateItem {
  activity_type: ActivityType;
  quarter?: string | null;
  month?: string | null;
  output_deliverable: string;
  deadline: string;
  response_rate_fillable: boolean;
}

export interface CreatePapPayload {
  name: string;
  outputs: ActivityTemplateItem[];
}

export interface AddActivityPayload {
  pap_id: string;
  activity_type: ActivityType;
  quarter?: string | null;
  month?: string | null;
  output_deliverable: string;
  deadline: string;
  response_rate_fillable: boolean;
}

export interface UpdateActivityPayload {
  activity_type?: ActivityType;
  quarter?: string | null;
  month?: string | null;
  output_deliverable?: string;
  deadline?: string;
  response_rate_fillable?: boolean;
}

export async function createPap(
  payload: CreatePapPayload
): Promise<{ success: boolean; error?: string; data?: Pap }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/paps`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.detail || "Failed to create PAP" };
    revalidatePath("/pap-config");
    revalidatePath("/monitoring");
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true, data: data.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updatePap(
  id: string,
  name: string
): Promise<{ success: boolean; error?: string; data?: Pap }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/paps/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.detail || "Failed to update PAP" };
    revalidatePath("/pap-config");
    revalidatePath("/monitoring");
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true, data: data.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletePap(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/paps/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to delete PAP" };
    }
    revalidatePath("/pap-config");
    revalidatePath("/monitoring");
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addActivityToPap(
  payload: AddActivityPayload
): Promise<{ success: boolean; error?: string; data?: PapActivity }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/monitoring`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.detail || "Failed to add activity" };
    revalidatePath("/pap-config");
    revalidatePath("/monitoring");
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true, data: data.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addActivitiesBulk(
  papId: string,
  activities: ActivityTemplateItem[]
): Promise<{ success: boolean; error?: string; count?: number; data?: PapActivity[] }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/monitoring/bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({ pap_id: papId, activities }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.detail || "Failed to import activities" };
    revalidatePath("/pap-config");
    revalidatePath("/monitoring");
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true, count: data.count, data: data.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateActivity(
  id: string,
  patch: UpdateActivityPayload
): Promise<{ success: boolean; error?: string; data?: PapActivity }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/monitoring/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.detail || "Failed to update activity" };
    revalidatePath("/pap-config");
    revalidatePath("/monitoring");
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true, data: data.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

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
    revalidatePath("/pap-config");
    revalidatePath("/monitoring");
    revalidatePath("/monitoring/[papId]", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface PapWithDetails extends Pap {
  activities: PapActivity[];
}

export async function getPapsWithActivities(): Promise<PapWithDetails[]> {
  try {
    const headers = await getAuthHeaders();
    const [papsRes, monRes] = await Promise.all([
      fetch(`${backendUrl}/api/paps`, { headers, cache: "no-store" }),
      fetch(`${backendUrl}/api/monitoring`, { headers, cache: "no-store" }),
    ]);
    const paps: Pap[] = papsRes.ok ? await papsRes.json() : [];
    const activities: PapActivity[] = monRes.ok ? await monRes.json() : [];

    return paps.map((p) => ({
      ...p,
      activities: activities.filter((a) => a.pap_id === p.id),
    }));
  } catch {
    return [];
  }
}
