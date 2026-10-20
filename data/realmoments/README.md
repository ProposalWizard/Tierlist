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
| **Fully real** | the ball and all 22 players where they really stood, and where everyone was for the 4 s before (shots) / from 1 s before to 3 s after (corners) | IDSSE / DFL tracking (7 Bundesliga + 2. Bundesliga 2022/23 matches, CC BY 4.0), SkillCorner tracking (20 A-League 2024/25 matches, MIT; players off camera extrapolated by SkillCorner), SoccerTrack v2 tracking (6 university-level matches in Japan so far, CC BY 4.0; no player names, no ball height; added 20 Oct 2026) | 750 shots, 176 corners (DFL 150 + 49, SkillCorner 431 + 72, SoccerTrack 169 + 55) |
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

## Real moments in the game (20 Oct 2026)

Harry: "try the real moments feeding the real game's chances … how do we keep
track of it, and how do we edit it in the future?"

**The switch.** Settings → Harry changes → Full highlights rebuild: On (test)
→ **Real moment highlights: Off | On** (shown only while the rebuild is On;
Off by default; per phone). Off: the game is exactly as before.

**How a real moment gets into a match.**

1. The match asks for a chance as always, and the chance maker picks its kind
   as always (`lib/star/chanceMaker.ts`).
2. If it is an OPEN-PLAY chance (never a set piece, a dribble or a move
   carrying on) of a kind the real moments have — one-on-one, tight angle or
   long range — then 1 in 4 of them (`REAL_MOMENT_SHARE_IN`,
   `lib/star/fhr/realMomentHighlights.ts`) is a real moment of THAT kind,
   picked at random from the ones allowed, never one of the last 40 served.
3. Its build-up is the real 4 seconds before the shot: everyone runs where he
   really ran, then the chance is yours, exactly where they stood
   (`lib/star/leadInGen.ts` careerBuildUp → `realMomentLeadIn`). A tap skips it.

**Which moments are allowed — one list, three layers.** Every moment has a
stable id (`dfl…` DFL, `sc…` SkillCorner, `st…` SoccerTrack; corners `scc…`,
`stc…`). By default the game may serve every FULLY REAL open-play shot that
passes the automatic checks (`autoCheck`: shot at the goal at y = 0, their
keeper by his goal, all 22 on the pitch, a whole 4 s track, not a header —
headers are switched off). A mark overrides that:

| Layer (newest wins) | Where | Who writes it |
|---|---|---|
| This device's marks not yet saved for everyone | browser `localStorage` | the Real moments page, when the table is missing or offline |
| Saved marks | Supabase `star_real_moments_picks` | the Real moments page (Save happens on every mark; admins) |
| Committed marks | `data/realmoments/picks.json` (in the code) | the Real moments page's **Commit marks to the game** |

**To remove one from the game:** open the Real moments page
(`/star-real-moments-dev`), set "Fully real shots", find the moment (search,
or the In game filter), and press **Don't use**. It is out of every game at
once (or on this device only until `star_real_moments_picks.sql` has run —
the page says which). Press **Commit marks to the game** to write it into
`picks.json` for good.

**To put one back, or force one in:** **Automatic** returns it to the checks;
**Use in game** lets it in even if a check left it out (it must still be a
fully real shot of a kind the game serves).

**To edit one:** the moment itself is the real data, so it is not edited by
hand; mark it Don't use instead. To change WHICH moments exist (more matches,
a fix to how shots are found), change the extractor and re-run it (below):
ids are stable, so marks keep pointing at the same moment. To change how many
are served, change `REAL_MOMENT_SHARE_IN`; which kinds, `REAL_MOMENT_KINDS`;
the checks, `autoCheck` (all in `lib/star/fhr/realMomentHighlights.ts`).
Tests: `tests/star/realMomentHighlights.mts`.

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
# SoccerTrack v2 (AFTER extract_tracking.py: it adds its moments to tracked.json / tracks.json
# and replaces only its own). Needs pip install gdown ijson numpy (a venv; run its python with -I).
python3 -I scripts/realmoments/soccertrack_download.py STV2      # download + shrink each half, ~1 min a half
python3 -I scripts/realmoments/extract_soccertrack.py STV2       # seconds
```

Ids are stable across re-runs (`dfl<event id>`, `sc<match>_<event>`,
`st<match>_<half>_<frame>`), so the picks in `picks.json` keep pointing at the
same moments.

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
