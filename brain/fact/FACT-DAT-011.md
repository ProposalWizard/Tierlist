---
id: FACT-DAT-011
type: fact
client: dat
tags: [data]
status: live
date: 2026-11-12
source: "docs/backup.md:130-132"
summary: ops_limits.sql is PENDING; until run, the morning limits post cannot read the database and Storage sizes.
---
It adds one read-only function, callable only with the service key. Run it once in the Supabase SQL Editor.
