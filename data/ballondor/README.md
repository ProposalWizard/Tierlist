# Men's Ballon d'Or winners, 1956–2025 (ballondor.com only)

Collected 7–8 Oct 2026 for a future game mode. Every fact comes from
ballondor.com only (winners page, all 70 year rankings, 47 player pages,
about 155 articles). Nothing was added from memory.

Shareable page: https://claude.ai/artifact/11KW1FQ1dKfbg68xSpjcmC
(same page saved here as `winners_page.html`).

| File | What is in it |
|------|---------------|
| `rankings.json` | Year → full ranking rows `[place, name…, club, country]`. 2020 is null (no award). No points. |
| `players.json` | Player page per winner: position, club now, country, date of birth, height, weight, bio, honours. |
| `year_notes.json` | Year → facts from the site's articles about that win (trophies that year, points, ages, records). |
| `build.py` + `template.html` | Rebuild `winners_page.html` (needs the raw scrape, not kept). |

Winning-season stats (games/goals/assists) exist on the site for only 7
years: 1963, 1988, 1997, 2002 (partial), 2023, 2024, 2025.

Known site contradictions: 1994 "narrowly beat" vs 210–136 points; the
2019 Messi/Van Dijk margin dated "two years earlier" than 2022; Dembélé's
2024-25 goals 37 vs 35; one article calls Dembélé the "2026" winner.
