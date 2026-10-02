---
name: film-pass
description: How to run the before/after filming pass for a Knowitball patch-notes or review page quickly. Load BEFORE launching any filmer agent, before writing a filming driver script, and whenever a build round reaches "film before/after". Covers the built-server setup, the scene library, claims between filmers, deterministic outcomes, and which model films.
---

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

### 6. Make outcomes certain, not lucky
- A clip that must show a win (a shootout, a drill pass) uses a dev-only seed
  or flag that makes the result certain. Never retry a bot until it wins.
- Hide dev-only bars while filming (a `film=1` flag), so no "DEV: SKIP" strip
  shows in the clips. Real players never see it.

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
  Use the everyday model at medium effort (as CLAUDE.md says).
- The one place model strength helps: writing a NEW scene that works first time.
  If a round has many new screens, write those scenes on the top model, then
  hand the running and checking back to the everyday model.

## Before you report the pass done
- Every clip on the list has an `-after.mp4` and a `.jpg`. Every "before" has
  its pair.
- Open every still: on screen, readable, not mid-load, nothing covering it.
- Stop every server you started and remove the "before" worktree.
