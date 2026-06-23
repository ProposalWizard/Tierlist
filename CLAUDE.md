# Football Tierlist Website — Project Documentation

> This file exists so context is never lost between sessions.
> Last updated: 23 June 2026

---

## What This Project Is

A web app where users create, play, and share **football tierlists**. Users drag-and-drop player/club images into S/A/B/C/D tiers, download the result as an image, and share it on X (Twitter). There is also a **vote tierlist** mode where the community votes on where each player belongs and sees aggregate results.

This tierlist tool is planned to become part of a **larger football games platform** featuring:
- Tierlists (done)
- Combined XI builder (future)
- Blind rankings (future)
- Match predictions (future)
- Player ratings (future)
- Voting tierlists (done)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 14.2.5** (App Router, TypeScript) |
| Styling | **Tailwind CSS 3.4** |
| Drag & Drop | **@dnd-kit/core + @dnd-kit/sortable** |
| Screenshot/Export | **html2canvas** |
| Auth | **Supabase Auth** (Google OAuth) |
| Database | **Supabase PostgreSQL** |
| Storage | **Supabase Storage** (bucket: `tierlist-images`, public) |
| Hosting | **Netlify** (`@netlify/plugin-nextjs`) |
| Image Processing | Client-side compression to WebP (1200px max, 75% quality) |

---

## Project Structure

