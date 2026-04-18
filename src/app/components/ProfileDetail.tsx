import { CookieLogo } from "./ui/CookieLogo";

export function ProfileDetail() {
  return (
    <main className="min-h-[100svh] bg-[#FDFAF5] pb-24 pt-10">
      <div className="px-5">
        <div className="text-[22px] font-semibold text-[#A0522D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          Profile Detail
        </div>

        <div className="mt-5 rounded-[26px] bg-white/60 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-[#E7D7C7] border-2 border-white/70 overflow-hidden relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <CookieLogo size={36} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[18px] font-semibold text-[#A0522D]">Chа Appssal</div>
              <div className="mt-1 text-[12px] text-[#A0522D]/70">South Korea · INFP</div>
              <div className="mt-2 text-[12px] text-[#A0522D]">
                ★ 4.8 <span className="text-[#A0522D]/70">· 23 reviews</span>
              </div>
              <div className="mt-3 text-[13px] leading-6 text-[#A0522D]/70">
                Licensed Customs Broker in Korea 🇰🇷 | Future Veterinary Nurse in Brisbane 🐾
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-[18px] font-semibold text-[#A0522D]">42</div>
              <div className="text-[11px] text-[#A0522D]/60">Bite Mates</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-semibold text-[#A0522D]">156</div>
              <div className="text-[11px] text-[#A0522D]/60">Cookies Given</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-semibold text-[#A0522D]">6</div>
              <div className="text-[11px] text-[#A0522D]/60">Daily Bites</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
