import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getExternalTranslation, hydratePostTranslationsFromStorage } from "./cache";

/**
 * Resolves the body line for a Daily Bite card: external API/cache first, else original author text.
 * When you add Google Translation, call `setExternalTranslation(postId, locale, { text, provider: 'google_cloud' })`.
 */
export function useDisplayPostBody(postId: string, originalBody: string): string {
  const { i18n } = useTranslation();
  const locale = (i18n.language ?? "en").split("-")[0]?.toLowerCase() ?? "en";

  return useMemo(() => {
    hydratePostTranslationsFromStorage(postId);
    const hit = getExternalTranslation(postId, locale);
    if (hit?.text?.trim()) return hit.text;
    return originalBody;
  }, [postId, originalBody, locale]);
}
