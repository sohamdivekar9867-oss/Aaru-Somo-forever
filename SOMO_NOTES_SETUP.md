# Somo's Notes setup

The redesigned tablet Notes library uses the new `public.somo_documents` table. No database changes were run automatically.

1. Review `SOMO_NOTES_SETUP.sql`.
2. In the Supabase dashboard for project `swqaakxywwajesuajflz`, open SQL Editor and run that file.
3. The script adds a document table, read/write policies, and a server-side helper that resolves Somda's authenticated UUID from `auth.users`. It leaves `somo_notes` and its existing row in place, then copies that row once as the first journal document. Re-running it does not repeat the migration when a document already exists for that owner.
4. Deploy the updated `tablet.html`, `tablet.css`, `tablet.js`, and `notes.js` together.
5. Sign in as Somda and confirm the imported note appears, then try create, edit, format, rename, duplicate, and delete. Sign in separately as Aaru to check that the library opens read-only. Direct API write rejection follows from the table's RLS policies but still needs verification against the live project.

The SQL grants reads only to the authenticated owner UUID and the Aaru account email claim; all writes require the database-resolved Somda UUID. The browser's owner check only controls which controls are shown. Supabase RLS remains the enforcement boundary.

The existing local recovery draft key `somo-notes-draft-v1` is not deleted or overwritten. This migration does not automatically import that browser-only draft; the existing cloud `somo_notes` row is imported. Keep the browser profile containing the local draft until you have reviewed it manually.
