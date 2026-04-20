-- Add missing `meetup_at` column used by invite forms.
-- Safe to run multiple times.

alter table public.invites
  add column if not exists meetup_at timestamptz;

-- Optional index for future filtering/sorting by meetup schedule.
create index if not exists invites_meetup_at_idx
  on public.invites (meetup_at);
