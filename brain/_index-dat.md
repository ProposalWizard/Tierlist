# Brain index dat
ID | summary | tags
FACT-DAT-001 | [SUPERSEDED] star_tuning_notes.sql is PENDING: the table still does not exist live, so run this one again. | data
FACT-DAT-002 | [SUPERSEDED] star_xp_config.sql is PENDING, seen missing in the live database on 20 Oct 2026. | data
FACT-DAT-003 | star_casino.sql: DO NOT RUN; the casino stays on the phone with CASINO_ON_SERVER false. | economy,data
FACT-DAT-004 | Every other listed migration (draft, sofifa, security, star tables) is RUN, no action needed; full rows are in SESSION_LOG.md. | data
FACT-DAT-005 | star_xp_config and star_tuning_notes were run live on 23 Oct 2026 (Claude via the Supabase connector, Harry's yes); update_login_streak now only updates the signed-in player. | data
FACT-DAT-006 | The Supabase connector works in cloud Claude chats since 23 Oct 2026 (project cagkgfketucousksgtbk); CLAUDE.md's "Pending Setup" line saying cloud connectors fail is out of date for Supabase. | process,data
FACT-DAT-008 | Every History tab shows your career's seasons, then the real history before them (data/competition-history, loaded only when the tab opens), each season with winner, runner-up, final score, top scorer, top assister and player of the season. | career,rule,data
FACT-DAT-009 | Cloudflare R2 bucket kib-marketing folders: videos/, ledger/, patch-notes/<repo path>, library/, footage/kib/<code>/, backups/. | client-kib,data
FACT-DAT-010 | Nightly backup 03:00 UK copies the key tables to R2 backups/db/<day>/; the 08:00 UK limits post goes in #health. Both need CRON_SECRET. | data
FACT-DAT-011 | ops_limits.sql is PENDING; until run, the morning limits post cannot read the database and Storage sizes. | data
FACT-DAT-012 | Admin Videos recordings save to R2 first (recordings/<who>/), Drive is the copy; deleted after 30 days unless Keep is on; the link for Claude is /api/dev-recordings/watch. | admin,data
FACT-DAT-013 | Vercel's free (Hobby) plan allows timed jobs once a day only, so the every-5 and every-15 minute jobs run from Supabase pg_cron (patch-notes-media-sync, team-room-quarter-hour), with CRON_SECRET read from the Supabase Vault as 'cron_secret'. | team,data
FACT-DAT-014 | Vercel is back on the free Hobby plan since 23 Nov 2026 (Mikey switched from Pro); the frequent timed jobs run from Supabase and every Vercel cron is daily. | team,data
PRO-DAT-001 | Run a pending migration in the Supabase SQL Editor before touching the related features. | data
PRO-DAT-002 | Bug report? Use the supabase-bug-hunt skill: read the report and the player's save, compare normal saves, reproduce, fix the code. | data
RUL-DAT-001 | SQL for a person to run goes out as an artifact page (each file's name, one line on what it does, a Copy all button and the full text), never as links; build it with scripts/supabase/sql-page.py. | rule,data
RUL-DAT-002 | Every Supabase request Claude makes starts with a plain-English header in the SQL (READ ONLY or CHANGES THE DATABASE, What, Why) and the same lines in chat before the Allow box; changes wait for a yes. | process,data
