import { cookies } from "next/headers";

export const backendUrl =
  process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function getServerToken() {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value ?? null;
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
