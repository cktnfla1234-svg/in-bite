-- Home "Popular Destinations" / "Current Tastes" need rows from ALL invites.
-- PREREQUISITE: run `supabase_invites.sql` first so `public.invites` exists (and RLS is on).

-- 1) Allow read access for discovery (app reads location + taste_tags; full row is readable —
--    replace with a narrow VIEW + policy later if you need stricter privacy.)
do $$
begin
  if to_regclass('public.invites') is null then
    raise exception 'public.invites does not exist. Run supabase_invites.sql in this repo first, then re-run this file.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'invites' and policyname = 'select_invites_public_discovery'
  ) then
    create policy "select_invites_public_discovery"
      on public.invites
      for select
      using (true);
  end if;
end $$;

-- 2) Supabase Realtime: add `invites` to the publication (Dashboard → Database → Replication,
--    or uncomment if your project uses the default `supabase_realtime` publication.)

-- alter publication supabase_realtime add table public.invites;
