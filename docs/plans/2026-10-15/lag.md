# Lag, bloat and organisation — plan (15 Oct 2026)

Planning only. No code changed, nothing committed. Measuring scripts: `scripts/perf/` (uncommitted, in the worktree) and a copy in `scratchpad/perf/scripts/`.

**How measured.** Production build (`next build && next start`, `NEXT_PUBLIC_STAR_OFFLINE_DEV=1`), Playwright Chromium, 390×844, touch, CPU 4× slower (CDP). No network throttle (local server; JS sizes listed instead). No graphics chip (SwiftShader): every 3D number is far worse than a phone. Read 3D numbers as before/after only.

**Words.** *Shown* = tap → the new screen's marker is on screen. *Still* = tap → last long task or DOM change before 0.8–1.5 s of quiet. *Long tasks* = main-thread blocks over 50 ms (count / total / worst). *Seen / measured / reasoned* is marked where it matters.

---

## 1. Measured baseline

### 1a. Loads, menus, match, 3D (all measured)

| Step | Shown | Still | Long tasks n / total / worst | JS fetched | Note |
|---|---|---|---|---|---|
| Cold load, no save → title | 1.8 s | 7.0 s | 12 / 1.5 s / 338 ms | 1,706 KB (125 files) | |
| Reload → title | 0.65 s | 6.8 s | 8 / 1.2 s / 255 ms | 0 KB | |
| Cold load, save → Home | 5.2 s | 11.6 s | 46 / 8.9 s / 523 ms | 1,511 KB (65 files) + 4.8 MB other | |
| Reload → Home (everyday open) | 5.8 s | 17.0 s | 47 / 8.8 s / 1,148 ms | 45 KB | save grew to 208 KB after squads arrived |
| Home, idle 5 s | – | – | 7 / 955 ms | – | 13 fps, p95 frame 250 ms (Home 3D player drawing) |
| Settings open (1st) | 0.41 s | 4.8 s | 2 / 301 / 187 | 352 KB | preload had not reached Settings |
| Settings open (2nd) | 0.22 s | 0.23 s | 1 / 77 / 77 | 0 | |
| Settings → back to Home | 6.3 s | 7.7 s | 4 / 6.5 s / 3.7 s | 0 | **same on 2nd go: 6.7 / 7.8 s** |
| Stats open / back | 0.08 / 0.11 s | 0.07 / 0.09 s | ≤1 / 88 ms | 0 | swipe page: Home stays mounted |
| Shop open (1st / 2nd) | 0.31 / 0.17 s | 0.31 / 0.17 s | 1 / 212 ms | 0 | |
| Shop → back | 5.3 s / 4.0 s | 6.5 / 5.0 s | 4 / 5.7 s / 4.3 s | 0 | |
| League open (1st / 2nd) | 0.48 / 0.21 s | 0.50 / 0.22 s | 1 / 370 ms | 0 | |
| League → back | 8.6 s / 8.6 s | 9.6 / 9.7 s | 4 / 8.8 s / 6.6 s | 0 | |
| Training open | 0.12 s | 0.05 s | 0–1 | 0 | |
| Training → back | 7.5 s / 7.7 s | 7.4 / 7.7 s | 2 / 6.2 s / 4.7 s | 0 | |
| Phone open | 0.25 / 0.13 s | 0.19 / 0.12 s | 2 / 166 ms | 0 | |
| Phone → close | 12.1 s / 14.2 s | 12.1 / 14.2 s | 2 / 11.8 s / 9.1 s | 0 | worst menu |
| Relations open | not measured (marker missed) | 0.64 s | 1 / 118 ms | 0 | |
| Relations → back | 6.8 s / 7.3 s | 6.9 / 7.3 s | 2 / 5.8 s / 4.7 s | 0 | |
| Texture pack dropdown open / close | – / 0.17 s | 0.25 / 0.15 s | 1 / 65 ms | 0 | fine |
| Play → bench (match) | 1.2 s | 5.9 s | 11 / 1.6 s / 289 ms | 413 KB | "Skip the line-up" on by default: no pre-match screen |
| GET OUT THERE → first chance | 18.5 s | 19.3 s | 3 / 203 ms / 84 ms | 0 | **waiting, not working**: commentary feed plays to your minute |
| 2D match, aiming (5 s) | – | – | 0 | – | p50 16.7 ms, p95 16.8 ms, worst 867 ms (one hitch) |
| 2D match, ball in flight (5 s) | – | – | 3 / 166 ms | – | p50 16.7 ms, **p95 66.7 ms**, worst 867 ms, 9 frames >33 ms |
| 2D → 3D, first time | 40.1 s | 52.4 s | 18 / 39.3 s / **33.4 s** | 95 KB | 30 s of it: one throwaway WebGL2 context (see C1) |
| 3D aiming (5 s) | – | – | 2 / 114 ms | – | p50 33 ms, worst 2.7 s (SwiftShader) |
| 3D → 2D | 10.5 s (measure) / 0.17 s (probe) | 10.5 s | 3 / 167 ms | 0 | two runs disagree; probe's profile shows 0.17 s. Re-check |
| 2D → 3D again | 0.19 s | 0.18 s | 0 | 0 | cached |
| My home (3D house), 1st | 2.7 s | 37 s (animations never quiet) | 8 / 1.8 s / 389 ms | 403 KB | 2 fps here |
| My home, 2nd | 3.0 s | 3.1 s | 7 / 2.8 s / 1.2 s | 0 | rebuilt each visit |
| Phone → Garden (3D) | 1.3 s (cover off) | 12.0 s | 19 / 9.2 s / 2.6 s | 84 KB + 6.6 MB other | 1 fps here |
| Shop → 3D shop | 5.6 s | 6.3 s | 17 / 3.6 s / 1.2 s | 0 | 3 fps here |

Stills: `scratchpad/perf/run-*/*.png`. Raw numbers: `scratchpad/perf/run-*/result.json`. Raw table: Appendix A.

### 1b. JavaScript sent per route

`/star-dev` first load: **52 files, 4,072 KB raw, 1,207 KB gzipped** (measured from `.next/app-build-manifest.json`). three.js is NOT in it (good).

Biggest modules in that first load (measured: `scripts/perf/modsizes.cjs`):

| # | Module (source) | Raw KB | Needed on Home? |
|---|---|---|---|
| M1 | `data/names/nation-names.json` (via `lib/star/nationNames.ts` ← `international.ts`, `intl/career.ts`) | 483 | No: made-up names only |
| M2 | `lib/star/data/clubProfileData.ts` (the club sheets) | 371 | Partly: kits/badges read `profileOf` |
| M3 | `app/star-dev/page.tsx` itself | 232 | Yes |
| M4 | `components/star/CanvasMatch.tsx` | 177 | No: match only |
| M5 | `@supabase/*` client | 177 | Yes (sign-in, saves) |
| M6 | `lib/star/authoredScenarios.json` | 174 | No: match only |
| M7 | React DOM | 169 | Yes |
| M8 | media templates (`lib/star/media/templates/*`) | 125 | No: post-match feed only |
| M9 | international tournaments (`lib/star/intl/*`) | 66 | No |
| M10 | competitions/careerFlow strings | 53 | Yes |
| M11 | `keeperBrain.ts` + match helpers (chunk 8439) | ~60 | No |
| M12 | FIFA nation ranking JSON | 18 | No |

All 101 routes, first-load JS: Appendix B (from the build output). Build time: 7 min 34 s on 4 cores.

### 1c. Profiles (measured, CPU 4×; self time)

| Step | Top costs |
|---|---|
| Cold load → Home | Home 3D player's first frame + `toDataURL` snapshot **3.0 s** (`ToonHomePlayer.tsx` line 88 frame fn); three.js 1.1 s; (program) 0.9 s; React 0.4 s |
| Settings → back to Home | `toDataURL` **2.4 s**; (program) 2.6 s; `getProgramInfoLog` 0.3 s (shader compile wait) |
| Phone → close | `toDataURL` **3.8 s**; (program) 2.7 s |
| Reload with real save | (program) 5.2 s; `toDataURL` 0.65 s; `createImageBitmap` 0.42 s; `getImageData` 0.11 s |
| Phone → Garden | `getProgramInfoLog` **3.9 s** + `getShaderInfoLog` **3.7 s**; (program) 2.2 s |
| First 2D → 3D | `d()` in `lib/star/three3d/ktx2.ts` `chip()` **30.0 s** (throwaway WebGL2 context); `getProgramInfoLog` 0.8 s; `setSize` 0.7 s |
| One save (page.tsx save effect) | 0.4 ms on desktop node for a 32 KB save (~2 ms phone, reasoned). Not a cause |

"(program)" = native work not tied to a script (layout, paint, GL calls). Not split further here.

---

## 2. Causes, ranked by measured cost

| # | Cause | Measured cost here | Evidence | Phone cost |
|---|---|---|---|---|
| C1 | 3D picture packer probes the chip with a throwaway WebGL2 context (`ktx2.ts` `chip()`), because the career match never names its renderer (`useKtx2With` only called by shop and garden) | 30 s of the first 2D→3D switch | probe profile `switch-to-3d.txt` | reasoned 20–200 ms + a second GL context. SwiftShader inflates it |
| C2 | Home 3D player rebuilt from nothing on EVERY return to Home: new WebGL context, shader compile, and a full-canvas `toDataURL("image/webp")` snapshot every mount, even when a matching snapshot is already kept | 4–14 s per return (Settings 6.3 s, Shop 5.3 s, League 8.6 s, Training 7.5 s, Phone 12.1 s, Relations 6.8 s); 3.0 s at cold load | profiles 1c; `ToonHomePlayer.tsx` 34–106, 142–150 | reasoned 150–600 ms per return (context + compile + readback/encode of a 780×~1000 px canvas) |
| C3 | three.js checks every shader's log (`renderer.debug.checkShaderErrors` left at default true): blocks until each shader compiles, defeats parallel compile | Garden 7.6 s of 12 s; house/shop/match smaller | garden profile | reasoned: real on Android Chrome; less on iPhone |
| C4 | Big first-load JS for Home: 4.0 MB raw / 1.2 MB gz; 1.4 MB of it is match/data Home does not use (M1, M2 part, M4, M6, M8, M9, M11, M12) | cold Home shown 5.2 s; 8.9 s of long tasks | 1b | parse/compile ~0.5–1.5 s on a mid phone (reasoned) |
| C5 | GET OUT THERE → first chance waits for the commentary to reach your minute | 18.5 s of waiting; only 0.2 s CPU | probe log: phase "feed" for 20 s | same on phone (pacing, not lag) |
| C6 | Home idle draws the 3D player at 30 fps on the main thread | 955 ms long tasks / 5 s, 13 fps | Home idle frames | reasoned small on a GPU; battery |
| C7 | Lazy screens preload one at a time in a 50-item list; Settings is 4th, Match3DLayer ~48th | Settings 1st open fetched 352 KB; Play fetched 413 KB; 2D→3D fetched 95 KB | measure JS column | download time on 4G (not measured) |
| C8 | 3D places rebuilt per visit (house 2nd visit 3.0 s, 2.8 s long tasks) | 2.8 s | house rows | reasoned 0.3–1 s |
| C9 | 2D flight frames: p95 66.7 ms, one 867 ms hitch | 9 slow frames / 5 s | match2dFlight5s | unknown: not profiled yet |
| C10 | Reload (program) 5.2 s + `createImageBitmap` 0.42 s | 5.6 s | reload profile | not attributed yet |
| C11 | 3D → 2D measured 10.5 s once, 0.17 s once | ? | two runs disagree | re-check before any work |

---

## 3. Fix proposals (one per cause)

| # | Fix | Expected gain | Risk | Files | Changes look or play? |
|---|---|---|---|---|---|
| F1 | Name the match's renderer to the packer before its first picture (`useKtx2With(renderer)` where the career 3D renderer is made); keep `chip()` only as a fallback | here: −30 s on first 2D→3D; phone: one GL context fewer | Low | `lib/star/style3d/engineView.ts` (or `lib/star/three3d/perf.ts` `acquireRenderer`), `lib/star/three3d/ktx2.ts` | No |
| F2a | Take the Home player snapshot only when none matches (`readSnap(where, sig)` already finds it) | removes 2.4–3.8 s readback per return here | Low | `components/star/ToonHomePlayer.tsx` | No |
| F2b | When a snapshot is needed: take it once per session, after the first frame, off the tap (idle callback), at 1× pixel ratio | rest of the readback cost | Low | same | No (snapshot is only the loading stand-in) |
| F2c | Keep one Home-player renderer + scene alive for the session; park its canvas when Home unmounts, re-attach on return | removes GL context + shader compile per return (most of the 4–14 s) | Medium (lifetime bugs, context loss) | `ToonHomePlayer.tsx`, maybe `lib/star/three3d/perf.ts` | No |
| F2d | `renderer.forceContextLoss()` on dispose until F2c lands | stops GL contexts piling up (browsers cap ~16) | Low | `ToonHomePlayer.tsx` | No |
| F3 | Set `renderer.debug.checkShaderErrors = false` in production (keep on with `?debug=1` and on dev pages) | here −7.6 s garden open; phone: parallel compile works | Low–medium (a broken shader shows black, no console message) | every renderer maker: `lib/star/three3d/perf.ts` + 4 `new WebGLRenderer` sites | No |
| F4a | Load `CanvasMatch` through `lazyScreen` and preload it first after Home | −177 KB raw + −174 KB scenarios off Home's first load | Medium: one-engine guard reads page.tsx mounts; must pass `scripts/one-engine-guard.mjs` | `app/star-dev/page.tsx` (additive), guard untouched | No |
| F4b | Nation name banks: load on demand (`import()` when made-up names are first needed, or `fetch` a JSON from `public/`) | −483 KB raw | Low–medium: callers are sync today | `lib/star/nationNames.ts`, `international.ts`, `intl/career.ts` | No |
| F4c | Media templates + intl engine behind dynamic import (feed/tournament screens only) | −190 KB raw | Medium (many callers in page.tsx) | `lib/star/media/*` entry, `lib/star/intl/*`, page.tsx | No |
| F4d | Club sheets: split the raw sheet rows (371 KB) from the derived profile table; ship only the derived fields the game reads | −200–300 KB raw (estimate) | Medium (generator script change) | `scripts/club-data/build_club_profile_data.py`, `lib/star/data/clubProfileData.ts`, `clubProfiles.ts` | No |
| F5 | Fast-forward the commentary after GET OUT THERE (e.g. 3× speed, or jump to "You are coming on" → chance) | −10 to −15 s per match (design) | Low technical; it is a design call | `components/star/CanvasMatch.tsx` feed timing | **Yes: pacing.** Question Q4 |
| F6 | Home player: draw only while it moves (drag, idle clip at 15–20 fps or paused when off screen / tab hidden already handled) | −50–70% of Home idle CPU | Low | `ToonHomePlayer.tsx` | Slightly (idle breathing smoother/less smooth). Question Q5 |
| F7 | Reorder `LAZY_PRELOAD`: Settings, Match3DLayer, the Play path, Phone screens first; also preload on pointerdown of a nav button | 352 KB/413 KB/95 KB arrive before the tap | Low | `app/star-dev/page.tsx` list order only | No |
| F8 | Keep the 3D house scene for the session (as F2c) | −2.8 s per revisit here | Medium | `components/star/Home3D.tsx`, `lib/star/home3d/*` | No |
| F9 | Profile 2D flight frames; fix what the profile names | unknown | – | `CanvasMatch.tsx` draw loop (engine physics untouched) | No |
| F10 | Attribute the reload's 5.2 s (program) and `createImageBitmap` (sprite atlas? face pictures?) | unknown | – | – | No |
| F11 | Re-measure 3D → 2D; if the 10.5 s is real, profile it | – | – | – | No |

