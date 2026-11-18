---
id: FACT-DAT-010
type: fact
client: dat
tags: [data]
status: live
date: 2026-11-12
source: "docs/backup.md:11-12"
summary: Nightly backup 03:00 UK copies the key tables to R2 backups/db/<day>/; the 08:00 UK limits post goes in #health. Both need CRON_SECRET.
---
Kept: 14 nightly + 8 Sunday copies. Never sofifa_players. Restore into `<table>_restore` with `scripts/backup/restore.mts`; plain steps in docs/backup.md. Code: lib/backup/, app/api/cron/{backup,limits}.
