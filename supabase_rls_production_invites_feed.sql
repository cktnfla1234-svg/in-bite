-- In-Bite: production-safe RLS for `public.invites` (feed + own writes).
-- Problem: policies that only allow SELECT where clerk_id = jwt sub hide everyone else's invites
-- from Explore / anon discovery — looks like "nothing loads" on Vercel.
--
-- Run in Supabase SQL Editor after `supabase_invites.sql`. Safe to re-run.

alter table public.invites enable row level security;

-- Drop legacy / duplicate names (various migration scripts used different identifiers)
drop policy if exists "select_own_invites" on public.invites;
drop policy if exists select_own_invites on public.invites;
drop policy if exists "select_invites_public_discovery" on public.invites;
drop policy if exists select_invites_public_discovery on public.invites;
drop policy if exists "invites_select_public" on public.invites;
drop policy if exists invites_select_public on public.invites;
drop policy if exists "insert_own_invites" on public.invites;
drop policy if exists insert_own_invites on public.invites;
drop policy if exists "update_own_invites" on public.invites;
drop policy if exists update_own_invites on public.invites;
drop policy if exists "invites_insert_own" on public.invites;
drop policy if exists "invites_update_own" on public.invites;
drop policy if exists "invites_delete_own" on public.invites;

-- Anyone with the anon or authenticated role can read invites (public feed + discovery).
create policy invites_select_public
  on public.invites
  for select
  to anon, authenticated
  using (true);

-- Authenticated users may only insert rows for themselves (Clerk `sub` = clerk_id).
create policy invites_insert_own
  on public.invites
  for insert
  to authenticated
  with check (clerk_id = (auth.jwt() ->> 'sub'));

create policy invites_update_own
  on public.invites
  for update
  to authenticated
  using (clerk_id = (auth.jwt() ->> 'sub'))
  with check (clerk_id = (auth.jwt() ->> 'sub'));

create policy invites_delete_own
  on public.invites
  for delete
  to authenticated
  using (clerk_id = (auth.jwt() ->> 'sub'));
