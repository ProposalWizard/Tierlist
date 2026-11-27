---
id: FACT-DAT-013
type: fact
client: dat
tags: [team, data]
status: live
date: 2026-11-20
source: "supabase/migrations/frequent_jobs_cron.sql"
summary: Vercel's free (Hobby) plan allows timed jobs once a day only, so the every-5 and every-15 minute jobs run from Supabase pg_cron (patch-notes-media-sync, team-room-quarter-hour), with CRON_SECRET read from the Supabase Vault as 'cron_secret'.
---
vercel.json keeps only daily jobs (backup, limits, recordings); a more frequent one makes every Hobby deploy fail. publish-tick also runs from Supabase (supabase/migrations/publishing.sql). Hobby includes 4 h of function processor time a month (Fluid Active CPU); going over stops functions for up to 30 days. The morning limits post in #health shows the last 30 days' use (lib/backup/vercelUsage.ts, needs VERCEL_TOKEN in Vercel), amber at 75 %, red at 90 %. Measured 21 Oct to 19 Nov 2026: 1.5 h of 4. Hobby is for "personal or non-commercial use" only (Vercel terms, section 4): go Pro when ads or sales start.
