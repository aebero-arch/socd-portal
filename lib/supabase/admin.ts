import { createClient } from "@supabase/supabase-js";

// This client bypasses Row Level Security and should only be used in
// trusted server-side code (Server Actions, Route Handlers).
// NEVER expose the service role key to the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
