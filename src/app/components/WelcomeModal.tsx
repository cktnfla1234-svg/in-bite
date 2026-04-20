import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useClerk, useSignIn, useSignUp } from "@clerk/clerk-react";
import { AppShellTabbarPadMotion } from "./AppShellTabbarSafeArea";
import { CookieLogo } from "./ui/CookieLogo";
import { GoogleLogo, KakaoLogo, NaverLogo } from "./ui/SocialLogos";
import { GOOGLE_OAUTH_STRATEGY, KAKAO_OAUTH_STRATEGY, NAVER_OAUTH_STRATEGY } from "@/lib/authStrategies";

type WelcomeModalProps = {
  open: boolean;
  onClose?: () => void;
  onSecondary?: () => void;
  onAuthenticated?: () => void;
  initialAuthView?: boolean;
  initialMode?: FormMode;
};

type FormMode = "default" | "sign-up" | "log-in";
const WELCOME_DISMISSED_KEY = "inbite:welcome-dismissed:v2";
const OAUTH_FALLBACK_STRATEGY: Partial<
  Record<typeof KAKAO_OAUTH_STRATEGY | typeof NAVER_OAUTH_STRATEGY, "oauth_kakao" | "oauth_naver">
> = {
  [KAKAO_OAUTH_STRATEGY]: "oauth_kakao",
  [NAVER_OAUTH_STRATEGY]: "oauth_naver",
};

type SocialStrategy =
  | typeof KAKAO_OAUTH_STRATEGY
  | typeof NAVER_OAUTH_STRATEGY
  | typeof GOOGLE_OAUTH_STRATEGY;

