-- Multi-currency: user display preference + host-set invite prices.
-- Run in Supabase SQL editor after profiles / invites exist.

alter table public.profiles
  add column if not exists preferred_currency text not null default 'KRW';

alter table public.invites
  add column if not exists price_amount numeric(12, 2) not null default 0;

alter table public.invites
  add column if not exists host_currency text not null default 'KRW';

comment on column public.profiles.preferred_currency is 'ISO 4217 code for price display (Explore cards, etc.).';
comment on column public.invites.price_amount is 'Tour price in host_currency (fiat).';
comment on column public.invites.host_currency is 'ISO 4217 code the host expects.';
