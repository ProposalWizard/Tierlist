# Shots (gameplay round Leo v0.15, job 2)

Switches: Settings → Look → Gameplay → **Shots** (`shotsPro`) and
**Knuckleball & power shot** (`knucklePower`). Both default New. Old is
`launch()` exactly (proved: 300/300 strikes identical, same random stream —
`tests/star/shotsPro.mts`). Code: `lib/star/shotModel.ts`. No edit to
`canvasEngine.ts`.

## Real reference (approximate public figures)

| Chance | Scored | On target | Source |
|---|---|---|---|
| Penalty | 76–78% | ~93% | Opta / StatsBomb, long-run PL |
| One-on-one / big chance | 30–40% (Opta big-chance ~39%; Mikey's Kane sample 20%) | ~65% | Opta big chances, StatsBomb xG |
| Tight angle in the box | ~7–10% | ~45% | StatsBomb xG by angle |
| Long range (20–28 m) | ~3–5% | ~25% (≈33% blocked) | StatsBomb xG, Opta |
| Volley in the box | ~8–12% | ~30% | StatsBomb xG |
| Header from a cross | ~10–12% | ~33% | StatsBomb xG |
| Direct free kick | ~6% | ~30% | StatsBomb |
| Blocked (all shots) | ~25% (outside box ~33%) | | Opta |

Shot speeds: average ~25 m/s, hard ~30+ m/s (the game: 26 m/s at power 65 full pull — fine, unchanged).

## How it was measured

`tests/star/shotLab.ts` plays each chance in the match's own order
(makeChance → defence → keeper brain set while you aim → strike → keeper brain
→ kind rules → flight at 1/180 s). The thumb is a human-like bot: aims a corner
(75% the far one), 0.35–0.95 m inside the post; drag off by sd 2.5°; 60% hard
pulls; tap scatter sd 0.20 of the ball (0.25 on a bobbling ball, 0.33 on a
volley/header); intent mix drive 40% / placed 32% / curler 23% (aimed wide by
the bend it expects) / chip 5%. Skills 65/65, keeper 62, 500 chances a kind.
Script: `npx tsx scripts/shots/measure.mts` (env `MODEL=new`, `P`, `T`, `N`).
The bot is an assumption, not a measured human.

## Before → after (scored / on target), technique 65

| Chance | Old | New | Real |
|---|---|---|---|
| Penalty | 48.0% / 63.6% | **68.0% / 82.2%** | 76% / 93% |
| One-on-one | 39.6% / 68.6% | 41.0% / 74.2% | 30–40% / 65% |
| Tight angle | 23.2% / 67.2% | 21.4% / 61.8% | 8% / 45% |
| Long range | 22.0% / 52.6% (31% blocked) | 21.8% / 46.0% (28% blocked) | 4% / 25% |
| Volley | 27.0% / 63.0% | 32.0% / 65.4% | 10% / 30% |
| Header | 14.8% / 52.2% | 15.8% / 49.2% | 11% / 33% |
| Free kick | 6.2% | 6.2% (untouched) | 6% |

Skill now matters in the right direction: one-on-one tech 40 → 90 = 36.8% → 47.3% (New); Old was 32.0% → 48.8%, but Old **skied more as technique grew** on placed shots (tech 65 → 80 placed one-on-ones 35% → 18%: more loft range, same tap).

Perfect-aim bot (no thumb error): Old one-on-one 50.8%, penalty 64.8% — the "68%" in the plan was a perfect-aim number; with a human thumb Old is already ~40%.

## What was wrong, and the fix

1. **The tap set launch speed, not where the ball arrives.** A tap in the
   middle of the ball sent a full-power penalty in at 2.1 m; "top of the
   ball = low drive" arrived at 1.3–1.9 m from 11 m. 12% of penalties went
   over. New: the tap sets the height at the goal line (top 0.12 m,
   middle 0.85 m, lower 1.6 m, bottom = chip with today's physics), solved
   for the real distance and pace. A drive is never lifted more than today's
   (so from distance it still skids in low under bodies and is blocked).
2. **Random curl was the biggest lie in the arrow.** Any tap a hair off the
   middle curled; a curler from cx 0.6 bent 5 m over 25 m. New: the middle
   fifth of the ball is straight; full curl still at the edge.
3. **Almost no execution spread (1.3° at tech 65).** New: sd 2.6° + 6°×(1−tech)
   at full power (tech 65 ≈ 4.7°, tech 90 ≈ 3.2°), × volley 1.9, header 1.7,
   long range 1.6, tight angle 1.3, penalty 0.5, × 1.3 with a man within 2.2 m;
   up/down 0.75 of it as an angle (so long shots go over more).
   **The arrow shows it:** a faint cone to the goal line, ±1.5 sd.
4. **Contact quality.** Clean (inside 0.78 of the ball): +4% pace, 0.85×
   spread, label CLEAN. Side rim SLICED (−12% pace, 1.8× spread), top rim
   TOPPED (−22%, along the ground), outside the ball SCUFFED (−38%, 2.2×).
   Shown on the strike screen, said by the commentator.
5. **Knuckleball** (New): a hard pull (≥80%) tapped dead centre: spin stripped,
   late wobble 0.35–0.6 m (real ~0.2 m, exaggerated to be seen; 0.27 m
   measured in the test). **Power shot:** ⚡ button bottom-left of the aim
   screen; letting go winds up 0.45 s while defenders close; green circle:
   tap within 0.22 s = 1.5× pace on line, slower = less pace and up to 8.5°
   drift. Same code as the test match, moved to `shotModel.ts`.

## Arrow vs landing (clean flight, no keeper/defence), straight intents

Sideways sd at the goal line: one-on-one 1.03 m → 1.37 m; penalty 0.43 →
0.46 m. It grows because the spread is now real — but the cone now shows
it, Old showed nothing. A chunk of the miss is **wind** (scenario weather):
with no thumb error at all a long shot crossed 6 m off the arrow in one
windy chance. Not mine (ball physics/weather) — flagged.

## Shot side vs keeper side

New on-target rates still sit above real (long range 46% vs 25%, volley
65% vs 30%). Even so, goals per shot on target are the keeper's gap:
long range 47% (real ~15%), volley 49% (~30%), tight 35% (~18%);
one-on-one 55% and penalty 83% are right. If on-target were exactly real,
conversion would be: long 12% (real 4%), volley 15% (10%), tight 12% (8%).
**So roughly two thirds of the long-range / volley / tight-angle gap is the
keeper's save rate, one third is shot accuracy.** Penalty and one-on-one are
now in range from the shot side.

## Not done / not seen

- Team-mates' and opponents' automatic kicks are untouched (own kicks only).
- The keeper does not "read" a knuckleball or make power-shot howlers (that
  part of the sandbox lives in keeper functions — keeper builder's lane).
- Height solve uses drag 0.12; if the ball-physics job changes air drag, the
  heights drift a little.
- Spreads were not pushed to full real on-target rates for long shots and
  volleys: the cone would be ±10–15°. Taste question for Leo.
