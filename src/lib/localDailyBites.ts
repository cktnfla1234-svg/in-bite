import type { DailyBitePost } from "@/data/experiences";

export type LocalDailyBite = {
  id: string;
  authorName: string;
  authorBio: string;
  text: string;
  city: string;
  createdAt: string;
  photoUrls?: string[];
  authorImageUrl?: string;
  likeCount?: number;
  commentCount?: number;
  authorClerkId?: string;
};

const LOCAL_DAILY_BITES_KEY = "inbite:local-daily-bites";
const LOCAL_DAILY_BITES_SYNC_EVENT = "inbite-local-daily-bites-sync";

export function getLocalDailyBites(): LocalDailyBite[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_DAILY_BITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LocalDailyBite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLocalDailyBites(next: LocalDailyBite[]) {
  try {
    window.localStorage.setItem(LOCAL_DAILY_BITES_KEY, JSON.stringify(next));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      throw new Error(
        "This post is too large for your device storage. Try fewer photos, smaller images, or a shorter message.",
      );
    }
    throw e instanceof Error ? e : new Error("Failed to save daily bite.");
  }
  window.dispatchEvent(new Event(LOCAL_DAILY_BITES_SYNC_EVENT));
}

export function addLocalDailyBite(bite: LocalDailyBite) {
  if (typeof window === "undefined") return;
  const next = [bite, ...getLocalDailyBites()];
  persistLocalDailyBites(next);
}

export function updateLocalDailyBite(
  biteId: string,
  updater: (prev: LocalDailyBite) => LocalDailyBite,
) {
  if (typeof window === "undefined") return;
  if (!biteId) return;
  const next = getLocalDailyBites().map((bite) => (bite.id === biteId ? updater(bite) : bite));
  persistLocalDailyBites(next);
}

export function deleteLocalDailyBite(biteId: string) {
  if (typeof window === "undefined") return;
  if (!biteId) return;
  const next = getLocalDailyBites().filter((bite) => bite.id !== biteId);
  persistLocalDailyBites(next);
}

export function updateLocalDailyBiteAuthorAvatar(clerkId: string, authorImageUrl: string) {
  if (typeof window === "undefined") return;
  if (!clerkId) return;
  const next = getLocalDailyBites().map((bite) =>
    bite.authorClerkId === clerkId ? { ...bite, authorImageUrl } : bite,
  );
  persistLocalDailyBites(next);
}

export function subscribeLocalDailyBitesSync(handler: () => void) {
  window.addEventListener(LOCAL_DAILY_BITES_SYNC_EVENT, handler);
  return () => window.removeEventListener(LOCAL_DAILY_BITES_SYNC_EVENT, handler);
}

export function toDailyBitePost(bite: LocalDailyBite): DailyBitePost {
  return {
    id: bite.id,
    authorName: bite.authorName,
    authorBio: bite.authorBio,
    text: bite.text,
    city: bite.city,
    createdLabel: formatRelativeLabel(bite.createdAt),
    createdAtIso: bite.createdAt,
    photoUrls: bite.photoUrls ?? [],
    authorImageUrl: bite.authorImageUrl,
    likeCount: bite.likeCount ?? 0,
    commentCount: bite.commentCount ?? 0,
    authorClerkId: bite.authorClerkId,
  };
}

function formatRelativeLabel(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Just now";
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < minute) return "Just now";
  if (ms < hour) return `${Math.floor(ms / minute)}m ago`;
  if (ms < day) return `${Math.floor(ms / hour)}h ago`;
  return `${Math.floor(ms / day)}d ago`;
}
