"use server";

import { backendUrl, getAuthorizationHeaders, getServerToken } from "@/lib/api/server";
import { revalidatePath } from "next/cache";
import type { Announcement, AnnouncementInput } from "@/lib/types";

async function getAuthHeaders() {
  const token = await getServerToken();
  if (!token) throw new Error("Unauthorized: No active session.");
  return {
    "Content-Type": "application/json",
    ...getAuthorizationHeaders(token),
  };
}

type Result = { success: boolean; error?: string; data?: Announcement };

/** Create an announcement (id null) or update an existing one. SuperAdmin/RSSO only. */
export async function saveAnnouncement(id: string | null, input: AnnouncementInput): Promise<Result> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/announcements${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers,
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.detail || "Could not save the announcement." };
    revalidatePath("/comms");
    revalidatePath("/");
    return { success: true, data: data.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/announcements/${id}`, { method: "DELETE", headers });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.detail || "Could not delete the announcement." };
    revalidatePath("/comms");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
