---
id: FACT-DAT-005
type: fact
client: dat
tags: [admin, data]
status: live
date: 2026-10-22
source: "lib/patchNoteMedia.ts:8-17"
summary: Patch-note pictures live in the R2 bucket under patch-notes/<path>; the file route sends a signed link when the object is there, else the bundled copy; one button on /admin/patch-notes moves them.
---
The move runs on Vercel only (the keys are there). Until the follow-up drops
patch-notes media from next.config.mjs outputFileTracingIncludes, each route
still bundles the pictures as the fallback.
