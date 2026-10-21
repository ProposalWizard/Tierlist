# KnowItBall — Project Context

> Auto-loaded every session — keep concise. Full history in `SESSION_LOG.md`. Last updated: 23 September 2026.

---

## What This Project Is

Football games platform at **knowitball.co.uk**. Features: drag-and-drop tierlists, community vote tierlists, PL Draft game, star career game (`/star-dev`), multiplayer draft, tic-tac-toe daily, manager mode.

---

## The User's Local Machine — Never Tell Them To `git pull`/`git checkout`

Confirmed by the user directly, after hundreds of attempts: local `git pull`/`git checkout` does not work for them — do not suggest it, and do not build a workflow around them running it (e.g. "pull my branch, then run this script"). When something needs to reach their machine — a script to run locally, a file to test — **paste the full file contents directly in chat, or give them a link to the file on GitHub**, and have them create the file / copy-paste it into place by hand. This applies to every session, not just one-offs.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2.5 (App Router, TypeScript) |
| Styling | Tailwind CSS 3.4 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (bucket: `tierlist-images`, public) |
| Hosting | Vercel (auto-deploy from main) |
| Image export | html2canvas |
| Image processing | Client-side WebP compression (1200px max, 75% quality) |

---

## Deployment & Branding

- Domain: **knowitball.co.uk** (Hostinger DNS → Vercel)
- Supabase URL: `https://cagkgfketucousksgtbk.supabase.co`
- DB size: ~0.37 GB (500 MB free-tier limit; ~120 MB headroom as of June 2026)
- Site name: **Knowitball Tierlists** | Email: **knowitballcontact@gmail.com**

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://cagkgfketucousksgtbk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://knowitball.co.uk
NEXT_PUBLIC_POSTHOG_KEY=phc_ksQCEbdcPvcMaAs2u3Ejx6YnpaYYvYQLHGWbcALPskR8
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_SENTRY_DSN=            # set once a Sentry project exists — see Pending Setup below
SENTRY_ORG=                        # optional, enables source-map upload at build time
SENTRY_PROJECT=                    # optional, enables source-map upload at build time
SENTRY_AUTH_TOKEN=                 # optional, enables source-map upload at build time
STAR_SAVE_GUARD=observe            # observe (default) | enforce | off — Star Career save checks, lib/star/saveGuard.ts
NEXT_PUBLIC_GOOGLE_CLIENT_ID=      # Google sign-in id for the admin Videos recorder's Drive upload (lib/recording.ts); unset = recordings only download
TEAM_PUSH_PRIVATE_KEY=             # Team room phone notifications: the private half of the key pair, Vercel only, never in git; unset = notifications off (lib/teamRoom/notifyServer.ts)
NEXT_PUBLIC_TEAM_PUSH_KEY=         # optional: the public half; leave unset (lib/teamRoom/config.ts has it built in). Set only with a new private key, as a pair
```

Both PostHog and Sentry are wired to no-op cleanly when their env vars are unset — missing `NEXT_PUBLIC_POSTHOG_KEY` disables analytics entirely, missing `NEXT_PUBLIC_SENTRY_DSN` disables error reporting entirely, neither throws or blocks the build. `NEXT_PUBLIC_POSTHOG_KEY` is safe to commit/expose client-side by design (same class of value as a GA measurement ID) but kept in env vars here for consistency with everything else in this table.

---

## Key Design Decisions

1. **No mobile drag-and-drop** — Mobile uses tap-to-select, then tap-tier to place (for vote tierlists). Regular tierlists use @dnd-kit which has pointer sensor support.
2. **Client-side image compression** — Reduces upload size before hitting Supabase Storage. WebP format for smaller files.
3. **Anonymous voting** — localStorage UUID enables voting without login, with one-vote-per-image constraint.
4. **Service-role client** — Used server-side for admin operations and cross-user queries (bypasses RLS).
5. **html2canvas for export** — Screenshots the tier rows div directly, no server-side rendering needed.
6. **Slug generation** — Auto-generated from title with random suffix for uniqueness.

---

## What's Implemented (Complete)

The tierlist-site checklist (36 done items) is in `SESSION_LOG.md` ("Moved from CLAUDE.md, 21 Oct 2026").

---

## Older migrations and gotchas

The first migrations table (`tierlist_tiers.sql`, `sofifa_data.sql`, `american_draft.sql` and others, all RUN) and the first gotchas list moved to `SESSION_LOG.md`. The current ones are "Pending Migrations" and "Critical Gotchas" below.

---

## What Needs Improvement / Future Work

> **Star career revamp order: `STAR_ROADMAP.md`** (Mikey, 4 Oct 2026). Base game first, then ambitious projects. Keep it current.

- [ ] **Mobile drag-and-drop UX** — Regular tierlists could use a tap-to-place system like vote tierlists have
- [ ] **Google Ads integration** — Planned for monetization
- [ ] **Combined XI builder** — Future game mode
- [ ] **Blind rankings** — Future game mode
- [ ] **Match predictions** — Future game mode
- [ ] **Player ratings** — Future game mode
- [ ] **Homepage redesign** — As more game modes are added, homepage needs to feature all games
- [ ] **SEO / Open Graph images** — Dynamic OG images for shared tierlists
- [ ] **Image deletion from Storage** — When tierlists are deleted, orphaned images remain in Supabase Storage (admin delete handler does attempt cleanup, but some orphans may remain)
- [ ] **Storage organization** — All images are flat in the bucket root with UUID names; could be organized into per-tierlist folders for clarity (would require migrating existing URLs)
- [ ] **Rate limiting** — No rate limiting on API routes currently
- [ ] **Loading states** — Some pages could use skeleton loaders
- [ ] **Tierlist editing** — Can only create new, cannot edit existing tierlists after publishing
- [ ] **Sort/filter on homepage** — Users can only browse by category, no sort controls
- [ ] **PWA support** — Could be installable as a mobile app
- [ ] **Online multiplayer draft** — Multiple players draft from the same PL pool (first come first served, no duplicate picks). Needs Supabase Realtime for turn sync. Relegated players get sacked; remaining players continue.
- [ ] **Player trait system (PL Draft)** — Traits that players can have or be assigned: Captain, Wonderkid, Timeless, Big Game Player, Reckless, Selfish. Not yet designed — just an idea to explore.
- [ ] **Professional pictures for shop items and figures (Harry, 1 Oct 2026)** — "the pictures look unprofessional, I guess we can use higgsfield image gen at some point for that." The shop's per-level drawings (cars, jets, homes, boots), the signing-scene figures and similar are home-made vector drawings. Plan: generate them with Higgsfield image gen later, one consistent style across all 155 shop levels. Not started.
- [ ] **Star career: random/triggered life events** — a big brainstormed idea bank of football/footballer-life events (match-fixing bribes, doping temptation, scandal, investments, injuries, family, media, wheel-spin/coin-flip/guaranteed mechanics alongside choice-based ones) meant to keep the player always half-expecting something. Not designed against real code yet — full list captured in `STAR_LIFE_EVENTS.md`. Most natural fit is extending `lib/star/dilemmas.ts`'s choice-event shape, plus a new non-decision event shape for the wheel/coin/guaranteed ones.
- [ ] **Star career: more sponsorship types** — asked directly for a brainstorm of every plausible type of sponsorship a footballer picks up, not just the ten categories `lib/star/sponsors.ts` already has (Boots, Sports Drink, Food, Sports Clothing, Casual Clothing, Electronics, Cosmetics, Watch, Jewelry, Car). Full idea bank — new ongoing categories (position-gated, nation-gated, league-gated — three axes the current ten don't touch at all), one-off milestone deals (first goal, international debut, Ballon d'Or), and mechanic ideas beyond the current fee+objective shape (bidding wars, exclusivity, rival poaching, scandal-by-association, renewal roulette) — captured in `STAR_SPONSOR_IDEAS.md`, same brainstorm-idea-bank spirit as `STAR_LIFE_EVENTS.md`. All brand names in it are invented, not real companies.

---


## Transfers for your own player: the window list (18 Oct 2026)

Only in the summer window (end of season). No January moves for your player
("the only way you should be able to transfer is from the summer window";
`januaryTransfer.ts` stays in the files, unused). One screen in the Home
screen's look (`components/star/TransferHub.tsx`): League → Club → Negotiate,
each list a full-screen page (✕ goes back unchanged), clubs A to Z. No Nation
row (England only). No wage in the club list; you see their offer in the
talks. Your season is a letter, S best then A, B, C, D, green to red. Each
club says how keen it is (Desperate, Very keen, Keen, Interested, with a
bar); it changes nothing after you sign. Who is interested:
`lib/star/transferInterest.ts` — the letter sets how high clubs can come
from (B +1, A +2, S +3, never more); inside that, a club's aim rises with its
size and where it finished, and a gap in your position helps. Talks are the
usual NegotiationScreen; a club that walks away is off the list until next
summer. Your club is shown a fee (no club budgets yet: future work). "Find a
new club" (Stats → Contract) is gone. Not built on purpose: transfer
request, scouts watching, agents, loans, promises, moves abroad.

## Mikey's new pop-ups (Mikey, 20 Oct 2026)

Settings → Match → "Mikey's new pop-ups: New | Old" (default Old; asked for as
a toggle by name). New = `components/star/MikeyPopup.tsx`: a goal is a
scoreboard at the top whose score rolls over, with scorer and assist; every
other `showAction` word is a TV caption. Old = the pop-ups exactly as before.
Career soak for any season/cup/ladder change: `npx tsx scripts/soak/careerSoak.mts 20`.

## The world season: every league and cup is played (Mikey, 19 Oct 2026)

Read `docs/WORLD_SEASON.md` before touching it. `lib/star/world/`:
- Club rating (`clubRating.ts`): a real squad's best XI; no real squad, its
  division level moved by club data (reputation, history, spending), ±4.
  Used by the ladder, cups, Europe and your own league's invented squads.
- `career.world`: every league you're not in, the CL/EL you're not in, the
  League Cup when you're not entered, both shields. Played round by round on
  each round's real date after every match (`worldAfterMatch`), finished at
  season end (`finishWorld`, pure, cached). Same result live or at the end.
- Promotion/relegation read the world tables (+ real play-offs). Cups use the
  league's match model. Season 1 shields: Arsenal v Man City, PSG v Aston Villa.
- Viewer: League → 🌍 All leagues; Season Awards → Every league and cup
  (`career.lastWorld`).
- **Fallback if it lags:** set `WORLD_LIVE = false` (`lib/star/world/index.ts`):
  nothing plays during the season, everything plays at the end, same tables.

## The FA Cup: ten rounds, each league joins at its real round (Mikey, 19 Oct 2026)

`cups.ts openFaCup`, entrants from `competitions.ts faCupEntrantsFor`, dates in
`calendar.ts FA_CUP_SLOTS` (the game's own calendar, real order). 3rd Qualifying:
NL North + South + Step 3 = 56, 32 play (drawn North/South), 24 byes to the 12
best of each region by last season's finish. **Never your club** ("Your club
must play in every round that you get to"): the next club down takes it.
4th Q +National League (64) · R1 +League One/Two (80) · R2 40 · R3 +PL/Championship
(64) · 32 · 16 · 8 · 4 · 2. A club joining later gets its tie on the calendar the
moment it is drawn (`newCupFixtures`). An old save's six-round cup keeps its
own rounds (`cupRoundNames`, `FA_CUP_SLOTS_V1`). Test: `tests/star/faCupRounds.mts`.

**Merged with Harry's fixture pass and Lower League Trophy (21 Oct 2026).**
The Lower League Trophy is a third cup (`cupRoundNames` knows its seven rounds;
byes use the same `CupRound.byes` as the 3rd Qualifying). `tests/star/fixtureClashes.mts`
(no two games on one day, three days apart) passes with the ten rounds because:
(1) a Premier League club in Europe plays the FA Cup on `FA_CUP_SLOTS_IN_EUROPE`
(Third 18, Fourth 20, Fifth 25, Quarter 26, Semi 30; the old `clearOfEurope`
push-a-week is gone), (2) the Trophy's Round 1 is weekend 5 (was 4, the same
Wednesday as the 3rd Qualifying Round), (3) the Championship's early-January
league Tuesday is back on weekend 4 (it had moved to 18, the day before the
Championship's Third Round). Known limit: a club that plays the European
knockout play-off (9th to 24th) has two more Tuesdays, 25 and 26, next to its
Fifth Round and Quarter-Final. The old six-round tables keep `_V1` names.

## Patch-note version keys must be unique (merge, 21 Oct 2026)

`lib/patchNotesData.ts`, `lib/patchNotePages.ts`, read receipts and the team board
all key on the version string. Harry's branch and main each used 0.60 to 0.63 for
different notes. Main's (Leo 0.60/0.61, Mikey 0.62/0.63) keep those numbers;
Harry's four are **0.60h, 0.61h, 0.62h, 0.63h** (pages in `patch-notes/pages/0.6Xh/`).
Before numbering a new note, search the data file for the number on BOTH branches.

## Running after a chance (B14, Harry, 20 Oct 2026)

Any pass you play in open play with a goal in the picture plays on in the
same picture, whatever the Chances setting (`lib/star/playOn.ts` THE RUN).
Auto run by default (phone, and whenever you don't steer); W A S D / arrows
+ Shift on a computer; the "After you pass: Joystick" row keeps its thumb
stick. The man who takes it shoots or plays it back (`stickRead`, no
captaincy needed; a better passer and a better spot = more often). Your legs
and the stamina bar are `lib/star/legs.ts` (3D gait.ts speeds and bar; the bar
never refills past your match energy; sprinting costs energy). The dribble in
the match (Harry 17:20) should move on these same legs. Measure:
`npx tsx scripts/b14-measure.mts`; tests `tests/star/runAfter.mts`.

## Ballon d'Or winners data (Mikey, 8 Oct 2026)

Every men's winner 1956–2025, from ballondor.com only, for a future game
mode: `data/ballondor/` (read its README). Page:
https://claude.ai/artifact/11KW1FQ1dKfbg68xSpjcmC

## Nation kits: every nation's real home and away kit (Leo, 13 Oct 2026)

`lib/star/data/nationKits.ts` reads `lib/star/data/sources/nation_kits_2026-10.json`:
211 nations, shirt / second colour / pattern words / sleeves / shorts / socks,
from each national team's Wikipedia kit box, every kit checked by eye.
`international.ts`'s `nationKits` wears them in every international match.
Shown on `/admin/clubs` → International. Redo next season with
`scripts/nation-kits/` (read its README). Only 86 of 211 nations have a drawn
flag (`lib/star/nationFlags.ts`); the rest show two bands in their kit colours.

## Blender runs in the cloud sessions (Mikey, 8 Oct 2026)

The cloud environment's setup script installs Blender (`apt-get install -y
blender`); it also needs `python3-numpy` in the same line. Blender connectors
can't reach a cloud session, but headless Blender scripts can.
If `blender` is missing (8 Oct 2026: it was), the clip builder `tools/anims3d/build.py`
needs only python3 + numpy, so clips can still be made; do not skip animations for it. First use: the
farewell ovation's hugs, dap-ups, pats and claps, made with both men posed
together (`tools/ovation3d/`, read its README) →
`public/star/ovation3d/greetings.glb`. Settings → Look → "Ovation greetings:
New | Old" (`lib/star/ovationMoves.ts`).

## The garden is 3D, and joined to the 3D shop (Mikey, 3 Oct 2026)

From his recording: *"make this garden area also a 3D area … you will be the
same person in the garden as you are in the store."*
- Home → Garden opens `components/star/Garden3D.tsx` (three.js scene in
  `lib/star/garden3d/scene.ts`). The old drawn `GardenScreen` is now only the
  fallback when a phone can't run 3D.
- Same footballer as the 3D shop (`public/star/shop3d/character.glb`, kit via
  the shop's exported `dressInKit`). Team-mates sit on the bench with extra
  clips from `public/star/garden3d/anims.glb`.
- The shop stands where the house was. Its doors open the 3D shop
  (phase `shop-3d`, `atDoor`); the shop's front doors (`onDoor`) bring you back
  out (`gardenArrive` in page.tsx).
- Look pass (Harry, 5 Oct 2026): Settings → Look → "3D garden: New | Old"
  (`lib/star/garden3d/look.ts`). New = `scene.ts` (golden hour, a real shop
  front, and YOU are whatever the shop shows: people3d when "3D shop player"
  is New). Old = `sceneOld.ts`, frozen; never restyle it. ?look=old|new on
  the test page.
- Models are free CC0 packs (Kenney, Quaternius) packed by
  `tools/garden3d/export_models.py` (Blender) and `build_anims.py`. Credits:
  `public/star/garden3d/LICENSE.txt`. Test page: `/star-garden3d-dev`.

## The 3D files are packed small (6 Oct 2026)

`scripts/perf3d/shrink-models.mjs` packs the GLBs in place: meshopt geometry
and clips, WebP textures (Draco kept for props, boots, cars, where it is
smaller). **Every GLTFLoader must call `withMeshopt(loader)`**
(`lib/star/three3d/meshopt.ts`) or it fails on them. The 3D builders re-pack
at their end; a new file needs a POLICY line in the script. Details:
`scripts/perf3d/README.md`.

**Any 3D, animation, mocap, model or cut-scene work: merge `main` first, then read `docs/3D_HANDBOOK.md` (skill `3d-building`).**

## Cut scenes are scripts on one system (Harry, 9 Oct 2026)

"build a foundation and system that will be translatable for any cut scenes … don't
put limits." Every new cut scene is DATA in `lib/star/cutscene/` (read its README):
a script (set, cast, props, timeline tracks) played by `director.ts` in any art style,
from t alone (`window.__frameStep`). Scenes are GENERATED from a game event
(`generateScript(event, seed)`: story.ts beats → cinema.ts film rules); hand-made
ones (`fixtures.ts`) are the benchmark the generator must match
(`tests/star/cutscene.mts`). Never write a new bespoke cut-scene loop. The people
layer (faces, hands, IK) plugs in at `peopleAdapter.ts`. Watch any scene:
/star-style-dev → "Cut-scene Director".

## Goal videos are recordings, never re-runs (Leo, 7 Oct 2026)

"the goal replays should always be the same." Every goal in the real match
is recorded frame by frame (`lib/star/goalClip/`, CanvasMatch `onGoalClip`);
the feed and Goal Replays draw the video FROM the recording. Never rebuild a
replay by re-simulating the chance. Recordings live in IndexedDB on the
device, not in the save. Test page: `/star-goal-clips-dev`.
Sound (Leo, 8 Oct): `lib/star/goalClip/audio.ts` plans and mixes crowd,
kick, net and the commentary box (`goalClip/commentary.ts`: lead call by
finish + score line, co-commentator over the replay; 78 lines in
`public/sfx/cl-*.mp3`/`cc-*.mp3`, made by `scripts/commentary/generate.py`
with the offline Kokoro voice, each replaceable on the Sound Board). Each
account cuts its own way (`media/clipStyle.ts`; cuts in `edit.ts`). Goals
from matches you did not play are made by `goalClip/synth.ts` (a seeded
move fed through GoalRecorder; never the engine).

## Club data lives in one place, and /admin/clubs shows the gaps

Mikey, 2 Oct 2026: "make sure that you never lose this information again."
- Every sheet of club information he gives goes into
  `lib/star/data/sources/` untouched, then `python
  scripts/club-data/build_club_profile_data.py` regenerates
  `lib/star/data/clubProfileData.ts`. `lib/star/data/clubProfiles.ts`
  (`profileOf`) merges the sheets, and the game falls back to it for kits,
  grounds, club size, facilities, prestige, rivals, win chants and managers.
- `/admin/clubs` (Club Data) lists every club with every field: green given,
  amber guessed, red missing, plus a spreadsheet download. The checks are in
  `lib/star/data/clubAudit.ts`. A new kind of club information gets a column
  there too.
- **North/South 2026/27:** the clubs as given. 1st goes up. 2nd–7th play off:
  4v7 and 5v6, then 2nd and 3rd at home, then a one-off final at the higher
  finisher's ground. 21st–24th go down to Step 3 (`STEP3_*_CLUBS`), whose four
  all come up each season. Your own club finishing bottom four is forced to
  move (Step 3 has no fixtures). Tests: `tests/star/regionalLadder.mts`.

## Tuner proposals live in the terminal

When anyone asks for "the tuner proposals" (or what the Tune corrections add
up to), run `npx tsx scripts/tuner-proposals.mts` and report what it prints —
every proposal with its median, spread and the exact line to change, plus
what is still building up. Nothing is applied from the dev tools; asked for
directly: "we just want it to propose into the Claude terminal, and then we
can go from there." Apply one only when told which. It reads the shared
`star_scenario_corrections` table (needs `star_scenario_corrections.sql` run).

---

## Commands

```bash
npm run dev    # Start development server
npm run build  # Production build
npm run lint   # Run ESLint
```

---

## ONE ENGINE — every screen that plays football runs the real match

Asked for by Harry (24 Sep 2026): *"there has to be a way that ANY new feature
used the base engine … extra stuff built on top of the base engine."*

- **The real match** (`app/star-dev/page.tsx`) mounts `CanvasMatch` directly.
- **Everything else mounts `EnginePlay`** (`components/star/EnginePlay.tsx`).
  It plays the real game's size, squads and weather, with the Play Area's
  dials on that one mount only. A feature is extras around it, reading
  `onChanceServed` and `onChanceResolved`. It never gets its own loop.
- **`scripts/one-engine-guard.mjs` runs inside `npm run build`, so it
  blocks every Vercel deploy.** It fails on:
  - a new copy of the loop
  - a direct `<CanvasMatch>` mount
  - a grown `KNOWN_COPIES` list
  - a new canvas animation loop (a screen writing its own ball physics)
  - the test screens missing a setting the real match passes
  - a guard that has stopped seeing its planted canary, or flags a harmless one
- **Never** add to `KNOWN_COPIES`, raise `CEILING`, touch the canary, or remove
  the guard from the `build` script without being asked in those words. Load the `one-engine` skill
  first.
- **Shared mechanics, not a shared picture** (Harry, 24 Sep 2026: "different
  modes ... will be COMPLETELY looking different ... it has to be allowed").
  A mode keeps the real ball, drag, contact and flight, and chooses what is on
  the pitch with `scene` (`lib/star/scenePicture.ts`): no keeper, no goal, no
  team-mates, no GOAL/PASS text. Technique training is you, a ball and cones.
- **Ported (24 Sep 2026):** trial penalties and free kicks, training strike
  drills and the gauntlet. They mount `EngineFeature` (EnginePlay.tsx) and only
  build each rep's picture and score it. A trial/training difference is a
  named dial (`TEST_ONLY` in the guard), never a copy.
- **Still copies, to port next:** five-a-side only. Mikey's `/star-match-dev` fork and
  the 2 dev prototypes were deleted with their pages (Harry, 18 Oct 2026). The live list is in the guard.

**3D games are the exception (Harry, 8 Oct 2026):** *"the match engine rule has
got to be changed for 3D — surely it would be a completely different set of
rulesets almost? And that's okay as long as it doesn't infringe on the base
game."* Fully 3D games (move around, touch, keep-ups, headers, volleys, free
roam) get their OWN physics and rules, in their own folder (`lib/star/play3d/`).
Limits: they never import from or change `lib/star/canvasEngine.ts` or the 2D
match; the 2D base game is untouched by them; shared basics (ball size, gravity,
how a player's skills scale a kick) come from one shared file so the 3D ball
still feels like the same sport. Screens built on the 2D engine (trial, drills,
Crossbar Challenge's aim) keep the one-engine rule as before.

## OLD UI / NEW UI — Settings → UI: Old | New (Harry, 1 Oct 2026)

*"keep the old ui exactly how it is as a backup … old ui is current and new ui
is whatever we eventually land on."* Old UI = the career screens frozen as on
branch Harry at 4f2e839, in `components/star/legacy/` (read its README). Never
restyle or "fix" anything there. New UI = `app/star-dev/page.tsx` +
`components/star/`. Both share the save, `lib/star`, the match, training
drills and the trial. Setting: `lib/star/uiLook.ts` (per device, default New).

## SCENARIO RULES COME FROM THE DRAWINGS — the one-on-one way, for every kind

Harry, 26 Sep 2026, after hand-written corner and long-range rulesets made the
highlight sims "suck": *"go back to EXACTLY how we did it for one on ones, take
the current base scenarios and work from those, don't add rules outside of
that … going forward that's how it needs to be."*

- A chance kind is **its drawings + the rule set scanned off them**
  (`lib/star/scenarioRules.ts`, `lib/star/authoredChance.ts`). Nothing
  hand-written places people. Harry's football research decides what is worth
  MEASURING; the drawings decide the values.
- **Anything added outside that must be checked by eye**: generate a sheet of
  pictures (gallery Simulate / served chances), look at every one, and show
  them — numbers passing is not enough ("some of the generations are rlly
  bad": overlapping bodies, stranded players, a man behind the keeper).
- `lib/star/kindRules/` only holds rules Harry asked for by name (penalty
  keeper, free kicks). Long range and corners have no entry, on purpose.

## ALWAYS PLAYTEST STAR CAREER CHANGES — you can now actually see the game

> This supersedes every earlier note in this file claiming `/star-dev` can't be
> reached without Google sign-in. **It can.** Those notes are why round after
> round of gameplay work shipped saying "none of this has been seen live", and
> why several real bugs (keeper frozen mid-dive, the face outline tracing a
> rectangle, Touch Mode catching instantly, every team sheet full of
> silhouettes) each survived multiple type-clean, test-green rounds.

`/star-dev` has **no server auth gate** — `middleware.ts` only guards
`/tierlist` and `/create`. `lib/star/devMode.ts` re-enables the local-only
`ANON_SCOPE` career in development, so the game is fully playable signed-out in
a sandbox or CI. A production build inlines `NODE_ENV` to `"production"`, so
this cannot reach the live site.

**After ANY change to `lib/star/**`, `components/star/**`, `app/star-dev/**`,
or the star/draft data routes, invoke the `star-playtest` subagent** (see
`.claude/agents/star-playtest.md`) and act on what it reports. A type-check and
a green suite are necessary, not sufficient — neither can see a frozen figure,
a mis-cropped face, or a button that never appears.

Harness: `scripts/star-sandbox/` (`drive.mjs`, `play.mjs`, `match.mjs`,
`explore.mjs`) — read its README first.

**Env:** `.env.local` needs only `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. The anon key is **not a secret** (it ships in
the browser bundle of every live page) and is sufficient for real player data,
because every table the career reads is public-read by RLS: `sofifa_players`,
`club_logos`, `league_logos`, `star_lineups`. `SUPABASE_SERVICE_ROLE_KEY` is
NOT needed — `lib/supabase/publicRead.ts` falls back to the anon key for the
read-only data routes, and production is unchanged whenever the service key is
present.

**Without valid Supabase env**, every club shows "NO SQUAD YET" and falls back
to invented players. Physics/layout work is still testable; anything involving
real players is not.

**The green pre-match button is "Team sheets →", not "Play Match".** It reads
"Play Match ⚽" only when your XI is under 9 players (`teamsReady`, page.tsx) —
otherwise it routes via VersusScreen, which has its own KICK OFF. An earlier
version of this note claimed the button disappeared entirely without squad
data; that was wrong, and came from a script searching for the wrong text
rather than looking at the screen. Match on all of it.

**In-match, the ball is NOT centre-bottom.** That's only true of the trial
penalty. A real scenario places it anywhere in the framed view, so a driver
that drags from a fixed point will miss and silently produce no contact
screen. Find the ball before aiming.

---

## How to talk to this team (standing, not per-session)

Neither Harry nor Mikey writes code. Stated directly: *"we AREN'T coders -
english only."* Everything below is a standing instruction, confirmed more
than once.

**Progress updates follow `.claude/skills/progress-update/SKILL.md`: every 5
minutes on every task, with % + time left on every bar and the token/weekly
usage block on every update (Harry, 12 Oct 2026: "why aren't we using the
progress skill with the estimated tokens"). Its "auto-deploy" section is
replaced by "Deploy only when told" below.**

**No forced new chats; a nudge every 3 hours instead (Harry, 20 Oct 2026). Replaces "one build per
chat, then a handoff" (15 Oct).** *"completely disregard this - instead every 3 hours of chat give a
prompt that it could be a good time to restart the chat."* Keep building in the same chat. Once a chat
has run about 3 hours (check the first and latest message times), add one line to a reply: "It's been
about 3 hours in this chat: a good time to restart it if things feel slow. Say 'handoff' and I'll
write the starter." Then again every 3 hours. Write a handoff only when someone asks for one.

**Build slowly and correctly (Harry, 15 Oct 2026, for the admin/patch-notes/lag round).** *"instead
of running 5 parallel full builds let's build slowly and CORRECTLY."* Deep plan first, iterate it,
design (Higgsfield), then build one piece at a time, each checked and signed off before the next.

**Jobs for the team go in team/jobs.json and arrive by push, never SQL (Harry, 20 Oct 2026: "just use pushes").** See team/README.md.

**Deploy only when told (Harry, 12 Oct 2026; replaces "auto-deploy at every
major update").** *"what happened to patch notes? What happened to telling me
if I tell you to push everything currently, push it? Don't just be pushing
stuff, because sometimes it's not ready to go."* Later the same day: *"When I
say it's ready to be pushed, push it into the game … If I'm saying I need to
see patch notes first, do that. We'll just play it by ear."* So: Harry decides
each time whether to push now or see the patch notes first. Commit and push to the `Harry`
branch freely, but merge to `main` (= live) ONLY when Harry says push / deploy /
merge. Every deploy comes with patch notes. "Preview" (game version) is used
only when someone asks for it in those words; otherwise a change goes straight
into the game when it is deployed.

**No body part inside another (Harry, 20 Oct 2026).** *"as a rule something like a chin or any body part can't overlap inside another body part."* In 3D, no part of a person may pass into another part (chin into chest, arms into the torso, hands into hips, knees or feet through each other), in any clip or pose. Measure it with the self-overlap check, not by eye alone.

**3D sizes never change (Harry, 12 Oct 2026).** *"no changes in size for any
player or goalie or goal should ever occur."* In 3D, every man, the keeper and
the goal each have ONE fixed scale, the same in every chance and every frame.
Never resize them per chance, per camera move or per screen.

**Pictures as they come in, not in one go (Harry, 12 Oct 2026).** *"I want
pictures constantly as they come in instead of in one go, easier to tweak
missteps."* Builders save each finished still to the top of their output folder
the moment it is made (scratch frames in `raw/`). The lead watches those folders
(a Monitor) and sends each new still straight to Harry with a one-line caption.

**Answer shape — key point, key number, key change.** Reported directly:
*"there's sometimes too much fluff in how you speak… I'm having to skim
through too much yap."* No preamble, no restating the request, no praise for
the idea, no tour of the code. Name things the way they appear on screen; put
the file in brackets after, once, only if someone needs to find it.

**Write about 80% of the way to ASD-STE100; draw stats and rules (Harry, 2 Oct
2026).** Short sentences (20–25 words at most), active voice, simple tenses,
one word for one thing, no coder words. Any stat, rate or rule with conditions
gets a picture (bar, flow diagram, ✓/✗ table) before the words. Applies to chat
replies and every artifact. **Don't overdo the diagrams (Harry, 2 Oct): only
where a picture is clearer than one plain line.** Use the new skills as needed,
not by default. Full rules: `artifact-house-style` skill.

**Every claim carries a number, or admits it has none.** "Scoring is hard" is
not a finding. "A clean one-on-one converts at 0.0% over 250 simulated
matches" is. Always give the before alongside the after.

**Say whether you saw it, measured it, or reasoned it.** This project's real
bugs have all lived in "reasoned it" — a keeper who reacted and didn't, a
price that was three weeks and was three weeks *per match*. "I read the code
and worked it out, I haven't seen it on a screen" is a fine thing to say and
tells them whether to go and look.

**Show, don't describe, anything with a size or a shape in it.** Goal width,
figure proportions, prices, framing, difficulty. Render the options at real
phone size and let them point. Use the `show-options` agent.

**Play it before claiming it works.** A type-check and a green suite cannot
see a frozen figure or a box sitting on the ball. Use `star-playtest`.

**Ask about the one ambiguous word; build the rest.** Never block a whole
message on one unclear clause. Build what is clear, then ask one question with
its options so it can be answered in a word from a phone.

**When Harry points at a picture, name it back before building (2 Oct 2026).**
In v0.24 the Home goal was built from the wrong picture and had to be moved
twice ("move the goal back and have it exactly like image 2"). Say which
picture you are copying, in one line ("copying image 2: the goal set back where
the pitch meets the stands"), and build from that.

**Do not agree to be agreeable.** Caught directly: *"a lot of times you're
just agreeing with us… I want to know for sure if that is a good idea."*
Before agreeing with a design call, go and find what argues against it. If
nothing does, say what you checked.

**Build straight onto the branch, then film it (Harry, 27 Sep 2026).** Building
every change twice — a throwaway prototype first, then the real thing — took
about half of the v0.16 round, so it stops: approved changes are built on
`Harry` directly, filmed at phone size in the real game, and kept or undone
from the film. **The prototype-first rule survives only for things Harry has
to judge by eye** — a size, a camera, how a figure or keeper looks, a layout:
those are still prototyped in a throwaway worktree and shown before/after
before they're built for real (Harry, 27 Sep: *"film and show images of every
change … so that I can tell you if it's good now before you go ahead"*). How
the filming works: "Checking what a frame can't show" in
`scripts/playtest-video/README.md`.

**Decide, don't toggle (Harry, 12 Oct 2026). This retires the old "every new
look gets a toggle" rule.** *"We're bloating the game up so much with
different settings ... it's best to just decide things and be done with it. If
we need to revert, then it's in the files."* A new look or gameplay change is
built as THE game: no new "New | Old" row in Settings. Old versions live in
git, not in the game. Settings keeps only real player preferences (sound,
full screen, 3D quality, faces, names and the like) and Settings → UI: Old |
New. Something still being judged is tried on a test/dev page, not behind an
in-game switch.

**Decided, no toggle (12 Oct 2026).** Removed in commits `32f8d6c` and
`5681ed6` (branch of this session). To see or bring back an old option, read
the files at `ebe02ad`, the commit before both. Old phones' stored values for
these rows are ignored. Where the old code was big it is left in the files but
unreachable (the getter returns the kept value), marked "Decided, no toggle".
- **Chances:** the team's drawn chances only, everywhere (match, highlights,
  Play Area). The New chance library, its drawings, script, tests and test
  page, and the Play Area's "Generator", were DELETED ("they're wrong").
- **Chance mix:** the basic even mix. **Kane drawings:** deleted with the StatsBomb data (19 Oct 2026; real moments now come from free data, `lib/star/realMoments`).
- **Animations:** New. **Clearances:** always on. (Keepers left this list:
  "Keepers: New | Old row kept, default New, Harry 12 Oct".)
- **Dribble:** top-down in every match, with team-mates to pass to; Dribble
  duels Old. The first-person duel is on `/star-dribble-dev` only.
- **Match camera (action fit):** Old until the rebuilt camera lands.
- **2D match:** match view New, chance framing Zoom, wide chances Old, camera
  angle 20°, players 3D-made sprites, 2D players Style A, ball New.
- **Your player:** shown on EVERY chance (Mikey, 20 Oct 2026; was hidden on
  shooting chances, Harry's 12 Oct call, to be re-agreed with Harry). When a
  chance opens he is moved clear of the ball and the aim arrow
  (`lib/star/youSpot.ts`; `showYouFigure`, `lib/star/newLook.ts`).
- **Shot spread cone:** drawn in the test area only (`lib/star/testArea.ts`).
- **3D world:** garden New, house New, 3D look H, shop player New, 3D people
  New, body Before, player style New, players in a 3D match Style A, 3D quality
  look New, player light Old, motion Mocap, manager's 3D office, casino 3D +
  New look, signing 3D, 3D drill controls Auto.
- **Screens:** badges, all seasons, Ballon d'Or night, home, shop, ovation and
  ovation greetings New; drawn players Shaded; post-match reactions on.
- **Rows that stay:** full screen, sound, 3D quality, skip the line-up (main
  Settings only), Keepers New | Old (default New), Match view 3D, player names (default off), UI Old | New, the
  v0.15 test box (keeper pro, shots, knuckleball, ball physics, match flow,
  radar). **No Version picker and no Preview** — something becomes a
  "Preview" only when someone asks for that in those words.
- **Cut scenes (12 Oct 2026, later):** people and camera New, no row ("the new
  cut scenes will be staying"). The Version picker (Classic | Standard) went
  with them; the rows left live in `lib/star/lookRows.ts`.
- **Faces (12 Oct 2026, later):** photo faces OFF for everyone (real photos,
  fake faces, your uploaded photo): every head is the drawn one, Style A where
  the picture is Style A. `PHOTO_FACES` in `lib/star/faceStyle.ts`; stored
  values ignored. The Photo picker and face editors are hidden until the photo
  revamp; their code stays. Player names stay a row (default off).
- **New work (Harry, 12 Oct 2026, standing):** no New | Old row and no
  Preview entry for anything new. It goes straight into the game when Harry
  says push. Unfinished work lives on a test page, not behind a switch in
  the real game.

**No more version toggles for new work; unfinished work lives on test pages
(Harry, 12 Oct 2026). Replaces the toggle rule below for new work.** *"I don't
like that system in the slightest … when I push changes, I now create a new
version toggle. He creates a new version toggle … When I'm ready to push my
stuff, we'll push it into the actual game because I trust my own judgement.
For Leo, I think he needs to push the version 1.50 changes … into the test
pages or create new test pages."*
- Harry's changes go straight into the game when he says push. No new
  New | Old row, no Preview entry.
- Work that isn't finished (Leo's v0.15 gameplay switches and similar) goes on
  a test page (a `/star-*-dev` page, new or existing), not behind a switch in
  the real game. It moves into the game when it is ready, as a normal change.
- Existing switches stay until someone decides each one. Never delete one unasked.

**No test build link on patch notes (Harry, 3 Oct 2026, latest): mostly stills, clips only for gameplay.**
*"the test build stuff doesn't work imo so stop doing that for patch notes, lets just stick to mostly stills except gameplay stuff."*
Patch-notes pages no longer link or point to the Vercel test build, and never ask anyone to try things there.
Each change gets a still; gameplay (and animation) changes also get a short "after" clip.
This overrides the test-build parts of the two rules below.

**Stills for looks, videos only for gameplay and animation (Harry, 3 Oct 2026).
This refines the rule below.** *"the statics are fine, only gameplay and
animations need videos and u can start with a still and then push and do
those last."* Order: stills on the page, push, publish; THEN film the short
"after" clips for gameplay/animation changes and add them to the same page.
Never hold the page or the push back for a video.
Also (Harry, 3 Oct): don't write "needs Mikey's yes" on patch notes.

**Superseded filming rules (1-2 Oct 2026: before/after videos, one filming pass, the test build link on patch notes) are in `SESSION_LOG.md`.** The live rules are the two above (3 Oct 2026).

**Clear disk space before every new build (Harry, 2 Oct 2026).** *"from now on
always clear the previous worktree and disc space when starting a new build."*
Before launching builders: remove every old agent worktree from earlier rounds
(`git worktree remove --force`, then `git worktree prune`), delete old film and
render folders in the scratchpad that are no longer needed, and check `df -h`.
Keep the current round's base and anything a builder is still using.

**Perfection with efficiency (Harry, 1 Oct 2026).** *"we have to combine
perfection with efficiency. If its gonna take 30 mins less to get to the same
outcome at some points you can use a bit less effort but the layout should
always be the same."* Cut effort where it doesn't change the outcome (fewer
re-takes, lighter checks on small items); never cut the page layout — the
same cards, clips, speed buttons and toggles every time.

**Builders check light; Harry judges 3D on his phone (Harry, 5 Oct 2026).**
*"im more concerned about getting the time down."* Measured: the garden builder
spent about 3 of 4½ hours waiting on its own browser checks, because this
machine has no graphics chip (1–5 s per 3D frame). So a builder does ONE quick
check per change (it loads, no console errors, one still), measures lag only
when lag is the job, and stops there. Harry judges look and feel on his phone,
with the Old toggle as the safety net. Keep each builder's job small.

**The change list goes out before the push, every time** — written so it
survives being forwarded to someone who wasn't in the conversation. Shared
files (`app/star-dev/page.tsx`, `lib/star/types.ts`, tailwind config) get
named explicitly.

**Mikey's `STAR_ROADMAP.md` is his own list (Harry, 5 Oct 2026).** *"mikeys
list is for his own brain, we work seperately to that although it is a
useful reference if I run out my own ideas."* In Harry's sessions, Harry sets
the order; don't push back on his priorities because the roadmap ranks
something differently.

**The match engine may change, with a warning (Harry, 5 Oct 2026).** *"remove
Mikeys never change the match engine rule and make it a general guard - instead
of a rule that warns when it's happening."* Mikey's old rule (never modify
`lib/star/canvasEngine.ts`) is gone. Any session may change the engine, but
`scripts/hooks/engine-warn.mjs` (a PreToolUse hook in `.claude/settings.json`)
flags every edit as it happens. Since 19 Oct 2026 (Harry: "put it in bright red … I'm just clicking Allow, allow, allow") it ASKS every time with a red "THIS IS A MATCH ENGINE CHANGE" notice, and also asks, as "SOMETHING MAY DRIFT", on the files that decide what a play screen hands the engine (CanvasMatch, EnginePlay, ScenarioPlay, InfiniteMatch, hiddenMatch, engineProfile, playArea, scenePicture, matchView). When it fires: say so plainly in the reply and
the patch notes (what changed, why, before/after numbers), run the match tests
(`node scripts/run-star-tests.mjs finishing keeper aiming outcomes`) and
playtest before pushing.

### Which model for what (Harry, 29 Sep 2026 — standing)

Said directly when the everyday model's new version came out. Worded by role,
not by version number, so it doesn't go stale at the next release.

- **The everyday model, at medium or high effort, for common tasks:**
  reviewing for bugs, writing long artifacts and patch notes, breaking down
  playtest videos, running playtests and measurements, data pulls, merges and
  routine fixes. "Run of the mill stuff."
- **The top model for making things:** building new features, solving hard
  problems, and UI/design work.
- **Subagents follow the same split.** Pass the model when launching one:
  the everyday model for `star-playtest`, video breakdowns, reviews and
  research; the top model for a build agent doing a new feature or a UI
  rebuild. Harry's own words on heavy playing: "waste of tokens" on the
  expensive model.
- If a task straddles both, do the building on the top model and hand the
  checking and writing-up to the everyday one.
- **Update (Harry, 1 Oct 2026), overrides the lines above where they differ:**
  the everyday model at **medium** effort for reviewing recordings, building
  from recordings, and **building artifacts/pages**; the top model for the
  **logic** tasks (game rules, curves, maths, engine behaviour, hard bugs).
- **Playtest/walkthrough videos (Harry, 30 Sep 2026):** the everyday model at
  medium effort does the breakdown (download, transcript, pictures, a
  timestamped list of every point); the top model does the analysis and the
  answers. Never the other way round.

### The agent skills, and when each fires

| Agent | Use it when |
|-------|-------------|
| `star-playtest` | Any change to `lib/star/**`, `components/star/**`, `app/star-dev/**`. Boots a real browser and reports what it SAW. |
| `show-options` | A number, size, colour, shape or layout a non-coder has to judge. Renders candidates at phone size, labels each with its cost, never ships the choice. |
| `explain-and-prompt` | Writing up a build so it can be judged without opening a file, or working out which of two meanings a request had. |
| `playtest-video` (skill) | They hand over a screen recording. `scripts/playtest-video/` turns it into timestamped pictures + a transcript; every claim is checked in the real game before it's reported. |
| `make-artifact` | A build, review or batch of changes that needs a shareable page. Verdict, decisions needed, changes, numbers, what's broken, what wasn't seen — in that order. |

## Working alongside the other two developers

Three people are building this. To avoid two sessions editing the same files:

- **Branches are per-person and non-negotiable** — this session develops on
  `Harry`. Never push to another person's branch.
- **Before starting, claim a lane** — say which of these you're in, because
  they barely overlap in files:

| Lane | Primary files |
|------|---------------|
| Match physics / engine | `lib/star/canvasEngine.ts`, `hiddenMatch.ts`, `components/star/CanvasMatch.tsx`, `tests/star/{finishing,keeperDive,aiming,outcomes}.mts` |
| Career/season structure | `lib/star/{careerFlow,season,competitions,euro,cups,promotion,calendar}.ts` |
| Economy / meta systems | `lib/star/{shopData,shopDefaults,sponsors,investments,marketValue,negotiation,money}.ts`, `components/star/{Shop,Casino,Investments}.tsx` |
| Graphics / UI | `components/star/*.tsx` (non-CanvasMatch), `lib/star/{drawPlayerHead,faceStyle,firstPersonRender,scenarioRender}.ts` |
| Media / narrative | `lib/star/media/**`, `components/star/{MediaFeed,media/*}.tsx` |

- **`app/star-dev/page.tsx` is the shared collision point** — nearly every
  feature touches its phase machine. Keep edits there minimal and additive
  (a new phase + handler), never a refactor, unless the whole team agrees.
- **`lib/star/types.ts` and `tuning.ts` are also shared** — add fields, don't
  restructure.
- Rebase on `main` before pushing; prefer several small PRs over one large one.

---

## Pending Migrations

> Run in Supabase SQL Editor before touching related features.

| File | Status | Impact if missing |
|------|--------|-------------------|
| `draft_club_seasons.sql`, `draft_runs_stats.sql`, `draft_records_full_fix.sql`, `draft_american_mode.sql`, `sofifa_search_indexes.sql`, `perf_indexes_jul2026.sql`, `security_rls_hardening_jul2026.sql`, `fix_two_digit_fifa_years.sql`, `fc27_clone_premier_league.sql`, `fc27_clone_lower_leagues.sql`, `tester_access.sql`, `security_user_profiles_columns_aug2026.sql`, `star_lineups.sql`, `high_potential.sql`, `world_class_potential.sql`, `star_scenarios.sql`, `star_career_slots.sql`, `star_pass_config.sql`, `star_hall_of_fame.sql`, `star_legend_shares.sql`, `xp_atomic_award.sql`, `star_wallet.sql`, `star_scenario_corrections.sql`, `star_real_moments_picks.sql`, `star_training_levels.sql`, `team_room_v2.sql`, `star_save_guard.sql` | **RUN** (no action) | Full rows (who ran it, when, what breaks without it) are in `SESSION_LOG.md`. |
| `star_xp_config.sql` | **PENDING** (seen missing in the live database, 20 Oct 2026) | XP amounts set by admins (`/api/star/xp-config`, `lib/star/xpStore.ts`). Until it runs the route answers `migrationMissing` and the game uses its built-in amounts (`DEFAULT_XP`); nothing breaks. |
| `star_tuning_notes.sql` | **PENDING** (20 Oct: Mikey ran the SQL files, but `star_tuning_notes` still does not exist live — run this one again) (new, 14 Oct 2026) | The Tuning panel's "Say what feels off" notes (gallery, Infinite Highlights, Infinite Match; `components/star/TuningSessionPanel.tsx`, `/api/star/tuning-notes`). Anyone inserts, admins read. Until it runs a note says "Saved on this device only" and is sent with the next one that gets through. Terminal: `npx tsx scripts/tuning-notes.mts` (needs `SUPABASE_SERVICE_ROLE_KEY`; also printed by `tuner-proposals.mts`). Idempotent. |
| `star_casino.sql` | **DO NOT RUN** (switched off, 8 Oct 2026) | Harry: not now — lag, and the free database is too small (60 days of plays ≈ 150 MB at 100 daily players). `CASINO_ON_SERVER = false` in `lib/star/casinoRules.ts` keeps every game on the phone with no server call. If cheating shows up: cut storage to ~2 days + a per-account total first, then run this and flip the switch. Was: the casino on the server (Harry: "move the casino to the server"). Adds `star_casino_plays`: one row per bet, blackjack hand or Goalie Mode run (stake, payout, net, what the player saw; the dealer's hidden card in a `secret` column the browser cannot read). RLS read-own, no browser writes. Signed in, every casino game is rolled and paid by `/api/star/casino/play` (`lib/star/casinoEngine.ts`, rules shared with the phone in `lib/star/casinoRules.ts`) and the save guard allows casino money only up to the server-recorded net since the last trusted save, instead of the ×2,000 luck allowance. Until it runs: nothing breaks — the casino plays on the phone as before and the guard keeps the luck allowance. The Old UI's casino (`components/star/legacy/Casino.tsx`, frozen) still rolls on the phone: once this runs, its wins show as save-guard findings for signed-in Old UI players. Optional env `STAR_CASINO_SECRET` signs horse race cards (falls back to the service key). Idempotent; verify queries at the bottom. |

---

## Pending Setup (non-database, Sep 2026)

| What | Status | Impact if missing |
|------|--------|-------------------|
| Sentry project | **PENDING** | The error-monitoring connector's org link (`knowitball`) is correct, but the org has no project in it yet — Sentry dashboard → Projects → Create Project → "Next.js" platform. `instrumentation-client.ts`/`sentry.server.config.ts`/`sentry.edge.config.ts` are already wired to read `NEXT_PUBLIC_SENTRY_DSN`; until that env var is set in Vercel, error reporting is a deliberate no-op (not broken — just off). |
| Remote connectors (Supabase, Vercel, Adobe, PostHog, Sentry) unusable from a *remote/cloud* Claude Code session | **Not a reconnect/account issue — confirmed Sep 2026** | Every one of them fails identically with `SdkHttpError ... CLIENT_HTTP_NOT_IMPLEMENTED` dialing Anthropic's own MCP bridge, even though `ListConnectors` shows each one properly `connected`/`enabledInChat`. The local network proxy is healthy and irrelevant (`api.anthropic.com` is routed around it). This looks like a limitation of running inside a remote/cloud "Claude Code on the web" container specifically, not of any one connector or account — an earlier note here guessing "wrong Supabase/Vercel account, disconnect and reconnect" was superseded by this and shouldn't be acted on. The likely (not independently verified) fix is running Claude Code as a genuinely NEW session on the user's own machine (desktop app or local CLI) against this same repo/branch, rather than resuming this remote session. |

---

## Critical Gotchas

1. **Admin page `select()` query** — only selects `id, title, category, cover_image_url, created_at, created_by, slug`. Adding a non-existent column causes Supabase to error silently and show 0 tierlists. Extra data is fetched lazily when opening the edit form.
2. **`NEXT_PUBLIC_SUPABASE_URL`** must point to the Supabase project URL (`https://cagkgfketucousksgtbk.supabase.co`), NEVER the app/Vercel URL. Wrong value → `MIDDLEWARE_INVOCATION_FAILED` on every page.
3. **Supabase OAuth redirect URLs** — must include `https://knowitball.co.uk/**`. The Site URL in Supabase Auth config must also be `https://knowitball.co.uk`.
4. **Storage bucket** — flat UUID filenames; no per-tierlist folders. Subfolders: `cover-crops/`, `profile-saves/`, `vote-covers/`.
5. **AdminPanel.tsx** — ~2650 lines, batch-save pattern (`EditState` / `VoteEditState`). Nothing persists to DB until "Save Changes" is clicked.
6. **Anonymous voting** — uses `localStorage` UUID as voter identity (one vote per image per device).
7. **"Use their shortened names" (clubs)** — means `CLUB_SHORT_NAMES` in `lib/star/clubs.ts`, a given (not guessed) mapping for every club on the English ladder (Nottingham Forest → Forest, Tottenham Hotspur → Spurs, Crystal Palace → Palace, Manchester United → Man United, etc. — Man United, not Man Utd). `shortClub()` (`lib/star/media/grammar.ts`) reads it first; only a club outside that list (Champions League/Europa League/Other) falls back to the old suffix-stripping heuristic. Update the one table, not individual call sites, if a short name ever needs to change.

---

## PL Draft — Data Status (August 2026)

- `sofifa_players` table exists, scraped and imported for every PL edition the user needs.
- **SoFIFA's CDN now requires a signed-in session to serve a player face image at all** — every `image_url` in the table is a raw `cdn.sofifa.net` link, so both the live site's `<img>` tags AND the scraper's own anonymous fetches started failing around August 2026. This affects the star career game's current roster (fixed) and Draft mode's whole historical archive (fixed one edition at a time, see below) — anywhere else a `sofifa_players.image_url` is rendered directly is still exposed to this.
- **Fix**: self-host a copy in Supabase Storage (`tierlist-images` bucket, `player-portraits/`) instead of hotlinking SoFIFA.
  - `scripts/scrape_missing.py --year=YYYY --league=13 --download-faces` — downloads faces via a real `<img>` DOM element + Playwright network capture (a plain fetch gets CORS-blocked; this bypasses it), saves to `sofifa_data/faces/{year}/{sofifa_id}.png`.
  - `scripts/upload_player_images.py` — uploads just the current season's ~506-player roster (`fifa_year = STAR_FIFA_YEAR`), used by the star career game's team sheets. Path: `player-portraits/{sofifa_id}.png` (no year suffix — one real-world photo per player, shared across editions on purpose).
  - `scripts/upload_pl_draft_images.py --year=YYYY` — same idea for ONE Premier League edition of Draft mode's archive at a time (FA/League Cup Draft, and Champions/Europa League's PL entrants indirectly via `career.league`). Path: `player-portraits/{sofifa_id}-{year}.png` — year-suffixed here, deliberately, because the SAME real player can have a genuinely different photo across different FIFA editions and sharing one file would let a later edition's upload silently overwrite an earlier one's.
  - Run the scrape+upload pair per edition, in whatever order — no dependency between years. As of August 2026, only the current season and the seasons already re-scraped for faces have real images; everything else falls back to the silhouette (see below) until scraped.
- Import at: `/admin/football/scrape` → `POST /api/admin/football/import-sofifa` (unrelated to the image pipeline above — this is for player DATA, not photos).

---

## Star Career Game (`/star-dev`) — Key Files

- `app/star-dev/page.tsx` — phase state machine + localStorage persistence
- `lib/star/types.ts` — all interfaces (`CareerState`, `SquadPlayer`, `GoalEvent`, etc.)
- `lib/star/careerFlow.ts` — pure reducers: `makeInitialCareer`, `creditMatchResult`, `advanceSeason`
- `lib/star/matchStats.ts` — `finaliseMatch`: converts raw match tally → `MatchStats`
- `lib/star/squadData.ts` — `generateSquad(seed)`: named 20-player squads per club
- `lib/star/season.ts` — league/fixture builders, `simulateOtherFixtures`
- `components/star/CanvasMatch.tsx` — canvas match engine (goal events, commentary)
- `components/star/LeagueScreen.tsx` — Table / Fixtures / Squad tabs
- `lib/star/canvasEngine.ts` — all match physics + AI: ball flight, keeper, defenders,
  support play, space evaluation, interception, aerial duels, chaining, vision
- `lib/star/hiddenMatch.ts` — the ninety minutes you are not playing (possession,
  territory, momentum, scenario requests)
- `lib/star/cups.ts` — FA Cup/League Cup: 32-club hat draw, `playCupRound`,
  `finishCupToWinner` (plays a cup out to a real winner once you're eliminated)
- `lib/star/euro.ts` — Champions/Europa/Conference League: league phase + knockout,
  `crownEurope` (winner when you're eliminated), `crownWithoutYou` (winner in a
  season you were never entered at all — see competitions.ts's `seasonQualifiers`)
- `lib/star/competitions.ts` — `qualificationFor`/`seasonQualifiers` (who earns
  which European spot, applied to the whole division), `seedPreSeason`
  (Community Shield/Super Cup, reads `career.lastSeasonWinners`)
- `lib/star/leagueSquads.ts` — the other 19 clubs' rosters; `averageStartingXIRating`/
  `syncLeagueStrengthFromSquads` derive `LeagueTeam.strength` from the squad's
  actual starting XI rather than a fixed roll — resync after any `leagueSquads` change
- `components/star/CupDrawReveal.tsx` — the "run the draw" reveal screen for
  cup/Europe knockout rounds, wired into `continueAfterMatch` in `page.tsx`
- `lib/silhouette.ts` — `SILHOUETTE_SRC`, the one placeholder image for a player
  with no photo, shared by every screen in both Draft mode and NSS mode
- `tests/star/*.mts` — 36 suites. **Run them before changing match behaviour**;
  `tests/star/README.md` records the tuned distributions and the mistakes the
  measurements caught. `npm run test:star` runs them 4 at a time
  (`scripts/run-star-tests.mjs`; add words to run only matching files, `-j N` for N at once).

---

## Recent Session

Every dated build entry (30 Aug to 8 Oct 2026) is in `SESSION_LOG.md`, newest first. Add new history there, not here.
