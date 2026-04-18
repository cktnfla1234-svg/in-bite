/**
 * Fiat formatting + FX via Frankfurter (ECB, no API key, browser-fetchable).
 * @see https://www.frankfurter.dev/
 */

export const SELECTABLE_CURRENCIES = [
  { code: "KRW", label: "KRW — 대한민국 원" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "THB", label: "THB — Thai Baht" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
] as const;

export type CurrencyCode = (typeof SELECTABLE_CURRENCIES)[number]["code"];

const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

const FRANKFURTER = "https://api.frankfurter.app";

/**
 * Offline/failure fallback rates (rough estimates) to keep preferred-currency UX stable.
 * Values represent KRW per 1 unit of currency.
 */
const FALLBACK_KRW_PER_UNIT: Record<string, number> = {
  KRW: 1,
  JPY: 9.2,
  USD: 1350,
  EUR: 1470,
  AUD: 900,
  GBP: 1710,
  THB: 37,
  SGD: 1000,
  CAD: 980,
  NZD: 820,
};

type RatesCacheEntry = { at: number; rates: Record<string, number> };
const ratesByBase = new Map<string, RatesCacheEntry>();
const CACHE_MS = 60 * 60 * 1000;

export function isSelectableCurrency(code: string): code is CurrencyCode {
  return SELECTABLE_CURRENCIES.some((c) => c.code === code);
}

export function localeHintForCurrency(code: string): string | undefined {
  switch (code) {
    case "KRW":
      return "ko-KR";
    case "JPY":
      return "ja-JP";
    case "EUR":
      return "de-DE";
    case "GBP":
      return "en-GB";
    case "AUD":
      return "en-AU";
    case "THB":
      return "th-TH";
    case "SGD":
      return "en-SG";
    case "CAD":
      return "en-CA";
    case "NZD":
      return "en-NZ";
    case "USD":
      return "en-US";
    default:
      return undefined;
  }
}

export function fractionDigitsFor(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

export function formatFiat(amount: number, currency: string, locale?: string): string {
  const code = currency.toUpperCase();
  const loc = locale ?? localeHintForCurrency(code);
  const digits = fractionDigitsFor(code);
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(digits)}`;
  }
}

export async function fetchLatestRates(base: string): Promise<Record<string, number>> {
  const upper = base.toUpperCase();
  const cached = ratesByBase.get(upper);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.rates;
  }

  const url = `${FRANKFURTER}/latest?from=${encodeURIComponent(upper)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`rates_http_${res.status}`);
  }
  const body = (await res.json()) as { rates?: Record<string, number> };
  const rates = body.rates ?? {};
  ratesByBase.set(upper, { at: Date.now(), rates });
  return rates;
}

/**
 * Converts `amount` of `from` currency into `to` using Frankfurter `from` latest table.
 */
export async function convertFiatAmount(
  amount: number,
  from: string,
  to: string,
): Promise<number | null> {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;

  try {
    const rates = await fetchLatestRates(f);
    const rate = rates[t];
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      const fallback = convertWithFallbackRates(amount, f, t);
      return fallback;
    }
    const raw = amount * rate;
    return fractionDigitsFor(t) === 0 ? Math.round(raw) : Math.round(raw * 100) / 100;
  } catch {
    return convertWithFallbackRates(amount, f, t);
  }
}

function convertWithFallbackRates(amount: number, from: string, to: string): number | null {
  const fromKrw = FALLBACK_KRW_PER_UNIT[from];
  const toKrw = FALLBACK_KRW_PER_UNIT[to];
  if (!Number.isFinite(fromKrw) || !Number.isFinite(toKrw) || toKrw <= 0) {
    return null;
  }
  const valueInKrw = amount * fromKrw;
  const converted = valueInKrw / toKrw;
  return fractionDigitsFor(to) === 0 ? Math.round(converted) : Math.round(converted * 100) / 100;
}

export function approxPrefixForPreferred(preferredCurrency: string): string {
  return preferredCurrency.toUpperCase() === "KRW" ? "약 " : "≈ ";
}
