/**
 * User-generated text (e.g. Daily Bite body) can be shown alongside or instead of i18n `t()` strings.
 * Machine translation (Google Cloud Translation, etc.) should store rows here — never mix with UI strings.
 */

export type TranslationProviderId = "google_cloud" | "deepl" | "manual" | "other";

export type ExternalTranslationEntry = {
  /** Translated text for `targetLocale` */
  text: string;
  /** BCP 47 primary tag, e.g. en, ko, de */
  targetLocale: string;
  provider: TranslationProviderId;
  /** ISO time when translation was produced */
  updatedAt: string;
  /** Optional: hash or id of source snapshot for invalidation */
  sourceFingerprint?: string;
};

/** postId → locale → entry */
export type PostTranslationMap = Record<string, Record<string, ExternalTranslationEntry>>;
