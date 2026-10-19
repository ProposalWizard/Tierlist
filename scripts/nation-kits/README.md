# Nation kits

Every nation's real home and away kit (Leo, 13 Oct 2026), written to
`lib/star/data/sources/nation_kits_2026-10.json` and read through
`lib/star/data/nationKits.ts`. Shown on `/admin/clubs` → International; worn
in every international match (`lib/star/international.ts` → `nationKits`).

## Where it comes from

Each national team's Wikipedia page has a kit box: an exact colour for the
left sleeve, shirt, right sleeve, shorts and socks, and a design picture for
each (Wikimedia Commons, e.g. `Kit_body_bra26h.png`). In October 2026 these
are the current kits, mostly the 2026 World Cup ones.

## Steps (run from this folder, Python 3 + Pillow)

1. `python3 fetch.py`: downloads each nation's kit box into `raw.json`
   (slowly; Wikipedia rate-limits).
2. `python3 images.py`: downloads the design pictures into `img/`, through
   the wsrv.nl image relay (October 2026: upload.wikimedia.org rate-limited
   this machine after ~400 pictures and kept refusing for over half an hour).
3. `python3 analyze.py`: builds each kit picture (`kitimg/`) and reads it:
   the shirt colour, the second colour the eye reads, the pattern (plain,
   stripes, hoops, halves, a centre stripe, a band, sleeves, or a graphic),
   and the shorts and socks. Writes `analysed.json`.
4. `python3 sheet.py`: contact sheets (`sheet_*.png`) of every kit with its
   reading, to check by eye. Fixes go in `corrections_list.py`, one line per
   kit (`C("Nation", "home", "pattern words", trim="#hex", ...)`); FIFA's
   spelling of the nation. `python3 corrections.py` writes `corrections.json`.
5. `python3 build.py ../../lib/star/data/sources/nation_kits_2026-10.json`.

All the in-between files stay in this folder and are git-ignored.

## October 2026 round

- 211 nations, 422 kits. 171 nations had at least one kit's words fixed by
  eye (the reader gets colours right but often misnames a pattern, e.g. a
  plain navy shirt with dark shading read as "navy and black hoops").
- A few kits have no design picture on Wikipedia: those use the kit box's
  colours only, as Wikipedia itself shows them. Where the kit box gives no
  colour either, white (what Wikipedia shows).
- Uganda's page has no away kit at all: its away kit (yellow, black shorts)
  is picked from the flag, not researched, and says so on /admin/clubs.

`nations.json` maps FIFA's spelling to the game's (dump of `NATIONS` in
`lib/star/intl/nations.ts`).

Test: `npx tsx tests/star/nationKits.mts`.
