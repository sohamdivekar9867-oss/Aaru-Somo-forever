-- PHONE WALLPAPER: one shared, private phone wallpaper.
-- Run after MASTER_SHARED_SETUP.sql (requires public.is_couple_member()).
-- Only Aaru's account can upload or replace the shared image.

create table if not exists public.phone_wallpapers (
  id boolean primary key default true check (id = true),
  storage_path text not null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.phone_wallpapers enable row level security;
grant select, insert, update on public.phone_wallpapers to authenticated;

drop policy if exists "Phone wallpaper readable by couple" on public.phone_wallpapers;
create policy "Phone wallpaper readable by couple"
on public.phone_wallpapers for select to authenticated
using (public.is_couple_member());

drop policy if exists "Aaru can add phone wallpaper" on public.phone_wallpapers;
create policy "Aaru can add phone wallpaper"
on public.phone_wallpapers for insert to authenticated
with check (
  public.is_couple_member()
  and uploaded_by = auth.uid()
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'aaru.saru090901@gmail.com'
);

drop policy if exists "Aaru can replace phone wallpaper" on public.phone_wallpapers;
create policy "Aaru can replace phone wallpaper"
on public.phone_wallpapers for update to authenticated
using (
  public.is_couple_member()
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'aaru.saru090901@gmail.com'
)
with check (
  public.is_couple_member()
  and uploaded_by = auth.uid()
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'aaru.saru090901@gmail.com'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('phone-wallpapers', 'phone-wallpapers', false, 15728640, array['image/*'])
on conflict (id) do update
set public = false, file_size_limit = 15728640, allowed_mime_types = array['image/*'];

drop policy if exists "Phone wallpaper storage read by couple" on storage.objects;
create policy "Phone wallpaper storage read by couple"
on storage.objects for select to authenticated
using (bucket_id = 'phone-wallpapers' and public.is_couple_member());

drop policy if exists "Aaru can upload phone wallpaper" on storage.objects;
create policy "Aaru can upload phone wallpaper"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'phone-wallpapers'
  and public.is_couple_member()
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'aaru.saru090901@gmail.com'
);

drop policy if exists "Aaru can replace phone wallpaper object" on storage.objects;
create policy "Aaru can replace phone wallpaper object"
on storage.objects for delete to authenticated
using (
  bucket_id = 'phone-wallpapers'
  and public.is_couple_member()
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'aaru.saru090901@gmail.com'
);

