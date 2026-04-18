import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { applyBiteDeltaServer } from "./profile";
import { getWalletBalance, setWalletBalance, setWelcomeGrantedFlag } from "./wallet";

type ApplyBiteDetail = {
  clerkId: string;
  delta: number;
  kind: string;
  meta?: Record<string, unknown>;
};

/**
 * Applies signed-in BITE deltas through Supabase (RPC + bites_history) and syncs local cache.
 * If no Supabase token is available, applies optimistically to local cache only (demo / misconfig).
 */
export function BiteEconomySubscriber() {
  const { user } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ApplyBiteDetail>;
      if (!user || ce.detail.clerkId !== user.id) return;
      void (async () => {
        try {
          const token = await getToken({ template: "supabase" });
          if (!token) {
            const cur = getWalletBalance(user.id);
            setWalletBalance(cur + ce.detail.delta, user.id);
            if (ce.detail.kind === "welcome_bonus") {
              setWelcomeGrantedFlag(user.id);
            }
            return;
          }
          await applyBiteDeltaServer(user.id, token, ce.detail.delta, ce.detail.kind, ce.detail.meta ?? {});
          if (ce.detail.kind === "welcome_bonus") {
            setWelcomeGrantedFlag(user.id);
          }
        } catch (err) {
          console.warn("BITE delta failed", ce.detail, err);
        }
      })();
    };
    window.addEventListener("inbite-apply-bite", handler as EventListener);
    return () => window.removeEventListener("inbite-apply-bite", handler as EventListener);
  }, [getToken, user]);

  return null;
}
