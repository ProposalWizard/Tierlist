---
id: FACT-TEAM-006
type: fact
client: team
tags: [team, style]
status: live
date: 2026-11-13
source: "lib/teamRoom/atBots.ts:1-18"
summary: Nine Team room bots. Patch, Bug, Health, Today and Jobs post as before and can be @ed in any channel; each answers once, in a thread, by plain rules. Claude and Harry, Mikey and Leo bot are AI.
---
Harry, 13 Nov 2026: "can't @ any bots like I should be able to @patch notes bot in general and ask for x patch notes". Replaces FACT-TEAM-005 (five bots); what those five post, and when, is unchanged (lib/teamRoom/botsServer.ts). One list: BOTS in lib/teamRoom/patchBot.ts; the @ names: AT_BOTS in lib/teamRoom/extras.ts ("@Harry bot" is the bot, never Harry). Typing @ suggests bots under people. A bot's answer is a row in team_bot_posts with meta.kind "reply", meta.reply_to (the thread), meta.ask (the asking message), meta.by: one per bot per ask. A bot's row is never read as a question, so a bot never answers a bot; a message older than 10 minutes is never answered. Trigger: the asker's browser posts { ask: id } to /api/admin/team/bots the moment the message is sent (messages are written straight from the browser, so no server route sees them); the 15-minute timer (/api/cron/patch-bot) and an admin opening an admin page sweep for a missed one. What each understands: ASK_ME in lib/teamRoom/atBots.ts (Patch: a version, latest, last 3, since Monday, what did Leo ship, a search word; Bug: open, latest, fixed; Health: the limits now; Today: who is in; Jobs: mine or a name). Unknown words: one line with two examples. No new table. Tests: tests/star/teamRoomAtBots.mts (96 checks). Stills: docs/stills/team-room-at-bots. Run table: docs/team-room-run.md.
