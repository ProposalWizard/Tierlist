---
id: FACT-DAT-014
type: fact
client: dat
tags: [team, data]
status: live
date: 2026-11-23
source: "chat with Mikey, 23 Nov 2026"
summary: Vercel is back on the free Hobby plan since 23 Nov 2026 (Mikey switched from Pro); the frequent timed jobs run from Supabase and every Vercel cron is daily.
---
Before the switch, Supabase's calls were checked live: the team-room bots and the video publishing timer answered 200. The patch-notes media sync gets in but fails with "Storage answered 401" (the R2 keys, edited in Vercel on 21 Nov, are refused by Cloudflare; not caused by the move). Hobby limits that matter here: 5-minute function maximum (five routes use the full 300 s), 100 deployments a day, 1 hour of runtime logs. On Hobby a private repository deploys only commits whose author the owner can be matched to; the site deployed from Harry, Leo and Claude chats on Hobby before October, under Mikey's personal GitHub account.
