# Filming the game for patch notes and reviews

**Standing rule (Harry, 1 Oct 2026):** every new thing on a patch-notes or
review page gets **a real video plus screenshots**, filmed like this, and it
has to be clear to read on a phone. Said after a page of 300-px GIFs, cropped
oddly, with no playhead and before/after squeezed side by side: *"why is the
framing off the videos so cooked and there no playhead … redo with real videos
and screenshots for every single element"*, then *"this should be standard."*

**Running a whole pass quickly:** read `.claude/skills/film-pass/SKILL.md`
first (built server, scene library, claims, certain outcomes).

## The recorder — `rec.mjs`
- `phone()` — a 390×844 phone at 2x, touch on, with a white dot wherever a
  finger taps or drags.
- `startRec(page)` / `stopRec(r, "out.mp4")` — a real MP4 (H.264, 720 px
  wide, 30 fps) of the **whole phone screen**. Never crop a clip.
- `shot(page, "out.jpg")` — the whole phone screen at 2x.
- `retime(in, out, 0.25)` — a 4x-speed copy for a long flow.
- `poster(in.mp4, out.jpg)` — a cover frame.
- `node scripts/film/selftest.mjs` checks it works in a new container.

## What to film — one entry per change
1. **Before** clip in the old game and **after** clip in the new one: same
   save, same taps. Something brand new films where it would be.
2. A **still of the key moment** for each (used as the clip's cover).
3. Extra stills when a change spans screens or a long scroll — never one
   giant tall screenshot, it shrinks unreadably.
4. A rule you can't see on one screen (a %, a timing) still gets a clip of
   it happening; a "shorter" flow gets the whole flow at 4x, before and after.
5. Clips: open on a still for half a second, 4–15 s (20 s max), no dead
   waiting, hold the result for a second. Under 3 MB each.
6. Small text gets a `-zoom.jpg` crop as well (at least 600 px wide).

Name files `NN-<slug>-before.mp4 / -after.mp4 / -before.jpg / -after.jpg`.
Open every still and a frame of every clip before using them: on screen,
readable, not mid-load, nothing covering it.

## How the page shows them
`.claude/skills/artifact-house-style/references/clip-card.html`: per change,
a Before/After switch on a phone (one full-width clip at a time, both side by
side on a wide screen), `<video controls playsinline muted preload="none">`
with the still as `poster`, and ½× / ¼× speed buttons (no slowed copies
needed). The admin patch-notes archive serves `.mp4` with byte ranges, so the
same page plays there too, iPhone included.

## Running an old and a new copy side by side
Old: `git worktree add --detach /dev/shm/before <commit>`, symlink
`node_modules`, copy `.env.local`, put `.next` in `/dev/shm`, `npx next dev -p
<port>`. New: the branch's own worktree on another port. One Next server is
about 2 GB of RAM; don't run more than four at once.

## Smooth video of a 3D scene on a machine with no graphics card — `frames3d.mjs`
(Harry, 9 Oct 2026: *"there HAS to be a way to get around no graphics card for
seeing cut scenes … break every still up into a full frame by frame action."*)

`rec.mjs` records in real time, and the 3D scenes here draw at 1–5 s per frame
(software WebGL), so a real-time clip stutters. `frames3d.mjs` freezes the
clock instead: for each frame it asks the page to be at **exactly** second `t`,
draws that one frame, screenshots it, steps 1/30 s, repeats. The frames are
joined into a smooth 30 fps MP4. Slow to make (about 1–2 s a frame here, so
about a minute for 2 s of film), perfect to watch.

```bash
# 1. a cut scene, full length (the page says how long it is)
node scripts/film/frames3d.mjs "http://localhost:PORT/star-style-dev?style=mix&scene=goal&clean=1" --out /abs/frames/goal
# 2. a scripted gameplay demo (dribble forward, shoot), 4 s
node scripts/film/frames3d.mjs "http://localhost:PORT/star-style-dev?style=mix&scene=play3d&demo=dribble-shoot&clean=1" --out /abs/frames/play
# 3. join into an MP4 + a contact sheet (every 6th frame, with times)
python3 scripts/film/frames3d_encode.py /abs/frames/goal /abs/out/goal.mp4 --every 6
```

Options (`--help` is this list): `--duration S` (default: the page's own),
`--fps 30`, `--size 390x844`, `--dsf 2`, `--from F --to F` (part of it),
`--shot page|canvas|<css selector>` (default: the whole phone screen),
`--timeline file.json` (scripted input, below), `--hide ".css,.selector"`,
`--png`. It is **resumable**: frames already on disk are skipped, so re-run the
same command after a crash. Progress and seconds-per-frame print as it goes.
The encoder takes `--width 720` (match `rec.mjs` clips), `--crf`, `--every`.
Look at the contact sheet before trusting the MP4: open it, check the motion is
continuous and nothing pops.

**The contract** (`lib/star/frameStep.ts`): any 3D screen can publish
`window.__frameStep = { duration, seek(t), timeline? }`. `seek(t)` moves the
screen to t seconds and draws once. That is all the tool needs.
- **Cut scenes** (Style Testing page, `scene=goal|signing`): `seek` stops the
  real-time loop and walks the clock to `t` in 1/60 s steps, so the crowd and
  sparks move the same every time; the pose is a pure function of `t`.
- **Gameplay** (the `play3d` World, `lib/star/play3d/scene.ts`): `controller.step(dt, draw)`
  runs the world, the animation and the camera for exactly `dt` and draws only
  if asked. `seek(t)` runs 1/60 s steps up to `t`, drawing the last one. It is
  a simulation, so it only runs **forward** (the tool does). Same seed + same
  input script = same match. Any screen built on `createPlay3DScene` (Play3D,
  `/star-training3d-dev`, Style Testing) gets a default `__frameStep` for free;
  pass `--duration` and `--timeline`. Style Testing adds `?demo=dribble-shoot`.
- **Scripted input** is a JSON array: `[{ "t": 0, "move": {"x":0,"y":-1}, "sprint": false }, { "t": 2.4, "act": {"kind":"shoot","dir":{"x":0.1,"y":-1},"pull":0.3} }]`.
  Pitch units: goal at y = 0, `-y` is towards the goal, you start ~30 m out.
- `?clean=1` on the Style Testing page hides its toolbar, hints and labels.

Real-time loop untouched: nothing here runs unless a tool calls `seek`/`step`.
