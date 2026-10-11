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

-- Clean older activity records whenever a new session starts.
create or replace function public.trim_old_website_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
