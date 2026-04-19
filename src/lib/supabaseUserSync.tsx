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
  /** Last Clerk user id we successfully synced to Supabase (profile row exists server-side). */
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      syncedUserId.current = null;
      return;
    }
    if (syncedUserId.current === user.id) return;

    let cancelled = false;
    void (async () => {
      const token = await getToken({ template: "supabase" });
      if (!token) {
        // Token can arrive after first paint — retry on the next effect run.
        return;
      }
      try {
        await upsertClerkProfile(user, token);
        if (cancelled) return;
        await mergeWalletBalanceWithSupabase(user.id, token);
        if (cancelled) return;
        syncedUserId.current = user.id;
      } catch {
        // Best-effort sync; allow retry after Clerk/Supabase config fixes.
        syncedUserId.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, user]);

  return null;
}

