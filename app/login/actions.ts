"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { backendUrl } from "@/lib/api/server";

interface ActionResponse {
  success: boolean;
  error: string | null;
  message: string | null;
}

export async function login(
  state: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Email and password are required.", message: null };
  }

  try {
    const res = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      return {
        success: false,
        error: err.detail || "Invalid email or password.",
        message: null,
      };
    }

    const data = await res.json();

    // Store JWT in cookie — accessible by both server and client components
    const cookieStore = await cookies();
    cookieStore.set("access_token", data.access_token, {
      path: "/",
      maxAge: 8 * 60 * 60, // 8 hours, matches JWT_HOURS in backend
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/", "layout");
    return { success: true, error: null, message: "Login successful!" };

  } catch {
    return {
      success: false,
      error: "Unable to connect to server. Please try again later.",
      message: null,
    };
  }
}


export async function loginWithGoogle(idToken: string): Promise<ActionResponse> {
  if (!idToken) {
    return { success: false, error: "Missing Google credential.", message: null };
  }

  try {
    const res = await fetch(`${backendUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Google sign-in failed" }));
      return {
        success: false,
        error: err.detail || "Google sign-in failed. Please verify your email is registered in the directory.",
        message: null,
      };
    }

    const data = await res.json();
    const cookieStore = await cookies();
    cookieStore.set("access_token", data.access_token, {
      path: "/",
      maxAge: 8 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/", "layout");
    return { success: true, error: null, message: "Google sign-in successful!" };
  } catch {
    return {
      success: false,
      error: "Unable to connect to server. Please try again later.",
      message: null,
    };
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  revalidatePath("/", "layout");
}
