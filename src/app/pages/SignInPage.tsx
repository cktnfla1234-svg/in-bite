import { SignIn } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";
import { BrandMark } from "@/app/components/ui/CookieLogo";

export function SignInPage() {
  const navigate = useNavigate();
  return (
    <main className="min-h-[100svh] bg-[#FDFAF5] pb-24 pt-10">
      <div className="px-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[#EDD5C0] bg-white px-3 py-2 text-[13px] font-semibold text-[#A0522D]"
        >
          <span aria-hidden>←</span> Back
        </button>
        <BrandMark size={34} />

        <div className="mt-10">
          <div
            className="text-[24px] font-semibold text-[#A0522D]"
            style={{ fontFamily: "'Patrick Hand', cursive" }}
          >
            Log in
          </div>
          <div className="mt-2 text-[13px] text-[#A0522D]/60">
            Sign in to message hosts and grow your journey energy (BITE).
          </div>
          <div className="mt-3">
            <Link
              to="/account-recovery"
              className="text-[13px] font-medium text-[#A0522D] underline-offset-2 hover:underline"
            >
              회원정보 찾기
            </Link>
          </div>

          <div className="mt-6 flex justify-center">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/app"
              forceRedirectUrl="/app"
              appearance={{
                layout: {
                  socialButtonsPlacement: "bottom",
                },
                variables: {
                  colorPrimary: "#A0522D",
                },
                elements: {
                  formButtonPrimary:
                    "h-12 rounded-2xl bg-[#A0522D] text-white shadow-[0_14px_30px_rgba(160,82,45,0.32)] hover:bg-[#8F4828]",
                  socialButtonsBlockButton:
                    "h-11 rounded-2xl border border-[#CDB8A7] bg-white text-[#2A2420] shadow-none",
                  socialButtonsBlockButtonText: "text-[14px] font-semibold text-[#2A2420]",
                },
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

