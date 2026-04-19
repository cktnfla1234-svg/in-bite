-- In-Bite: canonical RLS for `public.profiles` (SELECT / INSERT / UPDATE own row).
-- Run in Supabase SQL Editor after `supabase_profiles.sql` and optional migrations
-- (`supabase_profiles_extended.sql`, `supabase_profiles_language.sql`, …).
--
-- Requires Clerk JWT template "supabase" so `auth.jwt()->>'sub'` equals `profiles.clerk_id`
-- for authenticated clients.

alter table public.profiles enable row level security;

-- ─── SELECT (read own row) ─────────────────────────────────────────────────

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((auth.jwt() ->> 'sub') = clerk_id);

-- ─── INSERT (create own row only) ──────────────────────────────────────────

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'sub') = clerk_id);

-- ─── UPDATE (edit own row; same USING + WITH CHECK) ─────────────────────────

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((auth.jwt() ->> 'sub') = clerk_id)
  with check ((auth.jwt() ->> 'sub') = clerk_id);

-- Optional: no DELETE policy — app does not delete profile rows from the client.
-- Service role bypasses RLS for admin scripts.
