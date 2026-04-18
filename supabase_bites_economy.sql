-- BITE economy: fractional balances + append-only history + atomic apply RPC.
-- Run in Supabase SQL editor after profiles exists.

create table if not exists public.bites_history (
  id bigint generated always as identity primary key,
  clerk_id text not null,
  delta numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  kind text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bites_history_clerk_created_idx
  on public.bites_history (clerk_id, created_at desc);

alter table public.profiles
  alter column bites_balance type numeric(12, 2)
  using (bites_balance::numeric);

alter table public.bites_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bites_history' and policyname = 'bites_history_select_own'
  ) then
    create policy bites_history_select_own on public.bites_history
      for select
      using (auth.jwt()->>'sub' = clerk_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bites_history' and policyname = 'bites_history_insert_own'
  ) then
    create policy bites_history_insert_own on public.bites_history
      for insert
      with check (auth.jwt()->>'sub' = clerk_id);
  end if;
end $$;

-- Inserts only via RPC (service role / definer). No direct insert policy for end users.

create or replace function public.apply_bite_delta(
  p_delta numeric,
  p_kind text,
  p_meta jsonb default '{}'::jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk text := nullif(trim(auth.jwt()->>'sub'), '');
  v_cur numeric;
  v_next numeric;
begin
  if v_clerk is null then
    raise exception 'not authenticated';
  end if;

  select bites_balance into v_cur
  from public.profiles
  where clerk_id = v_clerk
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if p_kind = 'welcome_bonus' then
    if exists (
      select 1 from public.bites_history where clerk_id = v_clerk and kind = 'welcome_bonus' limit 1
    ) then
      return v_cur;
    end if;
  end if;

  -- Reward guard: one comment reward per post_id per user.
  if p_kind = 'comment' then
    if coalesce(p_meta->>'post_id', '') = '' then
      raise exception 'comment_post_id_required';
    end if;
    if exists (
      select 1
      from public.bites_history
      where clerk_id = v_clerk
        and kind = 'comment'
        and coalesce(meta->>'post_id', '') = p_meta->>'post_id'
      limit 1
    ) then
      return v_cur;
    end if;
  end if;

  -- Reward guard: one daily bite reward per local_day per user.
  if p_kind = 'daily_bite' then
    if coalesce(p_meta->>'local_day', '') = '' then
      raise exception 'daily_bite_local_day_required';
    end if;
    if exists (
      select 1
      from public.bites_history
      where clerk_id = v_clerk
        and kind = 'daily_bite'
        and coalesce(meta->>'local_day', '') = p_meta->>'local_day'
      limit 1
    ) then
      return v_cur;
    end if;
  end if;

  v_next := round(coalesce(v_cur, 0) + p_delta, 2);
  if v_next < 0 then
    raise exception 'insufficient_balance';
  end if;

  update public.profiles
  set bites_balance = v_next,
      updated_at = now()
  where clerk_id = v_clerk;

  insert into public.bites_history (clerk_id, delta, balance_after, kind, meta)
  values (v_clerk, round(p_delta, 2), v_next, p_kind, coalesce(p_meta, '{}'::jsonb));

  return v_next;
end;
$$;

revoke all on function public.apply_bite_delta(numeric, text, jsonb) from public;
grant execute on function public.apply_bite_delta(numeric, text, jsonb) to authenticated;
grant execute on function public.apply_bite_delta(numeric, text, jsonb) to service_role;
