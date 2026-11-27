"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  backendUrl,
  clientIpHeaders,
  getServerToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/api/server";

interface ActionResponse {
  success: boolean;
  error: string | null;
  /** Where to go after signing in. */
  redirectTo?: string;
}

async function startSession(res: Response): Promise<ActionResponse> {
  const data = await res.json();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, data.access_token, SESSION_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  // A weak password (for example a default one) is changed before anything else.
  return { success: true, error: null, redirectTo: data.password_change_required ? "/account?required=1" : "/" };
}

async function failure(res: Response, fallback: string): Promise<ActionResponse> {
  const err = await res.json().catch(() => null);
  return { success: false, error: typeof err?.detail === "string" ? err.detail : fallback };
}

export async function login(state: ActionResponse | null, formData: FormData): Promise<ActionResponse> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  try {
    const res = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await clientIpHeaders()) },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return failure(res, "Invalid email or password.");
    return startSession(res);
  } catch {
    return { success: false, error: "Unable to connect to server. Please try again later." };
  }
}

export async function loginWithGoogle(idToken: string): Promise<ActionResponse> {
  if (!idToken) {
    return { success: false, error: "Missing Google credential." };
  }

  try {
    const res = await fetch(`${backendUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await clientIpHeaders()) },
      body: JSON.stringify({ id_token: idToken }),
    });
    if (!res.ok) return failure(res, "Google sign-in failed. Please check that your email is in the directory.");
    return startSession(res);
  } catch {
    return { success: false, error: "Unable to connect to server. Please try again later." };
  }
}

export async function logout(): Promise<void> {
  // End the session on the server too, so a copied token stops working.
  const token = await getServerToken();
  if (token) {
    await fetch(`${backendUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...(await clientIpHeaders()) },
    }).catch(() => undefined);
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
}
