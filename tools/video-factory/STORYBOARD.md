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
- The LAST line is always `{ "text": "Follow for more.", "scene": { "type": "cta" } }`
  (Mikey, 7 Nov 2026: the voice says only this; the end card on screen stays the same).
  It is added if missing; an old CTA that reads the website or "play Road to ..." is replaced.

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

## Layout "chess": analysed like chess (Mikey, 7 Nov 2026)

Football first, chess on top (FACT-KIB-011): a real pitch in metres with
correct markings, every player a drawn icon in his kit with his name, a camera
that moves to the action; then the chess layer: a move card on top that types
the voice's words as they are said, a grade badge next to the player who made
the move, the evaluation bar on the left, both managers and the score at the
bottom. Never a chessboard with pieces. Set `"layout": "chess"`.
Engine: `engine/chess.html` + `engine/chess.js`. First video:
`stories/ch-mourinho-pep-2010.json` (copy it for the next one).

Story fields: `people` (the two managers, `kit: "suit"`, `club`), `players`
(id -> name, short?, club, skin, hair, beard, gk?), `clubs` (c1, c2, pattern,
collar?, gk colour), `shapes` (name -> { playerId: [x, y] } in metres: x 0-68
across, y 0-105 down; the "black" side defends the top goal). A player in one
scene's shape and not the next fades out (subs, red cards); new ones fade in.
Each line may add `"say"`: what the voice reads when it differs from the text
on screen (text "3-1", say "three-one"; text "Eto'o", say "Etto").

Every scene is `{ "type": "move", ... }`:
| field | meaning |
|---|---|
| `n`, `who`, `title`, `hook` | "MOVE n · who's name" and the coloured title. `who`: a manager id, `result` or `next`. `hook: true` on line 1. |
| `badge`, `on` | brilliant, great, best, excellent, book, inaccuracy, mistake, blunder, checkmate, nogoal; `on` = the player id it lands beside |
| `flip`, `flipWord` | swap to a second badge when the voice reaches that word (Bojan: brilliant to nogoal at "handball", with a NO GOAL stamp) |
| `eval`, `evalAfter` | the bar: a number (+ = the bottom side better) or "M" for mate; `evalAfter` moves it again at `flipWord` |
| `shape` | one or more shape names (both teams) |
| `cam` | `cx`, `cy` (metres), `len` (metres of pitch shown top to bottom; 40 = close, 110 = whole pitch), `push` (slow zoom) |
| `focus` | player ids lit up; everyone else dims |
| `ball` | `{ path: [[x, y], ...], at, dur }` seconds into the line; `pass`: ids the ball circles between; `sway`: a club whose players shuffle |
| `runs` | `[{ id, to: [x, y], at, dur }]` |
| `goal`, `goalWord` | GOAL! flash when the voice says that word |
| `red`, `redAt` | red card, "10 MEN", the player walks off |
| `banks` | yellow bands behind the two banks of four |
| `arrows` | `[{ from: [x, y], to: [x, y], at }]` |
| `overlay` | hook (manager v manager), coach (map inset), possession, sprinklers (full time run), trophy, next |
| `where`, `score` | venue tag; `score` = { h, a, min, agg, names? } |

The end line's voice says only "Follow for more." (RUL-KIB-005).
