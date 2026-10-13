# Nation name banks

`data/names/nation-names.json`: for each of the game's 211 nations, up to 100
first names and 160 surnames, most common first. Read by `lib/star/nationNames.ts`
to name made-up players in national squads.

Made from Wikidata: every male association football player whose citizenship
(P27) or sporting nationality (P1532) is that country (the four UK teams by
sporting nationality only). Mikey, 13 Oct 2026.

To rebuild (needs network to query.wikidata.org, about 25 minutes):

    cd scripts/names
    python3 fetch.py     # one query per nation into raw/<Q-id>.csv (skips ones already there)
    python3 build.py     # splits names, tops up thin nations, writes nation-names.json
    cp nation-names.json ../../data/names/

`qids.json` maps each game nation to its Wikidata item. `build.py` has the
rules: surname first for China, Korea, Vietnam, Hong Kong, Macau, Chinese
Taipei and Cambodia; particles (van, de, El, Al…) stay with the surname; a
Spanish-speaking player's first surname; a second first name ("José Manuel")
is skipped; Jr./II are dropped; one-word names are skipped. Nations with under
40 players on record are topped up from neighbours (`NEIGHBOURS`).
