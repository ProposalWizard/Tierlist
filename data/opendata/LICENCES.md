# Licences and credit lines — open football data

Every file in this folder is an AGGREGATE (counts, averages, shares) made from
the sources below. No single match, event, frame, team or player is stored.
The game may read these patterns; it must never replay a real match.

**Where the game shows credits:** Settings → More → **Data credits** shows
every "Credit line to show" below (Harry, 20 Oct 2026: "Settings is fine"),
and so does the public page **/credits** (Harry, D8, 21 Oct 2026: "Settings +
public /credits"). Both read `lib/star/dataCredits.ts`, which also lists the
3D models, voices, fonts and facts the game uses (their licence files sit
next to those files) and maps every data file to its credit
(tests/star/dataCredits.mts checks it).
They are one list in `lib/star/dataCredits.ts`: a new source is one entry
there plus its section here (tests/star/realMomentHighlights.mts checks every
line is in this file). Use the same lines on a store listing or about page.
CC BY 4.0 asks for the credit wherever the adapted material is shared; the
MIT licence asks for its notice to travel with copies (kept in `licences/`).

Afriskaut (Dynasty Scouting League 2024, 136 Nigerian grassroots matches,
Apache 2.0) was removed on 20 Oct 2026 at Harry's request ("no one's heard of
them"): its file, its reducer and its credit line are gone. Its licence was
fine; it is listed under "Checked and NOT used".

---

## 1. Wyscout public event dataset — CC BY 4.0 ✓ commercial use allowed

- Files: `wyscout_*.json`
- Source: Pappalardo, L., Cintia, P., Rossi, A., Massucco, E., Ferragina, P.,
  Pedreschi, D., Giannotti, F. *A public data set of spatio-temporal match
  events in soccer competitions.* Scientific Data 6, 236 (2019).
  https://doi.org/10.1038/s41597-019-0247-7
- Data: https://doi.org/10.6084/m9.figshare.c.4415000.v5 (figshare articles
  7770599 Events, 7770422 Matches, 7765196 Players, 7765310 Teams).
- Licence, as figshare states it for every file: **"CC BY 4.0"** —
  https://creativecommons.org/licenses/by/4.0/
- Changes made: events reduced to aggregate counts and averages on a pitch
  grid; nothing else kept.
- No warranty (CC BY 4.0 §5).

**Credit line to show:**
> Match event patterns derived from the Wyscout public dataset (Pappalardo et al., Scientific Data 2019), CC BY 4.0. Changes made.

**Re-sourced numbers (21 Oct 2026):** `wyscout_shot_outcomes.json` (shot
outcomes by kind and distance, keeper save % by distance and goal-mouth zone,
headers, a forward's touches by area) made by
`scripts/opendata/reduce_resource.py` from the same events plus the PlayeRank
file below. It replaced every number the game had taken from a licensed set
(sim rebuild piece 1).

## 1b. Wyscout PlayeRank roles — CC BY 4.0 ✓ commercial use allowed (added 21 Oct 2026)

- Used in: `wyscout_shot_outcomes.json` (`forward_touches_by_area`: which
  players are central and wide forwards).
- Source: the same figshare collection, article 9361148 ("PlayeRank",
  46,897 player-matches: each player's role cluster and minutes in each
  match). Pappalardo, L., Cintia, P., Ferragina, P., Massucco, E., Pedreschi,
  D., Giannotti, F. *PlayeRank: data-driven performance evaluation and player
  ranking in soccer via a machine learning approach.* ACM Transactions on
  Intelligent Systems and Technology 10(5), 59 (2019).
- Licence, as figshare states it: **"CC BY 4.0"**; it asks to cite the
  Scientific Data paper and the PlayeRank paper.
- Changes made: joined to the events by match and player, reduced to
  per-role averages and shares; no player is named or kept.

**Credit line to show:**
> Player roles from the Wyscout public dataset's PlayeRank file (Pappalardo et al., Scientific Data 2019; Pappalardo et al., ACM TIST 2019), CC BY 4.0. Changes made.

## 2. IDSSE — DFL tracking + event data — CC BY 4.0 ✓ commercial use allowed

- File: `idsse_tracking.json`
- Source: Bassek, M., Rein, R., Weber, H., Memmert, D. *An integrated dataset
  of spatiotemporal and event data in elite soccer.* Scientific Data 12, 195
  (2025). https://doi.org/10.1038/s41597-025-04505-y
- Data: https://doi.org/10.6084/m9.figshare.28196177 (figshare licence field:
  "CC BY"). Repository README (https://github.com/spoho-datascience/idsse-data):
  > "The data are provided with authorization of the Deutsche Fussball Liga (DFL).
  > The dataset is licensed under CC-BY 4.0. You must therefore give appropriate
  > credit when using this dataset by 1) naming the Deutsche Fußball Liga (DFL)
  > 2) citing this publication"
- Changes made: positions reduced to average shapes, pressure, speeds and
  set-piece/shot snapshots aggregated over all 7 matches.

**Credit line to show:**
> Tracking patterns derived from data of the Deutsche Fußball Liga (DFL), published by Bassek et al., Scientific Data 2025, CC BY 4.0. Changes made.

