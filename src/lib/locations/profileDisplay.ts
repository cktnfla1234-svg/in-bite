import type { EditableProfile } from "@/app/components/ProfileEditSheet";
import type { AppLocale } from "./types";
import { getCountryNameForLocale, labelForCityEn } from "./dataset";

export function formatProfileLocationDisplay(profile: EditableProfile, locale: AppLocale): string {
  const country = getCountryNameForLocale(profile.countryCode, locale);
  const city = labelForCityEn(profile.countryCode, profile.city, locale);
  return [city, country].filter(Boolean).join(", ");
}
