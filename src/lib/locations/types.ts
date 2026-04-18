export type AppLocale = "en" | "ko" | "de" | "ja" | "zh";

export type LocalizedCity = {
  en: string;
  ko?: string;
  de?: string;
  ja?: string;
  zh?: string;
};

export type LocationDataset = {
  version: number;
  generatedAt: string;
  citiesByCountry: Record<string, LocalizedCity[]>;
  countryCodes: string[];
};
