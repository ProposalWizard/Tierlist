# Lag and loading: a plan to keep the game light as it grows (28 Nov 2026)

For Harry, Mikey and Leo. Plan only. No game code was changed.

Harry, 28 Nov, 11:55: *"I'm more and more worried about lag and loading with how big the game is getting, I think we need to get ingenious with how we keep lag in check."*

**Key point.** The game sends every player almost everything on day one. That includes places they cannot open for a season or more. The fix is one list of places that the build, the preloader and the unlock screens all read.

**Key number.** About **35% of the first download is not needed on Home** (about 1.6 MB of 4.7 MB raw). Home also starts **four 3D places downloading** for every player, even a new one who owns none of them.

**Key change.** A **place list** (one file). Each place says what it costs, when it unlocks and which files it needs. A build check fails if a place goes over its budget. The preloader fetches only places you have, plus the next one you will get.

How sure each number is: every number says **measured** (I ran it or read a recorded measure), **reasoned** (worked out from the code) or **guessed**.

---

## Part 1. What the game costs today

### 1a. The first download of /road-to-the-golden-ball

`/road-to-the-golden-ball` is the address players use. It shows the `/star-dev` page (a "rewrite" in `next.config.mjs` line 91).

I did **not** run `next build`. The machine had 6 GB "available" but only 1 GB truly free, and two other builders had dev servers on the same `.next` folder (ports 3114 and 3115). A build would have broken their servers. The `.next` folder here is a dev build, so its sizes mean nothing.

Instead I bundled the page with esbuild (a fast bundler that splits the code at the same "load later" points Next uses). Then I added up the code the page needs before it can start. Scripts and output: `/tmp/claude-0/-home-user/b3e40a5d-8375-5f33-bf31-5b59e99a7327/scratchpad/bundle/`.

| What | Files | Raw | Gzipped (squeezed, as sent) | How sure |
|---|---|---|---|---|
| First load today (esbuild, no Next runtime) | 179 | 4,689 KB | 1,498 KB | measured (esbuild estimate) |
| First load on 15 Oct (real `next build`) | 52 | 4,072 KB | 1,207 KB | measured then |
| All the game's code, every screen | 481 | 10,059 KB | 3,222 KB | measured (esbuild estimate) |
| three.js (the 3D library) in the first load | 0 | 0 | 0 | measured. Good: it loads only for 3D. |

So the first load grew about **15% raw, 24% gzipped** in six weeks (reasoned: two different tools, so treat it as "it grew", not an exact figure).

The biggest pieces of the first load, and whether Home needs them (measured sizes, my reading of the code for "needed"):

