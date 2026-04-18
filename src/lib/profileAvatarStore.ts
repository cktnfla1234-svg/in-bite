import { getSupabaseClient } from "./supabase";

const PROFILE_AVATAR_MAP_KEY = "inbite:profile-avatar-map:v1";
const PROFILE_AVATAR_SYNC_EVENT = "inbite-profile-avatar-sync";

type AvatarMap = Record<string, string>;

function readAvatarMap(): AvatarMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_AVATAR_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as AvatarMap;
  } catch {
    return {};
  }
}

function writeAvatarMap(next: AvatarMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_AVATAR_MAP_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PROFILE_AVATAR_SYNC_EVENT));
}

export function getProfileAvatar(clerkId?: string | null): string | undefined {
  if (!clerkId) return undefined;
  const map = readAvatarMap();
  const value = map[clerkId];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function setProfileAvatar(clerkId: string, imageUrl: string) {
  if (!clerkId || typeof window === "undefined") return;
  const map = readAvatarMap();
  const next = { ...map, [clerkId]: imageUrl };
  writeAvatarMap(next);
}

export function subscribeProfileAvatarSync(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PROFILE_AVATAR_SYNC_EVENT, handler);
  return () => window.removeEventListener(PROFILE_AVATAR_SYNC_EVENT, handler);
}

export async function subscribeProfileAvatarRealtime(
  onAvatar: (clerkId: string, imageUrl: string) => void,
  accessToken?: string,
) {
  const supabase = getSupabaseClient(accessToken);
  const channel = supabase
    .channel("profiles-avatar-changes")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
      const row = payload.new as Record<string, unknown>;
      const clerkId = typeof row.clerk_id === "string" ? row.clerk_id : "";
      const imageUrlRaw =
        typeof row.avatar_url === "string"
          ? row.avatar_url
          : typeof row.image_url === "string"
            ? row.image_url
            : "";
      if (!clerkId) return;
      setProfileAvatar(clerkId, imageUrlRaw);
      onAvatar(clerkId, imageUrlRaw);
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
