---
id: PRO-TEAM-009
type: process
client: team
tags: [process, rule]
status: live
date: 2026-10-27
source: "docs/brain-sources/harry-squeeze-media-2026-10-27.md:3-5"
summary: Before shipping a patch note, run scripts/patch-notes/squeeze-media.sh <version> (clips CRF 30, stills JPEG ~80%); the patch-notes folder must stay under Vercel's 250 MB route cap.
---
Leo's method (e5aedcbd), adopted for Harry's notes on 27 Oct 2026. Same size, same look; a file is only replaced when it gets at least 5% smaller. The lasting fix is moving patch-note media to Cloudflare R2.
