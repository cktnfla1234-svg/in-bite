import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let warnedMissingConfig = false;
const clientCache = new Map<string, SupabaseClient>();

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

  const cacheKey = accessToken?.trim() ? `auth:${accessToken.trim()}` : "anon";
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = createClient(url, anonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
  clientCache.set(cacheKey, client);
  return client;
}
