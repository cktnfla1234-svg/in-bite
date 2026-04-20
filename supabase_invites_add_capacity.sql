-- Add missing `capacity` column used by app invite forms.
-- Safe to run multiple times.

alter table public.invites
  add column if not exists capacity integer;

-- Backfill existing rows to a sensible default.
update public.invites
set capacity = 2
where capacity is null;

-- Keep future data valid.
alter table public.invites
  alter column capacity set default 2;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invites_capacity_check'
  ) then
    alter table public.invites
      add constraint invites_capacity_check
      check (capacity >= 1 and capacity <= 20);
  end if;
end $$;
