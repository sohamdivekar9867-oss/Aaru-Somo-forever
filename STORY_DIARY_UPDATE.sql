-- AARU'S DIARY UPDATE
-- Run once in the Supabase SQL Editor after deploying the revised Our Story files.
-- Keeps existing Somo rows untouched, but the website reads and writes only Aaru's diary.
-- Both approved accounts can create and update rows whose author is 'Aaru'.

drop policy if exists "story perspectives insert" on public.story_perspectives;
drop policy if exists "story perspectives update" on public.story_perspectives;

create policy "story perspectives insert"
on public.story_perspectives for insert
to authenticated
with check (
  lower(auth.jwt() ->> 'email') in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
  and author = 'Aaru'
);

create policy "story perspectives update"
on public.story_perspectives for update
to authenticated
using (
  lower(auth.jwt() ->> 'email') in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
  and author = 'Aaru'
)
with check (
  lower(auth.jwt() ->> 'email') in (
    'aaru.saru090901@gmail.com',
    'sohamdivekar9867@gmail.com'
  )
  and author = 'Aaru'
);
