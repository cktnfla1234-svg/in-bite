import raw from "@/data/countries-and-cities.json";
import type { AppLocale, LocalizedCity, LocationDataset } from "./types";
import { ensureCountryI18nRegistered } from "./registerCountriesI18n";
import countries from "i18n-iso-countries";

const dataset = raw as LocationDataset;

export function getLocationDataset(): LocationDataset {
  return dataset;
}

export function listAllCountryCodes(): string[] {
  return dataset.countryCodes;
}

export function listCitiesForCountry(iso2: string): LocalizedCity[] {
  return dataset.citiesByCountry[iso2] ?? [];
}

export function getCountryNameEn(iso2: string): string {
  ensureCountryI18nRegistered();
  return countries.getName(iso2, "en") ?? iso2;
}

export function getCountryNameForLocale(iso2: string, locale: AppLocale): string {
  ensureCountryI18nRegistered();
  return countries.getName(iso2, locale) ?? countries.getName(iso2, "en") ?? iso2;
}

export function cityLabel(entry: LocalizedCity, locale: AppLocale): string {
  const v = entry[locale]?.trim();
  if (v) return v;
  return entry.en.trim();
}

export function labelForCityEn(countryCode: string, cityEn: string, locale: AppLocale): string {
  const row = listCitiesForCountry(countryCode).find((c) => c.en === cityEn);
  if (row) return cityLabel(row, locale);
  return cityEn.trim();
}

/** Stored invite/profile location: English city + English country name (comma). */
export function buildStoredLocationEnglish(countryCode: string, cityEn: string): string {
  const city = cityEn.trim();
  const country = getCountryNameEn(countryCode).trim();
  if (!city) return country;
  return `${city}, ${country}`;
}
