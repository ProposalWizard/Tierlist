# Competition history — file format (one JSON file per competition)

Collected Nov 2026 for Road to Ballon d'Or. NOT used by the game yet.

```json
{
  "competition": "Premier League",            // the game's name for it
  "slug": "premier-league",
  "kind": "league" | "cup" | "tournament",
  "lineage_note": "Top tier of English football. 1888-89 to 1991-92 = Football League First Division; 1992-93 on = Premier League.",
  "history_from": "1888-89",                  // first season of the CONTINUOUS run to the latest finished season
  "history_to": "2025-26",                    // latest finished season/edition
  "field_from": {                             // each extra field's own continuous start (null = none found)
    "runner_up": "1888-89", "final_score": null,
    "top_scorer": "1888-89", "top_assister": "1992-93", "player_of_season": "1947-48"
  },
  "player_of_season_award": "FWA Footballer of the Year (1947-48 to 1993-94), Premier League Player of the Season (1994-95 on)",
  "sources": ["https://...", "https://..."],
  "seasons": [                                // oldest first, every season/edition from history_from to history_to
    {
      "season": "1888-89",                    // leagues/club cups: "YYYY-YY"; tournaments: the year, e.g. "2022"
      "name_then": "Football League",         // only when the competition had another name that season
      "status": "played" | "not_held",        // not_held = the competition was not played (war, no edition) — not a gap
      "winner": "Preston North End",
      "runner_up": "Aston Villa",
      "final_score": "2-1 (a.e.t.)",          // cups/tournaments only: winner's score first; pens like "1-1 (4-3 pens)"
      "top_scorer": [{ "name": "John Goodall", "team": "Preston North End", "goals": 21 }],   // list: ties allowed
      "top_assister": [{ "name": "...", "team": "...", "assists": 0 }],                      // or null before field_from
      "player_of_season": { "name": "...", "team": "..." },                                  // or null before field_from
      "notes": "optional: anything odd (shared title, replay, two legs, abandoned season...)"
    }
  ]
}
```

Rules
- No gaps: every season between history_from and history_to is present. A field that is known only for scattered years
  before its continuous run is left null before field_from (scattered older values are dropped on purpose).
- Facts from public sources only; winner/runner-up/scores checked against two sources where possible.
- Names written the common English way. Clubs as they were named that season.
