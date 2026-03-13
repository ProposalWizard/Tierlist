# Football Tierlist Website — Project Documentation

> This file exists so context is never lost between sessions.
> Last updated: March 2026

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
│           └── vote-tierlists/...  # CRUD for vote tierlists (admin only)
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
│   └── LabelOverlay.tsx      # Add text label to image
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
│       └── category_settings.sql
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
| `tierlists` | User-created tierlist templates (title, slug, category, cover_image_url, view_count, created_by) |
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
- **Tierlists tab**: View all tierlists, edit title/category/cover, manage images, delete
- **Categories tab**: Add/edit/delete/reorder categories
- **Vote Tierlists tab**: Create/edit vote tierlists, bulk upload images, import from regular tierlists
- **Category Settings**: Set homepage sort method per category (recent/views/likes/manual), pin tierlists

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (server-side only, not in example but required)
NEXT_PUBLIC_APP_URL=http://localhost:3000
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
- [x] Persistent global nav bar
- [x] Legal page (Privacy Policy & Terms of Use)
- [x] Site footer

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
- [ ] **Image deletion from Storage** — When tierlists are deleted, orphaned images remain in Supabase Storage
- [ ] **Rate limiting** — No rate limiting on API routes currently
- [ ] **Error boundaries** — No React error boundaries
- [ ] **Loading states** — Some pages could use skeleton loaders
- [ ] **Tierlist editing** — Can only create new, cannot edit existing tierlists after publishing
- [ ] **Sort/filter on homepage** — Users can only browse by category, no sort controls
- [ ] **PWA support** — Could be installable as a mobile app

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

- Hosted on **Netlify** with `@netlify/plugin-nextjs`
- Auto-deploys from the git repository
- Supabase project provides the database + auth + storage backend
