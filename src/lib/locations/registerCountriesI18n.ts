import countries, { type LocaleData } from "i18n-iso-countries";
import de from "i18n-iso-countries/langs/de.json";
import en from "i18n-iso-countries/langs/en.json";
import ja from "i18n-iso-countries/langs/ja.json";
import ko from "i18n-iso-countries/langs/ko.json";
import zh from "i18n-iso-countries/langs/zh.json";

let registered = false;

export function ensureCountryI18nRegistered(): void {
  if (registered) return;
  registered = true;
  countries.registerLocale(en as LocaleData);
  countries.registerLocale(ko as LocaleData);
  countries.registerLocale(de as LocaleData);
  countries.registerLocale(ja as LocaleData);
  countries.registerLocale(zh as LocaleData);
}
