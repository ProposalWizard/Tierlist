---
id: FACT-CAR-001
type: fact
client: car
tags: [team, rule, career]
status: live
date: 2026-10-27
source: "roblox/README.md"
summary: Road to Ballon d'Or has a Roblox copy in roblox/ (Mikey, 27 Oct 2026); the website's code is converted, never rewritten, and twin tests check it.
---
Mikey asked for the Road to Ballon d'Or as a Roblox game, separate from the
website. `roblox/tools/ts2luau` converts the website's career code to Luau;
`roblox/tools/twin.mjs` runs each test on both and every line must match.
After a website change: `node roblox/tools/build.mjs`, then the twin tests.
Never edit `roblox/src/Game` by hand. Stages: `roblox/PLAN.md`.