```
/
├── app/
│   ├── page.tsx              # Homepage — category rows of tierlists + vote tierlists
│   ├── layout.tsx            # Root layout — GlobalNav + SiteFooter
│   ├── globals.css           # Tailwind imports + global styles
│   ├── not-found.tsx         # 404 page
│   ├── auth/
│   │   ├── page.tsx          # Login page (Google OAuth button)
│   │   └── callback/route.ts # OAuth callback handler
│   ├── create/
│   │   └── page.tsx          # Create new tierlist (auth required)
│   ├── play/[id]/
│   │   └── page.tsx          # Play a tierlist — drag & drop board
│   ├── vote/[id]/
│   │   └── page.tsx          # Vote tierlist — community polling
│   ├── find/
│   │   └── page.tsx          # Search/filter all tierlists
│   ├── profile/
│   │   ├── page.tsx          # User profile (server component)
│   │   └── ProfileClient.tsx # Profile UI (username, streaks, created/liked/saved)
│   ├── admin/
│   │   └── page.tsx          # Admin panel (manage tierlists, categories, vote tierlists)
│   ├── legal/
│   │   └── page.tsx          # Privacy Policy & Terms of Use
│   └── api/
│       ├── tierlists/
│       │   ├── route.ts            # POST: create tierlist
│       │   └── [id]/
│       │       ├── route.ts        # GET/DELETE tierlist
│       │       ├── like/route.ts   # POST/DELETE: toggle like
│       │       └── save/route.ts   # POST/DELETE: toggle save/bookmark
│       ├── tierlist/
│       │   ├── [topic]/route.ts    # GET: topic page data (legacy)
│       │   └── save/route.ts       # POST: save rankings (legacy)
│       ├── vote-tierlists/
│       │   ├── route.ts            # GET: list vote tierlists
│       │   └── [id]/
│       │       ├── vote/route.ts   # POST: cast/change vote
│       │       ├── my-votes/route.ts # GET: user's votes (anon support)
│       │       └── like/route.ts   # POST/DELETE: toggle vote tierlist like
│       ├── categories/route.ts     # GET: list categories
│       ├── profile/route.ts        # GET/PUT: user profile
│       ├── auth/signout/route.ts   # POST: sign out
│       └── admin/
│           ├── tierlists/...       # CRUD for tierlists (admin only)
│           ├── categories/...      # CRUD for categories (admin only)
│           ├── category-settings/route.ts  # Homepage sort settings
│           ├── vote-tierlists/...  # CRUD for vote tierlists (admin only)
│           └── export/route.ts     # GET: full JSON backup of all data
├── components/
│   ├── TierlistBoard.tsx     # Main drag-and-drop board (play + create modes)
│   ├── TierRow.tsx           # Single tier row (label, color, settings, players)
│   ├── PlayerCard.tsx        # Draggable player/image card
│   ├── CreateTierlistForm.tsx # Form for creating a new tierlist
│   ├── UploadTierlistModal.tsx # Modal for uploading/saving a tierlist
│   ├── VoteBoard.tsx         # Vote tierlist interactive UI
│   ├── LikeButton.tsx        # Heart like button (works for both tierlist types)
│   ├── SaveTierlistButton.tsx # Bookmark/save button
│   ├── AdminPanel.tsx        # Admin dashboard component
│   ├── GlobalNav.tsx         # Persistent top nav bar
│   ├── SiteFooter.tsx        # Footer with legal link
│   ├── FindSearch.tsx        # Search/filter component for Find page
│   ├── NavMenu.tsx           # Navigation menu
│   ├── AuthForm.tsx          # Auth form component
│   ├── ZoomOverlay.tsx       # Full-screen image zoom
│   ├── CropOverlay.tsx       # Image crop editor
│   ├── LabelOverlay.tsx      # Add text label to image
│   ├── PlayCommunityVote.tsx # Community vote results shown on play page
│   └── ImageWithFallback.tsx # Image component with fallback handling
├── lib/
│   ├── types.ts              # All TypeScript interfaces + constants
│   ├── admin.ts              # Admin role check helper
│   ├── imageUtils.ts         # Image compression (WebP, 1200px max)
│   └── supabase/
│       ├── client.ts         # Browser Supabase client
│       ├── server.ts         # Server-side Supabase client (cookies)
│       ├── service.ts        # Service-role Supabase client (bypasses RLS)
│       └── middleware.ts     # Session refresh logic
├── supabase/
│   ├── schema.sql            # Main DB schema (topics, players, rankings, tierlists, images, user_roles)
│   ├── schema-additions.sql  # User profiles, categories, likes, saves, view counts, streaks
│   ├── vote-schema.sql       # Vote tierlists schema (vote_tierlists, vote_tierlist_images, votes)
│   └── migrations/
│       ├── 002_more_topics.sql
│       ├── vote_tierlist_likes.sql
│       ├── category_settings.sql
│       ├── linked_tierlists.sql
│       ├── additional_categories.sql
│       ├── saved_profile_images.sql
│       ├── feedback.sql
│       ├── image_cleanup.sql
│       └── tierlist_tiers.sql        # Adds tiers JSONB column to tierlists table (PENDING — not yet run)
├── middleware.ts             # Next.js middleware — session refresh + route protection
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── .env.local.example        # Required env vars
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `tierlists` | User-created tierlist templates (title, slug, category, cover_image_url, view_count, created_by, linked_vote_tierlist_id, additional_categories, tiers JSONB*) |
| `tierlist_images` | Images belonging to a tierlist (name, image_url, sort_order) |
| `tierlist_topics` | Legacy: predefined ranking topics (e.g. "Premier League 2024/25") |
| `tierlist_players` | Legacy: players belonging to a topic |
| `tierlist_rankings` | Legacy: user rankings (user_id, topic_id, player_id, tier) |

### Social Tables

| Table | Purpose |
|-------|---------|
| `tierlist_likes` | One like per user per tierlist (user_id, tierlist_id) |
| `saved_tierlists` | Bookmarks (user_id, tierlist_id) |
| `user_profiles` | Username, is_anonymous, login streak tracking |
| `user_roles` | Admin flag (user_id, is_admin) |
| `categories` | Editable category list with sort_order |
| `category_homepage_settings` | Per-category homepage sort method (recent/views/likes/manual) + pinned IDs |

### Vote Tierlist Tables

| Table | Purpose |
|-------|---------|
| `vote_tierlists` | Vote tierlist templates (title, category, tiers as JSONB, is_active) |
| `vote_tierlist_images` | Images/items to vote on |
| `vote_tierlist_votes` | One vote per voter per image (supports both auth users and anonymous via localStorage UUID) |
| `vote_tierlist_likes` | Likes for vote tierlists |

### Row Level Security (RLS)

- **All tables have RLS enabled**
- Topics, players, tierlists, images, categories: **publicly readable**
- Rankings, likes, saves: **users can only manage their own**
- Admin operations use the **service-role key** server-side (bypasses RLS)
- Vote tierlist votes: **public insert/update** (anonymous voting supported)

---

## How Image Uploads Work

1. User selects images via file input (`+ Add Images` button)
2. Each image is **compressed client-side** (`lib/imageUtils.ts`):
   - Resized so longest side is max 1200px
   - Converted to **WebP** at 75% quality
3. Images are uploaded to **Supabase Storage** bucket `tierlist-images` (public bucket)
4. Each file gets a `crypto.randomUUID()` filename to avoid collisions
5. The public URL is retrieved via `supabase.storage.getPublicUrl()`
6. URLs are stored in the `tierlist_images` table

### Image Tools on the Board

- **Style selector**: Square / Landscape / Portrait / Circle / No Crop
- **Zoom mode**: Click to view full-size overlay
- **Crop mode**: Click to open crop editor, saves cropped version
- **Label mode**: Click to add text overlay on the card
- **Remove mode**: Select multiple images, then delete them

---

## How Tierlists Are Created & Stored

### Create Flow (from `/create`)
1. User must be authenticated (middleware redirects to `/auth`)
2. User adds images to the blank `TierlistBoard` (mode="create")
3. User can customize tiers (add/delete rows, change labels/colors)
4. User clicks "Upload Tierlist" which opens `UploadTierlistModal`
5. Modal prompts for: title, category, cover photo
6. Images are uploaded to Supabase Storage
7. `POST /api/tierlists` creates the `tierlists` row + `tierlist_images` rows
8. Slug is auto-generated from title (lowercase, hyphenated, with random suffix)
9. Redirects to homepage

### Play Flow (from `/play/[id]`)
1. Tierlist data + images loaded server-side
2. View count incremented via `increment_view_count` RPC
3. Images start in the "Unranked" pool
4. User drags images into tier rows (S/A/B/C/D or custom)
5. Users can add more images, crop, label, zoom, remove
6. "Download" button: uses html2canvas to screenshot the tier rows
7. "Share on X" button: downloads the image + opens Twitter intent URL
8. "Save as New Tierlist": opens upload modal to save a modified copy

### Tier Rows
- Default 5 rows: S (green), A (light green), B (yellow), C (orange), D (red)
- Users can add rows above/below, delete rows, clear rows
- Each row has editable label and color
- Minimum 1 row enforced

---

## How Sharing Works

### Download as Image
- Uses `html2canvas` to render the tier rows div (`tiersRef`) as a canvas
- Scale: 2x for high resolution
- Background: `#111827` (gray-900)
- Saves as `tierlist.png`

