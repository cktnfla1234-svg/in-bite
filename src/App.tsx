import {
  AuthenticateWithRedirectCallback,
  ClerkProvider,
  SignedIn,
  useAuth,
  useSignIn,
  useUser,
} from "@clerk/clerk-react";
import { I18nextProvider } from "react-i18next";
import i18n from "./lib/i18n/config";
import { AppLanguageSync } from "./lib/i18n/AppLanguageSync";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "./AppShell";
import { SignInPage } from "./app/pages/SignInPage";
import { SignUpPage } from "./app/pages/SignUpPage";
import { AccountRecoveryPage } from "./app/pages/AccountRecoveryPage";
import { LandingPage } from "./app/pages/LandingPage";
import { TastesOnboardingPage } from "./app/pages/TastesOnboardingPage";
import { SupabaseUserSync } from "./lib/supabaseUserSync";
import { BiteEconomySubscriber } from "./lib/BiteEconomySubscriber";
import { useEffect, useState, type ReactNode } from "react";
import { getOnboardingCompleted, upsertClerkProfile } from "./lib/profile";
import { GOOGLE_OAUTH_STRATEGY, KAKAO_OAUTH_STRATEGY, NAVER_OAUTH_STRATEGY } from "./lib/authStrategies";

/**
 * True only when this **document load** was a full reload and the **requested URL** was `/chat/:id`.
 * SPA navigations to `/chat/...` reuse the same NavigationTiming entry as the initial `/app` load, so
 * `type === "reload"` alone would wrongly bounce Say Hi → chat back to `/app`.
 */
function isReloadOnChatDeepLink(): boolean {
  if (typeof performance === "undefined") return false;
  const entry = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
  const legacy = (performance as unknown as { navigation?: { type?: number } }).navigation;
  const isReload = entry?.type === "reload" || legacy?.type === 1;
  if (!isReload) return false;
  const name = entry?.name;
  if (!name) return false;
  try {
    const path = new URL(name, window.location.origin).pathname;
    return path.startsWith("/chat/");
  } catch {
    return false;
  }
}

const OAUTH_FALLBACK_STRATEGY: Partial<
  Record<typeof KAKAO_OAUTH_STRATEGY | typeof NAVER_OAUTH_STRATEGY, "oauth_kakao" | "oauth_naver">
> = {
  [KAKAO_OAUTH_STRATEGY]: "oauth_kakao",
  [NAVER_OAUTH_STRATEGY]: "oauth_naver",
};

function ClerkProviderWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

function AppShellWithAuthState() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  return (
    <>
      <SignedIn>
        <SupabaseUserSync />
        <BiteEconomySubscriber />
      </SignedIn>
      <AppShell
        isSignedIn={Boolean(isSignedIn)}
        welcomeClerkUserId={user?.id ?? null}
        welcomeClerkAccountCreatedAt={user?.createdAt ?? null}
        getSupabaseToken={async () => getToken({ template: "supabase" })}
      />
    </>
  );
}

