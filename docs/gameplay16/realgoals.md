# Real Goals (Leo, 18 Oct 2026) — test page /star-real-goals-dev

> **History.** This describes the FIRST Real Goals, built on a licensed event
> data set whose licence forbids a paid game. That data, its scripts and its
> route were deleted on 19 Oct 2026; Real Goals was rebuilt on the free Wyscout
> data (CC BY 4.0): see `data/realmoments/README.md` and `lib/star/realGoals.ts`.
> No number below is used by the game.

Leo: "real shots mode … 40% accuracy, 90% accuracy, u gotta try get 100% accuracy
from real irl goal … score hero system … NEYMAR GOAL VS CROATIA … make the teams
and players actually accurate … build up needs to be more accurate … shots needs
to be ALWAYS scoreable as the real goal". His dad: "ghost thing like mariokart".

## Real reference

The licensed open data (deleted), World Cup 2022 + Euro 2024: 250 non-penalty goals with a
freeze frame (248 open play, 2 free kicks). Every goal now also has (from the
raw events + line-ups, a fetch script →
a goals file, both deleted): the score before it, the height it crossed the
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

- That data had no ball path, only start and end: the ghost line is straight in
  plan with a drawn arc; a curled real shot is drawn straight.
- The ghost is drawn in the 2D picture; the 3D view does not draw it.
- The real goal's spot is kept 0.4 m inside the posts (a goal in off the post
  sits ON the post in the data).
- Cameras: TV / behind / side-on use the 3D camera lock (3D only).

# Round 2 (Leo, 19 Oct 2026) — every goal, a real build-up, a game mode

Leo: "I want ALL the goals from wc22 and euros24 … wc18, euros21 … the 100 best
most iconic goals … the buildup should be almost unnoticeably different … if
the shot is almost exactly like the real shot then it WILL go in no matter what
… revamp ui and look".

## The goals: 250 → 908

a fetch script → one file per collection
(+ an index; served by an API route; all deleted 19 Oct 2026). Every goal but own
goals (penalties now in; a penalty has no freeze frame, so its keeper comes from
the 360 frame or stands on his line):

| Collection | Goals | 360 build-up |
|---|---|---|
| World Cup 2022 | 169 of 172 (3 own goals) | 169 |
| Euro 2024 | 107 of 117 (10 own goals) | 107 |
| World Cup 2018 | 157 of 169 (12 own goals) | — |
| Euro 2020 | 131 of 142 (11 own goals) | 129 |
| Copa América 2024 | 69 of 70 | — |
| AFCON 2023 | 115 of 119 | — (the data listed 360, but the files were not in its open repo) |
| Legends | 60 hand-picked (`LEGENDS` in the script) | 6 |
| Club worldies | 100, picked by `worldie_score` per season | 17 |

**Not in the free data:** the 2026 World Cup; most club seasons (only the
2015/16 big-five leagues, Barcelona's La Liga 2004-2021, Arsenal 2003/04, the
Champions League finals 2004-2019, PSG 2021-23, Leverkusen 2023/24 and a few
classic World Cup matches). So "the 100 most iconic goals" is the famous ones
that are in it (60) plus the data's own best (100).

## The lane: a round one, the page's own %

v0.17's lane was a box (0.6 m across, 0.55 m up) beside an accuracy % worked
from a round distance, so a shot shown as 77% could be outside it. Now
`realLane.r/hw` (canvasEngine.ts, off by default): in the lane when
hypot(dx, dz × 0.8) ≤ 0.67 m, which is exactly 70% on the page. Measured
(tests/star/realGoals/lane.mts, 24 goals × 5 spots): 109 of 109 strikes 70%+
like the real one scored. Engine fingerprint with no lane: `c7ad8836`, unchanged.

## The build-up (lib/star/realGoalTrack.ts)

| | v0.17 | now |
|---|---|---|
| Men vs where the 360 camera saw them | 7.29 m | 3.23 m (4.94 m on frames it never saw) |
| Ball blinks (>45 m/s in a frame), all 754 build-ups | 1,061 | 0 |
| Hand-over to the chance with a step | 234 | 6 |
| Man-frames over 12 m/s | 2,911 | 793 (real sprints; none over 20 m/s but 30 in last-second lay-offs) |

How: one ball key per real touch (passes the data skipped are passes, not a
22 m/s dribble); the data's loose timestamps retimed so no carry beats 8.5 m/s
and no pass 33 m/s; every 360 frame matched man to man backwards from the shot
(no faster than a man can run); straight runs with rounded corners (no spline
overshoot); the man on the ball blends on and off over 0.35 s, his time on it
tied to the ball's own keys; every real man of the freeze frame is in the
chance (none vanish); a man the camera has not caught yet comes with the play.

## The look

A game mode: home (collections as tournament tiles, stars, carry on), each
collection a Score Hero path in its real rounds (a chapter opens with half the
chapter before starred), a goal card (scoreboard, "you are", shot type,
distance, xG, difficulty 1-5), a full-screen play screen (scoreboard, the real
move's captions, ghost / build-up / 2D-3D / camera / restart) and a result
sheet (accuracy dial, stars, goal mouth). Seen at 390×844 in stills.
