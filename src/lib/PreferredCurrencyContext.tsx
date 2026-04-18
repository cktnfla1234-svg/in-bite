import { useAuth, useUser } from "@clerk/clerk-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchProfileCurrencyPrefs, updatePreferredCurrency } from "@/lib/profile";
import { isSelectableCurrency, type CurrencyCode } from "@/lib/currency";

type PreferredCurrencyContextValue = {
  preferredCurrency: CurrencyCode;
  setPreferredCurrency: (code: CurrencyCode) => void;
  persistPreferredCurrency: (code: CurrencyCode) => Promise<void>;
};

const PreferredCurrencyContext = createContext<PreferredCurrencyContextValue | null>(null);

function storageKey(clerkUserId: string | null | undefined) {
  return `inbite:preferred-currency:${clerkUserId?.trim() || "guest"}`;
}

export function PreferredCurrencyProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: clerkUserLoaded } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const clerkId = user?.id ?? null;

  const [preferredCurrency, setPreferredCurrencyState] = useState<CurrencyCode>("KRW");

  const readLocal = useCallback((): CurrencyCode => {
    if (typeof window === "undefined") return "KRW";
    // While signed in, never read `guest` storage — it causes wrong currency (e.g. JPY) on Explore
    // until Clerk exposes `user.id`, or if guest previously picked another currency.
    if (isSignedIn && (!clerkUserLoaded || !clerkId?.trim())) {
      return "KRW";
    }
    const raw = window.localStorage.getItem(storageKey(clerkId));
    if (raw && isSelectableCurrency(raw)) return raw;
    return "KRW";
  }, [clerkId, isSignedIn, clerkUserLoaded]);

  useEffect(() => {
    setPreferredCurrencyState(readLocal());
  }, [readLocal, clerkId]);

  useEffect(() => {
    const onExternal = (e: Event) => {
      const ce = e as CustomEvent<{ code?: string }>;
      const code = ce.detail?.code;
      if (code && isSelectableCurrency(code)) {
        setPreferredCurrencyState(code);
      } else {
        setPreferredCurrencyState(readLocal());
      }
    };
    window.addEventListener("inbite-preferred-currency-changed", onExternal as EventListener);
    return () => window.removeEventListener("inbite-preferred-currency-changed", onExternal as EventListener);
  }, [readLocal]);

  useEffect(() => {
    if (!isSignedIn || !clerkId) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        const fromServer = await fetchProfileCurrencyPrefs(clerkId, token);
        if (cancelled) return;
        if (isSelectableCurrency(fromServer)) {
          setPreferredCurrencyState(fromServer);
          window.localStorage.setItem(storageKey(clerkId), fromServer);
        }
      } catch {
        // keep local
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, clerkId, getToken]);

  const setPreferredCurrency = useCallback(
    (code: CurrencyCode) => {
      if (isSignedIn && !clerkId?.trim()) {
        setPreferredCurrencyState(code);
        window.dispatchEvent(new CustomEvent("inbite-preferred-currency-changed", { detail: { code } }));
        return;
      }
      const key = storageKey(clerkId);
      window.localStorage.setItem(key, code);
      setPreferredCurrencyState(code);
      window.dispatchEvent(new CustomEvent("inbite-preferred-currency-changed", { detail: { code } }));
    },
    [clerkId, isSignedIn],
  );

  const persistPreferredCurrency = useCallback(
    async (code: CurrencyCode) => {
      setPreferredCurrency(code);
      if (!clerkId) return;
      try {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        await updatePreferredCurrency(clerkId, token, code);
      } catch {
        // local preference still applied
      }
    },
    [clerkId, getToken, setPreferredCurrency],
  );

  const value = useMemo(
    () => ({
      preferredCurrency,
      setPreferredCurrency,
      persistPreferredCurrency,
    }),
    [preferredCurrency, setPreferredCurrency, persistPreferredCurrency],
  );

  return <PreferredCurrencyContext.Provider value={value}>{children}</PreferredCurrencyContext.Provider>;
}

export function usePreferredCurrency() {
  const ctx = useContext(PreferredCurrencyContext);
  if (!ctx) {
    throw new Error("usePreferredCurrency must be used within PreferredCurrencyProvider");
  }
  return ctx;
}
