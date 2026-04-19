-- Chat messages (cross-device). Clerk JWT `sub` matches `sender_id` / `chat_rooms.participant_clerk_ids`.
-- Run after `supabase_chat_rooms.sql`. Then enable Realtime (Dashboard → Database → Replication, or):
--   alter publication supabase_realtime add table public.messages;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  sender_id text not null,
  receiver_id text not null,
  content text not null,
  kind text null,
  created_at timestamptz not null default now()
);

create index if not exists messages_room_id_created_idx on public.messages (room_id, created_at asc);
create index if not exists messages_room_id_idx on public.messages (room_id);

comment on table public.messages is 'Chat lines; id is client-generated UUID so local + server dedupe.';

alter table public.messages enable row level security;

drop policy if exists "messages_select_participants" on public.messages;
drop policy if exists messages_select_participants on public.messages;
drop policy if exists "messages_insert_as_sender" on public.messages;
drop policy if exists messages_insert_as_sender on public.messages;

-- Read if you sent, were addressed, or are in the room's participant list on chat_rooms.
create policy messages_select_participants
  on public.messages
  for select
  to authenticated
  using (
    sender_id = (auth.jwt() ->> 'sub')
    or receiver_id = (auth.jwt() ->> 'sub')
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = messages.room_id
        and (auth.jwt() ->> 'sub') = any (cr.participant_clerk_ids)
    )
  );

create policy messages_insert_as_sender
  on public.messages
  for insert
  to authenticated
  with check (sender_id = (auth.jwt() ->> 'sub'));

-- If you created `messages` before this script added `kind`:
-- alter table public.messages add column if not exists kind text null;

-- Realtime (Supabase Dashboard → Database → Replication), or:
--   alter publication supabase_realtime add table public.messages;
