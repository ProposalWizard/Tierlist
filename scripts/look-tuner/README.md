# The look-tuner (`scripts/look-tuner`)

Turns Look H's dials until a game frame LOOKS like the benchmark broadcast
picture: same colours, brightness, contrast, grass and detail. Not the same
picture — the same style, on our own camera, kits and boards.

## Run it (one dev server)
```bash
export LOOK_BENCH=/abs/folder/with/the/benchmark/pictures   # NOT in the repo: they show real brands
node scripts/look-tuner/tune.mjs --url "http://localhost:PORT/star-style-dev?style=real&scene=play3d&tod=day&clean=1" \
  --tod day --iters 100 --out /abs/tune-day --write
```
About 2 s a try on this machine (software WebGL, 390 × 844). It writes:
`log.jsonl` (every try), `first.jpg` / `best.jpg`, `curve.png` (the score over
the tries), `best.json`; `--write` puts the winning dials into
`lib/star/look/tuned.ts` (that time of day only).

Stills only: `--render name='{"lut":0}'` (any dials) — used to make the LUT's
source frame. `--dsf 2` for full phone resolution.

## The dials (`lib/star/look/params.ts`)
exposure, contrast, sat, bloom, vignette, sun, env, hemi, grassGain, grassWarm,
lut, ao, shade, bounce, sharpen, blades, stripes — each a multiple of the look
as built (1 = unchanged), within a safe range. `rim` is set by eye (1.8, players
"pop off the pitch"): the score does not look at the players.

## The score (`score.py`, lower = closer)
| Part | Measures |
|---|---|
| hist | lightness and colour spread (quantiles, Lab) |
| hist3 | a 6×6×6 colour histogram |
| grass | grass lightness, colourfulness, never yellower than a 128° hue |
| tone | brightness, contrast (only "too flat" counts), colourfulness |
| detail | edge density |
| texture | fine light-dark detail inside the grass (only "too smooth" counts) |

Review overrides, written into the score so the tuner cannot undo them: the
reference grass READS cooler, deeper and less colourful than its pixels average
out to (9 Oct reviews), so the targets carry +4 lightness and ×0.8 grass colour.

## The broadcast grade (`tools/look/build_lut.py`)
A 32³ 3D LUT (`public/star/look/lut-<tod>.png`, a 1024 × 32 strip), the last
step of the broadcast pass (`lib/star/style3d/real/post.ts`). Built by
histogram-matching a game frame (LUT off) to the benchmark in Lab, grass to
grass and the rest to the rest, smoothed over the colour cube; colours the
frame never shows (kits, skin) only get the lightness curve. Then art
direction: no yellow added, greens kept cool, grass ×0.8 colour and its own
contrast stretched, an S-curve, deeper blacks, lifted mids, whites kept white
and a touch brighter, shadows never lifted. Golden hour and night use
`--mode tone` (the curve's shape only; they keep their own colours and level).
