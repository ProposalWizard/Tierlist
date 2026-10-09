# Real moments from StatsBomb — testing only

Mikey, 9 Oct 2026: use real match positions to test a better scenario maker.
The data is StatsBomb's free open data. **It is for testing. It is never
committed and never used in the live game.** Keep the data folder outside the
repo (a scratch folder).

## Steps

```bash
python3 -I tools/statsbomb/fetch.py  /some/scratch/sb-data    # ~40 s, ~17 MB
npx tsx tools/statsbomb/convert.mts  /some/scratch/sb-data    # writes real-moments.json
npx tsx tools/statsbomb/measure.mts  /some/scratch/sb-data    # conversion numbers
```

Then open `/star-real-moments-dev` and press **Load moments file** →
`real-moments.json`.

## What each step does

- **fetch.py**: every Premier League 2015/16 shot with its freeze frame (where
  every player stood), and every Kane shot and touch at the 2022 World Cup
  and Euro 2024 with its 360 frame.
- **convert.mts**: each moment becomes the gallery's save shape (chance kind +
  seed + override). The shooter is YOU, the ball is at his feet, the real
  keeper, defenders and team-mates inside the camera replace the made-up
  ones. Skipped: penalties, direct free kicks and corners, headers (switched
  off in the game).
- **measure.mts**: one fixed shooter takes every real chance six times, and
  the same number of the game's own chances of the same kind.

## Numbers (9 Oct 2026)

- 9,908 shots → 7,807 converted (1,608 headers, 401 free kicks, 91 penalties
  skipped). 93% pass the picture rules. 2,156 are in the 8–50% xG band.
- Our engine's conversion rises with the real xG: 9% (real xG under 3%) →
  38% (real xG over 35%). The real pictures carry real information.
- The game's own one-on-ones convert 68% with the same shooter; real
  one-on-ones 20%. Real keepers stand 4.5 m off their line (ours 1.1 m) and
  real shooters have a defender within 3 m (1.0 on average; ours 0.3).

Coordinates: StatsBomb is 120 × 80 yards attacking x = 120. Game x =
sbY × 68/80, game y = (120 − sbX) × 105/120.