function WelcomeAuthContent({
  onAuthenticated,
  onSecondary,
  onClose,
  initialAuthView = false,
  initialMode = "default",
}: {
  onAuthenticated?: () => void;
  onSecondary?: () => void;
  onClose?: () => void;
  initialAuthView?: boolean;
  initialMode?: FormMode;
}) {
  const { t } = useTranslation("common");
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { setActive } = useClerk();
  const [isAuthView, setIsAuthView] = useState(initialAuthView);
  const [mode, setMode] = useState<FormMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const passwordsMatch = password === passwordConfirm;
  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode !== "sign-up" || (passwordConfirm.trim().length > 0 && passwordsMatch));

  const closeWithPreference = (cb?: () => void) => {
    if (dontShowAgain) {
      window.localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    }
    cb?.();
  };

  const handleSocial = async (strategy: SocialStrategy) => {
    if (!signInLoaded || !signIn) {
      setError(t("welcomeModal.authLoading"));
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/app",
      });
    } catch (primaryErr) {
      const fallback = OAUTH_FALLBACK_STRATEGY[strategy as keyof typeof OAUTH_FALLBACK_STRATEGY];
      if (!fallback) {
        const reason = primaryErr instanceof Error ? primaryErr.message : t("welcomeModal.authFailed");
        setError(t("welcomeModal.socialLoginFailed", { reason }));
        return;
      }
      try {
        await signIn.authenticateWithRedirect({
          strategy: fallback,
          redirectUrl: "/sso-callback",
          redirectUrlComplete: "/app",
        });
      } catch (fallbackErr) {
        const reason =
          fallbackErr instanceof Error
            ? fallbackErr.message
            : primaryErr instanceof Error
              ? primaryErr.message
              : t("welcomeModal.authFailed");
        setError(t("welcomeModal.socialLoginFailed", { reason }));
      }
    }
  };

  const handleEmailAuth = async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "sign-up") {
        if (!signUpLoaded || !signUp) return;
        const result = await signUp.create({
          firstName: name.trim() || undefined,
          emailAddress: email.trim(),
          password,
        });
        if (result.status === "complete" && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
          closeWithPreference(onAuthenticated);
          return;
        }
        setNotice(t("welcomeModal.verifyEmail"));
        return;
      }

      if (!signInLoaded || !signIn) return;
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        closeWithPreference(onAuthenticated);
      } else {
        setNotice(t("welcomeModal.completeSignIn"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("welcomeModal.authFailed"));
    } finally {
      setPending(false);
    }
  };

  const inForm = mode === "sign-up" || mode === "log-in";

  return (
    <>
      <h2
        className="mt-8 text-center font-semibold"
        style={{ color: "#5A3828", fontSize: "22px", fontFamily: "'Patrick Hand', cursive" }}
      >
        {t("welcomeModal.title")}
      </h2>

      <p className="mt-3 text-center text-sm leading-6 text-[#2A2420]/88">
        <Trans
          ns="common"
          i18nKey="welcomeModal.body"
          components={{
            bite: <span className="font-semibold" />,
            energy: <span className="font-semibold" />,
          }}
        />
      </p>

      {!isAuthView ? (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              setIsAuthView(true);
              setMode("default");
              setPasswordConfirm("");
              setError(null);
              setNotice(null);
            }}
            className="h-12 w-full rounded-2xl bg-[#A0522D] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(160,82,45,0.32)]"
          >
            {t("auth.welcomeSignUpCta")}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAuthView(true);
              setMode("log-in");
              setPasswordConfirm("");
              setError(null);
              setNotice(null);
            }}
            className="h-11 w-full rounded-2xl border border-[#CDB8A7] bg-white text-sm font-semibold text-[#2A2420]"
          >
            {t("auth.alreadyHaveAccountLogIn")}
          </button>
        </div>
      ) : inForm ? (
        <div className="mt-6 space-y-3">
          {mode === "sign-up" ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("welcomeModal.nameOptional")}
              className="h-11 w-full rounded-2xl border border-[#BFA894] bg-white px-4 text-sm text-[#2A2420] outline-none focus:border-[#8F6A52]"
            />
          ) : null}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("welcomeModal.email")}
            className="h-11 w-full rounded-2xl border border-[#BFA894] bg-white px-4 text-sm text-[#2A2420] outline-none focus:border-[#8F6A52]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("welcomeModal.password")}
            className="h-11 w-full rounded-2xl border border-[#BFA894] bg-white px-4 text-sm text-[#2A2420] outline-none focus:border-[#8F6A52]"
          />
          {mode === "sign-up" ? (
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder={t("welcomeModal.passwordConfirm")}
              className="h-11 w-full rounded-2xl border border-[#BFA894] bg-white px-4 text-sm text-[#2A2420] outline-none focus:border-[#8F6A52]"
            />
          ) : null}
          {mode === "sign-up" && passwordConfirm.length > 0 && !passwordsMatch ? (
            <p className="text-center text-[11px] text-red-600">{t("welcomeModal.passwordMismatch")}</p>
          ) : null}
          <button
            type="button"
            disabled={!canSubmit || pending}
            onClick={() => void handleEmailAuth()}
            className="mt-1 h-12 w-full rounded-2xl bg-[#A0522D] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(160,82,45,0.32)] disabled:opacity-55"
          >
            {pending
              ? t("welcomeModal.pleaseWait")
              : mode === "sign-up"
                ? t("welcomeModal.createAccount")
                : t("auth.logInWithEmail")}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAuthView(true);
              setMode("default");
              setPasswordConfirm("");
              setError(null);
              setNotice(null);
            }}
            className="w-full pt-1 text-center text-[11px] text-[#A98E79] underline-offset-2 hover:underline"
          >
            {t("welcomeModal.backToOptions")}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              setMode("sign-up");
              setPasswordConfirm("");
              setError(null);
              setNotice(null);
            }}
            className="h-12 w-full rounded-2xl bg-[#A0522D] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(160,82,45,0.32)]"
          >
            {t("auth.signUpWithEmail")}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("log-in");
              setPasswordConfirm("");
              setError(null);
              setNotice(null);
            }}
            className="w-full text-center text-[11px] text-[#A98E79] underline-offset-2 hover:underline"
          >
            {t("auth.alreadyHaveAccountQuestionLogIn")}
          </button>

          <div className="pt-1 text-center text-[11px] tracking-wide text-[#B89A80]">
            {t("welcomeModal.orContinueWith")}
          </div>

          <button
            type="button"
            onClick={() => void handleSocial(KAKAO_OAUTH_STRATEGY)}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#CDB8A7] bg-white text-sm font-semibold text-[#2A2420]"
          >
            <KakaoLogo />
            <span>{t("welcomeModal.continueKakao")}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSocial(NAVER_OAUTH_STRATEGY)}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#CDB8A7] bg-white text-sm font-semibold text-[#2A2420]"
          >
            <NaverLogo />
            <span>{t("welcomeModal.continueNaver")}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSocial(GOOGLE_OAUTH_STRATEGY)}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#CDB8A7] bg-white text-sm font-semibold text-[#2A2420]"
          >
            <GoogleLogo />
            <span>{t("welcomeModal.continueGoogle")}</span>
          </button>

          <p className="text-center text-[11px] text-[#A0522D]/60">{t("welcomeModal.oauthHelper")}</p>
        </div>
      )}

      {error ? <p className="mt-3 text-center text-[12px] text-red-600">{error}</p> : null}
      {notice ? <p className="mt-3 text-center text-[12px] text-[#7C6A5E]">{notice}</p> : null}

      <button
        type="button"
        onClick={() => {
          closeWithPreference(onSecondary);
        }}
        className="mt-5 w-full text-center text-[11px] text-[#A98E79] underline-offset-2 hover:underline"
      >
        {t("welcomeModal.browseLimited")}
      </button>

      <div className="mt-3 rounded-2xl border border-[#E0CDBD] bg-[#FFFDF9] px-3.5 py-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="inline-flex items-center text-[12px] text-[#2A2420]/75">
            {t("welcomeModal.dontShowAgain")}
          </span>
          <button
            type="button"
            onClick={() => setDontShowAgain((prev) => !prev)}
            role="switch"
            aria-checked={dontShowAgain}
            aria-label={t("welcomeModal.toggleDontShowAria")}
            className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors ${
              dontShowAgain
                ? "border-[#A0522D] bg-[#A0522D]/90"
                : "border-[#D9C2AE] bg-white"
            }`}
          >
            <span
              className={`pointer-events-none absolute left-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#F5E3CF] text-[13px] shadow-sm transition-transform ${
                dontShowAgain ? "translate-x-5" : "translate-x-0"
              }`}
            >
              <CookieLogo size={14} />
            </span>
          </button>
        </label>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
            onClose?.();
          }}
                  className="mt-2 w-full text-left text-[11px] text-[#A98E79] underline-offset-2 hover:underline"
        >
          {t("welcomeModal.hideNow")}
        </button>
      </div>
    </>
  );
}

export function WelcomeModal({
  open,
  onClose,
  onSecondary,
  onAuthenticated,
  initialAuthView = false,
  initialMode = "default",
}: WelcomeModalProps) {
  const { t } = useTranslation("common");
  const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return (
    <AnimatePresence>
      {open ? (
        <AppShellTabbarPadMotion
          className="fixed inset-0 z-[55] flex items-center justify-center p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-[#2A170E]/20 backdrop-blur-[4px]"
            onClick={onClose}
          />

          {/* card */}
          <motion.div
            className="relative w-full max-w-[430px] rounded-[30px] border border-[#E7D5C6] bg-[#FFFBF5] px-6 pb-6 pt-16 shadow-[0_28px_90px_rgba(44,26,14,0.22)]"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="absolute left-1/2 top-[-34px] flex h-[84px] w-[84px] -translate-x-1/2 items-center justify-center rounded-full border border-[#E7D5C6] bg-[#F8EFE4] shadow-[0_10px_24px_rgba(160,82,45,0.15)]">
              <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#EADACB]">
                <CookieLogo size={26} />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#2A2420]/60 hover:bg-[#F3E8DA]"
              aria-label={t("welcomeModal.closeAria")}
            >
              x
            </button>

            {hasClerkKey ? (
              <WelcomeAuthContent
                onAuthenticated={onAuthenticated}
                onSecondary={onSecondary}
                onClose={onClose}
                initialAuthView={initialAuthView}
                initialMode={initialMode}
              />
            ) : (
              <>
                <h2
                  className="text-center font-semibold"
                  style={{ color: "#A0522D", fontSize: "22px", fontFamily: "'Patrick Hand', cursive" }}
                >
                  {t("welcomeModal.title")}
                </h2>
                <p className="mt-4 text-center text-sm leading-6 text-[#6F4C32]">{t("welcomeModal.noClerkBody")}</p>
                <button
                  type="button"
                  onClick={onSecondary}
                  className="mt-6 h-11 w-full rounded-2xl border border-[#A0522D]/25 bg-white/80 text-sm font-medium text-[#A0522D]"
                >
                  {t("welcomeModal.noClerkBrowse")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
                    onClose?.();
                  }}
                  className="mt-2 w-full text-center text-[12px] text-[#A0522D]/55 underline-offset-2 hover:underline"
                >
                  {t("welcomeModal.dontShowAgain")}
                </button>
              </>
            )}
          </motion.div>
        </AppShellTabbarPadMotion>
      ) : null}
    </AnimatePresence>
  );
}
