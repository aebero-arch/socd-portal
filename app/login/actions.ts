// "use server";

// import { createClient } from "@/lib/supabase/server";
// import { revalidatePath } from "next/cache";

// interface ActionResponse {
//   success: boolean;
//   error: string | null;
//   message: string | null;
// }

// export async function login(state: ActionResponse | null, formData: FormData): Promise<ActionResponse> {
//   const supabase = await createClient();
//   const email = formData.get("email") as string;
//   const password = formData.get("password") as string;

//   if (!email || !password) {
//     return { success: false, error: "Email and password are required.", message: null };
//   }

//   const { error } = await supabase.auth.signInWithPassword({ email, password });

//   if (error) {
//     return { success: false, error: error.message, message: null };
//   }

//   revalidatePath("/", "layout");
//   return { success: true, error: null, message: "Login successful!" };
// }

// export async function signup(state: ActionResponse | null, formData: FormData): Promise<ActionResponse> {
//   const supabase = await createClient();
//   const email = formData.get("email") as string;
//   const password = formData.get("password") as string;

//   if (!email || !password) {
//     return { success: false, error: "Email and password are required.", message: null };
//   }

//   const { error } = await supabase.auth.signUp({ email, password });

//   if (error) {
//     return { success: false, error: error.message, message: null };
//   }

//   return { 
//     success: true, 
//     error: null, 
//     message: "Sign up successful! Please check your email to confirm your account (or try logging in if confirmation is disabled in settings)." 
//   };
// }


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

export async function signup(
  state: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  // Accounts are created by SuperAdmin only via the personnel management panel.
  // This form tab can be used for access requests or removed from the UI.
  return {
    success: true,
    error: null,
    message:
      "Account registration is managed by the SuperAdmin. Please contact your division administrator to enroll your email address in the portal.",
  };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  revalidatePath("/", "layout");
}
