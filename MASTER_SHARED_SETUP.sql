-- AARU & SOMO SHARED WORLD --
-- Run MASTER_SHARED_SETUP.sql once in Supabase SQL Editor.
-- All relationship content is shared through Supabase.
-- Only the two registered couple accounts are allowed to access shared data.

create extension if not exists pgcrypto;

create or replace function public.is_couple_member()
returns boolean
language sql
stable
security invoker
as $$
  select lower(coalesce(auth.jwt() ->> 'email','')) in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  );
$$;

-- DATES + DATE PHOTOS
create table if not exists public.date_entries (
  id uuid primary key default gen_random_uuid(),
  location text not null,
  occasion text,
  date date not null,
  description text,
  detail text,
  favourite_moment text,
  photo_urls jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.date_entries add column if not exists occasion text;
alter table public.date_entries add column if not exists description text;
alter table public.date_entries add column if not exists detail text;
alter table public.date_entries add column if not exists favourite_moment text;
alter table public.date_entries add column if not exists photo_urls jsonb not null default '[]'::jsonb;
alter table public.date_entries add column if not exists display_order integer not null default 0;
alter table public.date_entries add column if not exists created_at timestamptz not null default now();
alter table public.date_entries add column if not exists updated_at timestamptz not null default now();
alter table public.date_entries enable row level security;
drop policy if exists "Couple can view date entries" on public.date_entries;
drop policy if exists "Couple can add date entries" on public.date_entries;
drop policy if exists "Couple can update date entries" on public.date_entries;
drop policy if exists "Couple can delete date entries" on public.date_entries;
create policy "Couple can view date entries" on public.date_entries for select to authenticated using (public.is_couple_member());
create policy "Couple can add date entries" on public.date_entries for insert to authenticated with check (public.is_couple_member());
create policy "Couple can update date entries" on public.date_entries for update to authenticated using (public.is_couple_member()) with check (public.is_couple_member());
create policy "Couple can delete date entries" on public.date_entries for delete to authenticated using (public.is_couple_member());

insert into storage.buckets (id,name,public) values ('date-photos','date-photos',true) on conflict (id) do update set public=true;
drop policy if exists "Couple can upload date photos" on storage.objects;
drop policy if exists "Couple can delete date photos" on storage.objects;
drop policy if exists "Public can upload date photos" on storage.objects;
drop policy if exists "Public can delete date photos" on storage.objects;
create policy "Couple can upload date photos" on storage.objects for insert to authenticated with check (bucket_id='date-photos' and public.is_couple_member());
create policy "Couple can delete date photos" on storage.objects for delete to authenticated using (bucket_id='date-photos' and public.is_couple_member());
-- The bucket remains public-read because existing date entries store public image URLs.
-- Upload/delete still require one of the two authenticated accounts.

-- SHARED BUCKET LIST
create table if not exists public.bucket_list (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  expected_date date,
  completed boolean not null default false,
  completion_date date,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bucket_list add column if not exists expected_date date;
alter table public.bucket_list add column if not exists completed boolean not null default false;
alter table public.bucket_list add column if not exists completion_date date;
alter table public.bucket_list add column if not exists display_order integer not null default 0;
alter table public.bucket_list add column if not exists created_at timestamptz not null default now();
alter table public.bucket_list add column if not exists updated_at timestamptz not null default now();
alter table public.bucket_list enable row level security;
drop policy if exists "Public bucket list reads" on public.bucket_list;
drop policy if exists "Public bucket list inserts" on public.bucket_list;
drop policy if exists "Public bucket list updates" on public.bucket_list;
drop policy if exists "Public bucket list deletes" on public.bucket_list;
drop policy if exists "Couple can view bucket list" on public.bucket_list;
drop policy if exists "Couple can add bucket list" on public.bucket_list;
drop policy if exists "Couple can update bucket list" on public.bucket_list;
drop policy if exists "Couple can delete bucket list" on public.bucket_list;
create policy "Couple can view bucket list" on public.bucket_list for select to authenticated using (public.is_couple_member());
create policy "Couple can add bucket list" on public.bucket_list for insert to authenticated with check (public.is_couple_member());
create policy "Couple can update bucket list" on public.bucket_list for update to authenticated using (public.is_couple_member()) with check (public.is_couple_member());
create policy "Couple can delete bucket list" on public.bucket_list for delete to authenticated using (public.is_couple_member());

-- DATE CAT PLANNED QUESTS
create table if not exists public.planned_date_quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text,
  activity text,
  duration text,
  budget text,
  romance integer not null default 3,
  objectives jsonb not null default '[]'::jsonb,
  note text,
  date date not null,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);
alter table public.planned_date_quests add column if not exists location text;
alter table public.planned_date_quests add column if not exists activity text;
alter table public.planned_date_quests add column if not exists duration text;
alter table public.planned_date_quests add column if not exists budget text;
alter table public.planned_date_quests add column if not exists romance integer not null default 3;
alter table public.planned_date_quests add column if not exists objectives jsonb not null default '[]'::jsonb;
alter table public.planned_date_quests add column if not exists note text;
alter table public.planned_date_quests add column if not exists date date;
alter table public.planned_date_quests add column if not exists status text not null default 'planned';
alter table public.planned_date_quests add column if not exists created_at timestamptz not null default now();
alter table public.planned_date_quests enable row level security;
drop policy if exists "Public can view planned date quests" on public.planned_date_quests;
drop policy if exists "Public can add planned date quests" on public.planned_date_quests;
drop policy if exists "Public can update planned date quests" on public.planned_date_quests;
drop policy if exists "Public can delete planned date quests" on public.planned_date_quests;
drop policy if exists "Couple can view planned date quests" on public.planned_date_quests;
drop policy if exists "Couple can add planned date quests" on public.planned_date_quests;
drop policy if exists "Couple can update planned date quests" on public.planned_date_quests;
drop policy if exists "Couple can delete planned date quests" on public.planned_date_quests;
create policy "Couple can view planned date quests" on public.planned_date_quests for select to authenticated using (public.is_couple_member());
create policy "Couple can add planned date quests" on public.planned_date_quests for insert to authenticated with check (public.is_couple_member());
create policy "Couple can update planned date quests" on public.planned_date_quests for update to authenticated using (public.is_couple_member()) with check (public.is_couple_member());
create policy "Couple can delete planned date quests" on public.planned_date_quests for delete to authenticated using (public.is_couple_member());

-- LOVE LETTERS
create table if not exists public.love_letters (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  content text not null,
  signature text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.love_letters add column if not exists recipient text;
alter table public.love_letters add column if not exists content text;
alter table public.love_letters add column if not exists signature text;
alter table public.love_letters add column if not exists display_order integer not null default 0;
alter table public.love_letters add column if not exists created_at timestamptz not null default now();
alter table public.love_letters add column if not exists updated_at timestamptz not null default now();
alter table public.love_letters enable row level security;
drop policy if exists "Authenticated users can view love letters" on public.love_letters;
drop policy if exists "Authenticated users can create love letters" on public.love_letters;
drop policy if exists "Authenticated users can update love letters" on public.love_letters;
drop policy if exists "Authenticated users can delete love letters" on public.love_letters;
drop policy if exists "Couple can view love letters" on public.love_letters;
drop policy if exists "Couple can create love letters" on public.love_letters;
drop policy if exists "Couple can update love letters" on public.love_letters;
drop policy if exists "Couple can delete love letters" on public.love_letters;
create policy "Couple can view love letters" on public.love_letters for select to authenticated using (public.is_couple_member());
create policy "Couple can create love letters" on public.love_letters for insert to authenticated with check (public.is_couple_member());
create policy "Couple can update love letters" on public.love_letters for update to authenticated using (public.is_couple_member()) with check (public.is_couple_member());
create policy "Couple can delete love letters" on public.love_letters for delete to authenticated using (public.is_couple_member());

-- OUR STORY: shared chapters + two private perspectives
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

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
  on conflict (chapter_id, author) do nothing;
exception when undefined_table then
  null;
end $$;

-- Keep the legacy source table unchanged; migration is non-destructive.

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

-- TEDDY: SHARED IMPORTANT DATES
create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  emoji text not null default '❤️',
  title text not null,
  event_date date not null,
  description text,
  little_memory text,
  is_relationship_start boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.important_dates add column if not exists emoji text not null default '❤️';
alter table public.important_dates add column if not exists title text;
alter table public.important_dates add column if not exists event_date date;
alter table public.important_dates add column if not exists description text;
alter table public.important_dates add column if not exists little_memory text;
alter table public.important_dates add column if not exists is_relationship_start boolean not null default false;
alter table public.important_dates add column if not exists created_at timestamptz not null default now();
alter table public.important_dates add column if not exists updated_at timestamptz not null default now();
alter table public.important_dates enable row level security;
drop policy if exists "Couple can view important dates" on public.important_dates;
drop policy if exists "Couple can add important dates" on public.important_dates;
drop policy if exists "Couple can update important dates" on public.important_dates;
drop policy if exists "Couple can delete important dates" on public.important_dates;
create policy "Couple can view important dates" on public.important_dates for select to authenticated using (public.is_couple_member());
create policy "Couple can add important dates" on public.important_dates for insert to authenticated with check (public.is_couple_member());
create policy "Couple can update important dates" on public.important_dates for update to authenticated using (public.is_couple_member()) with check (public.is_couple_member());
create policy "Couple can delete important dates" on public.important_dates for delete to authenticated using (public.is_couple_member());

-- Seed the relationship start date used by the dynamic "Days Together" counter.
insert into public.important_dates (emoji,title,event_date,description,little_memory,is_relationship_start)
select '❤️','The Day We Started Dating','2026-08-27','The day Aaru said yes.','The day everything changed. ❤️',true
where not exists (select 1 from public.important_dates where is_relationship_start=true);


-- ============================================================
-- OUR MUSIC + TO DO / NOT TO DO
-- Run this once in Supabase SQL Editor after the existing setup.
-- ============================================================

create table if not exists public.couple_music (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  youtube_url text not null,
  added_by text not null check (added_by in ('Aaru','Somo')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.couple_music enable row level security;

drop policy if exists "Couple music read" on public.couple_music;
drop policy if exists "Couple music insert" on public.couple_music;
drop policy if exists "Couple music update own" on public.couple_music;
drop policy if exists "Couple music delete own" on public.couple_music;

create policy "Couple music read" on public.couple_music
for select to authenticated
using (public.is_couple_member());

create policy "Couple music insert" on public.couple_music
for insert to authenticated
with check (
  public.is_couple_member()
  and created_by = auth.uid()
  and (
    (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and added_by = 'Aaru')
    or
    (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and added_by = 'Somo')
  )
);

create policy "Couple music update own" on public.couple_music
for update to authenticated
using (public.is_couple_member() and created_by = auth.uid())
with check (public.is_couple_member() and created_by = auth.uid());

create policy "Couple music delete own" on public.couple_music
for delete to authenticated
using (public.is_couple_member() and created_by = auth.uid());

-- ============================================================
-- TO DO / NOT TO DO
-- target = the person the reminder is FOR.
-- Only the other person can create a reminder for that target.
-- Each person can edit/delete only reminders they created.
-- ============================================================

create table if not exists public.couple_rules (
  id uuid primary key default gen_random_uuid(),
  target text not null check (target in ('Aaru','Somo')),
  kind text not null check (kind in ('to_do','not_do')),
  text text not null,
  added_by text not null check (added_by in ('Aaru','Somo')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.couple_rules enable row level security;

drop policy if exists "Couple rules read" on public.couple_rules;
drop policy if exists "Couple rules insert" on public.couple_rules;
drop policy if exists "Couple rules update own" on public.couple_rules;
drop policy if exists "Couple rules delete own" on public.couple_rules;

create policy "Couple rules read" on public.couple_rules
for select to authenticated
using (public.is_couple_member());

create policy "Couple rules insert" on public.couple_rules
for insert to authenticated
with check (
  public.is_couple_member()
  and created_by = auth.uid()
  and (
    (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and added_by = 'Aaru' and target = 'Somo')
    or
    (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and added_by = 'Somo' and target = 'Aaru')
  )
);

create policy "Couple rules update own" on public.couple_rules
for update to authenticated
using (public.is_couple_member() and created_by = auth.uid())
with check (public.is_couple_member() and created_by = auth.uid());

create policy "Couple rules delete own" on public.couple_rules
for delete to authenticated
using (public.is_couple_member() and created_by = auth.uid());

-- ============================================================
-- REELS TO TRY
-- Run REELS_SETUP.sql after this master setup.
-- ============================================================
