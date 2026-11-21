# Reaching hard-to-reach situations in both apps (for playtesters)

## CAREER (career fixer, 21 Nov 2026)

### The bench (both apps side by side, measured)

```bash
node phone/tools/look/build-web.mjs                      # KIB Next for a browser (~4 min) → phone/tools/look/out/web
# Roboto for the PACKED app too (else its words are 4-8 % wider than on a phone and every width differs):
B=phone/tools/playtest/bench; mkdir -p $B/fonts; cp phone/tools/look/out/web/fonts/*.ttf $B/fonts/
#   edit $B/fonts.conf: its <dir> and <cachedir> must be absolute paths to $B/fonts and $B/fccache
FONTCONFIG_FILE=$PWD/$B/fonts.conf node phone/tools/playtest/drive.mjs --port 7811 --shots /tmp/shots --fresh &
PT_PORT=7811 node phone/tools/playtest/cmd.mjs "return await text(N, 300)"     # P = packed page, N = KIB Next page
```

- **Word-by-word difference** (position, width, font size, lines, colour, weight, Anton or not, clipped, off screen):
  `PT_PORT=7811 node phone/tools/playtest/cmd.mjs "const TOL=4; $(cat phone/tools/playtest/bench/diff.js)"`
- **One element's boxes** (padding, margin, font/line height, spacing, radius, up the tree):
  `... cmd.mjs "const TXT='Free kicks'; const DEPTH=3; const COL=0; $(cat phone/tools/playtest/bench/insp.js)"`
  (COL=1 adds colours, backgrounds, shadows).
- Sizes: `cmd.mjs "return await size(360,780)"`, then `size(360,640)`.

### Loading a save into both apps

Make the state file (prints `{ packed: {key: value}, next: {key: value} }`), then put it in each app's storage.
**Packed: write storage from `/404.html`, then open `/`** (a reload of the game page writes its own save back first).
KIB Next opens on its title: press CONTINUE.

```js
// body for cmd.mjs; FILE = the state file
const st = JSON.parse(fs.readFileSync(FILE, 'utf8').trim().split('\n').pop());
const put = (kv) => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); };
await P.goto(urls.packed + '/404.html'); await P.evaluate(put, st.packed); await P.goto(urls.packed + '/');
await N.goto(urls.next + '/'); await N.evaluate(put, st.next); await N.goto(urls.next + '/');
await wait(4000); await click(N, '^.?\\s*CONTINUE');
```

To change a career before loading, JSON.parse each value, edit the object that has `player` and `skills`, stringify back.

### State files

| Situation | Command | Opens on |
|---|---|---|
| Brand-new game | `drive.mjs --fresh` (empty storage) | packed: "Who are you?"; KIB: title → NEW GAME |
| Any Home screen, every screen open, no tours | `npx tsx phone/tools/look/make-save.mts` | Arsenal, season 1, Home |
| Trial, last stage left (then "A scout has spotted you") | `npx tsx phone/tools/playtest/make-career-states.mts trial-last` | the free kick; one strike ends the trial |
| Scout's talk → offer → signing → Breaking News → first Home, tours, story beats | `… make-career-states.mts trial-done` | scout's talk (tap "Tap to hear him out" ×3, ACCEPT & SIGN) |
| Free agent | `… make-career-states.mts free-agent` | the free-agent life |
| Youth team | `… make-career-states.mts youth` | youth page |
| End of Season, awards, international call-up declined | `… make-career-states.mts season-over` | Home with "End of Season" |
| Season before the last (Golden Ball night → final-season notice) | `… make-career-states.mts final-next` | End of Season |
| Last season: final whistle, farewell invite, sheets, guard of honour, farewell full time, overview, Hall of Fame | `… make-career-states.mts retire-due` | End of Season |
| N matches from the end of season 1 (cups, run-in, last-day table) | `npx tsx phone/tools/playtest/make-season-end.mts --left 3` | Home, mid run-in |
| Any career JSON (a soak's, an old 10+ season save) | `npx tsx phone/tools/playtest/save-from.mts career.json [--no-tour]` | wherever that career is |
| Transfer window (packed) | make-save.mts output plus the packed saved phase `season-transfer` (see `phone/tools/look/compare.mjs`, scene `transfers`) | the window list |

A long career for save-from.mts: `npx tsx scripts/soak/careerSoak.mts 12` plays seasons; write its career out as JSON.

### Not built yet (a playtester or fixer must make these)

No state file exists for: an international break in progress (called up), a renewal offer from a club that will
talk (the test saves' clubs refuse), a loan, promotion/relegation and a play-off bracket, a cup final win, a
long-term injury, low energy before a match, "Boss wants a word", the set-piece talk, the Unlocked pop-up,
"New in your game", watched-on-TV, record banners, ScoutOffers (several clubs after the trial), share picture.
The way to make each: load a state above with a patch on the career object (for example `c.energy = 20`,
`c.injury = {...}`, `c.unlocks`, `c.contract.yearsLeft = 1`) using the field names in `lib/star/types.ts`,
or add a state to `make-career-states.mts`. Check both apps accept it (page errors: `cmd.mjs "return errs()"`).

### Driving tips

- `click(P, 'regex')` presses a button by its words; `tap(p, x, y)` a touch; `buttons(p)` lists what can be pressed.
- KIB Next only: `await N.evaluate(() => window.__kibNav.go('career-settings'))` opens a screen by name.
- Text fields: `await p.locator('input').nth(0).fill('Maximilian')`.
- The trial stages and every match are played by `autoplay.mjs` / `to-fulltime.sh` (match part of this file).
