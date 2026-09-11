# KnowItBall — Project Context

> Auto-loaded every session — keep concise. Full history in `SESSION_LOG.md`. Last updated: 10 September 2026.

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
- [ ] **Star career: random/triggered life events** — a big brainstormed idea bank of football/footballer-life events (match-fixing bribes, doping temptation, scandal, investments, injuries, family, media, wheel-spin/coin-flip/guaranteed mechanics alongside choice-based ones) meant to keep the player always half-expecting something. Not designed against real code yet — full list captured in `STAR_LIFE_EVENTS.md`. Most natural fit is extending `lib/star/dilemmas.ts`'s choice-event shape, plus a new non-decision event shape for the wheel/coin/guaranteed ones.
- [ ] **Star career: more sponsorship types** — asked directly for a brainstorm of every plausible type of sponsorship a footballer picks up, not just the ten categories `lib/star/sponsors.ts` already has (Boots, Sports Drink, Food, Sports Clothing, Casual Clothing, Electronics, Cosmetics, Watch, Jewelry, Car). Full idea bank — new ongoing categories (position-gated, nation-gated, league-gated — three axes the current ten don't touch at all), one-off milestone deals (first goal, international debut, Ballon d'Or), and mechanic ideas beyond the current fee+objective shape (bidding wars, exclusivity, rival poaching, scandal-by-association, renewal roulette) — captured in `STAR_SPONSOR_IDEAS.md`, same brainstorm-idea-bank spirit as `STAR_LIFE_EVENTS.md`. All brand names in it are invented, not real companies.
- [x] ~~**Star career: Power & Politics ("the Rule Book")**~~ — ALL 7 PHASES of the rollout plan done, plus an unplanned Phase 8 (11 Sep 2026). Reputation, a generic voting/ceremony engine, deepened club ownership (recommendations, formations, kit vote, presidency, the §4.5 son mechanic, mergers), the Rule Book (points per result, no-draws-to-penalties, match length, offside toggle, European slot reallocation, forced league movement, new competition creation), corruption (bribery, lawyers, the black market), club facilities (real per-club stadium/training-ground/youth-academy, majority-owner upgrades, stadium revenue), and — Phase 8 — becoming president of a real governing body (`lib/star/leadership.ts`; two real thresholds, a real vote, and it genuinely bypasses the ordinary influence gate on three real powers once won) are all real and tested. Two rule fields (squad size, Champions League format) stay real, votable data by DELIBERATE CHOICE, not oversight — asked directly to wire real hooks for these, and concluded a safe partial hook doesn't exist for squad size (the only safe option, roster/bench size, would misrepresent what the rule means: on-pitch numbers) and the Champions League rewrite is genuinely multi-session-scale (`euro.ts` is 731 lines tightly keyed to a single league-table phase). Both stay open, honestly scoped, concrete next steps. Full brief and the rollout plan (with each phase's real implementation notes and every honest simplification) are in `STAR_POWER_POLITICS.md` — read that file before extending any of this further.
- [x] ~~**Star career: build `energy` as a real New-Star-Soccer-style gameplay mechanic**~~ — Done (31 Aug 2026). Built exactly to the three-point brief: a hard floor on team selection below which you're never started (`MIN_ENERGY_TO_START`) or even benched (`MIN_ENERGY_TO_SUB`, both in `lib/star/selection.ts`), and regen gated behind a deliberate choice — Rest or the new "Skip to Match Day" action (`lib/star/week.ts`) — never an automatic weekly top-up. `CareerState.energy` drains on `creditMatchResult` proportional to minutes played, resets at season rollover, and drives a transient in-match `liveEnergyAt()` in `CanvasMatch.tsx` that feeds a reinstated `tiredSkills()`, `hookCheck`'s reinstated `"legs"` reason, and `hiddenMatch.ts`'s involvement formula — all backward-compatible for callers (the star-match-dev fork) that don't track it. Paired with a genuinely new **injury system** (`CareerState.injury`, rolled per match, risk climbing with fatigue, forces `"Injured"` status, clears on a weekly countdown or season rollover) — nothing like it existed before. See `tests/star/energy.mts` (new), plus `week.mts`/`selection.mts`/`hiddenMatch.mts` extended.

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
| `high_potential.sql` | **PENDING — RUN TO ENABLE WONDERKIDS** (new, Sep 2026) | Adds `sofifa_players.high_potential boolean NOT NULL DEFAULT false`. The new toggle on the base row in `/admin/football/players` (always targets the FC 27 edition — see `STAR_FIFA_YEAR`) writes to this column via the existing PATCH route; the Star Career game reads it as `LeaguePlayer.highPotential`/`SquadPlayer.highPotential` to drive `growWonderkids` (season-rollover overall growth), `feeFor`'s transfer-fee premium, the transfer engine's bigger-club reach bonus, and a new weekly media-hype detector (`lib/star/media/detect/wonderkids.ts`). **11 Sep 2026 fix**: `app/api/star/league-squads/route.ts` originally selected this column unconditionally — since Supabase fails the WHOLE query when a column doesn't exist (not just that field), this broke EVERY real squad fetch the moment the column was added to the select, silently falling every club in every team sheet back to `generatedSquad`'s fake roster (reported directly: "both teams all have silhouettes... made up players... for every single club"). The route now retries once without `high_potential` if the query errors, so a pending migration degrades to "no wonderkid flag yet," not "no real players at all" — but wonderkids themselves still need this migration run to do anything. |

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
- `/star-match-dev` (admin-only, unlinked) — a FULL FORK of the match engine
  (`canvasEngineTest.ts`/`hiddenMatchTest.ts`/`CanvasMatchTest.tsx`) for trying out
  gameplay physics changes without touching real careers. Changes there do NOT
  reach `/star-dev` until manually ported to the production files.
