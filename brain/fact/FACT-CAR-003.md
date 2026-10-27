---
id: FACT-CAR-003
type: fact
client: car
tags: [three-d, career, team]
status: live
date: 2026-10-27
source: "roblox/README.md:137-142"
summary: The Roblox copy starts a new career with the website's trial: five tests on the 3D pitch, then a scout's offer, the manager's talk and a fixed first contract (Mikey, 27 Oct 2026).
---
Mikey: "There should be a trial, and the trial should be adapted for Roblox."
`roblox/game/trialPlay.ts` copies TrialSequence and its five stages; free
kicks, the gate and the shootout run the real match (match.ts drill mode,
the website's EngineFeature). `roblox/game/trialFlow.ts` is the server side
(results checked, offer, talk, signing). Checks: `node roblox/tools/twin.mjs
trial` and `node roblox/tools/smoke-client.mjs 1`. A change to a trial stage
on the website must be copied into trialPlay.ts by hand.
