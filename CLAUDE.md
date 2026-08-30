# KnowItBall — Project Context

> Auto-loaded every session — keep concise. Full history in `SESSION_LOG.md`. Last updated: 19 August 2026.

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
```

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

- [x] Drag-and-drop tierlist maker with @dnd-kit
- [x] Image upload to Supabase Storage with WebP compression
- [x] Custom tier rows (add/delete/reorder, custom labels + colors)
- [x] Image tools: zoom, crop, label overlay, remove
- [x] Image style options (square, landscape, portrait, circle, no crop)
- [x] Download tierlist as PNG image
- [x] Share on X (Twitter intent)
- [x] Save as New Tierlist from play mode
- [x] Google OAuth authentication
- [x] User profiles (username, anonymous toggle)
- [x] Login streak tracking
- [x] Like and save/bookmark tierlists
- [x] View count tracking
- [x] Homepage with category-grouped tierlists
- [x] Find a Tierlist page with search + category filter
- [x] Vote tierlists (community polling with live results)
- [x] Anonymous voting support
- [x] Vote tierlist likes
- [x] Admin panel (tierlists, categories, vote tierlists, category settings)
- [x] Admin: bulk image upload, import from regular tierlists
- [x] Admin: drag-and-drop image reordering (replaced arrow buttons) for both tierlist types
- [x] Admin: tier editing (labels, colors, add/remove) for both regular and vote tierlists
- [x] Admin: export backup (JSON download of all data)
- [x] Admin: linked vote tierlist picker on regular tierlists
- [x] Admin: additional categories (multi-select) on regular tierlists
- [x] Admin: cover photo crop for both tierlist types
- [x] Custom tiers saved to DB and loaded on play page (requires `tierlist_tiers.sql` migration)
- [x] Persistent global nav bar
- [x] Legal page (Privacy Policy & Terms of Use)
- [x] Site footer
- [x] Save to Profile feature (screenshot saved to user's profile)
- [x] Face detection (face-api.js TinyFaceDetector) for auto-centering player images (both regular and vote tierlists)
- [x] Admin: face detection on/off toggle per tierlist (auto-runs detection on all images when toggled on and saved)
- [x] Admin: vote tierlist batch save (all changes stage locally until Save Changes — covers cover photo, tiers, images, category, face detection, crop, reorder, import)
- [x] Rebranded to "Knowitball Tierlists" (nav, homepage, footer, 404, metadata)
- [x] Contact email: knowitballcontact@gmail.com (legal page)
- [x] Custom domain: knowitball.co.uk (Hostinger registrar → Vercel hosting)

---

## Pending Migrations / Known Issues

> **IMPORTANT**: Check these before making changes that touch these features.

| Migration File | Status | What It Does |
|----------------|--------|-------------|
| `tierlist_tiers.sql` | **RUN** | Adds `tiers` JSONB column to `tierlists` table. Migration was applied April 2026. Custom tiers for regular tierlists now persist to DB. |
| `sofifa_data.sql` | **RUN** | Creates `sofifa_players` table (sofifa_id, fifa_year, name, positions, club, league, overall, potential, age, image_url, attributes JSONB). Unique on (sofifa_id, fifa_year). |
| `draft_club_seasons.sql` | **PENDING** | Adds `get_pl_club_seasons()` SQL function — fast DISTINCT club/season lookup for the PL Draft clubs API. The API works without it (paginated fallback) but is slower. Run in Supabase SQL Editor. |
| `draft_runs_stats.sql` | **PENDING** | Adds extended stats columns to `draft_runs` (top scorer, assists, clean sheets, streaks, all six cup-winner flags) plus a unique `event_key` for dedup. Until it's run, the history API falls back to the legacy insert: history keeps working but cup/trophy achievements can't unlock and replayed seasons aren't deduped in history. Run in Supabase SQL Editor (idempotent). |
| `draft_records_full_fix.sql` | **PENDING (likely cause of Career Records bug)** | Consolidated fix for `draft_records`/`draft_personal_records` CHECK constraints. The older `draft_records_expanded.sql`/`draft_records_mode.sql`/`draft_records_fix_constraints.sql` migrations were apparently never fully run — their CHECK constraints reject `competition = 'career'` and several `record_type` values (`career_assists`, `career_avg_rating`, `most_points`, `biggest_win`, `avg_rating`), so every Career Records insert silently fails (caught and only `console.error`'d server-side, invisible to users). Run `draft_records_full_fix.sql` in Supabase SQL Editor — it's idempotent and safe to run regardless of which older migrations already applied. |
| `american_draft.sql` | **PENDING** | Creates `american_draft_rooms` and `american_draft_participants` for the standalone dev sandbox at `/draft/american`. Includes RLS policies and Realtime publication. Also patches in `linked_room_code` via `ADD COLUMN IF NOT EXISTS` — re-run it if you applied an earlier version, otherwise the sandbox's final pick fails. Not needed for American mode inside real rooms (see below). |
| `draft_american_mode.sql` | **PENDING** | Adds `american_state` JSONB to `draft_rooms`. Required for the **Draft Mode → American** setting on real multiplayer rooms. Without it the host's "Start Game" returns an error telling you to run this migration. |

### Critical Gotchas

1. **Never add columns to the admin page's initial `select()` query that don't exist in the DB yet** — Supabase returns an error (not empty results) when selecting a non-existent column, which causes the entire query to fail silently and show 0 tierlists. The admin page (`app/admin/page.tsx`) only selects: `id, title, category, cover_image_url, created_at, created_by, slug`. Extra data (tiers, images, etc.) is fetched lazily when opening the edit form.
2. **Supabase Storage structure** — All images are in the `tierlist-images` bucket as flat files with UUID filenames (plus subfolders: `cover-crops/`, `profile-saves/`, `vote-covers/`). There is no per-tierlist folder organization. Image URLs are stored in DB tables (`tierlist_images`, `vote_tierlist_images`).
3. **Image uploads** — Images are compressed client-side to WebP (1200px max, 75% quality) before upload. File names are random UUIDs. Uploaded via Supabase Storage JS client.
4. **Admin panel component (`AdminPanel.tsx`)** — ~2650 lines, contains both regular tierlist and vote tierlist management. Uses `@dnd-kit` for image reordering. Both regular tierlists and vote tierlists use a centralized batch-save pattern (`EditState` for regular, `VoteEditState` for vote) — no changes persist to DB until the user clicks Save Changes.
5. **`NEXT_PUBLIC_SUPABASE_URL` must ALWAYS point to the Supabase project URL** (e.g. `https://cagkgfketucousksgtbk.supabase.co`), NEVER the app/Vercel URL. Setting it to the app URL causes `MIDDLEWARE_INVOCATION_FAILED` (500 on every page).
6. **Supabase OAuth redirect URLs** — Must include `https://knowitball.co.uk/**` (production wildcard) and optionally the Vercel preview wildcard. The **Site URL** in Supabase Auth config must also be `https://knowitball.co.uk`.

