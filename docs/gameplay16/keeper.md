# Keeper realism (Leo, round 16, 14 Oct 2026)

Switch: **Settings → Look → Keeper realism (Leo): New | Old** (`keeperFinish` in
`lib/star/gameplayVersion.ts`, row in `lib/star/lookRows.ts`). **Default New** —
Leo asked for it directly. Old is exactly the keeper from before:
`tests/star/keeperFinish.mts` hashes 264 seeded shots (every case below, live
defaults and the Oct 13 update) with the switch Old and gets the hash taken on
`main` before this change (`8794d5d2`).

Leo's words: *"way harder to save top corner shots especially the more power it
has, also near post top corner shots from close range … shoot far post bottom
corner like Henry used to … the goalie seems to save almost everything if he's
close to it. If you're around the corner of the 6 yard box and aim far post
bottom corner that should have a reasonable chance of going in."*

## The real reference (re-sourced from free data, 21 Oct 2026)

The first version of this section was measured on a licensed event data set,
removed on 19 Oct 2026 (its licence forbids a paid game; data/opendata/
LICENCES.md). Now: the Wyscout public dataset (CC BY 4.0, 1,941 matches), every
on-target foot shot that is not a penalty, by Wyscout's own 3 × 3 goal-mouth
zone (low / middle / high × the shooter's left / centre / right). Save % =
1 − goals ÷ on target. Made by `scripts/opendata/reduce_resource.py`
(`data/opendata/wyscout_shot_outcomes.json`).

| Real save % (Wyscout) | Under 12 m | 12-18 m | 18 m+ |
|---|---|---|---|
| Top corners | 18% (n 119) | 43% (n 188) | 63% (n 318) |
| Bottom corners | 37% (n 888) | 53% (n 1,501) | 83% (n 1,629) |
| Central, low | 51% (n 995) | 84% (n 1,423) | 98% (n 1,419) |
| Central, middle height | 54% (n 443) | 89% (n 548) | 96% (n 839) |

By side, struck from a channel of the box (more than 5.5 m across, inside the box):

| Real save % | Near post corner | Far post corner |
|---|---|---|
| Low | 78% (n 1,014) | **37% (n 609)** |
| Mid height | 87% (n 556) | 47% (n 203) |
| High | 61% (n 144) | 26% (n 77) |

From under 12 m: near-post top corner 35% (n 31); near-post bottom corner 73%
(n 206); far-post bottom corner 23% (n 53).

**Caveat (stated):** Wyscout's zone is a tag, not a measured spot, and a ball
cleared off the line counts as on target. The far-corner figure is for every
on-target shot that went there, not only well-struck ones. Leo's brief asked
for about 40-55% scored for a good, well-struck Henry; the free far-corner
figure (63% scored from a channel, 77% from under 12 m) says that is fair.

Not in the data: shot speed. "Harder top corners as power rises" is football
sense (a keeper needs about 0.5-0.7 s to get a full dive up into a corner after a
0.2-0.3 s reaction; a 100 km/h ball from 14 m gives him about 0.5 s in total).

## How it is measured

`tests/star/keeperFinish/harness.mts` — YOUR strike, exactly the match's path:
`launchShot` with this phone's Shots / Contact field / Shot power switches (side
of the ball for curl), `brainStrike`, `strikeKind`, 1/180 s flight with the keeper
brain, `stepBall`. The arrow and the tap height are SEARCHED (keeper out of the
way, same seeded strike) until the ball crosses the goal line within 15 cm of the
target point; then the same strike is played against the keeper. Save % counts
the first shot (a fumble or a ball that goes in = goal). Keeper 80, shooter 80.

- Hand-placed cases: the keeper starts set on the angle (bisector, his depth)
  and the brain walks him while you aim, as in a match.
- "Served" Henry cases: the match's own `tight_angle` / `one_on_one` chances whose
  ball is in the channel (6-12 m across, 4-14 m out), keeper and defenders where
  the builder put them. "off" = the aim search could not reach the target
  (mostly a defender in the way).
- Two configurations: **live** (every switch on its default) and **Oct 13 update
  on** (Keeper pro + Keeper feel, Shots, Contact field, Shot power, Ball physics,
  Team-mate shots — the set `/star-update-dev` flips).

Report: `npx tsx tests/star/keeperFinish/report.mts` (`N=`, `CFG=live|oct13`,
`FINISH=old|new`, `KS=` rating, `ONLY=` case, `KSTART=set|centre|drawn`).

## Before → after

Save % of shots on target, keeper 80, 200 seeded shots a case (fewer where the
aim search failed). Before = switch Old, after = New. Real = the table above
(free Wyscout data since 21 Oct 2026; the game columns are from 14 Oct).

