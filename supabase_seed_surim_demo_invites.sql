do $$
declare
  v_override text := '';
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
    '책 마시고 커피 읽을 사람🙋‍♀️',
    'Seoul, South Korea',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80',
    E'좋아하는 작가나 책 선정해서 수다떨어요!\n책 읽고 이야기 할 사람이 없는 사람 \'대\'\'환\'\'영\'✨',
    $it1$
    [
      {"time": "14:00", "title": "첫번째, 카페 · Upside Coffee", "description": "시그니처 커피(해방촌 커피, 뚝섬 커피, 바나나 에스프레소 등)이 너무 맛있는 곳이에요! 너무 조용하지도, 시끄럽지도 않아서 얘기나누기 딱 좋아요!"},
      {"time": "15:30", "title": "두번째, 카페 · MaCoy Cafe", "description": "성수 제일 카푸치노 맛집."},
      {"time": "16:15", "title": "세번째, 카페 · Circle", "description": "(Optional) 연달아 커피가 힘들면 커피 or 티 선택가능한 곳으로 모십니다~~"}
    ]
    $it1$::jsonb,
    array['Cafe Hopping', 'Art & Culture', 'Slow Travel']::text[],
    array['coffee', 'dessert', 'tea']::text[],
    1,
    15000,
    'KRW',
    4,
    '2026-05-10T14:00:00+00'::timestamptz,
    '2026-04-19T10:00:00+00'::timestamptz,
    now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002'::uuid,
    v_clerk,
    '비건은 힘이 세다🥑👊',
    'Seoul, South Korea',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
    E'비건 브런치 → 플랜트 베이스 디저트 카페까지 한 번에 부수는 반나절 코스예요.\n알레르기·선호(무글루텐 등)는 미리 알려주세요!✨',
    $it2$
    [
      {"time": "11:00", "title": "비건 브런치", "description": "종로 오세계향 — 모든 한식이 비건 재료로 만들어짐!"},
      {"time": "13:00", "title": "종로 비건 카페", "description": "케이크·쿠키가 모두 비건. 우유 계란 없이 어케했노? 커피 or 티 선택."}
    ]
    $it2$::jsonb,
    array['Vegetarian Friendly', 'Street Food', 'Cafe Hopping']::text[],
    array['meal', 'coffee', 'dessert']::text[],
    1,
    0,
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