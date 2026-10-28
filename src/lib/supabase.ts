import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;

// Read the address bar BEFORE the client below processes (and clears) it, so the
// app knows the visitor arrived from a "reset your password" email link.
const startHash = typeof window !== "undefined" ? window.location.hash : "";
const startQuery = typeof window !== "undefined" ? window.location.search : "";
const hashParams = new URLSearchParams(startHash.replace(/^#/, ""));
const queryParams = new URLSearchParams(startQuery);
/** "recovery" when opened from a reset email, "expired" when that link no longer works. */
export const RESET_LINK: "recovery" | "expired" | null =
  hashParams.get("type") === "recovery" ? "recovery"
  : (hashParams.get("error_code") ?? queryParams.get("error_code") ?? "").match(/otp_expired|access_denied/) ? "expired"
  : null;
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
