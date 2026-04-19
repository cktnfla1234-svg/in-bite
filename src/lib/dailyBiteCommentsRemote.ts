import { getSupabaseClient } from "./supabase";

export type RemoteDailyBiteCommentRow = {
  id: string;
  author_clerk_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export async function fetchDailyBiteComments(token: string, postId: string): Promise<RemoteDailyBiteCommentRow[]> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase
    .from("daily_bite_comments")
    .select("id, author_clerk_id, author_name, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("fetchDailyBiteComments", error);
    return [];
  }
  return (data ?? []) as RemoteDailyBiteCommentRow[];
}

export async function insertDailyBiteComment(
  token: string,
  input: { postId: string; authorClerkId: string; authorName: string; body: string },
): Promise<{ id: string; createdAt: string } | null> {
  const supabase = getSupabaseClient(token);
  const { data, error } = await supabase
    .from("daily_bite_comments")
    .insert({
      post_id: input.postId,
      author_clerk_id: input.authorClerkId,
      author_name: input.authorName,
      body: input.body.trim(),
    })
    .select("id, created_at")
    .maybeSingle();

  if (error || !data) {
    console.warn("insertDailyBiteComment", error);
    return null;
  }
  const row = data as { id: string; created_at: string };
  return { id: row.id, createdAt: row.created_at };
}
