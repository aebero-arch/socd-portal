// import { createServerClient } from "@supabase/ssr";
// import { cookies } from "next/headers";

// export async function createClient() {
//   const cookieStore = await cookies();

//   return createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll() {
//           return cookieStore.getAll();
//         },
//         setAll(cookiesToSet) {
//           try {
//             cookiesToSet.forEach(({ name, value, options }) =>
//               cookieStore.set(name, value, options)
//             );
//           } catch {
//             // The `setAll` method can be called from a Server Component,
//             // which cannot set cookies. This can be ignored if you have
//             // middleware refreshing user sessions.
//           }
//         },
//       },
//     }
//   );
// }


import { cookies } from "next/headers";

const API_URL_SERVER =
  process.env.NEXT_PUBLIC_API_URL || "http://192.168.130.2:8000";

export async function createClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  async function apiFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_URL_SERVER}${path}`, {
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
    getToken: () => token,
    // Helper: get current user from /api/me
    async getUser() {
      if (!token) return { data: { user: null }, error: "No token" };
      try {
        const user = await apiFetch("/api/me");
        return { data: { user }, error: null };
      } catch (e: any) {
        return { data: { user: null }, error: e.message };
      }
    },
  };
}