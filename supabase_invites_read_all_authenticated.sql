-- Allow all authenticated users to read invites.
-- Run this in Supabase SQL Editor.

alter table public.invites enable row level security;

drop policy if exists "Enable read access for all users" on public.invites;

create policy "Enable read access for all users"
  on public.invites
  for select
  to authenticated
  using (true);
