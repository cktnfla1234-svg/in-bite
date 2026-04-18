import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useRef } from "react";
import { mergeWalletBalanceWithSupabase, upsertClerkProfile } from "./profile";

/**
 * Sync the logged-in Clerk user into Supabase.
 *
 * Requires a Clerk JWT template named "supabase" (or change template name below)
 * and Supabase RLS policies that trust the JWT `sub` claim.
 */
export function SupabaseUserSync() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const didSync = useRef(false);

  useEffect(() => {
    if (!user || didSync.current) return;
    didSync.current = true;

    (async () => {
      const token = await getToken({ template: "supabase" });
      if (!token) {
        // If no template configured yet, do nothing (UI still works).
        return;
      }
      await upsertClerkProfile(user, token);
      await mergeWalletBalanceWithSupabase(user.id, token);
    })().catch(() => {
      // Best-effort sync; avoid blocking app usage on DB config.
      didSync.current = false;
    });
  }, [getToken, user]);

  return null;
}

