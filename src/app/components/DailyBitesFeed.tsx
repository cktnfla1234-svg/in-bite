import { CookieLogo } from "./ui/CookieLogo";

const DAILY_BITES: Array<{ id: string; title: string; meta: string; status: string }> = [];

export function DailyBitesFeed() {
  return (
    <main className="min-h-[100svh] bg-[#FDFAF5] pb-24 pt-10">
      <div className="px-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[26px] font-semibold text-[#A0522D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
              Daily Bites
            </div>
            <div className="mt-1 text-[12px] text-[#A0522D]/60">Fresh invites curated for you</div>
          </div>
          <div className="rounded-2xl bg-white/60 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.05)]">
            <CookieLogo size={28} />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {DAILY_BITES.map((b) => (
            <div
              key={b.id}
              className="rounded-[22px] bg-white/60 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)] flex gap-4"
            >
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#2B1A12] to-[#5D3B24]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-[14px] font-semibold text-[#A0522D]">{b.title}</div>
                  <span className="shrink-0 rounded-full border border-[#EDD5C0] bg-white/70 px-3 py-1 text-[11px] font-semibold text-[#A0522D]/70">
                    Guest
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-[#A0522D]/60">📅 {b.meta}</div>
                <div className="mt-1 text-[12px] text-[#A0522D]/60">⬤ {b.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
