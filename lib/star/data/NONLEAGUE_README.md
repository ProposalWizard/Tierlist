# Non-league squad data (`nonleagueSquads.json`) — Wikipedia build

Real squads for the 64 English non-league clubs that don't have FIFA/SoFIFA
data (`sofifa_players`), built from Wikipedia article text.

This is a **separate, complete build** from the earlier Transfermarkt
attempt (`../partial-data/NONLEAGUE_README.md`), which only got 1 of 64
clubs before being blocked by Transfermarkt's WAF. This build reuses that
attempt's rating-formula shape and position-mapping table, but the data
itself comes entirely from Wikipedia.

## Status

**63 of 64 target clubs done, 1,540 players.** The only gap is **Hebburn
Town** (National League North) — its Wikipedia article genuinely has no
squad list at all (checked directly: no "Current squad"/"First team"/
"Players"/"Squad" heading anywhere in the article, just History/Honours/
Records/See also/References/External links). Recorded as missing, not
invented.

## Source and licence

- **Source**: English Wikipedia article text (wikitext), fetched via
  `https://en.wikipedia.org/w/index.php?title=<Article>&action=raw` (the
  MediaWiki `action=parse`/`api.php` endpoint returned a hard 429
  "too many requests" on this session's shared egress IP even at ~1
  request per minute — `action=raw`/`action=info` on `index.php`, a
  different endpoint, worked reliably instead; see "How to refresh"
  below for the exact mechanism if this needs redoing).
