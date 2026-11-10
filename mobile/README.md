# The packed phone app (Road to Ballon d'Or)

Mikey, 5 Nov 2026: the app is **only Road to Ballon d'Or**, with **everything
inside the download**. It plays with no signal, saves on the phone, has no
sign-in and no casino. The website is not changed by any of this.

Plan and checklist (for Mikey): https://claude.ai/artifact/1SM2hTVXv7mbNgTKZxxbb3

## How it is separate from the website

| | Website | Packed app |
|---|---|---|
| Built by | `npm run build` (Vercel) | `mobile/` scripts below |
| Pages | every `page.tsx` | only `app/page.app.tsx` + `app/layout.app.tsx` |
| Server, API routes, middleware | yes | none (plain files) |
| Players, badges, settings | the database, live | packed files (`/packed/`) |
| Saves | phone + account | phone only |
| Casino | yes | hidden |

- `next.config.mjs`: with `KIB_APP_BUILD=1` it returns a separate config
  (`output: "export"`, `pageExtensions: ["app.tsx", "app.ts"]`, into
  `.next-app/`). The website's build never sets it.
- `lib/app/packed.ts`: `PACKED_APP`, true only in the app build. Every
  app-only change is behind it, so on the website it is the constant `false`
  and the app code is removed from the website's build.
- `lib/app/offline.ts`: inside the app, answers the game's requests
  (`/api/star/league-squads`, `/api/draft/roster`, the settings routes, the
  `club_logos` and `custom_clubs` tables) and its pictures from the packed
  files. Online saving answers "no account". Other `/api/` calls answer
  "not available in the app" at once.

## Build it

Needs: Node 22, the repo's `npm install`, a running copy of the website for
the packing step (`npm run dev`, with `.env.local` holding the two public
Supabase values), and for Android: JDK 21 + the Android SDK (platform 36).

```bash
# 1. Pack the data and pictures (≈2 min): asks the running website for every
#    club's squad and the settings, downloads every photo/badge/flag, shrinks
#    them to WebP. Out: mobile/packed/ (≈25 MB). Not committed.
npm run dev &                     # the website, at :3000
npx tsx mobile/scripts/pack.mts --base http://localhost:3000

# 2. Build the app's files (≈3 min): the game alone, plus the packed data.
#    Out: mobile/www/ (≈195 MB). Not committed.
cd mobile && npm install && node scripts/build-www.mjs

# 3. Put them in the Android app and build the install file.
npx cap sync android
cd android && ./gradlew assembleDebug     # → app/build/outputs/apk/debug/app-debug.apk
```

iPhone (later, on a Mac or Codemagic): `npx cap add ios` once, then
`npx cap sync ios` and archive in Xcode (the checklist's step 4.5).

## When the players change

A new season's ratings or a new badge reach the app only in a new app version:
run all three steps again and upload. The website keeps reading the database
as before.

## Phone features (10 Nov 2026)

- **Android back button** (`lib/app/native.ts`): presses the screen's own
  Back or Close button. With none on screen (Home, a match), a second press
  inside 2 seconds puts the app away. Needs `@capacitor/app`.
- **Vibration**: the game's buzz goes through `@capacitor/haptics` (iPhone has
  no `navigator.vibrate`); Android also has the VIBRATE permission.
- **Feels like an app** (`app/globals.css`, `body[data-kib-app]`): no bounce
  or pull-to-refresh, no tap flash, no text selection or long-press menu.
- **Icon and opening screen**: `node scripts/icons.mjs` makes every Android
  size from `public/star/app-icon-512.png`.

## iPhone and Codemagic (10 Nov 2026, not run yet)

`mobile/ios` is the iPhone project (made with `npx cap add ios`): iPhone
only, upright only, the game's icon. It cannot be built on Linux. The repo's
`codemagic.yaml` has two workflows, `iphone` (to TestFlight) and `android`
(the install file); its first lines say what to set up in Codemagic. Neither
has been run: expect small fixes on the first run.

The pack is safe to re-run: it writes to `mobile/packed.new` and swaps it in
only when it has worked, and it stops if `sharp` is missing (the app would
come out 240 MB bigger).

## Known limits (5 Nov 2026)

- About 1,460 player photos come from SoFIFA's site, which refuses them
  (403). The website cannot show those either: both show the silhouette.
- Online-only extras (comparing your Hall of Fame with other players, sharing
  a legend link) answer "not available in the app" for now.

## Test it with no signal

Build `mobile/www` with `NEXT_PUBLIC_STAR_OFFLINE_DEV=1` (test helpers on, so
the robot can aim; never for a real upload), serve it, and play:

```bash
(cd mobile/www && python3 -m http.server 3401 &)
node scripts/star-sandbox/seasons.mjs --offline --url http://localhost:3401 --out /tmp/off --games 6
```

5 Nov 2026: 30 minutes, the trial, the signing, 2 league matches, training,
a goal; 0 requests blocked, 0 failed, 0 errors.
