import { SignUp } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "@/app/components/ui/CookieLogo";

export function SignUpPage() {
  const navigate = useNavigate();
  return (
    <main className="min-h-[100svh] bg-[#FFFBF5] pb-24 pt-10 text-[#2A2420]">
      <div className="px-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[#D9C7B8] bg-white px-3 py-2 text-[13px] font-semibold text-[#A0522D]"
        >
          <span aria-hidden>←</span> Back
        </button>
        <BrandMark size={34} />

        <div className="mt-16">
          <div
            className="text-[24px] font-semibold text-[#2A2420]"
            style={{ fontFamily: "'Patrick Hand', cursive" }}
          >
            Sign up
          </div>
          <div className="mt-2 text-[13px] text-[#2A2420]/58">
            Create an account to start sharing your daily life.
          </div>

          <div className="mt-6 flex justify-center">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/app"
              forceRedirectUrl="/app"
              appearance={{
                layout: {
                  socialButtonsPlacement: "bottom",
                },
                variables: {
                  colorBackground: "#FFFBF5",
                  colorText: "#2A2420",
                  colorInputText: "#2A2420",
                  colorNeutral: "#BFA894",
                  colorPrimary: "#A0522D",
                },
                elements: {
                  rootBox: "w-full",
                  card: "w-full max-w-none bg-transparent shadow-none border-0 p-0",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "h-11 rounded-2xl border border-[#CDB8A7] bg-white text-[#2A2420] shadow-none",
                  socialButtonsBlockButtonText: "text-[14px] font-semibold text-[#2A2420]",
                  dividerLine: "bg-[#D9C7B8]",
                  dividerText: "text-[11px] tracking-[0.14em] uppercase text-[#A98E79]",
                  formFieldLabel: "text-[12px] font-medium text-[#2A2420]/80",
                  formFieldInput:
                    "h-11 rounded-2xl border border-[#BFA894] bg-white text-[#2A2420] shadow-none focus:border-[#8F6A52]",
                  formButtonPrimary:
                    "h-12 rounded-2xl bg-[#A0522D] text-white shadow-[0_14px_30px_rgba(160,82,45,0.32)] hover:bg-[#8F4828]",
                  footerActionText: "text-[11px] text-[#A98E79]",
                  footerActionLink: "text-[11px] text-[#A98E79] hover:text-[#8F6A52]",
                  formResendCodeLink: "text-[#A98E79] hover:text-[#8F6A52]",
                },
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

