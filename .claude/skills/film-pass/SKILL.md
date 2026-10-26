---
name: film-pass
description: How to run the before/after filming pass for a Knowitball patch-notes or review page quickly. Load BEFORE launching any filmer agent, before writing a filming driver script, and whenever a build round reaches "film before/after". Covers the built-server setup, the scene library, claims between filmers, deterministic outcomes, and which model films.
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes.

> **Scope (Brain):** there is no before/after filming phase any more
> (FACT-ALL-002). Patch notes use stills; a short "after" clip is made only
> for gameplay or animation, after the page is shipped and the feature pushed
> (RUL-TEAM-005, PRO-TEAM-008). Never link the Vercel test build. Use the
> how-to below only for those clips.

# The filming pass, fast

Harry, 2 Oct 2026, after the v0.24 filming took longer than the build: *"is
there a way to make the filming far faster"*, then *"make them part of the
skill, there has to be more we can do?"*

What made v0.24 slow (measured from the filmers' own reports):
- The dev server compiled each page on first visit, so a page load took minutes.
- Builder dev servers stayed alive, the 15 GB machine ran out of memory, and the
  "before" filmer's server and Chrome were killed about 6 times.
- Bots played their way to each screen and kept failing (the shootout lost 3 of 3).
- The filmers wrote 150 throwaway driver scripts in the scratchpad (123 + 27).
  Next round those are gone and get written again.
- Clips were split once, at launch. When memory freed up, nobody picked up the slack.

The model was NOT the bottleneck. All three filmers ran on the everyday model.
The wall clock went to server compiles, memory crashes and bot retries.

## The rules

### 1. Film from a built copy, not the dev server
- After the merge, run `npm run build` once (about 5 minutes, about 4 GB while
  it builds). Then run `npx next start -p <port>`. Pages open in about a second.
- One built server serves ALL the filmers. Never one server per filmer.
- Do the "before" side the same way: a worktree of the base commit, built once,
  then `next start` on its own port.
- Put `.next` in `/dev/shm` when disk is tight (see `scripts/film/README.md`).
- Stop every builder's dev server before filming starts. Check with `ps` and free
  memory with `free -m`. Keep about 4 GB spare.

### 2. Film the "before" clips while the builders work
- The "before" side only needs the base commit, so start it when the builders
  start, not after the merge.
- Run it on a built copy (rule 1), with ONE filmer, so it uses little memory
  next to the builders.

### 3. Jump straight to each screen with a ready-made save
- Every clip opens on a seeded save and goes to the screen in one or two taps.
  No bot plays its way through the career to get there.
- Seeds and taps live in the scene library (rule 5), not in someone's head.
- If a screen can't be reached by a save alone, add a dev-only jump to the
  game, gated like `lib/star/devMode.ts`, so it can't reach the live site.

### 4. Share the clip list; whoever is free takes the next clip
- One list file: `<round>/film/LIST.txt`, one clip name per line.
- Claim before filming: if `<round>/film/claims/<name>` exists, skip that
  clip. If not, `touch` the claim and film it. Each filmer takes the next free
  clip from the list, so nobody runs a fixed share.
- When memory frees up (a builder or the other side finishes), launch another
  filmer straight away. Don't wait to be asked (Harry, 2 Oct: *"u shouldve
  automatically done that without me telling you when there is more
  bandwidth"*).
- Each filmer has one Chrome open at a time and closes it after each clip.

### 5. Keep the drivers: a scene library in the repo
- **Not built yet (2 Oct 2026).** The first round that uses this skill moves
  the v0.24 drivers (`scratchpad/v024/film/drv/`, `film/after/drv*/`) into
  the repo as the start of the library. Do that before filming anything new.
- Driver scripts go in `scripts/film/scenes/<name>.mjs`, committed, not in the
  scratchpad. One file per screen: the seed save, the taps, and the moment
  for the still.
- Next round, re-run the same scene on the new copy. Only new screens need a
  new scene. A renamed button means a one-line fix, not a new script.
- Shared helpers (open with a seed, jump to a trial stage, find the ball,
  bot strike) live in `scripts/film/scenes/lib.mjs`.

### 6. Film the game as it really plays: never fake the shot
Leo, 24 Oct 2026, on celebration clips where a test tool moved the ball onto
the goal line after the strike: *"it looks like the player shoots and the ball
immediately goes in … have you massively changed the game?"*
- NEVER move the ball, change its flight, or set the result in a clip
  (`__starMatch.setBall` and the like). The viewer can't tell a filming trick
  from a game change, so a faked shot reads as a broken game.
- A dev switch may only set up the SITUATION (which chance is served, the
  minute, the score), never the outcome. Say in the caption when one was used.
- If a clip needs a goal, take real shots until one really goes in, and film
  that one whole: before the strike, the full flight, the keeper, the net.
  Retrying for a real result is fine; faking it is not.
- If a clip deliberately replays one fixed strike (a weather comparison), the
  caption says so in plain words.

### 6b. Sound is part of the clip
Leo, 24 Oct 2026: *"why no sound? that's an important thing to hear to give
feedback for in patch notes."* Playwright's recordVideo is silent. Any clip
where sound matters (crowd, commentary, music, heartbeat, a sting) is filmed
with the audio tap (`scripts/film/scenes/audio-tap.mjs`) and muxed in as AAC.
You can't hear it here, so prove it: a loudness curve showing the peaks land
on the right moments (the net, the roar, the call). Say plainly if a clip has
no sound and why.
- Hide dev-only bars while filming (a `film=1` flag), so no "DEV: SKIP" strip
  shows in the clips. Real players never see it.

### 6c. Film the match frame by frame, never as a screen recording
Leo, 25 Oct 2026: the clips "look bad" and "the ball moves weird". Cause, measured: this
machine has no graphics card, so a real-time recording (Playwright recordVideo, the CDP
screencast) stalls. From the shot to the end of the camera pan after the scorer, chat 1's
knee slide, big moment and aeroplane clips have 14%, 15% and 17% of moving frames that are
an exact copy of the one before, then a jump (`scripts/film/smoothness.py`). The same
moments filmed frame by frame: 0%.
- Use `scripts/film/vclock.mjs`. It takes over the page's clock (performance.now,
  Date.now, requestAnimationFrame, timers, CSS animations): the game only moves when the
  script steps it, exactly 1/60 s a step, and every step is captured after a real repaint.
  No frame can repeat or drop, however slow the machine.
