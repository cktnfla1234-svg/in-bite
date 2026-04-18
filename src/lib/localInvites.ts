import type { CurrencyCode } from "./currency";
import { isSelectableCurrency } from "./currency";

export type LocalInviteItineraryItem = {
  time: string;
  title: string;
  description: string;
};

export type LocalInvite = {
  id: string;
  title: string;
  location: string;
  city: string;
  locationDetail?: string;
  description: string;
  primaryPhotoUrl: string;
  itinerary: LocalInviteItineraryItem[];
  tasteTags: string[];
  includedOptions: string[];
  /** Tour price in host_currency (fiat). */
  priceAmount: number;
  hostCurrency: CurrencyCode;
  capacity: number;
  meetupAt: string;
  createdAt: string;
};

const LOCAL_INVITES_KEY = "inbite:local-invites";
const LOCAL_INVITES_SYNC_EVENT = "inbite-local-invites-sync";

function coerceLocalInvite(raw: Record<string, unknown>): LocalInvite | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;

  let priceAmount = Number(raw.priceAmount);
  if (!Number.isFinite(priceAmount) || priceAmount < 0) {
    const legacyBites = Number(raw.bites);
    priceAmount = Number.isFinite(legacyBites) ? Math.max(0, legacyBites) * 1000 : 45_000;
  }

  let hostCurrency: CurrencyCode = "KRW";
  const hc = typeof raw.hostCurrency === "string" ? raw.hostCurrency.trim().toUpperCase() : "";
  if (hc && isSelectableCurrency(hc)) hostCurrency = hc;

  return {
    id,
    title: typeof raw.title === "string" ? raw.title : "",
    location: typeof raw.location === "string" ? raw.location : "",
    city: typeof raw.city === "string" ? raw.city : "",
    locationDetail: typeof raw.locationDetail === "string" ? raw.locationDetail : undefined,
    description: typeof raw.description === "string" ? raw.description : "",
    primaryPhotoUrl: typeof raw.primaryPhotoUrl === "string" ? raw.primaryPhotoUrl : "",
    itinerary: Array.isArray(raw.itinerary) ? (raw.itinerary as LocalInviteItineraryItem[]) : [],
    tasteTags: Array.isArray(raw.tasteTags) ? (raw.tasteTags as string[]) : [],
    includedOptions: Array.isArray(raw.includedOptions) ? (raw.includedOptions as string[]) : [],
    priceAmount,
    hostCurrency,
    capacity: Number.isFinite(Number(raw.capacity)) ? Math.max(1, Number(raw.capacity)) : 2,
    meetupAt: typeof raw.meetupAt === "string" ? raw.meetupAt : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

export function getLocalInvites(): LocalInvite[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_INVITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => coerceLocalInvite(item as Record<string, unknown>))
      .filter((x): x is LocalInvite => x != null);
  } catch {
    return [];
  }
}

function persistLocalInvites(next: LocalInvite[]) {
  window.localStorage.setItem(LOCAL_INVITES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(LOCAL_INVITES_SYNC_EVENT));
}

export function addLocalInvite(invite: LocalInvite) {
  if (typeof window === "undefined") return;
  const invites = getLocalInvites();
  invites.unshift(invite);
  persistLocalInvites(invites);
}

export function upsertLocalInvite(invite: LocalInvite) {
  if (typeof window === "undefined") return;
  const cur = getLocalInvites();
  const idx = cur.findIndex((x) => x.id === invite.id);
  if (idx >= 0) {
    cur[idx] = invite;
  } else {
    cur.unshift(invite);
  }
  persistLocalInvites(cur);
}

export function updateLocalInvite(inviteId: string, patch: Partial<LocalInvite>) {
  if (typeof window === "undefined") return;
  const next = getLocalInvites().map((invite) =>
    invite.id === inviteId ? { ...invite, ...patch } : invite,
  );
  persistLocalInvites(next);
}

export function deleteLocalInvite(inviteId: string) {
  if (typeof window === "undefined") return;
  const next = getLocalInvites().filter((invite) => invite.id !== inviteId);
  persistLocalInvites(next);
}

export function subscribeLocalInvitesSync(handler: () => void) {
  window.addEventListener(LOCAL_INVITES_SYNC_EVENT, handler);
  return () => window.removeEventListener(LOCAL_INVITES_SYNC_EVENT, handler);
}

function rankByFrequency(items: string[]): string[] {
  const score = new Map<string, number>();
  for (const item of items) {
    const key = item.trim();
    if (!key) continue;
    score.set(key, (score.get(key) ?? 0) + 1);
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

export function getPopularCitiesFromInvites(limit = 8): string[] {
  return rankByFrequency(getLocalInvites().map((invite) => invite.city)).slice(0, limit);
}

export function getPopularTastesFromInvites(limit = 10): string[] {
  return rankByFrequency(getLocalInvites().flatMap((invite) => invite.tasteTags)).slice(0, limit);
}
