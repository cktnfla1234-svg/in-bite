-- Invites table for Create Invite modal with JSONB itinerary timeline.
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null,
  title text not null,
  location text not null,
  primary_photo_url text not null,
  description text not null,
  itinerary jsonb not null default '[]'::jsonb,
  taste_tags text[] not null default '{}'::text[],
  included_options text[] not null default '{}'::text[],
  bites integer not null default 1 check (bites >= 1),
  price_amount numeric(12, 2) not null default 0,
  host_currency text not null default 'KRW',
  capacity integer not null default 2,
  meetup_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invites_clerk_id_idx on public.invites (clerk_id);
create index if not exists invites_created_at_idx on public.invites (created_at desc);

alter table public.invites enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'invites' and policyname = 'select_own_invites'
  ) then
    create policy "select_own_invites"
      on public.invites
      for select
      using (clerk_id = auth.jwt() ->> 'sub');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'invites' and policyname = 'insert_own_invites'
  ) then
    create policy "insert_own_invites"
      on public.invites
      for insert
      with check (clerk_id = auth.jwt() ->> 'sub');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'invites' and policyname = 'update_own_invites'
  ) then
    create policy "update_own_invites"
      on public.invites
      for update
      using (clerk_id = auth.jwt() ->> 'sub')
      with check (clerk_id = auth.jwt() ->> 'sub');
  end if;
end $$;
