# Supabase and deployment setup

## 1. Supabase SQL

Run these scripts in the Supabase SQL Editor, in this order:

1. `MASTER_SHARED_SETUP.sql` — shared tables, couple account helper, RLS, Story, Dates, Music, and To Do / Not To Do.
2. `REELS_SETUP.sql` — reels and private reel memories.
3. `PHONE_PHOTOS_SETUP.sql` — private phone gallery and profile pictures.

The feature-specific files can be used for targeted repairs. These scripts include the current phone gallery and reels schema. Do not run `STORY_DIARY_UPDATE.sql` after the master script unless repairing Story policies on an existing project; it now follows the same per-account perspective rules.

The master script makes Date photo storage private; the app signs existing public photo URLs and new object paths at read time, so existing `date_entries.photo_urls` values remain supported. The scripts create or replace only their named policies and schema objects. Before running against an existing Supabase project, review any older custom Storage policies: PostgreSQL combines permissive policies with OR, so a pre-existing broad policy can still grant access even after these policies are added.

## 2. Deploy the website

Deploy the website files together from this branch. Do not mix them with older Date Cat, Story, or gallery versions.

## 3. Verify the deployment

Sign in as each account and verify:

- each person can edit only their own Story perspective
- either person can add a chapter and request deletion; the other account approves it
- both users can add Letters, Bucket List items, Dates, and planned quests where enabled
- phone gallery uploads and profile pictures work, and gallery images remain private
- reel memories remain private and are visible to the couple

## 4. Browser-local data

Login/session state and temporary UI state are browser-local. Relationship content is stored in Supabase.

The Teddy / Important Dates feature is configured by `MASTER_SHARED_SETUP.sql`. It seeds 27 August 2026 as the relationship start date for the dynamic Days Together counter.
