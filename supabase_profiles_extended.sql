-- Extended editable profile fields (run once in Supabase SQL editor after `profiles` exists).
-- Used by the app for cross-device persistence after login.

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists profile_city text;
alter table public.profiles add column if not exists profile_country_code text;
alter table public.profiles add column if not exists profile_address text;
alter table public.profiles add column if not exists profile_mbti text;
alter table public.profiles add column if not exists profile_hobbies text;
alter table public.profiles add column if not exists profile_bio text;
alter table public.profiles add column if not exists profile_gallery jsonb not null default '[]'::jsonb;

comment on column public.profiles.display_name is 'User-chosen display name (profile edit).';
comment on column public.profiles.profile_gallery is 'JSON array of compressed data URLs or URLs for profile gallery.';
