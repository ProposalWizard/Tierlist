---
id: FACT-TEAM-007
type: fact
client: team
tags: [team, style]
status: live
date: 2026-11-13
source: "lib/teamRoom/claudeBot.ts:1-18"
summary: The Team room's AI bots (Claude, Harry bot, Mikey bot, Leo bot) only answer, are off until ANTHROPIC_API_KEY is set in Vercel, and stop at 20 pounds a calendar month.
---
Harry, 13 Nov 2026: "still no claude bots in admin" · "use API credits up to a certain limit, maybe like 20 pounds". Everything tunable is one constant, CLAUDE_BOT in lib/teamRoom/claudeBot.ts: the model and its prices (from the claude-api skill's table, never from memory), the cap, the limits. The AI is given no tools: the only rows written are the bot's own reply and the month's running total. Key: ANTHROPIC_API_KEY, server only (lib/teamRoom/claudeClient.ts), never in code, a browser or a log; unset = the page says "not switched on yet: one Vercel setting" and an @ gets that line. Cap: each reply's cost is worked out from the token counts the AI service returns and kept on the reply row (meta.usage); a running-total row (bot "claude-tally") covers rows the table has dropped (it keeps 500); the larger of the two counts; each dollar is counted as a pound. At the cap: "I've hit this month's limit", no AI call. Also 1 answer per person per 20 seconds, 60 a day, admins only. It is shown the thread, the channel's last 30 messages, up to 3 Brain notes (lib/teamRoom/brainBundle.json, made at build by scripts/brain/bundle-for-site.mjs) and the 5 newest patch notes; the reply names the Brain codes it was given or says "no note yet". A person's own key (ANTHROPIC_API_KEY_HARRY, _MIKEY, _LEO) gives that person's bot its own cap. No SQL.