- `tests/star/*.mts` — 36 suites. **Run them before changing match behaviour**;
  `tests/star/README.md` records the tuned distributions and the mistakes the
  measurements caught. `for f in tests/star/*.mts; do npx tsx "$f"; done`

---

## Recent Session

**11 September 2026 (cont.) — The REAL club-badge circle finally found (a fourth attempt), every real team-sheet squad restored, and competition betting given a real cutoff.**

- **Team sheets showing fake/silhouette players for every club — root cause found and fixed.** The wonderkids feature added `high_potential` to `app/api/star/league-squads/route.ts`'s `.select(...)` — but the corresponding migration (`high_potential.sql`, still PENDING) was never run against the live database, and Supabase fails the WHOLE query when a selected column doesn't exist (the same behaviour the admin page's own "Critical Gotchas" note already warns about). That meant EVERY real squad fetch for EVERY club failed the instant that column was added, silently falling every team sheet back to `generatedSquad`'s fake roster with silhouette portraits — reported directly: "both teams all have silhouettes... made up players... for every single club." Fixed at the route: it now retries the query once without `high_potential` if the first attempt errors, so a pending migration degrades to "no wonderkid flag yet" instead of "no real players anywhere." Wonderkids themselves still need the migration run to actually do anything.
- **The real club-badge circle, actually found — a fourth pass.** Reported four times now. Two earlier fixes chased a decorative header glow (never the cause) and a `bg-white/10` fill showing through a crest's transparent pixels (real, but only half the bug). This pass found BOTH remaining causes and removed them outright rather than reshaping again: `ClubBadge.tsx`'s real-crest `<img>` still had `rounded-full` on it, clipping a real crest (almost never circular — Forest's tree, United's shield) into a circle regardless of any fill; and `VersusScreen.tsx` had its own separate, independently-added ring wrapper around the shared `Crest` component (`rounded-full border-2 ... bg-black/20`) specifically for the team-sheet header — the same class of bug (a translucent circular fill showing through the crest's own transparent pixels) reintroduced one level up after the first fix. Both deleted, not reshaped.
- **Competition betting given a real cutoff.** Reported directly: with no cutoff, a bet placed on the last day of the season (once a title was already effectively decided) was a free win, not a real bet. `lib/star/competitionBetting.ts`'s new `canPlaceCompetitionBet` closes betting the moment the summer transfer window shuts (before August, per `calendarMonthOf`) — the same real calendar boundary `careerFlow.ts`'s own deadline-day event already fires on, read directly off the live calendar (not `career.lastTransferWindowKey`) so season 1 — whose own summer window is deliberately never run — still gets a real, working cutoff rather than a special case. Enforced both in the Casino UI (`Casino.tsx`, disabled + a clear banner once closed) and at the actual placement handler (`page.tsx`) for defense in depth.
- New `tests/star/competitionBetting.mts` section for the cutoff; full test suite and `tsc --noEmit` both pass.

**11 September 2026 — The real white-circle culprit found, wing-backs pushed forward, and the first-person duel mode now replaces the real dribble scenario.**

- **A real 21-club Premier League bug, self-healed.** Reported directly from
  a real save at season 3: the league table held 21 clubs instead of 20.
  Ruled out the current ladder math as the cause — `tests/star/promotion.mts`'s
  existing 20-season `advanceSeason` stress test passes cleanly, and there's
  no duplicate club name anywhere in `lib/star/clubs.ts` — so the corruption
  in that specific save is almost certainly a relic of an already-fixed
  historical bug, permanently baked into that save's JSON. Rather than chase
  a cause that isn't reachable from today's code, added a defensive
  self-healing step: `reconcileLadder()` (`lib/star/promotion.ts`), run at
  the end of every `resolveLadder()` call, de-duplicates any club sitting in
  two tiers at once and resizes each tier back to its correct count (excess
  demoted weakest-first, shortfalls promoted strongest-first from the tier
  below) — never inventing a club or silently dropping one. A save carrying
  this corruption self-corrects at its very next season rollover with no
  action needed. New regression test in `tests/star/promotion.mts` feeds
  `resolveLadder` a deliberately-corrupted 21-club input and asserts it heals
  to exactly 20/24/5; full 90-file suite + `tsc --noEmit` both clean.
- **Star Power & Politics — Phase 0 resolved, then Phases 1 through 4
  actually built, all in one session.** The huge future club-ownership/
  governance feature (`STAR_POWER_POLITICS.md`, `[[star_power_politics_project]]`
  memory) had four open design questions blocking Phase 1. All four
  settled first, no code touched: the Champions League format target
  (rule #7) is groups-of-4-then-knockout; the host-a-final home-advantage
  effect (rule #9) applies only when your own club is one of the
  finalists; the governing-body map ships with just FA/UEFA/FIFA/CONMEBOL;
  and §4.5's aging-up "son" mechanic is cleared to build — confirmed
  fictional (a potion/magical-ageing effect on a game character, not
  real-child doping) and scoped into Phase 3. Then, same session:
  - **Phase 1** — `lib/star/reputation.ts`, a real `Reputation` field on
    `CareerState` (world/club/government/shareholders; fan reputation
    stays `relationships.fans`, not duplicated), hooked into
    `advanceSeason` (trophies nudge world reputation, the season's board
    judgement nudges club reputation), new `ReputationScreen`.
  - **Phase 2** — `lib/star/voting.ts`, the generic vote/ceremony engine
    named in §3 (real per-option counts over a real electorate,
    reputation-biased but never guaranteed, an overrule gated above 75%
    ownership that always costs shareholder reputation), proven end to
    end on selling a player from an owned club (`investments.ts`'s
    `proposeSellPlayerVote`/`resolveSellPlayerVote`) via a new, fully
    generic `VoteCeremony` component. A real bug was caught and fixed
    during testing: `castVote`'s no-favoured-option case was silently
    defaulting roughly half of the unclaimed probability to whichever
    option was listed last, so a "neutral" vote actually ran ~75/25.
  - **Phase 3** — new `lib/star/clubPowers.ts`: minority-shareholder
    recommendations (a real, reputation-biased "the board considers it"
    roll), formation-as-manager (`clubStrengthWithFormation` — a small,
    bounded ±3 real strength effect reusing `formations.ts`'s own
    `autoPick`/`bestFitness`, never rewriting the stored league strength),
    a kit creator + a real fan vote, a shareholder-elected presidency +
    a wage paid from the club's own budget, the §4.5 son mechanic (real,
    capped, random age/ability jumps via "the potion," free transfers
    because "you're his dad"), and club mergers (100%-ownership-of-BOTH
    required, the survivor's squad capped at the normal squad-size limit,
    the absorbed club's real squad genuinely emptied, a real fan-
    reputation cost — deliberately does NOT remove the absorbed club from
    `clubs.ts`'s fixed lists, since that would break the ladder's fixed
    division-size invariants `promotion.ts`'s `reconcileLadder` exists to
    defend). A minimal but real "Powers" tab in the Boardroom screen, and
    a "Recommend" action on minority Portfolio stakes.
  - **Phase 4** — new `lib/star/governingBodies.ts` (§4.2's map as real,
    flat-priced 0-100 influence data) and `lib/star/ruleBook.ts` (points
    per result, no-draws-go-to-penalties, match length — reusing Phase
    2's `castVote`/`VoteCeremony` exactly, gated by influence, costing
    WORLD reputation on overrule rather than shareholder). `season.ts`'s
    `playLeagueWeek`/`updateLeagueWithUserResult` both take an optional
    rule-book parameter defaulting to classic 3/1/0-with-draws, so every
    existing call site sees byte-identical behaviour unless it opts in —
    only `careerFlow.ts`'s two real call sites now pass the FA's active
    rule book. Match length threads into `CanvasMatch.tsx` as a local
    value, changing when the match ends and how energy drains —
    deliberately NOT retuning `matchLog.ts`'s own commentary pacing
    (calibrated for 90 minutes), the honest, contained slice of what the
    rollout plan itself flagged as the heaviest lift of the three. New
    `RuleBookScreen`. Only the FA's rule book reaches anything this
    career actually plays — UEFA/FIFA/CONMEBOL are real, investable, but
    nothing they govern is simulated deeply enough for these three rules
    to show an effect yet.
  - `tests/star/reputation.mts`, `voting.mts`, `clubPowers.mts`,
    `ruleBook.mts` (all new) plus `investments.mts`'s own new voting
    section all pass.
  - **Phase 5** — new `lib/star/corruption.ts`: bribery (`bribeVote`, sways
    real votes toward a target, capped at 15% of the electorate — never a
    manufactured landslide), hiring lawyers (genuinely cuts exposure risk,
    never removes it — measured across 300 trials), and the black market
    (`RuleBook.bannedItems`, a real markup, wired into the real Shop
    screen with a BANNED tag) — all one shared `applyGettingCaught`
    consequence (a capped fine, a world-reputation hit, damaged boss/fan
    relationships, and a genuine suspension reusing `career.injury`'s
    exact shape rather than a second mechanic).
  - **Phase 6** — the offside toggle is genuinely wired (a module-level
    switch in `canvasEngine.ts`'s `offsideSnapshot`, set per match from
    the Rule Book, proven against a real rigged offside-position
    scenario); European slot reallocation is genuinely wired (real
    optional params on `competitions.ts`'s real `qualificationFor`/
    `seasonQualifiers`); forced league movement is genuinely wired via new
    `lib/star/forcedMovement.ts`, extending `promotion.ts`'s
    `reconcileLadder` with a real new "limbo" tier that returns to next
    season's real promotion pool — deliberately never displaces the
    player's own club; new competition creation is a real, standalone
    knockout bracket (`lib/star/newCompetition.ts`), deliberately not
    coupled to the existing FA Cup/League Cup machinery. Squad size and
    the Champions League format ship as real, VOTABLE data with an
    HONESTLY STATED gap — no gameplay hook for either yet, given the
    size/risk of rewriting the match engine or `euro.ts`'s Champions
    League simulation safely alongside five other phases in one sitting.
  - `tests/star/corruption.mts`, `phase6.mts` (both new) pass.
  - **Phase 7** (the last phase in the plan, confirmed a genuine quick
    win) — new `lib/star/facilities.ts`: every club gets a real,
    deterministic stadium/training-ground/youth-academy (hashed from the
    club's own name along three independent axes, never re-rolled),
    majority owners can rename/upgrade each for a real cost from the
    club's own budget, and a bigger stadium earns real gate-receipt
    revenue into the club's own budget every season
    (`creditStadiumRevenue`, wired into `advanceSeason`) — never touches
    the player's personal money. New Facilities section in the
    Boardroom's Powers tab. `tests/star/facilities.mts` (new) passes.
  - **All seven phases of the original rollout plan complete — then an
    unplanned Phase 8, same session.** Asked directly to also build
    "president/king of a real country" (§5's end-game framing, previously
    cut for having no concrete mechanic) and to wire real gameplay hooks
    for squad size/Champions League format. New `lib/star/leadership.ts`:
    president of a real governing body, not an invented country (nothing
    here models a country as its own entity, and a governing body already
    is one) — real thresholds on two axes (90+ world reputation AND 90+
    influence in that body), a real vote reusing Phase 2's engine, an
    overrule bar genuinely higher than the standing bar. The actual
    point: a president genuinely bypasses the ordinary influence gate on
    three real powers (proposing a Rule Book change, overruling a vote,
    forcing a club's league position) — each of those gates now checks
    the presidency as an alternative path. New Presidency section in the
    Rule Book screen. `tests/star/leadership.mts` (new) passes.
  - **Squad size and Champions League format deliberately stayed
    data-only** — considered, not skipped. The only safe partial hook for
    squad size (roster/bench size) would misrepresent what the rule
    actually means (on-pitch numbers, needing a genuine rewrite of
    `formations.ts`'s fixed-11 assumption and every team-sheet screen);
    the Champions League rewrite needs `euro.ts` (731 lines, tightly keyed
    to a single league-table phase) to grow a real parallel groups-of-4
    simulation. Both stay honest, votable data with the gap stated
    plainly in-game, rather than forcing something fake or risking the
    tested match/competition engines — real, concretely scoped next steps
    for a dedicated future session.
  - Full 98-file suite and `tsc --noEmit` both clean. Live browser
    verification of any of these eight phases' new screens wasn't
    possible this session — `/star-dev` requires Google sign-in, which
    this sandboxed session can't complete — so all of this rests on the
    type-check and full test suite only; worth a real playthrough check
    next time someone's signed in.
- **The team-sheet white circle/oval, actually found this time.** Reported three times; the first two "fixes" both chased `VersusScreen.tsx`'s header glow, which was never the cause. The real source: `ClubBadge.tsx`'s real-crest `<img>` had `bg-white/10 rounded-full` on it — a real crest (Forest's tree, United's shield) is almost never a perfect circle, so that fill showed straight through every transparent pixel the crest itself doesn't cover, different-shaped per crest (a circle for one club, an oval for another) and shifting slightly at different zoom levels along the crest's own alpha edge. Reproduced the exact mechanism with a standalone shield-SVG test page (before/after) to confirm before touching the real code. Fill removed entirely.
- **Wing-backs pushed forward.** Every 5-at-the-back formation (`back5()`, `lib/star/formations.ts`) had all five defenders on one flat `WB` line. Added `WB_ADV` (a touch ahead of `WB`) for just the LWB/RWB slots — reported directly, with a marked-up screenshot circling exactly where they should sit.
- **The real dribble scenario replaced with the first-person duel mode** — the biggest change this session. Requested directly, explicit values given:
  - **The old system is fully preserved, not deleted.** `lib/star/dribble.ts`, `CanvasMatch.tsx`'s `dribbleRef`/`finishDribble`/the `"dribble"` phase's own draw()/pointer-handling code are all still there, untouched, and still work. `CanvasMatch.tsx`'s new `USE_FIRST_PERSON_DRIBBLE` constant (currently `true`) is the ENTIRE difference — flip it to `false` and real matches use the old top-down flick-to-run scenario again, nothing else to restore. The old system, for reference: a top-down run through midfield (`newDribble`/`stepDribble`), 3-4 stationary chasers that wake at 7m and tackle at 0.9m, one flick picks your whole heading, "through" chains into a generic scenario built from wherever you ended up (usually mid-30s metres out — NOT near the box), "lost"/"out" is a turnover.
  - **New system**: `components/star/FirstPersonDribble.tsx` (built and tuned across earlier sessions in `/star-dribble-dev`) now mounts as a full overlay over `CanvasMatch`'s own canvas when `phase === "fpDribble"` (new `embedded` prop skips its standalone full-page wrapper/heading and its "Go Again" button — the match itself decides what happens next, same beat the old system used). Production values: `pace=100, oppStrength=100, chaseEye=5, chasePitchDeg=5, chaseOffset=4, cameraFollowRate=10`, `ballTouchReach` left at its own default (0.9 — "whatever it started as in the testing area").
  - **Wave shape, capped at ten total defenders**: new `pickWaveSizes()` (`lib/star/firstPersonDribble.ts`) rolls 2-4 waves of 1-4 men each, but the total across the whole run never exceeds 10 — requested directly, with the reason given: "in a real match there's only eleven players, and one of them is a goalkeeper." The cap is a hard ceiling, not a target — a wave shrinks or the run ends up with fewer waves than planned before it's ever exceeded. Threaded into `newRun()` via a new optional `waveSizes` param that takes priority over the old `rounds` count and skips the internal random-per-wave roll (the dev sandbox and existing tests don't pass it, so they're unaffected).
  - **Beat 7+ defenders and clear the run → a real attacking scenario near the box.** `FirstPersonDribble`'s `onComplete` now reports `beaten` (every defender individually marked `"beaten"`, not a re-derived guess) alongside `cleared`. `CanvasMatch.tsx`'s new `finishFpDribble`: beating fewer than 7 and clearing chains into the same advanced-midfield position the old system always used (~30m out, ambition 1 — an ordinary follow-up chance); beating 7 or more chains into a position explicitly inside the box, near the penalty spot (`PEN_SPOT_Y`) — which lands in `chainKindFor`'s existing close-range branch (~45% `one_on_one`, else `volley`/`tight_angle` — real shooting-shape chances, no through-ball/cross routing), reusing the existing, tested scenario machinery rather than building a bespoke minigame (confirmed via investigation: no such bespoke system exists anywhere in this codebase — every chance, however it's created, resolves through the same generic aim/contact/flight machinery).
  - `tests/star/firstPersonDribble.mts` extended: `pickWaveSizes`'s wave-count/per-wave/total-cap bounds (including a tight-cap case proving the cap actually wins over the ranges, not just coincidentally never binding), and `newRun`'s `waveSizes` override being used verbatim.

**10 September 2026 — England tab (real league-wide media), a real TrialPenalty bug, club logos investigated twice, and why Adobe/Supabase/Vercel don't work in this session.**

Several distinct threads, worked in the order reported.

- **Casino odds → decimal format** (`Casino.tsx`, `competitionBetting.ts`) — `{odds.toFixed(1)}:1` → `{odds.toFixed(2)}`, at every site odds are shown.
- **Investments sign/sell bug fixed**: `setSquad()`/`signPlayerForOwnedClub`/`sellPlayerFromOwnedClub` (`lib/star/investments.ts`) only ever looked in `career.leagueSquads`, which holds only the OTHER clubs in your CURRENT division — a club you own outside it (bought via investment, not promotion) lives in `career.externalSquads`, the same two-array split `scoutReport.ts`/`teamsheet.ts` already handle correctly. Fixed with a shared `findSquadEntry()` helper; `Investments.tsx` also stopped swallowing failure reasons (buttons did nothing with no explanation — now surfaces `result.reason` in a banner).
- **First-person dribble mode** (`/star-dribble-dev`) — several rounds: (1) ball occlusion fixed — only the shins now draw after the ball (torso/arms never did; full-figure occlusion was tried and measured to hide the ball almost the entire run) and boot rendering bugs (backwards toe/heel offsets, detached lift) fixed via a real Playwright render harness, not guesswork; (2) wave redesign from 3 fixed one-at-a-time defenders to 1-3 random men per wave placed across the corridor (`placeWave`, `lib/star/firstPersonDribble.ts`) — caught two real fairness bugs by measuring an oracle against the sim rather than trusting the design: one-per-band placement guaranteed a pincer (~6% clear regardless of skill), and a stale "burst away from commitSide" oracle rule stopped being correct once defenders no longer always fully converge onto your lane; (3) reported "you don't even have to time it" — measured and confirmed: the assist glow (default on) revealed the answer outright, and a burst fired the instant a man committed (his lunge by then a fixed non-reactive function of time) still cleared 32.3% of the time. Fixed by defaulting the assist glow off and having `applyBurst` fix the burst's power at fire-time (full only while genuinely telegraphing, 0.3× once committed) — same measurement afterward: 2.9%. (4) Wave size widened again, 1-3 → 1-4 men, per direct request — real difficulty curve measured and the "reading it right" oracle's threshold in `tests/star/firstPersonDribble.mts` updated to the real number (17.7%, down from 34.4%), not left stale. See `tests/star/README.md`'s `firstPersonDribble.mts` section for the full numbers. **Still open, reported directly and not yet fixed**: the ball still reads as behind/attached to the player's body rather than clearly in front from the chase-cam, and the leg/reach motion still looks unnatural ("flailing") — a render-harness investigation was mid-flight (found the likely cause: at this camera's geometry a ball only ~1m ahead of the feet already projects up near hip/chest height on screen, which several camera-constant tweaks didn't fix enough) when the conversation moved on to other reports. Picking this back up needs the harness approach (`renderFirstPerson`'s `own` path, rendered via a transpiled-JS + Playwright screenshot loop — real numbers, not description) rather than more constant-guessing.
- **Team-sheet screen (`VersusScreen.tsx`) redesigned, then partly reverted**: first pass added a bordered competition badge + ball icon, ringed crests, a bigger "VS", a calendar icon, floodlight glow in the header/pitch corners, and corner arcs/D-arcs on the pitch. Reported directly as not matching the given reference image — the glow read as unwanted "blur" and the arcs as "irregular circles". Pulled the glow and the arcs/D-arcs back out; kept the badge/crest-ring/VS/calendar changes, which more literally matched what was asked for.
- **A real England tab — league-wide news, not a relabel**: replaced the old All/News/Stats/Fans phone tabs (all four filtered the SAME club-only pool) with All/England/Club. `lib/star/media/detect/league.ts` (new) turns every OTHER club's fixture that week into the same win/draw/loss/rout/hammered and hat-trick events `detect/result.ts`/`detect/goals.ts` already produce for your own match, reusing `playLeagueWeek`'s (`season.ts`) already-simulated named scorers — that data existed and simply never reached the media engine before. The existing "club"/"league" archetype templates turned out to already be club-name-generic, so no new templates were needed — only a real bug found and fixed in `select.ts`'s `allegiance()`: every event until now was always about `yourClub`, so keying "is this my club" off `subject.kind` happened to work without ever checking WHICH club; rewritten to key off `facts.club` so a third club's own account can speak for its own result while your fans/club stay out of news that isn't theirs. New `StoredPost.scope` ("club"/"league") drives the tabs; `MediaState.lastLeagueCycleId` is its own independent replay guard so it can never collide with the match/career cycle guard the post-match "moment" screen depends on. `tests/star/leagueMedia.mts` (new). Investigated the ALSO-reported "I never see the chants" complaint first: the mechanic is fully wired and fires correctly — it's tagged only `"goal"`, so under the OLD tabs it only ever showed under All or Fans, easy to miss.
- **Club logos — investigated twice, still not confirmed fixed live.** First pass: `lib/star/clubLogos.ts`'s `normalizeClubKey` only survived cosmetic drift (accents, "&"), not an actual SHORTER name — "Man United" (this game's canonical name) and "Manchester United" normalise to two different strings, so a dataset using either the game's own names or common short forms (Man Utd, Brighton, Spurs, Wolves…) could miss every match. Added `CLUB_LOGO_ALIASES` + `lookupClubLogo()` fallback (tries the club's own key, then any alias pointing at it), wired into `ClubBadge.tsx`; also added real crests to `LeagueScreen.tsx`'s table rows (previously plain text, no badge at all). **Reported directly afterward that logos still don't show** — every badge still falls back to the plain kit-and-initials circle. Root cause not yet found: no live Supabase access this session to actually inspect what's really stored in `club_logos` or whether the anon/browser read is even succeeding. `getClubLogoMap()` was silently discarding any Supabase `error` (destructured `{ data }` only) — now logs it (`console.error`) rather than treating a failed read identically to an empty table, so the NEXT session with a real browser/console can actually tell the two apart. Whoever picks this up next: check the browser console for that log first, then check what's actually in `club_logos` (Table Editor) against the star game's real club names (`lib/star/clubs.ts`'s `PL_CLUBS`/etc.) and its RLS (`supabase/migrations/club_league_logos.sql` says public-read, but that migration's actual run status against the live project was never confirmed this session).
- **TrialPenalty (the career's opening penalty) diverged from CanvasMatch's real in-match penalties** — reported directly, with specifics (harder to score, keeps hitting the post, "the ball just gets stuck on the post"). Found two real, provable bugs, not vibes: `MIN_PULL`/`FULL_POWER_PULL` were stale copies (0.04/0.16 flat) of constants the real match itself moved on from (0.008, and a skill-scaled `dragForFullPower()` topping out at 0.14) — the trial's own comment even still claimed a parity it no longer had. And once ANY outcome fired, the trial simply froze the ball in place for its whole 1.1s settle beat, never calling `settleBall`/`stepBallPastBar` the way CanvasMatch does — so a post-out or an over-the-bar miss visually stopped dead exactly where the outcome was decided instead of being seen rolling/flying away. Both ported into `TrialPenalty.tsx`.
- **Adobe (and every other remote connector) confirmed not usable from THIS session type** — checked properly rather than guessed: `ListConnectors` shows Adobe for Creativity `connected: true`/`enabledInChat: true` at the account level (not an auth/reconnect problem), and every actual tool call fails identically with `SdkHttpError ... CLIENT_HTTP_NOT_IMPLEMENTED` dialing Anthropic's own MCP bridge — and this is NOT Adobe-specific: Supabase, Vercel, PostHog, Sentry and even `Claude_Code_Remote` all fail the exact same way in this session. The local network proxy (`$HTTPS_PROXY/__agentproxy/status`) is healthy with no relay failures, but doesn't even apply — `api.anthropic.com` is explicitly routed around it. This points to a limitation of THIS session type (a remote/cloud "Claude Code on the web" container) rather than anything wrong with the connectors, the project, or the user's account: a locally-run Claude Code (desktop app or CLI, on the user's own machine, as a genuinely NEW session rather than one resuming/pointing at this remote one) is the likely way to get working connectors, though that's an inference from the pattern, not independently verified from inside this sandbox. **Don't waste a future session re-trying these connectors from inside a remote/cloud session** — check the session type first.

**31 August 2026 — Energy rebuilt for real, and a genuinely new injury system.**

Built to the exact three-point brief that had been sitting in this file's Future Work section: a minimum energy to START a match, a minimum energy to be trusted as a SUBSTITUTE, and energy that regenerates only when you deliberately skip the rest of the week — never automatically, which is what made the old version boring enough to remove in the first place. Rebuilt against the real git history of what energy used to touch (`WEEK_RECOVERY`, `REST_ENERGY`, `hookCheck`'s old `"legs"` formula, `hiddenMatch`'s folded-in involvement weight) rather than guessed from scratch.

- **`CareerState.energy`** (0-100): drained on `creditMatchResult` proportional to minutes played, guarded against a replayed fixture double-draining it; reset to 100 at season rollover. Earned back only two ways — Rest (now also tops up energy, not just happiness) and a new **"Skip to Match Day"** action in the Life tab that forfeits the rest of the week's actions for a bigger top-up.
- **Two hard gates in `selectionFor()`** (`lib/star/selection.ts`), applied on top of its existing standing-based verdict: below `MIN_ENERGY_TO_START` a 1st-team standing is capped at Substitute; below `MIN_ENERGY_TO_SUB` even a bench place is withdrawn to Squad. No new substitution UI needed — "coming on as a sub" was already fully represented by `selection.onAt` feeding `CanvasMatch`'s `startMinute` prop.
- **Live in-match fatigue**, transient and separate from the persisted value: `CanvasMatch.tsx`'s new `liveEnergyAt(minute)` eases down over the ninety simulated minutes and feeds a reinstated `tiredSkills()` (power/technique shaved modestly), `hookCheck`'s reinstated `"legs"` `HookReason` (tired-legs substitution risk), and `hiddenMatch.ts`'s involvement formula (effort buys involvement, not better football) — all optional so the star-match-dev fork and any caller that doesn't track it behaves exactly as before.
- **Injuries — new, nothing like it existed before** (`leagueTransfers.ts` used to say so explicitly). `CareerState.injury`, rolled once per match played, risk climbing sharply as end-of-match fatigue drops (rare but real even fully fresh — freak knocks happen). `selectionFor()` returns `"Injured"` unconditionally while carrying one, overriding even a career-best standing; the pre-match screen swaps Play Match for Watch from the stands with a banner naming the injury and weeks remaining. Weeks tick down on every week that passes without playing, clearing at zero and at season rollover. Deliberately scoped to the player character only — no other squad player has any per-player state tracked anywhere in this game beyond goals/assists, so teammate injuries are a separate project.
- UI: an Energy row (Life tab, matching the relationship-bar style) beside the new Skip button; an Energy tile on the dashboard's Status tab and the pre-match screen (mirroring Match Fitness); a fatigue warning and the injury banner on the pre-match screen, reusing the existing "boots need replacing" warning-line pattern.
- Old saves backfilled in `storage.ts` (same place `manager`/`squadNumber`/`squad` already are) so a save from before either field existed opens at full energy with nothing wrong, not a NaN-corrupting `undefined`.
- `tests/star/energy.mts` (new) covers the drain/regen arithmetic and the injury roll's probability curve and duration split; `week.mts`/`selection.mts`/`hiddenMatch.mts` extended for Rest/Skip regen, the `"legs"` hook reason, the two selection gates, the Injured override, and the reintroduced involvement term. One pre-existing test needed its setup adjusted (five full matches back to back with no recovery, which energy now correctly punishes on its own) rather than the assertion weakened.

**30 August 2026 — Full match-feedback pass, real terrace chants, a false-award bug fixed, and energy pulled from the UI pending a real implementation.**

One long working session, several batches.

- Post-match feedback batch (a full itemized list from actually playing a match): scoreboard uses each club's short name when it overflows; the live commentary ticker/hint row and the aim/contact-screen tutorial diagram+text now only show in the trial, not real matches; the contact screen's power readout moved to a vertical side bar; the drag/aim arrow lengthened 20%; a redundant canvas-drawn power meter removed; "The half is over"/"That's the whistle" text removed (the button alone says it); commentary text is white throughout, not gray, and a goal line gets a real green flash instead of a near-invisible tint; the post-match stats screen now uses the same top-aligned frame and scoreboard-plate score display as the rest of the game; the Awards screen's Player of the Month card shows only the winner, not the shortlist.
- Engine bugs fixed: a tackle mid-dribble no longer flashes a stale, unrelated scenario for a moment before cutting to commentary; a ball shot over the bar now keeps flying off-screen instead of stopping dead in mid-air; rebounds off the keeper are now chaseable in the air, not just once they hit the ground (raised the height gates on the poacher poke-in and the loose-ball 50-50).
- **Difficulty investigated and fixed**: the opponent's goals — and your own team's "fell to a teammate" goals — always converted at the same flat rate regardless of team quality; only your own personally-taken shots had any upside beyond it, which is most of why scoring once or twice made a match feel safe to coast. Both flat-rate paths now get an occasional "moment of quality" clinical finish (`convertRate()` in `lib/star/hiddenMatch.ts`).
- **Commentary now tints each line by which team it's about**, using that team's real kit colour and legible ink — a per-line `isOpponent` flag threads from `hiddenMatch.ts` through `matchLog.ts`'s `LogLine` into `MatchCommentary.tsx`.
- **A real, reproducible media bug found and fixed**: a screenshot showed your own club's account posting "BREAKING — Player of the Month, one of our own" the same month the stats account correctly showed someone else winning it. Root cause: the POTM award moment carried no won/lost flag, so the club-congratulation template fired for any shortlist placement, not just an actual win — fixed in `lib/star/media/types.ts`/`detect/career.ts`, with a regression test in `tests/star/media.mts`.
- **Real terrace chants added to the media feed** (`lib/star/media/chants.ts`, user-supplied, growing over several rounds) — club win/result chants (Arsenal's "One-Nil to the Arsenal" specifically at 1-0, Liverpool's win-vs-draw/loss split, etc.) and real-player goal chants (Bellingham, Salah, Havertz's "60 MILLION DOWN THE DRAIN", an eleven-line Sam Smith song, and more). Needed two small additions: exact-match `club`/`score`/`player` gates on `Template` (`templates/index.ts`), and a new `TEAMMATE_GOAL` detector giving a single (not just a 2+) team-mate's goal a named `scorer` fact to match a chant against.
- **Energy pulled from the UI, not the data model — then, later the same day, pulled out entirely.** First pass: training no longer cost or checked it, the dashboard's top energy bar was gone, and the NRG-drinks shop was removed outright (Home page card, buy button, `Shop.tsx`'s whole `"nrg"` tab, `nrgDrinks`/`NRG_DRINKS`) — but `career.energy` itself still existed and still drained/regenerated in the background, and the Life tab's Rest button and relationship minigames still spent it. Told directly to "get rid of all energy for now," the second pass removed it completely: `CareerState.energy` no longer exists as a field at all. Gone with it — `week.ts`'s `rest()`/`startNewWeek()` regen math (Rest still exists, now happiness-only), `dilemmas.ts`'s per-choice energy effects, `selection.ts`'s `MISSED_WEEK.energy` and `hookCheck`'s tired-legs substitution reason (`HookReason` lost `"legs"`), the matchday screen's energy tile/warning, and — the parts that actually did something — `CanvasMatch.tsx`'s `tiredSkills()` (was quietly shaving your power/technique as a match wore on) and `hiddenMatch.ts`'s energy term in the chance-involvement formula (its average weight was folded into the formula's base constant so involvement frequency didn't silently drop). See the "What Needs Improvement" entry above for the real mechanic this is standing in for.

Earlier sessions (19 August missing-images/finishing/cup-draw pass, 7 August
match-engine rebuild, and everything before) moved to `SESSION_LOG.md` to
keep this file readable — see that file for full detail.
