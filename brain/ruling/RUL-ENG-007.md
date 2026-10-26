---
id: RUL-ENG-007
type: ruling
client: eng
tags: [engine, team, rule]
status: live
date: 2026-10-25
source: "scripts/hooks/engine-warn.mjs:57"
summary: The match engine may change; the engine-warn hook warns Claude and never stops to ask the person (Mikey, 25 Oct 2026).
---
Mikey: "you keep asking me ... allow Claude to run ... Just do it." The hook still writes the red warning into Claude's notes and the chat; Claude still says the change in the reply and runs the match tests. Supersedes RUL-ENG-001.
