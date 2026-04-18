-- Ensure post_likes enforces one like per user/post and supports secure toggling.
create unique index if not exists post_likes_user_post_unique_idx
  on public.post_likes (user_id, post_id);

alter table public.post_likes enable row level security;

drop policy if exists "post_likes_select_own" on public.post_likes;
create policy "post_likes_select_own"
  on public.post_likes
  for select
  to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own"
  on public.post_likes
  for insert
  to authenticated
  with check (user_id = auth.uid()::text);

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own"
  on public.post_likes
  for delete
  to authenticated
  using (user_id = auth.uid()::text);
