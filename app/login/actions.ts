"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ActionResponse {
  success: boolean;
  error: string | null;
  message: string | null;
}

export async function login(state: ActionResponse | null, formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Email and password are required.", message: null };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { success: false, error: error.message, message: null };
  }

  revalidatePath("/", "layout");
  return { success: true, error: null, message: "Login successful!" };
}

export async function signup(state: ActionResponse | null, formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Email and password are required.", message: null };
  }

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { success: false, error: error.message, message: null };
  }

  return { 
    success: true, 
    error: null, 
    message: "Sign up successful! Please check your email to confirm your account (or try logging in if confirmation is disabled in settings)." 
  };
}
