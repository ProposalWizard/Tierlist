# Reaching the hard match situations in both apps (for playtesters)

Written 21 Nov 2026 by the match loop, which was stopped in the set-up of its first round.
Each line says how I know: **ran** (I did it and it worked), **code** (read in the source, not tried).

## Three apps on one bench

`live.mjs` now opens three apps (`open {app: "packed" | "next" | "dev"}`):

| app | what | how it is served |
|---|---|---|
| `packed` | the packed app, `mobile/www` (the reference; its test hook is compiled out) | by live.mjs |
| `next` | KIB Next's web build, `phone/tools/look/out/web` (`node phone/tools/look/build-web.mjs`, ~3.5 min, 76 MB) | by live.mjs |
| `dev` | the website itself in dev mode: the packed app's own code with `window.__starMatch` on | you start it (below); live.mjs opens `PT_DEV_URL` (default `http://localhost:3100`) + `/road-to-the-golden-ball` |

Start the website in dev mode (**ran**): from the repo root or a worktree with `node_modules` linked,
copy `.env.local` from the main checkout (git-ignored), then `npx next dev -p 3100`.
Use `npx next dev`, not `npm run dev`: `npm run dev` first rewrites two tracked files.
`/star-dev` redirects to `/road-to-the-golden-ball`; the first load compiles for ~60 s; `.next` grows to ~340 MB (delete it after).
The `dev` page takes the packed save (same localStorage keys), signed-out: the look-check career loaded and reached the bench at 53' (**ran**).

New in live.mjs (**ran**): `open {saveFile: "<file>"}` loads any `{packed, next}` save (from `make-save.mts`,
`save-from.mts`, `make-season-end.mts`, `make-career-states.mts`); `run {name, js}` runs an async function body in the
bench process with `(page, e, H, MEDIA)`; stills from `shot`, `burst`, `steps` are now `.jpg` (the disk is small).
Give live.mjs its own `--port`: 7791, 7795 and 7801 were taken by other benches on 21 Nov.

Known trap (**ran**): a walk-to-the-chance loop that presses "Skip"/"Tap to skip" and then waits for
`GET OUT THERE` did not get past the bench in either app in 400 s. Press `GET OUT THERE` by its own button and check the phase after.

## The same match in both apps

The match seed is `career.season * 1000 + career.week` (**code**: app/star-dev/page.tsx, phone/src/match/setup.ts).
The same save and the same inputs give the same hidden match in both apps (`tools/match-parity.ts` checks this headless).
So a situation that comes from the hidden match (red card, injury, a penalty won, a corner, a substitution) can be
found once, headless, by seed, and then loaded in all three apps with a save at that week
(`make-season-end.mts --left N` gives a later week of season 1). Not done yet: nobody has scanned the seeds.

## Hooks

Dev website, `window.__starMatch` (**code**: components/star/CanvasMatch.tsx ~6370; dev mode only):
- `phase()`, `kind()`, `ball()` and `goal()` (places on the glass), `frame()` (camera and every man), `leadIn()`, `header()`, `aerial()`, `playOn()`
- `setBall({x,y,z,vx,vy,vz,spin,shot})` while the ball is in flight: send a real strike into the net. This is the way to see
  **your own goal** (the GOAL board and what follows) in the website's code; the packed build cannot do it.
- `dribble()` while a chance waits (phase `aim`): starts the in-match top-down dribble.
- `banner(text)`: shows any pop-up word now (SAVED, OFFSIDE, GOAL...).
- There is **no** hook that forces a kind of chance (penalty, corner, free kick). Use a seed that serves one.
- `window.__frameStep` is for 3D screens only. To step time in a match, use the bench: `open {clock: true}`, `clock pause`, `steps`.

KIB Next web build, `window.__kibMatch` = the live `MatchDriver` (**code**: phone/src/match/driver.ts, debugHook.web.ts):
- read: `phase`, `sc.kind`, `matchMinute`, `userScore`, `oppScore`, `pause`, `queue`, `ball`, `shootout`, `td`
- force the next chance's kind: set `__kibMatch.setPieceNext = "penalty" | "corner" | "freeKick"` before the chance loads
  (loadScenario reads it once). **code**, not tried.
- a goal: move `__kibMatch.ball` (pos, vel, z, vz) in flight, as `setBall` does on the website. **code**, not tried.
- `window.__kibNav` opens any screen by name (`?screen=<name>&params=<json>` too).

## Situation by situation

| situation | dev website | KIB Next | status |
|---|---|---|---|
| your own goal, GOAL board | `setBall` into the net in flight | set `ball` in flight | code |
| in-match dribble | `dribble()` at `aim` | a seed whose request has `dribble`, or call the private `startTopDownDribble` path through a request | code |
| penalty / corner / free kick in a match | a seed that serves it | `setPieceNext`, or the same seed | code |
| shootout | the look-check save's first match is the Community Shield (one-off, level = penalties); do not score | same save | earlier rounds saw the shootout this way |
| half time, added time, substitutions | play on at ×8 from the bench | same | half time seen in earlier rounds |
| red card, injury, extra time, captain orders | need a seed scan (and a captain save: `career.captain = true` through `save-from.mts`) | same save | not done |
| international | needs a save in an international break with a call-up; none of the save tools makes one yet | same | not done |
| through pass, run after pass, lay-back | open-play pass with a goal in the picture (any chance); `playOn()` reads the run | `playOn` on the driver | code |
