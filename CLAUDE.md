# KnowItBall — Project Context

> Auto-loaded every session — keep concise. Full history in `SESSION_LOG.md`. Last updated: 25 July 2026.

---

## What This Project Is

Football games platform at **knowitball.co.uk**. Features: drag-and-drop tierlists, community vote tierlists, PL Draft game, star career game (`/star-dev`), multiplayer draft, tic-tac-toe daily, manager mode.

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
| `fc27_clone_premier_league.sql` | **PENDING** (new) | Clones every FC 26 Premier League player into `fifa_year = 2027` a year older, so the 2026/27 season can be built by hand before FC 27 exists. Touches nothing that already exists — `ON CONFLICT DO NOTHING`, so re-running never undoes your edits. The admin player editor already offers FC 27 in its year picker. |
| `security_user_profiles_columns_aug2026.sql` | **PENDING** (new, Aug 2026) | The `user_profiles` update policy limits you to your own row but permits any *column*. Lets any logged-in user equip cosmetics they never unlocked (bypassing `/api/profile/equip`), set `longest_streak` to grant themselves streak trophies via `/api/stats`, and bypass the username-change cooldown. Run `security_rls_hardening_jul2026.sql` first. |

---

## Critical Gotchas

1. **Admin page `select()` query** — only selects `id, title, category, cover_image_url, created_at, created_by, slug`. Adding a non-existent column causes Supabase to error silently and show 0 tierlists. Extra data is fetched lazily when opening the edit form.
2. **`NEXT_PUBLIC_SUPABASE_URL`** must point to the Supabase project URL (`https://cagkgfketucousksgtbk.supabase.co`), NEVER the app/Vercel URL. Wrong value → `MIDDLEWARE_INVOCATION_FAILED` on every page.
3. **Supabase OAuth redirect URLs** — must include `https://knowitball.co.uk/**`. The Site URL in Supabase Auth config must also be `https://knowitball.co.uk`.
4. **Storage bucket** — flat UUID filenames; no per-tierlist folders. Subfolders: `cover-crops/`, `profile-saves/`, `vote-covers/`.
5. **AdminPanel.tsx** — ~2650 lines, batch-save pattern (`EditState` / `VoteEditState`). Nothing persists to DB until "Save Changes" is clicked.
6. **Anonymous voting** — uses `localStorage` UUID as voter identity (one vote per image per device).

---

## PL Draft — Data Status (July 2026)

- `sofifa_players` table exists. Scraped locally via `scripts/scrape_missing.py` (Playwright, manual captcha).
- Scraped to JSON on user's machine (`OneDrive\Desktop\sofifa_data\`): FC 26, FC 25, FC 24, FIFA 23, FIFA 22
- Still scraping: FIFA 21 → FIFA 07
- DB: FC 26 partially imported (~12.6k of 26.8k rows); re-import needed after import-route fix
- Import at: `/admin/football/scrape` → `POST /api/admin/football/import-sofifa`

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
- `tests/star/*.mts` — five suites. **Run them before changing match behaviour**;
  `tests/star/README.md` records the tuned distributions and the mistakes the
  measurements caught. `npx tsx tests/star/<name>.mts`

---

## Recent Session

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

**4 August 2026 — American draft performance + six-agent site-wide audit.**

American draft: the era pool is now also persisted to Supabase Storage (`draft-cache/` in the existing bucket) so a cold serverless instance recovers it with one read instead of ~28 queries; each round's pool is pre-built ("staged") during the previous round and consumed on advance; the pick response carries the authoritative state so the board updates with no Realtime round-trip; clients prefetch the next round's images. Also fixed: position eligibility now defers to `positionFitness` (≥0.98) rather than a position-string list, weak-card threshold +3 per season and draw weight 0.10 → 0.03, replacement signings join the bench, and `AM_POSITION_SEQUENCE` now matches the 4-3-3 in `formations.ts` (it drafted three CMs where the formation wants a CDM, so every squad had a midfielder stuck out of position).

Six parallel auditors then reviewed the whole site. Fixed since (all verified, `tsc` + build clean):

- **Any relegation broke every subsequent season.** `getSeasonTeams` returned `20 − previous` humans' worth of AI clubs when the league needed `20 − current`; the existing top-up filtered a list against itself and could never add anyone. A short league made the round-robin emit a self-fixture and the simulation threw — the room could never play again. Reproduced and fixed.
- **Four multiplayer deadlocks**: American rooms never advanced `season_number` (the replacement-draft seed flipped the room out of `complete`, so `/next-season` silently skipped); relegated managers were resurrected two seasons later and blocked `allReady` forever; simultaneous vacancy submissions silently dropped one; refreshing during an American pre-season dumped you into a draft screen that only polls.
- **Host leaving between seasons deleted the room** and everyone's career — `status === "lobby"` is also the between-seasons status.
- **Cup rewards were dead in multiplayer**: `/next-season` nulled `season_result` before the next `simulate` read it, so Super Cup, Community Shield and cup-based European qualification were unreachable. Flags now carried on `settings.previousCupResults`.
- **Tic-tac-toe**: `max_score` was clamped to 100 (real puzzles exceed 145), so most results stored as 100/100 and every archive percentage was wrong; Second Chance deleted a better score. Max is now computed server-side from the stored grid, per scoring unit (easy mode counts answers, standard counts points).
- **Tierlists**: per-image admin deletes removed Storage files shared with other tierlists (now `lib/storageCleanup.ts`); deleting the cover left a 404; failed staged uploads were silently discarded under a "saved" message; `/play` truncated vote tallies at 1000; `/find` swallowed query errors.
- **Admin player search** (which froze a live draft ~15s): dropped `select("*")` over heavy JSONB on the ids-only path, capped the follow-up query, NULLs sort last.
- Two-player rooms deadlocked after one player left; pinch-zoom re-enabled site-wide.

**Known, not yet fixed** (detail in the audit): squads without `attributes` simulate ~15 strength points weaker than identical squads with them, in the same league; profile team names can collide with AI clubs and merge rows in the league table; no draft turn timer or host override; a host who closes the tab mid-career deadlocks the room; `/star-dev` end-of-season soft-lock on refresh; `/manager` has no persistence and nothing links to it; no favicon; shared links to non-tierlist games preview as tierlist copy.

25 July 2026 — Squad feature added to star career game: named 20-player squads generated per club (`lib/star/squadData.ts`), goal events tracked per match with named scorer/assister, squad stats (season + career G/A) persisted on `CareerState.squad`, League screen has a third "Squad" tab. `SquadPlayer` and `GoalEvent` interfaces added to `types.ts`. TypeScript clean.

See `SESSION_LOG.md` for full history.
