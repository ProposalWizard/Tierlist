# Who would win? template

The approved **Man United v Roma v4** video, made reusable. One `match.json` describes a video; `build.py` turns it into a finished 1080x1920 MP4. Never hand-edit `template/edit.html` for one video: change the json. (V2_RULES.md: "use EXACTLY the approved Man United v Roma format, plus a voiceover".)

```bash
cd tools/video-factory/ww
python3 build.py examples/utd-v-roma-v4.json --no-vo          # the original, no voice (parity check)
python3 build.py examples/utd-v-roma-v4.json --out examples/out/utd-v-roma-vo-test.mp4   # with the narrated story
python3 build.py my-match.json --stills 2,20,31,50 --no-vo     # just a few frames into <work>/frames, to check a look fast
python3 build.py my-match.json --plan-only                     # timeline only (prints every segment's start)
python3 compare.py old.mp4 new.mp4 sheet.jpg --every 2         # side-by-side contact sheet with a difference score
```

Needs: ffmpeg, node + the repo's playwright Chromium, python3 with numpy, soundfile, Pillow, faster_whisper. For the voice: the Qwen venv (`QWEN_PY`, default the session's `scratchpad/tts2/bin/python`; set it up as in `../SETUP.md` with `pip install qwen-tts`). Its weights (about 2.4 GB) download on first use and need about 7 GB of RAM. One render: about 2 minutes for the frames on 3 workers; voice adds about 1 minute per line on 4 cores.

## Files