- Sound comes with it: the game's Web Audio context becomes an offline one on the same
  clock, so every sound sits on its exact frame and is rendered to a WAV at the end.
- `encode()` reads the frames as an exact 60 fps image sequence and keeps every 2nd for
  30 fps. Never join frames with an ffmpeg concat list of per-image durations: the
  rounding repeated 16% of frames in a clean capture (measured).
- Menus and loading run in real time; call `vStart` once the page is up. Between steps
  you can drag and tap as usual (step a frame or two between mouse moves).
- A real goal: `node scripts/film/scenes/vgoal.mjs <port> <knee-slide|aeroplane|big-moment|plain> <outDir> --seed seed.json`
  (real shots only, misses thrown away; about 1 goal in 13 shots on the seed save; about
  1-2 s of machine time per frame of film, so several clips at once is fine: the clock
  does not care how busy the machine is).
- Seed: `node scripts/film/scenes/celebrations.mjs <port> setup <outDir>`. The drivers drop
  the save's unlock list so first-hour tours and pop-ups stay out of the way.
- Check a clip: `python3 scripts/film/smoothness.py clip.mp4 --from S --to S` over a stretch
  where the picture moves every frame: stalls must be 0. Outside such a stretch the game's
  own slow animations (a celebration figure changes pose ~8 times a second) hold still
  legitimately; the vgoal driver also logs the ball every frame (`<clip>-ball.json`).
- Not for `<video>` elements (goal-video playback runs on its own clock): those clips stay
  screen recordings, with sound through `audio-tap.mjs`.

### 7. Run the scenes as one script; the agent only checks
- **Not built yet (2 Oct 2026):** `run-scenes.mjs` is written with the library
  (rule 5).
- `node scripts/film/run-scenes.mjs <port> <list>` films every scene in a row
  and writes the MP4s and stills. No model needs to watch each clip being
  recorded.
- A filmer agent only fixes a scene that fails, then opens the stills to
  check them. That is where its time should go.
- Don't poll with `sleep` loops. Run the script in the background and wait for it
  to finish.

### 8. Skip what didn't change
- If a screen didn't change between the base and the last round's "after", last
  round's "after" clip IS this round's "before". Copy it instead of filming it
  again.

### 9. Plan the hard clips before filming starts
- **Admin pages** redirect to sign-in on the test server, because it has no admin
  account. In v0.24 the Sound Board could not be filmed. Decide up front: stills
  from the builder, or Harry films it live. A test-only way round the admin
  check needs Harry's yes first.
- **One kind of highlight** (a tight angle, a give-and-go) cannot be waited for.
  In v0.24 two tries on a slow machine never served one. Use a dev-only seed
  that serves that kind first (rule 6).

## Which model
- Filming is mostly waiting for a browser, so a bigger model doesn't make it faster.
  Use the everyday model at medium effort (RUL-TEAM-014, RUL-TEAM-015, RUL-TEAM-016).
- The one place model strength helps: writing a NEW scene that works first time.
  If a round has many new screens, write those scenes on the top model, then
  hand the running and checking back to the everyday model.

## Before you report the pass done
- Every clip on the list has an `-after.mp4` and a `.jpg`. Every "before" has
  its pair.
- Open every still: on screen, readable, not mid-load, nothing covering it.
- Stop every server you started and remove the "before" worktree.
