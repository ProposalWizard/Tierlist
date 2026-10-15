# Admin revamp — the plan (no code yet)

15 Oct 2026. Branch state: `Harry` at 5ca671e. Everything below was read from the code. Nothing has been built.
"Seen" = I looked at it in a browser. "Read" = I read the code. Most of this is "read".

---

## 1. Where we are now (real counts)

| Thing | Count | How I know |
|---|---|---|
| Admin and dev pages (page files) | **69** | every `page.tsx` under app/admin, app/star-*-dev, /lineups, /draft-dev, /draft-dev2, /draft-challenge-dev, /draft/preview, /draft/american, /sfx-dev, /ballon-dor, /profile-new, /squad-builder, /star-dev/media-lab |
| …of which Road to Ballon d'Or | **52** | 43 star-*-dev pages (incl. 3D-area signing/office) + media-lab + /lineups + /ballon-dor + 6 /admin pages (clubs, badges, custom-clubs, star-pass, star-xp, sound-board). Site 7, Tierlists 1, PL Draft 9. |
| Links in the admin pop-up | **59** | `components/AdminNavPanel.tsx`: Site 4, Admin 12, Star Career 33, Sandboxes 10 |
| Pages NOT in the pop-up | **13** | /ballon-dor, /draft/american, /sfx-dev, /squad-builder, 3D-area signing + office, /star-bigger-dev, /star-highlights-dev, /star-intl-dev, /star-look-dev, /star-sprites-dev, /star-tournament-dev, /star-zoomgrass-dev |
| Page guides (the eye) | **64 of 69** have one | missing: /star-tournament-dev, /star-bigger-dev, /star-zoomgrass-dev, /sfx-dev, /squad-builder, /draft/american (6) |
| Pages with NO lock at all | **28 of 69** | see the gate column below |
| Pages locked 5 different ways | 41 | server redirect (6), client check admin (7), client check admin-or-tester (2), `AdminOnly` layout (4), `TesterOnly` layout (22) |
| Dead code | 1 file, 594 lines | `app/draft-dev/DraftDevClient.tsx` is imported by nothing |

### How the pages are locked today (read)

```
 Lock                          Pages  Testers get in?   Where the check runs
 ─────────────────────────────  ─────  ───────────────   ───────────────────────────
 none                             28   anyone does       —
 TesterOnly layout                22   yes               server, before the page
 server redirect in page           6   no                server (admin, app-plan, patch-notes,
                                                          sound-board, testers, ballon-dor)
 client "admin-check" in page      7   no                browser, AFTER the code ships
 client check admin-or-tester      2   yes               browser (style, training3d)
 AdminOnly layout                  4   no                server (gallery, highlights,
                                                          lineups, challenge draft)
```

The 28 open ones include **10 real admin pages** that edit the live database: /admin/xp, /admin/football, /admin/football/players, /admin/football/scrape, /admin/star-pass, /admin/star-xp, /admin/custom-clubs (plus read-only clubs, badges, pl-clubs). Their *saves* are safe: every `/api/admin/*` route and the star-pass, xp-config, scenarios and lineups routes check `isAdmin` on the server (read). But anyone can open the screens and read what they show.

Also open: **/draft-dev and /draft-dev2**, which write to the real Draft save, history, XP and multiplayer rooms. Their only "check" hides one button.

### What testers can actually reach (read)

A tester has no list of test pages anywhere. The admin pop-up is only drawn for admins (`GlobalNav.tsx`, `{userIsAdmin && <AdminNavPanel/>}`). The title screen's "Play Area" link shows only in a local dev build (`showPlayArea={offlineDevPlayEnabled()}`). In the live site a tester must be sent the address by hand.

### Labels that say the wrong thing (read)

