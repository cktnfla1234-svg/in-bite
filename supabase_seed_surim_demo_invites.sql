-- Seed the two Surim Cha demo invites into `public.invites` so Explore shows them for everyone
-- (same copy as `src/lib/surimChaDemoInvites.ts`).
--
-- Prerequisites:
--   - `supabase_invites.sql` applied
--   - Public read on invites for the feed: `supabase_rls_production_invites_feed.sql`
--
-- Host `clerk_id`:
--   1) Leave `v_override` empty to auto-pick from `profiles` where display/first/last name matches surim + cha.
--   2) Or set `v_override` to your Clerk id (e.g. 'user_2abc...') and re-run.

do $$
declare
  v_override text := ''; -- e.g. 'user_xxxxxxxxxxxxxxxxxxxxxxxx'
  v_clerk text;
begin
  if v_override is not null and trim(v_override) <> '' then
    v_clerk := trim(v_override);
  else
    select p.clerk_id
      into v_clerk
    from public.profiles p
    where lower(coalesce(p.display_name, '') || ' ' || coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) like '%surim%'
      and lower(coalesce(p.display_name, '') || ' ' || coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) like '%cha%'
    limit 1;
  end if;

  if v_clerk is null or trim(v_clerk) = '' then
    raise exception
      'surim_demo_invites: set v_override to the host Clerk id (user_...) at top of this block, or add a profiles row for Surim Cha.';
  end if;

  insert into public.invites (
    id,
    clerk_id,
    title,
    location,
    primary_photo_url,
    description,
    itinerary,
    taste_tags,
    included_options,
    bites,
    price_amount,
    host_currency,
    capacity,
    meetup_at,
    created_at,
    updated_at
  )
  values
  (
    'a1000000-0000-4000-8000-000000000001'::uuid,
    v_clerk,
    '책 읽으며 카페 두 곳 투어 (강남 → 연남)',
    'Seoul, South Korea',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80',
    E'조용히 책 읽기 좋은 카페 두 곳을 옮겨 다니며 커피 한 잔씩 나눠요.\n첫 카페에서는 각자 읽고 싶은 책 한 권만 들고 오면 됩니다.\n두 번째 카페까지 걸으며 가볍게 수다도 나눠요. 초보 독서모임 환영!',
    $it1$
    [
      {"time": "14:00", "title": "1카페 · 강남", "description": "에스프레소 베이스 커피와 창가 자리에서 1시간 독서."},
      {"time": "15:30", "title": "이동 · 지하철 2호선", "description": "합정 방향으로 이동 (약 25분)."},
      {"time": "16:15", "title": "2카페 · 연남", "description": "핸드드립 위주 카페. 디저트는 선택!"}
    ]
    $it1$::jsonb,
    array['Cafe Hopping', 'Art & Culture', 'Slow Travel']::text[],
    array['coffee', 'dessert', 'transport']::text[],
    1,
    35000,
    'KRW',
    4,
    '2026-05-10T14:00:00+00'::timestamptz,
    '2026-04-19T10:00:00+00'::timestamptz,
    now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002'::uuid,
    v_clerk,
    '서울 비건 식당 & 카페 투어',
    'Seoul, South Korea',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
    E'비건 브런치 → 플랜트 베이스 디저트 카페까지 한 번에 즐기는 반나절 코스예요.\n알레르기·선호(무글루텐 등)는 미리 알려주세요. 사진 많이 찍어도 좋아요!',
    $it2$
    [
      {"time": "11:00", "title": "비건 브런치", "description": "종로 근처 비건 레스토랑 — 샐러드·토스트·스무디 보울."},
      {"time": "13:00", "title": "성수 비건 카페", "description": "케이크·쿠키는 모두 비건. 커피 or 티 선택."}
    ]
    $it2$::jsonb,
    array['Vegetarian Friendly', 'Street Food', 'Cafe Hopping']::text[],
    array['meal', 'coffee', 'dessert']::text[],
    1,
    42000,
    'KRW',
    5,
    '2026-05-17T11:00:00+00'::timestamptz,
    '2026-04-19T10:00:00+00'::timestamptz,
    now()
  )
  on conflict (id) do update set
    clerk_id = excluded.clerk_id,
    title = excluded.title,
    location = excluded.location,
    primary_photo_url = excluded.primary_photo_url,
    description = excluded.description,
    itinerary = excluded.itinerary,
    taste_tags = excluded.taste_tags,
    included_options = excluded.included_options,
    bites = excluded.bites,
    price_amount = excluded.price_amount,
    host_currency = excluded.host_currency,
    capacity = excluded.capacity,
    meetup_at = excluded.meetup_at,
    updated_at = now();
end;
$$;
