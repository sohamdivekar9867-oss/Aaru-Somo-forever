-- PHONE PHOTOS: private gallery + profile pictures.
-- Run after MASTER_SHARED_SETUP.sql (requires public.is_couple_member()).

create extension if not exists pgcrypto;

create table if not exists public.chat_photos (
  id uuid primary key default gen_random_uuid(),
  profile_name text not null check (profile_name in ('Aaru','Somo')),
  storage_path text not null,
  original_name text,
  mime_type text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.chat_photos enable row level security;
drop policy if exists "Chat photos read by couple" on public.chat_photos;
create policy "Chat photos read by couple"
on public.chat_photos for select to authenticated
using (public.is_couple_member());

drop policy if exists "Chat photos insert own profile" on public.chat_photos;
create policy "Chat photos insert own profile"
on public.chat_photos for insert to authenticated
with check (
  public.is_couple_member()
  and created_by = auth.uid()
  and (
    (profile_name = 'Aaru' and lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com')
    or
    (profile_name = 'Somo' and lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com')
  )
);

drop policy if exists "Chat photos delete own rows" on public.chat_photos;
create policy "Chat photos delete own rows"
on public.chat_photos for delete to authenticated
using (public.is_couple_member() and created_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('chat-photos', 'chat-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Chat photos storage read by couple" on storage.objects;
create policy "Chat photos storage read by couple"
on storage.objects for select to authenticated
using (bucket_id = 'chat-photos' and public.is_couple_member());

drop policy if exists "Chat photos storage upload own folder" on storage.objects;
create policy "Chat photos storage upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-photos'
  and public.is_couple_member()
  and (
    ((storage.foldername(name))[1] = 'Aaru'
      and (storage.foldername(name))[2] = auth.uid()::text
      and lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com')
    or
    ((storage.foldername(name))[1] = 'Somo'
      and (storage.foldername(name))[2] = auth.uid()::text
      and lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com')
    or
    ((storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[3] = auth.uid()::text
      and (
        ((storage.foldername(name))[2] = 'Aaru' and lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com')
        or
        ((storage.foldername(name))[2] = 'Somo' and lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com')
      ))
  )
);

drop policy if exists "Chat photos storage delete own folder" on storage.objects;
create policy "Chat photos storage delete own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-photos'
  and public.is_couple_member()
  and (
    ((storage.foldername(name))[1] in ('Aaru','Somo')
      and (storage.foldername(name))[2] = auth.uid()::text)
    or
    ((storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[3] = auth.uid()::text)
  )
);

-- Existing chat photo setup remains intact.
-- This adds one profile picture per person without touching existing chat_photos rows.

create table if not exists public.phone_profile_pictures (
  id uuid primary key default gen_random_uuid(),
  profile_name text not null unique check (profile_name in ('Aaru','Somo')),
  storage_path text not null,
  updated_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.phone_profile_pictures enable row level security;

drop policy if exists "Profile pictures readable by couple" on public.phone_profile_pictures;
create policy "Profile pictures readable by couple"
on public.phone_profile_pictures
for select to authenticated
using (public.is_couple_member());

drop policy if exists "Profile picture insert own profile" on public.phone_profile_pictures;
create policy "Profile picture insert own profile"
on public.phone_profile_pictures
for insert to authenticated
with check (
  public.is_couple_member()
  and updated_by = auth.uid()
  and (
    (profile_name = 'Aaru' and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = lower('aaru.saru090901@gmail.com'))
    or
    (profile_name = 'Somo' and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = lower('sohamdivekar9867@gmail.com'))
  )
);

drop policy if exists "Profile picture update own profile" on public.phone_profile_pictures;
create policy "Profile picture update own profile"
on public.phone_profile_pictures
for update to authenticated
using (
  public.is_couple_member()
  and updated_by = auth.uid()
)
with check (
  public.is_couple_member()
  and updated_by = auth.uid()
  and (
    (profile_name = 'Aaru' and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = lower('aaru.saru090901@gmail.com'))
    or
    (profile_name = 'Somo' and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = lower('sohamdivekar9867@gmail.com'))
  )
);

-- Keep storage private. These policies only add profile paths; existing chat-photo policies stay untouched.
drop policy if exists "Profile photos upload own folder" on storage.objects;
create policy "Profile photos upload own folder"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-photos'
  and (
    (name like 'profiles/Aaru/' || auth.uid()::text || '/%' and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = lower('aaru.saru090901@gmail.com'))
    or
    (name like 'profiles/Somo/' || auth.uid()::text || '/%' and lower(coalesce((select email from auth.users where id = auth.uid()), '')) = lower('sohamdivekar9867@gmail.com'))
  )
);

drop policy if exists "Profile photos read by couple" on storage.objects;
create policy "Profile photos read by couple"
on storage.objects
for select to authenticated
using (bucket_id = 'chat-photos' and public.is_couple_member() and name like 'profiles/%');

drop policy if exists "Profile photos delete own folder" on storage.objects;
create policy "Profile photos delete own folder"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'chat-photos'
  and (
    name like 'profiles/Aaru/' || auth.uid()::text || '/%'
    or name like 'profiles/Somo/' || auth.uid()::text || '/%'
  )
);