Never touched by any fix: 3D sizes (`SIZE3D`), `lib/star/canvasEngine.ts` physics, the one-engine guard, Settings rows.

---

## 4. Full screen can't be turned off

Reproduced here (measured, `scripts/perf/fullscreen-repro.mjs`; iPhone 13 profile in Chromium, not real Safari):

| Case | Result |
|---|---|
| (a) iPhone, `star-fullscreen` = "1" saved | Full-screen look ON at load (`knowitball-immersive` on body). Settings row shows "Full screen · How?" only. **No off switch.** |
| (b) Desktop/Android: turn on, leave with Esc (`exitFullscreen`) | Saved value stays "1". Next tap anywhere: `requestFullscreen` called again (asks 1 → 2), page back in full screen. |

Cause: `components/star/ImmersiveToggle.tsx` re-applies a saved "1" on every load for every device; the tap listener re-asks whenever the want is set; no `fullscreenchange` listener; `components/star/DeviceSettings.tsx` `FullScreenRow` shows no switch on "ios"/"standalone".

| Fix | File | Risk |
|---|---|---|
| FS1 On `fullscreenchange` (and `webkitfullscreenchange`) to not-full-screen: clear the want, write "0", remove the class | `ImmersiveToggle.tsx` | Low. Side effect: the photo picker / keyboard dropping full screen also turns it off (today it comes back on the next tap). Question Q7 |
| FS2 At load: support ≠ "native" → ignore a saved "1" and write "0" | `ImmersiveToggle.tsx` | Low |
| FS3 `FullScreenRow`: whenever `on` is true, show the On/Off switch, on any device | `DeviceSettings.tsx` | Low |
| FS4 Unit test of the rules (pure helpers in a small `lib/star/fullscreenPref.ts`: want at load, want after a change, show switch) | `tests/star/fullscreenPref.mts` | None |

---

## 5. Build order (biggest win, lowest risk first)

| Step | Items | Why here |
|---|---|---|
| 1 | FS1–FS4 | Bug; small; separate commit |
| 2 | F2a, F2b, F2d | Every Home return; low risk; one file |
| 3 | F1 | First 3D switch; one call |
| 4 | F7 | List order only |
| 5 | F3 | One flag per renderer; garden/house/shop/match |
| 6 | Re-measure (same script) | Before/after table |
| 7 | F4a, F4b | First load −0.8 MB raw |
| 8 | F2c, F8 | Keep 3D alive; medium risk; needs its own playtest |
| 9 | F4c, F4d | Bigger refactors |
| 10 | F9, F10, F11 | Profile first, then plan |
| 11 | F5, F6 | Only if Harry says yes (they change feel) |

Each step: tsc, `node scripts/one-engine-guard.mjs`, `node scripts/run-star-tests.mjs perf3d assetLoading`, build, `scripts/perf/measure.mjs`, `star-playtest`.

---

## 6. What can't be measured here, and how Harry checks on his phone

| Thing | Why not here | Phone check |
|---|---|---|
| 3D frame times, shader compile time, GPU memory | No graphics chip (SwiftShader) | `?fps=1` on any page: frame meter (fps, worst frame, draws, tier). Note "worst" when returning to Home and on the first 2D→3D |
| iPhone Safari behaviour (full screen, WebGL context limits, WebP encode speed) | Chromium only | Settings → Full screen on iPhone in Safari and from the Home Screen icon |
| Download time on 4G | Local server | Cold open on mobile data, airplane-mode off, cache cleared: time to Home |
| Signed-in cloud save path | Signed out only | Normal play signed in |
| Real long careers (save size) | Test save is season 1–4 | Settings → Saves: any save over ~500 KB is worth a look |
| `toDataURL` cost on a phone | SwiftShader readback is slow | Settings → back to Home: count seconds before the player moves |

---

## 7. Open questions — lag (recommended answer in brackets)

| # | Question | Recommended |
|---|---|---|
| Q1 | Build F2a/F2b/F2d (snapshot only when missing, off the tap) first, before the bigger "keep the Home player alive" F2c? | Yes |
| Q2 | Keep the Home 3D player alive for the whole session (F2c), using ~10–20 MB GPU memory while you are in menus? | Yes |
| Q3 | Turn off shader error checks in the live game (F3), on only with `?debug=1` and on dev pages? | Yes |
| Q4 | After GET OUT THERE, the commentary runs ~18 s to your minute. Speed it up? A: as now · B: 3× speed · C: jump straight to the chance | B |
| Q5 | Home 3D player: idle animation at 30 fps now. Lower to 20 fps, or pause when nothing moves? | 20 fps |
| Q6 | Load the match engine only when Play is near (F4a), preloaded right after Home is up? | Yes |
| Q7 | Leaving full screen by Esc/back/photo picker/keyboard turns the Full screen setting off. OK that the photo picker also turns it off? | Yes (one switch, no surprises) |
| Q8 | iPhone in Safari: hide the full-screen look completely (only the "How?" tip), even if it was saved on? | Yes |
| Q9 | iPhone from the Home Screen icon: show "On ✓" only (it is always full screen there)? | Yes |
| Q10 | Name-bank and club-sheet data fetched on demand (F4b/F4d): accept a one-time ~0.3 s wait the first time a made-up name is needed (new career, internationals)? | Yes |
| Q11 | Preload order (F7): Settings, the match, Phone, League, Shop first? | Yes |
| Q12 | Keep the 3D house scene alive between visits (F8)? | Yes, after F2c proves out |
| Q13 | Do the lag fixes as one deploy or one deploy per step (1–5)? | Steps 1–5 together, then re-measure, then the rest |
| Q14 | Who playtests on the phone after step 6: Harry, Mikey or Leo? | Harry (iPhone) + one Android if anyone has one |

---

## 8. Bloat and organisation

### 8a. What every chat loads

| # | File | Lines | Bytes | ~Tokens per turn | Loaded when |
|---|---|---|---|---|---|
| L1 | `CLAUDE.md` (this branch) | 1,727 | 429,340 | ~107k (bytes ÷ 4) | every turn, every chat |
| L2 | — of which "Recent Session" (line 848 → end) | 879 | ~353,000 | ~88k | every turn |
| L3 | — of which the rest | 848 | ~76,000 | ~19k | every turn |
| L4 | Skill descriptions (11 skills) | – | ~5,100 | ~1.3k | every turn (descriptions only) |
| L5 | `SESSION_LOG.md` | 216 | 40,434 | 0 | only when read |
| L6 | `.claude/agents/*` (4) | – | 22,970 | 0 | only when the agent runs |
| L7 | Skill bodies | – | see 8c | 0 | only when the skill loads |

Target: CLAUDE.md ≤ 25k tokens (−82k a turn) by moving L2 out and trimming L3 (8b).

### 8b. CLAUDE.md, block by block

Rules for the Action column: "Keep" = stays as is; "Move" = text goes to the named file, a 1-line pointer stays; "Delete" = superseded or duplicate.

