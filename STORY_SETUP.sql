-- OUR STORY: shared chapters + two private perspectives
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Keep standalone Story setup aligned with the shared setup's account allowlist.
create or replace function public.is_couple_member()
returns boolean
language sql
stable
security invoker
as $
  select lower(coalesce(auth.jwt() ->> 'email','')) in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  );
$;

create table if not exists public.story_chapters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  display_order integer not null default 0,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_perspectives (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.story_chapters(id) on delete cascade,
  author text not null check (author in ('Aaru','Somo')),
  content text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, author)
);

create unique index if not exists story_chapters_title_lower_unique
on public.story_chapters (lower(title));

-- Migrate the existing story_pages data into the shared-chapter model.
-- "How It Began" is intentionally not migrated.
do $$
begin
  insert into public.story_chapters (title, display_order, published, created_at, updated_at)
  select min(trim(title)) as title,
         min(coalesce(display_order, 0)) as display_order,
         bool_or(coalesce(published, true)) as published,
         now() as created_at,
         now() as updated_at
  from public.story_pages
  where trim(coalesce(title, '')) <> ''
    and lower(trim(title)) <> 'how it began'
  group by lower(trim(title))
  on conflict (lower(title)) do nothing;
exception when undefined_table then
  null;
end $$;

do $$
begin
  insert into public.story_perspectives (chapter_id, author, content, created_at, updated_at)
  select c.id,
         case
           when lower(coalesce(sp.author,'') || ' ' || coalesce(sp.slug,'')) like '%soham%' then 'Somo'
           else 'Aaru'
         end as author,
         coalesce(sp.content, ''),
         now(),
         now()
  from public.story_pages sp
  join public.story_chapters c
    on lower(trim(c.title)) = lower(trim(sp.title))
  where lower(trim(coalesce(sp.title, ''))) <> 'how it began'
  on conflict (chapter_id, author) do update
    set content = excluded.content,
        updated_at = greatest(public.story_perspectives.updated_at, excluded.updated_at);
exception when undefined_table then
  null;
end $$;

-- Remove the old placeholder from the legacy table so it cannot appear in older code.
do $$
begin
  delete from public.story_pages where lower(trim(coalesce(title,''))) = 'how it began';
exception when undefined_table then
  null;
end $$;

alter table public.story_chapters enable row level security;
alter table public.story_perspectives enable row level security;

drop policy if exists "story chapters read" on public.story_chapters;
drop policy if exists "story chapters insert" on public.story_chapters;
drop policy if exists "story chapters update" on public.story_chapters;
drop policy if exists "story perspectives read" on public.story_perspectives;
drop policy if exists "story perspectives insert" on public.story_perspectives;
drop policy if exists "story perspectives update" on public.story_perspectives;
drop policy if exists "story perspectives delete" on public.story_perspectives;

create policy "story chapters read"
on public.story_chapters for select
to authenticated
using (public.is_couple_member());

create policy "story chapters insert"
on public.story_chapters for insert
to authenticated
with check (public.is_couple_member());

-- Either Aaru or Somo may edit the shared chapter heading.
create policy "story chapters update"
on public.story_chapters for update
to authenticated
using (public.is_couple_member())
with check (public.is_couple_member());

create policy "story perspectives read"
on public.story_perspectives for select
to authenticated
using (public.is_couple_member());

-- Aaru can create only Aaru rows; Somo can create only Somo rows.
create policy "story perspectives insert"
on public.story_perspectives for insert
to authenticated
with check (
  (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and author = 'Aaru')
  or
  (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and author = 'Somo')
);

-- Each person can update only their own perspective.
create policy "story perspectives update"
on public.story_perspectives for update
to authenticated
using (
  (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and author = 'Aaru')
  or
  (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and author = 'Somo')
)
with check (
  (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and author = 'Aaru')
  or
  (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and author = 'Somo')
);

