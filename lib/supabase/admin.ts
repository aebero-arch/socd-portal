// import { createClient } from "@supabase/supabase-js";

// // This client bypasses Row Level Security and should only be used in
// // trusted server-side code (Server Actions, Route Handlers).
// // NEVER expose the service role key to the browser.
// export function createAdminClient() {
//   return createClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.SUPABASE_SERVICE_ROLE_KEY!,
//     {
//       auth: {
//         autoRefreshToken: false,
//         persistSession: false,
//       },
//     }
//   );
// }



import { cookies } from "next/headers";

const API_URL_ADMIN =
  process.env.NEXT_PUBLIC_API_URL || "http://192.168.130.2:8000";

export async function createAdminClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  async function apiFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_URL_ADMIN}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Request failed");
    }
    return res.json();
  }

  return {
    apiFetch,
    // Helper: set password for a user (SuperAdmin only)
    async setPassword(email: string, password: string) {
      return apiFetch("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    // Helper: get all personnel
    async getPersonnel() {
      return apiFetch("/api/personnel");
    },
  };
}