| Line | Block | KB | ~tokens | Action | Risk |
|---|---|---|---|---|---|
| 1 | KnowItBall — Project Context | 0.1 | 38 | Keep | – |
| 7 | What This Project Is | 0.2 | 60 | Keep | – |
| 13 | The User's Local Machine — Never Tell Them To `git pull`/`git checkout` | 0.6 | 155 | Keep (1 line) | – |
| 19 | Tech Stack | 0.5 | 125 | Keep | – |
| 35 | Deployment & Branding | 0.3 | 76 | Keep | – |
| 44 | Environment Variables | 1.2 | 318 | Shorten to the variable names; values live in .env.local.example | low |
| 64 | Key Design Decisions | 0.7 | 185 | Keep | – |
| 75 | What's Implemented (Complete) | 2.3 | 577 | Move to SESSION_LOG.md or docs/ (tierlist feature list, never read for star work) | low |
| 117 | Pending Migrations / Known Issues | 2.7 | 703 | Merge with the second 'Pending Migrations' table (line ~739); one table only | low |
| 131 | Critical Gotchas | 1.8 | 453 | Delete: duplicate of 'Critical Gotchas' at ~783 | low |
| 142 | What Needs Improvement / Future Work | 6.5 | 1664 | Move to a docs/FUTURE.md; keep a 1-line pointer | low |
| 173 | Recent Session Changes | 1.3 | 338 | Rewrite: says 'Latest session: 12 July' (stale); 1 pointer line to SESSION_LOG.md | low |
| 179 | Ballon d'Or winners data (Mikey, 8 Oct 2026) | 0.2 | 56 | Keep (pointer) | – |
| 185 | Blender runs in the cloud sessions (Mikey, 8 Oct 2026) | 0.7 | 178 | Move to 3d-building skill | low |
| 197 | The garden is 3D, and joined to the 3D shop (Mikey, 3 Oct 2026) | 1.3 | 326 | Move to docs/3D_HANDBOOK.md (already there in §1) | low |
| 219 | The 3D files are packed small (6 Oct 2026) | 0.4 | 108 | Move to 3d-building skill (handbook has it) | low |
| 228 | Any 3D, animation, mocap, model or cut-scene work: merge `main` first, then read `doc | 0.1 | 32 | Keep (1 line) | – |
| 230 | Cut scenes are scripts on one system (Harry, 9 Oct 2026) | 0.7 | 185 | Keep, shorten to 3 lines | low |
| 242 | Goal videos are recordings, never re-runs (Leo, 7 Oct 2026) | 1.0 | 245 | Keep, shorten to 3 lines | low |
| 258 | Club data lives in one place, and /admin/clubs shows the gaps | 1.1 | 289 | Move most to a club-data skill/README; keep 2 lines | low |
| 277 | Tuner proposals live in the terminal | 0.6 | 145 | Keep (it is a trigger rule) | – |
| 289 | Commands | 0.1 | 33 | Keep | – |
| 299 | ONE ENGINE — every screen that plays football runs the real match | 2.0 | 504 | Keep, shorten (one-engine skill holds the detail) | low |
| 332 | 3D games are the exception (Harry, 8 Oct 2026): | 0.8 | 192 | Keep | – |
| 343 | OLD UI / NEW UI — Settings → UI: Old / New (Harry, 1 Oct 2026) | 0.5 | 132 | Keep | – |
| 352 | SCENARIO RULES COME FROM THE DRAWINGS — the one-on-one way, for every kind | 1.1 | 270 | Keep | – |
| 370 | ALWAYS PLAYTEST STAR CAREER CHANGES — you can now actually see the game | 0.8 | 217 | Keep; delete every older 'can't sign in / not seen live' line elsewhere | low |
| 385 | After ANY change to `lib/star/ | 0.5 | 120 | Keep | – |
| 394 | Env: | 0.5 | 136 | Keep | – |
| 403 | Without valid Supabase env | 0.2 | 45 | Keep | – |
| 407 | The green pre-match button is "Team sheets →", not "Play Match". | 0.4 | 111 | Keep | – |
| 414 | In-match, the ball is NOT centre-bottom. | 0.3 | 66 | Keep | – |
| 421 | How to talk to this team (standing, not per-session) | 0.2 | 54 | Keep header | – |
| 427 | Progress updates follow `.claude/skills/progress-update/SKILL.md`: every 5 | 0.3 | 86 | Keep | – |
| 433 | Deploy only when told (Harry, 12 Oct 2026; replaces "auto-deploy at every | 0.8 | 207 | Keep (latest deploy rule) | – |
| 445 | 3D sizes never change (Harry, 12 Oct 2026). | 0.3 | 74 | Keep | – |
| 450 | Pictures as they come in, not in one go (Harry, 12 Oct 2026). | 0.4 | 97 | Keep | – |
| 456 | Answer shape — key point, key number, key change. | 0.4 | 93 | Keep | – |
| 462 | Write about 80% of the way to ASD-STE100; draw stats and rules (Harry, 2 Oct | 0.5 | 134 | Keep (artifact-house-style holds detail) | – |
| 470 | Every claim carries a number, or admits it has none. | 0.2 | 51 | Keep | – |
| 474 | Say whether you saw it, measured it, or reasoned it. | 0.3 | 85 | Keep | – |
| 480 | Show, don't describe, anything with a size or a shape in it. | 0.2 | 53 | Keep | – |
| 484 | Play it before claiming it works. | 0.1 | 37 | Keep | – |
| 487 | Ask about the one ambiguous word; build the rest. | 0.2 | 53 | Keep | – |
| 491 | When Harry points at a picture, name it back before building (2 Oct 2026). | 0.4 | 90 | Keep | – |
| 497 | Do not agree to be agreeable. | 0.3 | 65 | Keep | – |
| 502 | Build straight onto the branch, then film it (Harry, 27 Sep 2026). | 0.8 | 198 | Keep, shorten | low |
| 514 | Decide, don't toggle (Harry, 12 Oct 2026). This retires the old "every new | 0.6 | 156 | Keep (current toggle rule) | – |
| 524 | Decided, no toggle (12 Oct 2026). | 3.0 | 759 | Move list to lib/star/lookRows.ts header or docs/DECIDED.md; keep 2 lines | low |
| 567 | No more version toggles for new work; unfinished work lives on test pages | 0.9 | 230 | Merge into 'Decide, don't toggle' (same rule twice) | low |
| 581 | No test build link on patch notes (Harry, 3 Oct 2026, latest): mostly stills, clips o | 0.5 | 125 | Keep as THE patch-notes media rule; merge 587 into it | low |
| 587 | Stills for looks, videos only for gameplay and animation (Harry, 3 Oct 2026). | 0.5 | 124 | Merge into 581 | low |
| 595 | No filming phase — patch notes + a test build link (Harry, 2 Oct 2026). This | 0.9 | 222 | Delete (superseded by 581/587: test build link dropped) | low |
| 608 | (Superseded 2 Oct — see above.) Every new thing gets a real video, as standard (Harry | 0.4 | 100 | Delete (marked superseded) | low |
| 613 | Build first, film once at the end (Harry, 1 Oct 2026: "yes standing rule | 0.5 | 128 | Delete or move to film-pass skill (filming phase retired 2 Oct) | low |
| 621 | Filming fast (Harry, 2 Oct 2026): | 0.3 | 67 | Move to film-pass skill | low |
| 626 | Film the "after" on the final combined copy (Harry, 1 Oct 2026). | 0.4 | 115 | Move to film-pass skill | low |
| 633 | Clear disk space before every new build (Harry, 2 Oct 2026). | 0.5 | 116 | Keep (1 line) | – |
| 640 | Perfection with efficiency (Harry, 1 Oct 2026). | 0.4 | 109 | Keep (1 line) | – |
| 647 | Builders check light; Harry judges 3D on his phone (Harry, 5 Oct 2026). | 0.5 | 134 | Keep | – |
| 655 | The change list goes out before the push, every time | 0.2 | 60 | Keep | – |
| 660 | Mikey's `STAR_ROADMAP.md` is his own list (Harry, 5 Oct 2026). | 0.3 | 80 | Keep | – |
| 666 | The match engine may change, with a warning (Harry, 5 Oct 2026). | 0.6 | 161 | Keep | – |
| 676 | Which model for what (Harry, 29 Sep 2026 — standing) | 1.5 | 394 | Shorten: the 1 Oct update overrides half of it; keep the final split only | low |
| 703 | The agent skills, and when each fires | 0.9 | 233 | Keep | – |
| 713 | Working alongside the other two developers | 1.5 | 371 | Keep | – |
| 739 | Pending Migrations | 14.8 | 3799 | Keep as the one migrations table; drop RUN rows older than 30 days to SESSION_LOG | low |
| 774 | Pending Setup (non-database, Sep 2026) | 1.5 | 390 | Delete the 'remote connectors' row (stale guess); keep Sentry row | low |
| 783 | Critical Gotchas | 1.6 | 407 | Keep (the one Gotchas list) | – |
| 795 | PL Draft — Data Status (August 2026) | 2.2 | 567 | Move to a draft-data README | low |
| 808 | Star Career Game (`/star-dev`) — Key Files | 2.8 | 712 | Keep; fix '36 suites' (there are 363) | low |

**Every session entry (line 848 → end): 67 entries, all → `SESSION_LOG.md`.** Keep only a 1-line "latest session" pointer.

| Line | Entry | KB | ~tokens | Action |
|---|---|---|---|---|
| 850 | 8 October 2026 (Leo, cont.) — Goal videos round 3: a commentary box, new cameras and cuts, | 2.2 | 565 | Move to SESSION_LOG.md |
| 861 | 8 October 2026 (Leo) — Goal videos get sound: crowd, kick, net, a commentator, and a speak | 1.8 | 455 | Move to SESSION_LOG.md |
| 870 | 7 October 2026 (Leo) — Goal videos: every goal recorded frame by frame as you play, real v | 4.8 | 1239 | Move to SESSION_LOG.md |
| 883 | 6 October 2026 (Leo, cont. 3) — Retirement revamp, part 3: your records live on, a share p | 5.1 | 1302 | Move to SESSION_LOG.md |
| 895 | 5 October 2026 (Leo, cont. 2) — Retirement revamp, part 2: careers are 20 seasons, a final | 3.1 | 785 | Move to SESSION_LOG.md |
| 905 | 5 October 2026 (Leo, cont.) — Retirement revamp, part 1: a 7-page career overview on a tes | 2.9 | 741 | Move to SESSION_LOG.md |
| 914 | 5 October 2026 (Leo) — Keepers made human, dribble passes, knuckleball/power shot in the t | 2.8 | 711 | Move to SESSION_LOG.md |
| 923 | 24 September 2026 (Harry, cont.) — Trial and training on the real match, the penalty keepe | 2.7 | 683 | Move to SESSION_LOG.md |
| 949 | 24 September 2026 (Harry) — One engine: test screens play the real game, and a build guard | 1.7 | 433 | Move to SESSION_LOG.md |
| 960 | 23 September 2026 (Harry, cont.) — Save/Commit from inside a match, an eye (ⓘ) on every ad | 1.5 | 388 | Move to SESSION_LOG.md |
| 967 | 23 September 2026 (Harry) — Gallery Play matches the picture, mid-match editing, shared co | 1.8 | 471 | Move to SESSION_LOG.md |
| 980 | 23 September 2026 — The five-a-side freeze bug, re-confirmed ball-movement consistency, a  | 9.1 | 2331 | Move to SESSION_LOG.md |
| 995 | 22 September 2026 (cont. 3) — Five more real consistency gaps, all found by reading the ac | 7.8 | 1992 | Move to SESSION_LOG.md |
| 1006 | 22 September 2026 (cont. 2) — Real match, trial and training made to genuinely share one g | 10.0 | 2553 | Move to SESSION_LOG.md |
| 1025 | 22 September 2026 — Goalie Mode round 4: the real "ice rink" bug fixed, other players actu | 9.2 | 2363 | Move to SESSION_LOG.md |
| 1037 | 21 September 2026 (cont. 3) — Goalie Mode round 3: a real, provable cursor bug found and f | 5.2 | 1334 | Move to SESSION_LOG.md |
| 1047 | 21 September 2026 (cont. 2) — Goalie Mode's camera rebuilt against a real reference video, | 5.0 | 1270 | Move to SESSION_LOG.md |
| 1058 | 21 September 2026 (cont.) — Goalie Mode: a new keeper-POV reflex minigame in the Casino, p | 3.1 | 795 | Move to SESSION_LOG.md |
| 1067 | 21 September 2026 — Headers, volleys, and first-time grounded finishes: the first piece of | 11.1 | 2838 | Move to SESSION_LOG.md |
| 1085 | 20 September 2026 — Five-a-side fixed, an 11-a-side positional layer, base-scenario correc | 4.9 | 1254 | Move to SESSION_LOG.md |
| 1100 | 17 September 2026 — New default values for both Face Editors, given directly via two scree | 4.4 | 1134 | Move to SESSION_LOG.md |
| 1108 | 16 September 2026 (cont. 7) — Touch Mode's real "instant catch" bug: every scenario has al | 7.2 | 1841 | Move to SESSION_LOG.md |
| 1119 | 16 September 2026 (cont. 6) — Touch Mode's continuation was rebuilding into an unrelated n | 7.0 | 1802 | Move to SESSION_LOG.md |
| 1128 | 16 September 2026 (cont. 5) — The actual, final Touch Mode bug: an unhandled outcome silen | 6.2 | 1587 | Move to SESSION_LOG.md |
| 1137 | 16 September 2026 (cont. 4) — Touch Mode's real bug all along: the chain that reopens the  | 4.3 | 1112 | Move to SESSION_LOG.md |
| 1145 | 16 September 2026 (cont. 3) — Touch Mode's chase self-defeated: continuous pursuit meant t | 4.3 | 1111 | Move to SESSION_LOG.md |
| 1154 | 16 September 2026 (cont. 2) — Touch Mode's chase was invisible; rebuilt as real, physical, | 5.2 | 1339 | Move to SESSION_LOG.md |
| 1164 | 16 September 2026 (cont.) — Touch Mode boots (a real new ability, not just a stat pair), a | 12.4 | 3165 | Move to SESSION_LOG.md |
| 1176 | 16 September 2026 — The fake-face crop couldn't zoom out far enough to show the whole face | 6.7 | 1721 | Move to SESSION_LOG.md |
| 1188 | 15 September 2026 (cont. 14) — A second, separate editor for the seven fake faces — they'r | 5.6 | 1427 | Move to SESSION_LOG.md |
| 1199 | 15 September 2026 (cont. 13) — Fake faces for every player who has no real one, and the la | 8.5 | 2174 | Move to SESSION_LOG.md |
| 1212 | 15 September 2026 (cont. 12) — The ball now draws behind the keeper once it's actually beh | 2.2 | 562 | Move to SESSION_LOG.md |
| 1219 | 15 September 2026 (cont. 11) — The teammate-side twin of the castDefence bug: an exhausted | 4.0 | 1023 | Move to SESSION_LOG.md |
| 1227 | 15 September 2026 (cont. 10) — KIB Stat Cans: a second, far pricier can that temporarily b | 2.0 | 502 | Move to SESSION_LOG.md |
| 1236 | 15 September 2026 (cont. 9) — Real finesse-shot geometry (aim wide, curl back onto the tar | 8.9 | 2268 | Move to SESSION_LOG.md |
| 1251 | 15 September 2026 (cont. 8) — The real gap in the curl fix: it only ever read the keeper,  | 5.6 | 1437 | Move to SESSION_LOG.md |
| 1263 | 15 September 2026 (cont. 7) — Real live-play feedback on the stats revamp: a genuine, long | 7.2 | 1850 | Move to SESSION_LOG.md |
| 1276 | 15 September 2026 (cont. 6) — The stats revamp: real per-player pace/finishing/passing/dri | 10.8 | 2755 | Move to SESSION_LOG.md |
| 1293 | 15 September 2026 (cont. 5) — The outline reverted to a real alpha-silhouette trace — the  | 3.7 | 948 | Move to SESSION_LOG.md |
| 1303 | 15 September 2026 (cont. 4) — Default offsets corrected, and a real 68-point facial-landma | 1.6 | 417 | Move to SESSION_LOG.md |
| 1309 | 15 September 2026 (cont. 3) — The admin global-default database mechanism ripped back out; | 2.2 | 573 | Move to SESSION_LOG.md |
| 1315 | 15 September 2026 (cont. 2) — The outline now traces the real detected face, not a circle. | 4.6 | 1182 | Move to SESSION_LOG.md |
| 1325 | 15 September 2026 (cont.) — Faces/names toggles, and a real admin "global default" for the | 7.9 | 2024 | Move to SESSION_LOG.md |
| 1336 | 15 September 2026 — The alpha-outline assumption was wrong; replaced with a real crop tool | 4.0 | 1026 | Move to SESSION_LOG.md |
| 1345 | 14 September 2026 (cont. 5) — More editor freedom, and the outline redefined to trace the  | 4.0 | 1025 | Move to SESSION_LOG.md |
| 1353 | 14 September 2026 (cont. 4) — A proper Face Editor replacing the size slider, and your own | 5.3 | 1359 | Move to SESSION_LOG.md |
| 1362 | 14 September 2026 (cont. 3) — Real feedback from the first live look at faces: a user-adju | 6.2 | 1591 | Move to SESSION_LOG.md |
| 1370 | 14 September 2026 (cont. 2) — Real player faces, composited onto every figure on the pitch | 9.7 | 2493 | Move to SESSION_LOG.md |
| 1391 | 14 September 2026 (cont.) — The keeper genuinely dives for real shots now, including ones  | 5.2 | 1335 | Move to SESSION_LOG.md |
| 1401 | 14 September 2026 — Multiple save slots for the star career game, built to degrade to zero | 5.4 | 1383 | Move to SESSION_LOG.md |
| 1412 | 13 September 2026 (cont. 4) — Champions/Europa League rebuilt to the real 36 clubs apiece, | 7.3 | 1868 | Move to SESSION_LOG.md |
| 1428 | 13 September 2026 (cont. 5) — The English qualification rules corrected: only 6th is autom | 3.3 | 855 | Move to SESSION_LOG.md |
| 1439 | 13 September 2026 (cont. 3) — The Champions/Europa League field genuinely reshuffles every | 1.9 | 489 | Move to SESSION_LOG.md |
| 1446 | 13 September 2026 (cont. 2) — A real, votable Rule Book change: Saudi Pro League clubs in  | 2.5 | 641 | Move to SESSION_LOG.md |
| 1455 | 13 September 2026 (cont.) — Real-world club prestige extended to the major European clubs. | 1.0 | 258 | Move to SESSION_LOG.md |
| 1460 | 13 September 2026 — CM unlock, three real Boardroom bugs, a real money stepper, training-f | 6.5 | 1667 | Move to SESSION_LOG.md |
| 1475 | 12 September 2026 (cont. 5) — One real money-formatting standard, everywhere. | 1.3 | 330 | Move to SESSION_LOG.md |
| 1482 | 12 September 2026 (cont. 4) — Position-picker/market-value bugs fixed, league simulation a | 3.7 | 958 | Move to SESSION_LOG.md |
| 1491 | 12 September 2026 (cont. 3) — Real player market values and a full negotiation system, wit | 3.1 | 803 | Move to SESSION_LOG.md |
| 1498 | 12 September 2026 (cont. 2) — Fixed 200%-ownership bug, shipped a consolidated "Ownership" | 3.5 | 886 | Move to SESSION_LOG.md |
| 1506 | 12 September 2026 (cont.) — Gray text replaced with bold white in Rule Book/Investments/Re | 3.1 | 788 | Move to SESSION_LOG.md |
| 1513 | 12 September 2026 — Post-match Continue button relocated, three real media bugs fixed (riv | 4.0 | 1026 | Move to SESSION_LOG.md |
| 1522 | 11 September 2026 (cont.) — The REAL club-badge circle finally found (a fourth attempt), e | 3.0 | 769 | Move to SESSION_LOG.md |
| 1529 | 11 September 2026 — The real white-circle culprit found, wing-backs pushed forward, and th | 14.7 | 3770 | Move to SESSION_LOG.md |
| 1688 | 10 September 2026 — England tab (real league-wide media), a real TrialPenalty bug, club lo | 9.1 | 2329 | Move to SESSION_LOG.md |
| 1701 | 31 August 2026 — Energy rebuilt for real, and a genuinely new injury system. | 3.7 | 954 | Move to SESSION_LOG.md |
| 1713 | 30 August 2026 — Full match-feedback pass, real terrace chants, a false-award bug fixed, a | 4.7 | 1200 | Move to SESSION_LOG.md |
| | **Total** | **345** | **88284** | |

**Duplicated or contradicting rules found in CLAUDE.md (each one):**

| # | Rule | Where | Problem | Action |
|---|---|---|---|---|
| R1 | Pending migrations table | lines 117 and 739 | Two tables, different rows, both "current" | One table (739); move RUN rows older than 30 days to SESSION_LOG |
| R2 | Critical Gotchas | lines 131 and 783 | Same list twice | Keep 783 |
| R3 | "Recent Session Changes" | line 173 | Says latest session is 12 July | Replace with a pointer |
| R4 | Patch-notes media: "No test build link… mostly stills" | 581 | Latest | Keep |
| R5 | "Stills for looks, videos only for gameplay" | 587 | Same subject as R4 | Merge into R4 |
| R6 | "No filming phase — patch notes + a test build link" | 595 | Test-build half overruled by R4 | Delete |
| R7 | "(Superseded 2 Oct) Every new thing gets a real video" | 608 | Marked superseded | Delete |
| R8 | "Build first, film once at the end" | 613 | Filming phase retired by R6/R4 | Delete or move to film-pass skill |
| R9 | "Filming fast" | 621 | Filming only | Move to film-pass skill |
| R10 | "Film the after on the final combined copy" | 626 | Filming only | Move to film-pass skill |
| R11 | "Decide, don't toggle" | 514 | Latest | Keep |
| R12 | "No more version toggles for new work" | 567 | Same rule as R11 | Merge into R11 |
| R13 | "Decided, no toggle" list | 524–566 (4.0 KB) | A list of settings, not a rule | Move to `lib/star/lookRows.ts` header or `docs/DECIDED.md` |
| R14 | Playtest section: "/star-dev can be reached signed out" | 370 | Correct | Keep |
| R15 | "None of this has been seen live / needs Google sign-in" | 24 lines inside session entries (993–1676) | Contradicts R14 | Leave with the entries in SESSION_LOG |
| R16 | "Which model for what" + "Update (1 Oct) overrides the lines above" | 676–702 | Half the block is overridden | Rewrite as the final split only |
| R17 | Pending Setup: "Remote connectors unusable … run locally" | 774 | Guess, marked "not independently verified"; Sep 2026 | Delete or move to SESSION_LOG |
| R18 | "Star Career Game — Key Files": "36 suites" | 841 | There are 363 test files | Fix the number |
| R19 | "Working alongside the other two developers" lanes | 713 | Still valid | Keep |
| R20 | "What's Implemented (Complete)" | 75 | Tierlist-only list, never read for star work | Move to docs/ |
| R21 | "What Needs Improvement / Future Work" | 142 | 6.5 KB of idea notes | Move to docs/FUTURE.md |

### 8c. Skills, agents, handbook

| # | File | SKILL.md bytes | Folder bytes | Files | Finding | Action |
|---|---|---|---|---|---|---|
| K1 | `3d-building` | 2,398 | 2,398 | 1 | Step 6 says "a New \| Old Look toggle for every new look" — contradicts "Decide, don't toggle" | Fix step 6 |
| K2 | `admin-page-guide` | 5,270 | 5,326 | 1 | – | Keep |
| K3 | `artifact-house-style` | 18,827 | 125,003 | 7 | Keeps the 3 Oct "no test build" note plus older test-build text (line 93) | Delete the older lines |
| K4 | `creating-patch-notes` | 17,261 | 478,946 | 18 | 479 KB folder (reference pages/pictures); same stacked test-build notes (lines 38–42) | Trim the stacked notes; move big references to `patch-notes/` |
| K5 | `creating-patch-notes-mikey` | 7,452 | 15,168 | 2 | Same test-build note (line 20) | Trim |
| K6 | `film-pass` | 6,609 | 6,609 | 1 | Filming phase retired 2 Oct for patch notes; still used for gameplay clips | Keep; receive R8–R10 |
| K7 | `one-engine` | 8,279 | 8,299 | 1 | – | Keep; CLAUDE.md ONE ENGINE block can shrink to 5 lines |
| K8 | `playtest-video` | 5,848 | 5,860 | 1 | – | Keep |
| K9 | `progress-update` | 10,303 | 10,496 | 1 | "Auto-deploy at every major update" section (line 85) overruled by "Deploy only when told" | Delete that section |
| K10 | `ui-house-style` | 32,226 | 32,501 | 1 | Biggest skill body; not checked line by line | Review for stale rulings (Q-B5) |
| K11 | `video-to-build` | 2,742 | 2,762 | 1 | – | Keep |
| K12 | `handoff` (listed in this session's skill list) | – | – | – | Not in this worktree's `.claude/skills/` (on another branch) | Check it is merged |
| A1 | agent `explain-and-prompt.md` | 9,280 | | | – | Keep |
| A2 | agent `make-artifact.md` | 3,622 | | | – | Keep |
| A3 | agent `show-options.md` | 5,288 | | | – | Keep |
| A4 | agent `star-playtest.md` | 4,780 | | | – | Keep |
| H1 | `docs/3D_HANDBOOK.md` §5 rule 1 | | | | "Every new look gets a toggle: New \| Old" — contradicts "Decide, don't toggle" | Rewrite rule 1 |
| H2 | `docs/3D_HANDBOOK.md` §1 header + line 52 | | | | Mentions "Settings → Version (Classic / Standard / Preview)" and a Look switch per place — both gone 12 Oct | Rewrite |
| H3 | `docs/3D_HANDBOOK.md` size | 1,041 lines | | | §7 "Recent changes" + handovers ≈ 690 lines of history | Move history to `docs/3D_HISTORY.md` |

### 8d. Code that is not used (measured: `scripts/perf/bloat.py` import graph + a grep check of each)

| # | File | KB | Evidence | Action |
|---|---|---|---|---|
| U1 | `lib/star/data/nonleagueSquads.json` | 314.5 | Only named in NONLEAGUE_README.md; nothing imports it | Delete or move to data/ (not bundled either way) |
| U2 | `components/star/MatchdayScreen.tsx` | 46.0 | Only named in comments (page.tsx 4912, HomeHub 624, LineupIntro, legacy HomeHub) | Delete; fix the comments |
| U3 | `app/draft-dev/DraftDevClient.tsx` | 25.1 | Not imported; draft-dev/page.tsx imports SquadManagerDev directly | Delete |
| U4 | `lib/star/data/nonleagueClubs.json` | 17.7 | Nothing names it | Delete or move to data/ |
| U5 | `components/star/Dribble3D.tsx` | 17.2 | Unmounted since 12 Oct (CanvasMatch comment says so) | Delete or keep for git history only |
| U6 | `components/draft/SquadManager.tsx` | 16.1 | Not imported (draft-dev uses SquadManagerDev) | Check /draft* once more, then delete |
| U7 | `lib/wikidata.ts` | 15.4 | Not imported (only the word 'wikidataId' appears in routes) | Delete |
| U8 | `components/CreateTierlistForm.tsx` | 13.4 | Not imported | Delete |
| U9 | `components/profile/CardDesigns.tsx` | 10.7 | Not imported | Delete |
| U10 | `lib/star/bossChat.ts` | 8.0 | Only tests/star/relationships.mts imports it | Keep if the test matters, else delete both parts |
| U11 | `lib/star/three3d/offscreen.ts` | 6.2 | Only named in comments (perf.ts plan, worker idea) | Delete or keep as the worker plan |
| U12 | `components/star/ShopItemsCard.tsx` | 5.5 | Not imported; legacy has its own copy | Delete |
| U13 | `lib/star/fanmail.ts` | 4.6 | Only named in a tours.ts comment | Delete |
| U14 | `components/profile/RecentActivity.tsx` | 3.7 | Not imported | Delete |
| U15 | `lib/transfermarkt.ts` | 2.4 | Not imported | Delete |
| U16 | `lib/supabase/middleware.ts` | 1.5 | FALSE ALARM: root middleware.ts imports it | Keep |
| U17 | `lib/apiFootball.ts` | 0.9 | Not imported (empty) | Delete |
| U18 | `lib/star/shopNav.ts` | 0.6 | Not imported (empty) | Delete |

### 8e. "Decided, no toggle" getters: the other branch is dead code

Each getter below returns a fixed value since 12 Oct; the code for the other value can no longer run in the game (test pages can still force some).

| # | Getter file | Returns | Dead branch / files | Action |
|---|---|---|---|---|
| G1 | `lib/star/garden3d/look.ts` | "new" | `lib/star/garden3d/sceneOld.ts` (64 KB) + Garden3D.tsx branch | Delete old scene (Q-B6) |
| G2 | `lib/star/cutscene/look.ts` | New | `lib/star/style3d/cutscenesOld.ts` (28 KB) | Delete (Q-B6) |
| G3 | `lib/star/human3d/look.ts` | "before" | Human body path in `people3d.ts` 255/295, `engineView.ts` 270; `public/star/human3d/` **12 MB** | Delete path + files, or keep for a test page (Q-B7) |
| G4 | `lib/star/shopPicsLook.ts` | new pictures | Old drawings `public/star/shop2d/items/` **8.4 MB** | Delete folder (Q-B8) |
| G5 | `lib/star/shopLook.ts` | "new" | Old shop front page | Delete branch |
| G6 | `lib/star/home3d/look.ts` | "new" | Old house look | Delete branch |
| G7 | `lib/star/homeLook.ts` | "new" | Old Home screen | Delete branch |
| G8 | `lib/star/chanceFraming.ts` | "zoom" | Other framings | Delete branch |
| G9 | `lib/star/sprites2dLook.ts` | "stylea" | Other sprite style | Delete branch |
| G10 | `lib/star/look3d.ts` people3dLook | "new" (old only as a load fallback) | – | Keep (fallback is live) |
| G11 | `lib/star/look3d.ts` bossRoomLook | "3d" | 2D boss room | Delete branch |
| G12 | `lib/star/animLook.ts` | New | Old animations | Delete branch |
| G13 | `lib/star/signing3d.ts` (2 getters) | true / "new" | 2D signing, old signing look | Delete branches |
| G14 | `lib/star/matchView.ts` | "new" (test override) | Old match view | Keep override; delete old view if no test page needs it |
| G15 | `lib/star/newLook.ts` | fixed | Old values | Delete branch |
| G16 | `lib/star/play3d/controlScheme.ts` | "auto" | Stored scheme read | Delete branch |
| G17 | `lib/star/badgeLook.ts` | "new" | Old badges | Delete branch |
| G18 | `lib/star/cameraTilt.ts` | 20 | Other tilts | Delete branch |
| G19 | `lib/star/ballonDorNightLook.ts` | "new" | Old night | Delete branch |
| G20 | `lib/star/wideChances.ts` | "old" (dev override) | New wide chances | Keep override |
| G21 | `lib/star/gameplayVersion.ts` | New | Old dribble/keeper (Keepers row kept) | Delete dribble-old only |
| G22 | `lib/star/allSeasonsLook.ts` | "new" | Old All seasons page | Delete branch |
| G23 | `lib/star/casino3d/look.ts` | "3d" | 2D casino | Delete branch |
| G24 | `lib/star/casino3d/roomLook.ts` | "new" | Old room | Delete branch |
| G25 | `lib/star/postMatchPrefs.ts` | true | Off path | Delete branch |
| G26 | `lib/star/ovationLook.ts` | "new" | Old ovation | Delete branch |
| G27 | `lib/star/ovationMoves.ts` | "new" | Old greetings | Delete branch |
| G28 | `lib/star/figureSkin.ts` | "3d" (test override) | Other skins | Keep override |
| G29 | `lib/star/motionLook.ts` | "mocap" | Other motion | Delete branch |
| G30 | `lib/star/style3d/realGameLook.ts` playerLightLook | "old" | New light | Delete branch |
| G31 | `lib/star/style3d/toon/matchLook.ts` | "styleA" | Other match look | Delete branch |
| G32 | `lib/star/style3d/toon/look.ts` | "new" | Old player style | Delete branch |
| G33 | `lib/star/look3dStyle.ts` | "h" | Old 3D look | Delete branch |
| G34 | `lib/star/three3d/tierLook.ts` | "new" (URL override) | Old tier look | Keep override |
| G35 | `lib/star/faceStyle.ts` PHOTO_FACES | off | Photo face drawing + editors (hidden "until the photo revamp") | Keep (planned revamp) |
| G36 | `components/star/legacy/` (Old UI) | – | 1.36 MB; kept by the standing "UI Old \| New" rule | Keep |

Gain: build time and repo size only (these are mostly dynamic imports or small branches; not in Home's first load, measured: none of them in the top modules of 1b). Risk: low per item; each needs tsc + build + one playtest.

### 8f. Dev and admin pages (every one)

| # | Route | Last change | Page KB | First load JS | In admin guide | Linked in code | Note | Action | Q |
|---|---|---|---|---|---|---|---|---|---|
| D1 | `/admin` | 2026-10-11 | 2 | 157 kB | yes | yes | – | Keep | – |
| D2 | `/admin/app-plan` | 2026-09-30 | 1 | 317 kB | yes | yes | – | Keep | – |
| D3 | `/admin/badges` | 2026-10-07 | 8 | 563 kB | yes | yes | – | Keep | – |
| D4 | `/admin/cl-draft` | 2026-09-23 | 20 | 236 kB | yes | yes | – | Keep | – |
| D5 | `/admin/clubs` | 2026-10-02 | 9 | 266 kB | yes | yes | – | Keep | – |
| D6 | `/admin/custom-clubs` | 2026-09-26 | 25 | 769 kB | yes | yes | – | Keep | – |
| D7 | `/admin/football` | 2026-09-26 | 66 | 171 kB | yes | yes | – | Keep | – |
| D8 | `/admin/football/pl-clubs` | 2026-09-23 | 5 | 158 kB | yes | yes | – | Keep | – |
| D9 | `/admin/football/players` | 2026-09-26 | 72 | 164 kB | yes | yes | – | Keep | – |
| D10 | `/admin/football/scrape` | 2026-09-26 | 20 | 161 kB | yes | yes | – | Keep | – |
| D11 | `/admin/patch-notes` | 2026-10-01 | 1 | 317 kB | yes | yes | – | Keep | – |
| D12 | `/admin/sound-board` | 2026-10-02 | 1 | 153 kB | yes | yes | – | Keep | – |
| D13 | `/admin/star-pass` | 2026-10-05 | 13 | 288 kB | yes | yes | – | Keep | – |
| D14 | `/admin/star-xp` | 2026-10-11 | 23 | 233 kB | yes | yes | – | Keep | – |
| D15 | `/admin/testers` | 2026-10-05 | 1 | 149 kB | yes | yes | – | Keep | – |
| D16 | `/admin/xp` | 2026-09-26 | 22 | 167 kB | yes | yes | – | Keep | – |
| D17 | `/draft-challenge-dev` | 2026-10-05 | 0 | 235 kB | yes | yes | – | Keep | – |
| D18 | `/draft-dev` | 2026-09-23 | 54 | 299 kB | yes | yes | Near copy of /draft-dev2 (16 diff lines, both 54 KB) | Merge into one page | Q-B9 |
| D19 | `/draft-dev2` | 2026-09-23 | 54 | 299 kB | yes | yes | Near copy of /draft-dev | Keep this one (DraftSetupHero links here) | Q-B9 |
| D20 | `/draft/american` | 2026-09-02 | 18 | 183 kB | no | no | Standalone sandbox (CLAUDE.md); not linked | Ask | Q-B12 |
| D21 | `/draft/preview` | 2026-09-23 | 1 | 150 kB | yes | yes | Dev preview | Ask | Q-B12 |
| D22 | `/manager` | 2026-09-02 | 12 | 120 kB | no | no | Manager mode page; not in guides/links found | Check it is still a live game mode | Q-B14 |
| D23 | `/profile-new` | 2026-09-23 | 0 | 163 kB | yes | yes | Dev copy of /profile | Ask | Q-B12 |
| D24 | `/sfx-dev` | 2026-10-05 | 2 | 94.3 kB | yes | no | Not linked; Sound Board is /admin/sound-board | Ask | Q-B12 |
| D25 | `/squad-builder` | 2026-10-05 | 0 | 106 kB | yes | no | In guides, not linked from code | Keep | – |
| D26 | `/star-3d-area-dev` | 2026-10-05 | 9 | 164 kB | yes | yes | – | Keep | – |
| D27 | `/star-3d-area-dev/office` | 2026-10-05 | 4 | 705 kB | yes | yes | – | Keep | – |
| D28 | `/star-3d-area-dev/signing` | 2026-10-03 | 9 | 247 kB | yes | yes | – | Keep | – |
| D29 | `/star-3d-dev` | 2026-10-05 | 10 | 1.04 MB | yes | yes | 'One of every mode in 3D skin'; 1.04 MB | Ask | Q-B12 |
| D30 | `/star-anim3d-dev` | 2026-10-12 | 6 | 249 kB | yes | yes | – | Keep | – |
| D31 | `/star-animations-dev` | 2026-10-13 | 14 | 228 kB | yes | yes | – | Keep | – |
| D32 | `/star-attack-dev` | 2026-09-26 | 5 | 325 kB | yes | yes | Last change 26 Sep | Ask | Q-B12 |
| D33 | `/star-bicycle-dev` | 2026-10-05 | 0 | 259 kB | yes | yes | 0 KB page shell; bicycle kick test | Ask | Q-B12 |
| D34 | `/star-bigger-dev` | 2026-10-13 | 2 | 913 kB | no | no | Not in the admin menu, not linked; 913 KB first load | Delete or add to the menu | Q-B11 |
| D35 | `/star-blender-dev` | 2026-10-05 | 19 | 631 kB | yes | yes | – | Keep | – |
| D36 | `/star-dev` | 2026-10-14 | 267 | 1.21 MB | yes | yes | – | Keep | – |
| D37 | `/star-dev/media-lab` | 2026-10-12 | 23 | 1.13 MB | yes | yes | – | Keep | – |
| D38 | `/star-dribble-dev` | 2026-09-28 | 8 | 320 kB | yes | yes | Older dribble sandbox; the duel lives on /star-dribble-stick-dev | Ask | Q-B12 |
| D39 | `/star-dribble-stick-dev` | 2026-10-14 | 2 | 966 kB | yes | yes | First-person duel only (CLAUDE.md: kept on purpose) | Keep | – |
| D40 | `/star-gallery-dev` | 2026-10-14 | 95 | 1 MB | yes | yes | – | Keep | – |
| D41 | `/star-garden3d-dev` | 2026-10-09 | 5 | 739 kB | yes | yes | – | Keep | – |
| D42 | `/star-goal-clips-dev` | 2026-10-12 | 8 | 1.01 MB | yes | yes | – | Keep | – |
| D43 | `/star-highlights-dev` | 2026-10-14 | 49 | 998 kB | yes | yes | – | Keep | – |
| D44 | `/star-home3d-dev` | 2026-10-09 | 5 | 615 kB | yes | yes | – | Keep | – |
| D45 | `/star-intl-dev` | 2026-10-13 | 16 | 763 kB | yes | yes | – | Keep | – |
| D46 | `/star-look-dev` | 2026-10-09 | 7 | 151 kB | yes | yes | – | Keep | – |
| D47 | `/star-match-dev` | 2026-10-05 | 16 | 825 kB | yes | yes | Full engine fork (canvasEngineTest/hiddenMatchTest/CanvasMatchTest); CLAUDE.md lists it 'to port next' | Port what is still wanted, then delete the fork | Q-B10 |
| D48 | `/star-people-dev` | 2026-10-09 | 6 | 244 kB | yes | yes | – | Keep | – |
| D49 | `/star-play-dev` | 2026-10-14 | 19 | 992 kB | yes | yes | – | Keep | – |
| D50 | `/star-radar-dev` | 2026-10-14 | 16 | 643 kB | yes | yes | – | Keep | – |
| D51 | `/star-real-moments-dev` | 2026-10-09 | 9 | 968 kB | yes | yes | – | Keep | – |
| D52 | `/star-relgames-dev` | 2026-10-07 | 6 | 999 kB | yes | yes | – | Keep | – |
| D53 | `/star-retirement-dev` | 2026-10-11 | 20 | 851 kB | yes | yes | – | Keep | – |
| D54 | `/star-scenario-dev` | 2026-09-23 | 2 | 211 kB | yes | yes | Scenario Builder; also a tab inside /star-gallery-dev | Delete the page, keep the tab | Q-B13 |
| D55 | `/star-shop3d-dev` | 2026-10-09 | 1 | 294 kB | yes | yes | – | Keep | – |
| D56 | `/star-sim90-dev` | 2026-10-14 | 24 | 1.01 MB | yes | yes | – | Keep | – |
| D57 | `/star-sound-lab-dev` | 2026-10-14 | 15 | 162 kB | yes | yes | – | Keep | – |
| D58 | `/star-spin-dev` | 2026-10-05 | 7 | 627 kB | yes | yes | Small one-off test | Ask | Q-B12 |
| D59 | `/star-sprites-dev` | 2026-10-07 | 10 | 250 kB | yes | yes | – | Keep | – |
| D60 | `/star-statsbomb-dev` | 2026-10-14 | 16 | 997 kB | yes | yes | – | Keep | – |
| D61 | `/star-store-dev` | 2026-10-05 | 7 | 370 kB | yes | yes | – | Keep | – |
| D62 | `/star-style-dev` | 2026-10-09 | 1 | 1 MB | yes | yes | Main 3D test bench (handbook) | Keep | – |
| D63 | `/star-tournament-dev` | 2026-10-12 | 5 | 445 kB | no | no | Not in the admin menu, not linked | Add to the menu or delete | Q-B11 |
| D64 | `/star-training-dev` | 2026-10-05 | 6 | 980 kB | yes | yes | – | Keep | – |
| D65 | `/star-training3d-dev` | 2026-10-09 | 5 | 1.06 MB | yes | yes | – | Keep | – |
| D66 | `/star-tuning-dev` | 2026-09-23 | 2 | 273 kB | yes | yes | CLAUDE.md: 'commits nothing' | Ask | Q-B12 |
| D67 | `/star-update-dev` | 2026-10-14 | 5 | 171 kB | yes | yes | – | Keep | – |
| D68 | `/star-wallet-dev` | 2026-10-07 | 8 | 160 kB | yes | yes | – | Keep | – |
| D69 | `/star-zoomgrass-dev` | 2026-10-11 | 1 | 912 kB | no | no | Not in the admin menu, not linked; 912 KB first load | Delete or add to the menu | Q-B11 |

Each dev page is built and type-checked on every deploy (build 7 min 34 s here for 101 routes). Gain from deleting one: seconds of build time; main gain is less to wade through.

### 8g. public/ (139 MB, 1,031 files)

Biggest 40 files:

| # | File | KB | Action |
|---|---|---|---|
| B1 | `/models/facescan/wasm/vision_wasm_internal.wasm` | 11481 | Face scanner (loaded only when used); keep |
| B2 | `/star/human3d/human.ktx2.glb` | 6553 | Unreachable in the game (3D body: Human is 'Decided' off); keep only for test pages |
| B3 | `/star/human3d/human.glb` | 5503 | Unreachable in the game (3D body: Human is 'Decided' off); keep only for test pages |
| B4 | `/models/facescan/face_landmarker.task` | 3670 | Face scanner (loaded only when used); keep |
| B5 | `/f3d83465-95e8-48a7-b770-8bedcd65e0c1-Photoroom.png` | 2761 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B6 | `/ChatGPT Image Aug 28, 2026, 03_55_20 AM.png` | 2537 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B7 | `/star/contract.png` | 2537 | Has a .webp twin; keep the PNG only if code still asks for it |
| B8 | `/ChatGPT Image Jul 26, 2026, 09_48_46 PM-Photoroom.png` | 2470 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B9 | `/star/fa-youth-cup-newspaper.png` | 2262 | Has a .webp twin; keep the PNG only if code still asks for it |
| B10 | `/star/star-pass/reward-slow-runup.webp` | 2166 | Keep |
| B11 | `/United 9-0.png` | 2093 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B12 | `/Arsenal Invincibles.png` | 1555 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B13 | `/star/onebody/manager.ktx2.glb` | 1497 | Keep |
| B14 | `/star/onebody/player.ktx2.glb` | 1433 | Keep |
| B15 | `/star/onebody/player-long.ktx2.glb` | 1425 | Keep |
| B16 | `/star/onebody/player-buzz.ktx2.glb` | 1413 | Keep |
| B17 | `/star/stadium-domestic.png` | 1303 | Has a .webp twin; keep the PNG only if code still asks for it |
| B18 | `/star/star-pass/reward-car.webp` | 1212 | Keep |
| B19 | `/Klopp and Pep.png` | 1137 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B20 | `/Erling Haaland.png` | 1123 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B21 | `/star/kane-moments.json` | 1062 | Keep |
| B22 | `/ball.png` | 1035 | Has a .webp twin; keep the PNG only if code still asks for it |
| B23 | `/star/signing3d/people.glb` | 995 | Keep |
| B24 | `/Jose Mourinho.png` | 894 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B25 | `/star/star-pass/3d/reward-glasses.glb` | 868 | Keep |
| B26 | `/Petr Cech.png` | 834 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B27 | `/models/facescan/hair_segmenter.tflite` | 763 | Face scanner (loaded only when used); keep |
| B28 | `/Bruno Fernandes.png` | 724 | Site-root picture: check which page uses it; move into a folder, WebP it |
| B29 | `/star/shop3d/items/car-family-hf.ktx2.glb` | 702 | Keep |
| B30 | `/star/anims3d/mocap-ual.glb` | 645 | Keep |
| B31 | `/star/shop3d/items/bike-hf.ktx2.glb` | 636 | Keep |
| B32 | `/star/sprites/atlas-1a.webp` | 632 | Keep |
| B33 | `/star/shop3d/items/car-suv-hf.ktx2.glb` | 630 | Keep |
| B34 | `/star/anims3d/mocap.glb` | 626 | Keep |
| B35 | `/star/shop3d/items/car-classic-hf.ktx2.glb` | 626 | Keep |
| B36 | `/star/shop3d/items/car-hatch-hf.ktx2.glb` | 613 | Keep |
| B37 | `/star/sprites/atlas-1.webp` | 611 | Keep |
| B38 | `/star/star-pass/reward-penalty.webp` | 605 | Keep |
| B39 | `/star/shop3d/items/home-stable-hf.ktx2.glb` | 596 | Keep |
| B40 | `/star/shop3d/items/boot-classic-hf.ktx2.glb` | 584 | Keep |

Files no code names literally (66 non-sound files; most are asked for by a built name like `${id}.webp`, so their folder is named):

| # | File | KB | Named in code? | Action |
|---|---|---|---|---|
| P1 | `/ChatGPT Image Aug 28, 2026, 03_55_20 AM.png` | 2537 | folder only | Delete (nothing names it or its folder by a built name) |
| P2 | `/ChatGPT Image Jul 26, 2026, 09_48_46 PM-Photoroom.png` | 2470 | folder only | Delete (nothing names it or its folder by a built name) |
| P3 | `/home/title-stadium-day.webp` | 184 | folder only | Check the title/home picker ids; delete any id no longer listed |
| P4 | `/home/title-stadium-sunset.webp` | 139 | folder only | Check the title/home picker ids; delete any id no longer listed |
| P5 | `/home/scene-day.webp` | 133 | folder only | Check the title/home picker ids; delete any id no longer listed |
| P6 | `/star/app-icon-512.png` | 120 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P7 | `/star/blender/clips/idle.webm` | 115 | folder only | Check `/star-blender-dev` only; delete if that page goes |
| P8 | `/home/title-stadium-night.webp` | 109 | folder only | Check the title/home picker ids; delete any id no longer listed |
| P9 | `/star/blender/clips/celebrate.webm` | 107 | folder only | Check `/star-blender-dev` only; delete if that page goes |
| P10 | `/home/scene-night.webp` | 92 | folder only | Check the title/home picker ids; delete any id no longer listed |
| P11 | `/star/app-icon-maskable-512.png` | 78 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P12 | `/star/blender/clips/kneeslide.webm` | 74 | folder only | Check `/star-blender-dev` only; delete if that page goes |
| P13 | `/home/tall-sunset.webp` | 67 | folder only | Check the title/home picker ids; delete any id no longer listed |
| P14 | `/home/tall-day.webp` | 65 | folder only | Check the title/home picker ids; delete any id no longer listed |
| P15 | `/star/shop2d/burst.webp` | 57 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P16 | `/star/shop2d/items3d/rolex.webp` | 51 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P17 | `/star/shop2d/items3d/house-1.webp` | 49 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P18 | `/star/shop2d/items3d/flat-2.webp` | 46 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P19 | `/star/shop2d/items3d/house-2.webp` | 46 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P20 | `/star/shop2d/items3d/estate.webp` | 43 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P21 | `/star/shop2d/items3d/stable.webp` | 42 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P22 | `/star/shop2d/items3d/penthouse.webp` | 41 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P23 | `/star/shop2d/fx-touch.webp` | 39 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P24 | `/star/shop2d/items3d/island.webp` | 37 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P25 | `/star/shop2d/items3d/villa.webp` | 36 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P26 | `/star/shop2d/fx-energy.webp` | 34 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P27 | `/star/shop2d/items3d/boot-control.webp` | 33 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P28 | `/star/shop2d/items3d/boot-power.webp` | 33 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P29 | `/star/shop2d/items3d/boot-curl.webp` | 31 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P30 | `/star/shop2d/items3d/boot-speed.webp` | 31 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P31 | `/star/shop2d/items3d/boot-maestro.webp` | 30 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P32 | `/star/shop2d/fx-power.webp` | 27 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P33 | `/star/shop2d/fx-curve.webp` | 26 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P34 | `/star/shop2d/items3d/silver.webp` | 26 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P35 | `/star/app-icon-192.png` | 23 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P36 | `/star/shop2d/items3d/flat-1.webp` | 22 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P37 | `/star/shop2d/hero.webp` | 21 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P38 | `/star/shop2d/frame-5.webp` | 21 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P39 | `/star/shop2d/items3d/boot-elite.webp` | 18 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P40 | `/star/shop2d/divider.webp` | 17 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P41 | `/star/shop2d/items3d/smartwatch.webp` | 17 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P42 | `/star/shop2d/items3d/boot-starter.webp` | 16 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P43 | `/star/shop2d/items3d/diamond.webp` | 15 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P44 | `/star/shop2d/frame-4.webp` | 15 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P45 | `/star/shop2d/panel.webp` | 14 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P46 | `/star/banners/LICENSE-LuckiestGuy.txt` | 11 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P47 | `/star/shop2d/icon-drip.webp` | 10 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P48 | `/star/shop2d/icon-homes.webp` | 9 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P49 | `/star/shop2d/icon-boots.webp` | 9 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P50 | `/star/shop2d/icon-holiday.webp` | 9 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P51 | `/star/shop2d/icon-gadgets.webp` | 9 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P52 | `/star/shop2d/icon-style.webp` | 9 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P53 | `/star/shop2d/frame-3.webp` | 8 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P54 | `/star/shop2d/frame-2.webp` | 8 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P55 | `/star/shop2d/icon-cars.webp` | 8 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P56 | `/star/shop2d/icon-cans.webp` | 7 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P57 | `/star/shop2d/rank-3.webp` | 7 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P58 | `/star/shop2d/rank-2.webp` | 6 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P59 | `/star/shop2d/rank-4.webp` | 6 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P60 | `/star/shop2d/frame-1.webp` | 6 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P61 | `/star/shop2d/rank-5.webp` | 6 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P62 | `/star/shop2d/badge-gold.webp` | 5 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P63 | `/star/shop2d/rank-1.webp` | 5 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P64 | `/star/shop2d/badge-blue.webp` | 4 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P65 | `/star/shop2d/badge-green.webp` | 4 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |
| P66 | `/star/anims3d/LICENSE-mocap.txt` | 3 | folder only | Keep: folder is named by a built path (e.g. `${id}.webp`); confirm with the id list |

Sound files no code names literally: 109 files, 3134 KB, all under `/sfx/` (`sfxUrl(name)` builds `/sfx/${name}.mp3`). Each needs checking against `lib/star/sfxCatalog.ts` ids: Appendix C.

PNG/GLB files with a lighter twin (measured, `twins.py`):

| # | File | KB | Twin | Action |
|---|---|---|---|---|
| T1 | `/ball.png` | 1,035 | `/ball.webp` | Code still names the PNG: switch to WebP, then delete PNG |
| T2 | `/star/contract.png` | 2,537 | `.webp` | Same |
| T3 | `/star/fa-youth-cup-newspaper.png` | 2,262 | `.webp` | Same |
| T4 | `/star/stadium-domestic.png` | 1,303 | `.webp` | Same |
| T5 | `/star/stadium-europe.png` | 261 | `.webp` | Same |
| T6 | `/star/ball.png` | 253 | `.webp` | Same |
| T7 | `/star/kib-basic.png` | 209 | `.webp` | Same |
| T8 | `/star/kib-premium.png` | 207 | `.webp` | Same |
| T9 | `/star/kib-elite.png` | 278 | `.webp` | Same |
| T10 | `/star/scout/red-frame.png` | 544 | `.webp` | Same |
| T11 | `/star/scout/gold-frame.png` | 492 | `.webp` | Same |
| T12 | `/star/scout/blue-frame.png` | 489 | `.webp` | Same |
| T13 | `/star/sprites/mask-0.png` | 334 | `.webp` | Check: masks may need lossless PNG (Q-B15) |
| T14 | `/star/sprites/mask-0a.png` | 217 | `.webp` | Same |
| T15 | `/star/sprites/mask-1.png` | 311 | `.webp` | Same |
| T16 | `/star/sprites/mask-1a.png` | 262 | `.webp` | Same |
| T17 | 34 GLBs with a `.ktx2.glb` twin (`/star/human3d/human.glb`, 4 `/star/onebody/*.glb`, 29 `/star/shop3d/items/*-hf.glb`) | 13,900 | `.ktx2.glb` | Keep: the plain GLB is the fallback when KTX2 fails |

Root-level pictures (site root, outside any folder): `/f3d83465-…-Photoroom.png` 2,761 KB, `/ChatGPT Image Aug 28…png` 2,537 KB (unnamed), `/ChatGPT Image Jul 26…png` 2,470 KB (unnamed), `/United 9-0.png` 2,093 KB, `/Arsenal Invincibles.png` 1,555 KB, `/Klopp and Pep.png` 1,137 KB, `/Erling Haaland.png` 1,123 KB, `/Jose Mourinho.png` 894 KB, `/Petr Cech.png` 834 KB, `/Bruno Fernandes.png` 724 KB → move into `public/site/`, WebP them (~85% smaller, measured on the 20 earlier conversions: 20.6 → 1.4 MB), delete the 2 unnamed.

### 8h. Repo organisation: what a new chat wades through

Top level:

| # | Item | Size | Action |
|---|---|---|---|
| O1 | `AUDIT_DRAFT_MODE.md` | 31 KB, 215 lines | Move to `docs/archive/` |
| O2 | `BADGES_PLAN.md` | 2.4 KB | Move to `docs/plans/` |
| O3 | `BADGES_ADMIN.png` | 172 KB | Move to `docs/plans/` |
| O4 | `BADGES_SYMBOLS.png` | 227 KB | Move to `docs/plans/` |
| O5 | `LOOK_PLAN.md` | 1.1 KB | Move to `docs/plans/` |
| O6 | `MANAGER_PLAN.md` | 5.5 KB | Move to `docs/plans/` |
| O7 | `PAID_ITEMS.md` | 5.1 KB | Move to `docs/` (CLAUDE.md links it: update link) |
| O8 | `README.md` | 6.6 KB | Keep; check it is current |
| O9 | `SESSION_LOG.md` | 40 KB | Keep (receives L2) |
| O10 | `STAR_CAREER_OPENING_AND_ECONOMY.md` | 49 KB | Move to `docs/star/` |
| O11 | `STAR_FIVE_A_SIDE_PLAN.md` | 39 KB | Move to `docs/star/` |
| O12 | `STAR_GARDEN.md` | 9.8 KB | Move to `docs/star/` |
| O13 | `STAR_LIFE_EVENTS.md` | 19 KB | Move to `docs/star/` |
| O14 | `STAR_POWER_POLITICS.md` | 39 KB | Move to `docs/star/` |
| O15 | `STAR_ROADMAP.md` | 4.0 KB | Keep at top (Mikey's list) or `docs/star/` (Q-B16) |
| O16 | `STAR_SPONSOR_IDEAS.md` | 14 KB | Move to `docs/star/` |
| O17 | `star_careers.sql` | 1 KB | Move to `supabase/migrations/` |
| O18 | `patch-notes/` | 125 MB (pages 62 MB, reviews 59 MB, mikey 6.4 MB) | Move out of the repo (artifacts already hold them) or Git LFS (Q-B1) |
| O19 | `playtest-notes/` | 33 MB, 13 folders (huge-1001 12 MB, v0231rev-1002 7.9 MB, uihome-1001 5.8 MB, v023rev-1001 3.2 MB, mikey-1002 2.2 MB, mikeyreview-0930 1.5 MB, home-bg 0.4 MB, harry-0927-v015, review-0930, feedback-0930, app-company-0930, harry-1002-live) | Same as O18 (Q-B1) |
| O20 | `tools/` | 74 MB, 25 folders (modeltest 39 MB, blender-footballer 18 MB, blender-shop 9.5 MB, models3d 5.0 MB, star-pass-art 1.7 MB, human3d 0.9 MB; 19 under 0.2 MB) | Keep sources (handbook rule); move `modeltest` (39 MB test renders) out (Q-B2) |
| O21 | `docs/` | 216 KB: `3D_HANDBOOK.md`, `gameplay15/` (6 files), `gameplay16/` (1), `money-balance-oct2026.md`, `next-window-gameplay-plan.md` | Keep; add `docs/star/`, `docs/plans/`, `docs/archive/` |
| O22 | `supabase/` | 102 migrations + 3 loose `.sql` | Add a `supabase/README.md` with the one status table (replaces R1) |
| O23 | `data/` | 4.1 MB (statsbomb 3.1 MB, names 0.5 MB, ballondor 0.5 MB, fifa) | Keep |
| O24 | `.git` | 614 MB on disk | Grows with every picture/video folder above; O18–O20 decide it |

`scripts/` (41 entries):

| # | Item | KB | Action |
|---|---|---|---|
| O25 | `perf3d/` | 284 | Keep |
| O26 | `perf2d/` | 32 | Fold into `perf/` (same measuring, older copy) |
| O27 | `perf/` (new, uncommitted) | 64 | Commit when the plan is approved (Q-B17) |
| O28 | `playtest-video/` | 84 | Keep |
| O29 | `people3d/` | 84 | Keep |
| O30 | `star-sandbox/` | 68 | Keep |
| O31 | `cam3d/` | 68 | Keep |
| O32 | `look-tuner/` | 56 | Keep |
| O33 | `film/` | 40 | Keep (film-pass) |
| O34 | `sfx/` | 36 | Keep |
| O35 | `names/` | 32 | Keep |
| O36 | `money-sim/` | 24 | Keep |
| O37 | `cutscene/` | 24 | Keep |
| O38 | `hooks/` | 16 | Keep |
| O39 | `statsbomb/` | 12 | Keep |
| O40 | `lib/` | 12 | Keep |
| O41 | `commentary/` | 12 | Keep |
| O42 | `shots/` | 8 | Check, else delete |
| O43 | `mac-tools/` | 8 | Keep |
| O44 | `club-data/` | 8 | Keep |
| O45 | `scrape_missing.py` | 80 | Move to `scripts/sofifa/` |
| O46 | `fc27_fill_assets.py` | 40 | Move to `scripts/sofifa/` |
| O47 | `upload_club_logos.py` | 16 | Move to `scripts/sofifa/` |
| O48 | `scrape_pl_logos.py` | 16 | Move to `scripts/sofifa/` |
| O49 | `upload_player_images.py` | 12 | Move to `scripts/sofifa/` |
| O50 | `upload_pl_draft_images.py` | 12 | Move to `scripts/sofifa/` |
| O51 | `debug_sofifa_markup.mjs` | 8 | Delete (one-off debug) |
| O52 | `one-engine-guard.mjs` | 24 | Keep |
| O53 | `patch-notes-artifact.mts` | 12 | Keep |
| O54 | `tuning-notes.mts` | 8 | Keep |
| O55 | `tuner-proposals.mts` | 8 | Keep |
| O56 | `match-view-outline.mts` | 8 | Check, else delete |
| O57 | `match-flow-measure.mts` | 8 | Keep |
| O58 | `assets3d-manifest.mjs` | 8 | Keep |
| O59 | `signing3d-shot.mjs` | 4 | Check, else delete |
| O60 | `run-star-tests.sh` | 4 | Delete (duplicate of `.mjs`) |
| O61 | `run-star-tests.mjs` | 4 | Keep |
| O62 | `position-spread.mts` | 4 | Check, else delete |
| O63 | `cleanup-unused-images.ts` | 4 | Check, else delete |
| O64 | `check-handbook-paths.mjs` | 4 | Keep |
| O65 | `build-start.mjs` | 4 | Keep |

### 8i. Could not check

| # | Thing | Why |
|---|---|---|
| X1 | Whether each `/sfx/*.mp3` id is still in `sfxCatalog.ts` | Not cross-checked id by id (Appendix C lists them) |
| X2 | Each "Delete branch" in 8e: exact lines | Getter read; callers not opened one by one |
| X3 | `ui-house-style` SKILL.md (32 KB) line by line | Not read in full |
| X4 | Whether `patch-notes/` pictures are linked from live artifacts | Artifacts not opened |
| X5 | Real-phone numbers | No phone here (section 6) |
| X6 | Dates in 8f | Clone history starts 2 Sep 2026 (shallow), so "last change" is never earlier |

### 8j. Open questions — bloat and organisation

| # | Question | Recommended |
|---|---|---|
| Q-B1 | `patch-notes/` (125 MB) and `playtest-notes/` (33 MB): move out of the repo (a shared drive / artifacts), keep in Git LFS, or keep as is? | **Updated 16 Oct:** split — keep `patch-notes/pages/` (62 MB; the admin archive serves full pages from it via `lib/patchNotePageServe.ts`), move `patch-notes/reviews/` (59 MB) + `playtest-notes/` (33 MB) out with a README of links. Chats never auto-read these folders, so no context is lost. LFS = option B (Vercel must be set to fetch LFS). |
| Q-B2 | `tools/modeltest/` (39 MB of test renders): delete? | Yes |
| Q-B3 | Move all 67 session entries out of CLAUDE.md to SESSION_LOG.md now (−88k tokens a turn)? | Yes |
| Q-B4 | New rule: CLAUDE.md gets no session entries at all; every session adds to SESSION_LOG.md only? | Yes |
| Q-B5 | Review `ui-house-style` (32 KB) for stale rulings in the same pass? | Yes |
| Q-B6 | Delete frozen old 3D scenes that can no longer be reached (garden `sceneOld.ts`, `cutscenesOld.ts`)? CLAUDE.md says "Old versions live in git" | Yes |
| Q-B7 | 3D body "Human" (12 MB in `public/star/human3d/`, never shown in the game): delete, or keep for a test page? | Delete; git has it |
| Q-B8 | Old shop drawings `public/star/shop2d/items/` (8.4 MB): delete? | Yes |
| Q-B9 | `/draft-dev` and `/draft-dev2` differ by one import (DraftSetupV2 vs DraftSetupHero): keep one? | Keep `/draft-dev2` |
| Q-B10 | `/star-match-dev` engine fork (418 KB of copied engine): port what is wanted and delete? | Yes |
| Q-B11 | `/star-bigger-dev`, `/star-zoomgrass-dev`, `/star-tournament-dev`: not in the admin menu. Delete or list? | Delete the first two; list the tournament page |
| Q-B12 | One-off dev pages marked "Ask" in 8f (bicycle, spin, dribble, attack, tuning, sfx-dev, star-3d-dev, draft/american, profile-new, draft/preview): Harry/Mikey/Leo to tick keep or delete | One owner answers per page |
| Q-B13 | `/star-scenario-dev` duplicates the gallery's Scenario Builder tab: delete the page? | Yes |
| Q-B14 | `/manager` (manager mode): still a live game mode? | Ask Mikey |
| Q-B15 | Sprite masks: keep PNG (lossless) or use the WebP twins? | Keep PNG until a still compares them |
| Q-B16 | `STAR_ROADMAP.md`: keep at the top level (Mikey's list) or move to `docs/star/`? | Keep at top level |
| Q-B17 | Commit `scripts/perf/` (the measuring tools) with the first lag fix? | Yes |
| Q-B18 | Move the 6 SoFIFA scripts into `scripts/sofifa/`? | Yes |
| Q-B19 | Delete the 18 unused source files in 8d (except `lib/supabase/middleware.ts`)? | Yes, one commit, after tsc + build |
| Q-B20 | Delete the dead branches of the 26 "Delete branch" getters in 8e? | Yes, in 3 batches with a playtest each |
| Q-B21 | Root-level site pictures: move to `public/site/` and WebP them? | Yes |
| Q-B22 | Handbook history (§7, handovers, ~690 lines) to `docs/3D_HISTORY.md`? | Yes |
| Q-B23 | Fix the handbook and the 3d-building skill to "Decide, don't toggle"? | Yes |
| Q-B24 | Delete the "Auto-deploy" section of the progress-update skill? | Yes |
| Q-B25 | Order: CLAUDE.md trim first (cheapest, every turn), then lag steps 1–5, then code/asset deletions? | Yes |


---

## Appendix A. Raw measured steps (scripts/perf/table.mjs)

From `run-cold2`, `run-menus`, `run-match`, `run-cold` (places only).

| Step | Shown ms | Still ms | Long tasks n / total / worst ms | JS KB | React commits |
|---|---|---|---|---|---|
| coldTitle | 1774 | 6950 | 12 / 1547 / 338 | 1706 | 10 |
| coldTitleReload | 653 | 6832 | 8 / 1210 / 255 | 0 | 11 |
| coldHome | 5184 | 11584 | 46 / 8948 / 523 | 1511 | 14 |
| coldHomeReload | 5803 | 16976 | 47 / 8753 / 1148 | 45 | 17 |
| homeIdle5s (frames) | fps 13 · p50 33.3 ms · p95 250 ms · worst 367 ms · >33ms 28 | long 7/955 ms | React commits/s 0.2 |||
| menu settings open | 411 | 4835 | 2 / 301 / 187 | 352 | 4 |
| menu settings back | 6323 | 7656 | 4 / 6451 / 3739 | 0 | 5 |
| menu settingsAgain open | 219 | 228 | 1 / 77 / 77 | 0 | 3 |
| menu settingsAgain back | 6687 | 7759 | 4 / 6613 / 3909 | 0 | 5 |
| menu stats open | 83 | 71 | 1 / 69 / 69 | 0 | 2 |
| menu stats back | 114 | 92 | 1 / 88 / 88 | 0 | 1 |
| menu statsAgain open | 58 | 52 | 0 / 0 / 0 | 0 | 1 |
| menu statsAgain back | 108 | 51 | 0 / 0 / 0 | 0 | 1 |
| menu shop open | 308 | 309 | 1 / 212 / 212 | 0 | 2 |
| menu shop back | 5288 | 6456 | 4 / 5678 / 4251 | 0 | 5 |
| menu shopAgain open | 168 | 174 | 1 / 114 / 114 | 0 | 2 |
| menu shopAgain back | 3983 | 5010 | 4 / 4274 / 3017 | 0 | 5 |
| menu league open | 482 | 502 | 1 / 370 / 370 | 0 | 4 |
| menu league back | 8561 | 9622 | 4 / 8753 / 6575 | 0 | 5 |
| menu leagueAgain open | 210 | 218 | 1 / 115 / 115 | 0 | 4 |
| menu leagueAgain back | 8602 | 9726 | 4 / 8982 / 6952 | 0 | 5 |
| menu training open | 122 | 54 | 0 / 0 / 0 | 0 | 1 |
| menu training back | 7455 | 7430 | 2 / 6232 / 4662 | 0 | 3 |
| menu trainingAgain open | 119 | 54 | 1 / 51 / 51 | 0 | 1 |
| menu trainingAgain back | 7682 | 7674 | 2 / 6637 / 5377 | 0 | 3 |
| menu phone open | 247 | 186 | 2 / 166 / 96 | 0 | 2 |
| menu phone back | 12095 | 12088 | 2 / 11750 / 9070 | 0 | 3 |
| menu phoneAgain open | 131 | 115 | 2 / 103 / 52 | 0 | 2 |
| menu phoneAgain back | 14179 | 14165 | 2 / 13813 / 10722 | 0 | 3 |
| menu relations open | – | 642 (cap) | 1 / 118 / 118 | 0 | 2 |
| menu relations back | 6845 | 6860 | 2 / 5834 / 4666 | 0 | 5 |
| menu relationsAgain open | – | 22229 (cap) | 2 / 161 / 97 | 0 | 2 |
| menu relationsAgain back | 7251 | 7276 | 2 / 6081 / 5043 | 0 | 5 |
| menu texturePack | – | 253 (cap) | 1 / 65 / 65 | 0 | 1 |
| menu texturePackClose | 165 | 146 | 0 / 0 / 0 | 0 | 1 |
| playTap | 1155 | 5884 | 11 / 1555 / 289 | 413 | 8 |
| getOutToFirstChance | 18493 | 19295 | 3 / 203 / 84 | 0 | 25 |
| match2dAim5s (frames) | fps 24 · p50 16.7 ms · p95 16.8 ms · worst 867 ms · >33ms 5 | long 0/0 ms | React commits/s 0 |||
| match2dFlight5s (frames) | fps 23 · p50 16.7 ms · p95 66.7 ms · worst 867 ms · >33ms 9 | long 3/166 ms | React commits/s 0.6 |||
| switchTo3d | 40068 | 52433 | 18 / 39348 / 33384 | 95 | 3 |
| match3dAim5s (frames) | fps 1 · p50 33.3 ms · p95 2683.3 ms · worst 2683 ms · >33ms 3 | long 2/114 ms | React commits/s 0 |||
| switchBackTo2d | 10538 | 10511 | 3 / 167 / 58 | 0 | 1 |
| switchTo3dAgain | 194 | 183 | 0 / 0 / 0 | 0 | 1 |
| house | 2703 | 37066 | 8 / 1787 / 389 | 403 | 3 |
| house3dFrames (frames) | fps 2 · p50 726 ms · p95 1633.3 ms · worst 1633 ms · >33ms 4 | long 0/0 ms | React commits/s 0 |||
| houseAgain | 2969 | 3050 | 7 / 2799 / 1204 | 0 | 3 |
| garden | 1344 | 12020 | 19 / 9183 / 2638 | 84 | 2 |
| gardenFrames (frames) | fps 1 · p50 1216.5 ms · p95 2516.7 ms · worst 2517 ms · >33ms 4 | long 2/173 ms | React commits/s 0 |||
| shop3d | 5568 | 6327 | 17 / 3561 / 1225 | 0 | 6 |
| shop3dFrames (frames) | fps 3 · p50 583.3 ms · p95 700 ms · worst 700 ms · >33ms 7 | long 1/54 ms | React commits/s 0.8 |||

## Appendix B. First-load JS, every route (next build output, gzipped)

| Route | Own JS | First load JS (gz) |
|---|---|---|
| /star-dev | 162 kB | 1.21 MB |
| /star-dev/media-lab | 66 kB | 1.13 MB |
| /star-training3d-dev | 56.4 kB | 1.06 MB |
| /star-3d-dev | 28.1 kB | 1.04 MB |
| /star-goal-clips-dev | 2.34 kB | 1.01 MB |
| /star-sim90-dev | 10.5 kB | 1.01 MB |
| /star-gallery-dev | 24 kB | 1 MB |
| /star-style-dev | 37.2 kB | 1 MB |
| /star-relgames-dev | 16.3 kB | 999 kB |
| /star-highlights-dev | 15.8 kB | 998 kB |
| /star-statsbomb-dev | 14 kB | 997 kB |
| /star-play-dev | 9.89 kB | 992 kB |
| /star-training-dev | 4.03 kB | 980 kB |
| /star-real-moments-dev | 3.25 kB | 968 kB |
| /star-dribble-stick-dev | 1.2 kB | 966 kB |
| /star-bigger-dev | 1.22 kB | 913 kB |
| /star-zoomgrass-dev | 825 B | 912 kB |
| /star-retirement-dev | 64.3 kB | 851 kB |
| /star-match-dev | 36.7 kB | 825 kB |
| /admin/custom-clubs | 30.1 kB | 769 kB |
| /star-intl-dev | 13.4 kB | 763 kB |
| /star-garden3d-dev | 47.9 kB | 739 kB |
| /legend/[code] | 14.3 kB | 737 kB |
| /star-3d-area-dev/office | 17.9 kB | 705 kB |
| /star-radar-dev | 12.7 kB | 643 kB |
| /star-blender-dev | 6.18 kB | 631 kB |
| /star-spin-dev | 2.37 kB | 627 kB |
| /star-home3d-dev | 20.7 kB | 615 kB |
| /admin/badges | 2.7 kB | 563 kB |
| /star-tournament-dev | 5.66 kB | 445 kB |
| /star-store-dev | 15.3 kB | 370 kB |
| /star-attack-dev | 5.57 kB | 325 kB |
| /star-dribble-dev | 4.96 kB | 320 kB |
| /admin/app-plan | 366 B | 317 kB |
| /admin/patch-notes | 362 B | 317 kB |
| /draft-dev | 14.5 kB | 299 kB |
| /draft-dev2 | 14.5 kB | 299 kB |
| /star-shop3d-dev | 3.06 kB | 294 kB |
| /admin/star-pass | 3.37 kB | 288 kB |
| /star-tuning-dev | 2.81 kB | 273 kB |
| /admin/clubs | 7.83 kB | 266 kB |
| /star-bicycle-dev | 4.86 kB | 259 kB |
| /draft | 21.2 kB | 255 kB |
| /star-sprites-dev | 6.64 kB | 250 kB |
| /star-anim3d-dev | 9.87 kB | 249 kB |
| /star-3d-area-dev/signing | 8.51 kB | 247 kB |
| /star-people-dev | 14.8 kB | 244 kB |
| /lineups | 8.12 kB | 238 kB |
| /admin/cl-draft | 19.4 kB | 236 kB |
| /draft-challenge-dev | 8.32 kB | 235 kB |
| /admin/star-xp | 7.73 kB | 233 kB |
| /star-animations-dev | 6.46 kB | 228 kB |
| /ballon-dor | 65.9 kB | 212 kB |
| /star-scenario-dev | 7.04 kB | 211 kB |
| /draft/history | 4.55 kB | 210 kB |
| /tierlist | 18.8 kB | 191 kB |
| /draft/american | 8.48 kB | 183 kB |
| /admin/football | 9.68 kB | 171 kB |
| /star-update-dev | 7.76 kB | 171 kB |
| /draft/records | 10.4 kB | 168 kB |
| /admin/xp | 5.35 kB | 167 kB |
| /admin/football/players | 8.26 kB | 164 kB |
| /star-3d-area-dev | 8.45 kB | 164 kB |
| /profile-new | 7.2 kB | 163 kB |
| /star-sound-lab-dev | 15.9 kB | 162 kB |
| /admin/football/scrape | 5.26 kB | 161 kB |
| /star-wallet-dev | 4.26 kB | 160 kB |
| /admin/football/pl-clubs | 1.54 kB | 158 kB |
| /admin | 1.42 kB | 157 kB |
| /objectives | 720 B | 154 kB |
| /profile | 372 B | 154 kB |
| /admin/sound-board | 6.16 kB | 153 kB |
| /star-look-dev | 4.78 kB | 151 kB |
| /auth | 2.5 kB | 150 kB |
| /draft/preview | 3.65 kB | 150 kB |
| /setup-username | 2.1 kB | 150 kB |
| /admin/testers | 2.33 kB | 149 kB |
| /manager | 16.1 kB | 120 kB |
| /squad-builder | 7 kB | 106 kB |
| /blind-rankings/[id] | 1.99 kB | 105 kB |
| /find | 2.11 kB | 105 kB |
| /play/[id] | 2.34 kB | 105 kB |
| /tic-tac-toe | 2.02 kB | 105 kB |
| /vote/[id] | 1.99 kB | 105 kB |
| / | 903 B | 104 kB |
| /blind-rankings | 1.1 kB | 104 kB |
| /tenable | 1.1 kB | 104 kB |
| /tester/[code] | 1.22 kB | 104 kB |
| /rankings/[id] | 715 B | 103 kB |
| /tic-tac-toe/archive | 441 B | 103 kB |
| /tic-tac-toe/daily | 441 B | 103 kB |
| /tierlists | 715 B | 103 kB |
| /tic-tac-toe/create | 2.95 kB | 96.1 kB |
| /tic-tac-toe/[id] | 1.41 kB | 94.6 kB |
| /blind-rankings/create | 1.36 kB | 94.5 kB |
| /create | 1.38 kB | 94.5 kB |
| /tenable/[id] | 1.34 kB | 94.5 kB |
| /sfx-dev | 1.15 kB | 94.3 kB |
| /_not-found | 366 B | 93.5 kB |
| /legal | 365 B | 93.5 kB |
| /tic-tac-toe/easy | 366 B | 93.5 kB |

## Appendix C. Sound files no code names literally (check each id against `lib/star/sfxCatalog.ts`)

| # | File | KB |
|---|---|---|
| S1 | `/sfx/COMMENTARY-LICENSE.txt` | 0 |
| S2 | `/sfx/CUTSCENE-MUSIC-LICENSE.txt` | 0 |
| S3 | `/sfx/achievement-pop.mp3` | 19 |
| S4 | `/sfx/breaking-news.mp3` | 24 |
| S5 | `/sfx/can-open.mp3` | 11 |
| S6 | `/sfx/cc-f1.mp3` | 26 |
| S7 | `/sfx/cc-f2.mp3` | 28 |
| S8 | `/sfx/cc-g1.mp3` | 21 |
| S9 | `/sfx/cc-g2.mp3` | 26 |
| S10 | `/sfx/cc-g3.mp3` | 25 |
| S11 | `/sfx/cc-g4.mp3` | 18 |
| S12 | `/sfx/cc-g5.mp3` | 22 |
| S13 | `/sfx/cc-g6.mp3` | 22 |
| S14 | `/sfx/cc-g7.mp3` | 18 |
| S15 | `/sfx/cc-g8.mp3` | 19 |
| S16 | `/sfx/cc-g9.mp3` | 22 |
| S17 | `/sfx/cc-h1.mp3` | 16 |
| S18 | `/sfx/cc-h2.mp3` | 23 |
| S19 | `/sfx/cc-lr1.mp3` | 27 |
| S20 | `/sfx/cc-lr2.mp3` | 27 |
| S21 | `/sfx/cc-o1.mp3` | 23 |
| S22 | `/sfx/cc-o2.mp3` | 18 |
| S23 | `/sfx/cc-p1.mp3` | 24 |
| S24 | `/sfx/cc-p2.mp3` | 21 |
| S25 | `/sfx/cc-r1.mp3` | 19 |
| S26 | `/sfx/cc-r2.mp3` | 24 |
| S27 | `/sfx/cc-reel1.mp3` | 16 |
| S28 | `/sfx/cc-reel2.mp3` | 21 |
| S29 | `/sfx/cc-s1.mp3` | 30 |
| S30 | `/sfx/cc-s2.mp3` | 23 |
| S31 | `/sfx/cl-c1.mp3` | 20 |
| S32 | `/sfx/cl-c2.mp3` | 20 |
| S33 | `/sfx/cl-cb1.mp3` | 14 |
| S34 | `/sfx/cl-cb2.mp3` | 17 |
| S35 | `/sfx/cl-cu1.mp3` | 18 |
| S36 | `/sfx/cl-cu2.mp3` | 19 |
| S37 | `/sfx/cl-f1.mp3` | 21 |
| S38 | `/sfx/cl-f2.mp3` | 21 |
| S39 | `/sfx/cl-f3.mp3` | 21 |
| S40 | `/sfx/cl-g1.mp3` | 13 |
| S41 | `/sfx/cl-g10.mp3` | 10 |
| S42 | `/sfx/cl-g2.mp3` | 11 |
| S43 | `/sfx/cl-g3.mp3` | 9 |
| S44 | `/sfx/cl-g4.mp3` | 12 |
| S45 | `/sfx/cl-g5.mp3` | 15 |
| S46 | `/sfx/cl-g6.mp3` | 17 |
| S47 | `/sfx/cl-g7.mp3` | 12 |
| S48 | `/sfx/cl-g8.mp3` | 11 |
| S49 | `/sfx/cl-g9.mp3` | 18 |
| S50 | `/sfx/cl-h1.mp3` | 16 |
| S51 | `/sfx/cl-h2.mp3` | 16 |
| S52 | `/sfx/cl-h3.mp3` | 18 |
| S53 | `/sfx/cl-k1.mp3` | 14 |
| S54 | `/sfx/cl-k2.mp3` | 23 |
| S55 | `/sfx/cl-lr1.mp3` | 22 |
| S56 | `/sfx/cl-lr2.mp3` | 20 |
| S57 | `/sfx/cl-lr3.mp3` | 19 |
| S58 | `/sfx/cl-lr4.mp3` | 17 |
| S59 | `/sfx/cl-o1.mp3` | 23 |
| S60 | `/sfx/cl-o2.mp3` | 18 |
| S61 | `/sfx/cl-o3.mp3` | 20 |
| S62 | `/sfx/cl-p1.mp3` | 23 |
| S63 | `/sfx/cl-p2.mp3` | 15 |
| S64 | `/sfx/cl-p3.mp3` | 19 |
| S65 | `/sfx/cl-r1.mp3` | 23 |
| S66 | `/sfx/cl-r2.mp3` | 15 |
| S67 | `/sfx/cl-r3.mp3` | 25 |
| S68 | `/sfx/cl-s-ah1.mp3` | 12 |
| S69 | `/sfx/cl-s-ah2.mp3` | 7 |
| S70 | `/sfx/cl-s-co1.mp3` | 19 |
| S71 | `/sfx/cl-s-lv1.mp3` | 11 |
| S72 | `/sfx/cl-s-lv2.mp3` | 13 |
| S73 | `/sfx/cl-s-lw1.mp3` | 11 |
| S74 | `/sfx/cl-s-lw2.mp3` | 11 |
| S75 | `/sfx/cl-s-op1.mp3` | 14 |
| S76 | `/sfx/cl-s-op2.mp3` | 8 |
| S77 | `/sfx/cl-s-ro1.mp3` | 16 |
| S78 | `/sfx/cl-s-ro2.mp3` | 13 |
| S79 | `/sfx/cl-ta1.mp3` | 19 |
| S80 | `/sfx/cl-ta2.mp3` | 17 |
| S81 | `/sfx/cl-v1.mp3` | 17 |
| S82 | `/sfx/cl-v2.mp3` | 20 |
| S83 | `/sfx/cl-v3.mp3` | 16 |
| S84 | `/sfx/coin-in.mp3` | 16 |
| S85 | `/sfx/crowd-cheer-small.mp3` | 35 |
| S86 | `/sfx/crowd-cheer-stadium.mp3` | 47 |
| S87 | `/sfx/cut-mentor-line.mp3` | 24 |
| S88 | `/sfx/cut-music-farewell.mp3` | 256 |
| S89 | `/sfx/cut-music-press.mp3` | 241 |
| S90 | `/sfx/cut-music-signing.mp3` | 281 |
| S91 | `/sfx/cut-music-trophy.mp3` | 253 |
| S92 | `/sfx/cut-music-walkout.mp3` | 256 |
| S93 | `/sfx/goal-net.mp3` | 14 |
| S94 | `/sfx/keeper-save.mp3` | 7 |
| S95 | `/sfx/kick-hard.mp3` | 6 |
| S96 | `/sfx/kick-soft.mp3` | 6 |
| S97 | `/sfx/level-up.mp3` | 19 |
| S98 | `/sfx/match-crowd.mp3` | 25 |
| S99 | `/sfx/match-goal.mp3` | 9 |
| S100 | `/sfx/match-pass.mp3` | 2 |
| S101 | `/sfx/phone-notification.mp3` | 10 |
| S102 | `/sfx/star-tick.mp3` | 10 |
| S103 | `/sfx/ui-confirm-arcade.mp3` | 3 |
| S104 | `/sfx/ui-confirm.mp3` | 7 |
| S105 | `/sfx/ui-tap-arcade.mp3` | 1 |
| S106 | `/sfx/ui-tap.mp3` | 6 |
| S107 | `/sfx/whistle-full.mp3` | 28 |
| S108 | `/sfx/whistle-half.mp3` | 19 |
| S109 | `/sfx/whistle-start.mp3` | 12 |

## Harry's answers (16 Oct 2026)

| Q | Answer | What it means for the build |
|---|---|---|
| Q2 | ✓ | Keep the Home 3D player loaded while in menus (no rebuild on return) |
| Q4 | B | Commentary before your first chance runs 3× faster (~18.5 s → ~6 s) |
| Q5 | B | Home idle at 20 fps. Also pause him when off screen (comment, 16 Oct: "idm pausing him when off screen too") |
| Q8 | ✓ | iPhone Safari: drop the full-screen look, show only the "How?" tip |
| Q13 | A | First five lag fixes go live together, then re-measure |
| Q14 | ✓ | Harry tests on his iPhone (+ one Android if anyone has one) |
| Q-B1 | D (asked why not move all out — answered 18 Oct) | Keep `patch-notes/pages/` (archive needs it); move `patch-notes/reviews/` + `playtest-notes/` out with a README of links |
| Q-B9 | B | Keep only the newer Draft test page |
| Q-B11 | ✓ | Delete "Bigger players" + "Zoom-to-play"; add Tournaments to the admin menu |
| Q-B12 | ✎ | Harry decides all test pages himself after the questions, as part of a full admin redesign |
| Q-B13 | ✓ | Delete the separate Scenario Builder page (same tool is a gallery tab) — changed 18 Oct |
| Q-B14 | ✎ | Manager mode is not a live game → treat as an old test in the test-page pass |
| Q-B25 | ✓ | Trim CLAUDE.md first (piece 0) |
| Q-B10 | ? | Harry asked if it's the same as Infinite Match (it isn't — answered 18 Oct); awaiting answer |
