import type { DailyBitePost } from "@/data/experiences";
import { getSupabaseClient } from "./supabase";

type DailyBiteDbRow = {
  id: string;
  author_clerk_id: string;
  author_name: string;
  author_bio: string;
  body: string;
  city: string;
  photo_urls: unknown;
  author_image_url: string | null;
  likes_count: number | null;
  comments_count: number | null;
  created_at: string;
};

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

export function dailyBiteRowToPost(row: DailyBiteDbRow): DailyBitePost {
  const raw = row.photo_urls;
  const photos = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  const authorClerkRaw = row.author_clerk_id;
  const authorClerkId =
    authorClerkRaw == null || authorClerkRaw === ""
      ? undefined
      : String(authorClerkRaw).trim() || undefined;
  return {
    id: row.id,
    authorName: row.author_name || "Member",
    authorBio: row.author_bio || "",
    text: row.body || "",
    city: row.city || "Local",
    createdLabel: formatRelativeLabel(row.created_at),
    createdAtIso: row.created_at,
    photoUrls: photos,
    authorImageUrl: row.author_image_url ?? undefined,
    likeCount: Number(row.likes_count ?? 0),
    commentCount: Number(row.comments_count ?? 0),
    authorClerkId,
  };
}

const SELECT_FIELDS =
  "id, author_clerk_id, author_name, author_bio, body, city, photo_urls, author_image_url, likes_count, comments_count, created_at";

function mapFeedRowsToPosts(data: unknown): DailyBitePost[] {
  if (!Array.isArray(data)) return [];
  return (data as DailyBiteDbRow[]).map((r) => dailyBiteRowToPost(r));
}

async function fetchPublicDailyBitesLegacy(limit: number): Promise<DailyBitePost[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("daily_bites")
    .select(SELECT_FIELDS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("fetchPublicDailyBites", error);
    return [];
  }
  return (data ?? []).map((r) => dailyBiteRowToPost(r as DailyBiteDbRow));
}

async function fetchOwnDailyBitesLegacy(token: string, clerkId: string, limit: number): Promise<DailyBitePost[]> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("daily_bites")
    .select(SELECT_FIELDS)
    .eq("author_clerk_id", clerkId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("fetchOwnDailyBites", error);
    return [];
  }
  return (data ?? []).map((r) => dailyBiteRowToPost(r as DailyBiteDbRow));
}

/**
 * Prefer SQL `fetch_public_daily_bites_feed` (profiles JOIN + denormalized like/comment counts in one call).
 * Falls back to plain `.select()` if the RPC is not deployed yet.
 */
export async function fetchPublicDailyBites(limit = 80): Promise<DailyBitePost[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("fetch_public_daily_bites_feed", { p_limit: limit });
  if (!error && data != null) {
    const rows = Array.isArray(data) ? data : [data];
    return mapFeedRowsToPosts(rows);
  }
  if (error) console.warn("fetch_public_daily_bites_feed", error);
  return fetchPublicDailyBitesLegacy(limit);
}

export async function fetchOwnDailyBites(token: string, clerkId: string, limit = 120): Promise<DailyBitePost[]> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("fetch_own_daily_bites_feed", {
    p_clerk_id: clerkId,
    p_limit: limit,
  });
  if (!error && data != null) {
    const rows = Array.isArray(data) ? data : [data];
    return mapFeedRowsToPosts(rows);
  }
  if (error) console.warn("fetch_own_daily_bites_feed", error);
  return fetchOwnDailyBitesLegacy(token, clerkId, limit);
}

export async function insertDailyBitePost(
  token: string,
  input: {
    id: string;
    authorClerkId: string;
    authorName: string;
    authorBio: string;
    body: string;
    city: string;
    photoUrls: string[];
    authorImageUrl?: string;
    createdAt: string;
  },
) {
  const supabase = getSupabaseClient(token);
  if (!supabase) {
    throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  const nowIso = input.createdAt;
  const { error } = await supabase.from("daily_bites").insert({
    id: input.id,
    author_clerk_id: input.authorClerkId,
    author_name: input.authorName,
    author_bio: input.authorBio,
    body: input.body,
    city: input.city,
    photo_urls: input.photoUrls,
    author_image_url: input.authorImageUrl ?? null,
    likes_count: 0,
    comments_count: 0,
    created_at: nowIso,
    updated_at: nowIso,
  });
  if (error?.code === "23505") return;
  if (error) throw error;
}

export async function updateDailyBitePost(
  token: string,
  biteId: string,
  input: { body: string; city: string; authorBio: string; photoUrls: string[] },
) {
  const supabase = getSupabaseClient(token);
  if (!supabase) {
    throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  const { error } = await supabase
    .from("daily_bites")
    .update({
      body: input.body,
      city: input.city,
      author_bio: input.authorBio,
      photo_urls: input.photoUrls,
      updated_at: new Date().toISOString(),
    })
    .eq("id", biteId);
  if (error) throw error;
}

export async function deleteDailyBitePost(token: string, biteId: string) {
  const supabase = getSupabaseClient(token);
  if (!supabase) {
    throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  const { data, error } = await supabase.from("daily_bites").delete().eq("id", biteId).select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error("Daily bite was not deleted.");
  }
}
