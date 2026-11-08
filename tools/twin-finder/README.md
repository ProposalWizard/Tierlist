# Twin Finder (Mikey, 9 Nov 2026)

A private page: type a player and season, see his statistical twins across the top 5 leagues, with a
"good video?" score and a "copy episode file" button for the Stat Twins video builder.

- Data: FotMob's public player-stat pages (Opta), 2016/17 to now. Premier League: `tools/video-render/twin/model/fmpull.py`
  (+ the extra defending/keeper stats). La Liga, Serie A, Bundesliga, Ligue 1: `fmpull_one_league.py <league id>`
  (87, 55, 54, 53), one page a second, about 20 minutes a league. The downloaded data never goes in the repo.
- `python3 build.py FM_DIR OUT_DIR` packs the data (`pack.py`), fetches club names and 40 px badges (`teams.py`,
  cached) and writes `OUT_DIR/index.html` + `data.js`. Publish the folder as the "Twin Finder" artifact.
- The method: same position group only (GK, CB, FB, MID, 10s and wingers, ST); every stat per 90; ranked 0-100
  within its own league and season; weighted gap; match % = 100 minus the gap; 2,000 tests with the weights
  shuffled ±50%. The weights per position are at the top of the page's script (`W`). xG and xA are skipped when a
  season has none. Players with fewer than 900 minutes (450 this season) are left out.
- Published: https://claude.ai/artifact/Q6mrgcheJyCeKgnB6NDhLn (private to Mikey until shared). 20,844 player-seasons, 165 clubs.