---

## What Needs Improvement / Future Work

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
- [x] ~~**Error boundaries**~~ — Done (June 2026): `app/error.tsx` + `app/global-error.tsx`
- [ ] **Loading states** — Some pages could use skeleton loaders
- [ ] **Tierlist editing** — Can only create new, cannot edit existing tierlists after publishing
- [ ] **Sort/filter on homepage** — Users can only browse by category, no sort controls
- [ ] **PWA support** — Could be installable as a mobile app
- [x] ~~**Run `tierlist_tiers.sql` migration**~~ — Done (April 2026)
- [ ] **Online multiplayer draft** — Multiple players draft from the same PL pool (first come first served, no duplicate picks). Needs Supabase Realtime for turn sync. Relegated players get sacked; remaining players continue.
- [ ] **Player trait system (PL Draft)** — Traits that players can have or be assigned: Captain, Wonderkid, Timeless, Big Game Player, Reckless, Selfish. Not yet designed — just an idea to explore.
- [ ] **Star career: build `energy` as a real New-Star-Soccer-style gameplay mechanic** (Aug 2026) — the user's stated design: (1) a minimum energy required to START a match at all; (2) a minimum energy required to bring on a SUBSTITUTE; (3) energy regenerates when skipping to the end of the week. **This is a from-scratch build, not a re-enable** — `energy` was fully removed from the game on the user's explicit instruction ("get rid of all energy for now"), not just hidden: `CareerState.energy` no longer exists as a field at all (removed from `lib/star/types.ts`), and every consumer was removed with it — the dashboard bar, the matchday tile, the NRG-drinks shop entirely (data + UI), training's cost/gate, the Life tab's Rest-restores-energy and relationship-minigame costs (Rest still exists, now for happiness only), `week.ts`'s `rest()`/`startNewWeek()` regen math, `dilemmas.ts`'s per-choice energy effects, `selection.ts`'s `MISSED_WEEK.energy` and `hookCheck`'s "legs" (tired-legs substitution) reason — that `HookReason` value is gone too — and, in the live match itself, `CanvasMatch.tsx`'s `energyRef`/`tiredSkills()` (used to shave power/technique as a match wore on) and `hiddenMatch.ts`'s `HiddenMatchInputs.energy` term in the involvement formula (its removed weight was folded into the formula's base constant so chance-involvement frequency didn't silently shift — see the comment at `hiddenMatch.ts`'s `involvement` calc if retuning). Building the real mechanic means adding all of this back deliberately, shaped around the three points above, not restoring the old one-way-drain version — read `tests/star/week.mts`'s doc comment and `tests/star/hiddenMatch.mts`'s "Skill buys involvement" block for what the surrounding systems currently assume in energy's absence.

---

## Recent Session Changes

Full session-by-session history moved to `SESSION_LOG.md` (not auto-loaded as context — read it only when you need historical detail). Latest session: 12 July 2026 — full-site pre-launch audit (7 parallel analysis agents) + fixes across all game modes: multiplayer season-2 ready deadlock, ghost players/leave endpoint, stale season replay, XP/history double-crediting (deterministic run keys), wrong CL crediting, lost trophy history (new pending `draft_runs_stats.sql` migration), UCL pot duplicates, custom tiers now persisted on tierlist publish, Find/vote >1000-row truncation, anonymous voter-ID crashes, tic-tac-toe future dailies + score validation, manager-mode soft-locks, and more. Previous session: 30 June 2026 (cont. 4) — added editable multiplayer team names (replacing the hardcoded "{display_name} FC"); added continent-based and exclusion-based objective conditions; redesigned the multiplayer lobby host settings UI; fixed several objective-admin bugs (card removal, tab sizing, toast duration); fixed a real bug where XP/objectives/history weren't credited if a player navigated away during the season-result reveal animation (crediting was wrongly gated behind the animation finishing instead of the already-computed result). See `SESSION_LOG.md` for full detail on this and all prior sessions.

---

## Commands

```bash
npm run dev    # Start development server
npm run build  # Production build
npm run lint   # Run ESLint
```

---

## Pending Migrations

> Run in Supabase SQL Editor before touching related features.

| File | Status | Impact if missing |
|------|--------|-------------------|
| `draft_club_seasons.sql` | **PENDING** | PL Draft clubs API works but is slower (paginated fallback) |
| `draft_runs_stats.sql` | **PENDING** | Cup/trophy achievements can't unlock; replayed seasons not deduped in history |
| `draft_records_full_fix.sql` | **PENDING** | Career Records silently fail to insert (CHECK constraint mismatch on `competition`/`record_type` values) |
| `draft_american_mode.sql` | **PENDING** | American draft mode can't start on real multiplayer rooms (`draft_rooms.american_state` missing) |
| `sofifa_search_indexes.sql` | **PENDING** | Trigram indexes on `sofifa_players.positions`/`league`. The American draft no longer needs them (it filters by league equality and positions in JS), but without them any ILIKE query on those columns scans the whole table and times out. |
| `perf_indexes_jul2026.sql` | **PENDING** | `tierlist_likes` has no index leading with `tierlist_id` despite every /play and /vote view counting on it; `draft_records` has none at all. |
| `security_rls_hardening_jul2026.sql` | **PENDING — HIGHEST PRIORITY** | Closes 6 confirmed RLS holes reachable by anyone with the public anon key: writing your own XP/level and rewards, deleting every objective or every user's progression site-wide, rewriting or wiping every community vote, and writing your own `team_strength`/`status` straight into `draft_room_players` (which the simulate route trusts). Idempotent; verify with its §10 query. |
| `fix_two_digit_fifa_years.sql` | **PENDING** (new) | Clears up rows the admin clone form wrote with a two-digit `fifa_year` (26 instead of 2027) and an age of `23 + (26 - 2026) = -1977`. They render as "FC 26" because the label helper normalises anything over 100, so they hide next to the real row. The form and the API are both fixed; this is the clean-up. Look-first queries, deletes commented out. |
| `fc27_clone_premier_league.sql` | **RUN** (Aug 2026) | Cloned every FC 26 Premier League player into `fifa_year = 2027` a year older, so the 2026/27 season can be built by hand before FC 27 exists. 506 players, 20 clubs, every club's average age +1.0. It is a single statement whose result row says what happened, and it matches on **club name** (the twenty in `lib/star/kits.ts`, punctuation stripped) rather than league name — the league-name version found nothing twice. `ON CONFLICT DO NOTHING`, so re-run it to fill in anybody missing; it never undoes an edit. Manual promotions from other leagues survive re-runs (Arsenal 24→26, Newcastle 29→28 are exactly that). |
| `security_user_profiles_columns_aug2026.sql` | **PENDING** (new, Aug 2026) | The `user_profiles` update policy limits you to your own row but permits any *column*. Lets any logged-in user equip cosmetics they never unlocked (bypassing `/api/profile/equip`), set `longest_streak` to grant themselves streak trophies via `/api/stats`, and bypass the username-change cooldown. Run `security_rls_hardening_jul2026.sql` first. |
| `star_lineups.sql` | **PENDING — RUN BEFORE USING /lineups AGAIN** (new, Aug 2026) | Creates the `star_lineups` table. The Lineups/Squad Builder page used to save ONLY to browser localStorage — invisible to every other device and every other player, discovered after real work was put into building lineups that only that one browser ever saw. `/api/star/lineups` (GET public, POST admin-only via `isAdmin()`) now reads/writes this table instead; `lib/star/lineupStore.ts`'s localStorage stays as a synchronous read cache, refreshed via `fetchSharedLineups()` at app load. Until this migration runs, GET/POST both fail (table doesn't exist) and the Lineups page falls back to auto-picked sides for everyone. |

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
- `/star-match-dev` (admin-only, unlinked) — a FULL FORK of the match engine
  (`canvasEngineTest.ts`/`hiddenMatchTest.ts`/`CanvasMatchTest.tsx`) for trying out
  gameplay physics changes without touching real careers. Changes there do NOT
  reach `/star-dev` until manually ported to the production files.
