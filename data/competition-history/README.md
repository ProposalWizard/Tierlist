# Real competition history (not used by the game yet)

Collected 2 Nov 2026 for Road to Ballon d'Or: the real past winners, runners-up, final scores, top scorers
(with goals), top assisters (with assists) and player of the season for every competition the game runs.
Nothing in the game reads these files yet. Format: [`FORMAT.md`](FORMAT.md).

**The rule (Mikey):** every history is continuous, with no gaps. Each competition, and each extra field, starts at
the first season of its unbroken run up to the latest finished season; scattered older values were dropped on
purpose. Seasons a competition was not played (wars) are rows with `status: "not_held"`, which is not a gap.
Tournaments only have rows for editions that were held (1942 and 1946 World Cups are `not_held`).

| Competition | History | Seasons played | Runner-up from | Top scorer from | Top assister from | Player of season from | File |
|---|---|---|---|---|---|---|---|
| Africa Cup of Nations | 1957 → 2025 | 35 | 1957 | 1957 | — | 1957 | `africa-cup-of-nations.json` |
| AFC Asian Cup | 1956 → 2023 | 18 | 1956 | 1956 | — | 1984 | `asian-cup.json` |
| Champions League | 1955-56 → 2025-26 | 71 | 1955-56 | 1965-66 | 2001-02 | 2021-22 | `champions-league.json` |
| Championship | 1892-93 → 2025-26 | 123 | 1892-93 | 1908-09 | — | 2005-06 | `championship.json` |
| Community Shield | 1908 → 2026 | 104 | 1908 | — | — | — | `community-shield.json` |
| CONCACAF Nations League | 2019-20 → 2024-25 | 4 | 2019-20 | 2019-20 | — | 2019-20 | `concacaf-nations-league.json` |
| Europa League | 1971-72 → 2025-26 | 55 | 1971-72 | 2001-02 | 2001-02 | 2016-17 | `europa-league.json` |
| UEFA European Championship | 1960 → 2024 | 17 | 1960 | 1960 | 1972 | 1996 | `european-championship.json` |
| FA Cup | 1871-72 → 2025-26 | 145 | 1871-72 | 2009-10 | — | 1994-95 | `fa-cup.json` |
| CONCACAF Gold Cup | 1991 → 2025 | 18 | 1991 | 1991 | — | 1991 | `gold-cup.json` |
| League Cup | 1960-61 → 2025-26 | 66 | 1960-61 | 2019-20 | — | 1989-90 | `league-cup.json` |
| League One | 1958-59 → 2025-26 | 68 | 1958-59 | 1958-59 | — | 2005-06 | `league-one.json` |
| League Two | 1958-59 → 2025-26 | 68 | 1958-59 | 1958-59 | — | 2005-06 | `league-two.json` |
| Lower League Trophy | 1983-84 → 2025-26 | 43 | 1983-84 | 2016-17 | — | — | `lower-league-trophy.json` |
| National League North | 2004-05 → 2025-26 | 22 | 2004-05 | 2014-15 | — | 2022-23 | `national-league-north.json` |
| National League South | 2004-05 → 2025-26 | 22 | 2004-05 | 2014-15 | — | 2022-23 | `national-league-south.json` |
| National League | 1979-80 → 2025-26 | 47 | 1979-80 | 1983-84 | — | 2021-22 | `national-league.json` |
| UEFA Nations League | 2018-19 → 2024-25 | 4 | 2018-19 | 2018-19 | — | 2018-19 | `nations-league.json` |
| OFC Men's Nations Cup | 1973 → 2024 | 11 | 1973 | 1996 | — | 2012 | `ofc-nations-cup.json` |
| Premier League | 1888-89 → 2025-26 | 127 | 1888-89 | 1888-89 | 1992-93 | 1947-48 | `premier-league.json` |
| UEFA Super Cup | 1973 → 2026 | 51 | 1973 | — | — | 2010 | `super-cup.json` |
| FIFA World Cup | 1930 → 2026 | 23 | 1930 | 1930 | 2022 | 1982 | `world-cup.json` |

## Things to know
- **Lineage:** leagues follow the tier, not the name (e.g. Premier League = the top tier since 1888-89, Football League
  First Division before 1992-93; each season's `name_then` says what it was called). The third tier starts at 1958-59
  because before that it was split into Third Division North and South (two champions a season).
- **Player of the season:** each file says which award (`player_of_season_award`). Premier League uses the FWA Footballer
  of the Year for one unbroken award; cups use the final's man of the match where one exists.
- **Top assisters** only exist where an official count runs unbroken to today (Premier League from 1992-93, Champions
  League and Europa League from 2001-02, Euros from 1972, World Cup from 2022). Everywhere else it is null.
- **Open item:** the 2025 Africa Cup of Nations title (Senegal won the final 1-0; CAF awarded it 3-0 to Morocco;
  Senegal's appeal at CAS is waiting for a decision). The row lists Morocco and explains; update when CAS rules.
- **Disputed numbers** (old goal totals where sources differ by a goal or two) use the figure two sources share; the
  dispute is written in that season's `notes`.
- **Checks:** winners/runners-up/final scores were compared with a second source (RSSSF, footballsite.co.uk, fchd.info)
  — every final for the cups and international tournaments, and large samples for the leagues. Recent 2026 results
  (World Cup, Champions League and Europa League finals) were checked again separately.
