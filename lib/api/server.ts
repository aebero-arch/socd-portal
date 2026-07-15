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
