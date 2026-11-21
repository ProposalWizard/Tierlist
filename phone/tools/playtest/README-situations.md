# Reaching hard-to-reach states in both apps (for playtesters)

Each fixer adds its part. Packed = `mobile/www`; KIB Next = its web build (`node phone/tools/look/build-web.mjs`, about 4 minutes, 70 MB).

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
