# Real moments — real shots and corners from free-licensed data

Harry, 19 Oct 2026: "We aren't getting licensing, so rebuild Real moments and
Real shots (and Real Goals) with free-licensed data, and use that to build
highlights." Every source here allows commercial use with credit. The credit
lines are in [`../opendata/LICENCES.md`](../opendata/LICENCES.md) ("Real
moments"); `lib/star/realMoments` `REAL_CREDIT` holds them, and every page
that shows this data shows them.

Read by `lib/star/realMoments` (types, scenarios, build-ups) and served to the
pages by `/api/star/real-moments?file=shots|tracked|tracks|goals`.

## Two kinds of picture

| Kind | What is real | Source | Count |
|---|---|---|---:|
| **Fully real** | the ball and all 22 players where they really stood, and where everyone was for the 4 s before (shots) / from 1 s before to 3 s after (corners) | IDSSE / DFL tracking (7 Bundesliga + 2. Bundesliga 2022/23 matches, CC BY 4.0), SkillCorner tracking (20 A-League 2024/25 matches, MIT; players off camera extrapolated by SkillCorner) | 581 shots, 121 corners |
| **Real shot, placed defenders** | where the shot was struck, who, when, body part, situation, what happened, which part of the goal it went in, the real passes before it | Wyscout events (2018 World Cup + Euro 2016, CC BY 4.0) | 2,875 shots, 232 goals for Real Goals |

Placed: Wyscout has nobody's position off the ball, so the game's own chance
of the closest kind is moved onto the real ball and its keeper re-placed by
the kind's own rule (`lib/star/realMoments/shots.ts`). The pages say which a
moment is.

## The files

All positions are OUR pitch metres (`lib/star/pitch.ts`): `x` 0..68 across
from the acting team's LEFT touchline, `y` from the goal it attacks (0) up
the pitch. Shapes: `lib/star/realMoments/types.ts`.

| File | What |
|---|---|
| `tracked.json` | Every shot and corner of the 27 tracked matches: facts, `ball`, `ff` (everyone else: `[x, y, team-mate, their keeper]`), and for shots `end`/`endZ` (where the ball crossed the goal line, from the tracking), `xg` (DFL's own; our model for SkillCorner), `outcome` (SkillCorner says only Goal / Shot) |
| `tracks.json` | Per moment id: `t0` (s from the event), `dt` (0.2 s), `ball` `[x, y, z, …]`, `men` `[[side, name, x, y, x, y, …]]` (side: you / mate / opp / keeper). `buildUpOf` decodes it |
| `wyscout_shots.json` | Every World Cup 2018 / Euro 2016 shot (30 "shots" from a player's own half dropped: Wyscout's frame is flipped on those): facts, `ball`, `end`/`endZ` (the middle of Wyscout's 3 × 3 goal-mouth zone), `xg` (our model, below), `lead` (the last 3 real passes `[s before, from, to, passer, recipient]` and up to 12 earlier touches) |
| `wyscout_goals.json` | Real Goals' match facts per goal: stage, date, final score (after extra time), score before, the conceding keeper's name, the whole move (passes and carries with their real times) |

**xG:** DFL shots carry DFL's own. For the rest, a logistic model fitted on
all 45,287 non-penalty shots of Wyscout's 1,941 matches (log distance, goal
angle, header, direct free kick; mean 0.102 = the real goal rate 0.102);
penalties 477 / 658 = 0.725. Weights are in `wyscout_shots.json` `meta.xg_model`.

## Remake it

Raw downloads go OUTSIDE the repo (see `../opendata/README.md` for the
download sources; ~5 GB). Run Python with `-I`.

```bash
# Wyscout: events.zip, matches.zip, players.json, teams.json in one folder (~2 min)
python3 -I scripts/realmoments/extract_wyscout.py RAW/wyscout
# Tracking (needs wyscout_shots.json first: it reads the xG model). IDSSE_DIR holds
# DFL_02_01_matchinformation_*, DFL_03_02_events_raw_*, DFL_04_03_positions_raw_observed_*;
# SC_META: {id}_match.json + {id}_dynamic_events.csv; SC_TRK: {id}.jsonl (~4 min)
python3 -I scripts/realmoments/extract_tracking.py IDSSE_DIR SC_META SC_TRK
```

## Known limits

- DFL shots are found from the event's frame, then the frame the ball leaves
  the shooter's feet; 150 of 171 DFL shots and 431 SkillCorner shots pass
  (the rest had no clean frame). Corners: the frame the ball is nearest the
  flag before it flies off.
- The attacked goal is the one the defending keeper stands in (fixes one DFL
  half whose direction was wrong).
- SkillCorner's broadcast tracking extrapolates players off camera: their
  spots are SkillCorner's estimate, not seen.
- Wyscout's goal-mouth zones are 3 × 3, so a Real Goals "real spot" is the
  middle of its zone, not the exact spot.
