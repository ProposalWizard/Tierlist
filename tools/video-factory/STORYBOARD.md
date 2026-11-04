# Video factory storyboard format, v2 (Mikey, 4 Nov 2026; v1 3 Nov)

Read `V2_RULES.md` first: where it and this file disagree, it wins.

One JSON file per video in `tools/video-factory/stories/<id>.json`. The factory
turns it into a 1080x1920 animated video: no narrator, every scene fills the whole
screen, red-box captions in a fixed band, voice D, music, and the approved end card.

```bash
python3 tools/video-factory/make.py tools/video-factory/stories/<id>.json            # voice D (default)
python3 tools/video-factory/make.py tools/video-factory/stories/<id>.json --voice e  # the old voice E
python3 tools/video-factory/sheet.py tools/video-factory/stories/<id>.json            # quick layout sheet, no voice
python3 tools/video-factory/sheet.py --video tools/video-factory/out/<id>.mp4         # a still of every scene
```
`gallery.json` holds one example of every scene type (`sheet.py gallery.json`).

```json
{
  "id": "rob-henry-2003",
  "series": "Ballon d'Or robberies",
  "title": "Henry 2003: twenty goals, twenty assists, no Ballon d'Or",
  "sources": ["https://...", "https://..."],
  "checked": "what was checked and against what, one line",
  "clubs": { "ars": { "name": "Arsenal", "short": "ARS", "c1": "#ef0107", "c2": "#ffffff", "pattern": "sides" } },
  "people": { "henry": { "name": "Thierry Henry", "skin": "brown", "hair": ["bald", "#1a1a1a"], "beard": "none", "kit": "ars" } },
  "lines": [
    { "text": "In 2002-03, Henry was scoring them and making them.",
      "say": "In twenty-oh-two, oh-three, on-REE was scoring them, and making them.",
      "scene": { "type": "stats", "title": "Scoring them and making them", "items": [ { "n": "24", "l": "league goals" } ] } }
  ]
}
```

## Rules for the script
- 12 to 17 lines, 150 to 210 words (about 60 to 80 seconds). An entertaining story, not a list:
  a hook in line 1, key moments, drama, a payoff.
- `text` is what the captions show. Write it the way it reads best.
- `say` (optional) is what voice D speaks. Use it for numbers ("twenty-oh-two, oh-three"),
  and for any name not yet in `pronounce.json`. When `say` is missing, the factory speaks
  `text` with every name in `pronounce.json` swapped for its sound-alike spelling.
  Captions take their words from `text` and their timing from the spoken audio
  (when the words differ, timings are spread proportionally).
