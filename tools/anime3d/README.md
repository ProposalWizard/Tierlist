# Anime goal — look test (Mikey, 8 Oct 2026)

"how this could look": a Blue Lock style replay (the Kunigami goal) of one
REAL recorded goal. Made in Blender, not in the game yet. If it is a go, the
game version would replay the same recordings the goal videos use
(`lib/star/goalClip/`) with these shots and effects.

What it does:
- `dump_track.mts` turns a goal recording (`tests/star/fixtures/goalClips/*.json`)
  into one frame per 1/30 s: ball, every player, the keeper's dive.
- `render_goal.py` (Blender) poses every man from that recording: positions,
  facing, a run cycle, the kick (body moved so the boot meets the ball), the
  keeper's dive. Flat two-tone anime shading, ink outlines, a white arena.
  Six shots: wide, hero (low, from in front), impact close-up, white-out
  follow-through, from inside the net, top-down.
- `post.py` adds the effects: white-out with speed lines, the impact frame,
  the name card, the GOAL card; writes `anime-goal.mp4` and stills.

```bash
S=<scratch>; T=$S/ovt   # glTF tools as in tools/ovation3d/README.md
node tools/ovation3d/unpack.mjs public/star/onebody/player.glb $T/player.glb --tools=$T
npx tsx tools/anime3d/dump_track.mts $S          # writes lay-off/scramble .track.json
blender -b --python tools/anime3d/render_goal.py -- $T $S/lay-off.track.json $S/out [--test]
python3 tools/anime3d/post.py $S/out
```

About 2 s a frame on the cloud machine (Cycles, CPU, 6 samples, emission
only); the 8 s clip is 191 frames, about 7 minutes.

Honest gaps: the recording jumps the ball 3 m onto the scorer's foot on the
frame he takes it; the script bridges that with a smooth flight. Team
colours are anime-style stand-ins (red bibs / white), not the real kits.
Faces are the 3D body's own, not drawn anime close-ups.
