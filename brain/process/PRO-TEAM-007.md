---
id: PRO-TEAM-007
type: process
client: team
tags: [process, deploy]
status: live
date: 2026-10-21
source: "docs/brain-sources/patch-notes-auto-2026-10-21.md:10-14"
summary: Ship patch notes alone: node scripts/patch-notes/ship.mjs <versions> --pr makes a patch-notes-only PR to main; feature code waits for Harry's push.
---
It copies only the versions' entries, page lines and patch-notes/pages folders from the branch, and refuses any other file or any code import.
