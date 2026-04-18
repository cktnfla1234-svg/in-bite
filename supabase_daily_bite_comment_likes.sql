-- Daily Bite comment likes (run in Supabase SQL editor).
-- comment_id matches client-generated UUID stored in local comment threads.

create table if not exists public.daily_bite_comment_likes (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  comment_id text not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  constraint daily_bite_comment_likes_unique unique (comment_id, user_id)
);

create index if not exists daily_bite_comment_likes_comment_idx
  on public.daily_bite_comment_likes (comment_id);

comment on table public.daily_bite_comment_likes is 'Per-comment likes; count = rows per comment_id.';

alter table public.daily_bite_comment_likes enable row level security;

-- Authenticated users: read all counts (adjust if you need stricter privacy).
create policy "daily_bite_comment_likes_select"
  on public.daily_bite_comment_likes
  for select
  using (true);

create policy "daily_bite_comment_likes_insert_own"
  on public.daily_bite_comment_likes
  for insert
  with check (auth.jwt() ->> 'sub' = user_id);

create policy "daily_bite_comment_likes_delete_own"
  on public.daily_bite_comment_likes
  for delete
  using (auth.jwt() ->> 'sub' = user_id);

-- Realtime: enable in Dashboard → Database → Replication, or:
-- alter publication supabase_realtime add table public.daily_bite_comment_likes;
