import { getSupabaseClient } from "./supabase";

export async function hasLikedPost(postId: string, userId: string, token: string): Promise<boolean> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function fetchLikedPostIds(postIds: string[], userId: string, token: string): Promise<Set<string>> {
  const unique = [...new Set(postIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return new Set();
  const supabase = getSupabaseClient(token);
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", unique);
  if (error) throw error;
  return new Set((data ?? []).map((row: { post_id: string }) => row.post_id));
}

export async function togglePostLike(postId: string, userId: string, token: string): Promise<{ liked: boolean }> {
  const supabase = getSupabaseClient(token);
  if (!supabase) {
    throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  const { data: existing, error: likeCheckError } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (likeCheckError) throw likeCheckError;

  const currentlyLiked = Boolean(existing);
  if (currentlyLiked) {
    const { error: unlikeError } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (unlikeError) throw unlikeError;
  } else {
    const { error: likeError } = await supabase.from("post_likes").upsert({
      post_id: postId,
      user_id: userId,
      created_at: new Date().toISOString(),
    }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
    if (likeError) throw likeError;
  }

  const delta = currentlyLiked ? -1 : 1;
  const { error: rpcError } = await supabase.rpc("apply_daily_bite_like_delta", {
    p_post_id: postId,
    p_delta: delta,
  });
  if (rpcError) {
    const { data: row, error: rowError } = await supabase
      .from("daily_bites")
      .select("likes_count")
      .eq("id", postId)
      .maybeSingle();
    if (!rowError && row) {
      const current = Number(row.likes_count ?? 0);
      const next = Math.max(0, current + delta);
      const { error: updateError } = await supabase
        .from("daily_bites")
        .update({ likes_count: next, updated_at: new Date().toISOString() })
        .eq("id", postId);
      if (updateError) {
        console.warn("daily_bites.likes_count update failed", updateError);
      }
    } else {
      console.warn("apply_daily_bite_like_delta", rpcError);
    }
  }

  return { liked: !currentlyLiked };
}