| In the pop-up | What the page really is | Proposed name |
|---|---|---|
| 3D | The 2D game drawn in the old "3D skin" look, every mode, with a Classic/3D switch | 3D look in every mode (old) |
| Match Engine | Mikey's separate copy of the engine; its own title says "Shooting Test" | Match engine copy (Mikey) |
| Animations / 3D Animations | 2D players' New animations vs 3D match moves | 2D animations / 3D animations |
| Style Testing | Art styles AND the Cut-scene Director | Art styles + cut-scene director |
| Squad Builder (/lineups) | Every club's XI for the career | Team sheets |
| (unlisted) /squad-builder | A "build your dream XI" page | Dream XI builder |
| Ballon d'Or Beta (/ballon-dor, on the admin dashboard) | A separate, older career game, not Road to Ballon d'Or | Ballon d'Or career (old beta) |
| XP & Rewards vs XP Book | Site level rewards vs career XP amounts | Site XP rewards / Career XP book |
| Football Data | Wikidata behind Tic Tac Toe | Tic Tac Toe data |
| Tuning (/star-tuning-dev) | Balance numbers (energy, wages, prices), this browser only | Balance numbers |
| Oct 13 update | One Old/New switch for Leo's Oct 13 gameplay update | keep, add "(Leo)" in the card |

### Duplicates (read)

- **/draft-dev vs /draft-dev2:** 4 lines differ: the setup screen import (V2 vs Hero), the function name, the room link (draft-dev sends rooms to the REAL /draft, draft-dev2 to itself — a small bug), and the guide key. A switch is trivial.
- **/star-scenario-dev** is the same editor as the gallery's "Scenario Builder" tab.
- **3D places**: `/star-3d-area-dev` already IS a hub: `lib/star/area3d.ts` lists signing, office, shop, house, Blender footballer, 3D animations, 3D look, store pictures. So no merge is needed: the 3D Test Area is the group's front page.
- **Play Area** (`/star-play-dev`) is also a mini hub: it links Highlights, Infinite Match, Oct 13 update, Animations, Radar, Gallery, 3D, Blender, Store. Seen at 390×844 (3,999 px tall page of cards).
- **Size/camera prototypes**: /star-bigger-dev, /star-zoomgrass-dev, /star-sprites-dev, /star-look-dev. Four separate pages, each a single test. Group them; do not merge.

---

## 2. Every page, one row

Owner key — how I guessed: **H** = the page's own header quotes Harry, **M** = Mikey, **L** = Leo; "PW" = git author "Proposal Wizard", which in every case I checked is Mikey's work (Club Data, Star Pass, XP Book, relationships, garden, training levels, spin). "pre-Sep" = made before 3 Sep 2026; this clone's history stops there, so no evidence.

Writes real data: **Y** = changes something other people see (live DB, shared tables, repo). **own** = only your own account. **—** = nothing / this browser only.

Gate now: none / T = TesterOnly / A = AdminOnly layout / S = server redirect (admin) / C = client check admin / Ct = client check admin-or-tester.

Fate: **keep** / **old** = move to "Old tests" (not deleted) / **merge** as stated.

### Site

| URL | What it really does | Owner (evidence) | Used? | Writes | Gate | Proposed name · fate |
|---|---|---|---|---|---|---|
| / | Homepage | — | yes | — | — | Homepage · keep |
| /profile | Your profile | — | yes | own | — | Profile · keep |
| /admin/patch-notes | Every patch-notes version | shared (H, M, L entries) | yes | — | S | Patch notes · keep, LINK ONLY (another builder owns it) |
| /admin/app-plan | iPhone/Android app plan + open questions | H (header) | yes | — | S | App plan · keep |
| /admin/testers | Make/switch off tester links, remove testers | H (header, 5 Oct) | yes | Y | S | Tester access · keep |
| /admin/xp | Site level-up rewards (frames, titles, trophies) | pre-Sep | yes | Y | **none** | Site XP rewards · keep |
| /admin/football | Wikidata clubs/players behind Tic Tac Toe; builds grids | pre-Sep | yes | Y | **none** | Tic Tac Toe data · keep |
| /profile-new | Trial profile redesign; claiming writes your account | pre-Sep | last touched 23 Sep | own | **none** | Profile (new) · **old** |
| /squad-builder | Dream XI builder, drag players, share | pre-Sep | last real change unknown | — | T | Dream XI builder · **old** (ask) |
| /admin/team | Team board — another builder is making it | — | — | — | — | Team board · link only |

