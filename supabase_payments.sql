-- In-chat payments table for Stripe intents and status tracking.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  room_id text,
  sender_id text not null,
  receiver_id text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'KRW',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  stripe_payment_intent_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_sender_created_idx on public.payments (sender_id, created_at desc);
create index if not exists payments_receiver_created_idx on public.payments (receiver_id, created_at desc);
create index if not exists payments_intent_idx on public.payments (stripe_payment_intent_id);

create or replace function public.set_updated_at_payments()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_payments on public.payments;
create trigger trg_set_updated_at_payments
before update on public.payments
for each row
execute function public.set_updated_at_payments();

alter table public.payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payments' and policyname = 'payments_select_sender_or_receiver'
  ) then
    create policy payments_select_sender_or_receiver on public.payments
      for select
      using (auth.jwt()->>'sub' = sender_id or auth.jwt()->>'sub' = receiver_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payments' and policyname = 'payments_insert_sender_only'
  ) then
    create policy payments_insert_sender_only on public.payments
      for insert
      with check (auth.jwt()->>'sub' = sender_id);
  end if;
end $$;
