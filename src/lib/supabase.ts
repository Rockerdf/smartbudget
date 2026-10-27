import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when the .env values are missing; main.tsx then shows a setup message instead of a blank page. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// The anon key is designed to be public: it only works within the Row Level
// Security rules defined in supabase/schema.sql. Never put the service_role key here.
export const supabase = createClient(
  url || "https://not-configured.invalid",
  anonKey || "not-configured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
