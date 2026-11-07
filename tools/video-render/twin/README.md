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
