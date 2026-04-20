-- Unified Notifications setup (Supabase SQL editor).
-- Covers:
-- 1) notifications table + RLS + realtime
-- 2) DB trigger notifications for post likes/comments

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  actor_id text not null,
  type text not null check (type in ('like', 'comment')),
  post_id uuid references public.daily_bites (id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  -- Backward-compat fields for existing app code.
  target_id text,
  read boolean,
  content text not null default ''
);

alter table public.notifications add column if not exists user_id text;
alter table public.notifications add column if not exists actor_id text;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists post_id uuid;
alter table public.notifications add column if not exists is_read boolean;
alter table public.notifications add column if not exists created_at timestamptz;
alter table public.notifications add column if not exists target_id text;
alter table public.notifications add column if not exists read boolean;
alter table public.notifications add column if not exists content text;

update public.notifications
set
  user_id = coalesce(nullif(user_id, ''), nullif(target_id, '')),
  target_id = coalesce(nullif(target_id, ''), nullif(user_id, '')),
  is_read = coalesce(is_read, read, false),
  read = coalesce(read, is_read, false),
  content = coalesce(content, ''),
  created_at = coalesce(created_at, now())
where
  user_id is null
  or target_id is null
  or is_read is null
  or read is null
  or content is null
  or created_at is null;

alter table public.notifications alter column user_id set not null;
alter table public.notifications alter column actor_id set not null;
alter table public.notifications alter column type set not null;
alter table public.notifications alter column is_read set not null;
alter table public.notifications alter column created_at set not null;
alter table public.notifications alter column content set not null;
alter table public.notifications alter column target_id set not null;
alter table public.notifications alter column read set not null;

alter table public.notifications alter column is_read set default false;
alter table public.notifications alter column read set default false;
alter table public.notifications alter column created_at set default now();
alter table public.notifications alter column content set default '';

drop trigger if exists notifications_sync_legacy_trigger on public.notifications;
drop function if exists public.notifications_sync_legacy();
create function public.notifications_sync_legacy()
returns trigger
language plpgsql
as $$
begin
  new.user_id := coalesce(nullif(new.user_id, ''), nullif(new.target_id, ''));
  new.target_id := coalesce(nullif(new.target_id, ''), nullif(new.user_id, ''));
  new.is_read := coalesce(new.is_read, new.read, false);
  new.read := coalesce(new.read, new.is_read, false);
  new.content := coalesce(new.content, '');
  return new;
end;
$$;

create trigger notifications_sync_legacy_trigger
before insert or update on public.notifications
for each row execute function public.notifications_sync_legacy();

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_target_created_idx
  on public.notifications (target_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id);

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated"
  on public.notifications
  for insert
  to authenticated
  with check (auth.jwt() ->> 'sub' = actor_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (auth.jwt() ->> 'sub' = user_id)
  with check (auth.jwt() ->> 'sub' = user_id);

-- Enable realtime delivery.
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
  end;
end $$;

-- Trigger #1: notify post author when someone likes a post.
drop trigger if exists notify_on_post_like_insert on public.post_likes;
drop function if exists public.notify_on_post_like_insert();
create function public.notify_on_post_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id text;
begin
  select b.author_clerk_id into v_author_id
  from public.daily_bites b
  where b.id = new.post_id;

  if v_author_id is null or v_author_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, post_id, is_read, content)
  values (
    v_author_id,
    new.user_id,
    'like',
    new.post_id,
    false,
    format('%s님이 내 글을 좋아했습니다.', new.user_id)
  );

  return new;
end;
$$;

create trigger notify_on_post_like_insert
after insert on public.post_likes
for each row execute function public.notify_on_post_like_insert();

-- Trigger #2: notify post author when someone comments on a post.
drop trigger if exists notify_on_daily_bite_comment_insert on public.daily_bite_comments;
drop function if exists public.notify_on_daily_bite_comment_insert();
create function public.notify_on_daily_bite_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id text;
begin
  select b.author_clerk_id into v_author_id
  from public.daily_bites b
  where b.id = new.post_id;

  if v_author_id is null or v_author_id = new.author_clerk_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, post_id, is_read, content)
  values (
    v_author_id,
    new.author_clerk_id,
    'comment',
    new.post_id,
    false,
    format('%s님이 내 글에 댓글을 남겼습니다.', new.author_name)
  );

  return new;
end;
$$;

create trigger notify_on_daily_bite_comment_insert
after insert on public.daily_bite_comments
for each row execute function public.notify_on_daily_bite_comment_insert();
