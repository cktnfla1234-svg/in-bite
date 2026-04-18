create table if not exists public.profiles (
  id bigint generated always as identity primary key,
  clerk_id text not null unique,
  email text,
  first_name text,
  last_name text,
  image_url text,
  bites_balance integer not null default 5,
  welcome_bonus_granted boolean not null default true,
  current_tastes text[] not null default '{}'::text[],
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists bites_balance integer not null default 5;
alter table public.profiles add column if not exists welcome_bonus_granted boolean not null default true;

create index if not exists profiles_clerk_id_idx on public.profiles (clerk_id);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own on public.profiles
      for select
      using (auth.jwt()->>'sub' = clerk_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own on public.profiles
      for insert
      with check (auth.jwt()->>'sub' = clerk_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update
      using (auth.jwt()->>'sub' = clerk_id)
      with check (auth.jwt()->>'sub' = clerk_id);
  end if;
end $$;
