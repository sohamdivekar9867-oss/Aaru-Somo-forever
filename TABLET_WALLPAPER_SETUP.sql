-- TABLET WALLPAPER: one shared, private tablet home-screen wallpaper.
-- Run after MASTER_SHARED_SETUP.sql (requires public.is_couple_member()).
-- Both accounts can view it, but only Somo's account can upload or replace it.

create table if not exists public.tablet_wallpapers (
  id boolean primary key default true check (id = true),
  storage_path text not null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.tablet_wallpapers enable row level security;
grant select, insert, update on public.tablet_wallpapers to authenticated;

drop policy if exists "Tablet wallpaper readable by couple" on public.tablet_wallpapers;
create policy "Tablet wallpaper readable by couple"
on public.tablet_wallpapers for select to authenticated
using (public.is_couple_member());

drop policy if exists "Somo can add tablet wallpaper" on public.tablet_wallpapers;
create policy "Somo can add tablet wallpaper"
on public.tablet_wallpapers for insert to authenticated
with check (
  public.is_couple_member()
  and uploaded_by = auth.uid()
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'sohamdivekar9867@gmail.com'
);

drop policy if exists "Somo can replace tablet wallpaper" on public.tablet_wallpapers;
create policy "Somo can replace tablet wallpaper"
on public.tablet_wallpapers for update to authenticated
using (
  public.is_couple_member()
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'sohamdivekar9867@gmail.com'
)
with check (
  public.is_couple_member()
  and uploaded_by = auth.uid()
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'sohamdivekar9867@gmail.com'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tablet-wallpapers', 'tablet-wallpapers', false, 15728640, array['image/*'])
on conflict (id) do update
set public = false, file_size_limit = 15728640, allowed_mime_types = array['image/*'];

drop policy if exists "Tablet wallpaper storage read by couple" on storage.objects;
create policy "Tablet wallpaper storage read by couple"
on storage.objects for select to authenticated
using (bucket_id = 'tablet-wallpapers' and public.is_couple_member());

drop policy if exists "Somo can upload tablet wallpaper" on storage.objects;
create policy "Somo can upload tablet wallpaper"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tablet-wallpapers'
  and public.is_couple_member()
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'sohamdivekar9867@gmail.com'
);

drop policy if exists "Somo can replace tablet wallpaper object" on storage.objects;
create policy "Somo can replace tablet wallpaper object"
on storage.objects for delete to authenticated
using (
  bucket_id = 'tablet-wallpapers'
  and public.is_couple_member()
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'sohamdivekar9867@gmail.com'
);

