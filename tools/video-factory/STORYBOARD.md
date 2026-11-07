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
  `"Follow for more, and play Road to Ballon d'Or at knowitball dot co dot uk."`
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

Set `"layout": "chess"` on the story. No narrator on screen: a move card on
top types the voice's words as they are said, the pitch is drawn as a
chessboard with pawns (White = the bottom side, Black = the top), an
evaluation bar sits on the left, a name tag for each manager, and a scoreboard
at the bottom. Engine: `engine/chess.html` + `engine/chess.js` (formations,
labels and the two managers' ids are at the top of chess.js: change them per
story). First video: `stories/ch-mourinho-pep-2010.json`.

Each line may add `"say"`: what the voice reads, when it differs from the
text on screen (e.g. text "3-1", say "three-one").

Every scene is `{ "type": "move", ... }`:
| field | meaning |
|---|---|
| `n`, `who`, `title` | "MOVE n · who's name" and the coloured title. `who`: a person id, `result` or `next`. `hook: true` for line 1. |
| `badge` | brilliant, great, best, excellent, book, inaccuracy, mistake, blunder, checkmate, nogoal |
| `flip`, `flipWord` | swap to a second badge when the voice reaches that word (Bojan: brilliant → nogoal at "handball") |
| `on` | the piece the badge lands on (motta, etoo, pique, bojan) or a manager (badge in the corner) |
| `eval`, `evalAfter` | the bar: a number (+ = White better) or "M" for mate; `evalAfter` moves it again at `flipWord` |
| `board` | `inter`, `barca` (formation names in chess.js), `ball` [x, y], `goal` top/bottom, `arrows` [[x1, y1, x2, y2]] |
| `red`, `passes`, `sprinklers`, `trophy` | a red card walks that piece off; the ball circles the wall; sprinkler spray; the cup over the board |
| `score` | `where`, `min`, `h`, `a`, `agg`, `poss`, `names` |
