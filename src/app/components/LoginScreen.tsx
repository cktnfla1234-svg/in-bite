import { useTranslation } from "react-i18next";
import { BrandMark } from "./ui/CookieLogo";

export function LoginScreen() {
  const { t } = useTranslation("common");
  return (
    <main className="min-h-[100svh] bg-[#FDFAF5] pb-24 pt-10">
      <div className="px-5">
        <BrandMark size={34} />

        <div className="mt-10">
          <div className="text-[24px] font-semibold text-[#A0522D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
            {t("auth.logIn")}
          </div>
          <div className="mt-2 text-[13px] text-[#A0522D]/60">
            Sign in to message hosts and grow your journey energy (BITE).
          </div>

          <label className="mt-6 block">
            <div className="mb-2 text-[12px] font-semibold text-[#A0522D]/70">Email</div>
            <input
              className="w-full rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
              placeholder="you@example.com"
            />
          </label>

          <label className="mt-4 block">
            <div className="mb-2 text-[12px] font-semibold text-[#A0522D]/70">Password</div>
            <input
              type="password"
              className="w-full rounded-2xl border border-[#EDD5C0] bg-white/60 px-4 py-3 text-[14px] outline-none"
              placeholder="••••••••"
            />
          </label>

          <button
            type="button"
            className="mt-6 w-full rounded-2xl bg-[#A0522D] py-4 text-[15px] font-semibold text-white shadow-[0_18px_45px_rgba(160,82,45,0.25)]"
          >
            {t("auth.logIn")}
          </button>

          <button type="button" className="mt-4 w-full rounded-2xl border border-[#EDD5C0] bg-white/40 py-4 text-[14px] font-semibold text-[#A0522D]">
            Continue with Google
          </button>
        </div>
      </div>
    </main>
  );
}
