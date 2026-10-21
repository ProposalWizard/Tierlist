# 1. The goalkeeper — "Keeper pro" (Leo v0.15, 11 Oct 2026)

Switch: **Settings → Look → Gameplay → Keeper pro: New | Old** (`keeperPro` in
`lib/star/gameplayVersion.ts`, default New). Old is byte-identical to the keeper
before this round: `tests/star/keeperPro.mts` hashes 1,224 seeded shots through
the real engine and brain and gets the pre-change hash (`d8dc5b7d`).

## The real reference (re-sourced from free data, 21 Oct 2026)

The first version of this table came from a licensed event data set, removed
on 19 Oct 2026 because its licence forbids a paid game (data/opendata/
LICENCES.md). The numbers below are free: the Wyscout public dataset (CC BY
4.0, 1,941 matches; `data/opendata/wyscout_shot_outcomes.json`) and DFL +
SkillCorner tracking (pro matches only; `data/opendata/tracked_shot_shapes.json`),
both made by `scripts/opendata/reduce_resource.py`. Wyscout has no "saved"
outcome on a shot, so save % = 1 − goals ÷ shots on target (tag-based; a ball
cleared off the line counts as on target).

| Real (free data) | Number |
|---|---|
| Save % of shots on target | **70.7%** (n 15,320; Wyscout, penalties and direct free kicks left out) |
| …from under 8 m / 8-12 / 12-16 / 16-22 / 22-28 / 28 m+ | 33 / 60 / 70 / 80 / 89 / 92% |
| …six-yard box / rest of box / outside | 33 / 68 / 87% |
| …central column / side columns of the goal | 81 / 61% |
| Keeper off his line at the strike (tracking) | median 1.8 m for shots under 8 m, 2.1 m from 8-12, 2.5 m from 12-22, 2.6 m from 22 m+ |
| …in one-on-ones (tracking: foot, in the box, no defender between ball and posts) | median 2.5 m |
| One-on-ones (same tracking definition, n 213) | **19% scored** |
| Lobs, what a save becomes, claims and punches | no free source (Wyscout tags none of them): the game's targets below are design targets |

Not measured from data (sports-science figures, used to set the time to dive):
a keeper reacts to a strike in about 0.2-0.3 s and needs about 0.5-0.7 s more
for a full dive into a corner.

## The game, before → after (keeper 80 unless said)

Harness: `tests/star/keeperPro/harness.mts` — the match's own served chance,
keeper brain and 1/180 s flight; well-struck shots (power 0.8-0.95) aimed
anywhere in the goal, 300 seeds × 5 kinds × 4 ratings. Save % counts the
first shot (a rebound goal is a new shot), as the real figures do.
Reports: `npx tsx tests/star/keeperPro/report.mts` (`KEEPER=old` for Old,
`AIM=corner`), `crosses.mts`, `chips.mts`.

| Save % on target, by distance | Before | After | Real |
|---|---|---|---|
| under 8 m (n 29) | 66% | 38% | 33% |
| 8-12 m | 82% | 69% | 60% |
| 12-16 m | 83% | 83% | 70% |
| 16-22 m | 82% | 85% | 80% |
| 22-28 m | 76% | 89% | 89% |
| 28 m+ | 81% | 93% | 92% |

Before, distance made no difference (66-83% flat). After, it follows the real curve.

Re-sourced 21 Oct 2026: `proDepth` now follows the free tracking depths above
(2.6 + 0.7 s(5,15) − 0.2 s(20,28), was 1.0 + 1.4 s(5,15) − 0.5 s(20,28)); the
test targets in `tests/star/gameplay13.mts` are 44 / 73 / 90 (foot shots, under
12 / 12-22 / 22 m+), were 53 / 77 / 90.

| | Before | After | Real |
|---|---|---|---|
| Held, of saves | 4% | 47% | target 40-48% |
| …slow (<18 m/s) / fast (≥25 m/s) | 11% / 2% | 74% / 42% | — |
| …below the chest / over his head | 7% / 1% | 61-66% / 27% | — |
| Out of play, of saves | 57% of parries | 27% of saves | — |
| Parried back into danger, of saves | 13.5% | 12% | — |
| Goals from a rebound, per save | **16.8%** | **3.8%** | — (rare) |
| Errors (fumbled in), of saves | 4.0% | 0.7% | ≈1% |
| Ball → body at the save, p90 | 1.25 m | 0.91 m | — |
| Body → save point 0.35 s later, p90 | 1.03 m (max 2.25) | 0.71 m | arm's length |
| Long shots: keeper off his line | 1.1 m | 1.7 m | 2.6 m (tracking; the curve moved to it on 21 Oct 2026) |
| Save % keeper 60 / 90 | 65 / 90% | 66 / 87% | (PL range ≈ 62-78%) |
| Corners: keeper comes (catch/punch/flap) | 0% | 12% (ks 80), 15% (ks 90) | — |
| Byline crosses: keeper comes | 0% | 2-3% | — (low, see below) |
| Chips in one-on-ones scored | 19% | 18% | — |

**One-on-ones (for the shots builder):** keeper-half effect only.
- Shots aimed anywhere: scored 24.7% → 25.3% (ks 80). Fewer first-time saves, but rebound goals collapse.
- Shots aimed at the corners: scored 32.3% → 40.0% (ks 80); on target saved 60% → 42%.
- Real: 19% scored (free tracking, n 213). The shots builder's 68% is with its own shooter; this round moves that by about −0 to +8 points depending on placement.

## What changed (all behind the switch)

`lib/star/keeperBrain.ts` (KEEPER PRO section, `KEEPER_PRO_BRAIN`):
- **Positioning:** depth from the real curve (`proDepth`), at least 2.3 m when a man is clean through; Harry's 2.2 m walk cap kept.
- **Time to dive (`applyProReach`):** his reach grows from an arm's length (1.3 m) at his reaction to full stretch 0.35 s later. A close, hard shot meets less of him.
- **Long shots:** the open-play dial reads distance better (Middle plays as 0.8 instead of 0.55); Hard/Middle/Easier keep their order.
- **Claims (`readDelivery`, `proOffBall`):** on every cross or pass he reads the flight; if he gets there first (his six-yard box is his; above 2.3 m only he can reach it) he comes and catches, punches (more when contested or high) or now and then flaps. While a ball is played through to a man about to be clean through, he comes off his line before it arrives.

`lib/star/canvasEngine.ts` (engine warning: changes every match with the switch on; Old untouched):
- `Scenario.keeperPro` flag, set only by the brain. `resolveKeeper` hands over to `resolveKeeperPro`: hold chance from pace, height and distance from his body (and rating); out of play by height/stretch; live parries go wide the way the ball was going, a share drop short in front of goal; errors ~1%; a low ball under a diving keeper can go through him.
- `keeperClaimTouch` (new hook before pass reception): carries out his claim.
- Saves land where the ball is (`proSaveBodyX`): his body ends within 1.0 m of the save point; a held ball stays where he took it (0.45 m).
- Penalties and free kicks: unchanged (their own rule sets; no Keeper pro).

## Not done / not seen
- Byline crosses are rarely claimed (2-3%): most drop beyond his area at waist height; real claim rates for these are lower than corners, but probably not this low.
- Nutmeg rate not measured separately against a real number (none found).
- 12-16 m saves still 12 points above real.
- Stills: see the report.
