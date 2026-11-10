# Stat Twins videos (v02 Salah, v03 Palmer)

A copy of @more_tactics_board's "statistical twin" TikTok format, with no presenter:
a chart card on top (cream, black, one red highlight), word-by-word captions below,
an offline voice. Every frame is drawn from time t alone, so a render is always the same.

## Make an episode
A video folder V holds `lines.json` (what is said + the captions) and `scenes.json`
(which card each line shows). Copy `v02`'s pair from the script in
`docs/marketing/videos/v02-salah-twin/` as a start.

1. `python3 tts.py V KOKORO_DIR` voices every line (Kokoro v1.0, `bm_george`, en-gb).
   KOKORO_DIR holds `kokoro-v1.0.onnx` + `voices-v1.0.bin` from the kokoro-onnx GitHub
   release "model-files-v1.0" (~350 MB, never commit). `pip install kokoro-onnx soundfile`.
2. `python3 timeline.py V` times the captions from the voice lengths and makes the sound mix.
3. `node render.cjs V stills 1,8,20` makes check stills; LOOK at them.
4. `node render.cjs V` makes `V/out.mp4` (1080×1920, 30 fps). About 8 minutes for 85 s.

Scene types (see `video.html`): `title`, `count`, `bars`, `web`, `rank` (countdown, #1
hidden as "?" until the `revealAt` word), `runs` (the 2,000-run grid), `versus` (two
players' 0–100 ranks), `reveal`, `end`. Cards and captions stay inside x 64–950, y 150–1536.

## Make a new episode for any player (the locked format, Mikey 8 Nov 2026)
The format is the Salah episode (v02, cut 5): Poster style, Hugo's voice, "Who is prime X's statistical twin? From
the last five seasons.", X's own seasons shown first and removed, the countdown from the bottom (a repeated player's
places shown together), "You'd think <famous name> would be up here?", "guess the twin" at #2, the twin, "first in
x% of 2,000 tests", why / not the same, this season's top 5, end card in club colours, "Follow for more."

1. Data (once per session; a fresh cloud session has none):
   `TWIN_DATA=/tmp/fm python3 model/fmpull.py && TWIN_DATA=/tmp/fm python3 model/build.py` (FotMob, ~5 min, never commit it).
2. Write `episodes/<player>-<season>.json`, e.g. `episodes/haaland-2223.json`:
   `{"player": "Erling Haaland", "season": "2022/23", "short": "Haaland", "series": "STAT TWINS · EP 3",
     "surprise": ["Harry Kane", "Mohamed Salah", ...], "stories": {}, "spoken": {"Núñez": "Noonyez"}}`
   - `surprise`: famous names, best first; the first one clearly outside the list is used ("You'd think Kane...? 29th").
   - `stories`: optional one-liners for a player (true facts only); otherwise his club's short name is said.
   - `spoken`: how Hugo should say a hard name. `shorts`: a short name when the surname alone is wrong.
3. `TWIN_DATA=/tmp/fm python3 make_episode.py episodes/haaland-2223.json OUT` prints the twin, the list and every line.
   Read the lines: every number comes from the data, but check the words make sense.
4. `python3 tts.py OUT -` (Hugo, ElevenLabs; the key is a network secret, FACT-KIB-012), `python3 timeline.py OUT`,
   `node render.cjs OUT stills 2,10,30,45` and LOOK, then `node render.cjs OUT` (about 8 minutes).
5. Put `OUT/out.mp4`, cover, lines.json, scenes.json in `docs/marketing/videos/<id>/` and add the board card (video-board skill).
Split screen instead of Poster: `"layout": "split"` in the episode file.

