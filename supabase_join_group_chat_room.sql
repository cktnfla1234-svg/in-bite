-- Lets a signed-in user add themselves to a group chat room without RLS chicken-and-egg.
-- Run in Supabase SQL Editor after `supabase_chat_rooms.sql`.
-- Client: `supabase.rpc('join_group_chat_room', { p_room_id: 'group:…' })` then SELECT the row.

create or replace function public.join_group_chat_room(p_room_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text;
  r public.chat_rooms%rowtype;
begin
  uid := nullif(trim(auth.jwt() ->> 'sub'), '');
  if uid is null or p_room_id is null or trim(p_room_id) = '' then
    return null;
  end if;

  if left(trim(p_room_id), 6) <> 'group:' then
    return null;
  end if;

  insert into public.chat_rooms (id, participant_clerk_ids, created_at, updated_at)
  values (trim(p_room_id), array[uid::text], now(), now())
  on conflict (id) do update
    set participant_clerk_ids = coalesce(
        (
          select array_agg(distinct x)
          from unnest(chat_rooms.participant_clerk_ids || array[uid::text]) as t(x)
        ),
        array[uid::text]
      ),
      updated_at = now()
  returning * into r;

  return jsonb_build_object(
    'id', r.id,
    'participant_clerk_ids', to_jsonb(r.participant_clerk_ids)
  );
end;
$$;

comment on function public.join_group_chat_room(text) is
  'Adds JWT sub to chat_rooms.participant_clerk_ids for group:* ids; creates row if missing.';

grant execute on function public.join_group_chat_room(text) to authenticated;
