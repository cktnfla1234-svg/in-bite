-- Enable Postgres → Realtime for `public.messages` (chat sync).
-- The Dashboard "Replication" UI is optional; this SQL is the reliable way on Supabase Cloud.
--
-- Run in Supabase SQL Editor AFTER `public.messages` exists (`supabase_messages.sql`).
-- Safe to re-run: ignores "already member of publication".

-- See which publications exist (expect `supabase_realtime` on hosted Supabase):
--   select pubname from pg_publication order by 1;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then
    raise notice 'public.messages is already in publication supabase_realtime.';
  when undefined_object then
    raise exception
      'Publication "supabase_realtime" not found. Enable the Realtime add-on for this project, or check: select pubname from pg_publication;';
  when others then
    -- Some Postgres versions use a generic error for "already member of publication".
    if sqlerrm ilike '%already member%' or sqlerrm ilike '%already in publication%' then
      raise notice 'public.messages already in publication (ignored).';
    else
      raise;
    end if;
end;
$$;

-- Helps Realtime deliver row payloads consistently for filtered subscriptions (optional but recommended).
alter table public.messages replica identity full;
