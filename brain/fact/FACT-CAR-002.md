---
id: FACT-CAR-002
type: fact
client: car
tags: [career, team]
status: live
date: 2026-10-27
source: "roblox/README.md:74-78"
summary: The Roblox match is played on the player's device with the website's own rules; the server checks the stats and puts them in the career (Mikey, 27 Oct 2026).
---
Mikey: "matches should be played in a similar fashion to how we currently play
the game ... maybe you can move around a bit more". `roblox/game/match.ts`
copies CanvasMatch's steps with no drawing; `roblox/src/Client/Match.luau`
only draws it in 3D and passes input in. After a pass and in the dribble you
run your man with W A S D or the thumb stick. Checks: the match twin test
(`node roblox/tools/twin.mjs match`) and a robot playing through the Roblox
script (`node roblox/tools/smoke-client.mjs 3`). A change to CanvasMatch's
rules must be copied into match.ts by hand.
