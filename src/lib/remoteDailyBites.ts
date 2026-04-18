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
    authorClerkId: row.author_clerk_id,
  };
}

const SELECT_FIELDS =
  "id, author_clerk_id, author_name, author_bio, body, city, photo_urls, author_image_url, likes_count, comments_count, created_at";

export async function fetchPublicDailyBites(limit = 80): Promise<DailyBitePost[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("daily_bites")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("fetchPublicDailyBites", error);
    return [];
  }
  return (data ?? []).map((r) => dailyBiteRowToPost(r as DailyBiteDbRow));
}

export async function fetchOwnDailyBites(token: string, clerkId: string, limit = 120): Promise<DailyBitePost[]> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase
    .from("daily_bites")
    .select(SELECT_FIELDS)
    .eq("author_clerk_id", clerkId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("fetchOwnDailyBites", error);
    return [];
  }
  return (data ?? []).map((r) => dailyBiteRowToPost(r as DailyBiteDbRow));
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
  const { error } = await supabase.from("daily_bites").delete().eq("id", biteId);
  if (error) throw error;
}
