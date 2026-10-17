-- ============================================================
-- REELS TO TRY + PRIVATE MEMORIES
-- Run once in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.couple_reels (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  instagram_url text not null,
  status text not null default 'to_try' check (status in ('to_try','done')),
  added_by text not null check (added_by in ('Aaru','Somo')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  delete_requested_by uuid references auth.users(id) on delete set null,
  delete_approved_by uuid references auth.users(id) on delete set null
);

-- Normalize author labels from the older "Somda" display name.
alter table public.couple_reels
  drop constraint if exists couple_reels_added_by_check;
update public.couple_reels set added_by = 'Somo' where added_by = 'Somda';
alter table public.couple_reels
  add constraint couple_reels_added_by_check
  check (added_by in ('Aaru', 'Somo'));

create table if not exists public.reel_memories (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.couple_reels(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('video','photo')),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

alter table public.couple_reels enable row level security;
alter table public.reel_memories enable row level security;

-- Storage bucket for private reel memories.
insert into storage.buckets (id, name, public)
values ('reel-memories', 'reel-memories', false)
on conflict (id) do update set public = false;

-- Clean/rebuild table policies.
drop policy if exists "Couple reels read" on public.couple_reels;
drop policy if exists "Couple reels insert" on public.couple_reels;
drop policy if exists "Couple reels update own" on public.couple_reels;
drop policy if exists "Couple reels delete after dual approval" on public.couple_reels;

create policy "Couple reels read"
on public.couple_reels for select to authenticated
using (public.is_couple_member());

create policy "Couple reels insert"
on public.couple_reels for insert to authenticated
with check (
  public.is_couple_member()
  and created_by = auth.uid()
  and (
    (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and added_by = 'Aaru')
    or
    (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and added_by = 'Somo')
  )
);

-- Only the person who added a reel can edit its title/link/status.
-- Delete-approval fields are protected by the trigger + RPC functions below.
create policy "Couple reels update own"
on public.couple_reels for update to authenticated
using (public.is_couple_member() and created_by = auth.uid())
with check (public.is_couple_member() and created_by = auth.uid());

-- A row can only actually be deleted after BOTH sides have approved it.
create policy "Couple reels delete after dual approval"
on public.couple_reels for delete to authenticated
using (
  public.is_couple_member()
  and delete_requested_by is not null
  and delete_approved_by is not null
);

-- ============================================================
-- Protect the two-person deletion fields from normal UPDATEs.
-- They may only be changed through the SECURITY DEFINER functions.
-- ============================================================
create or replace function public.protect_reel_delete_fields()
returns trigger
language plpgsql
security invoker
as $$
begin
  if (old.delete_requested_by is distinct from new.delete_requested_by
     or old.delete_approved_by is distinct from new.delete_approved_by)
     and current_setting('app.reel_delete_action', true) is distinct from '1' then
    raise exception 'Deletion approval fields can only be changed through the delete approval actions.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_reel_delete_fields_trigger on public.couple_reels;
create trigger protect_reel_delete_fields_trigger
before update on public.couple_reels
for each row execute function public.protect_reel_delete_fields();

-- ============================================================
-- Delete request / approval functions.
-- ============================================================
create or replace function public.request_reel_delete(p_reel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member() then
    raise exception 'Not authorised.';
  end if;

  perform set_config('app.reel_delete_action','1',true);

  update public.couple_reels
  set delete_requested_by = auth.uid(),
      delete_approved_by = null,
      updated_at = now()
  where id = p_reel_id
    and created_by = auth.uid();

  if not found then
    raise exception 'Only the person who added this reel can request its deletion.';
  end if;
end;
$$;

create or replace function public.approve_reel_delete(p_reel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member() then
    raise exception 'Not authorised.';
  end if;

  perform set_config('app.reel_delete_action','1',true);

  update public.couple_reels
  set delete_approved_by = auth.uid(),
      updated_at = now()
  where id = p_reel_id
    and delete_requested_by is not null
    and delete_requested_by <> auth.uid()
    and created_by <> auth.uid();

  if not found then
    raise exception 'The other person must request deletion first.';
  end if;
end;
$$;

create or replace function public.mark_reel_done(p_reel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member() then
    raise exception 'Not authorised.';
  end if;

  update public.couple_reels
  set status = 'done',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_reel_id;

  if not found then
    raise exception 'Reel not found.';
  end if;
end;
$$;

revoke all on function public.request_reel_delete(uuid) from public;
revoke all on function public.approve_reel_delete(uuid) from public;
revoke all on function public.mark_reel_done(uuid) from public;
create or replace function public.mark_reel_to_try(p_reel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_couple_member() then
    raise exception 'Not authorised.';
  end if;

  update public.couple_reels
  set status = 'to_try',
      completed_at = null,
      updated_at = now()
  where id = p_reel_id
    and status = 'done';

  if not found then
    raise exception 'Reel is not currently marked done.';
  end if;
end;
$$;

revoke all on function public.mark_reel_to_try(uuid) from public;
grant execute on function public.mark_reel_to_try(uuid) to authenticated;

grant execute on function public.request_reel_delete(uuid) to authenticated;
grant execute on function public.approve_reel_delete(uuid) to authenticated;
grant execute on function public.mark_reel_done(uuid) to authenticated;

-- Keep the requested limit enforced server-side: max 1 video + max 5 photos per reel.
create or replace function public.limit_reel_memories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  photo_count integer;
  video_count integer;
begin
  select count(*) filter (where media_type = 'photo'),
         count(*) filter (where media_type = 'video')
  into photo_count, video_count
  from public.reel_memories
  where reel_id = new.reel_id;

  if new.media_type = 'photo' and photo_count >= 5 then
    raise exception 'A reel can have at most 5 photos.';
  end if;
  if new.media_type = 'video' and video_count >= 1 then
    raise exception 'A reel can have at most 1 video.';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_reel_memories_trigger on public.reel_memories;
create trigger limit_reel_memories_trigger
before insert on public.reel_memories
for each row execute function public.limit_reel_memories();

-- ============================================================
-- Memories table policies.
-- Both can view. Each person manages the media they uploaded.
-- ============================================================
drop policy if exists "Reel memories read" on public.reel_memories;
drop policy if exists "Reel memories insert own" on public.reel_memories;
drop policy if exists "Reel memories delete own" on public.reel_memories;

create policy "Reel memories read"
on public.reel_memories for select to authenticated
using (public.is_couple_member());

create policy "Reel memories insert own"
on public.reel_memories for insert to authenticated
with check (
  public.is_couple_member()
  and uploaded_by = auth.uid()
  and exists (select 1 from public.couple_reels r where r.id = reel_id and r.status = 'done')
);

create policy "Reel memories delete own"
on public.reel_memories for delete to authenticated
using (public.is_couple_member() and uploaded_by = auth.uid());

-- ============================================================
-- Private Storage policies.
-- Files are stored as: auth.uid()/random-file-name.ext
-- ============================================================
drop policy if exists "Reel memory storage read" on storage.objects;
drop policy if exists "Reel memory storage insert" on storage.objects;
drop policy if exists "Reel memory storage delete approved" on storage.objects;
drop policy if exists "Reel memory storage delete own" on storage.objects;

create policy "Reel memory storage read"
on storage.objects for select to authenticated
using (
  bucket_id = 'reel-memories'
  and public.is_couple_member()
);

create policy "Reel memory storage insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'reel-memories'
  and public.is_couple_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Reel memory storage delete approved"
on storage.objects for delete to authenticated
using (
  bucket_id = 'reel-memories'
  and public.is_couple_member()
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.reel_memories m
      join public.couple_reels r on r.id = m.reel_id
      where m.storage_path = name
        and r.delete_approved_by is not null
    )
  )
);
