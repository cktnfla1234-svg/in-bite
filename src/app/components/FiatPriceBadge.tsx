import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  convertFiatAmount,
  formatFiat,
  type CurrencyCode,
} from "@/lib/currency";

type FiatPriceBadgeProps = {
  priceAmount: number;
  hostCurrency: string;
  preferredCurrency: CurrencyCode;
  /** `pill` = badge on imagery; `inline` = plain bold text (e.g. card footer). */
  variant?: "pill" | "inline";
  className?: string;
};

type DisplayState =
  | { kind: "loading" }
  | { kind: "same"; text: string }
  | { kind: "converted"; text: string }
  | { kind: "fallback"; text: string };

export function FiatPriceBadge({
  priceAmount,
  hostCurrency,
  preferredCurrency,
  variant = "pill",
  className = "",
}: FiatPriceBadgeProps) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<DisplayState>({ kind: "loading" });
  const isZeroPrice = Number.isFinite(priceAmount) && priceAmount === 0;

  useEffect(() => {
    let cancelled = false;
    const host = hostCurrency.toUpperCase();
    const pref = preferredCurrency.toUpperCase();

    if (isZeroPrice) return;

    if (!Number.isFinite(priceAmount) || priceAmount < 0) {
      setState({ kind: "fallback", text: formatFiat(0, host) });
      return;
    }

    if (host === pref) {
      setState({ kind: "same", text: formatFiat(priceAmount, host) });
      return;
    }

    setState({ kind: "loading" });
    void (async () => {
      try {
        const converted = await convertFiatAmount(priceAmount, host, pref);
        if (cancelled) return;
        if (converted == null) {
          setState({ kind: "fallback", text: formatFiat(priceAmount, host) });
          return;
        }
        const formatted = formatFiat(converted, pref);
        setState({
          kind: "converted",
          text: formatted,
        });
      } catch {
        if (!cancelled) {
          setState({ kind: "fallback", text: formatFiat(priceAmount, host) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [priceAmount, hostCurrency, preferredCurrency, isZeroPrice]);

  if (isZeroPrice) {
    const hint = t("price_zero_hint");
    if (variant === "inline") {
      return (
        <div
          className={`flex items-center justify-end gap-1 text-right ${className}`}
          title={hint}
        >
          <span className="shrink-0 text-[11px] leading-none" aria-hidden>
            🍪
          </span>
          <span className="max-w-[12rem] text-[10px] font-medium leading-snug text-gray-500">{hint}</span>
        </div>
      );
    }
    return (
      <div
        className={`inline-flex max-w-[min(100%,240px)] items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 ${className}`}
        title={hint}
      >
        <span className="shrink-0 text-[11px] leading-none" aria-hidden>
          🍪
        </span>
        <span className="text-[10px] font-medium leading-snug text-gray-500">{hint}</span>
      </div>
    );
  }

  const inner =
    state.kind === "loading" ? (
      <span className={variant === "inline" ? "tabular-nums text-[13px] opacity-45" : "tabular-nums opacity-70"}>
        ···
      </span>
    ) : (
      <span className="tabular-nums">{state.text}</span>
    );

  const tooltip =
    state.kind === "converted" || state.kind === "same"
      ? `Host price: ${formatFiat(priceAmount, hostCurrency)}`
      : undefined;

  if (variant === "inline") {
    return (
      <div
        className={`text-right text-[clamp(1.05rem,4.5vw,1.35rem)] font-bold leading-snug text-[#A0522D] tabular-nums ${className}`}
        title={tooltip}
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-[12px] font-semibold text-[#A0522D] ${className}`}
      title={tooltip}
    >
      <span aria-hidden="true">
        {state.kind === "loading" ? "💱" : "💵"}
      </span>
      {inner}
    </div>
  );
}
