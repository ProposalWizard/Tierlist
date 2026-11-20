# Toon hair and new head shapes (20 Nov 2026)

Harry: "I think still more hairstyles, dreads are common in football, try and model new head
shapes and hair." Toon style kept (RUL-3D-009); hair follows heritage (RUL-3D-010).

## What is here

| File | What it does |
|------|--------------|
| `dump_head.mjs` | A packed Style A head file → plain arrays (positions, UVs, bone weights, mask) for the two tools below |
| `build_hair.py` | Blender, headless. Models the 15 hairstyles on a head's own scalp and writes one GLB each |
| `reshape_heads.mjs` | Re-shapes a hair head into the four new head shapes (and paints the older face's lines) |
| `build.sh` | Dump both hair heads, build every hair, copy to `public/star/people3d/hair/`, pack |
| `hair-h3.json`, `hair-m2.json` | Triangles and clearance of the last build |

## The hair

15 styles: short locs, shoulder locs, locs tied up, short afro, high-top, twists, braids, curly top,
crew cut, slick back, tied back, man bun, mullet, thinning, receding. Each is built on the scalp of a
close-cut head ("h3" Buzz & beard for the kit heads, "m2" Fade & beard for the suit heads): a cap that
follows the scalp from the head's own hairline (read off its mask), tapered tubes that fall under
gravity and rest on the head (locs, braids, twists), blobs (curls, buns). The head's own buzz stays
under it and reads as the fade; thinning and receding paint it as skin (`TOON_HAIR_INFO.scalp`).

Every vertex carries the bone weights of the scalp under it (a strand: of its root), so the hair is
skinned on the wearer's own skeleton and bends exactly as his head does (the toon heads blend head and
neck weights right up to the brow, so a rigid hat would lift off).

Nothing goes into the head: the build lifts any triangle that crosses it and prints, per style,
`crossing 0` and the least distance (0.4 mm or more). Check a head against a built set:

```bash
S=<scratch>; GT=<dir with @gltf-transform/core@4 functions extensions meshoptimizer sharp>
tools/hair3d/build.sh $S $GT                 # all 30 files (15 styles x 2 heads), packed
tools/hair3d/build.sh $S $GT locsLong afro   # only these styles
node tools/hair3d/dump_head.mjs public/star/people3d/toon-p8.glb $S/h8 --tools=$GT
blender -b --python tools/hair3d/build_hair.py -- --check $S/h8 $S/out h3 0.014   # the long face: the hair sits 14 mm higher
```

In the game: `lib/star/style3d/toon/hairStyles.ts` (the list, which hair texture each suits, which
head wears which set) and `lib/star/style3d/toon/hair.ts` (`wearToonHair(T, loader, person, "locsLong")`).
A new style: a function in `build_hair.py` + a line in `STYLES`, a line in `TOON_HAIR_INFO`, then
`build.sh` (the POLICY for `star/people3d/hair/*.glb` is already in `scripts/perf3d/shrink-models.mjs`).

## The head shapes

`h7` Broad jaw, `h8` Long face, `h9` Round face (from Buzz & beard), `m3` Older, lined (from the suit
head Fade & beard). One smooth rule moves the head's vertices; the skull above the ears and the back of
the head stay where they are, so the hair above still fits (the long face lifts the skull 14 mm:
`TOON_HAIR_LIFT`). Skeleton, weights, UVs, picture and mask are kept, so kit, skin tones, haircuts and
the moving face work as on the base head.

```bash
node tools/hair3d/reshape_heads.mjs --tools=$GT          # writes public/star/people3d/toon-p7|p8|p9|mgr3.glb (unpacked)
node scripts/perf3d/shrink-models.mjs --tools=$GT star/people3d/toon-p7.glb star/people3d/toon-p8.glb star/people3d/toon-p9.glb star/people3d/toon-mgr3.glb
```
It prints each head's line for `lib/star/style3d/toon/faceLandmarks.ts` (the base head's measured
spots moved by the same rule). Paste them in after a change. `scripts/bench3d/faces.mjs --write`
measures only the game's eight heads and would drop these four lines: put them back after it.

Change a shape and the hair check above must be run again for that head.

## Where they are used

Only the people presets (`lib/star/people/presets.ts`): 72 player looks and 60 staff looks, hair by
heritage (test: `tests/star/peoplePresets.mts`). The new heads are NOT in the game's seeded pools
(`TOON_PLAYER_HEADS`, `TOON_SUIT_HEADS`), so nobody in the game changes.

See them: `/star-3d-bench-dev/people?set=hair` (`&styles=…&base=h3|m2|h7|h8|h9|m3&views=front,34,back,side`),
`?set=heads`, `?set=staff`, `?set=players`; stills: `node scripts/bench3d/people-sheet.mjs OUTDIR "hair&styles=afro::name" heads staff players`.

## Known limits

- Hair has no physics: long locs, braids, the ponytail and the mullet's back turn with the head as one piece.
- A person rebuilt to other proportions (`?prop=`, test pages) wears no modelled hair (`addToonHair` returns null).
- Not yet wired into the match, Home, or your own player (Settings → Your look): presets only.
