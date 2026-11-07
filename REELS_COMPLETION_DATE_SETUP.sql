-- Allow either member of the couple to add or update a date on a completed reel.
-- Run after REELS_SETUP.sql in the Supabase SQL Editor. No existing rows are changed.
create or replace function public.set_reel_completion_date(
  p_reel_id uuid,
  p_completion_date date
)
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
  set completed_at = case
        when p_completion_date is null then null
        else p_completion_date::timestamp at time zone 'Asia/Kolkata'
      end,
      updated_at = now()
  where id = p_reel_id
    and status = 'done';

  if not found then
    raise exception 'Reel not found or not marked as done.';
  end if;
end;
$$;

revoke all on function public.set_reel_completion_date(uuid, date) from public;
grant execute on function public.set_reel_completion_date(uuid, date) to authenticated;

