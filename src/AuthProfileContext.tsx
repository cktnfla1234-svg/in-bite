import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { isSupabaseConfigured } from "./lib/supabase";
import { getOnboardingCompleted, upsertClerkProfile } from "./lib/profile";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let settled = false;
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("timeout"));
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(id);
        resolve(value);
      },
      (err: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(id);
        reject(err);
      },
    );
  });
}

export type AuthProfileValue = {
  authLoaded: boolean;
  isSignedIn: boolean;
  isChecking: boolean;
  onboardingDone: boolean;
};

const AuthProfileContext = createContext<AuthProfileValue | null>(null);

function onboardingCacheKey(clerkId: string) {
  return `inbite:onboarding:${clerkId}`;
}

export function AuthProfileProvider({ children }: { children: ReactNode }) {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const [isChecking, setIsChecking] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    if (!authLoaded || !userLoaded) return;
    if (!isSignedIn || !user) {
      setOnboardingDone(false);
      setIsChecking(false);
      return;
    }

    // Never block the first signed-in navigation on profile upsert/onboarding checks.
    // We hydrate quickly and sync in the background.
    setIsChecking(false);
    let cachedDone = false;
    try {
      const cached = window.localStorage.getItem(onboardingCacheKey(user.id));
      cachedDone = cached === "1";
      setOnboardingDone(cachedDone);
    } catch {
      // ignore storage errors
    }

    let cancelled = false;
    void (async () => {
      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) setOnboardingDone(cachedDone);
          return;
        }
        const token = await withTimeout(getToken({ template: "supabase" }), 12_000);
        if (!token) {
          if (!cancelled) setOnboardingDone(cachedDone);
          return;
        }
        await withTimeout(upsertClerkProfile(user, token), 12_000);
        const onboarding = await withTimeout(getOnboardingCompleted(user.id, token), 12_000);
        if (!cancelled) {
          setOnboardingDone(onboarding);
          try {
            window.localStorage.setItem(onboardingCacheKey(user.id), onboarding ? "1" : "0");
          } catch {
            // ignore storage errors
          }
        }
      } catch {
        if (!cancelled) setOnboardingDone((prev) => prev || cachedDone);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoaded, getToken, isSignedIn, user, userLoaded]);

  const value: AuthProfileValue = {
    authLoaded,
    isSignedIn: Boolean(isSignedIn),
    isChecking,
    onboardingDone,
  };

  return <AuthProfileContext.Provider value={value}>{children}</AuthProfileContext.Provider>;
}

export function useAuthProfile(): AuthProfileValue {
  const ctx = useContext(AuthProfileContext);
  if (!ctx) {
    throw new Error("useAuthProfile must be used within AuthProfileProvider");
  }
  return ctx;
}
