# Football Tierlist Website — Project Documentation

> This file exists so context is never lost between sessions.
> Last updated: 30 June 2026
> This file is loaded as context on every Claude Code prompt — keep it to
> current architecture/state only. Detailed session-by-session history lives
> in `SESSION_LOG.md` (read on demand, not auto-loaded). Append new session
> summaries there, not here.

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
| `draft_records_full_fix.sql` | **PENDING (likely cause of Career Records bug)** | Consolidated fix for `draft_records`/`draft_personal_records` CHECK constraints. The older `draft_records_expanded.sql`/`draft_records_mode.sql`/`draft_records_fix_constraints.sql` migrations were apparently never fully run — their CHECK constraints reject `competition = 'career'` and several `record_type` values (`career_assists`, `career_avg_rating`, `most_points`, `biggest_win`, `avg_rating`), so every Career Records insert silently fails (caught and only `console.error`'d server-side, invisible to users). Run `draft_records_full_fix.sql` in Supabase SQL Editor — it's idempotent and safe to run regardless of which older migrations already applied. |

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

Full session-by-session history moved to `SESSION_LOG.md` (not auto-loaded as context — read it only when you need historical detail). Latest session: 30 June 2026 — added a Starting XI rating display, out-of-position adjusted rating display, and a 0.5x/1x/1.5x simulation speed selector (solo + host-synced multiplayer) to the PL Draft game. See `SESSION_LOG.md` for full detail on this and all prior sessions.

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
