-- Background Radio: shared private MP4/M4A uploads for the couple.
-- Run once in the Supabase SQL Editor. Safe to re-run.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'background-radio',
  'background-radio',
  false,
  52428800,
  array['audio/mp4', 'audio/x-m4a', 'video/mp4', 'application/mp4']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.background_radio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('audio/mp4', 'audio/x-m4a', 'video/mp4', 'application/mp4')),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.background_radio_tracks enable row level security;

drop policy if exists "Couple can read background radio tracks" on public.background_radio_tracks;
create policy "Couple can read background radio tracks"
on public.background_radio_tracks for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
);

drop policy if exists "Couple can upload background radio tracks" on public.background_radio_tracks;
create policy "Couple can upload background radio tracks"
on public.background_radio_tracks for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
);

drop policy if exists "Uploader can delete background radio tracks" on public.background_radio_tracks;
create policy "Uploader can delete background radio tracks"
on public.background_radio_tracks for delete
to authenticated
using (
  uploaded_by = auth.uid()
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
);

drop policy if exists "Couple can read background radio files" on storage.objects;
create policy "Couple can read background radio files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'background-radio'
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
);

drop policy if exists "Couple can upload own background radio files" on storage.objects;
create policy "Couple can upload own background radio files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'background-radio'
  and split_part(name, '/', 1) = auth.uid()::text
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
);

drop policy if exists "Uploader can delete own background radio files" on storage.objects;
create policy "Uploader can delete own background radio files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'background-radio'
  and split_part(name, '/', 1) = auth.uid()::text
  and lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
);

commit;