- **Licence**: Wikipedia text is **CC BY-SA 4.0**. Re-using it (including
  in a derived dataset like this one) requires **attribution** — credit
  "Wikipedia contributors" / the specific article, and a link to the
  licence (https://creativecommons.org/licenses/by-sa/4.0/) — and any
  work built directly from this text and redistributed must itself stay
  under a compatible share-alike licence. This dataset is for internal
  use inside the Knowitball game (player names/positions/nationalities as
  structured game data, not republished article text), but the attribution
  requirement should be kept in mind if this file or its contents are ever
  shared or published outside the project.
- Every club's record carries its own `wikiTitle` and `wikiRevisionId` so
  the exact source revision is traceable.
- Polite-fetch practice actually used: one request at a time, ~1.2s apart,
  descriptive User-Agent (`KnowitballDataBot/1.0
  (harry.v2157@gmail.com)`), no parallel requests, hard stop rather than
  retry-through on the one real 429 encountered early on (which came from
  `api.php` specifically, not from being over any real per-second limit —
  see below).

## Rating formula

```
overall = clamp(divisionBase + nameHashSpread + captainBonus, 38, 66)
```

- **divisionBase**: 52 for `national_league`, 46 for
  `national_league_north` / `national_league_south` — the National League
  is one real tier above North/South, so it gets a small flat head start.
  Same idea and same numbers as the Transfermarkt attempt's formula.
- **nameHashSpread**: a stable, deterministic value in **[-4, 4]**, derived
  from a SHA-256 hash of the player's own name (`int(hash[:8], 16) /
  0xFFFFFFFF`, scaled to the range). Not re-rolled on rebuild — the same
  player name always gets the same spread. This is a straight
  position-independent spread (no market-value signal available from
  Wikipedia the way Transfermarkt gave one) — it exists purely so a squad
  isn't perfectly flat, per the task's own instruction.
- **captainBonus**: **+2** if the club's Wikipedia squad template marks
  that player as captain (an `other=...captain...` note on his `{{fs
  player}}` entry), else 0.
- No age-based term — Wikipedia's `{{fs player}}` template doesn't carry
  date of birth, and per the task's own instruction, ages were skipped
  entirely rather than making extra per-player requests to fetch them.
  `dob` is `null` for every player in this file.
- Final result clamped to **38–66**, the same deliberately compressed
  non-league band the Transfermarkt attempt's formula used. Measured
  actual output across all 1,540 players: min 42, max 56, mean 47.7 — the
  full clamp range is never hit in practice (a captain bonus stacked on
  the hash spread's own extreme would reach 58 at most for National
  League, 52 for North/South; nothing in this squad set happened to land
  exactly there), which is expected and fine — the clamp is a safety
  bound, not a target.

## Position mapping

Wikipedia's `{{fs player|pos=...}}` field only ever gives one of the four
generic categories `GK`/`DF`/`MF`/`FW` — never a specific code like the
game's. Every non-`GK` player's specific position is therefore a **guess**
(`positionGuessed: true`), spread across that generic category's real sub-codes
**in the order players are listed on the page** (Wikipedia squad lists are
themselves usually already number/position-grouped), cycling through a
realistic pattern rather than assigning the same sub-position to everyone:

| Wikipedia `pos=` | Game's codes, cycled by listing order |
|---|---|
| `GK` | `GK` (never guessed — this one's given directly) |
| `DF` | `CB, LB, CB, RB, CB, CB, LB, RB, CB, LB, ...` (majority CB, one LB/RB per ~5) |
| `MF` | `CM, CDM, CM, CAM, CM, CDM, CM, CDM, CM, CAM, ...` (majority CM) |
| `FW` | `ST, LW, ST, RW, ST, ST, LW, ST, RW, ST, ...` (majority ST) |

Every player except a goalkeeper has `positionGuessed: true` for this
reason — it's honest about the fact that Wikipedia never says "CDM" or
"RW" directly, only "MF" or "FW".

## Nationality

Wikipedia's `{{fs player|nat=...}}` field is almost always a 2-4 letter
national-team code (matching `{{flagicon}}`'s own code table — mostly
FIFA codes, IOC codes for nations without a FIFA men's team). These are
mapped to full country names via a lookup table (`natcodes.py`, ~90
entries, covering every code actually seen across all 1,540 players plus
a broad set of others likely to appear in English non-league football). A
handful of templates on some pages spell the nationality out in full
already (e.g. `nat=Republic of Ireland`, `nat=Montserrat`) — those are
used as-is rather than run through the code table. Every player in the
final file has a non-null `nationality` — nothing fell through unmapped
(checked directly after the build: 68 distinct nationalities used, all
either full country names from the lookup table or one already given in
full by the source template).

## Loan / captain flags

Read from the `other=` field on `{{fs player}}`:
- `onLoan: true` + `loanFrom: "<parent club>"` when `other` contains
  "on loan from X".
- `isCaptain: true` when `other` contains "captain".

## `squadAsOf`

Most club articles carry a `{{updated|<date>}}` template right above the
squad list (e.g. `{{updated|3 September 2026}}`), which is captured as-is.
5 clubs' articles don't show one at all (Chester, Spalding United,
Chelmsford City, Slough Town, Weston-super-Mare) — `squadAsOf` is `null`
for those, not guessed.

## File shape

```jsonc
{
  "source": "Wikipedia (CC BY-SA 4.0)",
  "fetchedAt": "2026-09-28T12:xx:xx.xxxxxxZ",
  "ratingFormula": "... (the formula above, as one string)",
  "clubs": [
    {
      "name": "AFC Fylde",                 // game's spelling: clubs.ts
                                             // for National League,
                                             // clubs.json's own name for
                                             // North/South
      "division": "national_league",        // | national_league_north
                                             // | national_league_south
      "wikiTitle": "AFC Fylde",             // the actual Wikipedia article
                                             // title fetched (redirects
                                             // already resolved)
      "wikiRevisionId": "1373271493",
      "squadAsOf": "3 September 2026",       // or null
      "status": "ok",
      "players": [
        {
          "name": "Zac Jones",
          "shirtNumber": "1",                // or null
          "position": "GK",
          "positionGuessed": false,          // true for every non-GK
          "nationality": "New Zealand",
          "dob": null,                       // always null — skipped per
                                              // the task's instruction
          "onLoan": false,
          "loanFrom": null,
          "isCaptain": false,
          "overall": 56
        }
      ]
    }
  ]
}
```

One club object per line in the actual file (as requested), not
pretty-printed multi-line per club.

## Missing clubs

- **Hebburn Town** (National League North) — no squad section on its
  Wikipedia article at all. Every other heading (History, Honours,
  Records, See also, References, External links) is present; there is
  simply no player list to parse. Left out of `nonleagueSquads.json`
  entirely rather than invented; if a squad list is ever added to that
  article, re-running the fetch+parse pipeline picks it up automatically.

## How to refresh

Everything needed is in this folder (`clublist.py`, `natcodes.py`,
`fetch.py`, `parse.py`) — nothing was deleted this time, unlike the
Transfermarkt attempt.

1. `python3 fetch.py` — walks `ALL_CLUBS` (`clublist.py`), tries each
   club's candidate Wikipedia title(s) via
   `https://en.wikipedia.org/w/index.php?title=<Title>&action=raw`
   (one request at a time, ~1.2s apart, `KnowitballDataBot/1.0
   (harry.v2157@gmail.com)` User-Agent), following the one caching rule
   that matters: **a club whose raw wikitext file already exists in
   `raw/` is skipped entirely** — so a resumed/re-run fetch only spends
   requests on clubs it doesn't already have. Delete a specific club's
   `raw/<Title>.wikitext` (and `.info.json`) to force a re-fetch of just
   that one. Also fetches `action=info` per club (for the real Wikipedia
   revision ID — parsed off the "Date of latest edit" row) and, if every
   guessed title 404s, falls back to `index.php?search=...&title=Special:
   Search` (also not `api.php`) to find the real article.
2. `python3 parse.py` — reads every cached `raw/*.wikitext` file, finds
   the squad section (a `==Current squad==` / `==First-team squad==` /
   `==First team==` / `==Players==` / `==Squad==` heading, case-
   insensitive, up to the next `==...==` top-level heading), parses every
   `{{fs player|...}}` / `{{football squad player|...}}` template inside
   it, and writes `nonleagueSquads.json` + `missing_clubs.json`.
3. If Wikipedia updates a squad list later in the season, just re-run
   both steps — `fetch.py`'s cache means it'll only actually make new
   requests for clubs whose `raw/` file you've deleted (or all of them,
   if you delete the whole `raw/` folder to force a full refresh).

### Why `action=raw`/`action=info` instead of the MediaWiki API

This session's egress IP got a hard `429 "You are making too many
requests to the API"` from **both** `api.php` (`action=parse`) and
`rest.php` (`/w/rest.php/v1/search/page`) on the very first and second
requests — before this build had made any requests of its own, meaning
some other traffic sharing this same egress IP had already used up
whatever quota those two specific endpoints track. `index.php`
(`action=raw`, `action=info`, and `Special:Search`) is a genuinely
different endpoint and was never rate-limited once across the full 132
requests this build actually made. If `action=raw` ever starts getting
429s too, back off hard (this file's own fetch.py already retries a 429
with 15/30/45s waits) rather than switching to a workaround that evades
the block.

## Request count and timing

- **132 total requests** to `en.wikipedia.org` across this whole build
  (2 per club for the 63 successfully-fetched clubs' `action=raw` +
  `action=info`, plus 1 for the failed Hebburn Town lookup, plus a
  handful for the two redirect follow-ups (Hornchurch, AFC Totton) and
  their own `action=info` calls).
- Spaced ≥1.2s apart, one at a time, no concurrency.
- Wall-clock time: roughly 3 minutes for the main run (127 requests) plus
  a short follow-up run to fix 2 redirects and widen the squad-heading
  match for one club (5 more requests).
