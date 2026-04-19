-- Optional: `chat_rooms` for Say Hi → Supabase sync (`src/lib/chat.ts`).
-- Uses Clerk JWT `sub` as participant id (same as `profiles.clerk_id`), not `auth.uid()`.
-- Run in Supabase SQL Editor when you want server-backed rooms + RLS.

create table if not exists public.chat_rooms (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  participant_clerk_ids text[] not null default '{}'::text[]
);

alter table public.chat_rooms
  add column if not exists participant_clerk_ids text[] not null default '{}'::text[];

comment on table public.chat_rooms is 'Direct chat room ids (client-computed) with Clerk participant ids for RLS.';

alter table public.chat_rooms enable row level security;

drop policy if exists "chat_rooms_select_participants" on public.chat_rooms;
drop policy if exists chat_rooms_select_participants on public.chat_rooms;
create policy chat_rooms_select_participants
  on public.chat_rooms
  for select
  to authenticated
  using ((auth.jwt() ->> 'sub') = any (participant_clerk_ids));

drop policy if exists "chat_rooms_insert_as_participant" on public.chat_rooms;
drop policy if exists chat_rooms_insert_as_participant on public.chat_rooms;
create policy chat_rooms_insert_as_participant
  on public.chat_rooms
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'sub') = any (participant_clerk_ids));

drop policy if exists "chat_rooms_update_participant" on public.chat_rooms;
drop policy if exists chat_rooms_update_participant on public.chat_rooms;
create policy chat_rooms_update_participant
  on public.chat_rooms
  for update
  to authenticated
  using ((auth.jwt() ->> 'sub') = any (participant_clerk_ids))
  with check ((auth.jwt() ->> 'sub') = any (participant_clerk_ids));

-- Realtime: Dashboard → Database → Replication → enable `chat_rooms`, or:
--   alter publication supabase_realtime add table public.chat_rooms;
