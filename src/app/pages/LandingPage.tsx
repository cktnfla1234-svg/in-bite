import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "@/app/components/ui/CookieLogo";
import { WelcomeModal } from "@/app/components/WelcomeModal";
import { GoogleLogo, KakaoLogo, NaverLogo } from "@/app/components/ui/SocialLogos";

const FEATURES = [
  "Local hosts, real daily moments",
  "Taste-based invitation matching",
  "Warm, trusted private chats",
];

type LandingPageProps = {
  onKakaoLogin?: () => void;
  onNaverLogin?: () => void;
  onGoogleLogin?: () => void;
};

export function LandingPage({ onKakaoLogin, onNaverLogin, onGoogleLogin }: LandingPageProps) {
  const navigate = useNavigate();
  const socialEnabled = Boolean(onKakaoLogin || onNaverLogin || onGoogleLogin);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem("inbite:welcome-dismissed:v2") === "true";
    setWelcomeOpen(!dismissed);
  }, []);

  return (
    <main className="min-h-[100svh] bg-[#FDFAF5] text-[#5C3318]">
      <WelcomeModal
        open={welcomeOpen}
        onClose={() => {
          setWelcomeOpen(false);
        }}
        onSecondary={() => {
          setWelcomeOpen(false);
          navigate("/app");
        }}
        onAuthenticated={() => {
          setWelcomeOpen(false);
          navigate("/app");
        }}
      />

      <section className="mx-auto flex min-h-[100svh] w-full max-w-[520px] flex-col px-6 pb-20 pt-12">
        <BrandMark size={40} />

        <div className="mt-10">
          <h1
            className="text-[36px] leading-[1.1]"
            style={{ color: "#A0522D", fontFamily: "'Patrick Hand', cursive" }}
          >
            Meet People Through
            <br />
            Daily Bites
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-[#7C6A5E]">
            In-Bite connects travelers and locals with warm invitations, shared moments,
            and taste-driven meetups.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-[#EDD5C0] bg-white/70 p-5">
          {FEATURES.map((item) => (
            <div key={item} className="mb-2 flex items-center gap-2 text-[14px] last:mb-0">
              <span className="text-[#A0522D]">•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto space-y-3 pt-10">
          <button
            type="button"
            onClick={onKakaoLogin}
            disabled={!onKakaoLogin}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#D9D9D9] bg-white text-sm font-semibold text-[#2F2F2F] shadow-[0_10px_24px_rgba(0,0,0,0.12)] disabled:opacity-45"
          >
            <KakaoLogo />
            <span>Continue with Kakao</span>
          </button>
          <button
            type="button"
            onClick={onNaverLogin}
            disabled={!onNaverLogin}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#D9D9D9] bg-white text-sm font-semibold text-[#2F2F2F] disabled:opacity-45"
          >
            <NaverLogo />
            <span>Continue with Naver</span>
          </button>
          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={!onGoogleLogin}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-[#D9D9D9] bg-white text-sm font-semibold text-[#2F2F2F] disabled:opacity-45"
          >
            <GoogleLogo />
            <span>Continue with Google</span>
          </button>
          <p className="pt-2 text-center text-[12px] text-[#A0522D]/60">
            {socialEnabled
              ? "By continuing, you agree to In-Bite's community guidelines."
              : "Set VITE_CLERK_PUBLISHABLE_KEY to enable social login."}
          </p>
        </div>
      </section>
    </main>
  );
}
