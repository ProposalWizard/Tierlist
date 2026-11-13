---
id: FACT-TEAM-005
type: fact
client: team
tags: [team]
status: superseded
superseded_by: FACT-TEAM-006
date: 2026-11-12
source: "lib/teamRoom/botsServer.ts:1-20"
summary: Five Team room bots (Patch, Bug, Health, Today, Jobs). Each posts once however often it is asked, has its own page with Run now, and only bots that do their job are listed. Health and Today can be switched off.
---
Harry, 12 Nov 2026: "have you done a run of all bots?" (recording 15:36-15:46, 21:11-21:48, 23:02-23:22). One list: BOTS in lib/teamRoom/patchBot.ts. Server hands: lib/teamRoom/botsServer.ts. The 15-minute timer (/api/cron/patch-bot, needs CRON_SECRET) runs Patch, the Bug bot's check and the Today bot; an admin opening an admin page runs the same three (/api/admin/team/bots, { run: true }). Run now on a bot's page: { run: true, bot }. Bug bot: a database trigger on feedback posts each report (live, read 12 Nov 2026: trigger 1, tables 3, 0 reports in the last 14 days); the check posts a card for any report of the last 3 days with none, matched by meta.feedback_id (lib/teamRoom/bugs.ts bugPollPlan); it only reads feedback. Health bot: the 08:00 limits post is runHealthBot, the same code as its Run now (which marks the post "asked for by …"); /api/cron/limits calls it. Today bot: 09:00 to 14:00 UK, Monday to Friday, one ask a day naming who has not checked in (lib/teamRoom/today.ts todayAskPlan). Jobs bot: drawn from team/jobs.json, writes nothing, no Run now. Settings (on/off) are a row per bot in team_bot_posts. Tests: tests/star/teamRoomBots.mts (56 checks, a pretend database). SQL: supabase/migrations/team_room_bug_bot.sql (only if the trigger is ever missing). Run table: docs/team-room-run.md.
