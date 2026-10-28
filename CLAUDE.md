# KnowItBall — Project Context

> Auto-loaded every session — keep concise. Full history in `SESSION_LOG.md`. Last updated: 23 September 2026.

---

## The Brain: search it first (21 Oct 2026)

New facts and rules go in `brain/` notes, not in this file. Kit and how-to: `kits/brain-kit/README.md`. History goes in `SESSION_LOG.md`.

**The Brain lives in `brain/`. Search it before reading any long document.**
1. Know the code (e.g. RUL-ALL-014)? Open `brain/*/<code>.md`.
2. Otherwise grep `brain/_index*.md` for the key noun. Read ALL matching lines, then open at most 3 notes.
3. Follow a note's `source:` only when you need the full reasoning.
4. No match = say "no note yet". Never answer from a nearby note.
5. Cite the code in your answer (e.g. "RUL-ALL-014") so Harry, Mikey or Leo can check it.

**When a fact changes:** write a NEW note, set the old one to `status: superseded` + `superseded_by:`, run `python3 scripts/brain/build_index.py`. Never edit a live note's meaning in place.
**New tag?** Add it to `brain/_tags.md` first, with Harry, Mikey or Leo's OK.

---

## Mikey's chats: no patch notes, no playtests unless asked (Mikey, 21 Oct 2026)

Applies in every chat Mikey works in (local, cloud, branch Mikey). It overrides
any skill, note or line in this file that says to write patch notes or run
`star-playtest` by default. Asked for to save time and tokens.
- **Patch notes only when Mikey says "create patch notes".** Never write, update
  or republish patch notes (new or old) on your own, not even at a deploy.
- **No playtests unless Mikey asks.** When a playtest would really help, end
  the reply with one line recommending it ("Recommend a playtest: …why"), then
  stop. Mikey decides.

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

Settings → Match → "Pop-up pack: Classic | Broadcast" since 21 Oct 2026 (Harry:
"add them as a texture pack"; `lib/star/popupPack.ts`, same stored value, default
Classic = the old pop-ups). Broadcast = `components/star/MikeyPopup.tsx`: a goal is a
scoreboard at the top whose score rolls over, with scorer and assist; every
other `showAction` word is a TV caption. Classic = the pop-ups exactly as before.
Career soak for any season/cup/ladder change: `npx tsx scripts/soak/careerSoak.mts 20`.

## Game music (Mikey, 21 Oct 2026)

Settings → first card → "Game music" (off by default; asked for as a toggle).
11 original orchestral tracks inspired by Blue Lock's score (speed, key, energy
only; every note new), played by the CC0 VSCO 2 CE recordings, in
`public/star/music/`. Which plays where: `lib/star/gameMusic.ts` (pure
`matchCue`/`sceneCue`, test `tests/star/gameMusic.mts`). Page sets the screen,
CanvasMatch the match (priority 10), BallonDorNight the night; cut scenes hold
it silent. Remake or add tracks: `tools/game-music/README.md`. Mikey's Blue
Lock reference files must never go in the repo.

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

Moved to the Brain on 21 Oct 2026: 3 notes. Open a code with `brain/*/<code>.md`; the old text is frozen in `docs/brain-sources/working-rules-2026-10-21.md`.
- FACT-3D-002: scripts/perf3d/shrink-models.mjs packs the GLBs in place (meshopt, WebP, Draco); a new…
- RUL-3D-007: Every GLTFLoader must call withMeshopt(loader) or it fails on the packed…
- PRO-3D-001: Any 3D, animation, mocap, model or cut-scene work: merge main first,…

## Cut scenes are scripts on one system (Harry, 9 Oct 2026)

