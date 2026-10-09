# Baked light for the 3D sets (`tools/bake3d`)

Look H's sets get their light worked out once, offline, so a phone only reads it.
For every point it stores three numbers, per time of day:

| Number | What it is | What you see |
|---|---|---|
| sky | how much open sky the point sees | shade under roofs, in corners, at the foot of walls and boards |
| sun | does the sun (night: the main lamp bank) reach it | the stands' and roofs' shadows over the WHOLE bowl, soft edged |
| bounce | light thrown back off lit stands, walls, grass | a warm lift near sunlit walls |

Two grids carry them: the **floor** (the ground from above, 0.25 m a point in the
stadium) and the **volume** (the air of the set, 1.5 m × 1 m × 1.5 m). People and
the ball read the volume where they stand, so they go into shade with the set.
Read in the game by `lib/star/look/bakedLight.ts` (one more texture read per pixel,
kept on Low quality).

## Steps (re-run after the set's shape changes)
```bash
# 1. catch the set's still triangles from the live scene (a dev server running)
node tools/bake3d/capture.mjs "http://localhost:PORT/star-style-dev?style=real&scene=play3d&tod=day&clean=1" \
  --out /abs/cap/stadium.json --wait "window.__styleReady === true && window.__frameStep"
# 2. bake (Blender 4, headless; ~7 min for the stadium on 4 cores)
blender -b --python tools/bake3d/bake_light.py -- /abs/cap/stadium.json tools/bake3d/sets/stadium.json /abs/bake/stadium
# 3. pack into the game's files
python3 tools/bake3d/pack.py /abs/bake/stadium public/star/bake/stadium
```
Set files (`sets/*.json`): the grid sizes, the suns (from the scene's own light
data) and the sky-to-sun light ratio. `aoRadius` > 0 makes it an indoor bake
(only things within that many metres shade; no sun).

## How it is worked out
Blender's ray engine (`mathutils.bvhtree`) on the captured triangles, plus a
grass plane at y = 0. Per point: 96 rays over the sky (sky share), 4 rays across
the sun's disc (soft shadow), and for every ray that hits a surface, that
surface's own light (sun on it, its share of sky) times its colour — one bounce.
Points inside solid walls are refilled from their open neighbours (`pack.py`),
so a wall never reads the dark inside of itself.

Left out of the bake (they move, or light passes through): people, the ball,
nets, glass, light shafts, the sky dome.

## Limits
- One bounce, not many; good enough for stands and walls, a touch dark deep under roofs.
- The volume is 1.5 m a cell: a shadow edge on a far stand is soft over ~1.5 m.
- If the stadium's shape changes (arena.ts), re-run the three steps. A stale bake
  still looks plausible (it fades to "no bake" outside its box) but its shadows
  will sit where the old shapes were.
