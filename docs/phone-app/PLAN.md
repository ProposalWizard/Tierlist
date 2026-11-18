# The phone-built app (Mikey, 18 Nov 2026)

"start on creating a new app … built for phone … so it works perfectly and has the
clean feel like most proper apps … this should be a separate app so the changes
should not affect the website or the packed app."

- Lives in `phone/` (its own folder, its own packages). The website (`app/`,
  `components/`) and the packed app (`mobile/`) are not changed by it.
- Built with React Native (Expo). The game's rules (`lib/star/**`) are READ from
  the repo, never copied or changed, so a fix there reaches the website, the
  packed app and this app alike. Screens are rebuilt natively.
- Ships as version 2.0 of the same Google Play app (`uk.co.knowitball.game`,
  same upload key), so testers, reviews and the listing carry over.

## Steps
| # | Step | State (18 Nov 2026, evening) |
|---|---|---|
| 0 | Measure the current app | done |
| 1 | Foundations: project, shared rules, saving, screens, design kit | done |
| 2 | The match on phone graphics, same physics | done: full 90 min, every chance kind, strike screen, curve, passing, shootouts, internationals, sprites with the 20° tilt, sound; `tools/match-parity.ts` identical to the website's call order |
| 3 | Career screens | done: every page.tsx phase except 3D ones (see below) |
| 4 | Shop, phone feed, Star Pass, sponsors, Owner app, boardroom, goal videos | done (no "Save video": needs a native video encoder) |
| 5 | 3D (garden, 3D shop, house, 3D training, farewell walk-out) | not started: Mikey decides |
| 6 | Checks: same save gives same results; real-phone playtests; frame rate | headless checks done; nothing seen on a real phone yet |
| 7 | Release as 2.0 | not started |

Checks to keep passing (phone/tools): match-parity, match-features, career-flow-check,
screens-check, world-check, data-check, draw-check, slots-check, screens-politics-check.

Defaults taken while Mikey was away (change any): measure first; same Play
listing; 3D last; Android first (iPhone later needs a Mac or a build service);
a page for Harry and Leo when step 1 is done.

## Step 0: what makes the current app lag (measured)

1. **Real phone, 22 Oct 2026** (Mikey's phone, website, the in-game Lag test,
   branch `lag-runs`). Frames that took over 50 ms (a visible stutter), at rest:

   | Screen | slowest 5% of frames | stutters | busy (ms of hidden work) |
   |---|---|---|---|
   | Home | 34 ms | 37 in 20 s | 3,201 |
   | Stats | 66 ms | 61 in 30 s | 4,666 |
   | Shop | 33 ms | 46 in 30 s | 4,525 |
   | 3D shop | 50 ms | 35 in 30 s | 5,445 |
   | Garden | 100 ms | 90 in 30 s | 10,935 |
   | Phone feed | 167 ms | 87 in 30 s | 11,745 |
   | 2D match | 83 ms | 171 in 40 s | 1,484 |

   Even screens with nothing moving (Stats, Shop) stutter about twice a second.
2. **Home: your player is a live 3D model** (`components/star/ToonHomePlayer.tsx`)
   redrawn 30 times a second for as long as Home is open, on top of the page.
   Profiled in the packed app (Chromium, processor slowed 4x): the page is never
   idle on Home. A phone-built app would show a still of him and move him only
   when touched, or run him on the phone's graphics thread.
3. **The blur** (removed in 1.1): Mikey felt little change. Not the main cause.
4. Not measured here: the Stats/Shop/Feed hidden work (no graphics chip in
   this machine; the 3D drawing hides everything else in its profiles). The
   phone-built app avoids the whole class: its screens run on the phone's own
   UI thread, and the game's rules run on a separate thread.

## Building the test app (KIB Next)
```bash
cd phone && npm install
CI=1 npx expo prebuild --platform android --no-install   # makes phone/android (not committed)
cd android && ./gradlew -I ../tools/maven-mirror.gradle assembleRelease -PreactNativeArchitectures=arm64-v8a
# → app/build/outputs/apk/release/app-release.apk (47 MB), package uk.co.knowitball.game.next
```
Needs the Android SDK with NDK 27.1 and CMake 3.22. `maven-mirror.gradle` is only
for machines Maven Central rate-limits (429). The test build is signed with the
debug key; the real 2.0 is signed with the upload key under the real package name.

First test build, 18 Nov 2026: title, new career, Home (skills, contract),
League (table, fixtures), bottom bar, saving. Not yet seen running on a phone.
