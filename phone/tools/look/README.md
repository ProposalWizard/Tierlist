# The look check: packed app | KIB Next, side by side

Mikey, 19 Nov 2026: "the game looks very different … the packed app version is
really what you should be aiming to get … you should just compare it with that".
This folder puts both apps on one sheet per screen, so every builder can SEE
the gap before and after a change.

- **Packed app**: `mobile/www` (the website's own screens inside an app). The reference.
- **KIB Next**: `phone/`, built for a browser with Expo web (react-native-web).

Both open in Chromium at 390×844, deviceScaleFactor 1, with the same career.

## Run it

```bash
# from the repo root (or a worktree with phone/node_modules and node_modules linked)
node phone/tools/look/compare.mjs --build            # build KIB Next for the web (~3.5 min), then shoot everything (~8 min)
node phone/tools/look/compare.mjs                    # reuse the last web build
node phone/tools/look/compare.mjs --only home,shop   # just these screens (ids below)
node phone/tools/look/compare.mjs --packed /path/to/mobile/www --out /tmp/look
```

Needs: Playwright + Chromium (the repo's `node_modules/playwright`), `npx tsx`,
the packed app's built files (`mobile/www`, see `mobile/README.md`; a worktree
finds the main checkout's), and the packed data (`mobile/packed`, which the
phone bundle reads through `phone/scripts/data-pack.js`). The first `--build`
also fetches the Roboto font once (`npm pack @expo-google-fonts/roboto`).

Out (all in `phone/tools/look/out/`, git-ignored):

| File | What |
|---|---|
| `sheets/<nn>-<screen>.png` | packed (left) and KIB Next (right), with the screen's name |
| `contact.png` | every pair on one page |
| `shots/<screen>-packed.png`, `shots/<screen>-next.png` | the raw screenshots |
| `report.json` | per screen: reached or not, page errors |
| `web/` | KIB Next's web build (`build-web.mjs`) |

What looks different is written up in `DIFFERENCES.md` (redo it after a look change).

The match's drawing cost, headless (the phone's own drawing code on CanvasKit):
`cd phone && npx tsx tools/match-frame.ts` (a whole match, per frame) and
`npx tsx tools/look/ground-bench.ts [--png DIR]` (the grass, lines and goal alone).

## The screens

`title`, `new-career-1` (details), `new-career-2` (style), `new-career-photo`
(your photo), `trial-howto`, `trial-aim`, `strike` (the "where do you strike it?"
screen, reached by pulling back from the trial's free kick), `home`, `stats`,
`league`, `phone`, `shop`, `star-pass`, `transfers` (the summer window), `pre-match`
(Play pressed), `match-feed` (on the bench), `match-pitch` (your chance, after the
build-up), `post-match` (the match simmed). Round 2 added `phone-social`,
`phone-squad`, `phone-fixtures`, `phone-messages` (the phone's apps), `sponsors`,
`store`, `owner` (each opened from the phone), `investments` (Owner → browse
clubs), `shop-3` (3 items on screen), `shop-sheet` (an item's sheet).

To add one: a line in `SCENES` in `compare.mjs` with how to reach it in each app
(`null` for an app that has no such screen).

## How each app is driven

- **The career**: `make-save.mts` makes one fresh Premier League career at
  Arsenal (every screen open, no tour) and writes it in each app's own storage:
  the packed app's `star-career-v2::anon` (lib/star/storage.ts), KIB Next's
  `knowitball-career\career-v2` (react-native-mmkv keeps `<id>\<key>` in
  localStorage on the web). Both fill in the real squads from the same packed
  files when they load it. Each screen starts from a fresh page with this save.
  The transfer window in the packed app: the same save plus the saved phase
  `season-transfer`.
- **Packed app**: by its own buttons (and a swipe to Stats).
- **KIB Next**: Continue on the title (loads the squads, as on the phone), then
  `window.__kibNav` (only in the web build, `src/nav.web.tsx`) opens a screen by
  name; `?screen=<name>&params=<json>` in the address does the same at start.
- **Matches**: the ball is found on the screenshot (a small round light-grey
  blob) before pulling back from it.

## The web build of KIB Next (web-only files; the Android app does not read them)

| File | Why |
|---|---|
| `src/Boot.web.tsx` | loads Skia for the web (CanvasKit, `canvaskit.wasm`) and Roboto before the app; adds `Image.resolveAssetSource` (react-native-web has none: sprite sheets, packed photos and badges use it) |
| `src/nav.web.tsx` | the same screen stack, plus `window.__kibNav` and `?screen=` |
| `src/draw/offscreen.web.ts` | drawings made off screen use Skia canvases, as on the phone (a browser's real `document` made browser canvases Skia can't draw) |
| `src/three/HomePlayer3D.web.tsx` | the 3D player does not start in a browser: Home and the title show the drawn figure (what the phone shows when 3D can't start) |
| `src/web/skia.tsx`, `src/web/fonts.ts` | `metro.config.js` sends the app's Skia imports here **for web only**: a style list on a Canvas is flattened; SVGs are scaled into their box; offscreen surfaces are plain (a browser allows 16 WebGL canvases); small canvases are drawn once; `matchFont` finds Roboto |

`metro.config.js`: one added rule, `platform === "web"` only. `package.json`:
`react-dom`, `react-native-web`, `@expo/metro-runtime` (web-only packages; no native code).

## Known limits of the KIB Next side (it is a browser, not the phone)

- No 3D: your player on Home/title is the drawn figure, not the 3D one the phone shows.
- Fonts: Roboto (Android's own) for words; emoji are the browser's (Noto), not Android's.
- Skia in a browser is close to the phone's, not identical (blur, shadows, SVG detail).
- Random parts differ between the apps on purpose (a free kick's distance, which
  chance comes in the match): compare the look, not the numbers.
