# Session Log

> Detailed history of past development sessions, moved out of `CLAUDE.md` to keep
> that file lean (it's auto-loaded as context on every Claude Code prompt).
> `CLAUDE.md` keeps only the current architecture/state; this file is the archive.
> New session summaries should be appended here, not to `CLAUDE.md`.

## Session: 30 June 2026 (cont. 2) — Hall of Fame fix, multiplayer Skip removal, Career Recap pitch view

Continuation of the same-day PL Draft session. Four more user-dictated requests:

1. **Multiplayer Skip button removed** (`components/draft/DraftResult.tsx`) — the "Skip all →" button (which jumps straight to final results, spoiling the reveal for other players still watching) is now wrapped in `{!roomCode && (...)}` so it only renders in solo games. Multiplayer keeps no skip option anywhere.

2. **Hall of Fame "Career Records" always empty — root cause found**: `app/draft/records/page.tsx`'s Career Records section (Most Career Goals/Assists/Trophies/Avg Rating) showed "No records yet — be the first!" for every category despite many completed careers. Traced the write path (`DraftResult.tsx` → `POST /api/draft/records` → `draft_records`/`draft_personal_records` tables) and found the actual DB CHECK constraints (from `draft_records.sql`/`draft_records_expanded.sql`) never got expanded to allow `competition = 'career'` or several `record_type` values (`career_assists`, `career_avg_rating`, `most_points`, `biggest_win`, `avg_rating`) that the app has been sending for a while — every insert was silently rejected by Postgres and swallowed by a bare `.catch(() => {})`, with the failure only visible via `console.error` server-side (invisible to users). A migration fixing this (`draft_records_fix_constraints.sql`) already existed in the repo but was apparently never run.
   - **Fix**: wrote a new consolidated, idempotent migration `supabase/migrations/draft_records_full_fix.sql` that brings both tables to the correct final state regardless of which older migrations did/didn't run (mode column + all three CHECK constraints). **User must run this in the Supabase SQL Editor** — added to CLAUDE.md's Pending Migrations table.
   - Also changed `DraftResult.tsx`'s silent `.catch(() => {})` on the records POST to `console.error` on both non-OK responses and network failures, so any future failure is at least visible in browser devtools.
   - Removed "Most Points in All Competitions" from the Hall of Fame UI entirely (per explicit user request — it should only ever be a Premier League record) by filtering it out of the shared `SEASON_RECORD_TYPES` render loop when `competition === "all"` in `app/draft/records/page.tsx`. The payload already never sent an `all.mostPoints` value, so this was a render-only fix.
   - Could not independently verify the fix end-to-end (this sandbox has no Supabase credentials — see below); the diagnosis is from direct code/migration reading, not a live DB check.

3. **Average Best XI redesigned as a pitch view** (`components/draft/CareerRecap.tsx`) — the "Best XI (Highest Season Rating)" list/table was replaced with a 4-3-3-shaped pitch visual (mirrors `SquadManagerDev.tsx`'s Arrange Squad pitch styling): circular avatar per slot (initials + position-tinted background via `getPositionColor` from `formations.ts` — no player photos exist in this data model, `AllTimePlayer` has no image field), player surname, best-season rating (color-coded), and "S{season} — {owner}" below. Slot coordinates hardcoded in a new `BEST_XI_SLOT_COORDS` array since the Best XI's position list (GK/LB/CB/CB/RB/CM/CM/CM/LW/ST/RW) is fixed, not formation-driven.

4. **Live, all-20-team-updating PL table — investigated, not implemented**: user asked for the league table to update live (every team's W/D/L/GD/Pts) during the season reveal, in both solo and multiplayer, but explicitly said to skip it if it would be heavy/slow. Found that the simulator only retains full per-match results for the human's own 38 PL matches; all 342 AI-vs-AI fixtures are folded into aggregate table totals via `simulateNeutralMatch()` with no per-fixture record kept and no full 20-team fixture list anywhere on `SeasonResult`. Making all 20 rows update live during reveal would require real simulator changes (retaining/scheduling all 342 AI-AI results matchweek-by-matchweek), not a UI tweak — skipped per the user's own discretion instruction. (A cheap fallback — ticking up only the human's own row live — would be trivial if wanted later, but wasn't requested.)

**Sandbox/Supabase note**: this remote sandbox has no Supabase credentials configured (`NEXT_PUBLIC_SUPABASE_URL` etc. all unset, only `.env.local.example` exists) — `npm run dev` 500s on every route via the auth middleware. This is an environment-configuration gap in the Claude Code on the web environment settings, not something changed in code; the user needs to add the real credentials there for live browser verification to work in this sandbox. All work this session was verified via `npx tsc --noEmit` only.

## Session: 23 June 2026 — Database storage cleanup (1.02 GB → ~0.37 GB)

Goal: get the Supabase database under the 500 MB free-tier limit without breaking any feature. Achieved ~0.37 GB total (was 1.02 GB) — roughly a two-thirds reduction with ~120 MB headroom to spare.

**What was removed and why it's safe:**

1. **sofifa_players JSONB slimming (745 MB → ~168 MB data):** Deleted unused/duplicate keys from the `attributes` JSONB in two waves.
   - *Wave 1 (junk + duplicates):* keys that duplicated real table columns (`club`, `league`, `sofifa_id` already exist as columns and are the only copies the code reads) plus other junk. **Kept `attr_vl`** (market value) at user's request.
   - *Wave 2 (real-but-unused stats):* 16 detailed FIFA stats that the season simulator never reads (e.g. finishing, positioning, vision, long shots, short passing, interceptions, standing tackle, marking, reactions, sprint speed, etc.).
   - Done via batched `UPDATE ... SET attributes = attributes - ARRAY[...] LIMIT 30000` (Supabase SQL Editor ~2 min timeout requires batching), then `VACUUM FULL sofifa_players` to reclaim disk.

2. **Goal/assist attribution simplified** (`lib/seasonSimulator.ts`): `goalScoringWeight()` and `assistWeight()` rewritten to use ONLY the 7 phase-rating stats (pace, shooting, passing, dribbling, defending, physical, crossing) instead of 14+ detailed stats. **Match win/draw/lose outcomes are completely unaffected** — only who gets credited the goal/assist changed. This let Wave 2 stats be deleted safely.

3. **Wikidata tables pruned** (used by Tic-Tac-Toe / squad-builder helpers, NOT the draft game):
   - Deleted all players born ≤1958 from `football_players` + `football_careers`.
   - Dropped columns: `football_players.image_url`, `.popularity`, `.date_of_birth`, `.updated_at`; `football_clubs.image_url`; `football_countries.flag_url`.
   - Code was updated to stop selecting these columns **before** they were dropped (see gotcha #1 — selecting a non-existent column errors the whole query). Player search/grids now return `image: null`, `dob: ""`; ranking is by name-match quality only.

**Code changed this session** (all on `claude/recover-tierlist-website-3BajA`):
- `lib/seasonSimulator.ts` — simplified attribution weights.
- `app/api/football/search/route.ts`, `app/api/admin/football/{players,teams,crossclub,ttt-grid,leagues}/route.ts` — removed dropped columns from selects + ranking logic.
- `app/api/admin/football/import/route.ts` — added `slimPlayer()`/`slimClub()` whitelist functions so re-imports only write columns that still exist; retired `flags` and `enrich-images` steps (return `{ removed: true }`).

**Important gotchas:**
- `VACUUM FULL` is **required** after big deletes — Postgres marks rows reusable but doesn't shrink files. It **cannot run inside a transaction**, so in the Supabase SQL Editor run each `VACUUM FULL <table>;` on its own (one statement at a time), never several semicolon-separated together.
- `pg_total_relation_size` includes indexes; the dashboard "Large Objects" view shows data only — they won't match.
- The roster API (`app/api/draft/roster/route.ts`) still extracts all 22 attrs from JSONB; deleted ones now read as 0, which is harmless (simulator ignores them). Minor dead-reference tech debt, not broken.
- Easy future headroom if needed: drop unused sofifa indexes `idx_sofifa_name` (~14 MB), `idx_sofifa_overall`, `idx_sofifa_league_year` (~30–40 MB total) — won't affect the draft game.

## Session: ~June 2026

1. **PL Draft game built** — Full game at `/draft` (see "PL Draft Game" section above). Linked from `GameSidebar`.
2. **SoFIFA scraping pipeline** — `scripts/scrape_missing.py` for local Playwright scraping of FIFA 07–21; import via `/admin/football/scrape`. Scraper detection now counts player links (≥10) instead of relying on a `table.table` selector that no longer matches.
3. **Attribute-based simulation** — `lib/seasonSimulator.ts` rewritten to use real FIFA attributes for phase ratings, scorer/assister weighting, position fitness, and per-match player ratings. Roster API extracts 22 attributes from JSONB.
4. **Draft progress persistence** — picks save to localStorage after each pick; Resume/Discard banner on setup screen.
5. **Error boundaries added** — `app/error.tsx`, `app/global-error.tsx`.
6. **PL league filter fix** — clubs API patterns anchored so Scottish/Russian "Premier League" clubs are excluded (would have appeared once FIFA 07–13 data imported). New optional `draft_club_seasons.sql` migration adds a fast RPC.
7. **Import route hardening** — row-by-row fallback when chunk upserts fail; FC 26 needs re-import (earlier bug saved only ~half).

## Session: 25 March 2026

1. **Admin image reordering** — Replaced arrow buttons (← →) with `@dnd-kit` drag-and-drop for both regular and vote tierlist image grids in admin. Crop button (✂) kept. Uses `PointerSensor` with 5px activation distance so clicks still work.

2. **Tier editing in admin** — Added tier editing UI (labels, colors, add/remove rows) to regular tierlist admin edit form (saved via "Save Changes" button). Vote tierlist tier editing is now always visible when expanded (removed the "Edit tiers" toggle — tiers auto-load on expand).

3. **Custom tiers for regular tierlists** — Added `tiers` JSONB column migration (`tierlist_tiers.sql`), updated admin PATCH API to accept `tiers`, added `initialTiers` prop to `TierlistBoard`, play page passes saved tiers. Falls back to default S/A/B/C/D if column doesn't exist.

4. **Admin tierlists disappearing bug** — Adding `tiers` to the admin page `select()` query broke the page because the column didn't exist yet. Fixed by removing it from the query and fetching tiers lazily in `openEdit()`.

5. **Export backup** — New `GET /api/admin/export` endpoint returns a JSON file with all tierlists (with images grouped inline), vote tierlists (with images), and categories. "Export Backup" button added to admin panel tab bar.

## Session: ~11 April 2026

1. **Face detection** — Added `face-api.js` (TinyFaceDetector) for client-side face detection. New `lib/faceDetection.ts` with `processImage()` (for uploads) and `detectFaceFromUrl()` (for existing images). Returns `FaceCenter { x, y }` as percentages. Results cached in localStorage. Positions bias upward by 50% of face-box height to keep the full head visible in cover-crop thumbnails.

2. **Face detection toggle** — Added `face_detection_enabled` column to both `tierlists` and `vote_tierlists` tables. Admin panel shows on/off toggle per tierlist. When toggled on, face detection runs on image upload (regular tierlists) or on save (vote tierlists).

3. **face-api.js webpack fallbacks** — Added `fs: false` and `encoding: false` webpack fallbacks in `next.config.mjs` because face-api.js imports node-only modules that aren't needed client-side.

4. **`tierlist_tiers.sql` migration applied** — User ran the migration in Supabase SQL Editor. Custom tiers now persist for regular tierlists.

## Session: 16 April 2026

1. **Vote panel image sizing fix** — `components/VoteBoard.tsx`: Changed the selected-player thumbnail in the vote side-panel from a max-height container with `object-cover` (which cropped landscape images badly) to an `aspect-square` container matching the thumbnail grid below. Now shows the same framing, just bigger.

2. **Admin vote tierlist batch save** — Major refactor of `components/AdminPanel.tsx`. The vote tierlist editor now uses a `VoteEditState` pattern where ALL changes (cover photo upload/pick/crop, tier labels/colors/add/remove, image add/crop/delete/reorder, face-detection toggle, category, import-from-tierlist) stage to local React state. Nothing persists to the DB until the user clicks "Save Changes". Unsaved changes show a yellow indicator. Closing with unsaved changes prompts a confirmation dialog. The comprehensive `handleSaveVoteEdit()` function handles: cover upload, image deletions, new image uploads (with face detection), staged crops, imports, scalar field PATCH, reorder, and auto face detection when newly toggled on.

3. **Face detection "Run detection" button removed** — The separate "Run detection on all images" button next to the face detection toggle was removed. Now, toggling face detection ON and clicking Save automatically runs detection on every image that doesn't have a `face_center` yet.

4. **Crop handlers updated for batch save** — `handleAdminCropResult` and `handleAdminCoverCropResult` now stage crops in `voteEditState` (as `pendingCropDataUrl` / `customCoverCropDataUrl`) instead of uploading immediately. Only uploaded when Save is clicked. Regular tierlist crop handlers remain unchanged (legacy immediate-upload flow).

5. **Rebranding** — All user-facing "Tierlist Maker" text changed to "Knowitball Tierlists" (homepage hero, nav, footer, 404 page, browser tab title, Open Graph + Twitter meta tags). Contact email on legal page changed to `knowitballcontact@gmail.com`.

6. **Custom domain** — `knowitball.co.uk` connected via Hostinger DNS → Vercel. Supabase Site URL and redirect URLs updated for the new domain.

## Session: 30 June 2026 — PL Draft multiplayer bug fixes

Continuation of a standing instruction to finish 6 reported multiplayer bugs from `/draft` testing (formation display, UCL shared league stage, League Cup stats, League Cup final reveal, out-of-position display, UCL knockout sharing). The last two outstanding items were completed this session:

1. **UCL/UEL league tables diverging per viewer (`lib/seasonSimulator.ts`)** — Root cause: each human's own row used a hardcoded `'KNOWITBALL FC'` placeholder while appearing under their real name in *other* humans' views, and was treated as ordinary AI filler subject to non-deterministic background simulation rather than their own real computed record. Fixed via a two-pass redesign: `simulateUCL/UELPersonalPhase` computes each human's own matches once using their real team name, with pot construction built in perspective-independent (finish-position) order; `buildUCL/UELLeagueTable` then assembles each human's full table by copying other co-qualified humans' precomputed records directly (no re-simulation) and runs the shared background-filler RNG only over genuinely-AI rows. Verified empirically: 0 mismatches across 50,000+ shared-row checks spanning 2–5 human rooms and both UCL/UEL — down from up to 93.5% mismatches before the fix.

2. **League Cup missing from `components/draft/CareerRecap.tsx`** — The Career Recap screen tracked FA Cup, UCL, UEL, Super Cup, and Charity Shield trophies/history but omitted League Cup entirely. Added `leagueCups` to the season stats, a `leagueCupAbbr()` helper (mirrors `faCupAbbr` round-name mapping), a Trophy Cabinet entry, and an "LC" column in the season-by-season table.

## Session: 30 June 2026 (cont.) — Starting XI rating, out-of-position adjusted ratings, sim speed selector

Three new PL Draft (`/draft`) feature requests, dictated by voice-to-text:

1. **Starting XI rating on Arrange Squad** (`components/draft/SquadManagerDev.tsx`) — Added a live `startingXIAvg` (raw, unweighted average overall of the 11 starters, reactive to swaps) displayed as a one-decimal number near the top of the page. Note: **`components/draft/SquadManager.tsx` is dead code** — not imported anywhere. The actual live "Arrange Squad" component, used by both `/draft` and the admin-only `/draft-dev` sandbox, is `SquadManagerDev.tsx` (imported as `SquadManager` in `app/draft/page.tsx`). Always verify the real import path before editing a component when a "Dev"-suffixed twin exists.

2. **Out-of-position adjusted rating display** — `positionFitness()` in `lib/seasonSimulator.ts` exported (was file-internal). Verified fitness tiers: 1.0 natural / 0.96 same role / 0.88 specific cross-role pairs / 0.82 adjacent role / 0.6 else (corrects a stale 92/78/60 figure previously in this doc). Added a shared `displayRating(p)` helper (raw integer when fitness is 1.0, else `(overall × fitness)` rounded to 1 decimal) in both `SquadManagerDev.tsx` and `DraftResult.tsx`, applied to: the Arrange Squad pitch view, the live "squad stats" reveal panel, and the post-season Squad Stats list. Left raw `p.overall` untouched on: bench/sub rows (simulator never fitness-penalizes subs — confirmed `positionFitness` is only called on the starters array inside `computePhaseRatings`), `DraftPick.tsx`'s roster picker (already showed raw overall; has its own separate `slotFitness()` used only for a "% fit" badge, never to adjust the number), and `CareerRecap.tsx` (has no per-player overall display at all).

3. **0.5x/1x/1.5x simulation speed selector** — `DraftResult.tsx`'s wall-clock-anchored reveal loop (`tick()`/`handleSkip`, previously hardcoded to 900ms/event) now derives `eventDurationMs = 900 / speedMultiplier` from a new optional `speedMultiplier` prop (default 1). Solo placement: a speed toggle added directly above the "Confirm Squad" button in `SquadManagerDev.tsx` (hidden when `isMultiplayer`), threaded through `onConfirm(squad, speed)` → `app/draft/page.tsx`'s `handleManageConfirm`/`handleArrangeConfirm` → `settings.simulationSpeed` → `<DraftResult speedMultiplier={settings?.simulationSpeed ?? 1}>`. Multiplayer placement: a host-only speed toggle added to `MultiplayerLobby.tsx` right above the "Simulate Season" button, calling the **existing** `onUpdateSettings({ simulationSpeed })` mechanism (same generic JSONB merge → Supabase Realtime broadcast already used for era/mode/respins/hiddenRatings — required zero backend changes, since the room-settings PATCH route and the realtime sync handler both pass arbitrary keys through unfiltered). `DraftSettings.simulationSpeed?: 0.5 | 1 | 1.5` added to the interface (duplicated in both `app/draft/page.tsx` and the standalone `app/draft-dev/DraftDevClient.tsx`, which has its own copy of the type and its own solo-only handlers). The admin-only `/draft-dev` sandbox got the same wiring for consistency (no multiplayer there).

All changes type-check clean (`npx tsc --noEmit`). Could not manually verify in a running browser this session — the sandbox has no Supabase credentials configured, so `next dev` 500s on every page via the auth middleware.

---
