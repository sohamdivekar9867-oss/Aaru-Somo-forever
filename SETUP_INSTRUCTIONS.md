# Supabase and deployment setup

## 1. Supabase SQL

Run these scripts in the Supabase SQL Editor, in this order:

1. `MASTER_SHARED_SETUP.sql` — shared tables, couple account helper, RLS, Story, Dates, Music, and To Do / Not To Do.
2. `REELS_SETUP.sql` — reels and private reel memories.
3. `PHONE_PHOTOS_SETUP.sql` — private phone gallery and profile pictures.
4. `BACKGROUND_RADIO_SETUP.sql` — shared MP4/M4A background radio uploads.

If adding a To Do / Not To Do reminder fails with `couple_rules_added_by_check`, run `COUPLE_RULES_FIX.sql` in Supabase SQL Editor. It migrates legacy `Somda` author labels to `Somo` and refreshes the `added_by` checks for reminders, the music playlist, and reels. The same repair is included in `MASTER_SHARED_SETUP.sql` for future setup runs.

The feature-specific files can be used for targeted repairs. These scripts include the current phone gallery and reels schema. Do not run `STORY_DIARY_UPDATE.sql` after the master script unless repairing Story policies on an existing project; it now lets both couple accounts edit Aaru’s shared Story perspective.

The master script makes Date photo storage private; the app signs existing public photo URLs and new object paths at read time, so existing `date_entries.photo_urls` values remain supported. The scripts create or replace only their named policies and schema objects. Before running against an existing Supabase project, review any older custom Storage policies: PostgreSQL combines permissive policies with OR, so a pre-existing broad policy can still grant access even after these policies are added.

## 2. Deploy the website

Deploy the website files together from this branch. Do not mix them with older Date Cat, Story, or gallery versions.

## 3. Verify the deployment

Sign in as each account and verify:

- both accounts can view and edit Aaru’s Story perspective
- Aaru cannot edit Somo’s notes in the Tablet section
- either person can add a chapter and request deletion; the other account approves it
- both users can add Letters, Bucket List items, Dates, and planned quests where enabled
- phone gallery uploads and profile pictures work, and gallery images remain private
- reel memories remain private and are visible to the couple

## 4. Browser-local data

Login/session state and temporary UI state are browser-local. Relationship content is stored in Supabase.

The Teddy / Important Dates feature is configured by `MASTER_SHARED_SETUP.sql`. It seeds 27 August 2026 as the relationship start date for the dynamic Days Together counter.
