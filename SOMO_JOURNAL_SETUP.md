# Somo's Journal setup

1. Review `SOMO_JOURNAL_SETUP.sql`.
2. Run it in the Supabase SQL Editor for project `swqaakxywwajesuajflz` before deploying the updated tablet files.
3. Deploy `tablet.html`, `tablet.js`, `journal.css`, and `journal.js` together.
4. Sign in as Somda and test creating, editing, and deleting entries. Sign in as Aaru to confirm reading works and write requests fail.

The SQL creates a separate `somo_journal_entries` table with a manually entered `entry_date`; it does not migrate or modify Somo's Notes, Aaru's Diary, or any existing table. RLS resolves Somda's stable auth user ID from `auth.users` server-side and permits the Aaru account to select entries only. The browser's account check only controls which controls are shown.

The database setup has not been run against the live Supabase project. Confirm both account permissions and direct API write rejection after running it.

