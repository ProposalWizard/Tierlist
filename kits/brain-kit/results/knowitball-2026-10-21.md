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
