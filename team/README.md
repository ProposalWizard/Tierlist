# Team jobs (arrive by push, never SQL)

Harry, 20 Oct 2026: "just use pushes". A job for Harry, Mikey or Leo goes in `team/jobs.json`.

How a Claude session adds one:
1. Add an entry at the END of the list in `team/jobs.json`: `id` (stable and unique, e.g. `lag-test-2026-10-20`; letters, numbers, `-`, `.`, `_`), `owner` (`Harry`, `Mikey`, `Leo` or `all`), `title` (plain English, 200 characters at most), `prompt` (optional: text to paste into your own Claude chat, 4000 at most), `from` (who asked), `added` (when, e.g. `2026-10-20T15:20:00Z`).
2. Commit, and push your own branch. It shows on the Team board's To-do within a minute or two, no deploy needed (the site reads GitHub once a minute; each phone asks once a minute).

Never an SQL insert, never a new table. Ticks are saved in the existing `team_tasks` table by the person who ticks.
Two branches with the same `id`: the newer `added` wins. To change a job, change it and set a newer `added`.
To take a job off: delete it from the file. It leaves once main and every branch no longer have it. Never delete the file itself (keep `[]`).
If a merge clashes on this file, keep both jobs.
