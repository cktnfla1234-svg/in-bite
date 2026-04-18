alter table public.invites
  add column if not exists capacity integer not null default 2,
  add column if not exists meetup_at timestamptz null;
