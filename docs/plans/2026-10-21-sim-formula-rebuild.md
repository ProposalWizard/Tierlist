# The simulation formula rebuild: a deep plan (21 Oct 2026)

Plan only. No game code changed, nothing committed. Branch `Harry`.
Harry's rule for big work: deep plan first, then one piece at a time, each checked and signed off.

Tags on every claim:
- **[code]** I read it in the code. Not seen on a screen.
- **[measured]** I counted it this session with a read-only script (scripts are in the scratchpad, not the repo).
- **[source]** I read it on the source's own page (figshare API, GitHub licence file, the site's terms).
- **[reasoned]** My view, worked out. Not a fact.

Harry's ask (word for word): "replace and work heavily using my new highlights system to massively improve the simulation formula in game and in turn massively improve match radar. We can also use those 4400 matches to train npc data, role data etc as we already were. I like what ur saying about balancing though, try and find more role data, shots missed, defending etc. Make sure any licensed data is removed with new readily available legal and added to credits." Also yes to: Leo's league goals in highlights mixed with real misses, and StatsBomb numbers replaced from free data, first shown as a "real-world" column beside today's numbers.

---

## 0. Plain English summary

### The big finds

1. **The live game still runs the OLD unseen match.** Settings "Match flow" defaults to Old for everyone. [code: `gameplayVersion.ts` `matchFlow.defaultVersion: "old"`]
   So a real career match today has about **15 shots** a game, **no corners** except yours, and **15% of shots go in**. Real football: **23.6 shots**, **9.9 corners**, **10.4%**. [measured, 1,000 matches; source numbers from Wyscout]
2. **The free data already has everything StatsBomb gave us.** I checked the three biggest StatsBomb numbers against free data. They come out almost the same: [measured]

   | StatsBomb number in the code | Free data says | Source |
   |---|---|---|
   | A striker is on the ball 49% / 31% / 20% (35 m+ / 18-35 m / box) | **47% / 36% / 17%** | Wyscout, every forward, 1,941 matches |
   | Back line sits at 0.66 × the ball's distance from goal | **0.66** (deepest man 0.58) | DFL + SkillCorner + SoccerTrack tracking, 298 shots |
   | Keeper saves 53% / 77% / 90% of shots on target (near / middle / far) | **about 46% / 73% / 90%** | Wyscout, 45,287 shots |

   So replacing StatsBomb barely moves the game. It is mostly new labels and a few small changes.
3. **The 4,400 league goals came from a bigger set we can get again.** The full Wyscout set has every shot, miss, duel, tackle, interception, foul, card and offside. I downloaded it (77 MB, free, CC BY 4.0) and measured it for this plan. [measured, source]
4. **There is free role data too.** Wyscout's "PlayeRank" file gives every player in every match a role (central forward, left winger, right centre-back …). Same licence. 46,897 player-matches. [source, measured]

### The headline numbers (real football against the game)

| Per match (both teams) | Real (Wyscout) | Game today, live (Old) | Game, Match flow New |
|---|---:|---:|---:|
| Shots | 23.6 | 15.2 | 26.1 |
| Goals | 2.60 | 2.31 | 2.55 |
| Shots that score | 10.4% | 15.2% | 9.8% |
| Corners | 9.9 | 0 (except yours) | 9.3 |
| Fouls / yellow cards / offsides | 26.3 / 3.8 / 4.2 | none | none |
| Possession, top side v bottom side | 62% | 49% | 53% |
| Shots, top v bottom | 15.5 v 8.8 | 11.9 v 3.9 | 18.0 v 8.5 |