function LoadingScreen() {
  const cycle = 2.45;
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[#FFF9F5]">
      <div className="relative h-[108px] w-[108px]">
        <motion.svg
          width="108"
          height="108"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Loading"
          initial={{ opacity: 0, scale: 0.92, y: 6 }}
          animate={{
            // full cookie -> first bite -> second bite -> linger -> fade -> reset
            opacity: [0, 1, 1, 1, 0.2, 0],
            scale: [0.92, 1.03, 1, 0.995, 0.985, 0.92],
            y: [6, -3, -1, 0, 2, 6],
          }}
          transition={{
            duration: cycle,
            repeat: Infinity,
            times: [0, 0.1, 0.35, 0.58, 0.86, 1],
            ease: "easeInOut",
          }}
        >
          <circle cx="24" cy="24" r="20" fill="#D4B896" />
          <circle cx="15" cy="16" r="2" fill="#6B4423" />
          <circle cx="25" cy="14" r="2" fill="#6B4423" />
          <circle cx="13" cy="26" r="2" fill="#6B4423" />
          <circle cx="22" cy="23" r="2" fill="#6B4423" />
          <circle cx="28" cy="30" r="2" fill="#6B4423" />
          <circle cx="18" cy="33" r="2" fill="#6B4423" />

          {/* first bite: upper-right */}
          <motion.g
            animate={{ opacity: [0, 0, 1, 1, 1, 0], scale: [0.95, 0.95, 1, 1, 1, 0.95] }}
            transition={{
              duration: cycle,
              repeat: Infinity,
              times: [0, 0.21, 0.23, 0.82, 0.9, 1],
              ease: "easeOut",
            }}
            style={{ transformOrigin: "36px 16px" }}
          >
            <circle cx="37.5" cy="10.5" r="4.2" fill="#FFF9F5" />
            <circle cx="42" cy="16.5" r="3.6" fill="#FFF9F5" />
            <circle cx="38.6" cy="20.7" r="3.4" fill="#FFF9F5" />
          </motion.g>

          {/* second bite: lower-right (about 0.3s after first) */}
          <motion.g
            animate={{ opacity: [0, 0, 0, 1, 1, 0], scale: [0.95, 0.95, 0.95, 1, 1, 0.95] }}
            transition={{
              duration: cycle,
              repeat: Infinity,
              times: [0, 0.33, 0.35, 0.47, 0.86, 1],
              ease: "easeOut",
            }}
            style={{ transformOrigin: "37px 29px" }}
          >
            <circle cx="39.8" cy="28.4" r="4.4" fill="#FFF9F5" />
            <circle cx="35.8" cy="33.4" r="3.6" fill="#FFF9F5" />
            <circle cx="40.8" cy="35.6" r="3.2" fill="#FFF9F5" />
          </motion.g>
        </motion.svg>

        {/* crumbs for first crunch */}
        <motion.span
          className="pointer-events-none absolute right-2 top-5 h-1.5 w-1.5 rounded-full bg-[#C58E68]"
          animate={{ opacity: [0, 0, 1, 0, 0], x: [0, 0, 7, 10, 10], y: [0, 0, -2, -5, -5] }}
          transition={{ duration: cycle, repeat: Infinity, times: [0, 0.2, 0.24, 0.34, 1], ease: "easeOut" }}
        />
        <motion.span
          className="pointer-events-none absolute right-4 top-3 h-1 w-1 rounded-full bg-[#D8A37C]"
          animate={{ opacity: [0, 0, 0.9, 0, 0], x: [0, 0, 6, 8, 8], y: [0, 0, -1, -3, -3] }}
          transition={{ duration: cycle, repeat: Infinity, times: [0, 0.2, 0.25, 0.34, 1], ease: "easeOut" }}
        />
        <motion.span
          className="pointer-events-none absolute right-1 top-8 h-1 w-1 rounded-full bg-[#B97B56]"
          animate={{ opacity: [0, 0, 0.8, 0, 0], x: [0, 0, 4, 7, 7], y: [0, 0, 0, -2, -2] }}
          transition={{ duration: cycle, repeat: Infinity, times: [0, 0.22, 0.27, 0.37, 1], ease: "easeOut" }}
        />

        {/* crumbs for second crunch */}
        <motion.span
          className="pointer-events-none absolute right-0 top-14 h-1.5 w-1.5 rounded-full bg-[#C58E68]"
          animate={{ opacity: [0, 0, 0, 1, 0, 0], x: [0, 0, 0, 7, 11, 11], y: [0, 0, 0, 2, 5, 5] }}
          transition={{ duration: cycle, repeat: Infinity, times: [0, 0.42, 0.45, 0.5, 0.62, 1], ease: "easeOut" }}
        />
        <motion.span
          className="pointer-events-none absolute right-5 top-[58px] h-1 w-1 rounded-full bg-[#D8A37C]"
          animate={{ opacity: [0, 0, 0, 0.95, 0, 0], x: [0, 0, 0, 5, 8, 8], y: [0, 0, 0, 1, 4, 4] }}
          transition={{ duration: cycle, repeat: Infinity, times: [0, 0.42, 0.45, 0.52, 0.63, 1], ease: "easeOut" }}
        />
        <motion.span
          className="pointer-events-none absolute right-3 top-[62px] h-1 w-1 rounded-full bg-[#B97B56]"
          animate={{ opacity: [0, 0, 0, 0.85, 0, 0], x: [0, 0, 0, 4, 7, 7], y: [0, 0, 0, 0, 2, 2] }}
          transition={{ duration: cycle, repeat: Infinity, times: [0, 0.43, 0.46, 0.53, 0.65, 1], ease: "easeOut" }}
        />
      </div>
    </main>
  );
}

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

