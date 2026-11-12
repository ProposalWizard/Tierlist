---
id: FACT-TEAM-004
type: fact
client: team
tags: [team, style]
status: live
date: 2026-11-12
source: "lib/teamRoom/channels.ts:86-130"
summary: Every Team room channel has its own tabs and opens on its first one (CHANNEL_TABS). #today is a channel: a check-in is a "[#today]" message, /today words writes one. Me and Team board are views inside the room.
---
Harry, 12 Nov 2026 (recording, 13:07-14:10, 14:55-15:36, 20:10-20:33). Tabs: #general Messages, Pinned. #today Today, This week, Messages. #ideas Ideas board, Messages. #todo Tasks (Mine or Everyone), Messages. #bugs Open reports, Fixed, Messages. #health Limits, Messages. #patch-notes Archive, Messages. #marketing Production board, Messages. #context Brain, Messages. #connectors Messages only. A tab that does nothing is not listed; an empty channel says in one line what it is for (CHANNEL_HOW). Links: ?tab=chat&ch=bugs&tb=fixed opens a tab; &view=me your home; &view=board the Team board tab. No new table: a check-in is a message in #today (lib/teamRoom/today.ts: a person's check-in for a UK day is their newest non-reply #today message that day); a Team board note is a message in the quiet channel "[#board]". Me (components/teamRoom/roomMe.tsx): one-tap status, today's check-in, to-do with proposals, your bars, quick links, schedules, notifications, the look. Tests: tests/star/teamRoomWays.mts. Run table: docs/team-room-run.md.
