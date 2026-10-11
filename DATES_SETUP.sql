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

insert into storage.buckets (id,name,public) values ('date-photos','date-photos',false) on conflict (id) do update set public=false;
drop policy if exists "Couple can upload date photos" on storage.objects;
drop policy if exists "Couple can delete date photos" on storage.objects;
drop policy if exists "Public can upload date photos" on storage.objects;
drop policy if exists "Public can delete date photos" on storage.objects;
create policy "Couple can upload date photos" on storage.objects for insert to authenticated with check (bucket_id='date-photos' and public.is_couple_member());
create policy "Couple can delete date photos" on storage.objects for delete to authenticated using (bucket_id='date-photos' and public.is_couple_member());
drop policy if exists "Couple can read date photos" on storage.objects;
create policy "Couple can read date photos" on storage.objects for select to authenticated
using (bucket_id='date-photos' and public.is_couple_member());
-- Existing public URLs are converted to signed URLs by date-detail.js.

