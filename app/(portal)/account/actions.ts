"use server";

import { cookies } from "next/headers";
import { backendUrl, clientIpHeaders, getServerToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/api/server";

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const token = await getServerToken();
  if (!token) return { success: false, error: "Your session has ended. Please sign in again." };
  try {
    const res = await fetch(`${backendUrl}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(await clientIpHeaders()) },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { success: false, error: typeof data?.detail === "string" ? data.detail : "Could not change the password." };
    // Other sessions were signed out; this browser gets a fresh token.
    if (data?.access_token) (await cookies()).set(SESSION_COOKIE, data.access_token, SESSION_COOKIE_OPTIONS);
    return { success: true };
  } catch {
    return { success: false, error: "Unable to connect to server. Please try again later." };
  }
}
