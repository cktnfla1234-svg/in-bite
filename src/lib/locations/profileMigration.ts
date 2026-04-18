import type { EditableProfile } from "@/app/components/ProfileEditSheet";
import countries from "i18n-iso-countries";
import { getCountryNameEn } from "./dataset";
import { ensureCountryI18nRegistered } from "./registerCountriesI18n";

const LEGACY_COUNTRY_TO_ISO: Record<string, string> = {
  Korea: "KR",
  Japan: "JP",
  Australia: "AU",
  France: "FR",
  Spain: "ES",
  USA: "US",
  "United States": "US",
  Germany: "DE",
  Italy: "IT",
  "United Kingdom": "GB",
  UK: "GB",
  Canada: "CA",
  China: "CN",
  Taiwan: "TW",
  Thailand: "TH",
  Vietnam: "VN",
  Singapore: "SG",
  Malaysia: "MY",
  Indonesia: "ID",
  Philippines: "PH",
  India: "IN",
  Mexico: "MX",
  Brazil: "BR",
};

export function normalizeCountryCode(raw: string | undefined): string | null {
  if (!raw) return null;
  const u = raw.trim().toUpperCase();
  if (u.length === 2 && /^[A-Z]{2}$/.test(u)) return u;
  return null;
}

/** Merge legacy localStorage profile into { countryCode, country, city }. */
export function migrateEditableProfileLocation(parsed: Partial<EditableProfile> & { countryCode?: string }): {
  countryCode: string;
  country: string;
  city: string;
} {
  ensureCountryI18nRegistered();
  const fromName = parsed.country?.trim()
    ? (countries.getAlpha2Code(parsed.country.trim(), "en") as string | undefined)
    : undefined;
  let countryCode =
    normalizeCountryCode(parsed.countryCode) ??
    (parsed.country ? LEGACY_COUNTRY_TO_ISO[parsed.country.trim()] ?? null : null) ??
    normalizeCountryCode(fromName) ??
    "KR";
  const city = (parsed.city ?? "Seoul").trim() || "Seoul";
  const country = getCountryNameEn(countryCode);
  return { countryCode, country, city };
}
