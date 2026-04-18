import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en/common.json";
import ko from "@/locales/ko/common.json";
import de from "@/locales/de/common.json";
import { APP_LOCALES, normalizeAppLocale, type AppLocale } from "./appLocales";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: [...APP_LOCALES],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    resources: {
      en: { common: en },
      ko: { common: ko },
      de: { common: de },
      ja: { common: en },
      zh: { common: en },
    },
    defaultNS: "common",
    ns: ["common"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "inbite_locale",
    },
  });

/** After profile or user action, keep detector storage aligned. */
export function persistAppLocale(lng: AppLocale) {
  try {
    window.localStorage.setItem("inbite_locale", lng);
  } catch {
    // ignore
  }
}

export function applyLocaleFromServer(code: string | null | undefined): AppLocale {
  const next = normalizeAppLocale(code ?? undefined);
  void i18n.changeLanguage(next);
  persistAppLocale(next);
  return next;
}

export default i18n;
