# Real shots — StatsBomb open data (TEST ONLY)

Data: StatsBomb open data (https://github.com/statsbomb/open-data)

`shots.json` holds every shot of the **FIFA World Cup 2022** (competition 43,
season 106) and **UEFA Euro 2024** (competition 55, season 282) that has a
freeze frame: 2,741 shots from 115 matches, about 1.5 MB.

It is read only by the test page `/star-statsbomb-dev` (Harry, 13 Oct 2026).
**Do not use it anywhere in the real game.** StatsBomb's licence asks for the
credit line above wherever the data is shown, and the licence for a paid game
is not cleared.

## Source

`https://raw.githubusercontent.com/statsbomb/open-data/master/data/`
(`competitions.json`, `matches/{comp}/{season}.json`, `events/{match_id}.json`,
`three-sixty/{match_id}.json`).

## Remake it

```bash
python3 -I scripts/statsbomb/fetch_shots.py      # about 5 minutes the first time
```

Raw downloads (about 500 MB) are cached in `.cache/statsbomb/` (gitignored), so a
second run needs no network.

## The shape

```
{ credit, shots: [ {
  id, comp, match ("Home 2-1 Away"), minute, player, team,
  outcome (Goal / Saved / Off T / Blocked / Wayward / Post / ...),
  xg (shot.statsbomb_xg), body, technique, type (Open Play / Free Kick / Penalty / Corner),
  loc [x, y], end [x, y],                 // StatsBomb's 120 x 80 pitch
  ff [[x, y, teammate 0/1, keeper 0/1]],   // shot.freeze_frame; the shooter is not in it
  vis [x1, y1, x2, y2, ...]               // the 360 camera's visible area, when there is one
} ] }
```

`leadins.json` (about 1.6 MB) is the page's Moving highlight: for 2,478 of
the shots, the last 2–3 completed passes of the same move (same `possession`,
same team) and, for most, the 360 frame of the first of them:

```
{ credit, leadins: { <shot id>: {
  passes [[seconds before the shot, from [x, y], to [x, y], passer, recipient]],
  path   [[minute (decimal), x, y]],             // up to 12 earlier touches, for the radar
  start  [[x, y, teammate, keeper, actor]]       // 360 frame at the first pass, when there is one
} } }
```

2,010 have 2+ passes; 1,710 of those have a start frame.

Positions are rounded to 0.1 of a StatsBomb unit and stay in StatsBomb's own
coordinates (attacking left to right, origin top-left). `lib/star/statsbombShots.ts`
(`sbToPitch`) turns them into our pitch metres: the box, the six-yard box, the
spot and the 7.32 m goal land exactly on ours; outside the box the pitch is
stretched to our touchlines and halfway line. Tested in `tests/star/statsbomb.mts`.
