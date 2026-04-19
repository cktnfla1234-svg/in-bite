-- Public profile snapshot for signed-in users (any row by clerk_id).
-- RLS on `profiles` only allows self-read; this SECURITY DEFINER RPC exposes a safe subset for social UI.
-- Run in Supabase SQL Editor after `supabase_profiles.sql` and `supabase_profiles_extended.sql`
-- (extended adds display_name, profile_* columns — if missing, add columns first or simplify the SELECT).

create or replace function public.public_profile_for_clerk(p_clerk_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  if p_clerk_id is null or trim(p_clerk_id) = '' then
    return null;
  end if;

  select jsonb_build_object(
    'clerk_id', p.clerk_id,
    'display_name', coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')
    ),
    'image_url', p.image_url,
    'profile_city', p.profile_city,
    'profile_country_code', p.profile_country_code,
    'profile_mbti', p.profile_mbti,
    'profile_hobbies', p.profile_hobbies,
    'profile_bio', p.profile_bio,
    'profile_gallery', coalesce(p.profile_gallery, '[]'::jsonb)
  )
  into r
  from public.profiles p
  where p.clerk_id = trim(p_clerk_id)
  limit 1;

  return r;
end;
$$;

comment on function public.public_profile_for_clerk(text) is
  'Returns non-sensitive profile fields for a user by Clerk id; callable by authenticated clients.';

grant execute on function public.public_profile_for_clerk(text) to authenticated;
