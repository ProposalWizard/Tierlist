# The world season: every league and cup played for real

Mikey, 19 Oct 2026: "build the live version … perfectly with a perfect plan …
fully remember exactly how you would build the end of season only version …
if there is too much lag … we would revert to the end of season only version."

Code: `lib/star/world/`. Tests: `tests/star/world.mts`.

## What was wrong (measured 19 Oct 2026, 2,000 simulated seasons)

| Thing | Before | Why |
|---|---|---|
| Strength of a club outside your league | league base + 0–9 from its name | real squads never read |
| Arsenal relegated | 16.8% a season | relegation was a lottery, weight 100 − strength |
| Leagues you're not in | never played | three names drawn up, three down |
| FA Cup once you're out | every PL club 74 + 0–7 | a fixed list per tier |
| League Cup (National League and below) | no winner at all | you're not entered, so it wasn't opened |
| Champions/Europa League you're not in | one weighted pick | no matches |
| Europa League winner not in the field | 17.5% of winners | next season's English qualifiers added |
| England's European clubs from season 2 | top of an unplayed table | qualifiers read off the NEW season's empty table |
| Community Shield / Super Cup, season 1 | not played | no last-season winners |
| Community Shield, below the Premier League | your league's champion | read `winners.league` |

## The rules now

1. **Club rating** (`world/clubRating.ts`). A club with a real squad (11+ real
   players) is the average of its best XI, to one decimal. A club without one
   (invented players) is rated from its club data: its division's level, moved
   by its current reputation (70%), historical reputation (15%) and transfer
   spending (15%) against the rest of its division, at most ±4.
   Used everywhere: your own league's table, the world leagues, the cups,
   Europe, the stand-in estimate.
2. **Every league you're not in** (Premier League down to National League
   North and South) has its own table and fixture list (`career.world`).
   After each of your matches (played or watched), every round whose real
   date has come is played. Goals go to real players in that club's squad.
3. **At the season's end** anything still unplayed is played (a league that
   finishes after yours, a cup final). `finishWorld` is pure: the same save
   always gives the same final tables.
4. **Up and down** come from those tables: the bottom N go down, the top N−1
   go up and the play-offs decide one more, in every division. The old
   lottery is only a fallback for a save with no world at all.
5. **Cups**: the FA Cup and League Cup play with the real ratings and the
   league's match model. The League Cup is played even when you're not in it.
6. **Europe**: the Champions League and Europa League you're not in are
   played in full: 36 clubs, 8 league-phase matchdays on their real dates,
   then the real UEFA bracket, round by round on its dates. The field is
   England's real qualifiers from LAST season's final Premier League table.
7. **Community Shield and Super Cup** are played every season. Season 1:
   Arsenal v Manchester City, and Paris Saint-Germain v Aston Villa. After
   that: Premier League champions v FA Cup winners, and Champions League v
   Europa League winners.
8. **Viewer**: League → 🌍 Elsewhere shows every table, the latest results,
   top scorers and assists, both cups, both shields and Europe. The season
   review has the same, final.

## The switch: live or end of season only

`WORLD_LIVE` in `lib/star/world/index.ts`.

- `true` (built, 19 Oct 2026): `creditMatchResult` and
  `simulateMissedFixture` call `advanceWorld(career, clock)` after each match.
- `false` (the fallback): those two calls do nothing. The world is opened
  with empty tables and played only by `finishWorld` at the season's end
  (every season-end reader already calls it). The viewer shows "Played at
  the end of the season" during the season and the full tables at the end.
  Nothing else changes: same tables, same promotion, same winners, because
  every round has its own fixed seed and the ratings are fixed when the
  world opens.

Why both give the same result: a round's result depends only on its own seed
(season, competition, round) and the ratings taken when the world opened. When
it is played does not matter.

## Cost (measured on this machine, no graphics chip; a phone is ~3–5× slower)

- One week of all 7 English leagues: ~1 ms (slowest 15 ms, the first week).
- A whole season of everything at once: ~150 ms (the end-of-season fallback,
  or an old save catching up once).
- Save: about 60 KB extra (tables, latest results, scorer counts).
- `finishWorld` is cached per save object, so the season-end screens don't
  repeat it.

## Not changed on purpose

- Ballon d'Or rivals outside your league keep their simulated seasons (Harry
  tuned it "way harder"); foreign leagues aren't played. Their trophies are
  now real winners.
- Your own league, cups and European run work exactly as before.
- No Conference League for other clubs (only reachable by you).
- National League North/South and Step 3 have no squads, so no named
  scorers there.
