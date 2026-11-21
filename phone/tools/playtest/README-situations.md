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


## WORLD (League, Phone, Shop, Store, Sponsors, Star Pass, Settings, Hall of Fame)

### Start both apps

```bash
node phone/tools/playtest/drive.mjs --port 7801 --w 412 --h 915 --shots <dir> &
PT_PORT=7801 node phone/tools/playtest/cmd.mjs '<js>'     # P = packed page, N = KIB Next page
```

### Saves (each prints `{ packed: {...}, next: {...} }` of localStorage keys)

| State | Command |
|---|---|
| Fresh Arsenal career, every screen open, no tours | `npx tsx phone/tools/look/make-save.mts > fresh.json` |
| 30 matches in (results, table, cups under way) | `npx tsx phone/tools/playtest/make-season-end.mts --left 20 > mid.json` |
| Late season: Champions League bracket, three cups, ★500k | `npx tsx phone/tools/playtest/make-season-end.mts --left 6 > late.json` |
| One match from the end (season review after it) | `npx tsx phone/tools/playtest/make-season-end.mts --left 1 > last.json` |
| Season over, retirement due, youth, free agent, trial | `npx tsx phone/tools/playtest/make-career-states.mts <state>` (states in its header) |
| Any career JSON (a poor save, a lower-league save with a full feed) | `npx tsx phone/tools/playtest/save-from.mts career.json [--no-tour] > s.json` |

A poor save (cannot-afford state, the save-up box): take `fresh.json`'s career, set `money` to 0, run it through `save-from.mts`.
First-visit tours (League, Phone, Shop, Sponsors): use `save-from.mts` WITHOUT `--no-tour` on a career whose `unlocks` is kept.
The simulated saves have no named scorers ("No named players here yet."): play matches for real names.

### Load a save into both (never by reload on the game page: the packed app saves its old career over it on unload)

```js
const sv = JSON.parse(fs.readFileSync("<file>","utf8"));
await P.goto(urls.packed+"/404.html",{waitUntil:"load"});
await P.evaluate((kv)=>{localStorage.clear(); for (const [k,v] of Object.entries(kv)) localStorage.setItem(k,v);}, sv.packed);
await P.goto(urls.packed+"/",{waitUntil:"load"});
await N.goto(urls.next+"/",{waitUntil:"load"});
await N.evaluate((kv)=>{localStorage.clear(); for (const [k,v] of Object.entries(kv)) localStorage.setItem(k,v);}, sv.next);
await N.goto(urls.next+"/",{waitUntil:"load"}); await wait(4000);
await click(N,/CONTINUE/); await wait(2500);            // KIB Next starts on the title
```
The packed app may open on Stats, not Home: press a bottom-bar button.

### Open a world screen

- Both: the bottom bar (`click(p, /League$/, {last:true})`, Phone, …).
- KIB Next only: `await N.evaluate(() => window.__kibNav.go("shop", {cat:"boots"}))`. Names and params: the header of `phone/src/areas/world.tsx`
  (`phone`, `feed`, `shop`, `sponsors`, `star-pass`, `transfers`, `cup-draw {competition, round}`, `season-review`, `store`, `investments`,
  `ownership`, `reputation`, `rule-book`, `locker`, `vote-ceremony {vote}`, `hall-of-fame`).
- Packed: Shop is a swipe or the ▶ SHOP pill on Home; Store and Sponsors are in the Shop's ⋯ menu and on the Phone; Star Pass is the star top left.
- The League's chooser: press "Change ▾"; close it in packed with `P.locator("[data-world-chooser] button").first().click()`.
- Cup draw reveal: in the packed app it shows after a cup match when the next round is drawn (play or sim the tie from `late.json`);
  in KIB Next `__kibNav.go("cup-draw", {competition:"FA Cup", round:"<name>"})` (`src/world/cupDraw.ts drawToShow`).
- Season review: after the last match of `last.json`, or the League chooser's "📜 Last season" in season 2.
- Vote ceremony and boardroom: need a club stake; buy one in Investments on `late.json` (★500k), then Owner app.

### Measuring a screen (numbers, not eyes)

Both apps are web pages here, so every text's box, font size, weight, colour and every box's size, padding,
radius, background and shadow can be read from the page (`getComputedStyle`, `getBoundingClientRect`) and compared.
Two traps:

1. **The packed page's body font is not Roboto in desktop Chromium** (it is on Android). Before measuring, add to the
   packed page an `@font-face` for Roboto (the files are in the web build's `/fonts/`, served to the packed page with
   `P.context().route("**/kibfonts/*", …)`) and `html,body{font-family:"KRoboto",sans-serif !important}`. Without it
   every width and line height is a false difference.
2. Text hidden under a full-screen sheet is still in the page: skip any text whose centre is not the top element
   (`document.elementFromPoint`).

Match texts by their words, then compare position, size, weight, colour, font family and letter-spacing.
"Anton in packed, body font in KIB" is a real difference (see WORLD-LOOP.md, the rule for every screen).
