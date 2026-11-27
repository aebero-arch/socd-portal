import { cookies, headers } from "next/headers";

export const backendUrl =
  process.env.BACKEND_URL || "http://127.0.0.1:8000";

/** The session cookie. HttpOnly: page scripts can't read it, so XSS can't steal it. */
export const SESSION_COOKIE = "access_token";
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 8 * 60 * 60, // 8 hours, matches JWT_HOURS in backend/main.py
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Headers that pass the visitor's IP to the API for sign-in rate limiting.
 * Only sent when INTERNAL_API_KEY is set (the same value on Vercel and Render);
 * the API ignores the IP without the key, so it can't be spoofed.
 */
export async function clientIpHeaders(): Promise<Record<string, string>> {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return {};
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  return ip ? { "X-Internal-Key": key, "X-Client-IP": ip } : {};
}

export async function getServerToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export function getAuthorizationHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchBackend(
  path: string,
  options: RequestInit = {}
) {
  const token = await getServerToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${backendUrl}${path}`, {
    ...options,
    headers,
  });
}

/**
 * GET a backend path and parse the JSON. Never throws: on any failure it
 * returns ok=false and data=null, so several calls can run in parallel safely.
 */
export async function getJson<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetchBackend(path, { cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}