| # | Piece | Raw KB | Needed on Home? |
|---|---|---|---|
| 1 | `data/names/nation-names.json` (made-up names for foreign players) | 490 | No |
| 2 | `lib/star/data/sources/researched_2026-10.json` (a raw club sheet; `clubProfiles.ts` merges it at run time) | 213 | No: ship the merged result only |
| 3 | `components/star/CanvasMatch.tsx` (the match screen) | 185 | No: match only. Guard decision needed (see 2f) |
| 4 | `lib/star/authoredScenarios.json` (the drawn chances) | 149 | No: match only |
| 5 | `lib/star/data/clubProfileData.ts` (club sheets) | 135 | Partly (kits, badges) |
| 6 | `lib/star/data/sources/nation_kits_2026-10.json` (211 nations' kits) | 114 | No: international matches only |
| 7 | `lib/star/media/**` (post-match feed, tweets, templates) | 333 | No: after a match |
| 8 | `lib/star/goalClip/**`, including two video muxers (mp4 and webm makers, 58 KB) | 145 | No: only when a reel is saved |
| 9 | `lib/star/fhr/**` (build-up patterns, 63 KB JSON) | 114 | No: match only |
| 10 | React DOM, Supabase sign-in | 127 + 85 | Yes |

Pieces 1, 2, 4, 6, 7, 8, 9 and the match together are about **1,600 KB raw, about 500 KB gzipped** (reasoned: sum of the measured sizes, gzip ratio 0.32 from the totals).

### 1b. The 3D files (measured, `du` on `public/star/`)

`public/star/` holds **140 MB**. The whole `public/` folder is 211 MB.

| Kind | Files | Size |
|---|---|---|
| 3D models (`.glb`) | 246 | 77 MB |
| Pictures (`.webp`) | 523 | 35 MB |
| Pictures (`.png`) | 54 | 13 MB |
| Sounds (`.mp3`) | 82 | 11 MB (music 5.9 MB) |
| Packed GPU pictures (`.ktx2`) | 13 | 2 MB |
| Videos (`.mp4`, `.webm`) | 6 | 0.9 MB |

Biggest folders: `shop3d` 26 MB (25 MB of it the 45 shop items), `star-pass` 16 MB (9.7 MB of it 62 reward models), `people3d` 13 MB, `human3d` 12 MB, `shop2d` 12 MB, `sprites` 8.5 MB, `onebody` 7.7 MB.

One thing to know. **35 models have two copies**: a plain one and a KTX2 one (`*.ktx2.glb`, pictures packed for the graphics chip). The plain ones total 16.4 MB, the KTX2 ones 27.2 MB (measured). A player downloads one of each pair. KTX2 is **66% bigger to download** but uses **about a quarter of the graphics memory** (handbook, measured on 9 Oct). On an S20, memory is the bigger problem. On a desktop, download is.

### 1c. What each 3D place loads, and how long it takes

From `docs/3D_HANDBOOK.md` ("3D loading, speed job B"): measured on this machine, Fast 4G, page thread slowed 4x, no graphics chip. Times move about 20% run to run.

| Place | Cold open (s) | Revisit (s) | Its own files (reasoned from the code) |
|---|---|---|---|
| Garden | 17.8 | 5.8 to 8.0 | `garden3d/props.glb`, trees atlas, horse, bird, the shop's character and clips, Draco decoder, people |
| 3D shop | 12.6 | 4.9 | 45 item models (25 MB), character, clips |
| Casino | 7.3 | 4.5 | `anims3d/casino.glb`, room pictures, character |
| House | 4.7 | 1.3 | furniture, car and boot far models |
| Career match 3D | 12.0 | 7.7 | stadium, people heads and bodies |

The 15 Oct measure: opening the garden fetched **84 KB of code plus 6.6 MB of files**.

**What Home does today** (`app/star-dev/page.tsx` lines 3075 to 3080): every time Home shows, it starts `preloadScene("garden")`, `"shop"`, `"casino"` and `"home"`. That runs for **every** player. A new player has no Garden app yet (it costs ★5,000 in the App Store, `lib/star/unlocks.ts` line 474) and no Casino app (★3,500). So a new player downloads several MB of 3D they cannot use, perhaps for a season (reasoned).

### 1d. The budgets that exist today

| Budget | Where | What it holds | Checked by |
|---|---|---|---|
| Garden: 90 draws, 80,000 triangles on Medium (110 / 100,000 walking) | `lib/star/garden3d/gardenBudget.ts` | Measured numbers per view, before and after | `tests/star/gardenPlants.mts`, garden levels test |
| Training compound: High 140 / 160k, Medium 90 / 90k, Low 60 / 70k | `lib/star/world3d/compoundPlan.ts` line 328 | Measured per viewpoint | `tests/star/compound.mts` |
| People per place: phone at most 4 moving, 8 in all | `lib/star/world3d/budget.ts` | Caps per tier | its own test |
| Pixels: Android at most 900,000 per frame (1.4 m on new chips) | `lib/star/three3d/quality.ts` `deviceCaps` | Pixel caps per GPU family | `tests/star/perf3d.mts` |

A "draw" (draw call) is one instruction to the graphics chip: "draw this thing". Fewer draws = less work per frame. Triangles are the tiny flat pieces every 3D shape is made of.

What is missing (reasoned):
1. Only the garden and the compound have a budget. The house, shop, casino, street, barber, drive, gym and match do not.
2. The budgets are numbers typed into a file after someone measured. If a scene changes and nobody re-measures, nothing notices.
3. There is no budget for **bytes** (how much a place downloads) or for the **first load**.

### 1e. The quality system today (read in code)

- **Tiers** (`quality.ts`): Low, Medium, High. Auto picks from the device. Every phone starts on Medium. Androids with 3 GB or 4 cores or fewer start on Low. Since 27 Nov the S20's chips (Mali-G77, Adreno 650) are read as "medium", never "high".
- **The governor** (`governor.ts`): watches real frame times. Slow for 2.5 s → one rung down. Full speed for 12 s → one rung up. The rung a phone settles on is kept **for the session only** (`sessionStorage`). Next day it starts again from the top and steps down again in each place.
- **The speed recorder** (`lib/star/perfSample.ts`): a sample every 5 s, for team accounts and `?fps=1` phones only. It sends to PostHog and to the Supabase table `star_perf_samples`. **That table has not been created** (FACT-DAT-015: `supabase/migrations/star_perf_samples.sql` is PENDING). So the Supabase half gets a 404 and stops. PostHog still gets the samples. `scripts/perf-report.mts` reads the table, so today it has nothing to read.

### 1f. The "load the match later" proposal (read)

`docs/plans/load-match-later-proposal-2026-11-28.md`. In short: making the match screen load later fails the one-engine guard (the build check that stops copies of the match). Changing the guard needs the team's own words (RUL-ENG-004). Its Option B, **load the match's data later**, saves more and needs no guard change. This plan agrees with B and builds on it (item 1 below).

---

## Part 2. The system: "the place list"

The ingenious part is not any one trick. It is **one list** that every part of the game reads. Today the same facts live in five places: `SCENE_ASSETS` in `perf.ts`, the `lazyScreen` lines in `page.tsx`, the budgets in two files, the App Store prices, and the Home preload. They drift apart.

### The one list

A new file, `lib/star/places/placeList.ts`. Pure data, no 3D code, so the build check and a test can read it. One entry per place. Example (the shape, not final numbers):

| Field | Garden example | What reads it |
|---|---|---|
| `id` | `garden` | everything |
| `opens` | "Garden app bought" (one unlock rule, Plan 2) | the unlock screens, the preloader |
| `next` | `street`, `casino`, `shop3d` | the preloader (what to fetch while you stand here) |
| `files` | `star/garden3d/**`, `star/shop3d/character.glb`, ... | the byte check, the preloader, the offline cache |
| `bytes` budget | 9 MB (Medium phone) | the byte check (build) |
| `draws` / `triangles` budget | 90 / 80,000 Medium | the scene check (measured run) |
| `gpuMb` budget | 120 MB Medium | the scene check |
| `measured` | numbers, date, and a fingerprint of the scene files | the stale check |

### The six parts that hang off it

| # | Part | What it does | Saves (and how sure) | Effort | Risk |
|---|---|---|---|---|---|
| A | **Build check for bytes** | `scripts/place-budget-guard.mjs`, run inside `npm run build` next to the one-engine guard. Adds up each place's files. Fails the build if a place is over its byte budget, or a scene asks for a file not on its list. A second step after `next build` reads the real first-load size of `/star-dev` and fails it over a ceiling (say 1,500 KB gzipped, then lower it). Like the one-engine guard: ceilings only go down. | Stops growth, does not shrink. Prevents the next "6 weeks, +24%". (reasoned) | S (1 day) | Low. Runs in seconds: it only reads file sizes. |
| B | **Scene check for draws and triangles** | Draws and triangles are the **same on a machine with no graphics chip** as on a phone. Only the time differs. So the existing harness (`scripts/perf3d`) can count them anywhere. A job walks each place's viewpoints at Medium and writes the numbers into the list. It fails if a place is over. It runs on push to Harry/main as a GitHub job, not inside the Vercel build (that build is already near its 45-minute limit). The Vercel build only checks that the `measured` fingerprint matches the scene files: changed scene, no new measure → a warning. | Catches the S20 kind of lag before Mikey sees it. Garden went 129 → 86 draws once measured (measured). | M (3 days: viewpoints for 8 places) | Medium. A long job; flaky if the machine is busy. Counts are steady, times are not, so it checks counts only. |
| C | **Load by place and by unlock** | The Home preload (page.tsx 3075) reads the list: preload only places you have opened, plus the **one next unlock**. A place you cannot reach is never fetched. Same for 2D screens' heavy data. | A new player skips about 6.6 MB of garden files (15 Oct, measured) plus the casino and shop files (guessed: 2 to 4 MB more). | S (1 day) | Low. A place opened early (a test link) just loads cold. |
| D | **Shared cache across places** | Today `loadGltfCached` throws the downloaded model away after one use ("parsed once", perf.ts line 701). The garden, shop and casino each unpack the same character, clips and people again. Keep the unpacked models (shapes and pictures already on the graphics chip) in one cache, shared by every place on the one shared canvas. Cap it per tier (say 60 MB on a Medium Android) and drop the oldest first. | Garden revisit 5.8 to 8.0 s; the house, which shares little, 1.3 s (measured). Guess: garden revisit to about 3 s, door hops (garden ↔ shop ↔ casino) 2 to 4 s faster each. | M (2 to 3 days) | Medium. Too big a cache = the phone takes the 3D away. Hence the cap, and the existing heal. |
| E | **Pictures packed per device** | Send KTX2 (small on the chip, big to download) to Android and iPhone, where memory runs out. Send WebP (small to download) to desktops. Then pack the 45 shop items' pictures as KTX2 (the handbook's biggest memory risk: 377 MB of pictures in the shop). Join small pictures into atlases (one big picture holding many small ones: fewer draws). | Shop pictures 288 → 103 MB on the chip (measured once, 9 Oct). Desktop download about 11 MB less over the 35 pairs (measured file sizes). | M (2 days) | Low-Medium. Every swap must be checked by eye (Harry's rule: same picture). |
| F | **Far copies everywhere** | The garden's far copy (`farGarden.ts`) is the model: past 25 m, still things are drawn from one merged low-detail copy. Do the same for the street's far buildings, the compound's far pitches, the drive's roadside and the stadium outside the pitch. | Garden, measured 28 Nov: paddock 86 → 63 draws, field 99 → 80, yard 120 → 74, lane 119 → 69. Guess for the others: 20 to 40% fewer draws on wide views. | M per place (1 to 2 days each) | Low. Off with a `?…far=0` switch, as the garden. |

### Four more parts

| # | Part | What it does | Saves (and how sure) | Effort | Risk |
|---|---|---|---|---|---|
| G | **Start each phone where it ended** | Keep the governor's settled rung **per place, per phone**, in `localStorage` (today: one value, this session only). Then use the speed recorder's real data: once `star_perf_samples` exists, a weekly script makes a small table "GPU family → start rung per place" from real phones. It ships with the game, so an S20 opens the garden on its known-good rung from the first frame. | Today an S20 spends the first 2.5 s of every place on a rung too high, and steps down again in every place (reasoned from `governor.ts`). Guess: the first 3 to 5 s of each visit stop stuttering on Mikey's phone. | S (1 day) + the table (needs data) | Low. Can only start lower, and climbs back after 12 s of full speed. |
| H | **Use the wait** | While a transition plays (Harry's transition clips between places, and the loading curtain), the next place downloads and builds its shaders (the small programs the graphics chip runs) in the background, on the shared canvas. The list's `next` field says which place. The garden built 22 shaders after its cover came down (measured, down from 57): each one a hitch. | Guess: door-to-door hops feel instant when the clip is 2 s or longer; the first-frame hitches after a door mostly go. | M (2 days, after D) | Medium. Building a place nobody enters wastes battery; only build the `next` place, never more than one. Must respect the "a place you left keeps building" bug (P1 in `docs/plans/3D_PLACES_AUDIT_2026-11-28.md`): fix that first. |
| I | **Offline cache for 3D files** | A service worker (a small script the browser keeps for the site) stores the versioned 3D files (`/star/...?v=hash`) in the browser's own store, asking the phone to keep them (`navigator.storage.persist`). Never caches pages or code, so it cannot serve a stale game. | The files are already marked "keep forever" (`immutable`, next.config.mjs line 152), so on a good phone the gain is small (reasoned). The gain is on phones that clear their cache under pressure (Android does) and on bad signal. Guess: 0 to 10 MB saved per return visit on a busy Android. | M (2 days) | Medium. A service worker bug is hard to undo on a player's phone. Ship with a kill switch first. |
| J | **The lag budget page** | One admin page, `/admin/lag-budget` (with the eye button, admin-page-guide skill). Per place: budget vs last measured draws, triangles, bytes, GPU MB, and the real phones' fps from `star_perf_samples`, with the S20 and the iPhone 16 side by side. Red over, amber within 10%, green under. | Nothing by itself. It makes lag visible before a playtest finds it. | S (1 day) once the table exists | Low |

---

## Part 3. The match and Home (2D) savings

These are not 3D, but they are the first thing every player waits for.

| # | Change | Saves (raw, gzipped) | How sure | Effort | Risk |
|---|---|---|---|---|---|
| K1 | Load `nation-names.json` only when a foreign player's name is made | 490 KB, ~160 KB | measured size; code path reasoned | S | Low-Medium: names are read during simulation, so the read must wait for the file |
| K2 | Ship the merged club sheet, not `researched_2026-10.json` (do the merge in `scripts/club-data/build_club_profile_data.py`, which already writes `clubProfileData.ts`) | about 213 KB, ~60 KB | measured size | S | Low; `/admin/clubs` still reads the raw sheet itself |
| K3 | `nation_kits` only for international matches | 114 KB, ~30 KB | measured | S | Low |
| K4 | Media feed templates, goal-clip muxers and `fhr` patterns load after the match | about 590 KB, ~190 KB | measured | M | Medium: the engine-warn hook will ask for `fhr` (RUL-ENG-001) |
| K5 | `authoredScenarios.json` loads when Play is tapped (Option B of the match proposal) | 149 KB, ~45 KB | measured | S | Medium: same hook |
| K6 | CanvasMatch later | 185 KB, ~55 KB | measured | S | **Needs the team's words to change the guard** (RUL-ENG-004). Not proposed here. |

K1 to K5 together: about **1,550 KB raw, about 480 KB gzipped**, about a third of today's first load (reasoned sum). The 15 Oct measure said parsing costs a mid Android about 1 s per 400 to 500 KB of raw code (guessed then, not measured), so K1 to K5 might save **2 to 3 s** of a cold start on a mid Android. Measure before and after with a real `next build`.

---

## Part 4. The order: top 5 first

| Order | Item | Why first | Saves | Effort |
|---|---|---|---|---|
| **1** | **Run the speed recorder's table** (`star_perf_samples.sql` in the Supabase SQL editor, PRO-DAT-001), then **G**: start each phone on its settled rung per place | Without real phone numbers every other item is a guess. Mikey's S20 is the phone that lags. One SQL file and one day of code. | First 3 to 5 s of every place on the S20 (guess); real data for everything else | S |
| **2** | **C: load by unlock** (and the place list file it needs) | Biggest saving for new players, smallest risk, and it is the base for A, B, H and Plan 2 | about 6.6 MB of garden files for a new player (measured 15 Oct), plus 2 to 4 MB more (guess) | S |
| **3** | **K1 to K5: the first-load data later** | Every player, every cold start | about 480 KB gzipped, guess 2 to 3 s on a mid Android | M |
| **4** | **A: the byte guard** (and the first-load ceiling) | Stops the growth coming back. Cheap to run inside the build | stops +24% in 6 weeks happening again | S |
| **5** | **D then H: shared cache, then build the next place during the wait** | The biggest win for moving between places, which is where the game is heading (street, barber, compound, drive) | garden revisit about 6 s → about 3 s (guess); door hops near instant behind a 2 s clip (guess) | M |

After those: B (scene check job), E (pictures per device, shop KTX2), F (far copies), I (offline cache), J (the page).

Before item 5, fix bug P1 in `docs/plans/3D_PLACES_AUDIT_2026-11-28.md` (a place you leave while it loads keeps building on the shared canvas). Building the next place early would make that bug worse.

---

## Part 5. How this ties to Plan 2 (the unlock flow)

`docs/plans/UNLOCK_FLOW_PLAN_2026-11-28.md` sets **when** each place opens. The place list here holds the same rule in its `opens` field. Together:

- **Day one loads light.** Only Home, the match, training and the house. Every other place is not fetched at all.
- **Each new unlock is preloaded just before it opens.** The list knows the next unlock, so its files arrive in the quiet weeks before the player gets it.
- **Budgets grow with the player.** A season-1 player never pays for the casino. A season-6 player has most places cached.

## What I did not do

- No real `next build` (memory, and other builders' servers on the same folder). The first-load numbers are an esbuild estimate. A real build measure is the first step before K1 to K5.
- No phone measures. All times are from the handbook's recorded runs on a machine with no graphics chip.
- Draw and triangle numbers exist only for the garden and the compound. Every other place needs a measure.
