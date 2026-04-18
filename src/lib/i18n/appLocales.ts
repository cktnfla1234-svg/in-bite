export const APP_LOCALES = ["en", "ko", "de", "ja", "zh"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "ko" || value === "de" || value === "ja" || value === "zh";
}

/** Map DB / browser tags to a supported app locale; unsupported → en */
export function normalizeAppLocale(raw: string | null | undefined): AppLocale {
  if (!raw || typeof raw !== "string") return "en";
  const base = raw.trim().toLowerCase().split("-")[0] ?? "en";
  if (base === "ko") return "ko";
  if (base === "de") return "de";
  if (base === "ja") return "ja";
  if (base === "zh") return "zh";
  return "en";
}

export const LANGUAGE_OPTIONS: {
  code: AppLocale;
  /** Shown in UI (native name) */
  label: string;
  flag: string;
}[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];
