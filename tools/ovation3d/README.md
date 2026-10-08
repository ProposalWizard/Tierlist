# The ovation's greetings, made in Blender

Mikey, 8 Oct 2026: the farewell's 3D standing ovation should have real hugs
and dap-ups. `author_greetings.py` builds them in Blender with BOTH men in
the scene, so every hand is put on the other man's real body:

| Clip | What |
|------|------|
| `hug-a` / `hug-b` | both arms round each other (left high, right low), a squeeze, two pats |
| `dap-a` / `dap-b` | right hands clasp and shake, the pull-in, right shoulders meet, a slap on the back |
| `pat-a` / `pat-b` | you: a hand on his shoulder, two pats. Him: a nod, his hand on his heart |
| `clap-chest` | a clap at the chest, loops (everyone on the pitch) |
| `clap-high` | hands above the head to the stands, loops (you) |

The file also says where he stands every frame (scene extras `greet`), so the
game stands the two men exactly where they stood in Blender.

The game plays it in `lib/star/ovation3d.ts`. Settings → Look → "Ovation
greetings: Old" (`lib/star/ovationMoves.ts`) is the first version, posed live.

## Rebuild

Blender 4.0 and numpy (`apt-get install -y blender python3-numpy`; put both in
the cloud environment's setup script), node, and the glTF tools:

```bash
T=/tmp/ovation && mkdir -p $T && (cd $T && npm i @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer draco3dgltf sharp)
node tools/ovation3d/unpack.mjs public/star/onebody/player.glb $T/player.glb --tools=$T
node tools/ovation3d/unpack.mjs public/star/people3d/anims.glb $T/anims.glb --tools=$T
blender -b --python tools/ovation3d/author_greetings.py -- $T public/star/ovation3d/greetings.glb $T/renders
node scripts/perf3d/shrink-models.mjs --tools=$T star/ovation3d/greetings.glb
```

`unpack.mjs` undoes the game's packing so Blender can read the body (it also
fixes the bind matrices, which were made for the 16-bit positions; without
that Blender draws a flat sliver). The third argument to the Blender script
is optional: stills of each move from four sides (Cycles, CPU).

It prints, for each move, how far each palm is from the other man's body and
how deep any arm goes into him. Built 8 Oct 2026: hug palms 33–89 mm off his
back (median 45), deepest arm 54 mm; pat 30 mm, 0 mm deep.

Gotcha found building it: the glTF importer leaves armatures in quaternion
rotation mode, so setting `rotation_euler` does nothing. The script sets
`rotation_mode = "XYZ"` and checks the two men face each other.
