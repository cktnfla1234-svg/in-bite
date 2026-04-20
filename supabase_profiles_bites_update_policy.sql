-- Ensure authenticated users can update only their own profile row,
-- including `bites_balance` updates used during invite creation.
-- Run in Supabase SQL Editor.

alter table public.profiles enable row level security;

drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((auth.jwt() ->> 'sub') = clerk_id)
  with check ((auth.jwt() ->> 'sub') = clerk_id);
