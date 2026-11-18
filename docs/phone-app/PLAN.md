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
| # | Step | State |
|---|---|---|
| 0 | Measure the current app | done (below) |
| 1 | Foundations: project, shared rules, saving, screens, design kit | started |
| 2 | The 2D match on phone graphics, same physics | |
| 3 | Career screens | |
| 4 | Shop, phone feed, Star Pass, sponsors, sound, music, vibration | |
| 5 | 3D (garden, 3D shop, 3D match): last, Mikey decides | |
| 6 | Checks: same save gives same results; real-phone playtests; frame rate | |
| 7 | Release as 2.0 | |

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