| Case | Live: before → after | Oct 13 on: before → after | Real |
|---|---|---|---|
| **Henry, served tight-angle chances (channel)** | 44% → 30% | **84% → 56%** | 37% (far corner low, channel) |
| **Henry, served one-on-one chances (channel)** | 25% → 15% | **72% → 29%** | 37% |
| Henry, corner of the 6-yard box, keeper set on the angle | 8% → 4% | 60% → 30% | 23% (far low, under 12 m) |
| Henry, channel 9-14 m, keeper set | 57% → 41% | 85% → 52% | 37% |
| Henry, 6-yard-box corner, keeper still central (stress) | 60% → 41% | 88% → 75% | — |
| Far post low, no curl, 6-yard-box corner | 22% → 14% | 45% → 24% | 23-37% |
| Top corner 12-16 m, low power | 72% → 68% | 35% → 34% | 43% (all paces) |
| Top corner 12-16 m, medium power | 38% → 31% | **71% → 48%** | 43% |
| Top corner 12-16 m, full power | 13% → 6% | **37% → 10%** | 43% |
| Near-post top corner, close (6-12 m) | 43% → 29% | 35% → 25% | 35% |
| Near-post bottom corner, close | 64% → 54% | 40% → 32% | 73% |
| Bottom corner from 18-24 m | 77% → 70% | 95% → 85% | 77% |
| Low, 1.2-2.4 m off centre, 18-24 m | 80% → 80% | 97% → 96% | — (no finer free zone) |
| Central low, 10-16 m (control) | 89% → 88% | 95% → 95% | 77% |
| Straight at him, 10-16 m (control) | 87% → 87% | 96% → 96% | 82% |

Pace of the strikes (km/h): live 61 / 82 / 102 for low / medium / full top
corners, 94 for the Henry; Oct 13 on (Shot power curve) 54 / 69 / 86, Henry 72-77.

Keeper rating still shows (served Henry, tight angle / one-on-one, saved after):
keeper 60: live 17% / 5%, Oct 13 42% / 13%; keeper 90: live 42% / 32%, Oct 13 73% / 43%.

**Read it like this:** with the Oct 13 update on (the keeper Leo is testing), the
Henry went from saved 72-84% to 29-56% — it now goes in 44-71% of the time.
With today's live keeper it already went in most of the time unless the keeper
was standing right in its path; it goes in a little more now. A full-power top
corner is now saved 6-10% (was 13-37%), a medium one 31-48%.

## What changed (all behind the switch; `lib/star/keeperBrain.ts`, KEEPER_FINISH)

No change to the ball, the shot, or `canvasEngine.ts`. Every substep while your
shot is coming, from where it will cross his line (straight line, gravity for
height — the same read as the top-corner cut):

1. **Low and wide of where he stood** (below ~0.6-1.2 m at his line, 0.9-2.4 m to
   his side): his dive AND his shuffle across are slower (`lowSlow`), and his
   reach is cut (`lowCut`). In full when the ball goes **across his body** (to
   the far side from the shooter, more so the wider the shooter is); 60% of it
   toward the near post (`nearShare`). Less of it the more time the ball gives
   him (`lowTime`: whole up to 0.5 s, 70% by 1.15 s). Real reason: he is set
   for his near post, and getting down AND across is a keeper's slowest move.
2. **High, wide and hard** (the top corner, KEEPER_HUMAN's own measure of high and
   wide): his spring is slower (`topSlow`) and his reach cut (`topPaceCut`), both
   growing with the strike's pace from 14 m/s (50 km/h, none) to 26 m/s
   (94 km/h, all).
3. With **Keeper pro** on (the Oct 13 update), each of these is 3× bigger
   (`proScale`): that keeper reads a shot far better and holds what reaches him,
   so the same cut moved him far less (measured: Henry saved 85% → 75% at 1×).
4. A 95 keeper loses 25% less of each than a 40 (`ratingEase`); his reach never
   drops below 35%.
5. A ball at him or through the middle is never touched (checked: ±3 points).

Penalties keep their own rule set (no change); free kicks have no brain (no change).

## Not done / not seen

- **Stills:** none of a Henry going in in the real game (see the report).
- With the Oct 13 Shots model, a soft top-corner shot is already saved less than
  a medium one (Old too: 35% vs 71%). That is the shot model, not the keeper;
  not touched.
- Near-post shots from close were already easy in the game before this (top
  corner 34-44% saved vs real 35%, bottom corner 40-64% vs real 73%); Leo asked
  for the near-post top corner to be harder, and it is a little (see table).
- Shots from distance into the bottom corner: Oct 13 keeper still saves more than
  real (real 77%, 18-24 m).
- Pre-existing, on `main` too (not caused here): `keeperPro.mts`'s Old hash
  (`d9ce4b14` vs recorded `c808f663`) and `keeperBrain.mts` "rating 45 moves
  before it reaches him" (54.7% vs floor 55%).
