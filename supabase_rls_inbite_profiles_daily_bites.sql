-- In-Bite: RLS policies bundle for Supabase SQL Editor (profiles + daily_bites + post_likes).
-- Prereqs: tables `public.profiles`, `public.daily_bites`, and `public.post_likes` exist; Clerk JWT `sub` matches `clerk_id` / `author_clerk_id` / `post_likes.user_id`.
-- Run once after migrations; safe to re-run (drops named policies first).

-- ─── profiles ───────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((auth.jwt() ->> 'sub') = clerk_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'sub') = clerk_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((auth.jwt() ->> 'sub') = clerk_id)
  with check ((auth.jwt() ->> 'sub') = clerk_id);

-- ─── daily_bites ────────────────────────────────────────────────────────────

alter table public.daily_bites enable row level security;

drop policy if exists "daily_bites_select_public" on public.daily_bites;
create policy "daily_bites_select_public"
  on public.daily_bites
  for select
  to anon, authenticated
  using (true);

drop policy if exists "daily_bites_insert_own" on public.daily_bites;
create policy "daily_bites_insert_own"
  on public.daily_bites
  for insert
  to authenticated
  with check (author_clerk_id = (auth.jwt() ->> 'sub'));

drop policy if exists "daily_bites_update_own" on public.daily_bites;
create policy "daily_bites_update_own"
  on public.daily_bites
  for update
  to authenticated
  using (author_clerk_id = (auth.jwt() ->> 'sub'))
  with check (author_clerk_id = (auth.jwt() ->> 'sub'));

drop policy if exists "daily_bites_delete_own" on public.daily_bites;
create policy "daily_bites_delete_own"
  on public.daily_bites
  for delete
  to authenticated
  using (author_clerk_id = (auth.jwt() ->> 'sub'));

-- ─── post_likes (Daily Bite heart) — table + RLS (JWT sub = user_id) ─

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
