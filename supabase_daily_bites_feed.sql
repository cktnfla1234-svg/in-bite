-- Public Daily Bite feed (Supabase SQL editor).
-- Read: anon + authenticated. Insert: authenticated as self. Update row: author only.
-- Like totals: use RPC `apply_daily_bite_like_delta` (app calls it after toggling `post_likes`).

create table if not exists public.daily_bites (
  id uuid primary key,
  author_clerk_id text not null,
  author_name text not null default '',
  author_bio text not null default '',
  body text not null default '',
  city text not null default 'Local',
  photo_urls jsonb not null default '[]'::jsonb,
  author_image_url text,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_bites add column if not exists author_clerk_id text;
alter table public.daily_bites add column if not exists author_name text;
alter table public.daily_bites add column if not exists author_bio text;
alter table public.daily_bites add column if not exists body text;
alter table public.daily_bites add column if not exists city text;
alter table public.daily_bites add column if not exists photo_urls jsonb;
alter table public.daily_bites add column if not exists author_image_url text;
alter table public.daily_bites add column if not exists likes_count integer;
alter table public.daily_bites add column if not exists comments_count integer;
alter table public.daily_bites add column if not exists created_at timestamptz;
alter table public.daily_bites add column if not exists updated_at timestamptz;

create index if not exists daily_bites_created_at_idx on public.daily_bites (created_at desc);

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
  with check (author_clerk_id = auth.jwt() ->> 'sub');

drop policy if exists "daily_bites_update_own" on public.daily_bites;
create policy "daily_bites_update_own"
  on public.daily_bites
  for update
  to authenticated
  using (author_clerk_id = auth.jwt() ->> 'sub')
  with check (author_clerk_id = auth.jwt() ->> 'sub');

drop policy if exists "daily_bites_delete_own" on public.daily_bites;
create policy "daily_bites_delete_own"
  on public.daily_bites
  for delete
  to authenticated
  using (author_clerk_id = auth.jwt() ->> 'sub');

create or replace function public.apply_daily_bite_like_delta(p_post_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_val integer;
begin
  update public.daily_bites
  set
    likes_count = greatest(0, coalesce(likes_count, 0) + p_delta),
    updated_at = now()
  where id = p_post_id
  returning likes_count into new_val;

  if new_val is null then
    select likes_count into new_val from public.daily_bites where id = p_post_id;
  end if;

  return coalesce(new_val, 0);
end;
$$;

revoke all on function public.apply_daily_bite_like_delta(uuid, integer) from public;
grant execute on function public.apply_daily_bite_like_delta(uuid, integer) to authenticated;

-- Realtime (optional): alter publication supabase_realtime add table public.daily_bites;
