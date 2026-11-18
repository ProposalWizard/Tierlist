---
id: FACT-TEAM-002
type: fact
client: team
tags: [data, process, style, team]
status: live
date: 2026-11-12
source: "lib/teamRoom/patchBot.ts:1-25"
summary: The Patch bot posts each new patch note once in #general naming the two who did not write it; comments ride "[pn:version]" in one thread; the post moves to #patch-notes when all three have read it. No new table.
---
Harry, 12 Nov 2026 (recording, 23:22-25:40). The site writes the post into team_bot_posts with its own key: every 15 minutes on a timer (/api/cron/patch-bot, needs CRON_SECRET) and when an admin opens an admin page (/api/admin/team/bots). Asking twice posts once. Only notes published from 12 Nov 2026 are announced (PATCH_BOT.from). On/off and the reminder (Never, 24 h, 48 h) are a settings row in the same table, changed on the bot's own page (Team room → Bots → Patch bot). "Copy thread for Claude" copies the version and every comment as text. Tests: tests/star/teamRoomPatchBot.mts. Stills: docs/stills/team-room-v2/.
