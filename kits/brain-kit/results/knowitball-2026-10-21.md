# Knowitball Brain: pilot, blind test and first area (21 Oct 2026)

## Pilot (CONVERT.md step 2): 10 real questions, 31 notes

"Old way" = the 441 KB CLAUDE.md that loaded into every message before 21 Oct, plus the
19 Oct answers doc when the answer lives there. "New way" = `brain/_index.md` plus the notes opened.

| # | Question | Old way: chars read | New way: chars read | Old right? | New right? | Notes used |
|---|---|---|---|---|---|---|
| 1 | When can a change go live on main? | 464,566 | 5,273 | yes | yes | RUL-TEAM-001, PRO-TEAM-001, RUL-TEAM-002 |
| 2 | Should a new look get a New/Old toggle in Settings? | 440,866 | 5,127 | yes | yes | RUL-UI-001, RUL-UI-002, RUL-UI-003 |
| 3 | Has star_tuning_notes.sql been run? What migrations are pending? | 440,866 | 5,098 | yes | yes | FACT-DAT-001, FACT-DAT-002, FACT-DAT-003 |
| 4 | Can I change canvasEngine.ts, and what must I do after? | 440,866 | 4,957 | yes | yes | RUL-ENG-001, PRO-ENG-001 |
| 5 | Can a new mode run its own copy of the match loop? | 440,866 | 5,178 | yes | yes | RUL-ENG-002, RUL-ENG-003, RUL-3D-001 |
| 6 | Can we use Higgsfield right now? | 464,566 | 5,007 | yes | yes | RUL-3D-002, RUL-3D-003 |
| 7 | How often do I give progress updates, and when do I suggest a new chat? | 440,866 | 4,954 | yes | yes | RUL-TEAM-003, RUL-TEAM-004 |
| 8 | Do patch notes link the test build, and do they need videos? | 440,866 | 4,979 | risky (see below) | yes | RUL-TEAM-005, PRO-TEAM-002 |
| 9 | How does a job reach Mikey or Leo? | 440,866 | 4,665 | yes | yes | RUL-TEAM-007 |
| 10 | Can a 3D arm pass through the body, or the keeper be resized per chance? | 440,866 | 4,930 | yes | yes | RUL-3D-005, RUL-3D-006 |
| | Total | 4,456,060 | 50,168 | 8/10 sure, 2 risky | 10/10 | 89x less reading |

Notes on the old way:
- Q6: the answers doc has two live-looking Higgsfield rules ("3D-6: ON for now" and 18:25 "no more Higgsfield use").
  A grep that stops at the first hit answers wrong. The Brain marks 3D-6 as RUL-3D-004 [SUPERSEDED].
- Q8: the old CLAUDE.md still held the 2 Oct "test build link on every patch-notes page" rule next to the
  3 Oct rule that cancels it. Same risk. Both moved to SESSION_LOG.md in step 1.
- One fix found while testing: PRO-TEAM-002 said "Patch-note order", so a grep for "patch note" missed it.
  Summaries now use the plain words people search for.

## Blind test (CONVERT.md step 3): 15 questions, 13 HIT, 2 MISS, 0 WRONG

A separate Claude session (cloud, read-only, never saw the notes being written) wrote 15 questions from the
pre-shrink CLAUDE.md and the 19 Oct answers doc, then answered them from the 34-note pilot Brain only.

| # | Question | Result | Notes |
|---|---|---|---|
| 1 | When can I merge into main? | HIT | RUL-TEAM-001, PRO-TEAM-001 |
| 2 | New look: add a New/Old row? | HIT | RUL-UI-001 |
| 3 | Where does unfinished work go? | HIT | RUL-UI-002 |
| 4 | Can I change the match engine? | HIT | RUL-ENG-001, PRO-ENG-001 |
| 5 | Can a 3D game use canvasEngine.ts? | HIT | RUL-3D-001 |
| 6 | Can I use Higgsfield now? | HIT | RUL-3D-002 (RUL-3D-004 superseded, ignored) |
| 7 | How often are progress updates? | HIT | RUL-TEAM-003 |
| 8 | New chat after each build? | HIT | RUL-TEAM-004 |
| 9 | Do patch notes link the test build? | HIT | RUL-TEAM-005 |
| 10 | How do I give the team a job? | HIT | RUL-TEAM-007 |
| 11 | Which branch do I push to? | HIT | RUL-TEAM-008 |
| 12 | How should I write replies? | MISS | now covered by RUL-ALL-003, RUL-ALL-004 (area 1) |
| 13 | Has star_xp_config.sql run? | HIT | FACT-DAT-002 |
| 14 | What must I do after a lib/star change? | MISS | now covered by RUL-ALL-009, FACT-ALL-003 (area 1) |
| 15 | Can a 3D player's size change? | HIT | RUL-3D-006 |

It also flagged 3 notes. Fixed: RUL-3D-003 now names the 17:50 exception; FACT-UI-001 now points to the full
"rows that stay" list (FACT-UI-013). Not a fault: FACT-DAT-004's pointer to SESSION_LOG.md is right in this repo
(the tester read the pre-shrink CLAUDE.md, where those rows still sat).

## Area 1 converted: the rules for working

Moved word for word from CLAUDE.md into `docs/brain-sources/working-rules-2026-10-21.md` (335 lines, 0 missing):
"How to talk to this team" (with Which model and the agent table), the decided-no-toggle list, deploy and patch-note
rules, "Pending Migrations", "ONE ENGINE" (with the 3D games exception) and "The 3D files are packed small".
Each section in CLAUDE.md is now one line plus a list of codes. 56 new notes; 90 in all; build script errors=0.

Lesson: a note citing CLAUDE.md breaks as soon as CLAUDE.md lines move (the script caught RUL-TEAM-008).
`scripts/brain/make_notes.py` finds each source line by its text, so re-running the spec fixes the numbers.