-- IMPORTANT: a chapter is shared metadata. There is intentionally NO direct
-- DELETE policy for story_chapters. A user can delete only their own
-- perspective. If that was the last perspective, this trigger removes the
-- now-empty chapter automatically, so it disappears from the index as well.
create or replace function public.remove_empty_story_chapter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.story_perspectives
    where chapter_id = old.chapter_id
  ) then
    delete from public.story_chapters
    where id = old.chapter_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_remove_empty_story_chapter on public.story_perspectives;
create trigger trg_remove_empty_story_chapter
after delete on public.story_perspectives
for each row
execute function public.remove_empty_story_chapter();

-- Internal rollback helper: only removes a chapter that the current user
-- just created and that still has no perspectives. It is not a user-facing delete.
create or replace function public.cleanup_empty_story_chapter(p_chapter_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  select exists(
    select 1 from public.story_chapters c
    where c.id = p_chapter_id
      and c.created_by = auth.uid()
      and not exists (select 1 from public.story_perspectives p where p.chapter_id = c.id)
  ) into ok;
  if ok then
    delete from public.story_chapters where id = p_chapter_id;
  end if;
  return ok;
end;
$$;
revoke all on function public.cleanup_empty_story_chapter(uuid) from public;
grant execute on function public.cleanup_empty_story_chapter(uuid) to authenticated;

-- ============================================================
-- TWO-PERSON CHAPTER DELETION
-- A deletion is only a request until the other person authorizes it.
-- ============================================================

create table if not exists public.story_chapter_delete_requests (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.story_chapters(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  approver_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','cancelled')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create unique index if not exists story_one_pending_delete_per_chapter
on public.story_chapter_delete_requests (chapter_id)
where status = 'pending';

alter table public.story_chapter_delete_requests enable row level security;

drop policy if exists "story delete requests read" on public.story_chapter_delete_requests;
drop policy if exists "story delete requests insert" on public.story_chapter_delete_requests;

create policy "story delete requests read"
on public.story_chapter_delete_requests for select
to authenticated
using (
  lower(auth.jwt() ->> 'email') in ('aaru.saru090901@gmail.com','sohamdivekar9867@gmail.com')
);

create policy "story delete requests insert"
on public.story_chapter_delete_requests for insert
to authenticated
with check (
  requester_id = auth.uid()
  and lower(requester_email) = lower(auth.jwt() ->> 'email')
  and lower(requester_email) in ('aaru.saru090901@gmail.com','sohamdivekar9867@gmail.com')
  and (
    (lower(requester_email) = 'aaru.saru090901@gmail.com' and lower(approver_email) = 'sohamdivekar9867@gmail.com')
    or
    (lower(requester_email) = 'sohamdivekar9867@gmail.com' and lower(approver_email) = 'aaru.saru090901@gmail.com')
  )
);

-- The requester has NO direct chapter-delete capability.
-- Only this SECURITY DEFINER function can perform the final deletion,
-- and it verifies that the currently logged-in user is the designated approver.
create or replace function public.authorize_story_chapter_deletion(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.story_chapter_delete_requests%rowtype;
  approver_email text := lower(auth.jwt() ->> 'email');
  chapter_title text;
begin
  if approver_email not in ('aaru.saru090901@gmail.com','sohamdivekar9867@gmail.com') then
    raise exception 'Not authorized';
  end if;

  select * into req
  from public.story_chapter_delete_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Deletion request is no longer pending';
  end if;

  if lower(req.approver_email) <> approver_email then
    raise exception 'Only the designated second person can authorize this deletion';
  end if;

  select title into chapter_title
  from public.story_chapters
  where id = req.chapter_id;

  if chapter_title is null then
    update public.story_chapter_delete_requests
    set status = 'approved', approved_at = now()
    where id = req.id;
    return jsonb_build_object('deleted', false, 'already_missing', true);
  end if;

  update public.story_chapter_delete_requests
  set status = 'approved', approved_at = now()
  where id = req.id;

  delete from public.story_chapters where id = req.chapter_id;

  return jsonb_build_object('deleted', true, 'chapter_id', req.chapter_id, 'title', chapter_title);
end;
$$;

revoke all on function public.authorize_story_chapter_deletion(uuid) from public;
grant execute on function public.authorize_story_chapter_deletion(uuid) to authenticated;
