-- Repair the legacy added_by check that prevents new To Do / Not To Do entries.
-- Older versions stored the author's display name as "Somda"; current app code
-- and row-level security policies use "Somo".
begin;

alter table public.couple_rules
  drop constraint if exists couple_rules_added_by_check;

update public.couple_rules
set added_by = 'Somo'
where added_by = 'Somda';

alter table public.couple_rules
  add constraint couple_rules_added_by_check
  check (added_by in ('Aaru', 'Somo'));

-- Music and Reels also stored the legacy author display name in older databases.
alter table public.couple_music
  drop constraint if exists couple_music_added_by_check;

update public.couple_music
set added_by = 'Somo'
where added_by = 'Somda';

alter table public.couple_music
  add constraint couple_music_added_by_check
  check (added_by in ('Aaru', 'Somo'));

alter table public.couple_reels
  drop constraint if exists couple_reels_added_by_check;

update public.couple_reels
set added_by = 'Somo'
where added_by = 'Somda';

alter table public.couple_reels
  add constraint couple_reels_added_by_check
  check (added_by in ('Aaru', 'Somo'));

commit;