- `tests/star/*.mts` — 36 suites. **Run them before changing match behaviour**;
  `tests/star/README.md` records the tuned distributions and the mistakes the
  measurements caught. `for f in tests/star/*.mts; do npx tsx "$f"; done`

---

## Recent Session

**30 August 2026 — Full match-feedback pass, real terrace chants, a false-award bug fixed, and energy pulled from the UI pending a real implementation.**

One long working session, several batches.

- Post-match feedback batch (a full itemized list from actually playing a match): scoreboard uses each club's short name when it overflows; the live commentary ticker/hint row and the aim/contact-screen tutorial diagram+text now only show in the trial, not real matches; the contact screen's power readout moved to a vertical side bar; the drag/aim arrow lengthened 20%; a redundant canvas-drawn power meter removed; "The half is over"/"That's the whistle" text removed (the button alone says it); commentary text is white throughout, not gray, and a goal line gets a real green flash instead of a near-invisible tint; the post-match stats screen now uses the same top-aligned frame and scoreboard-plate score display as the rest of the game; the Awards screen's Player of the Month card shows only the winner, not the shortlist.
- Engine bugs fixed: a tackle mid-dribble no longer flashes a stale, unrelated scenario for a moment before cutting to commentary; a ball shot over the bar now keeps flying off-screen instead of stopping dead in mid-air; rebounds off the keeper are now chaseable in the air, not just once they hit the ground (raised the height gates on the poacher poke-in and the loose-ball 50-50).
- **Difficulty investigated and fixed**: the opponent's goals — and your own team's "fell to a teammate" goals — always converted at the same flat rate regardless of team quality; only your own personally-taken shots had any upside beyond it, which is most of why scoring once or twice made a match feel safe to coast. Both flat-rate paths now get an occasional "moment of quality" clinical finish (`convertRate()` in `lib/star/hiddenMatch.ts`).
- **Commentary now tints each line by which team it's about**, using that team's real kit colour and legible ink — a per-line `isOpponent` flag threads from `hiddenMatch.ts` through `matchLog.ts`'s `LogLine` into `MatchCommentary.tsx`.
- **A real, reproducible media bug found and fixed**: a screenshot showed your own club's account posting "BREAKING — Player of the Month, one of our own" the same month the stats account correctly showed someone else winning it. Root cause: the POTM award moment carried no won/lost flag, so the club-congratulation template fired for any shortlist placement, not just an actual win — fixed in `lib/star/media/types.ts`/`detect/career.ts`, with a regression test in `tests/star/media.mts`.
- **Real terrace chants added to the media feed** (`lib/star/media/chants.ts`, user-supplied, growing over several rounds) — club win/result chants (Arsenal's "One-Nil to the Arsenal" specifically at 1-0, Liverpool's win-vs-draw/loss split, etc.) and real-player goal chants (Bellingham, Salah, Havertz's "60 MILLION DOWN THE DRAIN", an eleven-line Sam Smith song, and more). Needed two small additions: exact-match `club`/`score`/`player` gates on `Template` (`templates/index.ts`), and a new `TEAMMATE_GOAL` detector giving a single (not just a 2+) team-mate's goal a named `scorer` fact to match a chant against.
- **Energy pulled from the UI, not the data model — then, later the same day, pulled out entirely.** First pass: training no longer cost or checked it, the dashboard's top energy bar was gone, and the NRG-drinks shop was removed outright (Home page card, buy button, `Shop.tsx`'s whole `"nrg"` tab, `nrgDrinks`/`NRG_DRINKS`) — but `career.energy` itself still existed and still drained/regenerated in the background, and the Life tab's Rest button and relationship minigames still spent it. Told directly to "get rid of all energy for now," the second pass removed it completely: `CareerState.energy` no longer exists as a field at all. Gone with it — `week.ts`'s `rest()`/`startNewWeek()` regen math (Rest still exists, now happiness-only), `dilemmas.ts`'s per-choice energy effects, `selection.ts`'s `MISSED_WEEK.energy` and `hookCheck`'s tired-legs substitution reason (`HookReason` lost `"legs"`), the matchday screen's energy tile/warning, and — the parts that actually did something — `CanvasMatch.tsx`'s `tiredSkills()` (was quietly shaving your power/technique as a match wore on) and `hiddenMatch.ts`'s energy term in the chance-involvement formula (its average weight was folded into the formula's base constant so involvement frequency didn't silently drop). See the "What Needs Improvement" entry above for the real mechanic this is standing in for.