### Share on X (Twitter)
- Downloads the tierlist image (same as above)
- Opens `twitter.com/intent/tweet` in a new tab with the page URL
- User attaches the downloaded image manually to the tweet

### Likes & Saves
- **Like button**: Toggles a heart icon, sends POST/DELETE to `/api/tierlists/[id]/like`
- **Save button**: Bookmarks the tierlist, appears on profile page
- Both require authentication

---

## How Voting Works

### Vote Tierlists (Community Polls)
1. Admin creates vote tierlists via admin panel
2. Each has customizable tier labels/colors (stored as JSONB)
3. Users (logged in or anonymous) tap an image to select it
4. Vote panel shows aggregate vote percentages per tier
5. User picks a tier to cast their vote
6. Auto-advances to the next unvoted image
7. **Optimistic UI**: vote updates instantly, reconciles with server
8. **Anonymous voting**: uses `localStorage` UUID as voter identity
9. Desktop: side panel with stats + vote buttons
10. Mobile: fixed bottom bar with compact vote buttons

---

## PL Draft Game (`/draft`)

A Premier League draft game inspired by 38-0/82-0.com. Player picks a formation, spins for a random PL club + FIFA edition (07–26), picks one player from that club's FIFA roster for the current slot, repeats until an XI is built, then a 38-match season is simulated.

### Files
- `app/draft/page.tsx` — phase state machine (setup → draft → result) + localStorage progress persistence (key `pl-draft-progress`, Resume/Discard banner on setup)
- `app/draft/layout.tsx` — metadata
- `components/draft/DraftSetup.tsx` — formation picker (7 formations), era range selector
- `components/draft/DraftPick.tsx` — slot-machine spin animation, roster picker (compatible positions sorted first, position-relevant key stats shown), re-spin, back button
- `components/draft/DraftResult.tsx` — season results: league table, form guide, match results, awards, squad stats, share-as-image (html2canvas + Twitter intent)
- `components/draft/formations.ts` — formation definitions with slot coordinates + compatible positions
- `lib/seasonSimulator.ts` — deterministic season sim (seeded mulberry32 PRNG, Poisson goals)

### Season simulation (attribute-based)
- Team strength = separate **attack/midfield/defense/GK phase ratings** computed from FIFA attributes (`attrs` on `DraftPlayer`), not a flat OVR average
- Goal scorers weighted by finishing/positioning/shooting; assists by vision/crossing/passing
- **Position fitness**: natural position 100%, same role 92%, adjacent role 78%, else 60%
- Defenders + GK earn clean sheets; per-match player ratings (4.0–10.0) → season average
- Falls back to OVR-only when attributes are missing (e.g. data not yet imported)

