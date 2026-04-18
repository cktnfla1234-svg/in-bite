import type { ExternalTranslationEntry, PostTranslationMap } from "./types";

const memory: PostTranslationMap = {};

const LS_PREFIX = "inbite:post-translate:v1:";

function storageKey(postId: string) {
  return `${LS_PREFIX}${postId}`;
}

export function getExternalTranslation(postId: string, targetLocale: string): ExternalTranslationEntry | undefined {
  const norm = targetLocale.split("-")[0]?.toLowerCase() ?? "en";
  return memory[postId]?.[norm];
}

/** Call from a future Google Translation API client after a successful response. */
export function setExternalTranslation(
  postId: string,
  targetLocale: string,
  entry: Omit<ExternalTranslationEntry, "targetLocale" | "updatedAt"> & { updatedAt?: string },
): void {
  const norm = targetLocale.split("-")[0]?.toLowerCase() ?? "en";
  if (!memory[postId]) memory[postId] = {};
  const full: ExternalTranslationEntry = {
    ...entry,
    targetLocale: norm,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  };
  memory[postId][norm] = full;
  try {
    window.localStorage.setItem(storageKey(postId), JSON.stringify(memory[postId]));
  } catch {
    // ignore quota
  }
}

export function clearExternalTranslationsForPost(postId: string): void {
  delete memory[postId];
  try {
    window.localStorage.removeItem(storageKey(postId));
  } catch {
    // ignore
  }
}

/** Hydrate from localStorage (per post). Safe to call on app init for hot posts only if needed. */
export function hydratePostTranslationsFromStorage(postId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(storageKey(postId));
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, ExternalTranslationEntry>;
    if (parsed && typeof parsed === "object") memory[postId] = parsed;
  } catch {
    // ignore
  }
}
