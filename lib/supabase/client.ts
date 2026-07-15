// import { createBrowserClient } from "@supabase/ssr";

// export function createClient() {
//   return createBrowserClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//   );
// }



const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.130.2:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return document.cookie.match(/access_token=([^;]+)/)?.[1] || localStorage.getItem("access_token") || null;
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token);
  // Also store in cookie so server components can read it
  document.cookie = `access_token=${token}; path=/; max-age=${8 * 60 * 60}; SameSite=Lax`;
}

export function clearToken() {
  localStorage.removeItem("access_token");
  document.cookie = "access_token=; path=/; max-age=0";
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
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

export async function login(email: string, password: string) {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data; // { access_token, token_type, user }
}

export function logout() {
  clearToken();
  window.location.href = "/login";
}

// Keep createClient() signature for compatibility with existing imports
export function createClient() {
  return { apiFetch, login, logout, getToken };
}