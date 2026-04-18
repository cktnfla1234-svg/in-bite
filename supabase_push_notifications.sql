-- Push foundation for FCM/OneSignal style delivery.
alter table public.profiles
  add column if not exists device_token text;

create index if not exists profiles_device_token_idx
  on public.profiles (device_token)
  where device_token is not null;