- Every fact checked against two sources; list them in `sources`. Unsure = leave it out.
- No "you" (the player's own footballer) in story videos.
- The LAST line is always `{ "text": "Follow for more, and play Road to Ballon d'Or.", "scene": { "type": "cta" } }`
  (added if missing; an old CTA that reads the website is replaced). The voice never reads
  the website or "link in bio": the end card shows them.

## pronounce.json
`tools/video-factory/pronounce.json` → `names`: written name → spoken respelling, e.g.
`"Soulé": "Soolay"`. Shared by every video; add each new name once, with its source in
`_ipa`. How to write one: ONE joined word per name word, plain English letters, first letter
capital only, no hyphens and no inner capitals (voice D pauses at hyphens and spells capitals:
"tee-AIR-ee" came out as "TARE"); never start with "um" or "uh" (read as a hesitation). The
entries were auto-joined from an older hyphen style on 4 Nov 2026 and most are unverified. Check a new one by transcribing a take
(`work/<id>/voice.json` lists what each line said, what the transcriber heard, and the match).

## People and clubs
- `people`: `skin`: light | pink | olive | tan | brown | dark | deep. `hair`: [style, colour];
  styles: buzz, crop, side, tidy, quiff, slick, messy, curlytop, bigcurl, locs, bald.
  `beard`: none | stubble | goatee | short | full (+ `beardCol`). `kit`: a club id, or `suit`
  (add `club` for colours and badge). Draw people as they looked at the time.
- `clubs`: `c1` shirt, `c2` second colour, `pattern`: plain | stripes | centre | halves | sash | hoops | sides.
  The pattern is drawn inside the shirt's outline, as part of the kit.
- **Real badges:** the factory looks each club up by `name` in Supabase `club_logos`
  (public read) and caches the PNG in `assets/badges/` (git-ignored). If the table spells
  it differently, set `"badge": "FC Porto"`. `"badge": false` forces the drawn crest.
  No match = the drawn crest (`short` is its 2 to 5 letters). Dark badges sit on a light disc.
  Real badges are for videos only, never the game.

## Screen layout (every scene obeys it)
- The story lives in y 200 to 1220. The series name sits top left.
- Captions: a fixed band, y 1250 to 1500, 60 px side margins, red box on the word being said.
- Below 1500 is TikTok's caption: background only. Below y 900, keep words and faces left of x 960.

## Scene types (one per line)
Any scene can add `"stamp": "ROBBED"` (shown halfway through) and most take a `kicker`
(the small coloured tag over the title).

| type | fields | shows |
|---|---|---|
| `title` | heading, sub, pill, person, club? | floodlit stadium, huge name, red pill, the person rising, badge |
| `person` | person, label?, mood? (happy, flat, worried, shocked) | one person, big, in club-colour bands |
| `versus` | title?, left/right {person or club, label, value, sub?, win?} | split screen, two people, counting numbers |
| `stats` | title, kicker?, items [{n, l}] (1 to 4), person? | game-style cards, numbers count up |
| `score` | home, away, hs, as, date, comp, note?, ft? ("FULL TIME"; false hides) | a broadcast scoreline with badges |
| `trophies` | title, kicker?, items [{kind, label, count?}], person? ; kind: league, cup, goldcup, bigears, euro, worldcup, ballon, boot, award | trophies on lit plinths |
| `list` | title, kicker?, rows [{name, value, club? or person?, hl?, pos?}] (3 to 8) | a ranking in the game's row style |
| `text` | heading, body (max 40 words) | an explainer card |
| `quote` | person, text (max 16 words) | a quote card and the person talking |
| `timeline` | title, kicker?, items [{year, label, club?, hl?}] (3 to 6) | a vertical timeline drawing itself |
| `podium` | year, title?, places [{person or name, club, points?}] (winner first) | Ballon d'Or podium with the golden ball |
| `stamp` | text, sub?, person?, color? (red, yellow, white, green) | a big rubber stamp |
| `whatif` | title, real {label, value}, alt {label, value} | real world above, alternate world below |
| `news` | headline, standfirst, section?, date?, byline?, person? and/or club?, outlet? (default KNOWITBALL), desk?, nav?, mastColor?, caption?, mark? (false: no highlighter) | a sports-site story: masthead, headline, standfirst, date, picture |
| `table` | title, season or kicker, rows [{pos, club, name?, p, w, d, l, gd, pts, hl?, move?}], cols? (default P W D L GD Pts), zones [{kind: champ, ucl, uel, up, po, down; rows: [from, to]; label?}], gap? {from, to, label, at?}, reveal? ("up") | the GAME's league table: zone bands, lit row, a gold bracket with the points gap |
| `bars` | title, kicker?, items [{label, value, club? or person?, hl?}], unit?, max?, note? | a bar chart |
| `line` | title, kicker?, x [labels], series [{name, values, club? or color?}] (1 to 3), y? {min, max, label}, notes? [{i, text, series?}] | a line graph drawing itself |
| `compare` | title?, left/right {person or club, name?, sub?}, rows [{label, l, r, lower? (smaller wins), better? ("l" or "r")}] | two players head to head |
| `badge` | club (or clubs [..]), title?, kicker?, sub? | a club's real badge, big (or a grid) |
| `gameclip` | clip (folder: `frames/*.jpg` + `meta.json`, as gamecap writes them) or parts [[folder, first, last], ...]; from?, speed?, goalAt? (s), popup? {home, away, homeName?, awayName?, hs, as, hs0?, as0?, scorer, assist?}, caption?, captionColor? | Knowitball match footage, the Who would win? scoreboard pop-up and big italic caption |
| `cta` | (none) | the approved end card (last line only) |

`gameclip` reads `meta.json` for `fps` (default 30) and `goalAt` (seconds) or `goalFrame`.
The pop-up flips from `hs0-as0` to `hs-as` as it lands; the caption comes in 0.25 s after the goal.
