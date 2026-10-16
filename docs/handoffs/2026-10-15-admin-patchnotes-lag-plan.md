# Handoff: admin / patch notes / lag + bloat plan (15 Oct 2026)

## For
Harry (next chat), or Mikey/Leo if asked. Branch `Harry`.

## Goal
Plan, then build one piece at a time, signed off before the next:
the admin revamp, organising all patch notes, lag + quickness across menus/3D,
the full-screen bug, and a site-wide bloat audit (CLAUDE.md included).
Harry: "build slowly and CORRECTLY"; "even if there's 1000 questions … it will be worth it";
"very detailed but … concise".

## Where it stands
- ✓ Four plans written and pushed: `docs/plans/2026-10-15/` (lag.md, patchnotes.md, admin.md, teamboard.md).
- ✓ One plan page with all 399 questions (✓/✗/✎ + Copy my answers): https://claude.ai/artifact/6FYAnPvEKJbe3Q7S75mabQ
- ✗ Harry has not answered yet. No code built. Nothing deployed.

## Decisions
- Planning first, answers next, then design with Higgsfield (Harry connects his own), then build.
- One build per chat, then a handoff (skill `handoff`).
- Proposed build order (on the page): 0 CLAUDE.md trim → 1 full-screen fix → 2 lag quick wins →
  3 patch notes → 4 admin → 5 team board → 6 code/asset clean-up → 7 lag re-check: same script, every screen, nothing slower than piece 2's "after" (Harry, 16 Oct) → later: bigger lag steps.

- Harry 16 Oct: LAG "needs you" answers are in lag.md → "Harry's answers" (13 of 14; LAG-QB10 open). LAG-Q5 = B (20 fps) plus pause when off screen. He also wants the Home model remade or re-posed ("looks too zesty") — add to the Higgsfield design pass.

- Harry 16 Oct (comment on LAG-QB12): deal with ALL test pages in one go — one pass where every dev/test page gets keep / merge / delete with its owner (covers LAG-QB9–QB13, ADM-Q42, ADM-Q68, ADM-Q84 and the admin plan's per-page fates). Do it inside the admin build, not piecemeal.

## Open questions
Answered so far: 13 LAG. Still open: LAG-QB10, LAG quick (16) + housekeeping (9), and all of PN, ADM, TB. All 399 on the plan page: LAG 39, PN 197, ADM 153, TB 10. Harry pastes his "Copy my answers" text into the chat.

## Next steps
1. Read Harry's pasted answers; write them into each plan file (one "Answer:" per question); push.
2. Rebuild the page: `docs/plans/2026-10-15/page/` (tiers_seed.py → build2.py; 30 need you / 142 quick / 227 housekeeping).
3. Design pass with Higgsfield where a plan has a look (admin home, patch-notes archive, team board).
4. Build piece 0 (CLAUDE.md trim) as its own build; handoff; then piece 1.

## Where things are
- Plans: `docs/plans/2026-10-15/*.md`. Plan page: link above.
- Measuring scripts (lag): `.claude/worktrees/agent-a3218a84b97da1a32/scripts/perf/` (not committed; README inside).
  Commit them with lag piece 2 so before/after uses the same script.
- Handoff rules: `.claude/skills/handoff/SKILL.md`.

## Watch out for
- Lag numbers come from a machine with no graphics chip: 3D times only compare before vs after. Real phone checks: `?fps=1`.
- Patch-notes numbers clash between sessions today. Don't add a new site version until piece 3 lands; use the person's own number.
- Some "proposed" bars on the page are plan figures, not measured results (labelled).
- CLAUDE.md is ~107k tokens a turn; the trim (piece 0) needs Harry's yes on LAG-QB1–QB25 first.

## Still running
Nothing.
