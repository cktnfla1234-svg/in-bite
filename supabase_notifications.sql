-- Activity / notifications (run in Supabase SQL editor after Clerk JWT is wired for RLS).
-- Adjust RLS to match how you map Clerk `sub` to `target_id` / `actor_id`.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('like', 'comment', 'reply', 'comment_like')),
  actor_id text not null,
  target_id text not null,
  content text not null,
  post_id text,
  comment_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_target_created_idx
  on public.notifications (target_id, created_at desc);

comment on table public.notifications is 'Social activity feed: likes, comments, replies, comment likes.';
comment on column public.notifications.target_id is 'Recipient Clerk user id (who should see this).';

alter table public.notifications enable row level security;

-- Example policies (requires Clerk JWT in Supabase as `sub` = clerk user id)
create policy "notifications_select_own"
  on public.notifications
  for select
  using (auth.jwt() ->> 'sub' = target_id);

create policy "notifications_insert_authenticated"
  on public.notifications
  for insert
  with check (auth.jwt() ->> 'sub' = actor_id);

create policy "notifications_update_own"
  on public.notifications
  for update
  using (auth.jwt() ->> 'sub' = target_id);

-- Realtime: Dashboard → Database → Replication → enable `notifications`,
-- or (if your role allows): alter publication supabase_realtime add table public.notifications;
