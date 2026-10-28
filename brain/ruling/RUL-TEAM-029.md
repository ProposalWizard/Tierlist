---
id: RUL-TEAM-029
type: ruling
client: team
tags: [admin, team, process, deploy]
status: live
date: 2026-10-28
source: "docs/brain-sources/leo-reply-shape-2026-10-28.md:3-12"
summary: Leo's chats: start with a plan as progress bars (steps, time each, % done), update them and the admin board often; end every task with yes/no lines (works? patch notes made/updated? live on admin page? merged into the game?), then at most 5 lines; ask for every approval together at the start or end.
---
At the start of a task: the steps as bars with a time for each (progress-update skill). While working: refresh the bars in chat and on the admin board (post-status.mjs) at each step. At the end, first the yes/no block:
- Works (seen how) — yes/no
- Patch notes made / updated — yes/no
- Patch notes live on the admin page — yes/no
- Merged into the game (live) — yes/no
Then at most 5 lines; anything longer goes in a closed <details> block if the surface shows one, else is left out. Permission prompts: gather what needs Leo's OK into one ask at the start or the end, never mid-task.
