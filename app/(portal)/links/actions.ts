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

// Add Link
export async function addLink(state: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const headers = await getAuthHeaders();
    const title = formData.get("title") as string;
    const url = formData.get("url") as string;
    const category = formData.get("category") as string;
    const description = formData.get("description") as string | null;

    const body = { title, url, category, description };

    const res = await fetch(`${backendUrl}/api/links`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || "Failed to add link", message: null };
    }

    revalidatePath("/links");
    return { success: true, error: null, message: "Link added successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred.", message: null };
  }
}

// Edit Link
export async function editLink(id: string, state: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    const headers = await getAuthHeaders();
    const title = formData.get("title") as string;
    const url = formData.get("url") as string;
    const category = formData.get("category") as string;
    const description = formData.get("description") as string | null;

    const body = { title, url, category, description };

    const res = await fetch(`${backendUrl}/api/links/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || "Failed to update link", message: null };
    }

    revalidatePath("/links");
    return { success: true, error: null, message: "Link updated successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred.", message: null };
  }
}

// Delete Link
export async function deleteLink(id: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${backendUrl}/api/links/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.detail || "Failed to delete link" };
    }

    revalidatePath("/links");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
