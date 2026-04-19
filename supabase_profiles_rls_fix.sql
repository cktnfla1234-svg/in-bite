-- Profiles RLS fix (Supabase SQL editor).
-- Run after `supabase_profiles.sql` and `supabase_profiles_extended.sql` if updates from the app fail
-- with RLS / permission errors, or if policies were created without `to authenticated`.
--
-- Requires Clerk ↔ Supabase JWT integration so `auth.jwt()->>'sub'` equals `profiles.clerk_id`.

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
