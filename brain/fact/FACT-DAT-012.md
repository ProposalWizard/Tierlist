---
id: FACT-DAT-012
type: fact
client: dat
tags: [admin, data]
status: live
date: 2026-11-12
source: "docs/r2-layout.md:15"
summary: Admin Videos recordings save to R2 first (recordings/<who>/), Drive is the copy; deleted after 30 days unless Keep is on; the link for Claude is /api/dev-recordings/watch.
---
The link carries a per-recording token (no sign-in) and redirects to a one-hour signed R2 link; scripts/screen-video/fetch.py downloads it. The clean-up is /api/cron/recordings, once a night, only with CRON_SECRET, only inside recordings/. Code: lib/recordings/. Test: tests/star/recordingStore.mts.