**19 August 2026 — Missing player images site-wide, teammate finishing rebalanced twice, cup/Europe draw ceremony, club strength from real squads.**

Started from "a lot of players have missing images" and grew into most of a full pass over Draft mode and the star career game's fairness/realism systems. Fourteen commits.

- **Missing images, root-caused**: SoFIFA's CDN now requires a signed-in session to serve a face at all — every `sofifa_players.image_url` is a raw hotlink, so both the live `<img>` tags and the scraper's own anonymous fetches started failing. Fixed the scraper (`scripts/scrape_missing.py`, four iterations: HTTP 403 → CORS-blocked fetch → a real `<img>` element + Playwright network capture, which works) and added two upload scripts that self-host copies in Supabase Storage instead of hotlinking: `upload_player_images.py` (the current 506-player roster) and `upload_pl_draft_images.py --year=YYYY` (Draft mode's archive, one PL edition at a time — year-suffixed filenames on purpose, since the same real player can have a different photo across editions). See "PL Draft — Data Status" above.
- **The silhouette placeholder, made consistent**: `lib/silhouette.ts` exports one `SILHOUETTE_SRC`, now used everywhere a player has no photo — it originated in Draft's player card but Draft mode turned out to have ~10 OTHER places with their own blank-circle or initials fallback (`DraftPick.tsx`, `SquadManagerDev.tsx` — the component `/draft` actually renders despite its name, `CareerRecap.tsx`, `app/draft/page.tsx`), all now fixed, plus the star career team-sheet/squad screens.
- **Teammate finishing, tuned twice in opposite directions**: first fix — `RECEIVER_CONTROL` scaled a receiver's shot-placement CEILING down with situation difficulty, not just the average, so a header/corner/cross could never mathematically clear the keeper's reach no matter how good the finish (reported as "always straight at the keeper, always saved"). Fixed by raising the floor under how much `control` shrinks the ceiling. That overcorrected — reported as 6 goals from 8 passes in one match, "if there's no defender it just goes in." Root cause was `readsKeeper` (which side to aim for) peaking at 86% for a maxed-out cutback, at which point the placement fix's now-higher ceiling reliably cleared even the best keeper. Brought `readsKeeper`'s peak down to 72%. Both fixes verified against `tests/star/finishing.mts`, which measures actual conversion rates by situation rather than trusting the formula.
- **Finisher skill, tied to the actual player**: `Receiver.skill` was a fresh random roll every single chance (`RECEIVER_ROLES`, role-shaped min/max), completely disconnected from the real squad player standing there — even though `castScenario`/`claim()` in `lib/star/lineup.ts` already casts the best AVAILABLE real player onto every role by their actual `overall`. `Identity` now carries `overall`, and at reception `receiver.skill` becomes that real player's rating (± real day-to-day noise) instead of another dice roll. Also added `ambition`, a mean-1.0 random multiplier on how far off-centre a shot aims — previously the only randomness was execution noise around an always-mathematically-optimal target; now the target itself varies shot to shot, same as a real player doesn't always go for the exact same spot.
- **Cup/Europe knockout draws are now a ceremony, not a silent update**: `CupDrawReveal.tsx` — a "Run the Draw" screen that reveals a round's ties one at a time (home name, then away, then the next tie), skippable, wired into `continueAfterMatch` in `app/star-dev/page.tsx`. Covers FA Cup/League Cup (full multi-tie hat draws) and Champions/Europa League (single "you v opponent" reveals — Conference League is unreachable by the player's own career, see `qualificationFor`, so it's untouched).
- **Every competition now resolves to a real winner, not just yours**: domestic cups used to simply stop tracking a round once you were eliminated, so no FA/League Cup winner ever existed for a season you didn't win — `finishCupToWinner()` (`lib/star/cups.ts`) plays the rest of the bracket out. Champions/Europa League gained the same for a season you were never even entered in (`crownWithoutYou()`, `lib/star/euro.ts`, weighted the same way `crownEurope` already was, but also considering that season's actual qualifying PL clubs as real candidates). `seasonQualifiers()` (`lib/star/competitions.ts`) applies the league's own documented European-qualification cascade rule across the whole division. The payoff: Community Shield and Super Cup (`seedPreSeason`) now check `CareerState.lastSeasonWinners` — computed at every season rollover — instead of the player's own trophy cabinet, so both fixtures happen against the real opponent even in a season the player won nothing.
- **Club strength, derived rather than rolled**: `LeagueTeam.strength` was a random number set once when the division was built and never touched again. `averageStartingXIRating()`/`syncLeagueStrengthFromSquads()` (`lib/star/leagueSquads.ts`) read it off the actual squad's first eleven instead (already sitting in priority order from `buildLeagueSquad`), resynced at every point `leagueSquads` changes — fetch, merge, refresh, season rollover — so a transfer or a development jump moves a club's strength without anyone recomputing it by hand.
- **A genuinely isolated test sandbox**: `/star-match-dev` (admin-only, unlinked) now runs `CanvasMatchTest.tsx` on a full fork of the engine (`canvasEngineTest.ts`/`hiddenMatchTest.ts`), not just an admin-gated view of production — so gameplay physics can be tried out (it currently has the loft/power decoupling described in the file) without risking a real career until it's deliberately ported over.
- Also: the in-match star above the human player was centred on the chin with a radius almost as big as the head (sat on the face, not above it) — halved and repositioned; the dribbling minigame's own separate `footballer()` call still said `label: "YOU"` and never got the star treatment from an earlier session.

