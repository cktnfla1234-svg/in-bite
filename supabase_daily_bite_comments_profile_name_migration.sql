-- Daily Bite comments profile-name migration
-- Purpose:
-- 1) stop storing denormalized `author_name` in comments
-- 2) enforce relational join key from comments -> profiles
-- 3) support app query that reads latest display_name/full_name from profiles

begin;

-- Ensure join column is indexed.
create index if not exists daily_bite_comments_author_clerk_idx
  on public.daily_bite_comments (author_clerk_id);

-- Ensure FK exists with the constraint name used by the client-side select relation hint.
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'daily_bite_comments'
      and tc.constraint_name = 'daily_bite_comments_author_clerk_id_fkey'
      and tc.constraint_type = 'FOREIGN KEY'
  ) then
    alter table public.daily_bite_comments
      add constraint daily_bite_comments_author_clerk_id_fkey
      foreign key (author_clerk_id)
      references public.profiles (clerk_id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

-- Remove obsolete denormalized field.
alter table public.daily_bite_comments
  drop column if exists author_name;

commit;
