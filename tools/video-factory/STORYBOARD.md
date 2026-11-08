# Video factory storyboard format (Mikey, 3 Nov 2026)

One JSON file per video in `tools/video-factory/stories/<id>.json`. The factory
(`tools/video-factory/`) turns it into a 1080x1920 animated video: a talking
cartoon narrator at the bottom (voice E), one illustrated card per line above
him, red-box captions, music, and the Knowitball call-to-action at the end.

```json
{
  "id": "rob-koeman-1988",
  "series": "Ballon d'Or robberies",
  "title": "Koeman 1988: the biggest robbery?",
  "sources": ["https://...", "https://..."],
  "checked": "what was checked and against what, one line",
  "clubs": { "psv": { "name": "PSV", "short": "PSV", "c1": "#e1001a", "c2": "#ffffff", "pattern": "stripes" } },
  "people": { "koeman": { "name": "Ronald Koeman", "skin": "light", "hair": ["crop", "#e2c27a"], "beard": "none", "kit": "psv" } },
  "lines": [
    { "text": "Ronald Koeman had the greatest season a defender has ever had.", "scene": { "type": "title", "heading": "RONALD KOEMAN", "sub": "PSV · 1987/88", "pill": "THE BIGGEST ROBBERY?", "person": "koeman" } }
  ]
}
```

## Rules for the script
- 10 to 16 lines, 140 to 220 words in all (about 60 to 90 seconds).
- Spoken English, short sentences, the way a football TikTok narrator talks. A strong hook in line 1.
- Write numbers the way they should be SAID: "twenty-one goals", "eight-two", "nineteen eighty-eight".
  (The captions show the script words as written.)
- Every fact checked against at least two sources; list them in `sources`. Unsure = leave it out.
- The LAST line is always the call to action, and the factory adds the end card:
  `"Follow for more."` (Mikey, 7 Nov 2026: the voice says only this; the end card on screen stays the same)
  with scene `{ "type": "cta" }`.

## People and clubs
- `people`: everyone drawn. `skin`: light | pink | olive | tan | brown | dark | deep.
  `hair`: [style, colour]; styles: buzz, crop, side, tidy, quiff, slick, messy, curlytop, bigcurl, locs, bald.
  `beard`: none | stubble | goatee | short | full (+ optional `beardCol`). `kit`: a club id, or `suit` for officials and managers (add `club` for their badge and colours).
  Draw people as they looked at the time of the story.
- `clubs`: `c1` shirt colour, `c2` second colour, `pattern`: plain | stripes | centre | halves | sash | hoops | sides.
  `short`: 2 to 5 letters shown on the drawn crest (we never use real crests).
  Nations are clubs too (e.g. `"arg": {"name":"Argentina","short":"ARG","c1":"#75aadb","c2":"#ffffff","pattern":"stripes"}`).

## Scene types (pick one per line)
| type | fields | shows |
|---|---|---|
| `title` | heading, sub, pill, person, club? (crest + crowd; default the person's kit or club) | the hook card: big name, sub line, a pill, the person |
| `person` | person, label?, mood? (happy, flat, worried, shocked), stamp? | one person, big |
| `versus` | left {person, label, value}, right {…}, title? | two people side by side with a number each |
| `stats` | title, items [{n, l}] (2 to 4), person? | big numbers counting up |
| `score` | home, away (club ids), hs, as, date, comp, note? | a match scoreline card |
| `trophies` | items [{kind, label}], person? ; kind: league, cup, bigears, euro, worldcup, ballon, boot | trophies popping in |
| `list` | title, rows [{name, value, club?, hl?}] (3 to 8) | a ranking/table, `hl` rows highlighted |
| `text` | heading, body (max 40 words) | a fact panel, like a news/wiki snippet |
| `quote` | person, text (max 16 words) | a speech bubble |
| `timeline` | items [{year, label}] (3 to 6) | events on a line |
| `podium` | year, title?, places [{person or name, club}] (3: winner first) | Ballon d'Or style podium |
| `stamp` | text, person?, color? (red, yellow, white) | a big rubber stamp: ROBBED, GUILTY, CANCELLED… |
| `whatif` | title, real {label, value}, alt {label, value} | "real world v alternate world" split |
| `cta` | — | end card (last line only) |

Any scene can add `"stamp": "ROBBED"` (shown halfway through the line).

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
