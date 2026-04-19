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

    let cancelled = false;
    setIsChecking(true);
    void (async () => {
      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) setOnboardingDone(false);
          return;
        }
        const token = await withTimeout(getToken({ template: "supabase" }), 12_000);
        if (!token) {
          if (!cancelled) setOnboardingDone(false);
          return;
        }
        await withTimeout(upsertClerkProfile(user, token), 12_000);
        const onboarding = await withTimeout(getOnboardingCompleted(user.id, token), 12_000);
        if (!cancelled) setOnboardingDone(onboarding);
      } catch {
        if (!cancelled) setOnboardingDone(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      setIsChecking(false);
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
