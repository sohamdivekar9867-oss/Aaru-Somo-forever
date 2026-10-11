-- Somo's Tablet setup
-- Somo account email configured for private dashboard access: sohamdivekar9867@gmail.com
-- This creates private diary storage and website-session tracking for the tablet apps.

create table if not exists public.website_activity_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
-- Safe migration for an already-created activity table.
alter table public.website_activity_sessions
  add column if not exists user_email text;

-- Backfill email for sessions created by the earlier tracker version.
update public.website_activity_sessions s
set user_email = lower(u.email)
from auth.users u
where s.user_id = u.id
  and (s.user_email is null or s.user_email = '');

create index if not exists website_activity_started_at_idx
  on public.website_activity_sessions (started_at desc);
create index if not exists website_activity_user_idx
  on public.website_activity_sessions (user_id, started_at desc);

alter table public.website_activity_sessions enable row level security;
drop policy if exists "Users can record own sessions" on public.website_activity_sessions;
create policy "Users can record own sessions"
  on public.website_activity_sessions for insert to authenticated
  with check (
    user_id = auth.uid()
    and lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
drop policy if exists "Users can update own sessions" on public.website_activity_sessions;
create policy "Users can update own sessions"
  on public.website_activity_sessions for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
drop policy if exists "Somo can read all sessions and users can read own" on public.website_activity_sessions;
create policy "Somo can read all sessions and users can read own"
  on public.website_activity_sessions for select to authenticated
  using (
    user_id = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sohamdivekar9867@gmail.com')
  );
drop policy if exists "Somo can delete old sessions" on public.website_activity_sessions;
create policy "Somo can delete old sessions"
  on public.website_activity_sessions for delete to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sohamdivekar9867@gmail.com')
    and started_at < now() - interval '3 days'
  );

create table if not exists public.somo_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.somo_notes enable row level security;
drop policy if exists "Somo can read own notes" on public.somo_notes;
create policy "Somo can read own notes"
  on public.somo_notes for select to authenticated
  using (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sohamdivekar9867@gmail.com')
  );
drop policy if exists "Somo can insert own notes" on public.somo_notes;
create policy "Somo can insert own notes"
  on public.somo_notes for insert to authenticated
  with check (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sohamdivekar9867@gmail.com')
  );
drop policy if exists "Somo can update own notes" on public.somo_notes;
create policy "Somo can update own notes"
  on public.somo_notes for update to authenticated
  using (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sohamdivekar9867@gmail.com')
  )
  with check (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sohamdivekar9867@gmail.com')
  );

-- Section history. Store event names only; never store edited content.
create table if not exists public.website_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  event_type text not null check (event_type in ('section_view', 'section_click', 'create', 'update', 'delete')),
  section text not null check (length(trim(section)) between 1 and 80),
  page_path text not null default '' check (length(page_path) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists website_activity_events_created_at_idx
  on public.website_activity_events (created_at desc);
create index if not exists website_activity_events_user_created_idx
  on public.website_activity_events (user_id, created_at desc);

alter table public.website_activity_events enable row level security;
drop policy if exists "Users can record own section activity" on public.website_activity_events;
create policy "Users can record own section activity"
  on public.website_activity_events for insert to authenticated
  with check (
    user_id = auth.uid()
    and lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
drop policy if exists "Somo can read section activity" on public.website_activity_events;
create policy "Somo can read section activity"
  on public.website_activity_events for select to authenticated
  using (
    user_id = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = lower('sohamdivekar9867@gmail.com')
  );

-- Database writes log only the section/table and operation; row contents are never copied.
create or replace function public.log_website_activity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $track$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_section text;
  v_event_type text;
begin
  v_event_type := case TG_OP
    when 'INSERT' then 'create'
    when 'UPDATE' then 'update'
    when 'DELETE' then 'delete'
    else 'update'
  end;

  -- Ignore SQL editor, service-role, and other requests without a signed-in user.
  if v_user_id is null then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  v_section := case
    when TG_TABLE_NAME in ('story_chapters', 'story_perspectives', 'story_pages') then 'Story'
    when TG_TABLE_NAME like '%phone%photo%' or TG_TABLE_NAME like '%photo%phone%' then 'Phone Photos'
    when TG_TABLE_NAME in ('bucket_list') then 'Bucket List'
    when TG_TABLE_NAME in ('date_entries', 'planned_date_quests') then 'Our Dates'
    when TG_TABLE_NAME in ('important_dates') then 'Important Dates'
    when TG_TABLE_NAME in ('love_letters') then 'Love Letters'
    when TG_TABLE_NAME in ('couple_music') then 'Our Music'
    when TG_TABLE_NAME like '%radio%' then 'Background Radio'
    when TG_TABLE_NAME in ('couple_rules') then 'Our Rules'
    else initcap(replace(TG_TABLE_NAME, '_', ' '))
  end;

  insert into public.website_activity_events (user_id, user_email, event_type, section, page_path)
  values (v_user_id, v_email, v_event_type, v_section, '');

  -- Keep detailed activity history to the same three-day window as sessions.
  delete from public.website_activity_events
  where created_at < now() - interval '3 days';

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$track$;

-- Install or replace the logging trigger on every existing app table.
-- Re-run this setup after adding future tables to include them.
do $track_install$
declare
  v_table record;
begin
  for v_table in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('website_activity_events', 'website_activity_sessions')
  loop
    execute format('drop trigger if exists log_website_activity_change on public.%I', v_table.tablename);
    execute format(
      'create trigger log_website_activity_change after insert or update or delete on public.%I for each row execute function public.log_website_activity_change()',
      v_table.tablename
    );
  end loop;
end;
$track_install$;

-- Clean older activity records whenever a new session starts.
create or replace function public.trim_old_website_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.website_activity_events
  where created_at < now() - interval '3 days';
  delete from public.website_activity_sessions
  where started_at < now() - interval '3 days';
  return new;
end;
$$;
drop trigger if exists trim_old_website_activity_on_insert on public.website_activity_sessions;
create trigger trim_old_website_activity_on_insert
  before insert on public.website_activity_sessions
  for each row execute function public.trim_old_website_activity();

-- Optional: for strict automatic deletion even when nobody visits the site,
-- enable pg_cron in Supabase Database > Extensions, then schedule:
-- select cron.schedule(
--   'delete-old-website-activity',
--   '17 * * * *',
--   $$delete from public.website_activity_sessions where started_at < now() - interval '3 days'$$
-- );
