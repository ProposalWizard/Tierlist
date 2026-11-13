# The nightly backup, and how to get something back

Agreed with Harry, 12 Nov 2026 (Supabase + Cloudflare plan, projects 3 and 5).
Code: `lib/backup/`, `app/api/cron/backup`, `app/api/cron/limits`.
Tests: `npx tsx tests/star/backup.mts`.

## What runs when

| UK time | Job | What it does |
|---|---|---|
| 03:00 every night | `/api/cron/backup` | Copies the key tables into Cloudflare R2. |
| 08:00 every morning | `/api/cron/limits` | Posts the limits in the Team room's #health. |

- Vercel runs timed jobs in UTC. Each job is listed twice in `vercel.json`
  (once for winter, once for summer). Only the run that lands on the UK hour
  does anything; the other one stops at once.
- Both jobs need **CRON_SECRET** in Vercel. Without it they refuse to run and
  post "did not run: CRON_SECRET missing" in #health (at most twice a day).
- If a night fails, the Health bot posts a red line in #health straight away,
  and the 8am post says so again.

## Where the copies are

One folder per night in the R2 bucket, under `backups/db/`:

```
backups/db/2026-11-12/star_careers.jsonl.gz
backups/db/2026-11-12/feedback.jsonl.gz
...
backups/db/2026-11-12/manifest.json   rows, size and time for every table
```

Each `.jsonl.gz` file is one table: one row per line, then zipped.

**The folder date is the morning the copy was made (03:00).** So the copy of
"Tuesday" (everything up to the end of Tuesday) is in **Wednesday's** folder.

Kept: the last 14 nights, and the last 8 Sundays (about 2 months back).
Older folders are deleted, but only after a night that worked. Nothing outside
`backups/db/` is ever deleted.

## What is in it

Careers and what players own: `star_careers` (every save), `star_hall_of_fame`,
`star_wallet`, `star_wallet_ledger`, `star_entitlements`, `star_paid_items`,
`star_save_flags`, `star_legend_shares`.
Accounts: `user_profiles`, `user_roles`, `user_xp`, `user_stats`, and
`auth_users` (the sign-in list: id, email, sign-in dates, settings).
Feedback: `feedback`, `tester_links`.
The Team room: every `team_*` table (messages, DMs, ideas, tasks, notes, bot posts, ...).

Not in it, on purpose: `sofifa_players` (the FIFA stats have their own cold
copy), tierlists and their pictures, draft rooms, puzzles. The full list is
`BACKUP_TABLES` in `lib/backup/plan.ts`. A table whose migration was never
run shows as "not in the database yet" and does not count as a failure.

## How to get Mikey's career back from Tuesday

Nothing here touches the live game until the very last step, which you do by
hand and only if you want to.

**1. Settings.** In `.env.local` on the computer you run this on, put the
four R2 settings and the two Supabase settings. Copy each from Vercel →
Project → Settings → Environment Variables:
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Delete them from `.env.local` again when you are done.

**2. Pick the folder.** Tuesday's career is in Wednesday's folder. If
Wednesday was 11 Nov 2026, the day is `2026-11-11`.

**3. Run the helper:**

```
npx tsx scripts/backup/restore.mts --day 2026-11-11 --table star_careers --person Mikey
```

- `--person Mikey` finds Mikey's account in the Team room list and keeps only
  his rows (all his save slots). For a player who is not on the team, use
  `--where user_id=<their id>` instead (find the id in `auth_users` with
  `--table auth_users --file-only`, then search the file for their email).
- The rows are always saved on your computer first (the script prints where).
- `--file-only` stops there: no database at all.

**4. The spare table.** The first time, the script stops and prints three
lines of SQL that make an empty spare table, `star_careers_restore`, with the
same columns as the live one. Run them in the Supabase SQL Editor, then run
the helper again. It loads the rows into `star_careers_restore` only. The live
`star_careers` is not touched.

**5. Look.** In the SQL Editor:

```sql
-- READ ONLY. What: Mikey's saves, backup next to live. Why: check before putting back.
SELECT r.slot, r.updated_at AS backup_saved, c.updated_at AS live_saved
FROM star_careers_restore r LEFT JOIN star_careers c USING (user_id, slot);
```

**Putting it back** (by hand, only when sure). This changes the live game:

```sql
-- CHANGES THE DATABASE. What: puts Mikey's slot 1 career back to the backup.
-- Why: his live save was lost or broken.
UPDATE star_careers c SET career = r.career, updated_at = now()
FROM star_careers_restore r
WHERE c.user_id = r.user_id AND c.slot = r.slot AND r.slot = 1;
```

Then ask Mikey to reload the game. His phone also keeps its own copy; if it
offers a choice between two saves, he picks the cloud one.

**Tidy up:** `DROP TABLE star_careers_restore;` when done.

The same steps work for any table in the list: `--table feedback`,
`--table team_messages`, and so on. The spare table is always
`<table>_restore`.

## The morning limits post (#health, 08:00)

| Line | Limit | How it is read |
|---|---|---|
| Database | 500 MB (free plan) | `ops_limits()` in Supabase |
| Supabase Storage | 1 GB (free plan) | `ops_limits()` in Supabase |
| Cloudflare R2 | 10 GB (free) | adds up every file in the bucket, by top folder |
| Last night's backup | OK or FAILED, with size | that night's `manifest.json` |

🟢 under 75 %, 🟠 75 % to 90 %, 🔴 90 % or more. A missing reading is ⚪, never
green. A red post buzzes phones (🔔 for #health: "Only when red" by default).

`ops_limits()` comes from `supabase/migrations/ops_limits.sql` (PENDING: run
it once in the SQL Editor). Until then the database and Storage lines say
"could not read".
