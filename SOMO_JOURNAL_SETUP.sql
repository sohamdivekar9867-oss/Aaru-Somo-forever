-- Somo's Journal: additive setup for a separate daily-thought collection.
-- Run in Supabase SQL Editor after review. No existing tables or rows are changed.

create table if not exists public.somo_journal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists somo_journal_entries_date_order_idx
  on public.somo_journal_entries (entry_date desc, created_at desc, id asc);

create or replace function public.touch_somo_journal_entry_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists somo_journal_entries_touch_updated_at on public.somo_journal_entries;
create trigger somo_journal_entries_touch_updated_at
  before update on public.somo_journal_entries
  for each row execute function public.touch_somo_journal_entry_updated_at();

alter table public.somo_journal_entries enable row level security;
revoke all on public.somo_journal_entries from anon;
grant select, insert, update, delete on public.somo_journal_entries to authenticated;

-- Look up Somda's stable Supabase UUID on the server; the client never supplies
-- an owner ID as proof of identity and cannot query auth.users directly.
create or replace function public.somo_journal_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from auth.users
  where lower(email) = 'sohamdivekar9867@gmail.com'
  limit 1
$$;
revoke all on function public.somo_journal_owner_id() from public, anon;
grant execute on function public.somo_journal_owner_id() to authenticated;

drop policy if exists "Somo and Aaru can read journal entries" on public.somo_journal_entries;
create policy "Somo and Aaru can read journal entries"
  on public.somo_journal_entries for select to authenticated
  using (
    auth.uid() = (select public.somo_journal_owner_id())
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'aaru.saru090901@gmail.com'
  );

drop policy if exists "Only Somda can create journal entries" on public.somo_journal_entries;
create policy "Only Somda can create journal entries"
  on public.somo_journal_entries for insert to authenticated
  with check (
    owner_id = auth.uid()
    and auth.uid() = (select public.somo_journal_owner_id())
  );

drop policy if exists "Only Somda can edit journal entries" on public.somo_journal_entries;
create policy "Only Somda can edit journal entries"
  on public.somo_journal_entries for update to authenticated
  using (auth.uid() = (select public.somo_journal_owner_id()))
  with check (
    owner_id = auth.uid()
    and auth.uid() = (select public.somo_journal_owner_id())
  );

drop policy if exists "Only Somda can delete journal entries" on public.somo_journal_entries;
create policy "Only Somda can delete journal entries"
  on public.somo_journal_entries for delete to authenticated
  using (auth.uid() = (select public.somo_journal_owner_id()));

comment on table public.somo_journal_entries is
  'Daily thoughts entered by Somda. Somda can write; Somda and Aaru can read.';

