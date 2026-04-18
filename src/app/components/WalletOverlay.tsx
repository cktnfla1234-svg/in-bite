import { useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { applyBiteDeltaServer } from "@/lib/profile";
import type { BiteHistoryRow } from "@/lib/profile";
import { BITE_BUNDLE_AMOUNT, BITE_BUNDLE_PRICE_KRW } from "@/lib/bitePolicy";
import { formatLedgerDateLabel, roundBiteDisplay } from "@/lib/wallet";

type WalletOverlayProps = {
  balance: number;
  biteHistory: BiteHistoryRow[];
  onClose: () => void;
  onRefresh: () => void;
};

export function WalletOverlay({ balance, biteHistory, onClose, onRefresh }: WalletOverlayProps) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePurchaseBundle = async () => {
    if (!user?.id) return;
    setNotice(null);
    setBusy(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) {
        window.dispatchEvent(
          new CustomEvent("inbite-apply-bite", {
            detail: {
              clerkId: user.id,
              delta: BITE_BUNDLE_AMOUNT,
              kind: "purchase_bundle",
              meta: { krw_price: BITE_BUNDLE_PRICE_KRW, note: "bundle_demo_local" },
            },
          }),
        );
        setNotice(
          `에너지 +${BITE_BUNDLE_AMOUNT} BITE가 로컬에 반영되었습니다. 상점 연동 후에는 ₩${BITE_BUNDLE_PRICE_KRW.toLocaleString()}에 동일 묶음을 받을 수 있어요.`,
        );
        onRefresh();
        return;
      }
      await applyBiteDeltaServer(user.id, token, BITE_BUNDLE_AMOUNT, "purchase_bundle", {
        krw_price: BITE_BUNDLE_PRICE_KRW,
      });
      setNotice(`에너지 +${BITE_BUNDLE_AMOUNT} BITE가 적립되었습니다. (₩${BITE_BUNDLE_PRICE_KRW.toLocaleString()} 묶음)`);
      onRefresh();
    } catch {
      setNotice("적립에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[520px] rounded-[28px] bg-[#FDFAF5] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between">
        <div className="text-[24px] font-semibold text-[#A0522D]" style={{ fontFamily: "'Patrick Hand', cursive" }}>
          My Energy
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-[#A0522D]"
          aria-label="Close wallet overlay"
        >
          ×
        </button>
      </div>

      <div className="mt-4 rounded-[22px] bg-[#A0522D] p-5 text-white">
        <div className="text-[12px] font-semibold text-white/80">BITE balance</div>
        <div className="mt-2 text-[44px] font-semibold leading-none">
          {roundBiteDisplay(balance)}{" "}
          <span className="text-[14px] font-semibold text-white/90">BITE</span>
        </div>
        <p className="mt-3 text-[12px] leading-5 text-white/90">
          BITE는 인바이트 안에서 활동 품질을 돕는 <span className="font-semibold">플랫폼 에너지</span>입니다. 유저 간 현금
          거래나 환전은 없습니다.
        </p>
      </div>

      <div className="mt-4 rounded-[22px] border border-[#EDD5C0] bg-white/75 p-4">
        <div className="text-[13px] font-semibold text-[#A0522D]">에너지 충전 (수익 모델)</div>
        <p className="mt-2 text-[12px] leading-5 text-[#A0522D]/75">
          ₩{BITE_BUNDLE_PRICE_KRW.toLocaleString()}에 <span className="font-semibold">+{BITE_BUNDLE_AMOUNT} BITE</span> 에너지
          묶음을 구매할 수 있어요. 상점 연동 전에는 아래 버튼으로 데모 적립만 될 수 있어요.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handlePurchaseBundle()}
          className="mt-3 w-full rounded-2xl bg-[#A0522D] py-3 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(160,82,45,0.25)] disabled:opacity-60"
        >
          {busy ? "처리 중…" : `₩${BITE_BUNDLE_PRICE_KRW.toLocaleString()} 에너지 묶음 받기`}
        </button>
      </div>

      {notice ? (
        <p className="mt-3 rounded-xl border border-[#EDD5C0] bg-white/80 px-3 py-2 text-[12px] text-[#5C4033]">{notice}</p>
      ) : null}

      <div className="mt-5">
        <div className="text-[14px] font-semibold text-[#A0522D]/90">에너지 내역</div>
        <div className="mt-3 max-h-[240px] space-y-2 overflow-y-auto pr-1">
          {biteHistory.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#E5D8CC] bg-white/60 p-4 text-center text-[12px] text-[#A0522D]/60">
              아직 기록이 없습니다.
            </div>
          ) : (
            biteHistory.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-[18px] border border-[#EDD5C0] bg-white/60 px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold capitalize text-[#A0522D]">
                    {row.kind.replace(/_/g, " ")}
                  </div>
                  <div className="text-[11px] text-[#A0522D]/60">📅 {formatLedgerDateLabel(row.created_at)}</div>
                </div>
                <div
                  className={`shrink-0 text-[14px] font-semibold ${
                    Number(row.delta) >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {Number(row.delta) > 0 ? "+" : ""}
                  {row.delta}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