function useAuthProfileState() {
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
    (async () => {
      try {
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

  return { authLoaded, isSignedIn, isChecking, onboardingDone };
}

function RootEntry() {
  const { authLoaded, isSignedIn, isChecking } = useAuthProfileState();
  if (!authLoaded || isChecking) return <LoadingScreen />;
  if (!isSignedIn) return <Navigate to="/app" replace />;
  return <Navigate to="/app" replace />;
}

function ProtectedAppRoute() {
  const { authLoaded, isSignedIn, isChecking } = useAuthProfileState();
  if (!authLoaded || isChecking) return <LoadingScreen />;
  if (!isSignedIn) return <AppShell isSignedIn={false} />;
  return <AppShellWithAuthState />;
}

function ProtectedChatRoomRoute() {
  const { roomId } = useParams<{ roomId: string }>();
  const { authLoaded, isSignedIn, isChecking } = useAuthProfileState();
  if (!authLoaded || isChecking) return <LoadingScreen />;
  if (isReloadOnChatDeepLink()) return <Navigate to="/app" replace />;
  if (!isSignedIn) return <AppShell isSignedIn={false} initialChatRoomId={roomId ?? null} />;
  return (
    <AppShellWithAuthStateWithInitialChat initialChatRoomId={roomId ?? null} />
  );
}

function PublicChatRoomRoute() {
  const { roomId } = useParams<{ roomId: string }>();
  if (isReloadOnChatDeepLink()) return <Navigate to="/app" replace />;
  return <AppShell isSignedIn={false} initialChatRoomId={roomId ?? null} />;
}

function AppShellWithAuthStateWithInitialChat({ initialChatRoomId }: { initialChatRoomId: string | null }) {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  return (
    <>
      <SignedIn>
        <SupabaseUserSync />
        <BiteEconomySubscriber />
      </SignedIn>
      <AppShell
        isSignedIn={Boolean(isSignedIn)}
        welcomeClerkUserId={user?.id ?? null}
        welcomeClerkAccountCreatedAt={user?.createdAt ?? null}
        initialChatRoomId={initialChatRoomId}
        getSupabaseToken={async () => getToken({ template: "supabase" })}
      />
    </>
  );
}

function ProtectedOnboardingRoute() {
  const { authLoaded, isSignedIn, isChecking, onboardingDone } = useAuthProfileState();
  if (!authLoaded || isChecking) return <LoadingScreen />;
  if (!isSignedIn) return <Navigate to="/" replace />;
  if (onboardingDone) return <Navigate to="/app" replace />;
  return <TastesOnboardingPage />;
}

function LandingWithSocialLogin() {
  const { isLoaded, signIn } = useSignIn();

  const handleSocial = async (
    strategy:
      | typeof KAKAO_OAUTH_STRATEGY
      | typeof NAVER_OAUTH_STRATEGY
      | typeof GOOGLE_OAUTH_STRATEGY,
  ) => {
    if (!isLoaded || !signIn) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/app",
      });
    } catch {
      const fallback = OAUTH_FALLBACK_STRATEGY[strategy as keyof typeof OAUTH_FALLBACK_STRATEGY];
      if (!fallback) return;
      await signIn.authenticateWithRedirect({
        strategy: fallback,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/app",
      });
    }
  };

  return (
    <LandingPage
      onKakaoLogin={() => void handleSocial(KAKAO_OAUTH_STRATEGY)}
      onNaverLogin={() => void handleSocial(NAVER_OAUTH_STRATEGY)}
      onGoogleLogin={() => void handleSocial(GOOGLE_OAUTH_STRATEGY)}
    />
  );
}

export default function App() {
  const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return (
    <BrowserRouter>
      <ClerkProviderWithRouter>
        <I18nextProvider i18n={i18n}>
          <AppLanguageSync />
          <Routes>
          {hasClerkKey ? (
            <>
              <Route path="/" element={<RootEntry />} />
              <Route path="/app" element={<ProtectedAppRoute />} />
              <Route path="/chat/:roomId" element={<ProtectedChatRoomRoute />} />
              <Route path="/onboarding/tastes" element={<ProtectedOnboardingRoute />} />
              <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />
              <Route path="/account-recovery" element={<AccountRecoveryPage />} />
            </>
          ) : (
            <>
              <Route path="/" element={<LandingPage />} />
              <Route path="/app" element={<AppShell isSignedIn={false} />} />
              <Route path="/chat/:roomId" element={<PublicChatRoomRoute />} />
              <Route path="/account-recovery" element={<AccountRecoveryPage />} />
            </>
          )}

          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </I18nextProvider>
      </ClerkProviderWithRouter>
    </BrowserRouter>
  );
}