## Engine v2 (`video2.html`, Mikey's notes, 7 Nov 2026)
Set `"engine":"video2.html"` and `"imgDir"` in scenes.json `meta`. Adds: real faces, club badges and
flags (RUL-KIB-005, Mikey's videos only), "% match" (100% = identical; = 100 minus the weighted
average gap in 0–100 ranks), "#1 in 8 of 10 tests" in place of "2,000 runs", a 5-second `intro`
card, a long `countdown` (one voice line per place, a big spotlight card + the list filling from
#8 up), `compare` with real per-90 numbers (never ranks on screen), `statement`, `end` with faces.
- `model/v2data.py` makes every number (Salah: 22/23–26/27 attackers; Palmer: 24/25+25/26+26/27
  added up per 90 vs 2016/17). Players are ranked against their OWN season (as the reference video).
- `model/imgs.py` downloads headshots, badges (the badge of that season's club) and flags from
  FotMob into an img folder (never commit it). `model/mk_salah2.py`, `mk_palmer2.py` write
  lines.json + scenes.json for each episode from the numbers.

## The numbers (model/)
- `fmpull.py` reads FotMob's public Premier League stat pages (Opta data), 25 stats x 11
  seasons, one page a second, into `$TWIN_DATA/raw/`. `build.py` joins them into
  `$TWIN_DATA/table.json`. The downloaded data never goes in the repo.
- `model.py`: every PL attacker season (wingers, 10s, strikers) with 900+ minutes; stats per
  90, each ranked 0–100 against that season's attackers; a weighted distance; `runs()` re-runs
  it 2,000 times with every weight shuffled ±50%. FotMob has no xG before 2019/20, so older
  comparisons use `noxg()`.
- `final.py` (Salah) and `palmerfinal.py` (Palmer) print every number the videos use.
- Never state a number that these don't print. No player photos or club badges (RUL-KIB-003).

## Decisions
- Mikey, 7 Nov 2026, on photos and badges: "get rid of this team rule for these videos that I'm creating as Mikey ... use real faces and clubs ... The club logos is fine ... use the real nation flags."
- Mikey, 7 Nov 2026, on the seasons: "it should be last 5 seasons starting from the current season. So 26/27."

## "How do you replace him?" episodes (10 Nov 2026)

A second kind of episode: a player is likely leaving, who replaces him. Format from a replacement-finder TikTok (format only).
1. Episode file in `episodes/` (see `replace-hall.json`): player, the club he is at (`from`), the club he joins (`to`, `toId`),
   `positions` (FotMob position ids; 38 + 68 = left-back), `posWord`, `maxAge` (23). The Twin Finder page's "Replace a player"
   tab writes this file for you.
2. `TWIN_DATA=<dir> python3 make_replace.py episodes/<x>.json OUT`, then `tts.py OUT -`, `timeline.py OUT`, `node render.cjs OUT`.
3. What it does: every player = this season + last season together; ranking ladders for his three best stats and his worst
   (the player above, him, the player below); all the players in his position as tiny faces; the map; option 1 = the closest
   of all ("ready now"), option 2 = the closest aged `maxAge` and under ("for the future"); a small sample (under 900 minutes)
   is said out loud. Ages, values and clubs come from FotMob player pages (cached in `<dir>/../fmplayers.json`).
4. Engine: `video_replace.html`.

## Upgrades, 10 Nov 2026 (review of the whole pipeline)

- **Voice cache** (`tts.py`): a saved take is reused only when the words, voice and settings are the same (`vo/<id>.key`).
  Before, a changed line kept its old audio unless the mp3 was deleted by hand.
- **Real word times** (`timeline.py`): each finished line is listened to (faster-whisper, offline, `vo/align.json`) and every
  caption word that was heard is pinned to the moment it is said. Before, word times were guessed from letter counts
  (0.2 s off on average, up to 0.7 s). No whisper on the machine = the old guess, with a note.
- **Cues** (both engines + `timeline.py`): matching ignores accents and punctuation ("GALÁN", "SO:", "31." now match), and a
  cue that is not found prints `CUE NOT FOUND` once, not silently firing at the start of the line.
- **Numbers**: the voice rounds like the screen (80.5 is 81 in both); ordinals past 100 ("101st"); "Three times." for three places.
- **Render** (`render.cjs`): a page error or a failed ffmpeg ends with an error, not a quiet broken video.
- **Method v2.1** (`model/finder_model.py`, same in the Twin Finder page): a player who is on FotMob's main lists but not on a
  count list (pens won, big chances missed, blocks, ball won high up, shots on target, big chances made) has a real 0 there,
  not "no data"; a season with no xG at all no longer counts as minutes with 0 xG; a keeper with no position on file is a
  keeper. Checked on Kane, Salah, Haaland, Neymar, Palmer, Van Dijk, Hall: every twin stays the same, % moves 2 points at most.
- **Not changed, Mikey's call**: FotMob position ids 104/106 (the two of a front two, e.g. Lautaro Martínez) count as
  "10s and wingers". Moving them to strikers changes Kane 25/26's twin from Mbappé to Mika Biereth and makes Neymar 17/18 a striker.
- **Still open** (from the review): players are matched by name, not id (two players with one name would merge); short names
  are the last word ("Bruyne"); no league-strength adjustment (a Ligue 1 number counts the same as a Premier League one);
  `make_episode.py` only works for attackers and full-backs; the two makers share copied helpers.
