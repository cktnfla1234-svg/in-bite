-- Daily Bite per-user likes (run in Supabase SQL editor after `public.daily_bites` exists).
-- App: `src/lib/dailyBites.ts` — upsert on (post_id, user_id), Clerk id in `user_id`.

create table if not exists public.post_likes (
  post_id uuid not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  constraint post_likes_pkey primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "post_likes_select_own" on public.post_likes;
create policy "post_likes_select_own"
  on public.post_likes
  for select
  to authenticated
  using (user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own"
  on public.post_likes
  for insert
  to authenticated
  with check (user_id = (auth.jwt() ->> 'sub'));

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own"
  on public.post_likes
  for delete
  to authenticated
  using (user_id = (auth.jwt() ->> 'sub'));
