-- Optional: allow UPDATE on own like rows (e.g. if you use PostgREST upsert with ON CONFLICT DO UPDATE).
-- The app uses INSERT + ignore duplicate + DELETE for toggle; run only if you need UPDATE for other clients.

drop policy if exists "daily_bite_comment_likes_update_own" on public.daily_bite_comment_likes;
create policy "daily_bite_comment_likes_update_own"
  on public.daily_bite_comment_likes
  for update
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id)
  with check (auth.jwt() ->> 'sub' = user_id);
