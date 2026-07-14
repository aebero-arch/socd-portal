import { createBrowserClient } from "@supabase/ssr";

// These come from your Supabase project settings (Project Settings > API).
// Add them to a .env.local file — see .env.local.example.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
