-- Align standalone Story policies with MASTER_SHARED_SETUP.sql.
-- Both couple accounts can create and edit Aaru's shared Story perspective.
-- Tablet notes use separate policies and are not changed by this script.
-- Run only if Story policies need to be repaired on an existing project.

drop policy if exists "story perspectives insert" on public.story_perspectives;
drop policy if exists "story perspectives update" on public.story_perspectives;

create policy "story perspectives insert"
on public.story_perspectives for insert
to authenticated
with check (public.is_couple_member() and author = 'Aaru');

create policy "story perspectives update"
on public.story_perspectives for update
to authenticated
using (public.is_couple_member() and author = 'Aaru')
with check (public.is_couple_member() and author = 'Aaru');
