# Job 4 — The match radar (Leo v0.15)

Two switches, both in Settings → Look (default New):
- **Match flow** (`GAMEPLAY_SWITCHES.matchFlow`): the unseen match against real numbers.
- **Match radar** (`lib/star/matchRadarLook.ts`): a live mini-pitch above the commentary between your chances.

## Real reference (per Premier League match, both teams)

| Measure | Real | Source |
|---|---|---|
| Shots | ~25 (12.5 a team; 2022/23 ~25, 2023/24 ~27) | Premier League / Opta season averages, as reported publicly (fbref team stats) |
| Goals | ~2.8 (2022/23 2.85; 2023/24 3.28; 2024/25 ~2.9) | Premier League season totals ÷ 380 |
| Shot conversion | ~11% | goals ÷ shots from the two rows above |
| Corners | ~10.5 | Opta-style season averages (fbref) |
| Possession, equal sides | ~50/50 | by definition |
| Possession, top side v bottom side | 65-75% | e.g. Man City's season average ~65%, higher against the bottom half |
| Goals by 15-minute block | 13 / 15 / 18 / 15 / 17 / 22% (last includes added time) | public goal-timing tables; the exact split varies by season, the late rise does not |
| Corner → shot | ~1 in 3 | Opta-style set-piece summaries |

Honest note: these are the commonly published season-average figures, not an extraction from event data done here.

## Before → after (2,000 seeded matches a matchup, `scripts/match-flow-measure.mts`; permanent bounds in `tests/star/matchFlow.mts`)

Your own chances are resolved by the stand-in rates `tests/star/hiddenMatch.mts` uses (24% in the box, 11% at the edge), so goals include an estimate of your finishing.

Equal sides, 75 v 75, neutral:

| | Old | New | Real |
|---|---|---|---|
| Shots | 12.9 | **24.0** | ~25 |
| Goals | 2.39 | **2.74–2.81** | ~2.8 |
| Shot → goal | 18.5% | **11.4–11.7%** | ~11% |
| Corners | 0 (only yours, 0.19) | **9.2** | ~10.5 |
| Possession | 53.2% | **50.5%** | 50% |
| Your chances (feeds ratings) | 6.18 | **5.81–5.88** (−5%) | — |
| Goals in last 15' / first 15' | 17% / 15% | 18–19% / 14–15% | 22% / 13% |
| Side behind: share of shots in 15' after the first goal | 44% | 48% | rises (score effects) |
| Ball in midfield in the 5' before a chance | 72% | 80% | — |

Mismatch:

| | Old | New |
|---|---|---|
| 88 v 62 at home: possession | 65.5% | **69.5%** |
| 62 v 88 away: possession | 43.7% | **29.4%** |
| 88 v 62: your chances | 10.6–10.8 | 9.0 (−15%) |
| 62 v 88: your chances | 2.9 | 2.7 (−4%) |
| Shots in a mismatch | 15.6 / 16.6 | 25.3 / 25.0 |

## What changed (hiddenMatch.ts, only with `matchFlow`)
- Speculative shots in the final third (low quality: 3% / 7% go in).
- A missed shot is turned behind for a corner 45% of the time; crosses/runs turned behind too; a corner brings a header 30% of the time (9% go in).
- A missed move is often recycled by the attackers (more for the better side) — this is what makes possession lopsided against a much better side.
- Score effects from kick-off (40% of the late chase), and chance rates rise through the match (×0.7 at 0' to ×1.3 at 90').
- Team-mate / opponent chance conversion × 0.92.
- Old is byte-identical: a fingerprint of 300 matches taken from the code before the change (ddd06d7d) matches with `matchFlow` absent or false.

Every flow line carries `shot` / `corner` flags; `state.radarTrace` (a Map by minute, read-only, draws no random number) records each minute for the radar.

## The live radar
`LiveRadar` (components/star/MatchRadar.tsx), rendered by MatchCommentary at the top of the commentary panel, with a right-hand gutter so the minute plate and Scores button stay clear. SVG + CSS transitions only (one-engine guard clean). Shows: the zone lit in the colours of the side on the ball, the ball gliding zone to zone with the clock, a trail, flashes for SHOT / CORNER / GOAL! / YOUR CHANCE, a momentum bar per minute with goal dots, and possession % each side.

## Not seen
Real-game stills were not taken: a headless phone browser crashed every time at the signing screen ("SIGNING…") before the first match, on fresh and resumed profiles (also with all 3D looks off). The radar has been type-checked and wired, but not looked at on screen.

## Stills taken (from the test page, not the real match)
`/star-radar-dev` now also shows the live radar exactly as the match draws it (same component), above the dev page's own big radar. Two stills at 390×844 (scratchpad `g15/radar/after-01-radar-dev.png` at 43', `after-02-radar-dev-later.png` at 76', 1-2): pitch, lit zone in the side's colour, ball with direction arrow and trail, possession 44/56 then 50/50, momentum bars with goal dots. Seen in both: at 5× speed the ball can still be gliding when the still is taken, so it sits just outside the lit area (the old dev radar shows the same) — check at 1× on a phone. No flash caught in a still.
