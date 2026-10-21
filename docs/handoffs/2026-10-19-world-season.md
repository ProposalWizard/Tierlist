# Handoff: the world season (Mikey, 19 Oct 2026)

## For
Mikey's next chat.

## The goal in one line
Every league and cup in the world played for real. Mikey: "build the live version perfectly …
fully remember exactly how you would build the end of season only version" (in case it lags).

## Where it stands
| Item | State |
|---|---|
| Club ratings, 7 leagues by date, promotion/relegation from the tables | ✓ branch Mikey, measured (tests) |
| Cups on real ratings, League Cup without you, both shields | ✓ branch, measured + seen |
| Full CL/EL when you're not in it (entrants bug fixed) | ✓ branch, measured + seen |
| League → 🌍 All leagues screen | ✓ branch, seen in a test browser at phone size |
| Season Awards → "Every league and cup" | ✓ branch, not seen yet |
| Transfer talks: smaller club offers its own wage; +/- steps | ✓ branch, measured |
| Patch notes v0.18 (site 0.60) | ✓ published, on branch |
| Merge to main (live) | ✗ waiting on Mikey's "push" |
| Speed on a real phone | ✗ not checked (2 ms/week, 95 ms/season on this machine) |

## Decisions already made
- Live version, week by week (Mikey, 19 Oct). Fallback: `WORLD_LIVE = false` plays it all at season end, same tables.
- Season 1 shields: Arsenal v Man City, PSG v Aston Villa (Mikey, 19 Oct).
- Long browser playtests only when asked; normally tests + one short screenshot script (Mikey, 19 Oct: "takes an awful long time and uses a lot of tokens").

## Open questions
- None blocking. Possible: tapping a club in a table to see its squad (Next on the patch notes).

## Next steps
1. When Mikey says push: merge Mikey → main (PR), check Vercel succeeds, mark live.
2. Glance at the end-of-season "Every league and cup" sheet once on a phone.
3. Then Mikey's next task (replacement growth plan was listed as Next).

## Where things are
- Branch Mikey, last commits 8d730e61 (world season), c2247410 (patch notes).
- Design: `docs/WORLD_SEASON.md`. Code: `lib/star/world/`, `components/star/WorldPane.tsx`.
- Tests: `tests/star/world.mts` (+ fixture `tests/star/fixtures/worldSquads_fc27.json`).
- Patch notes: https://claude.ai/artifact/6Gz5vvm7PVwXUrJ3ZMBB7V (`patch-notes/mikey/v0.18.html`).

## Watch out for
- 7 match tests fail on main too (chanceMaker, keeperBrain, keeperPro, longRangeRules, chanceJudge, wembley3d, match2dCam): not ours.
- Test browser: hide `[data-tour-overlay]` with CSS; removing it from the page crashes React.
- `identity.mts` golden careers changed on purpose (shield fixture, real opponent strengths).

## Still running
Nothing.