### Data pipeline (SoFIFA)
- `sofifa_players` table — all FIFA editions 07–26, one row per player per edition, detailed stats in `attributes` JSONB (keys like `attr_sho`, `attr_pac`, `attr_fi`...)
- SoFIFA blocks server-side scraping (Cloudflare). Scraping is done locally via `scripts/scrape_missing.py` (Playwright, visible browser, manual captcha solve, Next-button pagination within an edition). Output JSON files are imported at `/admin/football/scrape` (admin page → `POST /api/admin/football/import-sofifa`)
- `GET /api/draft/clubs` — distinct PL club/season pairs. Tries `get_pl_club_seasons()` RPC, falls back to paginated query. League match is **anchored** (`Premier League%`, `English Premier League%`, `Barclays Premier League%`) to avoid matching Scottish/Russian Premier Leagues
- `GET /api/draft/roster?club=X&year=Y` — club roster with 22 attributes extracted from JSONB

### Data status (June 2026)
- Scraped to JSON (user's machine, `OneDrive\Desktop\sofifa_data\`): FC 26, FC 25, FC 24, FIFA 23, FIFA 22
- Still scraping: FIFA 21 down to FIFA 07
- DB: FC 26 partially imported (~12.6k of 26.8k — re-import needed after import-route fix)

---

## Authentication

- **Google OAuth** via Supabase Auth
- Auth callback at `/auth/callback/route.ts`
- Session managed via cookies (refreshed in middleware)
- Protected routes: `/tierlist/*`, `/create` (redirect to `/auth?next=...`)
- User profiles created on first login

---

## Admin Panel (`/admin`)

Accessible to users with `is_admin = true` in `user_roles` table.

### Features
- **Tierlists tab**: View all tierlists, edit title/category/cover/tiers, manage images (drag-and-drop reorder), delete
- **Categories tab**: Add/edit/delete/reorder categories
- **Vote Tierlists tab**: Create/edit vote tierlists, edit tiers (always visible when expanded), bulk upload images, import from regular tierlists, drag-and-drop image reorder
- **Category Settings**: Set homepage sort method per category (recent/views/likes/manual), pin tierlists
- **Export Backup**: Downloads a JSON file with all tierlists, vote tierlists, images, and categories

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (server-side only, not in example but required)
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

### Session: 23 June 2026 — Database storage cleanup (1.02 GB → ~0.37 GB)

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

### Session: ~June 2026

1. **PL Draft game built** — Full game at `/draft` (see "PL Draft Game" section above). Linked from `GameSidebar`.
2. **SoFIFA scraping pipeline** — `scripts/scrape_missing.py` for local Playwright scraping of FIFA 07–21; import via `/admin/football/scrape`. Scraper detection now counts player links (≥10) instead of relying on a `table.table` selector that no longer matches.
3. **Attribute-based simulation** — `lib/seasonSimulator.ts` rewritten to use real FIFA attributes for phase ratings, scorer/assister weighting, position fitness, and per-match player ratings. Roster API extracts 22 attributes from JSONB.
4. **Draft progress persistence** — picks save to localStorage after each pick; Resume/Discard banner on setup screen.
5. **Error boundaries added** — `app/error.tsx`, `app/global-error.tsx`.
6. **PL league filter fix** — clubs API patterns anchored so Scottish/Russian "Premier League" clubs are excluded (would have appeared once FIFA 07–13 data imported). New optional `draft_club_seasons.sql` migration adds a fast RPC.
7. **Import route hardening** — row-by-row fallback when chunk upserts fail; FC 26 needs re-import (earlier bug saved only ~half).

### Session: 25 March 2026

1. **Admin image reordering** — Replaced arrow buttons (← →) with `@dnd-kit` drag-and-drop for both regular and vote tierlist image grids in admin. Crop button (✂) kept. Uses `PointerSensor` with 5px activation distance so clicks still work.

2. **Tier editing in admin** — Added tier editing UI (labels, colors, add/remove rows) to regular tierlist admin edit form (saved via "Save Changes" button). Vote tierlist tier editing is now always visible when expanded (removed the "Edit tiers" toggle — tiers auto-load on expand).

3. **Custom tiers for regular tierlists** — Added `tiers` JSONB column migration (`tierlist_tiers.sql`), updated admin PATCH API to accept `tiers`, added `initialTiers` prop to `TierlistBoard`, play page passes saved tiers. Falls back to default S/A/B/C/D if column doesn't exist.

4. **Admin tierlists disappearing bug** — Adding `tiers` to the admin page `select()` query broke the page because the column didn't exist yet. Fixed by removing it from the query and fetching tiers lazily in `openEdit()`.

5. **Export backup** — New `GET /api/admin/export` endpoint returns a JSON file with all tierlists (with images grouped inline), vote tierlists (with images), and categories. "Export Backup" button added to admin panel tab bar.

### Session: ~11 April 2026

1. **Face detection** — Added `face-api.js` (TinyFaceDetector) for client-side face detection. New `lib/faceDetection.ts` with `processImage()` (for uploads) and `detectFaceFromUrl()` (for existing images). Returns `FaceCenter { x, y }` as percentages. Results cached in localStorage. Positions bias upward by 50% of face-box height to keep the full head visible in cover-crop thumbnails.

2. **Face detection toggle** — Added `face_detection_enabled` column to both `tierlists` and `vote_tierlists` tables. Admin panel shows on/off toggle per tierlist. When toggled on, face detection runs on image upload (regular tierlists) or on save (vote tierlists).

3. **face-api.js webpack fallbacks** — Added `fs: false` and `encoding: false` webpack fallbacks in `next.config.mjs` because face-api.js imports node-only modules that aren't needed client-side.

4. **`tierlist_tiers.sql` migration applied** — User ran the migration in Supabase SQL Editor. Custom tiers now persist for regular tierlists.

### Session: 16 April 2026

1. **Vote panel image sizing fix** — `components/VoteBoard.tsx`: Changed the selected-player thumbnail in the vote side-panel from a max-height container with `object-cover` (which cropped landscape images badly) to an `aspect-square` container matching the thumbnail grid below. Now shows the same framing, just bigger.

2. **Admin vote tierlist batch save** — Major refactor of `components/AdminPanel.tsx`. The vote tierlist editor now uses a `VoteEditState` pattern where ALL changes (cover photo upload/pick/crop, tier labels/colors/add/remove, image add/crop/delete/reorder, face-detection toggle, category, import-from-tierlist) stage to local React state. Nothing persists to the DB until the user clicks "Save Changes". Unsaved changes show a yellow indicator. Closing with unsaved changes prompts a confirmation dialog. The comprehensive `handleSaveVoteEdit()` function handles: cover upload, image deletions, new image uploads (with face detection), staged crops, imports, scalar field PATCH, reorder, and auto face detection when newly toggled on.

3. **Face detection "Run detection" button removed** — The separate "Run detection on all images" button next to the face detection toggle was removed. Now, toggling face detection ON and clicking Save automatically runs detection on every image that doesn't have a `face_center` yet.

4. **Crop handlers updated for batch save** — `handleAdminCropResult` and `handleAdminCoverCropResult` now stage crops in `voteEditState` (as `pendingCropDataUrl` / `customCoverCropDataUrl`) instead of uploading immediately. Only uploaded when Save is clicked. Regular tierlist crop handlers remain unchanged (legacy immediate-upload flow).

5. **Rebranding** — All user-facing "Tierlist Maker" text changed to "Knowitball Tierlists" (homepage hero, nav, footer, 404 page, browser tab title, Open Graph + Twitter meta tags). Contact email on legal page changed to `knowitballcontact@gmail.com`.

6. **Custom domain** — `knowitball.co.uk` connected via Hostinger DNS → Vercel. Supabase Site URL and redirect URLs updated for the new domain.

---

## Commands

```bash
npm run dev    # Start development server
npm run build  # Production build (Netlify)
npm run start  # Start production server
npm run lint   # Run ESLint
```

---

## Deployment

- Hosted on **Vercel** (migrated from Netlify)
- Auto-deploys from the GitHub repository on merge to main
- Custom domain: **knowitball.co.uk** (DNS at Hostinger → Vercel)
- Supabase project provides the database + auth + storage backend
- **Supabase project URL**: `https://cagkgfketucousksgtbk.supabase.co`
- **Database size**: ~0.37 GB as of 23 June 2026 (was 1.02 GB — see the 23 June session notes for the cleanup that got it under the 500 MB free-tier limit). ~120 MB headroom remaining.

### Branding

- Site name: **Knowitball Tierlists** (part of future "KnowItBall" platform)
- Contact email: **knowitballcontact@gmail.com**
- Domain: **knowitball.co.uk**
- Registrar: **Hostinger**
