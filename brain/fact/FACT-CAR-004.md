---
id: FACT-CAR-004
type: fact
client: car
tags: [economy, team, career]
status: live
date: 2026-10-27
source: "roblox/README.md:103-133"
summary: The Roblox copy has the website's Train and Life tabs (training levels, rest, shop, relationship games, sponsors) and opens them one at a time with the website's first-hour story (Mikey, 27 Oct 2026).
---
Training, the relationship games and the shop run the website's own rules
(`roblox/game/trainingFlow.ts`, `lifeFlow.ts`; drills and games are played
on the device by `trainingPlay.ts` and `relgamePlay.ts`, the server checks
the result). The story beats come from `lib/star/story.ts` unchanged; the
server refuses anything still locked. Checks: `node roblox/tools/twin.mjs
story`, `training`, `life`, `relgames`, and `node roblox/tools/smoke-client.mjs 3`.
