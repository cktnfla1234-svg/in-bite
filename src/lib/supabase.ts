import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let warnedMissingConfig = false;
let cachedClient: SupabaseClient | null = null;
let currentAccessToken: string | null = null;

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && anonKey);
}

/**
 * Supabase browser client. Returns `null` when env is missing so the UI keeps working
 * (local invites / localStorage paths). Logged once per session in the browser.
 */
export function getSupabaseClient(accessToken?: string): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    if (typeof window !== "undefined" && !warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "[In-Bite] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing — server sync and remote data are disabled. Set them in Vercel → Project → Settings → Environment Variables.",
      );
    }
    return null;
  }

  currentAccessToken = accessToken?.trim() || null;

  if (!cachedClient) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        // Clerk handles user auth, so we do not need Supabase auth persistence.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      accessToken: async () => currentAccessToken,
    });
  }

  return cachedClient;
}