| File | What |
|---|---|
| `build.py` | json -> defaults -> voice -> timeline -> frames -> mix -> MP4. Work files go to `<json dir>/work/<id>/`, the MP4 to `<json dir>/out/`. Frames are deleted after encoding unless `--keep-frames`. |
| `template/edit.html` | The v4 compositor, generic. Reads `window.MATCH` (the json with defaults filled and paths made absolute) and `window.TL` (segments + caption chunks). |
| `template/avatars.js` | The cartoon faces (v4's), plus: kit patterns clipped to the shirt, real photos in the disc, the fixed end-card face. |
| `template/anton.ttf`, `template/earth/earth.jpg` | Font and the globe texture. |
| `render.mjs` | Frames in headless Chromium (one browser per worker). |
| `voice.py` | Voice D takes (Qwen3-TTS 0.6B Base cloning `../voice/hynes.wav`). Runs in the Qwen venv. |
| `compare.py` | Contact sheet of two cuts. |
| `examples/utd-v-roma-v4.json` | The approved video as data, plus a test voiceover story. |
| `examples/footage/` | Game footage frames. **Git-ignored** (big). See "Footage". |

Music and effects come from the repo: `public/star/music/` and `public/sfx/`.

## The running order (segment ids)

`grid` · `title` · `homeSheet` · `atoms` · `awaySheet` · `versus` · `globe` · `ratings` · `kickoff` · *one segment per event* (its `id`; an event with `lateCard` gets a `late` segment before it: `late`, `late2`, ...) · `fulltime` · `potm` · `end`.
Old names from v4 also work: `sheetU`, `sheetB`, `result`, `ballon`.

Default seconds: grid 3.6, title 2.5, homeSheet 4.1, atoms 1.3, awaySheet 2.6, versus 3.0, globe 6.4, ratings 4.4, kickoff 1.2, late 1.1, fulltime 6.0, potm 6.4, end 3.4. A goal: max(3.2, goalAt + 1.6), or max(2.6, goalAt + 1.3) when there are more than 5 events, so a 6-3 does not run to 90 seconds. A miss: goalAt + 1.25. Override any of them in `durations` (`{"globe": 5.5, "goalK": 3.0}`) or an event's `dur`.

## match.json

Everything not marked *required* has a default. See `examples/utd-v-roma-v4.json` for a complete one.

```jsonc
{
  "id": "utd-v-roma",                       // names the work folder and the MP4
  "title": "WHO WOULD WIN?",
  "footageRoot": "footage/utd-v-roma",      // relative to this json
  "calm": { "dir": "calm/high" },           // calm open play behind the globe dive, ratings and kick-off (loops back and forth); absent = a drawn pitch
  "music": "09-last-attack.mp3",            // public/star/music; the trophy sting at full time is fixed
  "competition": {
    "title": ["CHAMPIONS LEAGUE 26/27", "LEAGUE PHASE · OLD TRAFFORD"],   // the two title lines   (required)
    "tagline": "22 PLAYERS · 1 WINNER",
    "versus": "UCL LEAGUE PHASE · 3 NOV 2026",                             // the red pill on the versus screen
    "short": "UCL · LEAGUE PHASE"                                          // under the full-time score
  },
  "venue": { "name": "OLD TRAFFORD", "place": "MANCHESTER · ENGLAND", "lat": 53.463, "lon": -2.291 },   // required
  // a neutral venue (a final): give "cityLabel"/"citySub" for its pin; both clubs then fly in on arcs
  "globe": { "start": [47.5, 5], "homeSide": -1 },   // camera start [lat, lon] (default: the middle of the pins); which side the home pin's label sits (-1 left)
  "home": { /* club, below */ }, "away": { /* club */ },
  "players": { "malen": { /* player, below */ } },
  "ratings": {
    "rows": [["ATTACK", 84, 80], ["MIDFIELD", 83, 80], ["DEFENCE", 80, 81]],     // home, away; bars run 70 to 95
    "starMen": { "home": { "id": "bruno", "rating": 88 }, "away": { "id": "malen", "rating": 83, "label": "MALEN" } },
    "verdict": "UNITED ARE FAVOURITES"
  },
  "events": [ /* goals and misses in order, below */ ],
  "fullTime": { "side": "away", "front": "malen", "mates": ["soule", "cristante", "wesley", "mancini", "mora", "deroon"], "line": "MAN UNITED 0 - 4 ROMA" },
  //   defaults: the winner (or the POTM's side for a draw), POTM at the front if he is on that side, the next six outfielders; line from the score
  "potm": { "top3": ["malen", "soule", "mora"], "name": "DONYELL MALEN", "subtitle": "HAT-TRICK HERO" },   // top3 required
  "durations": {},
  "vo": [ /* voiceover lines, below */ ]
}
```

### A club

```jsonc
{
  "name": "MAN UNITED",                 // grid pill, ratings, scoreboard, full time   (required)
  "full": "MANCHESTER UNITED",          // team-sheet header
  "season": "08/09",                    // optional: added to name and full ("BARÇA 08/09"); see "Old teams"
  "versus": ["MAN", "UNITED"],          // the two lines on the versus screen (default: name split at the first space)
  "nation": "eng", "founded": 1878,     // flag + "ENGLAND · 1878" (versusInfo overrides the whole line)
  "city": { "label": "MANCHESTER", "sub": "ENGLAND", "lat": 53.463, "lon": -2.291 },   // the globe pin   (required)
  "formation": "4-2-3-1", "kitLabel": "HOME KIT",   // header line "HOME KIT · 4-2-3-1" (sheetLabel overrides)
  "kit": { "shirt": "#d81e2c", "trim": "#ffffff", "collar": "#111111", "shorts": "#ffffff", "socks": "#d81e2c", "number": "#ffffff",
           "pattern": "band", "band": ["#f4b223", "#a6192e"],   // patterns: band | stripes | hoops | halves | sash | sides | centre (patternCol, else trim; centre takes centreEdge for thin edges, e.g. PSG)
           "gk": { "shirt": "#e8e04a", "trim": "#1a1a1a", "collar": "#1a1a1a" } },    // shirt required
  "badge": "badges/man-united.png",     // a real badge (club_logos) replaces the drawn shield everywhere
  "crest": { "a": "#d81e2c", "b": "#ffffff", "c": "#111", "t": "MU", "tc": "#fff", "ts": 40 },   // the drawn shield (default from the kit and initials)
  "flagImg": "flags/xyz.png",           // only for a nation the template cannot draw (it draws eng ita fra esp ger ned por sco wal bel aut irl tur gre sui ukr rus den swe nor arg col bra*)
  "colors": { "ring": "#e0262f", "pillBg": "...", "pillFg": "...", "headerBg": "...", "headerFg": "...", "headerSub": "...", "headerStripes": ["#f4b223", "#a6192e"],
              "versusBg": "#7e0f17", "accent": "#ff6b6b", "bar": "...", "confetti": ["..."], "ribbon": ["left", "right"] },   // all derived from the kit when absent
  "grid": ["bruno", "mbeumo", "...", "lammens"],   // 11 ids, best first, KEEPER LAST (the grid, the circle; away[0] is the atoms' centre)   (required)
  "slots": { "bruno": "CAM", "lammens": "GK", "mystery": [0.5, 0.33] },   // formation slot names, or custom [x, y] pitch fractions   (required)
  "manager": "carrick"
}
```
\* brazil is drawn as plain green; give `flagImg` for a proper one.

Formation slots (`template/edit.html` `SHAPES`):

| Formation | Slots |
|---|---|
| 4-2-3-1 | GK RB CB1 CB2 LB CM1 CM2 RW CAM LW ST |
| 3-4-2-1 | GK RCB CCB LCB RWB CM1 CM2 LWB RAM LAM ST |
| 4-3-3 | GK RB CB1 CB2 LB CM1 (=RCM) CM CM2 (=LCM) RW ST LW |
| 4-4-2 | GK RB CB1 CB2 LB RM CM1 CM2 LM ST1 ST2 |
| 3-5-2 | GK RCB CCB LCB RWB CM1 DM (=CDM) CM2 LWB ST1 ST2 |
| 4-1-2-1-2 (diamond) | GK RB CB1 CB2 LB DM (=CDM) CM1 CM2 CAM ST1 ST2 |

CB1, CM1 etc. are the right-hand one (as the team attacks up the screen). Any slot can be `[x, y]` instead (0,0 top left, keeper near y 0.9). Keep names clear of each other: each face is 50 px wide with its name 76 px below.

### A player

```jsonc
"malen": { "name": "MALEN", "full": "Donyell Malen", "num": 14, "skin": "tan", "hair": ["bald", "#000"], "beard": "goatee",
           "beardCol": "#1a1210", "gk": false, "photo": "photos/231447.png" }
"carrick": { "name": "CARRICK", "skin": "light", "hair": ["crop", "#6b5440"], "beard": "stubble", "suit": { "jacket": "#1f2533", "tie": "#c8102e" } }
```
Ids are yours: they only need to be unique. skin: light pink olive tan brown dark deep. hair: buzz crop side quiff slick messy curlytop locs bald. beard: none stubble goatee short full. Look at each player's photo and choose by eye. A `photo` fills the round face everywhere a face is round; the full-body figures (full time, POTM) always use the drawn head.

### An event (goal or miss)

```jsonc
{ "id": "goalK", "type": "goal", "minute": "23'", "scorer": "malen", "assist": "wesley",
  "footage": { "parts": [["goal-r1/tv", 20, 50], ["goal-r1/high", 50, 135]], "goalAt": 1.6 },
  "popup": "popup/pop0",                 // the game's goal pop-up frames; absent or "drawn" = a drawn scoreboard in the same look
  "caption": "MALEN STRIKES FIRST", "captionColor": "#ffd23f",
  "crowd": "groan",                      // or "cheer"; default: cheer for the home side at home or anyone at a neutral venue, groan for the away side
  "lateCard": "90+3'",                   // optional: a black minute card with the score before this event
  "dur": 3.2,
  "sfx": [["kick-soft", 0.23, 0.6], ["match-header", 1.23, 0.7], ["goal-net", 1.6, 0.8]] }   // optional, the FULL list (public/sfx names, seconds into the segment, volume)
```
- `parts`: `[folder, first frame, last frame, ext?]`, played back to back at 30 fps; the last frame holds (with a slow push-in) if the segment runs longer.
- `goalAt`: seconds into the event when the ball goes in. The flash, pop-up and caption start there. For a `miss` it is when the caption comes in (the ball over the bar); `shotAt` (default goalAt − 0.57) times the strike and the groan.
- Without `sfx`: kick-soft at goalAt − 0.8, kick-hard at goalAt − 0.23, net at goalAt, crowd at +0.05, confirm at +0.02.
- The side, running score and scoreboard numbers come from the scorer and the event order.

### Voiceover

```jsonc
"vo": [
  { "seg": "grid", "offset": 0.3, "text": "Manchester United against Roma. Twenty-two players, one winner." },
  { "seg": "goalY1", "offset": 0.3, "spill": true, "text": "Soulé makes it two.", "say": "Soo-LAY makes it two." },
  { "seg": "end", "offset": 0.3, "text": "Follow for more, and play Road to Ballon d'Or." }
]
```
- `text` is shown in the captions; `say` (optional) is what the voice reads: a sound-alike spelling for every name (V2_RULES: Wikipedia IPA or broadcast usage, unambiguous English). **Write the respelling as one joined word, no hyphens or capitals** (`Mahlen`, `Soolay`, `Daloh`, `Fernandesh`, `Embewmo`): voice D pauses at every hyphen, so `MAH-len` came out as "Amaesha Lin" and `Um-BYOO-moh` was spelled letter by letter. Test a hard name alone first (a 3-line requests file through `voice.py`). Without `say`, words found in the shared `../pronounce.json` (`{"Soulé": "Soo-LAY"}` or `{"words": {...}}`) are swapped in.
- A line starts at its segment's start + `offset`, or 0.25 s after the line before, whichever is later. If it would run past its segment's end, **that segment stretches** (the scene holds its last state; footage holds with a slow push-in). `"spill": true` lets a line run on into the next segments instead (best for quick goal-by-goal calls).
- The voice never reads the website or "link in bio" (build.py refuses). If the last line is not "Follow for more, and play Road to Ballon d'Or." it is added on the end card.
- Each line: up to 3 seeds, the best one by faster_whisper match kept, then `scripts/marketing/voice/humanise.sh`, trailing room tone trimmed. `work/<id>/plan.json` lists each line's start, length, match score and what the transcriber heard: read it to check names.
- Mix: v4's music and effects at v4's levels; under the voice the music drops about 6 dB (and effects about 3 dB), 0.1 s before each line.
- Captions: the factory's red-box current word, up to 3 words a chunk, timed by faster_whisper. They sit in the lower band (y 1250-1500 of 1920) and move to a free spot where a scene has its own text there (grid, team sheets, ratings: just under; versus, globe: top; full time: between the score and the players; POTM: a smaller line above the title; end card: above the face). On a goal or miss they **hide from goalAt − 0.1 s** to the end of the segment, so they never meet the big caption or the pop-up.

## Old teams (the same club in two eras)

Barcelona 08/09 v Barcelona 14/15 works: give each side `"season": "08/09"` (or put it in `name`: `"BARÇA 08/09"`), the same kit if it was the same, and different player ids (`messi09`, `messi15`). The season label tells them apart in every text. Same city on both sides: one globe pin, no arc, the venue highlight still runs. Set a neutral `venue` to stage it elsewhere.

## Photos and badges (real ones; allowed in videos, not in the game)

- **Faces:** players have a SoFIFA id (`sofifa_players.sofifa_id`). Our copies are public in Supabase Storage: `https://cagkgfketucousksgtbk.supabase.co/storage/v1/object/public/tierlist-images/player-portraits/{sofifa_id}.png` (current season), or `{sofifa_id}-{year}.png` for an older PL edition from Draft mode. Missing ones: `scripts/scrape_missing.py --download-faces` (see CLAUDE.md "PL Draft — Data Status").
- **Badges:** table `club_logos` (`club`, `logo_url`), keyed by the club name as SoFIFA spells it. Public-read; query it with the anon key:
  `curl "$URL/rest/v1/club_logos?club=eq.Manchester%20United&select=logo_url" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"`.
  `$ANON` is `NEXT_PUBLIC_SUPABASE_ANON_KEY`: in `.env.local`, or in the live site's JavaScript (open knowitball.co.uk, search the loaded `_next/static/chunks/*.js` for `eyJ`). It is not a secret: it ships to every browser.
- Download into a folder next to your json (e.g. `examples/badges/`, `examples/photos/`) and point `badge` / `photo` at it. Check every face by eye on a stills sheet.

## Footage

Each goal is the game's own animated match (the goal-clip renderer), captured as numbered frames, 720x1280 JPEG at 30 fps (`00000.jpg`...), in two cameras: `tv` (wide, the build-up) and `high` (close, the finish). The pop-up is the game's goal pop-up, 46 transparent PNGs (`00000.png`...`00045.png`; frame 24 holds for a second). `calm/high` is quiet open play (any length).

- `examples/footage/` is git-ignored. The United v Roma footage was captured on 3 Nov 2026 with the scripts kept in the session scratchpad (`wwroma/footage/cap.mjs`, `pop.mjs`). New footage: the capture kit `tools/video-factory/gamecap/` (being built). Recreate real goals like for like where known (who passed, from where, header or shot), with the right kits, skin and hair.
- Put each match in its own folder, set `footageRoot`, and list `[folder, first, last]` parts per event. Pick frames by eye from a contact sheet; `goalAt` = (frames before the ball crosses the line) / 30.
- No footage for an event: it shows a plain pitch and says so; do not ship that.

## Ratings: where they come from

Use the FIFA/EA FC database **of that season**: SoFIFA's edition for the year (our `sofifa_players` table has the editions we scraped), so a 2009 side is rated with FIFA 10 numbers. Team rows (attack, midfield, defence) and star men come from those ratings. Predict a rating only when no database covers that season (before FIFA 05, or a future season), and say so in the video's notes. Matchups must be relevant: an upcoming or topical game, or a famous "what if" (V2_RULES).

## Limits

- One match per video; the order of scenes is fixed (the approved format). Nothing besides goals and misses is an event (no red cards, saves, VAR).
- Exactly 11 per side in the grid; the manager is optional.
- The end card is fixed (United v Roma v4's, LINK IN BIO), with the game's own face in a red shirt.
- Kit patterns on the round faces are simple (band, stripes, hoops, halves, sash, sides). The globe's labels can overlap if two pins are very close.
- A stretched footage segment holds its last frame (with a push-in); keep goal lines short or use `spill`.
- Voice takes are random: always read `plan.json` and listen to names before posting. The match score ignores names (the transcriber misspells them) and is fooled by numbers written as words ("eighty-eight" heard as "88" scores 0.71): read `heard`, not just the score.
- Voice D is slow on a shared 4-core box: 20-40 s a line alone, up to 9 minutes a line when another TTS job runs at the same time.
