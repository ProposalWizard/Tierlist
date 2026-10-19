# Open football data — pattern files

Real-football PATTERNS for the Full Highlights Rebuild's match model: how
attacks start, move and end, where chances come from, how set pieces land,
how high teams press, where every role stands, how a match flows.

**Only averages and counts live here.** No real match, team, player or frame
is stored, and the game must never replay one. Every source allows commercial
use; the exact licence lines and the credit lines the game must show are in
[`LICENCES.md`](LICENCES.md). Read that before shipping anything built on it.

Not to be confused with `data/statsbomb/` (StatsBomb, test page only — its
licence forbids commercial use).

## What went in

| Source | Matches | Positions | Licence | Files |
|---|---:|---|---|---|
| Wyscout public dataset (Pappalardo et al. 2019): Premier League, La Liga, Serie A, Bundesliga, Ligue 1 2017/18, World Cup 2018, Euro 2016 | 1,941 (3.25 M events) | event x/y (start + end) | CC BY 4.0 | `wyscout_*.json` |
| IDSSE (Bassek et al. 2025): DFL Bundesliga + 2. Bundesliga 2022/23 | 7 | full TRACAB tracking, 25 Hz, all 22 + ball, plus DFL events | CC BY 4.0 | `idsse_tracking.json` |
| SkillCorner Open Data: A-League 2024/25 | 20 | broadcast tracking 10 Hz, dynamic events, phases of play | MIT | `skillcorner_tracking.json`, `skillcorner_phases.json` |
| Afriskaut Dynasty Scouting League 2024 (Nigeria, grassroots/academy) | 136 | event x/y | Apache 2.0 | `dsl_patterns.json` |
| **Total** | **2,104** | | | |

## The pitch frame (all files)

