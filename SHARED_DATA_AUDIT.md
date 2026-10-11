# Aaru & Somo — Shared Experience Audit

This build treats the website as one shared world for two authenticated accounts.

## Audited sections

- **Our Story** — Supabase `story_chapters`, `story_perspectives`, and deletion-request tables. Shared between Aaru and Somo. Both accounts can edit Aaru’s perspective; Tablet notes have separate permissions. Chapter deletion requires the other person to authorize it.
- **Our Dates** — Supabase `date_entries`. Add/edit/delete/read are authenticated shared operations. Date photos use Supabase Storage; uploads/deletes require one of the two accounts.
- **Planned Date Cat quests** — Supabase `planned_date_quests`. Saving from Date Cat and viewing/removing planned quests in Our Dates are shared backend operations.
- **Bucket List** — Supabase `bucket_list`. All changes are shared backend operations.
- **Love Letters** — Supabase `love_letters`. All letters are shared backend operations.
- **Login/session** — `sessionStorage` is intentionally local to the current browser session. This is authentication state, not relationship content.
- **Homepage / Date Cat UI** — temporary dialogue, current selections, and modal state are intentionally browser-local because they are not shared content. Saved quests go to Supabase.

## Important architecture rule

If Aaru creates something that Somo should see, or Somo creates something Aaru should see, the data must be stored in Supabase. Browser `localStorage`/`sessionStorage` must not be used for relationship content.

## RLS

The final SQL changes the relationship tables from public/anon access to authenticated access restricted to the two configured couple accounts. This prevents the frontend's public Supabase key from being enough to read or write the shared content without a valid login session.

## Date photo note

The existing `date-photos` bucket remains public-read because existing date records store public image URLs. Upload and delete operations are restricted to the two authenticated accounts. Changing the bucket to private would require migrating stored photo URLs to paths/signed URLs.

- **Teddy / Important Dates** — shared Supabase table `important_dates`. The Days Together counter uses the relationship-start row and updates dynamically from the current date. Important dates, descriptions, and little memories are shared between both accounts.
