---
id: FACT-KIB-014
type: fact
client: kib
tags: [ui, process, client-kib]
status: live
date: 2026-11-19
source: "lib/discord.ts:1-20"
summary: The Knowitball Discord is a plan and kit: scripts/discord builds the server (10 roles, 21 channels, onboarding), Join buttons (footer, game Settings) show only once NEXT_PUBLIC_DISCORD_INVITE is set, and patch notes with a `discord` line post to #updates via DISCORD_UPDATES_WEBHOOK.
---
Leo, 19 Nov 2026: "the best possible discord … most importantly just so the number of ppl who play the game increase." Plan and growth playbook: docs/DISCORD.md. Server built from scripts/discord/blueprint.json by setup-server.mjs (name-matched, safe to rerun; bots cannot create servers, so Leo makes the empty one and adds the bot). The Patch bot's 15-minute run sends a note's player line once, when it first announces the note (lib/teamRoom/patchBotServer.ts); notes without `discord` are never posted (team notes stay internal). Never @everyone from a bot; no invite rewards (Discord rules). Clicks: PostHog `discord_click` {from}.
