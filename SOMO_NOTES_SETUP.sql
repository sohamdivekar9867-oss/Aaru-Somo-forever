-- Somo's Notes document library. Safe, additive migration: keeps somo_notes
-- untouched and copies its existing single note once into a new document row.
-- Run in the Supabase SQL Editor after reviewing. No website data is deleted.

create table if not exists public.somo_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default '',
  type text not null default 'Personal Journal'
    check (type = 'Personal Journal'),
  content text not null default '',
  plain_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists somo_documents_owner_updated_idx
  on public.somo_documents (owner_id, updated_at desc);

create or replace function public.touch_somo_document_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists somo_documents_touch_updated_at on public.somo_documents;
create trigger somo_documents_touch_updated_at
  before update on public.somo_documents
  for each row execute function public.touch_somo_document_updated_at();

alter table public.somo_documents enable row level security;
revoke all on public.somo_documents from anon;
grant select, insert, update, delete on public.somo_documents to authenticated;

-- Resolve Somda's stable auth.users UUID server-side. The browser never supplies
-- an owner ID as proof of identity, and callers cannot read auth.users directly.
create or replace function public.somo_notes_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users
  where lower(email) = 'sohamdivekar9867@gmail.com'
  limit 1
$$;
revoke all on function public.somo_notes_owner_id() from public, anon;
grant execute on function public.somo_notes_owner_id() to authenticated;

drop policy if exists "Somo and Aaru can read notes documents" on public.somo_documents;
create policy "Somo and Aaru can read notes documents"
  on public.somo_documents for select to authenticated
  using (
    auth.uid() = (select public.somo_notes_owner_id())
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'aaru.saru090901@gmail.com'
  );

drop policy if exists "Only Somda can create notes documents" on public.somo_documents;
create policy "Only Somda can create notes documents"
  on public.somo_documents for insert to authenticated
  with check (
    owner_id = auth.uid()
    and auth.uid() = (select public.somo_notes_owner_id())
  );

drop policy if exists "Only Somda can edit notes documents" on public.somo_documents;
create policy "Only Somda can edit notes documents"
  on public.somo_documents for update to authenticated
  using (auth.uid() = (select public.somo_notes_owner_id()))
  with check (
    owner_id = auth.uid()
    and auth.uid() = (select public.somo_notes_owner_id())
  );

drop policy if exists "Only Somda can delete notes documents" on public.somo_documents;
create policy "Only Somda can delete notes documents"
  on public.somo_documents for delete to authenticated
  using (auth.uid() = (select public.somo_notes_owner_id()));

-- Migrate the existing title/body note without modifying or deleting it.
-- Escaping before adding markup keeps the legacy plain text inert.
insert into public.somo_documents (owner_id, title, type, content, plain_text, updated_at)
select old.user_id,
       coalesce(old.title, 'Personal Journal'),
       'Personal Journal',
       '<p>' || replace(replace(replace(replace(coalesce(old.body, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), chr(10), '<br>') || '</p>',
       coalesce(old.body, ''),
       old.updated_at
from public.somo_notes old
join auth.users owner on owner.id = old.user_id
where lower(owner.email) = 'sohamdivekar9867@gmail.com'
  and not exists (
    select 1 from public.somo_documents current_doc where current_doc.owner_id = old.user_id
  );

comment on table public.somo_documents is
  'Independent Somo''s Notes documents. Authenticated Somda may write; authenticated Somda and Aaru may read.';