### Tierlists

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /admin | Tierlists, votes, blind rankings, Tic Tac Toe, Ten-A-Ball, objectives, cards, feedback | pre-Sep (H's site) | yes | Y | S | Site content dashboard · keep |

### PL Draft

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /admin/football/players | Edit every SoFIFA player (names, ratings, potential) | pre-Sep | yes | Y | **none** | Players · keep (also listed in RBD Real data) |
| /admin/football/pl-clubs | Which clubs the Draft has per season, read only | pre-Sep | yes | — | **none** | PL clubs by season · keep |
| /admin/football/scrape | Import SoFIFA data and logos | pre-Sep | yes | Y | **none** | Scrape / import · keep (also in RBD) |
| /draft-dev | PL Draft with the V2 setup screen | pre-Sep; H v0.8 notes | 23 Sep | **Y** (real Draft save, history, XP, rooms) | **none** | Draft (test) · keep, gains a V2 / Hero switch |
| /draft-dev2 | Same, "Hero" setup screen | pre-Sep | 23 Sep | Y | **none** | **merge** into /draft-dev as the switch; old URL redirects |
| /draft-challenge-dev | Draft where each round is a random brief | pre-Sep | 5 Oct | Y (rooms) | A | Challenge draft · keep |
| /admin/cl-draft | Champions League draft test game | pre-Sep | 23 Sep | — | C | CL draft (test) · keep (ask) |
| /draft/preview | Redesigns of Draft table/team screen on sample data | pre-Sep | 23 Sep | — | **none** | Draft design preview · **old** |
| /draft/american | Standalone American-draft sandbox (real mode now lives in rooms) | pre-Sep | 3 Sep | Y (rooms) | **none** | American draft sandbox · **old** |

### Road to Ballon d'Or — by proposed group

**Career screens**

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /star-dev | The game itself | all | yes | own | none (it's the game — stays open) | Play the game · keep |
| /star-retirement-dev | End-of-career screens on made-up careers | L (header 5–6 Oct) | yes | own (Share link makes a real code) | **none** | Retirement preview · keep |
| /star-relgames-dev | Every relationship game on a test player | M (PW, header) | yes | — | T | Relationship games · keep |
| /star-goal-clips-dev | Score in the real match, watch the goal video | L (header 7 Oct) | yes | — | **none** | Goal videos · keep |
| /star-dev/media-lab | Media-feed graphics bench, ?feed, ?trophies | pre-Sep | 12 Oct | — | **none** | Media lab · keep |
| /star-training-dev | Any of 30 levels of any training game | M (header 25 Sep) | yes | — | T | Training levels · keep |

**Chances**

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /star-gallery-dev | Every chance as a picture; drag, save, commit | H (patch notes v0.7–v0.10) | yes, 43 commits | **Y + repo** | A | Scenario gallery · keep |
| /star-highlights-dev | Real chances, Next as fast as you can, fix on the spot | H | yes, 26 commits | Y + repo | A | Infinite highlights · keep (add to nav) |
| /star-play-dev | Door to Highlights + Infinite Match + dials | H (v0.10) | yes, 19 commits | Y + repo (Infinite Match bar) | T | Play area · keep |
| /star-scenario-dev | Scenario builder on its own page | M (CLAUDE.md "Mikey's ScenarioEditor") | 23 Sep | Y | C | **merge**: nav points to the gallery's Builder tab; page stays as old |

**Match tests**

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /star-update-dev | Leo's Oct 13 gameplay update behind one Old/New switch | L (patch notes v0.53) | yes (14 Oct) | — | T | Oct 13 update (Leo) · keep |
| /star-sim90-dev | A whole 90 minutes to watch, 22 men | H (header 13–14 Oct) | yes | — | **none** | Full match · keep |
| /star-radar-dev | The unseen match minute by minute | H (header 27 Sep) | yes | — | T | Match radar · keep |
| /star-dribble-dev | First-person dribble duel (only place it lives now) | L (built in the Leo-branch sessions, 6–16 Sep) — guess | 28 Sep | — | C | First-person dribble · keep |
| /star-dribble-stick-dev | Dribble runs steered by a stick | H (header 14 Oct) | yes | — | **none** | Dribble on a stick · keep |
| /star-bigger-dev | Style A players 30% bigger, real match | H (header 12 Oct), M ?framing (13 Oct) | yes | — | **none** | Bigger players · keep |
| /star-match-dev | Mikey's full copy of the engine (title "Shooting Test") | M (CLAUDE.md "Mikey's fork") | 5 Oct | — | C | Match engine copy (Mikey) · keep (Mikey's call) |

**Real data**

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /star-real-moments-dev | StatsBomb positions as playable chances | M (header 9 Oct) | yes | — | **none** | Real moments · keep |
| /star-statsbomb-dev | Every WC 2022 / Euro 2024 shot with a freeze frame | H (header 13 Oct) | yes | — | **none** | Real shots · keep |
| /star-intl-dev | Every national team's competitions from Aug 2026 | M (header 12 Oct) | yes | — | **none** | International world · keep (add to nav) |
| /star-tournament-dev | Draw and play a Euros/World Cup in seconds | L (header 12 Oct) | yes | — | T | Tournaments · keep (add to nav, needs a guide) |
| /lineups | Every club's formation, XI, bench, manager | pre-Sep | yes | Y (star_lineups) | A | Team sheets · keep |
| /admin/clubs | Every club, every field, green/amber/red | M (header 2 Oct) | yes | — | **none** | Club data · keep |
| /admin/badges | Every drawn badge; redo one on this device | H (header 7 Oct) | yes | — (this browser) | **none** | Club badges · keep |
| /admin/custom-clubs | Invent a whole club | M (PW, 16 Sep) | yes | Y | **none** | Custom clubs · keep |

**3D places** (front page = 3D Test Area)

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /star-3d-area-dev | List of every 3D scene + the 3D file store | H (header 2 Oct) | yes | — | T | 3D places (hub) · keep |
| /star-3d-area-dev/signing | Live 3D signing scene | H | yes | — | T | Signing scene · keep (in nav under 3D places) |
| /star-3d-area-dev/office | Manager's office stage | H | yes | — | T | Manager's office · keep |
| /star-shop3d-dev | Walk-around 3D shop | H (header 1 Oct) | yes | — | T | 3D shop · keep |
| /star-garden3d-dev | 3D garden | M (header 3 Oct) | yes | — | T | 3D garden · keep |
| /star-home3d-dev | Your house in 3D | H (header 9 Oct) | yes | — | T | 3D home · keep |
| /star-training3d-dev | 3D training pitch and drills | H (header 8 Oct) | yes | — | Ct | 3D training · keep |
| /star-style-dev | Art styles on real chances + Cut-scene Director | H (header 9 Oct) | yes | — | Ct | Art styles + cut-scene director · keep |

**Players + animation**

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /star-animations-dev | 2D New animations next to Old, with dials | L (header 6 Oct) | yes | — | T | 2D animations · keep |
| /star-anim3d-dev | Every 3D match move at real match size | H (header 12 Oct) | yes | — | **none** | 3D animations · keep |
| /star-people-dev | Faces, eyes, hands, handshake for cut scenes | H (Style A / cut-scene work 9 Oct) — guess | yes | — | **none** | Cut-scene people · keep |
| /star-look-dev | Style A on three bodies + Your look panel | H (Style A, 9 Oct) — guess | decided 12 Oct | — | **none** | Player style (Style A) · keep (ask: old?) |
| /star-sprites-dev | Baked 3D match figures at real size | L (CLAUDE.md "Leo chat's 3D sprite moves") — guess | decided 12 Oct | — | C | 3D match figures · keep (ask: old?) |

**Money + rewards**

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /admin/star-pass | Reward catalogue and Star Pass levels | M (header) | yes | Y | **none** | Star Pass · keep |
| /admin/star-xp | Every amount of career XP | M (header) | yes | Y | **none** | Career XP book · keep |
| /star-store-dev | Store test: specials, run-ups, boosts, coins | H (header 27 Sep) | 5 Oct | — | T | Store (test) · keep |
| /star-wallet-dev | Gems on the server; one paid item | H (header 7 Oct) | yes | own (server) | T | Gems (test) · keep |
| /star-tuning-dev | Balance numbers, this browser only | M or L — no evidence (built 4 Sep) | 23 Sep | — | C | Balance numbers · keep |

**Sound** (new small group)

| URL | What | Owner | Used? | Writes | Gate | Proposed |
|---|---|---|---|---|---|---|
| /admin/sound-board | Every game sound; upload a replacement | H (v0.24) | yes | Y | S | Sound board · keep |
| /star-sound-lab-dev | Hear, edit, rate match sounds | L (header 14 Oct) | yes | — | T | Sound lab · keep |

**Old tests** (still reachable, folded away)

| URL | What | Owner | Last change | Writes | Gate | Why old |
|---|---|---|---|---|---|---|
| /star-attack-dev | Moving-attack prototype | L? (6 Sep) | 26 Sep | — | C | prototype, never went further |
| /star-bicycle-dev | Overhead-kick throwaway | M (PW, 19 Sep) | 5 Oct (lock only) | — | T | header says "throwaway" |
| /star-zoomgrass-dev | Zoom-to-play camera prototype | H (show-options, 9 Oct) | 11 Oct | — | **none** | "Match camera: Old until the rebuilt camera lands" (12 Oct) |
| /star-3d-dev | Old "3D skin" in every mode | H (28 Sep) | 5 Oct | — | T | 2D players are now 3D-made sprites (decided 12 Oct) |
| /star-spin-dev | Spin your player 360° | M + H (28–30 Sep) | 5 Oct | — | T | superseded by the 3D player |
| /star-blender-dev | Blender footballer recoloured | H (28 Sep) | 5 Oct | — | T | superseded by people3d |
| /sfx-dev | Audition every sound in manifest.json | H (sound effects, 1 Oct) | 5 Oct | — | T | Sound Board + Sound Lab cover it |
| /ballon-dor | Older separate Ballon d'Or career game | pre-Sep | 23 Sep | own (XP) | S | not Road to Ballon d'Or; confuses the name |
| /star-scenario-dev | (see Chances) | M | 23 Sep | Y | C | it's a gallery tab now |
| /draft/preview, /draft/american, /draft-dev2, /profile-new, /squad-builder | (see above) | | | | | |

Old tests total: 9 RBD + 4 other (draft-dev2 becomes a redirect) = **13 folded away, 0 deleted.**

---

## 3. The new structure

### 3a. The pop-up (same look, new top level)

Same slide-out, same colours, same edge tab, same phone menu entry. Only the list changes: four sections. Site, Tierlists and PL Draft open in place (their links fold out under them). Road to Ballon d'Or is one big row that opens `/admin/star`.

```
 Phone, 390 wide (the pop-up)          
 ┌──────────────────────────────┐
 │ ADMIN & DEV               ✕  │
 ├──────────────────────────────┤
 │ ★ ROAD TO BALLON D'OR      › │  ← one big row → /admin/star
 │   52 pages · 9 groups        │
 ├──────────────────────────────┤
 │ ▾ SITE                       │
 │   Homepage                   │
 │   Patch notes                │
 │   Tester access              │
 │   Site XP rewards            │
 │   Tic Tac Toe data   …       │
 │ ▸ TIERLISTS              (1) │
 │ ▸ PL DRAFT               (6) │
 │ ─────────────────────────    │
 │   Team board               › │  ← link to /admin/team
 │ Admin only · not public      │
 └──────────────────────────────┘
```

On an RBD tool page, the pop-up opens already showing that page's group, with "‹ All of Road to Ballon d'Or" at the top.

### 3b. /admin/star — the Road to Ballon d'Or admin home

Phone (390×844): rail is a drawer behind a "☰ Groups" button. Main area: the "what's what" strip, then one card per group.

```
 ┌──────────────────────────────┐
 │ ☰ Groups   ROAD TO BALLON D'OR│
 │            Admin home     👁 │
 ├──────────────────────────────┤
 │ 43 in use · 9 old · 9 write  │  ← what's what (tap = filter)
 │ H 26 · M 13 · L 9 · ? 4      │
 ├──────────────────────────────┤
 │ CHANCES                  3 › │
 │ ┌──────────────────────────┐ │
 │ │ Scenario gallery         │ │
 │ │ Every chance as a        │ │
 │ │ picture you can fix.     │ │
 │ │ H · in use · ● WRITES    │ │
 │ └──────────────────────────┘ │
 │ ┌──────────────────────────┐ │
 │ │ Infinite highlights   …  │ │
 │ └──────────────────────────┘ │
 │ MATCH TESTS              7 › │
 │  …                           │
 │ ▸ OLD TESTS (9)              │  ← folded
 └──────────────────────────────┘
```

Desktop (≥1024): the rail is docked on the left; cards are a grid.

```
 ┌───────────────┬───────────────────────────────────────────────────────┐
 │ ROAD TO       │  What's what                                          │
 │ BALLON D'OR   │  [43 in use] [9 old] [9 write shared data]             │
 │               │  Harry 26 · Mikey 13 · Leo 9 · unknown 4              │
 │ ▾ Career      │  Chances 3 · Match 7 · Real data 8 · 3D 8 · …         │
 │   The game    │───────────────────────────────────────────────────────│
 │   Retirement  │  CHANCES                                              │
 │   …           │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
 │ ▾ Chances     │  │ Scenario    │ │ Infinite    │ │ Play area   │      │
 │   Gallery     │  │ gallery     │ │ highlights  │ │             │      │
 │   Highlights  │  │ one line    │ │ one line    │ │ one line    │      │
 │ ▸ Match tests │  │ H · in use  │ │ H · in use  │ │ H · in use  │      │
 │ ▸ Real data   │  │ ● WRITES    │ │ ● WRITES    │ │ ● WRITES    │      │
 │ ▸ 3D places   │  └─────────────┘ └─────────────┘ └─────────────┘      │
 │ ▸ Players…    │  MATCH TESTS                                          │
 │ ▸ Money…      │  …                                                    │
 │ ▸ Sound       │                                                       │
 │ ▸ Old tests   │                                                       │
 │ ───────────── │                                                       │
 │ Team board ›  │                                                       │
 │ Patch notes › │                                                       │
 └───────────────┴───────────────────────────────────────────────────────┘
```

Card = name (as shown), one plain line, owner letter, "in use" / "old test", a red "WRITES REAL DATA" badge when true, and a small "testers can open" mark. Text is short on purpose (ui-house-style: "text is the enemy").

### 3c. The rail on tool pages

The brief asks for the same left rail on every tool page. **The risk:** many tools size their canvas to the window, not their box (the gallery reads `vp.w`; Play Area, highlights, sim90 and the 3D pages are full screen). A docked column that pushes the page right would shrink or clip them. So:

```
 Tool page, desktop                         Tool page, phone
 ┌──┬──────────────────────────────┐        ┌──────────────────────────┐
 │▌ │ RBD › Chances › Gallery   ←chip       │ (page exactly as today)  │
 │▌ │                              │        │                          │
 │▌ │   page exactly as today      │        │ edge tab only where the  │
 │▌ │                              │        │ page is full screen —    │
 │▌ │                              │        │ today's placeTab logic   │
 └──┴──────────────────────────────┘        └──────────────────────────┘
  ▲ today's edge tab; opens the rail OVER the page, already on this group.
```

- The rail is an **overlay** on tool pages (the existing slide-out, opened on the current group). It never changes the page's width.
- A page marked `railDocked: true` in the registry (simple list pages: Club data, XP book, Star Pass, Testers…) may show it docked on desktop. Default off.
- A small breadcrumb chip ("RBD › Chances › Gallery") sits in the rail's header, not on the page, so no page gets a new element over its controls.

### 3d. One page registry (`lib/adminRegistry.ts`)

One row per page. The pop-up, `/admin/star`, the what's-what counts and the lock all read it.

```ts
{ url: "/star-gallery-dev",
  name: "Scenario gallery",                 // as shown everywhere
  purpose: "Every chance as a picture you can drag, judge, save and put in the game.",
  section: "rbd",                           // site | tierlists | draft | rbd
  group: "chances",
  owner: "Harry",                           // Harry | Mikey | Leo | unknown
  ownerWhy: "patch notes v0.7–v0.10",
  status: "in-use",                         // in-use | old
  writes: "shared",                         // none | own | shared | repo
  access: "admin",                          // admin | tester
  alsoIn?: ["draft"],                       // cross-listing (Players, Scrape)
  railDocked?: false }
```

The guides stay in `lib/adminGuides.ts` (1,982 lines; no need to move them). A test checks both files agree.

**The registry test** (`tests/admin/registry.mts`, plain tsx like tests/star):
1. Every page folder under app/admin, app/star-*-dev and the known list has a registry row, and every row (except /, /profile, /admin/team, /star-dev) has a page folder.
2. Every row has a guide in ADMIN_GUIDES and the page renders `<PageGuide page=…>`.
3. Every row's folder (or a parent) has the one gate layout.
4. No two rows share a name (catches "Squad Builder" twice).
5. The pop-up has no hard-coded list left (grep for `href:` in AdminNavPanel).

---

## 4. The lock plan

**One gate, two levels, chosen by the registry.** A new server component `components/admin/DevGate.tsx`:

```
 DevGate page="/x"  →  registry.access
                         "admin"  → same as AdminOnly  (admins)
                         "tester" → same as TesterOnly (admins + testers)
 local dev build (offlineDevPlayEnabled) → everyone, as today
```

Recommended rule (needs Harry's yes — question 1):

| Page writes… | Who may open it | Pages |
|---|---|---|
| shared data or the repo, or anything under /admin/* | admins | 24 (all 16 /admin/* pages, gallery, highlights, lineups, scenario builder, draft-dev, draft-dev2, challenge draft, American sandbox) |
| only your own account or nothing | admins + testers | 45 (incl. Play Area, profile-new and /ballon-dor, which write only your own account; and the new /admin/star home) |

Play Area is a judgement: it plays the game (tester-worthy) but Infinite Match has Save/Commit. Commit and Save are already refused by the server for non-admins (read), so recommend **tester**, with the buttons showing "admins only".

**Where the gate goes:** one tiny `layout.tsx` per top-level folder (`<DevGate page="/star-x-dev">`). Next 14 layouts can't see the address, so `/admin`'s single shared layout can't pick per page; each `/admin/<x>/` folder gets its own layout instead, and `app/admin/layout.tsx` keeps only its touch CSS. `/star-dev/media-lab` gets a layout of its own; `/star-dev` (the game) stays open.

Then remove the 9 client-side checks (7 admin, 2 admin-or-tester) — the layout already decided, and the client checks block testers who should be in. The 6 server redirects stay (harmless double lock) except `/admin/patch-notes`, which I don't touch.

**The tester flow, kept:** `/tester/[code]` is not under any gated folder and is untouched. A tester claimed via the link gets `is_tester`; `DevGate` "tester" pages use the same `isTester()` as `TesterOnly`. Before `tester_access.sql`… it is RUN (CLAUDE.md), so nothing waits on it.

**New for testers (recommended, question 2):** draw a tester version of the pop-up (same component, only `access: "tester"` rows) for testers. Today they have no way to find any test page on the live site.

---

## 5. Risks — what could break

| Risk | How bad | Guard |
|---|---|---|
| A page that was open is now locked and someone used it signed out (e.g. Mikey on another device, /admin/clubs, /star-sim90-dev) | annoying | List the 28 newly locked pages in the patch notes; sign-in fixes it |
| The /admin/* split into per-folder layouts misses one | that page opens to anyone | registry test #3 fails the build |
| Testers let into pages whose Save then fails | confusing | registry `writes` drives a small "Admins only: saving" line; server already refuses |
| A docked rail shrinks a canvas page | broken pitch | overlay by default; `railDocked` only on list pages; still taken at 390 and 1280 |
| Merging draft-dev2 changes the real Draft save | real players' Draft runs | the switch only picks the setup screen; save keys unchanged; fix the room link to /draft-dev (today it jumps to the real /draft) |
| Removing client checks on a page that also hid features behind `isAdmin` (draft-dev's career button) | feature shows to testers | only remove the *page* gate, keep feature flags |
| `AdminNavPanel` rewrite breaks the phone "Admin & Dev tools" menu event | no admin menu on phone | keep `OPEN_ADMIN_NAV_EVENT` and the portal exactly |
| `/admin/star` sits under `/admin` but must let testers in (if Q1 = yes) | testers bounced | per-folder layouts (above) make this possible; one shared /admin gate would not |
| Middleware gate (the alternative) | site-wide 500 if it throws (Critical Gotcha 5) | not recommended |
| one-engine guard | none expected | nothing here mounts a match; run the guard anyway |
| Another builder edits AdminNavPanel/adminGuides at the same time (patch notes, team board) | merge conflicts | registry is a new file; keep AdminNavPanel diff to reading it |

---

## 6. Build steps, in order

| # | Step | Size | Depends |
|---|---|---|---|
| 1 | `lib/adminRegistry.ts`: 73 rows (69 pages + /, /profile, /star-dev, /admin/team) from the table above | M (≈1 h) | Harry's answers to Q3, Q4 |
| 2 | Registry test (5 checks) + `npm run` hook beside test:star | S (30 min) | 1 |
| 3 | 6 missing guides (tournament, bigger, zoomgrass, sfx, squad-builder, american) + PageGuide on those pages; rename guide titles to the new names | M (1 h) | 1 |
| 4 | `DevGate` + one layout per folder (≈60 small files, many replace an existing AdminOnly/TesterOnly line); remove 9 client checks | M (1–1.5 h) | Q1 |
| 5 | AdminNavPanel reads the registry: 4 sections, RBD row → /admin/star, opens on current group, tester variant | M (1 h) | 1, Q2 |
| 6 | `/admin/star` page: what's-what strip, group cards, docked rail (desktop), drawer (phone), Team board + Patch notes links | M–L (1.5–2 h) | 1 |
| 7 | draft-dev: V2 / Hero switch; /draft-dev2 → redirect; fix room link; delete dead DraftDevClient.tsx (ask) | S (30 min) | Q5 |
| 8 | Checks: `npx tsc --noEmit`, `node scripts/one-engine-guard.mjs`, registry test; stills at 390×844 + 1280 of pop-up, /admin/star, a tool page | S (45 min) | all |

About 7–8 hours of building in total. Steps 1–3 can be one builder; 4 and 5–6 can run in parallel after 1.

Not touched: game screens, the match engine, `app/admin/patch-notes`, `/tester/[code]`.

---

## 7. Questions for Harry

1. **Testers on pages that save shared data?** Your answer was "admin or tester" for every page. Recommend: **admins only on the 24 pages that write shared data or sit under /admin; testers on the other 45.** Reason: the server already refuses their saves, so letting them in only shows buttons that fail.
2. **Should testers get the pop-up too (only their pages)?** Recommend **yes**. Reason: on the live site a tester has no way to find a single test page today.
3. **Owners I couldn't prove** (history before 3 Sep is cut off in this copy): /admin dashboard, Football data, Players, Scrape, PL clubs, Site XP rewards, CL draft, all Draft pages, /lineups, Media lab, Tuning, First-person dribble, Live attack. Recommend: **Harry for the site/Draft ones, ask Mikey and Leo for Tuning and the two dribble/attack sandboxes.** Reason: a wrong name on a card is worse than "unknown".
4. **Old tests list OK?** (attack, bicycle, zoom-to-play, 3D look, spin, Blender, sfx audition, Ballon d'Or old beta, Scenario Builder page, Draft preview, American sandbox, Profile (new), Dream XI). Recommend **yes; also ask about Player style (Style A) and 3D match figures**, both now decided in the game. Reason: they stay one tap away under "Old tests".
5. **Delete the dead draft file?** `app/draft-dev/DraftDevClient.tsx`, 594 lines, used by nothing. Recommend **yes**. Reason: it's not a page, nobody can open it, git keeps it.
6. **Dock the rail on tool pages?** Recommend **overlay on tool pages, docked only on /admin/star and simple list pages.** Reason: a docked column would squeeze the full-screen pitches.
7. **A "Sound" group in Road to Ballon d'Or** (Sound board + Sound lab)? Recommend **yes**. Reason: neither fits Career or Match tests, and two sound pages sitting apart is what made sfx-dev get lost.
8. **Where do Players and Scrape live — PL Draft or RBD?** Both games read them. Recommend **PL Draft, also shown in RBD's Real data.** Reason: one page, found from either side.
9. **Tierlists section has one link** (the dashboard). Recommend **keep it** so the four sections you named are there; it grows when tierlist tools split out. Reason: matches your words.

---

## 8. Stills (current state, 390×844, signed out, local dev build)

In `/tmp/claude-0/-home-user-Tierlist/36643638-fd75-5950-83da-ee5f6b43df22/scratchpad/plan/img/`:

| File | What | Page height |
|---|---|---|
| current-admin-clubs.png | Club Data | 8,014 px |
| current-admin-clubs-eye.png | Its page guide open | — |
| current-star-play-dev.png | Play Area — already a hub of cards | 3,999 px |
| current-star-gallery-dev.png | Scenario gallery | 844 px (full screen) |
| current-admin-signed-out.png | /admin sends you to sign in | 1,138 px |

**Not captured:** the admin pop-up itself. It is drawn only for a signed-in admin (server check), and this sandbox can't sign in with Google. Every fact about it above is read from `components/AdminNavPanel.tsx`.