## 3. SkillCorner Open Data — MIT ✓ commercial use allowed

- Files: `skillcorner_tracking.json`, `skillcorner_phases.json`
- Source: https://github.com/SkillCorner/opendata (20 A-League 2024/25 matches:
  broadcast tracking, dynamic events, phases of play).
- Licence (repository `LICENSE`): **"The MIT License — Copyright (c) 2020
  SkillCorner."** — "Permission is hereby granted, free of charge, to any person
  obtaining a copy … to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies … The above copyright notice and
  this permission notice shall be included in all copies or substantial
  portions of the Software." Full text: `licences/MIT_SkillCorner.txt`.
- README asks: "if you use the data, we kindly ask that you credit SkillCorner".
- **First release too (added 20 Oct 2026):** `skillcorner2020_tracking.json`,
  from the same repository's first release — 9 matches of 2019/20, the
  champions v the runners-up in the Premier League, LaLiga, Serie A,
  Bundesliga and Ligue 1 (Liverpool v Manchester City twice, Bayern v
  Dortmund twice, Barcelona v Real Madrid twice, Juventus v Inter twice, PSG v
  Marseille). SkillCorner replaced it with the A-League matches in October
  2025; it stays in the repository's history, at commit
  `1b99d401ddc82e366c5c20d6860878668fd5858f`, under the SAME licence file
  (byte for byte the `LICENSE` above: "The MIT License — Copyright (c) 2020
  SkillCorner"). An MIT grant cannot be taken back from a copy already
  published, so it is used. Its README: "if you use the data, we kindly ask
  that you credit SkillCorner". Broadcast tracking of only the players on
  camera (about 14 of 22), no events: reduced to shapes (frames with 9+ of a
  team's outfielders on camera) and pressure on the ball. A courtesy note to
  SkillCorner (they removed it) would be polite; the licence does not ask
  for it.
- Changes made: reduced to aggregate shapes, pressure and back-line heights.

Also used (21 Oct 2026): `tracked_shot_shapes.json` (back line, keeper
depth and shade, men in the box and in the shot's lane at every tracked
shot), made by `scripts/opendata/reduce_resource.py` from the DFL and
SkillCorner shots in `data/realmoments/tracked.json` (pro matches only;
SoccerTrack's university matches left out, Harry's D7).

**Credit line to show** (covers both releases):
> Tracking and phase-of-play patterns derived from SkillCorner Open Data (MIT licence, © 2020 SkillCorner).

## 4. SoccerTrack v2 — CC BY 4.0 ✓ commercial use allowed (added 20 Oct 2026)

- File: `soccertrack_tracking.json` (and fully real moments in
  `data/realmoments/`, below).
- Source: Scott, A., Uchida, I., Kuroda, K., Kim, Y., Fujii, K. *SoccerTrack
  v2: A Full-Pitch Panoramic Video Dataset for Game State Reconstruction and
  Ball Action Spotting.* arXiv 2508.01802 (2025).
  https://arxiv.org/abs/2508.01802 · https://github.com/AtomScott/SoccerTrack-v2
  · data: https://huggingface.co/datasets/atomscott/soccertrack-v2 (and its
  Google Drive mirror, linked from the repository; used here).
- 10 whole university-level matches in Japan (mostly University of Tsukuba
  teams), filmed by a panoramic camera: every player and the ball in every
  frame in pitch metres (Game State Reconstruction), ball-action labels
  (shot, goal, cross …) and event data. No player names (shirt numbers only).
  6 of the 10 are in so far (20 Oct 2026; Google Drive refused the other 4
  for a while: "had many accesses").
- Licence (repository `LICENSE-DATA`, full text in
  `licences/CC-BY-4.0_SoccerTrack-v2.txt`): **"is released under the Creative
  Commons Attribution 4.0 International licence (CC BY 4.0)"** — "you are free
  to: Share … Adapt … for any purpose, even commercially, under the following
  terms: Attribution". README: **"Both permit commercial use."**
- Level: university (amateur) football, a lower level than the Bundesliga
  and A-League files; kept in its own files so it can be dropped in one go.
- Changes made: positions averaged over 0.36 s (the source rounds them to
  1 % of the pitch), turned into our pitch frame, reduced to aggregate shapes
  and pressure; single shots and corners kept for Real moments.

**Credit line to show:**
> Tracking patterns derived from SoccerTrack v2 (Scott et al., arXiv 2025), CC BY 4.0. Changes made.

---

## Real moments (`data/realmoments/`, 19 Oct 2026)

Harry: "We aren't getting licensing, so rebuild Real moments and Real shots
(and Real Goals) with free-licensed data." Unlike the pattern files above,
these files DO keep single real moments: every shot and corner of the 7 IDSSE
and 20 SkillCorner matches with all 22 positions and 4 s of movement, and every
World Cup 2018 / Euro 2016 shot from Wyscout with the passes before it. All
three licences allow that (CC BY 4.0 and MIT allow copying and adapting, with
credit; nothing in them limits it to aggregates). Made by
`scripts/realmoments/` (read `data/realmoments/README.md`).

**Credit lines to show** on any page or screen that uses them (the pages show
the lines for the sources they draw on; `lib/star/realMoments` `REAL_CREDIT`
holds them):
> Real shots and goals from the Wyscout public dataset (Pappalardo et al., Scientific Data 2019), CC BY 4.0. Changes made.

> Real player positions from data of the Deutsche Fußball Liga (DFL), published by Bassek et al., Scientific Data 2025, CC BY 4.0. Changes made.

> Real player positions from SkillCorner Open Data (MIT licence, © 2020 SkillCorner).

> Real player positions from SoccerTrack v2 (Scott et al., arXiv 2025), CC BY 4.0. Changes made.

The SoccerTrack v2 moments (added 20 Oct 2026): every shot and corner of 6
of its 10 filmed university matches (the other 4 hit Google Drive's download
limit on 20 Oct; re-run the scripts to add them), all 22 men, the same 4 s of
movement; the ball has no height in that data. The SkillCorner FIRST release (2019/20) gives no
moments: it has no events and only the players on camera.

Changes made: positions turned into our pitch frame and rounded to 0.1 m,
sampled every 0.2 s; Wyscout positions mapped so the markings land on ours;
a chance-of-a-goal number from our own model where the source has none.

---

## Checked and NOT used

| Source | Why not | Licence line |
|---|---|---|
| StatsBomb Open Data (3,961 matches, 426 with 360 freeze frames) | Forbids commercial use | User Agreement §1.2.2: "The User may not … commercially exploit the data or any analysis derived from the use of the Service" (https://github.com/statsbomb/open-data/blob/master/LICENSE.pdf, 8 Sep 2023). Deleted from the repo on 19 Oct 2026 (it was `data/statsbomb/`, test pages only). |
| IMPECT Open Data (Bundesliga 2023/24, 306 matches) | Forbids commercial use | Terms §2.2: "The User may not: … Use the data for any commercial purposes." (https://github.com/ImpectAPI/open-data/blob/main/LICENSE.pdf) |
| Metrica Sports sample data (3 matches, tracking + events) | No licence granted | README "Legal stuff": "Please be responsible with the use of this data. If you use it for anything public, please aknowledge the source." No licence file. Ask Metrica in writing before use. |
| PFF FC World Cup 2022 (64 matches, tracking + events) | Behind a sign-up form; terms not public | Blog: "fill out the form below to gain instant access" — no licence shown. Ask PFF (fchelp@pff.com). |
| Alfheim / Tromsø IL (Simula, 3 matches, ZXY tracking) | Research only | "Free for research, citation required" (https://datasets.simula.no/alfheim/) |
| SoccerNet (550+ broadcast games) | NDA for video; labels are not positions | — |
| Last Row (19 Liverpool goal clips, tracking) | Needs checking: an informal line, no licence file; and 19 clips cut from Premier League broadcasts | README: "Feel free to use the dataset for whatever purpose, but please credit the source" |
| SoccerTrack v1 (Tsukuba, drone/fisheye clips, 2022) | Needs checking: the code is GPL-3.0 (copyleft); the data's own licence is on Kaggle (sign-in). v2 (above) replaces it and is CC BY 4.0 | — |
| European Soccer Database (Hugo Mathien; 25,979 matches 2008–16, lineup grid spots, events for ~10k; ODbL; also at huggingface.co/datasets/julien-c/kaggle-hugomathien-soccer, no sign-in) | **Needs checking.** The uploader put it under ODbL, but its contents were scraped from other sites (football-data.co.uk results and odds, EA Sports FIFA ratings, a live-score site's match events), so the ODbL grant may not be his to give. No positions in play (formation grid only). 25,979 more matches if a lawyer clears it | Kaggle / HF card: "license: odbl" |
| Global Football (Soccer) Data Lake (huggingface.co/datasets/eatpizzanot/soccer-dataset; 673,966 fixtures, match stats, lineups) | **Needs checking.** Card says CC BY 4.0, but "Sources: API-Football + football-data.co.uk": a third party cannot relicense API-Football's data. No positions | "Licensed CC-BY-4.0; cite API-Football and football-data.co.uk." |
| SoccerMon (Zenodo 10033832; two Norwegian women's teams, 2020–21, GPS positions) | Allowed (CC BY 4.0) but not taken: 99 GB of one team's GPS (no ball, no opponents) — too big for this machine and not a full picture | Zenodo licence: cc-by-4.0 |
| SoccerNet Game State Reconstruction 2024/25 (pitch positions in 30 s broadcast clips) | Needs checking: GPL-3.0 (a copyleft software licence) on the data; clips, not matches | HF card: "license: gpl-3.0" |
| Women's team positioning data (Zenodo 10913119, 2023/24) | Forbids commercial use | Zenodo licence: cc-by-nc-4.0 |
| Afriskaut Dynasty Scouting League 2024 (136 Nigerian grassroots matches, events) | Allowed (Apache 2.0) but REMOVED on 20 Oct 2026 at Harry's request: "no one's heard of them" | README: "This dataset is released under the Apache 2.0 License. Please credit Afriskaut …" |
