import { useAuth, useUser } from "@clerk/clerk-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { fetchProfileLanguageCode } from "@/lib/profile";
import i18n, { applyLocaleFromServer, persistAppLocale } from "./config";
import { normalizeAppLocale } from "./appLocales";

type ChannelHolder = { client: ReturnType<typeof getSupabaseClient>; channel: RealtimeChannel };

function syncDocumentLanguageClass() {
  if (typeof document === "undefined") return;
  const locale = normalizeAppLocale(i18n.language);
  const root = document.documentElement;
  const body = document.body;
  root.lang = locale;
  body.classList.toggle("lang-ko", locale === "ko");
}

/**
 * After sign-in, prefer `profiles.language_code` over browser detection.
 * Subscribes to Realtime profile updates so another device/tab can switch language live.
 */
export function AppLanguageSync() {
  const { isSignedIn, getToken, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const channelHolderRef = useRef<ChannelHolder | null>(null);

  useEffect(() => {
    syncDocumentLanguageClass();
    const handler = () => syncDocumentLanguageClass();
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !userLoaded || !isSignedIn || !user?.id) return;

    let cancelled = false;

    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const fromDb = await fetchProfileLanguageCode(user.id, token);
        if (cancelled) return;
        if (fromDb?.trim()) {
          applyLocaleFromServer(fromDb);
        }
      } catch {
        // table/column missing — keep detector language
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userLoaded, isSignedIn, user?.id, getToken]);

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      const h = channelHolderRef.current;
      if (h) {
        void h.client.removeChannel(h.channel);
        channelHolderRef.current = null;
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const client = getSupabaseClient(token);
        const channel = client
          .channel(`profile-lang:${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `clerk_id=eq.${user.id}`,
            },
            (payload) => {
              const row = payload.new as Record<string, unknown> | null;
              const raw = row?.language_code;
              if (typeof raw === "string" && raw.trim()) {
                const next = normalizeAppLocale(raw);
                void i18n.changeLanguage(next);
                persistAppLocale(next);
              }
            },
          )
          .subscribe();
        channelHolderRef.current = { client, channel };
      } catch {
        // Realtime not enabled
      }
    })();

    return () => {
      cancelled = true;
      const h = channelHolderRef.current;
      if (h) {
        void h.client.removeChannel(h.channel);
        channelHolderRef.current = null;
      }
    };
  }, [isSignedIn, user?.id, getToken]);

  return null;
}
