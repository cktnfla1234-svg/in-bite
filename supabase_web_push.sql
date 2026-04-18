-- PWA Web Push subscription storage (for Push API delivery from server/edge).
alter table public.profiles
  add column if not exists push_subscription jsonb;

create index if not exists profiles_push_subscription_idx
  on public.profiles ((push_subscription ->> 'endpoint'))
  where push_subscription is not null;
