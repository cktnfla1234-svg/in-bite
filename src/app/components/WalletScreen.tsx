import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { getWalletBalance, roundBiteDisplay, WALLET_BALANCE_SYNC } from "@/lib/wallet";

export function WalletScreen() {
  const { user } = useUser();
  const uid = user?.id ?? null;
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const read = () => setBalance(getWalletBalance(uid));
    read();
    const onSync = (e: Event) => {
      const id = (e as CustomEvent<{ clerkUserId: string | null }>).detail?.clerkUserId;
      if (id === uid || (uid == null && id == null)) read();
    };
    window.addEventListener(WALLET_BALANCE_SYNC, onSync as EventListener);
    return () => window.removeEventListener(WALLET_BALANCE_SYNC, onSync as EventListener);
  }, [uid]);

  return (
    <main className="min-h-[100svh] bg-[#FDFAF5] pb-24 pt-6">
      <div className="px-5">
        <div className="text-[26px] font-semibold text-[#A0522D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          My Energy
        </div>

        <div className="mt-5 rounded-[26px] bg-white/60 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[12px] font-semibold text-[#A0522D]/70">BITE balance</div>
              <div className="mt-1 inline-block rounded-2xl bg-[#A0522D] px-4 py-2 text-[40px] font-semibold text-white shadow-[0_18px_45px_rgba(160,82,45,0.22)]">
                {roundBiteDisplay(balance)}
                <span className="ml-2 text-[14px] font-semibold text-white/90">BITE</span>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[#A0522D]/70">
                플랫폼 활동 에너지예요. 유저 간 송금·환전은 없습니다. 프로필의 지갑에서 기록을 볼 수 있어요.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#A0522D] shadow-[0_18px_45px_rgba(160,82,45,0.25)]">
              <span aria-hidden="true" className="text-2xl text-white">
                🍪
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[14px] font-semibold text-[#A0522D]/80">Recent activity</div>
          <div className="mt-3 space-y-3">
            {[{ title: "Welcome cookie 🍪", date: "—", delta: "+5" }].map((x) => (
              <div
                key={x.title}
                className="flex items-center justify-between gap-4 rounded-[22px] bg-white/60 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.05)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#EDD5C0] bg-white/70">
                    <span aria-hidden="true">🍪</span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-[#A0522D]">{x.title}</div>
                    <div className="text-[12px] text-[#A0522D]/60">Full history is in the profile wallet overlay.</div>
                  </div>
                </div>
                <div className="shrink-0 text-[14px] font-semibold text-[#A0522D]">{x.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
