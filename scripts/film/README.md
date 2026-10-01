# Filming the game for patch notes and reviews

**Standing rule (Harry, 1 Oct 2026):** every new thing on a patch-notes or
review page gets **a real video plus screenshots**, filmed like this, and it
has to be clear to read on a phone. Said after a page of 300-px GIFs, cropped
oddly, with no playhead and before/after squeezed side by side: *"why is the
framing off the videos so cooked and there no playhead … redo with real videos
and screenshots for every single element"*, then *"this should be standard."*

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
