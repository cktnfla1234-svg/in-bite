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
  if (!supabase) return [];
  // #region agent log
  fetch('http://127.0.0.1:7638/ingest/05bfdf68-9e16-4df7-9d1c-8885890e8915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d102b9'},body:JSON.stringify({sessionId:'d102b9',runId:'pre-fix',hypothesisId:'H2',location:'src/lib/dailyBiteCommentsRemote.ts:fetchDailyBiteComments:start',message:'Fetch daily bite comments start',data:{postId,hasToken:Boolean(token)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const { data, error } = await supabase
    .from("daily_bite_comments")
    .select("id, author_clerk_id, author_name, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7638/ingest/05bfdf68-9e16-4df7-9d1c-8885890e8915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d102b9'},body:JSON.stringify({sessionId:'d102b9',runId:'pre-fix',hypothesisId:'H2',location:'src/lib/dailyBiteCommentsRemote.ts:fetchDailyBiteComments:error',message:'Fetch daily bite comments failed',data:{postId,errorMessage:error.message ?? ''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.warn("fetchDailyBiteComments", error);
    return [];
  }
  const rows = (data ?? []) as RemoteDailyBiteCommentRow[];
  // #region agent log
  fetch('http://127.0.0.1:7638/ingest/05bfdf68-9e16-4df7-9d1c-8885890e8915',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d102b9'},body:JSON.stringify({sessionId:'d102b9',runId:'pre-fix',hypothesisId:'H2',location:'src/lib/dailyBiteCommentsRemote.ts:fetchDailyBiteComments:success',message:'Fetch daily bite comments success',data:{postId,rowCount:rows.length,sampleAuthorName:rows[0]?.author_name ?? null,sampleAuthorId:rows[0]?.author_clerk_id ?? null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return rows;
}

export async function insertDailyBiteComment(
  token: string,
  input: { postId: string; authorClerkId: string; authorName: string; body: string },
): Promise<{ id: string; createdAt: string } | null> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return null;
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

/** Deletes a row in `daily_bite_comments` when RLS allows (author = JWT sub). Returns false on transport/RLS error. */
export async function deleteDailyBiteComment(token: string, commentId: string): Promise<boolean> {
  const supabase = getSupabaseClient(token);
  if (!supabase) return false;
  const { error } = await supabase.from("daily_bite_comments").delete().eq("id", commentId);
  if (error) {
    console.warn("deleteDailyBiteComment", error);
    return false;
  }
  return true;
}
