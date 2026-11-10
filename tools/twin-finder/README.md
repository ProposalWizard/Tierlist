# Twin Finder (Mikey, 9 Nov 2026)

A private page: type a player and season, see his statistical twins across the top 5 leagues, with a
"good video?" score and a "copy episode file" button for the Stat Twins video builder.

- Data: FotMob's public player-stat pages (Opta), 2016/17 to now. Premier League: `tools/video-render/twin/model/fmpull.py`
  (+ the extra defending/keeper stats). La Liga, Serie A, Bundesliga, Ligue 1: `fmpull_one_league.py <league id>`
  (87, 55, 54, 53), one page a second, about 20 minutes a league. The downloaded data never goes in the repo.
- `python3 build.py FM_DIR OUT_DIR` packs the data (`pack.py`), fetches club names and 40 px badges (`teams.py`,
  cached) and writes `OUT_DIR/index.html` + `data.js`. Publish the folder as the "Twin Finder" artifact.
- The method (v2, 9 Nov 2026): same position group only; every stat per 90; measured as how far above or below the average of its league + season + group it is (standard deviations, capped at ±4); weighted gap; match % = plain scale, 100 minus 25 per step of gap (identical = 100%; two random players in one position ≈ 70%; 85%+ is a real twin); 2,000 tests with the weights shuffled ±50%. "short" = under 1,500 minutes. The map card puts the 70 nearest players round him at their real gap.
  within its own league and season; weighted gap; match % = 100 minus the gap; 2,000 tests with the weights
  shuffled ±50%. The weights per position are at the top of the page's script (`W`). xG and xA are skipped when a
  season has none. Players with fewer than 900 minutes (450 this season) are left out.
- Published: https://claude.ai/artifact/Q6mrgcheJyCeKgnB6NDhLn (private to Mikey until shared). 20,844 player-seasons, 165 clubs.

## Replace a player (10 Nov 2026)

The page has a second tab, "Replace a player": pick who is leaving, then cut the list by position (same position or the whole
group), minutes, oldest age, top value and league. It shows what makes him him (ranking ladders), two options (the closest of
all, and the closest aged 23 and under, or a cheaper one when the closest is already young), the closest 20, a side-by-side,
and the episode file for `tools/video-render/twin/make_replace.py`. Every player is this season + last season together.
- Ages, values, clubs: `python3 fmpull_players.py <FM_DIR> 4` (FotMob player pages, about 2,200 players, about an hour)
  -> `<FM_DIR>/../fmplayers.json`; `build.py` packs it into `data.js` as `players`. Pull it again after a transfer window.
- Method v2.1 (real zeros, see the twin README) is in the page too.