**7 August 2026 — Star career match engine rebuilt against the NSS specification.**

Twelve items, five commits, five new test suites under `tests/star/`. Every
constant tuned by measurement rather than by eye — `tests/star/README.md` records
both the numbers and the mistakes the measurements caught.

- **Hidden match** (`lib/star/hiddenMatch.ts`) — chances used to arrive on a
  countdown with an independent coin flip for opponent goals. There is now a
  match around you: possession, five-zone territory, momentum. You are pulled in
  when your side works it into a dangerous area, and the zone decides the kind of
  chance. Your outcome feeds back. Set pieces come from moves breaking down.
- **Support play** — team-mates were a `Vec2[]` nothing read. Now: `spaceScore`,
  supporting runs that re-read the pitch every 0.3 s, pursuit of a ball not
  played straight at anyone, and a completed pass chaining into the next
  decision built from where the ball actually arrived.
- **Defending** — interception with commitment, recovery runs, live offside on
  the through-ball.
- **Contest** — ball ownership, 50-50s on a loose ball, aerial duels on headers,
  first touch on a chained scenario.
- **Perception** — vision changes what you are told, not how accurately you
  strike; energy drains across the match and costs execution only.

Verified end to end: 300 full simulated matches, no soft-locks, 6.5 chances and
1.75 goals per match.

Earlier sessions (4 August American draft/audit, 25 July squad feature, and
everything before) moved to `SESSION_LOG.md` to keep this file readable — see
that file for full detail.
