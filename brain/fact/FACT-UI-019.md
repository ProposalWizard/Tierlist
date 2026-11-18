---
id: FACT-UI-019
type: fact
client: ui
tags: [economy, ui]
status: live
date: 2026-11-05
source: "mobile/README.md:1-20"
summary: The phone app is a separate packed build of the game only (mobile/): offline, saves on the phone, no sign-in, no casino; the website is unchanged.
---
Mikey, 5 Nov 2026: the app is only Road to Ballon d'Or, "completely, perfectly playable offline". Built with KIB_APP_BUILD=1 (next.config.mjs: only *.app.tsx pages, plain files), its players, badges and settings packed in by mobile/scripts/pack.mts and answered by lib/app/offline.ts. Every app-only change sits behind PACKED_APP (lib/app/packed.ts), false on the website, so the website build carries none of it. The casino (every way in) is hidden in the app only. Store name for now: "KnowItBall: Road to the Golden Ball". New player data reaches the app only in a new app version. Mikey's checklist: https://claude.ai/artifact/1SM2hTVXv7mbNgTKZxxbb3
