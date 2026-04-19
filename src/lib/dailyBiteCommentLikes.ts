import { getSupabaseClient } from "./supabase";

export async function setCommentLikeRemote(
  token: string,
  postId: string,
  commentId: string,
  userId: string,
  liked: boolean,
): Promise<void> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return;
  if (liked) {
    const { error } = await supabase.from("daily_bite_comment_likes").upsert(
      { post_id: postId, comment_id: commentId, user_id: userId },
      { onConflict: "comment_id,user_id" },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase.from("daily_bite_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
    if (error) throw error;
  }
}

export async function fetchCommentLikeCount(token: string, commentId: string): Promise<number> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("daily_bite_comment_likes")
    .select("id", { count: "exact", head: true })
    .eq("comment_id", commentId);
  if (error) throw error;
  return typeof count === "number" ? count : 0;
}

export async function fetchMyLikedCommentIds(
  token: string,
  postId: string,
  userId: string,
  commentIds: string[],
): Promise<Set<string>> {
  if (!commentIds.length) return new Set();
  const supabase = getSupabaseClient(token);
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("daily_bite_comment_likes")
    .select("comment_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .in("comment_id", commentIds);
  if (error) throw error;
  return new Set((data ?? []).map((r: { comment_id: string }) => r.comment_id));
}

export async function fetchLikeCountsForComments(
  token: string,
  commentIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!commentIds.length) return map;
  const supabase = getSupabaseClient(token);
  if (!supabase) return map;
  const { data, error } = await supabase.from("daily_bite_comment_likes").select("comment_id").in("comment_id", commentIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const id = (row as { comment_id: string }).comment_id;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}
