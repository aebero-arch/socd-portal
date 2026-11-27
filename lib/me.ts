import { cache } from "react";
import { fetchBackend, getServerToken } from "@/lib/api/server";
import type { PortalRole } from "@/lib/types";

export type Me = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  office: string | null;
  portal_role: PortalRole | null;
};

export type MeResult = {
  /** HTTP status from /api/me: 200 signed in, 401 no or expired session, 403 not in the directory, 0 unreachable. */
  status: number;
  me: Me | null;
};

/**
 * The signed-in user, fetched at most once per page load.
 * The layout, sidebar, top bar and page all call this; React's cache() makes them
 * share one request to /api/me instead of each making its own.
 */
export const getMeResult = cache(async (): Promise<MeResult> => {
  const token = await getServerToken();
  if (!token) return { status: 401, me: null };
  try {
    const res = await fetchBackend("/api/me", { cache: "no-store" });
    return { status: res.status, me: res.ok ? ((await res.json()) as Me) : null };
  } catch {
    return { status: 0, me: null };
  }
});

export async function getMe(): Promise<Me | null> {
  return (await getMeResult()).me;
}
