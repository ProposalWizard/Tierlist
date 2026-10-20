# Licences and credit lines — open football data

Every file in this folder is an AGGREGATE (counts, averages, shares) made from
the sources below. No single match, event, frame, team or player is stored.
The game may read these patterns; it must never replay a real match.

**Where the game shows credits** (credits screen, about page, store listing),
add the four lines under "Credit line to show". CC BY 4.0 asks for the credit
wherever the adapted material is shared; the MIT and Apache licences ask for
their notices to travel with copies (kept in `licences/`).

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

**Credit line to show:**
> Tracking and phase-of-play patterns derived from SkillCorner Open Data (MIT licence, © 2020 SkillCorner).

## 4. Afriskaut Dynasty Scouting League 2024 — Apache 2.0 ✓ commercial use allowed

- File: `dsl_patterns.json`
- Source: https://github.com/Afriskaut/dynasty-scouting-league-2024-open-data
  (136 matches, hand-tagged event data with x/y).
- README: **"This dataset is released under the Apache 2.0 License. Please
  credit Afriskaut when using this dataset in research, publications, or
  public projects."** Full text: `licences/Apache-2.0_Afriskaut.txt`.
  No NOTICE file in the repository.
- Changes made (Apache 2.0 §4(b)): reduced to aggregate counts; each team's
  attacking direction per half recomputed from its forward passes.

**Credit line to show:**
> Lower-league event patterns derived from Afriskaut Dynasty Scouting League 2024 Open Data (Apache 2.0).

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
| Last Row (19 Liverpool goal clips, tracking) | Allowed, but too small to give patterns (19 clips, not full matches) | README: "Feel free to use the dataset for whatever purpose, but please credit the source" |
| SoccerTrack (Tsukuba, drone/fisheye clips) | No licence stated; short student-match clips | — |
| European Soccer Database (Kaggle, 25k matches, ODbL) | No event coordinates (only lineup grid spots); needs a Kaggle login | — |
