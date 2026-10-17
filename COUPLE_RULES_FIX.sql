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

commit;
