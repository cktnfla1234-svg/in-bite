import { CookieLogo } from "./ui/CookieLogo";
import { FiatPriceBadge } from "./FiatPriceBadge";
import { usePreferredCurrency } from "@/lib/PreferredCurrencyContext";

type HostProfileScreenProps = {
  hostName: string;
  onBack: () => void;
};

export function HostProfileScreen({ hostName, onBack }: HostProfileScreenProps) {
  const { preferredCurrency } = usePreferredCurrency();
  return (
    <div className="min-h-[100svh] bg-[#FDFAF5] pb-24">
      <div className="px-5 pt-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-3 text-[14px] font-semibold text-[#A0522D]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18 9 12l6-6" stroke="#A0522D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Host Profile
        </button>
      </div>

      <div className="px-5 pt-4">
        {/* host summary card */}
        <div className="rounded-[26px] bg-white/60 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <div className="flex gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-[#E7D7C7] border-2 border-white/70">
              <div className="absolute inset-0 flex items-center justify-center">
                <CookieLogo size={32} />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold text-[#A0522D]">{hostName}</div>
              <div className="text-[12px] text-[#A0522D]/70">Tokyo, Japan</div>
              <div className="mt-1 text-[12px] text-[#A0522D]">
                <span className="mr-2">★ 4.9</span>
                <span className="text-[#A0522D]/70">(127 reviews)</span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-5 text-[#A0522D]/70">
            Welcome! I&apos;m passionate about sharing the authentic culture and hidden gems of my
            city with travelers from around the world. <span aria-hidden="true">📍</span>
          </p>

          <div className="mt-3 rounded-[18px] bg-[#A0522D]/10 px-3 py-3 text-[13px] text-[#A0522D]/80">
            Local food curator sharing hidden gems in Tokyo&apos;s cafe culture
          </div>

          <button
            type="button"
            className="mt-4 w-full rounded-2xl bg-[#A0522D] py-3 text-[14px] font-semibold text-white shadow-[0_18px_45px_rgba(160,82,45,0.25)]"
          >
            Say Hi to Sofia Chen
          </button>
        </div>

        {/* details card */}
        <div className="mt-4 rounded-[26px] bg-white/60 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <div className="text-[13px] font-semibold text-[#A0522D]">Host Details</div>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#A0522D]/70">Response Rate</span>
              <span className="font-semibold text-[#A0522D]">95%</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#A0522D]/70">Response Time</span>
              <span className="font-semibold text-[#A0522D]">within 1 hour</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#A0522D]/70">Languages</span>
              <span className="font-semibold text-[#A0522D]">English, Japanese, Korean</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#A0522D]/70">Hobbies</span>
              <span className="font-semibold text-[#A0522D]">Photography, Cooking, Hiking</span>
            </div>
          </div>
        </div>

        <div className="mt-5 text-[14px] font-semibold text-[#A0522D]">Experiences by Sofia Chen</div>

        {/* small experience preview */}
        <div className="mt-3 flex items-center gap-4 rounded-[22px] bg-white/60 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <div className="h-16 w-16 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#2B1A12] to-[#5D3B24]" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[#A0522D]">
              Traditional Tea Ceremony &amp; Modern Matcha
            </div>
            <div className="mt-2">
              <FiatPriceBadge
                priceAmount={12000}
                hostCurrency="JPY"
                preferredCurrency={preferredCurrency}
                className="bg-[#A0522D]/10"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
