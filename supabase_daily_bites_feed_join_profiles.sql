-- Daily Bite feed: single round-trip with profiles LEFT JOIN (no per-author profile RPC).
-- Run in Supabase SQL Editor after `supabase_daily_bites_feed.sql` and `supabase_profiles.sql` (+ extended columns optional).
-- Exposes only safe profile fields merged into author columns; SECURITY DEFINER bypasses profiles RLS for this read path.

alter table public.daily_bites add column if not exists deleted_at timestamptz;

create or replace function public.fetch_public_daily_bites_feed(p_limit integer default 80)
returns table (
  id uuid,
  author_clerk_id text,
  author_name text,
  author_bio text,
  body text,
  city text,
  photo_urls jsonb,
  author_image_url text,
  likes_count integer,
  comments_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.author_clerk_id,
    coalesce(
      nullif(trim(b.author_name), ''),
      nullif(trim(p.display_name), ''),
      nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      'Member'
    ) as author_name,
    coalesce(
      nullif(trim(b.author_bio), ''),
      nullif(trim(p.profile_bio), ''),
      ''
    ) as author_bio,
    b.body,
    b.city,
    b.photo_urls,
    coalesce(
      nullif(trim(b.author_image_url), ''),
      nullif(trim(p.image_url), '')
    ) as author_image_url,
    coalesce(b.likes_count, 0)::integer as likes_count,
    coalesce(b.comments_count, 0)::integer as comments_count,
    b.created_at
  from public.daily_bites b
  left join public.profiles p on p.clerk_id = b.author_clerk_id
  where b.deleted_at is null
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 80), 1), 200);
$$;

comment on function public.fetch_public_daily_bites_feed(integer) is
  'Public daily bite rows with author image/name/bio merged from profiles in one query.';

revoke all on function public.fetch_public_daily_bites_feed(integer) from public;
grant execute on function public.fetch_public_daily_bites_feed(integer) to anon, authenticated;

create or replace function public.fetch_own_daily_bites_feed(p_clerk_id text, p_limit integer default 120)
returns table (
  id uuid,
  author_clerk_id text,
  author_name text,
  author_bio text,
  body text,
  city text,
  photo_urls jsonb,
  author_image_url text,
  likes_count integer,
  comments_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.author_clerk_id,
    coalesce(
      nullif(trim(b.author_name), ''),
      nullif(trim(p.display_name), ''),
      nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      'Member'
    ) as author_name,
    coalesce(
      nullif(trim(b.author_bio), ''),
      nullif(trim(p.profile_bio), ''),
      ''
    ) as author_bio,
    b.body,
    b.city,
    b.photo_urls,
    coalesce(
      nullif(trim(b.author_image_url), ''),
      nullif(trim(p.image_url), '')
    ) as author_image_url,
    coalesce(b.likes_count, 0)::integer as likes_count,
    coalesce(b.comments_count, 0)::integer as comments_count,
    b.created_at
  from public.daily_bites b
  left join public.profiles p on p.clerk_id = b.author_clerk_id
  where b.deleted_at is null
    and b.author_clerk_id = trim(p_clerk_id)
    and trim(p_clerk_id) = (auth.jwt() ->> 'sub')
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 120), 1), 300);
$$;

comment on function public.fetch_own_daily_bites_feed(text, integer) is
  'Signed-in user''s daily bites with profile merge; p_clerk_id must match JWT sub.';

revoke all on function public.fetch_own_daily_bites_feed(text, integer) from public;
grant execute on function public.fetch_own_daily_bites_feed(text, integer) to authenticated;
