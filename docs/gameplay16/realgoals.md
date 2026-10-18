# Real Goals (Leo, 18 Oct 2026) — test page /star-real-goals-dev

Leo: "real shots mode … 40% accuracy, 90% accuracy, u gotta try get 100% accuracy
from real irl goal … score hero system … NEYMAR GOAL VS CROATIA … make the teams
and players actually accurate … build up needs to be more accurate … shots needs
to be ALWAYS scoreable as the real goal". His dad: "ghost thing like mariokart".

## Real reference

StatsBomb open data, World Cup 2022 + Euro 2024: 250 non-penalty goals with a
freeze frame (248 open play, 2 free kicks). Every goal now also has (from the
raw events + line-ups, `scripts/statsbomb/fetch_real_goals.py` →
`data/statsbomb/goals.json`): the score before it, the height it crossed the
line at (end_location z, yards), every frozen man's name and position, the
names players are known by, the shot's flight time, the whole move (passes,
carries, dribbles with real timestamps). Licence: test only, credit shown.

Named goals: Mbappé's volley v Argentina (final, 81'), Neymar v Croatia, Saka v
Switzerland, Güler v Georgia, Yamal v France — all in. Penalties and own goals
are left out (no open-play freeze frame to recreate). Pavard's volley is 2018,
not in either tournament.

## Measured (before → after)

| What | Before | After | How |
|---|---|---|---|
| Real goal struck exactly on its real line scores (all 250 × 8) | 32.1% | **100.0%** | tests/star/realGoals/measure.mts, `RG_WOBBLE=0` |
| Same, the 14 featured goals | 24.1% | **100.0%** | same |
| Same with a human wobble (±0.4° arrow, ±0.03 tap) | 31.9% | 99.5% (featured 96.4%) | measure.mts |
| Build-up ball vs the real ball (232 goals, 1,150 real touches) | 6.19 m off | **0.63 m** off | tests/star/realGoals/buildup.mts |
| Actions replayed per goal | 2.6 passes | 5.0 passes + carries + dribbles | same |
| Real names on the outfield men (featured) | 0 (test club's players) | 142 of 142 | realGoals.mts |
| Nations with a kit | 0 (City v Brighton) | 44 of 44, no clashes in 250 goals | realGoals.mts |

"Before" = the same strike with the real lane off, i.e. today's engine (the Real
shots page). The striker plays at power 85 / technique 95 (the engine's own
scatter at technique 80 put 30% of corner shots wide or on the post).

## What changed in the engine (off by default)

- `Scenario.realLane` (canvasEngine.ts): when set, a strike of yours whose
  body-free flight would cross within 0.6 m across / 0.55 m up of the real
  crossing (inside the posts) is in the lane: defenders do not block it, team-mates
  do not take it, the keeper still dives but does not save. Only
  `lib/star/realGoals.ts` sets it. Absent: the code path is never entered.
- Proof the real match is unchanged: tests/star/realGoals.mts §7 fingerprints
  40 real goals × 2 strikes with no lane: `c7ad8836` on origin/main's
  canvasEngine.ts (0beabcbf) and on this branch. keeperFinish's own Old
  fingerprint, finishing, outcomes, aiming, hitbox, oneEngine all pass.
- CanvasMatch `realGoal` prop (TEST_ONLY in the guard): real sides' names and
  kits, real names over heads, the real ball as a ghost. Drawing only.

## Accuracy and stars

Bell curve on the crossing distance (height counts 0.8): 100% on the spot, 85%
at 45 cm, 60% at 80 cm. ★ a goal, ★★ 60%+, ★★★ 85%+. Shows 100% within ~6 cm.

## Not done / limits

- StatsBomb has no ball path, only start and end: the ghost line is straight in
  plan with a drawn arc; a curled real shot is drawn straight.
- The ghost is drawn in the 2D picture; the 3D view does not draw it.
- The real goal's spot is kept 0.4 m inside the posts (a goal in off the post
  sits ON the post in the data).
- Cameras: TV / behind / side-on use the 3D camera lock (3D only).