[measured: game = an even 70 v 70 match and an 82 v 62 match, 1,000 matches each, through the radar's own path]

### What the plan does, in order

1. **Get the data** (no game change). Re-make the free files with shots missed, saved and blocked, defending, fouls, cards, offsides and roles. Add credits.
2. **Show a "real world" column** beside today's numbers on the test pages. No game change. You see every gap first.
3. **Swap the StatsBomb sources** for free ones. Small number changes.
4. **One set of match inputs** for the real match, the radar, the 90-minute replay and the ruler, so all four always agree.
5. **The new formula**, in small steps: possession, chances, shots, saves and blocks, corners, fouls and cards. It replaces both Old and New "Match flow" (no toggle).
6. **The radar shows the new things**: where each shot was, saved or blocked, cards, offsides.
7. **Your highlights**: Leo's league goals plus real misses, balanced so scoring stays real.
8. **Team-mates and defenders behave by role** in the build-ups, from the real data.

Each step has one number or one picture for you to sign off before the next.

### What needs your answer (one word each)

| # | Question | Options |
|---|---|---|
| D1 | Replace both Match flow Old and New with the new formula, no toggle? Live players go from ~15 shots a game to ~23. | yes / keep toggle |
| D2 | Your own long shots go in 15-20% of the time. Real long shots: 2-4%. | keep fun / move toward real / halfway |
| D3 | Cards and fouls in the unseen match: commentary and radar only, or a red card weakens the side? | show only / real effect |
| D4 | Your chance mix: the real forward's mix (more deep touches), or today's even mix? | real / even |
| D5 | League shots in highlights: their defenders are placed by the drawing rules (Wyscout has no positions). Serve them? | yes after an eye check / tracked only |
| D6 | Real tracking says fewer defenders in the box at 25 m (1, not 2). Move the shapes? | move / keep |
| D7 | Use the university-level SoccerTrack matches for shapes, or only the pro ones? | all / pro only |
| D8 | Credits: Settings only (today), or also a public /credits page? | settings / both |

---

## 1. Data inventory

### 1a. What we have, and what we can get

| Dataset | Licence (exact) | Commercial use? | What it gives us | Size | In the repo? | Verified |
|---|---|---|---|---|---|---|
| **Wyscout public events** (Pappalardo et al. 2019): PL, La Liga, Serie A, Bundesliga, Ligue 1 2017/18, WC 2018, Euro 2016 | "CC BY 4.0" on every figshare article (Events 7770599, Matches 7770422, Players 7765196, Teams 7765310) | yes | every pass, shot, miss, block, save, duel (ground/air, won/lost), tackle (sliding), interception, clearance, foul, card, offside, corner, free kick; x/y start and end; body part; goal-mouth zone; player and team | 1,941 matches, 3.25 M events; `events.zip` 77 MB (955 MB unzipped) | aggregates only (`data/opendata/wyscout_*.json`), plus goals-only league files and WC/Euro shots in `data/realmoments/` | [source: figshare API, 21 Oct] |
| **Wyscout PlayeRanks** (same collection, article 9361148) | "CC BY 4.0"; asks to cite the Sci Data paper and the PlayeRank paper (Pappalardo et al., ACM TIST 2019) | yes | each player's **role in each match** (8 clusters: central FW, left/right FW, central MF, left/right MF, left/right CB), minutes played, goals, a rating | 46,897 player-matches, 6.2 MB | **no** | [source, measured] |
| **Wyscout tag and event name maps** (articles 11743818, 11743836) | "CC BY 4.0" | yes | what each tag id means (1801 on target, 2101 blocked, 1702 yellow …) | 2 KB | no (used by the reducer only) | [source] |
| **IDSSE / DFL** (Bassek et al. 2025) | figshare "CC BY"; README: "licensed under CC-BY 4.0 … naming the Deutsche Fußball Liga (DFL) … citing this publication" | yes | full tracking (all 22 + ball, 25 Hz) and DFL events incl. DFL's own xG, shot type | 7 matches | yes (`idsse_tracking.json`, tracked moments) | [source] |
| **SkillCorner Open Data** (A-League 2024/25) | MIT, "Copyright (c) 2020 SkillCorner"; README: "kindly ask that you credit SkillCorner" | yes | broadcast tracking, **off-ball run types by role**, pressing actions, phases of play | 20 matches | yes | [source] |
| **SkillCorner first release** (2019/20 elite, commit `1b99d40`) | same MIT file | yes | shapes and pressure (players on camera only) | 9 matches | yes | [source per LICENCES.md; same LICENSE file re-read today] |
| **SoccerTrack v2** (Scott et al. 2025) | LICENSE-DATA: "Creative Commons Attribution 4.0 International licence (CC BY 4.0) … for any purpose, even commercially" | yes | whole-pitch tracking, ball actions; university level in Japan | 6 of 10 matches | yes | [source] |
| **openfootball** (football.db) | "Free open public domain football data" | yes | results and fixtures only (no shots) | many seasons | no | [source: README] |
| **football-data.co.uk** | No licence on `notes.txt`; it lists shots, shots on target, woodwork, corners, fouls, offsides, cards per match | **unclear** | per-match team totals for many seasons and leagues | ~20 years | no | [source: notes.txt has no licence words. Needs checking: ask the owner] |
| **FBref / Sports Reference** | Terms: "limited, personal … licence"; no "automated means … scripts, bots, scrapers"; much of it is Opta's | **no** | — | — | no | [source: termsofuse.html] |
| **FiveThirtyEight SPI** | repo LICENSE is CC BY 4.0, but the CSV links now return a web page, and its xG came from Opta | **no longer available**; xG part needs checking | — | — | no | [source: download returned HTML, 21 Oct] |
| **Metrica Sports sample** | README "Legal stuff": "be responsible … acknowledge the source"; no licence file | **no licence granted** | 3 matches tracking + events | — | no | [source: README re-read today] |
| StatsBomb Open Data | User Agreement §1.2.2 forbids commercial use "or any analysis derived from the use of the Service" | **no** | — | — | deleted 19 Oct | [source per LICENCES.md] |
| IMPECT, PFF FC, Alfheim, SoccerNet, Last Row, European Soccer DB, Data Lake, women's Zenodo | see `data/opendata/LICENCES.md` "Checked and NOT used" | no or needs checking | — | — | no | [from LICENCES.md; not re-checked today] |

**Credit wording** (from LICENCES.md, all already in `lib/star/dataCredits.ts` [code]), plus one new line for PlayeRank:

> Player roles from the Wyscout public dataset's PlayeRank file (Pappalardo et al., Scientific Data 2019; Pappalardo et al., ACM TIST 2019), CC BY 4.0. Changes made.

### 1b. What the full Wyscout set gives that our files don't [measured, all 1,941 matches]

Shots (no penalties, no direct free kicks; 22.2 a match):

| Shot from | Foot: on target | blocked | scores | Header: on target | scores |
|---|---:|---:|---:|---:|---:|
| 0-6 m | 76% | 4% | 61% | 51% | 37% |
| 6-11 m | 55% | 13% | 29% | 38% | 15% |
| 11-16 m | 42% | 25% | 14% | 32% | 5% |
| 16-20 m | 35% | 32% | 7.4% | 29% | 4% |
| 20-25 m | 29% | 32% | 4.0% | — | — |
| 25-30 m | 26% | 31% | 2.2% | — | — |
| 30 m+ | 23% | 28% | 1.6% | — | — |

All shots: **36% on target, 24% blocked, 2% hit the post, 10.4% score, 29% of shots on target score.** Headers are 15% of shots and 19% of goals.

Defending and discipline, per match (both teams): 26.3 fouls, 3.8 yellow cards, 0.17 reds, 4.2 offsides, 90 interceptions, 29 clearances, 144 ground defending duels (22% won by the defender as Wyscout tags it), 87 aerial duels, 6.8 sliding tackles, 9.9 corners, 0.34 penalties.

By role, per 90 minutes (PlayeRank roles joined to the events):

| Role | Shots | Goals | Passes | Crosses | Take-ons | Defending duels | Interceptions |
|---|---:|---:|---:|---:|---:|---:|---:|
| Central forward | 2.43 | 0.32 | 27 | 1.6 | 11.2 | 3.6 | 1.8 |
| Wide forward (L/R) | 1.8-2.0 | 0.18-0.21 | 37 | 2.8-3.7 | 11.7-12.0 | 5.2-5.5 | 2.7 |
| Central midfield | 1.08 | 0.10 | 47 | 0.9 | 6.6 | 7.2 | 4.3 |
| Wide midfield / full-back (L/R) | 0.46-0.55 | 0.03 | 42 | 2.7-2.8 | 4.8-5.4 | 7.7-8.2 | 5.0-5.3 |
| Centre-back (L/R) | 0.37 | 0.04 | 43-45 | 0.15 | 1.7 | 6.3-6.5 | 6.2-6.3 |

Limit: PlayeRank's "left/right MF" lumps full-backs with wide midfielders (its roles come from average position). [reasoned] Keepers are not in the file. [measured]

### 1c. What none of the free data has

- **Volleys, bicycle kicks, scissor kicks.** Wyscout has foot / head only, no volley tag. [source: tag list] The tracked moments have ball height at the strike (DFL, SkillCorner), which is the legal way to count volleys. [code, per the headers research]
- **Keeper position at every shot.** Only the 750 tracked shots have it. [measured]
- **Where defenders stand off the ball** in the big Wyscout set. Only tracking has it (33 full matches). [code]

---

## 2. StatsBomb removal

### 2a. Everything still derived from StatsBomb [code, grep "statsbomb" / "SB360" / "Kane", 21 Oct]

| # | Where | What | What replaces it (free) | Expected change |
|---|---|---|---|---|
| S1 | `lib/star/hiddenMatch.ts` ~689-701 `DEEP_TOUCH` (0.24), `DEEP_TOUCH_PULL` | "Kane is on the ball 33 times, 16 of them 35 m+" | Wyscout forwards: 47% / 36% / 17% of on-ball actions at 35 m+ / 17-35 m / box [measured]; ~33 a match per forward if a side plays two forwards [reasoned: 66 forward actions per team-match] | rate stays within a few % [reasoned] |
| S2 | `lib/star/kindMix.ts` ~39-60 `REAL_MIX` | Kane's touch split → 17-deal bag | same Wyscout forward split; plus per-position splits from PlayeRank roles | 8 of 17 deep → about 8 of 17 [reasoned] |
| S3 | `lib/star/shotModel.ts` ~60 | "free kick converts 6% (StatsBomb ~6%)" | Wyscout direct free kicks: 137 / 2,209 = **6.2%** [measured from `wyscout_chances.json`] | none |
| S4 | `lib/star/shotModel.ts` ~131 `KIND_SPREAD` | spreads set against StatsBomb on-target rates by kind (`docs/gameplay15/shots.md`) | Wyscout on-target by distance and body (table 1b); by kind once the reducer classes shots into our kinds (piece 1) | small; measure in piece 3 |
| S5 | `lib/star/keeperBrain.ts` ~1162 `KEEPER_FINISH` | far-corner 13%, top corner 38%, central 89-98% saved (StatsBomb PL 2015/16) | Wyscout goal-mouth zones × shot position (1201-1209 on target, saves): far/near corner save rates [to measure in piece 1; the zone data exists, source] | unknown until measured |
| S6 | `lib/star/keeperBrain.ts` ~1356 `farReadShare` | "keepers concede 8-10% of on-target shots from 22 m+" | Wyscout: **10%** of on-target shots from 20 m+ score [measured: 462 / 4,479] | none |
| S7 | `lib/star/keeperBrain.ts` ~1403 `proDepth` | keeper 1.2 / 1.6 / 2.3-2.4 / 1.8-1.9 m off his line by distance | tracked shots: **1.6 / 2.0 / 2.5 / 2.6 m** for 0-8 / 8-12 / 12-22 / 22 m+ [measured, 740 shots] | long shots: keeper ~0.7 m further out |
| S8 | `lib/star/canvasEngine.ts` ~6762 `KEEPER_PRO` | values cite `docs/gameplay15/keeper.md` (StatsBomb save % by distance) | Wyscout save %: **46 / 73 / 90** (0-11 / 11-20 / 20 m+) against StatsBomb's 53 / 77 / 90 (12 / 22 m edges) [measured; approximate: 1 − goals ÷ on target] | maybe a small retune; **engine file: needs Harry's Allow** |
| S9 | `lib/star/chanceFormula.ts` ~40, `lib/star/formationShape.ts` ~29-223, `lib/star/playstyle.ts` ~7, ~30 | SB360 "Table 1-6": back line 0.66 × ball distance; defenders in box 7→4→2→0 at 10/20/25/30 m | tracked shots: back four **0.66** (p25 0.55), deepest **0.58**; defenders in box **5 / 4 / 1 / 0** at 10 / 20 / 25 / 30 m [measured] | back line: none. In-box count: fewer at 25 m (D6) |
| S10 | `tests/star/gameplay13.mts` ~155 | test bound "real PL 53 / 77 / 90" | Wyscout 46 / 73 / 90 with the band edges the data uses | test bounds move |
| S11 | `tests/star/keeperPro.mts` header | cites StatsBomb | Wyscout + tracked depth | comment only |
| S12 | `tests/star/emptyGrass.mts` ~10-24 | mentions Kane drawings (deleted) | comment only | none |
| S13 | `tests/star/realGoals.mts` §1 | checks no StatsBomb **file or import** | extend: no "StatsBomb", "SB360" or "Kane" **source line** in `lib/star/**` or `tests/star/**` comments either (history docs allowed) | new check |
| S14 | `docs/gameplay15/{keeper,shots,radar}.md`, `docs/gameplay16/{keeper,realgoals}.md`, `docs/next-window-gameplay-plan.md`, `docs/plans/2026-10-15/*` | method notes from StatsBomb | add a one-line "superseded: numbers now from Wyscout, see this plan" at the top; do not rewrite history | none |
| S15 | `docs/research/2026-10-21-headers-volleys-acrobatics.md` | **today's** header/volley/bicycle numbers were measured on StatsBomb open data (1,401 matches) [code: its §2, line 82] | headers: Wyscout (15% of shots, 19% of goals, by distance, table 1b); volleys: tracked ball height; bicycle kicks: no free source (a design choice, not a number) | must happen before any header/volley tuning |
| S16 | `lib/patchNotesData.ts` (9 mentions), `patch-notes/pages/0.45, 0.58, 0.60, 0.64, 0.83, 0.84`, `patch-notes/mikey/v0.14.html`, `.claude/skills/creating-patch-notes/references/patch-notes-v0.15.html` | old patch notes | leave as history; add one patch-notes entry saying the numbers were re-sourced | none |
| S17 | `lib/adminGuides.ts` ~368 | old localStorage key note | fine as is (history) | none |
| S18 | `CLAUDE.md` ~650, `.gitignore` ~65 (`.cache/statsbomb/`) | notes | keep (they say it was deleted) | none |
| S19 | `.claude/worktrees/agent-*` (2 stale worktrees) | old copies of all the above | remove the worktrees (CLAUDE.md: "clear the previous worktree") | none |

### 2b. How to show it first

Before any number changes, the ruler (`lib/star/fhr/ruler.ts`, `/star-fhr-dev`) and the radar test page get a **"Real world"** column: each target, its free-data value, and its source, beside "Off" and "On". [code: the page already has a reference column, `PLAN_REFERENCE`] The values live in one generated file (`lib/star/sim/realTargets.json`, made by the reducer) so nothing is typed by hand. [reasoned]

---

## 3. The new simulation formula

### 3a. How the unseen match works today [code, `hiddenMatch.ts` `tickMinute`]

One "tick" a minute: a turnover roll (55%), a zone walk (5 zones, 3 lanes), momentum, then a chance roll in the danger zones (26% a minute deep, 55% in the box). A chance is yours (involvement roll) or a team-mate's (flat 9% / 16% conversion, with a 16% "moment of quality" at 36%). With Match flow New: speculative shots, corners from shots and crosses, recycling, a late-game ramp. No fouls, cards, offsides, shot positions, blocks or saves. Team quality = (your strength − theirs) / **40**. [code]

The FHR "intelligence" dial (`lib/star/fhr/intel.ts`) uses the gap / **20** for the same idea. [code] So the match and the build-ups disagree about how big a gap is. [reasoned]

### 3b. The shape of the new formula [reasoned]

**One gap, everywhere.** `sideGap(us, them)` from `intel.ts` becomes the one number. The match, the build-ups, the radar and the other fixtures (`season.ts simulateFixtureScore`) read it. Calibrated so that our strengths for a top-30% side against a bottom-30% side give Wyscout's `top_v_bottom` row. (Piece 1 measures which strength gap that is in our leagues.)

**Each minute, the same steps, each set from a real table:**

| Step | Today | New, driven by | Real target (source) |
|---|---|---|---|
| Possession | 55% turnover a minute, ±0.3 × edge | gap → share of the ball | even 50%; top v bottom **62 / 38**; top v mid 59 [measured, Wyscout `matchup.pass_share`] |
| Territory (zone walk) | DRIVE / RETREAT / ENTRY constants | Wyscout transitions (zone → zone, by tier) already in `wyscout_transitions.json` | time in final third: team-match `final_third` actions ~95 [source file] |
| Chances worked | 26% / 55% a minute | box entries and shots per team by gap | shots: mid v mid **11.5**, top v bottom **15.5 v 8.8** [measured] |
| Where the shot is from | not modelled | Wyscout shot distance and body table | median shot ~16 m; 15% headers [measured] |
| Shot outcome | goal / miss only | on target / blocked / off / post by distance and body; keeper rating moves the save share | 36% on target, 24% blocked, 10.4% scored [measured] |
| Team-mate finishing quality | flat 9% / 16% + 16% chance at 36% | the shot table above, with the shooter's rating as a small tilt | goals per shot 10.4%; top sides 13.4%, bottom 8.7% [measured: tier goals ÷ shots] |
| Corners | from shots (45%) and open play (16%) | from blocked and saved shots and crosses (Wyscout ratio) | **9.9** a match; 23% give a shot, 2.2% a goal [source file] |
| Mikey's corner rule | `canTakeCorners` stops you taking one | kept as is; the corner still happens, a team-mate takes it | unchanged [code] |
| Penalties | 2.9% of box minutes (`PENALTY_WON_IN_BOX`) | Wyscout rate | **0.34** a match, 73% scored [measured] |
| Fouls and cards | none | per-minute rates by zone and game state | 26.3 fouls, 3.8 yellows, 0.17 reds [measured] |
| Offsides | none in the match (FHR build-ups call 0.35 of yours) | per-minute rate when in possession in the final third | **4.2** a match [measured] |
| Goals by time | flat (Old) / late ramp (New) | Wyscout 5-minute bins | 12 / 15 / 14 / 18 / 17 / 22% by 15' [measured] |
| Home | ±0.16 edge | Wyscout home v away | goals 1.47 v 1.14; shots 13.1 v 10.5 [measured] |
| Your involvement | position pull, lane pull, deep touches (S1) | role tables (PlayeRank × events): your role's share of the team's shots, crosses, take-ons by zone | a central forward takes 2.4 shots per 90, a wide forward ~1.9 [measured] |

**Your own chances stay yours.** The formula decides how many chances come your way, where, and what kind. You still strike them in the real match. Your conversion is your skill and the engine, not the table (D2). [code: `CanvasMatch` → `makeChance` → engine]

### 3c. Calibration table: targets, real value, game today

Game columns: 1,000 matches each through `playRadarMatch` (the radar's own path), striker, skill 65, team-mates' and your highlights settled at the bench rate. [measured]

| Target | Real | Source | Game live (Old) | Game Match flow New |
|---|---:|---|---:|---:|
| Shots a match (all) | 23.6 | Wyscout `per_match` | 15.2 | 26.1 |
| Goals a match | 2.60 | same | 2.31 | 2.55 |
| Goals per shot | 10.4% (non-pen) | Wyscout events | 15.2% | 9.8% |
| Corners a match | 9.95 | same | 0 | 9.3 |
| Corners, even match, us v them | 5.0 v 5.0 | `matchup.mid_v_mid` | 0 v 0 | **4.05 v 5.25** (a bias) |
| Possession, even, neutral ground | 50% | same | 46.6% | **43.8%** (a bias) |
| Possession, top v bottom (82 v 62 in game) | 62% | `matchup.top_v_bottom` | 49.3% | 52.6% |
| Shots, top v bottom | 15.5 v 8.8 | same | 11.9 v 3.9 | 18.0 v 8.5 |
| Goals, top v bottom | 2.20 v 0.73 | same | 1.60 v 0.65 | 1.75 v 0.87 |
| Home goals v away (even) | 1.47 v 1.14 | `home_away` | 1.30 v 0.94 | 1.47 v 1.07 |
| Goals by 15' (%) | 12/15/14/18/17/22 | `bins_5min` | 17/16/17/16/16/17 | 15/15/17/17/17/19 |
| Shots on target | 36% | Wyscout events | not modelled | not modelled |
| Shots blocked | 24% | same | not modelled | not modelled |
| Headers: share of shots / goals | 15% / 19% | same | not modelled | not modelled |
| Penalties a match | 0.34 | same | (yours only) | `livePenalties` |
| Fouls / yellows / reds | 26.3 / 3.8 / 0.17 | same | none | none |
| Offsides | 4.2 | same | none | none |
| Your highlights a match (striker, even) | — (design) | — | 5.75 | 5.56 |
| Your highlight mix (ruler, Chances Old) | — | — | each kind 8-9% | — |
| Your highlight mix (Chances New) | — | — | long range 20%, header 12%, volley 12%, one-on-one 3% | — |
| Striker on-ball split 35 m+ / 17-35 / box | 47 / 36 / 17% | Wyscout + roles | (Kane numbers: 49 / 31 / 20) | — |
| Keeper save % of on-target, near / mid / far | ~46 / 73 / 90 | Wyscout events | 53 / 77 / 90 is the test target today (S10) | — |
| Keeper off line at a 22 m+ shot | 2.6 m | tracked shots | ~1.8-1.9 m target (S7) | — |

Notes:
- "Top v bottom" in the game is my pick of 82 v 62. Which gap matches it must be measured from our league strengths (piece 1). [reasoned]
- The even-match biases (44% possession, fewer corners for you) are new findings. I have not found the cause. A guess: a highlight of yours ends your move and hands the ball over. [measured the bias; cause reasoned]

### 3d. What stays as it is

- The aim-and-strike game, the engine, the drawings, kind rules. [code]
- `simMatch.ts` odds for your chances when you press "Sim this match" (measured on the engine). [code] It should read the new team side of the formula, not its own copy. [reasoned]

---

## 4. NPC and role data

### 4a. What we can learn per role [measured / code]

| Behaviour | Data | Where it comes from |
|---|---|---|
| Where each role stands, in and out of possession, by ball zone | have (`patterns.json roles`, IDSSE + SkillCorner) | [code] |
| Off-ball runs by role (run ahead, cross receiver, coming short, overlap …) | have (`skillcorner_phases.json off_ball_runs.by_role`) | [measured] e.g. a ST: run ahead 654, cross receiver 442, behind 378 |
| Pass choice by role and zone (forward / side / back, length, cross, through ball) | **new**: Wyscout events × PlayeRank role | [source data exists; not yet reduced] |
| Take-ons, shots, crosses by role per 90 | **new** (table 1b) | [measured] |
| Pressing distance and regain height by tier | have (`wyscout_defending.json`, IDSSE pressure) | [code] PPDA top 6.9, bottom 7.3 |
| Defending actions by role and zone (duels, interceptions, clearances, fouls) | **new**: Wyscout events × role | [measured per 90; by zone not yet] |
| Keeper position at the strike | have (tracked shots, 740) | [measured] |

### 4b. How it plugs in [code + reasoned]

- **FHR build-ups** (`lib/star/fhr/buildUp.ts`): step 4 "who plays it" picks the player by passing or dribbling skill today. Add: the touch type (pass, carry, cross) is drawn from that role's real table for that zone; the runs come from that role's real run types. Pressing reach already comes from `intel.ts`; add the tier's real PPDA.
- **Team-mates in the unseen match**: the "it fell to someone else" line names a role, weighted by that role's share of real shots from that zone. Commentary only at first. [reasoned]
- **Rules come from the drawings: no conflict for build-ups.** A build-up is a replay that ends EXACTLY on the drawing (`buildUp.ts` header). Role data decides only the 4-8 s before. [code]
- **Conflicts to flag for Harry:**
  1. If role data says a chance's defenders should stand somewhere else (D6: fewer in the box at 25 m), that would move the playable picture. That is "outside the drawings", so it needs a sheet of pictures checked by eye before it ships. [CLAUDE.md rule]
  2. `formationShape.ts` already moves defenders in served chances from SB360 numbers. Re-sourcing it to tracking keeps the same back-line rule (0.66). Only the in-box count would change, and only if D6 is "move". [measured, code]
  3. `kindRules/` holds only rules Harry named. Nothing here adds one. [code]

---

## 5. Highlights: Leo's league goals plus real misses

### 5a. Today [code, measured]

- `isFullyReal = src !== "wyscout"` (`lib/star/realMoments/types.ts:112`). `servedKindOf` returns null for anything not fully real, so 0 of 4,393 league goals can be served.
- The served pool: tracked shots only (DFL, SkillCorner, SoccerTrack), one-on-one / tight angle / long range, 1 in 4 open-play chances of those kinds, behind Settings FHR On + Real moment highlights On (both default Off). [code]
- The league files hold **goals only**. The extractor (`scripts/realmoments/extract_wyscout_leagues.py`) dropped ~43,000 other league shots. [code, per audit]

### 5b. The change [reasoned]

1. **Re-extract with misses.** Keep every open-play league shot within 35 m of a served kind, slimmed (ball spot, body, outcome, end zone, the last 3 passes). Estimated ~20,000 shots. Rough size: today's goal rows are ~0.85 KB each [measured: 3.7 MB / 4,393], so ~17 MB; split per league and loaded only when the switch is On.
2. **Two kinds of real, not one.** Replace the one yes/no with a grade: `tracked` (everyone real) and `placed` (real ball, real passes, defenders placed by the kind's drawing rules). `isFullyReal` keeps its meaning (tracked) for the keeper-hold and camera code. A new `servableGrade(m)` feeds the pool. Each grade has its own share dial.
3. **Balance so scoring stays real.** In the game you strike the chance yourself, so the real outcome never scores for you. The risk is the picture: goals come from closer, easier spots. So draw served shots so their distances (and body part) match ALL real shots of that kind, misses included. One weight per distance band: real share ÷ pool share.
4. **Picks.** `wy…` ids get "Use in game" / "Don't use" marks like the tracked ones (`realMoments/picks.ts`).
5. **Real moments page** lists the league shots with filters (league, kind, goal / miss).
6. **Eye check before it ships.** Placed pictures are "added outside the drawings": a sheet of 48 served league chances, every one looked at (overlaps, stranded men, a man behind the keeper). [CLAUDE.md rule]

`chanceMaker.ts` step 1b changes. It is not on the engine-warn list, but it decides what the screen hands the engine, so treat it as a drift file and re-measure. [code, per audit]

---

## 6. Match radar

### 6a. Today [code]

`lib/star/matchRadar.ts` runs the REAL `tick` minute by minute; `components/star/MatchRadar.tsx` draws zone (5 areas), lane (3), possession, momentum, score, and events: goal, chance, corner, your highlight, injury. The radar reads no real data. [code]

### 6b. After [reasoned]

- **Same formula, so radar == match.** Already true for `tick`. The gap is the INPUTS: the real match passes `context`, `livePenalties`, `canTakeCorners`, `home`, energy mode, `matchFlow`; the radar test page passes strength, skill, position, home, `matchFlow`; sim90 passes a fixed skill 70, ST, `matchFlow` from its setup; the ruler passes no `matchFlow` at all, so it measures the OLD flow. [code: `CanvasMatch.tsx` ~1805, `star-radar-dev/page.tsx` ~79, `sim90.ts` ~338, `ruler.ts RULER_INPUTS`]
  Fix: one `matchInputsFor(...)` builder used by all four, and `simMatch.ts`.
- **New on the radar:** each shot as a dot where it was struck (from the formula's distance and lane), coloured goal / saved / blocked / off target; yellow and red cards; offsides; a running shots-on-target count; at full time a small "this match v real football" strip.
- **sim90** stages shots from the formula's distance instead of a generic strike, and shows cards. [code: sim90 stages "a shot" with no distance today]

### 6c. The four tools that must agree

| Tool | Must show the same as the real match for the same seed and inputs |
|---|---|
| Match radar (`/star-radar-dev`, in-match radar) | every minute's possession, zone, events, score |
| Full 90 (`/star-sim90-dev`) | the same, staged with figures |
| Ruler (`/star-fhr-dev`, `scripts/fhr/ruler.mts`) | per-match totals |
| Real match (`CanvasMatch` → `advanceUntilInvolved`) | the source of truth |

New test: `tests/star/oneFormula.mts`: build inputs once, run all four paths for 50 seeds, assert identical frames and totals. [reasoned]

---

## 7. Credits

- **Today:** Settings → More → Data credits shows `DATA_CREDITS` (8 lines, Wyscout / DFL / SkillCorner / SoccerTrack, patterns and moments). [code: `lib/star/dataCredits.ts`, `components/star/DataCredits.tsx`]
- **Add:** a PlayeRank line (above); a "simulation" use type ("The match model is fitted to …") if a separate line is wanted for the formula. Each new line also goes in `data/opendata/LICENCES.md`; `tests/star/realMoments.mts` already checks every line is there. [code]
- **D8:** a public `/credits` page (or a section on the legal page) with the same list, so the credit travels with the game outside Settings. CC BY 4.0 asks for credit "in any reasonable manner based on the medium". [source: CC BY 4.0 §3(a)(2); reasoned that a Settings page meets it]
- **Check:** a test that every data file the game reads (`data/opendata/*`, `data/realmoments/*`, `lib/star/sim/realTargets.json`, `lib/star/fhr/patterns.json`) names a credit id that exists. [reasoned]

---

## 8. Build pieces, in order

Each piece: one small job, its own check, one number or still for Harry to sign off. "Allow" = the red engine or drift warning will ask (`scripts/hooks/engine-warn.mjs`). [code]

| # | Piece | Files | Allow? | Check | Sign-off for Harry |
|---|---|---|---|---|---|
| 0 | Answers to D1-D8 | — | — | — | one word each |
| 1 | **Data.** Re-reduce Wyscout + PlayeRank into new aggregate files: shot outcomes by distance × body × situation × our kind; keeper save by goal-mouth zone and shot side; discipline (fouls, cards, offsides by zone, minute, game state); duels and interceptions by zone; role tables (per 90, by zone, pass choice). Generate `lib/star/sim/realTargets.json`. Credits + LICENCES.md (PlayeRank). Delete raw downloads after. | `scripts/opendata/reduce_wyscout.py` (+ a new `reduce_roles.py`), `data/opendata/*.json`, `lib/star/dataCredits.ts`, `data/opendata/LICENCES.md` | no | re-running gives the headline numbers in this plan to ±0.1 | the table in 1b, re-printed |
| 2 | **Real-world column** on `/star-fhr-dev` and the radar page; ruler gets `matchFlow` from the shared setting | `lib/star/fhr/ruler.ts`, `app/star-fhr-dev/page.tsx`, `app/star-radar-dev/page.tsx`, PageGuide text | no | page loads, no console errors | a still of the table: Off / On / Real |
| 3 | **Re-source StatsBomb** (S1-S19): comments, docs headers, test bounds; `proDepth` long-shot depth; keeper targets 46 / 73 / 90 | `hiddenMatch.ts` (comment + DEEP_TOUCH check), `kindMix.ts`, `shotModel.ts`, `keeperBrain.ts`, `formationShape.ts`, `playstyle.ts`, `chanceFormula.ts`, tests S10-S13 | **hiddenMatch.ts: drift**; `canvasEngine.ts` only if KEEPER_PRO needs a retune | `realGoals.mts` "no StatsBomb" passes; `keeperPro`, `gameplay13`, `kindMix` pass; save % by distance before/after | before/after save % table |
| 4 | **One inputs builder** for real match, radar, sim90, ruler, simMatch; find and fix the even-match possession and corner bias | new `lib/star/matchInputs.ts`; `CanvasMatch.tsx`, `simMatch.ts`, `sim90.ts`, radar page, ruler | **CanvasMatch.tsx: drift** | new `oneFormula.mts`; career match stills unchanged | "same seed → same match in all four" + even match 50% / 5 v 5 corners |
| 5a | **Formula: gap + possession + territory.** One `sideGap`; possession and zone walk from the real tables. Replaces both Match flow modes (D1). | `hiddenMatch.ts`, `fhr/intel.ts`, `gameplayVersion.ts`, `lookRows.ts` | **drift** | `hiddenMatch.mts`, `matchFlow.mts` rewritten to real bands | possession table even / top v bottom |
| 5b | **Chances and shots per team**, shot distance and body | `hiddenMatch.ts` | drift | shots 23.6 ± 2; top v bottom within 1.5 shots | shots table |
| 5c | **Shot outcomes**: on target, blocked, saved, scored; keeper rating tilt | `hiddenMatch.ts` | drift | conversion 10.4 ± 1%; on target 36 ± 3% | outcome table |
| 5d | **Set pieces**: corners from blocks / saves / crosses; penalties; Mikey's `canTakeCorners` kept | `hiddenMatch.ts`, `cornerReach.ts` (read only) | drift | corners 9.9 ± 1; `cornerReach.mts` passes | corners table |
| 5e | **Fouls, cards, offsides** (D3 decides effects) | `hiddenMatch.ts`, commentary banks | drift | rates within 10% | radar still with a card |
| 5f | **Your involvement** from role tables (replaces DEEP_TOUCH and position pulls where the data covers it) | `hiddenMatch.ts`, `kindMix.ts` (D4) | drift | your highlights a match stay 5-7; mix printed | your mix by position |
| 5g | **Other fixtures** use the same gap → goals curve | `season.ts` (`simulateFixtureScore`) | no | league table spread over 200 seasons; `promotion` tests | final table spread before/after |
| 6 | **Radar v2 + sim90** show shots by spot, saved / blocked, cards, offsides, the real strip | `matchRadar.ts`, `MatchRadar.tsx`, `sim90.ts`, `star-sim90-dev` | no | `matchRadar.mts`, `pcMatchRadar.mts`, `sim90.mts` | radar still; 20 s clip (gameplay) |
| 7 | **League shots + misses in highlights** (D5): re-extract, grades, balance, picks, Real moments page | `extract_wyscout_leagues.py`, `data/realmoments/*`, `realMoments/types.ts`, `fhr/realMomentHighlights.ts`, `chanceMaker.ts`, picks, page | **chanceMaker.ts: treat as drift** | `realMomentHighlights.mts`, `realMoments.mts`; served distance mix = real ± 5% | sheet of 48 served league chances, each checked |
| 8 | **Role data in FHR build-ups**: touch type and runs by role, pressing by tier | `fhr/buildUp.ts`, `fhr/intel.ts`, `patterns.json`, `make-patterns.mts` | no | `fhr.mts`, `fhrIntel.mts`; build-up sheet by eye | 48-build-up sheet |
| 9 | **Credits page** (D8) + the "every data file has a credit" test | `app/credits`, legal page, `dataCredits.ts` | no | test | a still |
| 10 | **Patch notes** for the round | `lib/patchNotesData.ts` | no | — | the page |

Order reasons: data and the read-only column first, so every later change has a before/after. Re-sourcing before the formula, so the formula is built on clean numbers. One inputs builder before the formula, so all four tools measure the same thing. Highlights and build-ups last: they are behind FHR switches and do not change scores.

### Tests that must move [code; status: measured today, 2 at a time]

| Test | Today | Why it moves |
|---|---|---|
| `hiddenMatch.mts` | pass | bands were tuned to the old formula |
| `matchFlow.mts` | pass | becomes "the formula keeps real bands" |
| `kindMix.mts` | pass | REAL_MIX re-sourced (D4) |
| `keeperPro.mts`, `gameplay13.mts` | pass | save targets 53/77/90 → 46/73/90 |
| `realGoals.mts` | pass | wider "no StatsBomb" check (S13) |
| `realMomentHighlights.mts`, `realMoments.mts` | pass | grades and league shots |
| `fhr.mts`, `fhrIntel.mts`, `fhrCameraHandover.mts` | pass | role data in build-ups; intel gap shared |
| `matchRadar.mts`, `pcMatchRadar.mts`, `sim90.mts` | sim90 pass; radar tests not run | new events on the radar |
| `finishing.mts`, `outcomes.mts` | pass | must NOT move: the engine is untouched (guard) |
| `cornerReach.mts` | pass | must not move |
| new `oneFormula.mts`, `simTargets.mts` | — | radar == match; formula within real bands |

15 star test files run today, 2 at a time: 15 passed, 0 failed, 7.0 min. The two radar tests were missed by my filter (case) and not run. Mikey's 20 Oct handoff said `keeperPro` failed; it passed today. [measured]
Engine-touching pieces also run `node scripts/run-star-tests.mjs finishing keeper aiming outcomes` and a `star-playtest`. [CLAUDE.md]

### Risks

1. **Live players feel a big change** (15 → ~23 shots, corners appear) because Old is today's default. D1. [measured]
2. **Two scales for "strength"**: our club strengths are not Wyscout tiers. The gap → tier mapping is a measurement, and a wrong one makes every mismatch wrong. Piece 1 measures it. [reasoned]
3. **Wyscout's "on target" and "save" are tag-based.** A ball cleared off the line counts as on target, not scored. Save % is approximate (1 − goals ÷ on target). [reasoned]
4. **Placed league pictures** can look wrong (defenders from rules, not reality). Eye check is mandatory. [CLAUDE.md]
5. **Size**: ~17 MB more real-moment files, loaded only when switched On. [reasoned]
6. **PlayeRank roles** mix full-backs and wide midfielders. Use IDSSE / SkillCorner role names where they disagree. [reasoned]
7. **SoccerTrack** is university level (D7). [source]
8. **The 7 failing tests** in Mikey's handoff: `keeperPro` passed today; the other six were not run. Run the whole suite once before piece 3 to get a clean base. [measured]
9. **Headers / volleys research** already carries StatsBomb numbers (S15). Nothing from it should be tuned until re-measured. [code]

---

## Appendix: how the numbers were made

- Game numbers: `npx tsx` on a scratchpad script calling `playRadarMatch(seed, inputs)` for 1,000 seeds per case (striker, skill 65, `livePenalties`, energy medium), Match flow on and off. Ruler kind mix: `measureRuler({ matches: 300 })`. [measured]
- Wyscout numbers: the raw `events.zip` (figshare 7770599) streamed in Python; shots = event 10 (no penalties, no direct free kicks); distance from goal centre with x × 1.05, y × 0.68; tags 1801 on target, 2101 blocked, 1217-1223 post, 403 head; roles from `playerank.json` joined on (match, player), per 90 = minutes ÷ 90. [measured]
- Tracking numbers: `data/realmoments/tracked.json` shots: keeper = the `ff` row flagged keeper; back four = mean of the four deepest outfield defenders ÷ the ball's distance, shots 16-35 m out. [measured]
- Raw downloads are in the scratchpad (`dl_wyscout/`, `dl_playerank/`) and should be deleted after piece 1 (Harry, 20 Oct: "clear that data afterwards").
