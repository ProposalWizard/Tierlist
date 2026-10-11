# Ball physics — job 3 (Leo v0.15 round)

Switch: Settings → Look → Gameplay → **Ball physics: New | Old** (`ballPhysics`
in `lib/star/gameplayVersion.ts`, default New). Old is today's ball, byte for byte.
Code: `lib/star/ballPhysics.ts` (new file), small hooks in `canvasEngine.ts`
and `CanvasMatch.tsx`. Test: `tests/star/ballPhysics.mts`.

## The real football (sources)

| Number | Value | Source |
|---|---|---|
| Mass, size | 0.43 kg, 0.69 m round | IFAB Law 2 (410–450 g, 68–70 cm) |
| Air density | 1.225 kg/m³ | sea level |
| Drag coefficient | 0.47 slow, 0.20 fast, crisis ~11 m/s | wind-tunnel studies of match balls (Asai et al. 2007; Goff & Carré 2009–13). The exact crisis speed differs by ball — an estimate in that range |
| Bounce off grass | e = 0.6 | FIFA Quality Programme: 2 m drop rebounds 0.60–0.85 m |
| Rolling on cut grass | ~0.85 m/s² + 0.05·v + air drag | FIFA ball-roll test (4–10 m from the ramp) |
| Grass grip in a bounce | μ 0.5, up to rolling (thin shell, I = ⅔mr²) | standard bounce physics (Cross) |
| Spin decay | air τ ≈ 10 s, grass τ ≈ 0.7 s | **estimate** — measurements say a kicked ball keeps most of its spin over a 1–2 s flight |
| Post and bar | 12 cm round, e 0.7 | Law 1 (max 12 cm); restitution an estimate for aluminium |

Reference flights come from an independent RK4 model of the ball above (in the
test). Anchors it meets: a 30 m/s shot reaches 20 m in 0.76 s; a 30 m/s 35° goal
kick carries 53.6 m (long real kicks 55–65 m, i.e. a little over 30 m/s); a
25 m/s 35° clearance carries 41.6 m. Note: the "50–60 m" in the brief for that
clearance is the no-air number (59.9 m); real air takes about a third off.

## Before → after (engine flown alone, 1/180 s steps)

Carry (first bounce) / time to 20 m / total incl. roll:

| Launch | Real | Old | New |
|---|---|---|---|
| Shot 30 m/s 5° | 14.4 m / 0.76 s / 88 m | 16.2 / 0.72 / 84 | 15.0 / 0.77 / 87 |
| Free kick 25 m/s 14° | 24.8 / 0.92 / 61 | 28.0 / 0.87 / 73 | 24.9 / 0.93 / 60 |
| Ground pass 20 m/s | – / 1.19 / 58 | – / 1.47 / 53 | – / 1.17 / 59 |
| Ground pass 12 m/s | – / 2.44 / 31 | – / 3.79 / 21 | – / 2.38 / 31 |
| Short pass 8 m/s | total 18.5 m | 10.0 | 18.8 |
| Lofted pass 20 m/s 25° | 25.4 / 1.24 / 50 | 28.4 / 1.19 / 64 | 25.5 / 1.24 / 49 |
| Clearance 25 m/s 35° | 41.6 / 1.11 / 66 | 50.5 / 1.04 / 100 | 41.6 / 1.11 / 66 |
| Goal kick 30 m/s 35° | 53.6 / 0.93 / 80 | 70.4 / 0.86 / 132 | 53.6 / 0.93 / 80 |
| Chip 12 m/s 45° | 12.0 m carry, 3.3 m apex | 13.3, 3.7 | 12.0, 3.4 |

- 2 m drop rebound: Old 0.97 m (too bouncy) → New 0.67 m (FIFA 0.60–0.85).
- Ramp roll at 3.4 m/s: Old 3.1 m (too sticky) → New 5.3 m (FIFA 4–10).
- Spin: Old never decays in the air; New keeps ~90%/s (free kick bend over 25 m 4.6 → 4.3 m).
- Posts/bar: Old always sends the ball straight back out (teleported 35 cm). New bounces off a round post at the true angle: a centre hit comes back at 0.7× speed, an inside clip goes in, an outside clip goes wide; under the bar goes down and in. Checked against the reflection formula in the test.
- Net: Old chops speed ×0.55 at the line, then stops dead at the back. New: the net gives like a damped spring (deepest 1.15 m of 1.2), rubs the speed off, the ball drops and settles; never stuck in the air, never through the netting.
- Frame rate (600 chances at 30/60/120 fps): Old outcome differs in 25/600 (4.2%), final spot in 600/600 → New 0/600 and 0/600 (fixed 1/180 s steps, remainder carried; 60 fps plays exactly as before).
- After the whistle the ball (pushed clear, over the bar, cleared) now flies with real drag and comes down, in fixed small steps.
- Team-mates' chips, headers and lofted passes are solved in closed form as if there were no air; under New they are corrected to land in the same place through real air (`dragCompensate`).

## What it does to the game (1,500 shots, same seeds)

Goals 562 → 552 (37.5% → 36.8%, −0.7 points). Woodwork touched 26 → 43
(1.7% → 2.9%; real PL ~3% of shots), of which went in 6 → 19.

## Match tests (run under New with `STAR_BALL_PHYSICS=new`; the suite itself runs Old and is byte-identical to main)

- aiming, keeperBrain, keeperDive, keeperOneDive, keeperHuman, outcomes: pass.
- **finishing fails one floor under New**: corner, a modest finisher on target 74.8% → 68.3% (needs >70%, n≈150). Cause: with round 12 cm posts, 15 of 381 corner finishes clip the woodwork and are now counted as off target (Old teleported them away before the line, so the test never counted them). Real (Opta counts woodwork as off target), but the floor needs a look.
- Moved numbers: keeperDive concede by placement centre 15.8 → 12.8%, far corner 59.0 → 54.0%; keeperBrain one_on_one 88/45 concede 26.5/53.5 → 30.0/61.5%; keeperHuman top-corner keeper gain +6.7 → +9.8 points; keeperOneDive penalties scored (middle) 84.5 → 92.0% — mostly in-off-the-bar goals and parries that roll on further on real grass.
