import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  SELECTABLE_CURRENCIES,
  formatFiat,
  fractionDigitsFor,
  type CurrencyCode,
} from "@/lib/currency";

const CAPACITY_MIN = 1;
const CAPACITY_MAX = 20;

export type InvitePriceCapacityMeetupFieldsProps = {
  hostCurrency: CurrencyCode;
  onHostCurrencyChange?: (code: CurrencyCode) => void;
  priceAmount: number;
  onPriceAmountChange: (n: number) => void;
  capacity: number;
  onCapacityChange: (n: number) => void;
  meetupAt: string;
  onMeetupAtChange: (v: string) => void;
  /** When true, meet-up is "to be decided" and the datetime control is disabled. */
  meetupTbd: boolean;
  onMeetupTbdChange: (v: boolean) => void;
  /** Extra classes on the outer stack wrapper (e.g. spacing). */
  className?: string;
};

/** Map stored meetup (ISO or datetime-local) to `datetime-local` input value in local time. */
export function meetupForDatetimeInput(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${da}T${h}:${mi}`;
}

export function InvitePriceCapacityMeetupFields({
  hostCurrency,
  onHostCurrencyChange,
  priceAmount,
  onPriceAmountChange,
  capacity,
  onCapacityChange,
  meetupAt,
  onMeetupAtChange,
  meetupTbd,
  onMeetupTbdChange,
  className = "",
}: InvitePriceCapacityMeetupFieldsProps) {
  const { t } = useTranslation("common");

  const { inputStep, inputMode } = useMemo(() => {
    if (fractionDigitsFor(hostCurrency) === 0) {
      return { inputStep: "1", inputMode: "numeric" as const };
    }
    return { inputStep: "0.01", inputMode: "decimal" as const };
  }, [hostCurrency]);

  const safeCapacity = Math.min(
    CAPACITY_MAX,
    Math.max(CAPACITY_MIN, Number.isFinite(capacity) ? Math.floor(capacity) : CAPACITY_MIN),
  );

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      <div className="rounded-[22px] bg-white/70 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <div className="text-[12px] font-semibold text-[#A0522D]/70">{t("inviteFields.tourPriceFiat")}</div>
        {onHostCurrencyChange ? (
          <label className="mt-3 block text-[12px] font-semibold text-[#A0522D]/70">
            {t("inviteFields.priceCurrency")}
            <select
              className="mt-1.5 w-full rounded-xl border border-[#EDD5C0] bg-white px-3 py-2.5 text-[14px] text-[#2C1A0E] outline-none focus:border-[#A0522D]/50"
              value={hostCurrency}
              onChange={(e) => onHostCurrencyChange(e.target.value as CurrencyCode)}
            >
              {SELECTABLE_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-3 rounded-xl border border-[#EDD5C0] bg-white px-3 py-4">
          <div className="text-center">
            <div className="text-[11px] font-semibold text-[#A0522D]/65">{hostCurrency}</div>
            <div className="mt-1 text-[clamp(1.15rem,4.5vw,1.45rem)] font-semibold leading-tight text-[#A0522D] tabular-nums">
              {formatFiat(priceAmount, hostCurrency)}
            </div>
          </div>
          <label className="mt-4 block text-[12px] font-semibold text-[#A0522D]/70" htmlFor="invite-price-input-shared">
            {t("inviteFields.tourPriceFiat")}
            <input
              id="invite-price-input-shared"
              type="number"
              inputMode={inputMode}
              min={0}
              step={inputStep}
              value={Number.isFinite(priceAmount) ? priceAmount : 0}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                onPriceAmountChange(Math.max(0, raw));
              }}
              className="mt-1.5 w-full rounded-xl border border-[#EDD5C0] bg-white px-3 py-2.5 text-[14px] text-[#2C1A0E] outline-none focus:border-[#A0522D]/50"
            />
          </label>
        </div>
      </div>

      <div className="rounded-[22px] bg-white/70 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <div className="text-[12px] font-semibold text-[#A0522D]/70">{t("inviteFields.maxGuests")}</div>
        <div className="mt-3 rounded-xl border border-[#EDD5C0] bg-white px-3 py-4">
          <div className="text-center">
            <div className="text-[clamp(1.15rem,4.5vw,1.45rem)] font-semibold leading-tight text-[#A0522D] tabular-nums">
              {safeCapacity}
            </div>
          </div>
          <label className="mt-4 block" htmlFor="invite-capacity-slider-shared">
            <span className="sr-only">{t("inviteFields.maxGuests")}</span>
            <input
              id="invite-capacity-slider-shared"
              type="range"
              min={CAPACITY_MIN}
              max={CAPACITY_MAX}
              step={1}
              value={safeCapacity}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                onCapacityChange(Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, Math.floor(raw))));
              }}
              className="mt-3 h-3 w-full cursor-pointer accent-[#A0522D]"
            />
          </label>
          <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-[#A0522D]/50 tabular-nums">
            <span>{CAPACITY_MIN}</span>
            <span>{CAPACITY_MAX}</span>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] bg-white/70 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <div className="text-[12px] font-semibold text-[#A0522D]/70">{t("inviteFields.meetupDateTime")}</div>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#EDD5C0] bg-white px-3 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#A0522D]"
            checked={meetupTbd}
            onChange={(e) => {
              const next = e.target.checked;
              onMeetupTbdChange(next);
              if (next) onMeetupAtChange("");
            }}
          />
          <span>
            <span className="block text-[13px] font-semibold text-[#2C1A0E]">{t("inviteFields.meetupTbd")}</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-[#A0522D]/65">{t("inviteFields.meetupTbdHint")}</span>
          </span>
        </label>
        <div
          className={`mt-3 rounded-xl border border-[#EDD5C0] bg-white px-3 py-3 ${
            meetupTbd ? "bg-[#FDFAF5]/90 opacity-80" : ""
          }`}
        >
          <input
            type="datetime-local"
            disabled={meetupTbd}
            className="w-full bg-transparent text-[14px] text-[#2C1A0E] outline-none disabled:cursor-not-allowed"
            value={meetupTbd ? "" : meetupAt}
            onChange={(e) => onMeetupAtChange(e.target.value)}
          />
          {meetupTbd ? (
            <div className="mt-1 text-[12px] font-medium text-[#A0522D]/60">{t("inviteFields.meetupTbdBadge")}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