- `x` 0..100: from the acting team's own goal line (0) to the goal it attacks (100).
- `y` 0..100: from that team's LEFT touchline (0) to its right touchline (100).
- Metres on a 105 × 68 pitch: `x * 1.05`, `y * 0.68`.
- **Coarse zones** (30): x edges 0 / 16.7 / 33.3 / 50 / 66.7 / 83.3 / 100;
  y edges 0 / 19 / 37 / 63 / 81 / 100 (wing, half-space, centre — the centre
  band is the box's width). `id = ix * 5 + iy`. So zone 27 = the central
  strip of the last sixth (the box), zone 2 = in front of your own goal.
- **Fine grid** (96): 12 × 8 equal cells, `id = ix * 8 + iy`.
- Wyscout files also split by **tier**: league teams by points per game in
  their own season — `top` best 30 %, `mid` next 40 %, `bottom` last 30 %;
  `intl` = World Cup / Euro.

## The files

| File | What it answers |
|---|---|
| `wyscout_possession_starts.json` | Where possessions start, by start type (open play, throw-in, goal kick, corner, free kick, kick-off …) and tier; how often a possession starting in each zone ends in a shot |
| `wyscout_attacks.json` | Attack length (passes), duration, forward metres, speed, how far up it gets — by outcome (goal / shot / lost / out …) and tier; counter-attacks |
| `wyscout_transitions.json` | For the team on the ball, per zone: next action shares (pass ok / lost, carry, shot, possession ends) and 30 × 30 pass and carry destination matrices, by tier — a ready Markov chain for build-up |
| `wyscout_chances.json` | Shots by situation, grid, distance, body part, the action before, goal-mouth placement, penalties, and the 500 most common 2-step chains into a shot |
| `wyscout_set_pieces.json` | Corner landing spots and what follows, free kicks by zone, direct free kicks by distance, throw-ins, goal kicks |
| `wyscout_defending.json` | Where defensive actions happen, defensive height, PPDA (pressing), where the ball is won back, high regains → shots |
| `wyscout_match_flow.json` | Per 5-minute bin: shots, goals, passes, fouls; game state (leading / drawing / trailing); home v away; per-match totals; one team's match by tier and by tier-v-tier match-up |
| `wyscout_roles.json` | Where GK / DF / MD / FW make on-ball and defensive actions |
| `idsse_tracking.json` | Team shape by phase and ball zone (back line, front line, length, width), each role's average spot per ball zone, pressure on the ball, back-line height, running speeds and sprints by role, everyone's spot at corner kicks, defenders and keeper at the moment of each shot |
| `skillcorner_tracking.json` | Same layout as IDSSE, from 20 more matches |
| `skillcorner_phases.json` | Phase-of-play shares (build-up / create / finish / direct / transition / quick break / set play v high / medium / low block), how each phase ends, off-ball run types by role, pressing actions and what they achieve, one player's time on the ball, back-line height per block |
| `dsl_patterns.json` | The same kind of numbers from a lower level of football — the low end of a quality scale |

Every file starts with `meta` (source, credit, licence, match count, grid)
and a `what` line that explains its fields.

## Headline numbers

Measured from the files (all Wyscout unless named):

- **Per match:** 2.60 goals, 23.6 shots, 858 passes, 9.9 corners, 26.3 fouls.
  Home 1.47 goals v away 1.14.
- **Shots by situation:** open play 60 % (10.5 % scored), corners 9.6 %
  (9.7 %), throw-in moves 8.9 % (7.7 %), indirect free kicks 8.4 % (10.3 %),
  counters 6.5 % (**14.8 %**), direct free kicks 4.8 % (6.2 %), penalties
  1.3 % (72.7 %). Headers score 12.5 %, feet 9.7–10 %.
- **Tier gap (median, one team in one match):** top 14 shots / 2 goals /
  58 % of passes / 86 % accuracy / 14 box entries; bottom 10 / 1 / 46 % /
  80 % / 9.
- **Pressing:** PPDA median top 6.9, mid 7.1, bottom 7.3; top teams win the
  ball back 3 units (~3 m) higher (x 38.2 v 35.0).
- **Attacks that last 3+ actions:** median 4 passes, 11.5 s, 34 m forward,
  2.9 m/s. Goal-scoring possessions: median 1 pass, 4.5 s, start at x 74 —
  most goals come from short, late possessions.
- **Corners:** 72 % go into the box, 23 % give a shot in that possession,
  2.2 % a goal; 17 % are met first-time by a shot (66 % of those headers).
- **Goal kicks:** 26 % short; 37 % kept for 3+ actions.
- **Shape (IDSSE, ball in the middle):** in possession the outfield block is
  33 m long and 49 m wide; out of possession 30 m long and 35 m wide.
  Back line median 34–35 m (IDSSE) / 34–37 m (SkillCorner) from its own goal.
- **Pressure (IDSSE):** nearest defender to the ball 3.2 m when the ball is
  in front of the defenders' goal, 5.0 m in midfield, 10.0 m when the
  attackers are building up from their own box.
- **Running (IDSSE):** 106–127 m per minute (CB lowest, CM highest), top speed
  ~8.1–8.8 m/s, 6–15 sprints (7+ m/s for 1 s) per 90; wingers sprint most.
- **Phases (SkillCorner):** 39 % of ball-in-play time is "create v medium
  block", 22 % "finish v low block", 16 % "build-up v high block". A quick
  break gives a shot 45 % of the time, build-up 6 %.

## Remake it

Raw downloads go OUTSIDE the repo (≈ 5 GB at peak: Wyscout 1 GB unzipped,
IDSSE 2.6 GB of XML, SkillCorner 1.8 GB of JSONL). Run with `python3 -I`.

```bash
# Wyscout: figshare collection 4415000 -> events.zip, matches.zip, players.json, teams.json (unzip into one folder)
python3 -I scripts/opendata/reduce_wyscout.py RAW/wyscout          # ~1 min
# IDSSE: figshare 28196177 -> all 21 XML files into one folder
python3 -I scripts/opendata/reduce_idsse.py RAW/idsse . [--delete-positions]   # ~6 min
# SkillCorner: data/matches/{id}/{id}_match.json, _dynamic_events.csv, _phases_of_play.csv
#   into META; {id}_tracking_extrapolated.jsonl (Git LFS) saved as TRK/{id}.jsonl
python3 -I scripts/opendata/reduce_skillcorner.py META TRK          # ~5 min
# Afriskaut: Datasets.zip (Git LFS) unzipped
python3 -I scripts/opendata/reduce_dsl.py RAW/dsl/Datasets          # seconds
```

`scripts/opendata/common.py` holds the frame and grids;
`tracking_common.py` the shared tracking accumulator.

## Known limits

- Wyscout possessions change whenever the other team touches the ball
  (including clearances and blocks), so many "possessions" are one-touch
  scraps; use `sustained` (3+ actions) for real attacks. Its 5-minute bin 9
  (45–50) also holds first-half stoppage time.
- Tracking comes from 27 matches only (7 Bundesliga, 20 A-League): good for
  shapes and distances, thin for set-piece snapshots (50 corners, ~140 shots).
- SkillCorner players off camera are extrapolated by SkillCorner.
- The Afriskaut data is hand-tagged at a lower level; 47 of 136 matches have
  only one team tagged (left out of per-match totals), and its own direction
  fields were wrong in about a third of matches (repaired from forward passes).