"build a foundation and system that will be translatable for any cut scenes … don't
put limits." Every new cut scene is DATA in `lib/star/cutscene/` (read its README):
a script (set, cast, props, timeline tracks) played by `director.ts` in any art style,
from t alone (`window.__frameStep`). Scenes are GENERATED from a game event
(`generateScript(event, seed)`: story.ts beats → cinema.ts film rules); hand-made
ones (`fixtures.ts`) are the benchmark the generator must match
(`tests/star/cutscene.mts`). Never write a new bespoke cut-scene loop. The people
layer (faces, hands, IK) plugs in at `peopleAdapter.ts`. Watch any scene:
the 3D Scene Editor (/star-scene-editor-dev → "Cut-scene Director"). The one
list of cut scenes is `lib/star/cutscene/sceneList.ts`: the editor and the 3D
Area's Cut scenes cards both read it. The old Art styles page is gone (21 Oct
2026); bare stills for the bench and filming: /star-3d-bench-dev/scene.

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

Moved to the Brain on 21 Oct 2026: 10 notes. Open a code with `brain/*/<code>.md`; the old text is frozen in `docs/brain-sources/working-rules-2026-10-21.md`.
- RUL-ENG-005: The real match (app/star-dev/page.tsx) is the only screen that mounts CanvasMatch…
- RUL-ENG-002: Every screen except the real match mounts EnginePlay; a feature never…
- RUL-ENG-003: The one-engine guard runs inside npm run build and blocks every…
- FACT-ENG-001: The guard also fails on a direct CanvasMatch mount, a grown…
- RUL-ENG-004: Never add to KNOWN_COPIES, raise CEILING, touch the canary or remove…
- RUL-ENG-006: Shared mechanics, not a shared picture: a mode keeps the real…
- FACT-ENG-002: Trial penalties, free kicks, training strike drills and the gauntlet mount…
- FACT-ENG-003: Still copies, to port next: five-a-side only; the /star-match-dev fork was…
- RUL-3D-001: Fully 3D games are the exception: own physics and rules in…
- RUL-3D-008: 3D games take shared basics (ball size, gravity, how skills scale…

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

Moved to the Brain on 21 Oct 2026: 62 notes. Open a code with `brain/*/<code>.md`; the old text is frozen in `docs/brain-sources/working-rules-2026-10-21.md`.
- RUL-ALL-002: Neither Harry nor Mikey writes code: english only, no coder words
- RUL-TEAM-003: Progress updates every 5 minutes on every task, with % and…
- RUL-TEAM-029: Leo's chats: plan as bars with times, yes/no block at the end (works, patch notes, live, merged), then 5 lines max; approvals asked together
- RUL-TEAM-004: No forced new chats: after about 3 hours of chat, add…
- RUL-TEAM-009: Build slowly and correctly: deep plan first, then build one piece…
- RUL-TEAM-007: Jobs for the team go in team/jobs.json and arrive by push,…
- RUL-TEAM-001: Deploy only when told: commit and push to the Harry branch…
- RUL-TEAM-002: Every deploy comes with patch notes; Harry decides each time whether…
- RUL-UI-004: "Preview" (game version) is used only when someone asks for it…
- RUL-3D-005: No body part may pass into another in any 3D clip…
- RUL-3D-006: 3D sizes never change: every man, the keeper and the goal…
- PRO-TEAM-003: Pictures as they come in: builders save each still at once,…
- RUL-ALL-003: Answer shape: key point, key number, key change; no preamble, no…
- RUL-ALL-004: Write about 80% of the way to ASD-STE100: short sentences (20-25…
- RUL-ALL-005: Any stat, rate or rule with conditions gets a picture, but…
- RUL-ALL-006: Every claim carries a number, or admits it has none; always…
- RUL-ALL-007: Say whether you saw it, measured it, or reasoned it
- RUL-ALL-008: Show, don't describe, anything with a size or a shape: render…
- RUL-ALL-009: Play it before claiming it works: a type-check and a green…
- RUL-ALL-010: Ask about the one ambiguous word; build the rest, then ask…
- RUL-ALL-011: When Harry points at a picture, name it back in one…
- RUL-ALL-012: Do not agree to be agreeable: before agreeing with a design…
- PRO-TEAM-004: Build approved changes straight onto the Harry branch; prototype first only…
- FACT-UI-001: Settings keeps only real player preferences (sound, full screen, 3D quality,…
- RUL-UI-001: Decide, don't toggle: a new look or gameplay change is built…
- FACT-UI-002: Decided, no toggle: to see or bring back an old option,…
- FACT-UI-003: Chances: the team's drawn chances only, everywhere; the New chance library…
- FACT-UI-004: Chance mix: the basic even mix; the Kane drawings were deleted…
- FACT-UI-005: Animations: New; Clearances: always on; Keepers New/Old row kept, default New
- FACT-UI-006: Dribble: top-down in every match with team-mates to pass to; the…
- FACT-UI-007: Match camera (action fit): Old until the rebuilt camera lands
- FACT-UI-008: 2D match: match view New, chance framing Zoom, wide chances Old,…
- FACT-UI-009: Your player is shown on EVERY chance (Mikey, 20 Oct), moved…
- FACT-UI-010: Shot spread cone: drawn in the test area only (lib/star/testArea.ts)
- FACT-UI-011: 3D world decided: garden New, house New, 3D look H, shop…
- FACT-UI-012: Screens decided: badges, all seasons, Ballon d'Or night, home, shop and…
- FACT-UI-013: Rows that stay: full screen, sound, 3D quality, skip the line-up,…
- FACT-UI-014: Cut scenes: people and camera New, no row; the Version picker…
- FACT-UI-015: Faces: photo faces OFF for everyone, every head is the drawn…
- RUL-UI-002: Unfinished work lives on a test page (a /star-*-dev page), not…
- RUL-UI-005: Harry's changes go straight into the game when he says push:…
- RUL-UI-003: Existing switches stay until someone decides each one; never delete one…
- RUL-TEAM-005: Patch notes never link the Vercel test build; mostly stills, a…
- PRO-TEAM-002: Patch notes order: stills on the page, push, publish; then film…
- RUL-TEAM-010: Don't write "needs Mikey's yes" on patch notes
- FACT-ALL-002: The superseded filming rules (before/after videos, a filming pass, the test…
- PRO-TEAM-005: Clear disk space before every new build: remove old agent worktrees,…
- RUL-TEAM-011: Perfection with efficiency: cut effort where it doesn't change the outcome;…
- PRO-TEAM-006: Builders check light: ONE quick check per change (loads, no console…
- RUL-TEAM-012: The change list goes out before the push, every time, naming…
- RUL-TEAM-013: Mikey's STAR_ROADMAP.md is his own list; in Harry's sessions Harry sets…
- PRO-ENG-001: After a match engine change: say so in the reply and…
- RUL-ENG-001: The match engine may change, with a warning: the engine-warn hook…
- FACT-ENG-004: The engine-warn hook also asks, as SOMETHING MAY DRIFT, on CanvasMatch,…
- RUL-TEAM-014: The everyday model, at medium or high effort, for common tasks;…
- RUL-TEAM-015: Subagents follow the same split: pass the model; the everyday model…
- RUL-TEAM-016: Update 1 Oct: the everyday model at medium effort for recordings…
- RUL-TEAM-017: Playtest videos: the everyday model does the breakdown; the top model…
- FACT-ALL-003: star-playtest agent: use after any change to lib/star, components/star or app/star-dev;…
- FACT-ALL-004: show-options agent: renders candidates at phone size for a number, size,…
- FACT-ALL-005: explain-and-prompt agent: writing up a build so it can be judged…
- FACT-ALL-006: playtest-video skill: a screen recording becomes timestamped pictures and a transcript
- FACT-ALL-007: make-artifact agent: a shareable page for a build, review or batch…

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

Moved to the Brain on 21 Oct 2026: 5 notes. Open a code with `brain/*/<code>.md`; the old text is frozen in `docs/brain-sources/working-rules-2026-10-21.md`.
- PRO-DAT-001: Run a pending migration in the Supabase SQL Editor before touching…
- FACT-DAT-004: Every other listed migration (draft, sofifa, security, star tables) is RUN,…
- FACT-DAT-002: star_xp_config.sql is PENDING, seen missing in the live database on 20…
- FACT-DAT-001: star_tuning_notes.sql is PENDING: the table still does not exist live, so…
- FACT-DAT-003: star_casino.sql: DO NOT RUN; the casino stays on the phone with…

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
