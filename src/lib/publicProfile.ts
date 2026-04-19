import { getSupabaseClient } from "./supabase";
import { setProfileAvatar } from "./profileAvatarStore";

export type PublicProfileSnapshot = {
  clerk_id: string;
  display_name: string | null;
  image_url: string | null;
  profile_city: string | null;
  profile_country_code: string | null;
  profile_mbti: string | null;
  profile_hobbies: string | null;
  profile_bio: string | null;
  /** Normalized gallery image URLs or data URLs (from `profiles.profile_gallery`). */
  profile_gallery: string[];
};

function parseProfileGallery(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

function parseRpcPayload(raw: unknown): PublicProfileSnapshot | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const clerk_id = typeof o.clerk_id === "string" ? o.clerk_id : "";
  if (!clerk_id) return null;
  return {
    clerk_id,
    display_name: typeof o.display_name === "string" ? o.display_name : null,
    image_url: typeof o.image_url === "string" ? o.image_url : null,
    profile_city: typeof o.profile_city === "string" ? o.profile_city : null,
    profile_country_code: typeof o.profile_country_code === "string" ? o.profile_country_code : null,
    profile_mbti: typeof o.profile_mbti === "string" ? o.profile_mbti : null,
    profile_hobbies: typeof o.profile_hobbies === "string" ? o.profile_hobbies : null,
    profile_bio: typeof o.profile_bio === "string" ? o.profile_bio : null,
    profile_gallery: parseProfileGallery(o.profile_gallery),
  };
}

export async function fetchPublicProfileByClerkId(
  clerkId: string,
  token: string,
): Promise<PublicProfileSnapshot | null> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("public_profile_for_clerk", { p_clerk_id: clerkId });
  if (error) {
    console.warn("public_profile_for_clerk", error);
    return null;
  }
  return parseRpcPayload(data);
}

/** Fetches public snapshots and updates the local avatar cache for each user. */
export async function prefetchPublicProfileAvatars(clerkIds: string[], token: string): Promise<void> {
  const unique = [...new Set(clerkIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return;
  const results = await Promise.all(
    unique.map(async (id) => {
      const row = await fetchPublicProfileByClerkId(id, token);
      return row;
    }),
  );
  for (const row of results) {
    const url = row?.image_url?.trim();
    if (row?.clerk_id && url) setProfileAvatar(row.clerk_id, url);
  }
}
