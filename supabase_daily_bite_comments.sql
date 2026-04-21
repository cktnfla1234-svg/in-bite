-- Daily Bite comments (server-backed; visible on all devices for the same post).
-- Run in Supabase SQL editor after `supabase_daily_bites_feed.sql`.
-- Keeps `daily_bites.comments_count` in sync via trigger.

create table if not exists public.daily_bite_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.daily_bites (id) on delete cascade,
  author_clerk_id text not null references public.profiles (clerk_id) on update cascade on delete restrict,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists daily_bite_comments_post_created_idx
  on public.daily_bite_comments (post_id, created_at asc);
create index if not exists daily_bite_comments_author_clerk_idx
  on public.daily_bite_comments (author_clerk_id);

comment on table public.daily_bite_comments is 'Public thread comments for Daily Bite posts; RLS read for all, write as self.';

alter table public.daily_bite_comments enable row level security;

drop policy if exists "daily_bite_comments_select_public" on public.daily_bite_comments;
create policy "daily_bite_comments_select_public"
  on public.daily_bite_comments
  for select
  to anon, authenticated
  using (true);

drop policy if exists "daily_bite_comments_insert_own" on public.daily_bite_comments;
create policy "daily_bite_comments_insert_own"
  on public.daily_bite_comments
  for insert
  to authenticated
  with check (author_clerk_id = (auth.jwt() ->> 'sub'));

drop policy if exists "daily_bite_comments_delete_own" on public.daily_bite_comments;
create policy "daily_bite_comments_delete_own"
  on public.daily_bite_comments
  for delete
  to authenticated
  using (author_clerk_id = (auth.jwt() ->> 'sub'));

-- Keep denormalized count aligned (optional but matches app expectations).
create or replace function public.daily_bite_comments_adjust_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.daily_bites
    set comments_count = greatest(0, coalesce(comments_count, 0) + 1),
        updated_at = now()
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.daily_bites
    set comments_count = greatest(0, coalesce(comments_count, 0) - 1),
        updated_at = now()
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists daily_bite_comments_count on public.daily_bite_comments;
create trigger daily_bite_comments_count
  after insert or delete on public.daily_bite_comments
  for each row execute function public.daily_bite_comments_adjust_count();

-- Realtime (recommended for live threads): Dashboard → Database → Replication →
-- enable `daily_bite_comments`, or run:
--   alter publication supabase_realtime add table public.daily_bite_comments;
