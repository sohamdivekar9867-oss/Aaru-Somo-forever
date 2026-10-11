-- Align standalone Story policy update with MASTER_SHARED_SETUP.sql.
-- Each account may create and edit only its own perspective.
-- Run only if Story policies need to be repaired on an existing project.

drop policy if exists "story perspectives insert" on public.story_perspectives;
drop policy if exists "story perspectives update" on public.story_perspectives;

create policy "story perspectives insert"
on public.story_perspectives for insert
to authenticated
with check (
  (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and author = 'Aaru')
  or
  (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and author = 'Somo')
);

create policy "story perspectives update"
on public.story_perspectives for update
to authenticated
using (
  (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and author = 'Aaru')
  or
  (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and author = 'Somo')
)
with check (
  (lower(auth.jwt() ->> 'email') = 'aaru.saru090901@gmail.com' and author = 'Aaru')
  or
  (lower(auth.jwt() ->> 'email') = 'sohamdivekar9867@gmail.com' and author = 'Somo')
);
