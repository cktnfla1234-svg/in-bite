-- App UI language (synced with i18n). Run once after `profiles` exists.
alter table public.profiles
  add column if not exists language_code text;

comment on column public.profiles.language_code is 'BCP 47 primary tag: en | ko | de (app-supported UI locale).';

-- Optional: Realtime so other devices update UI language when this column changes.
-- Dashboard → Database → Replication → enable `profiles`, or:
-- alter publication supabase_realtime add table public.profiles;
