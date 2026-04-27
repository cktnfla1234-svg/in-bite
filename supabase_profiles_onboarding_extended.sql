-- Adds onboarding preference columns used by saveOnboardingProfile().
-- Safe to run multiple times.

alter table public.profiles
  add column if not exists age integer,
  add column if not exists gender text,
  add column if not exists bio text,
  add column if not exists hobbies text[] not null default '{}'::text[],
  add column if not exists moods text[] not null default '{}'::text[];

