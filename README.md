# ⚽ Football Tierlist App

A Next.js 14 app that lets authenticated users drag & drop football players into S/A/B/C/D tiers and save their rankings to Supabase.

---

## Tech Stack

| Layer       | Technology                              |
|-------------|------------------------------------------|
| Framework   | Next.js 14 (App Router, TypeScript)      |
| Auth & DB   | Supabase (Auth + PostgreSQL)             |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable        |
| Styling     | Tailwind CSS v3                          |

All dependencies are open-source.

---

## Local Setup

### 1. Clone / copy the project

```bash
git clone <your-repo>
cd tierlist-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the Supabase Dashboard → **SQL Editor**, paste and run the contents of [`supabase/schema.sql`](./supabase/schema.sql).
   This creates the three tables, seeds the default topic + 12 players, and sets up Row Level Security.

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your values from **Supabase Dashboard → Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Configure the Supabase Auth redirect URL

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

For production, add your live domain instead.

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) – you'll be redirected to `/auth` to sign up or log in.

---

## Project Structure

```
tierlist-app/
├── app/
│   ├── layout.tsx                  # Root layout + global CSS
│   ├── page.tsx                    # Redirects to /auth or /tierlist
│   ├── globals.css                 # Tailwind directives
│   ├── auth/
│   │   ├── page.tsx                # Login / sign-up page (Server Component)
│   │   └── callback/route.ts       # Supabase OAuth/magic-link callback
│   ├── tierlist/
│   │   └── [topic]/page.tsx        # Tierlist page (Server Component, fetches data)
│   └── api/
│       ├── auth/signout/route.ts   # POST → sign out
│       └── tierlist/
│           ├── save/route.ts       # POST → save rankings
│           └── [topic]/route.ts    # GET → fetch topic + players + rankings
├── components/
│   ├── AuthForm.tsx                # Sign-in / sign-up form (Client Component)
│   ├── TierlistBoard.tsx           # Main DnD board (Client Component)
│   ├── TierRow.tsx                 # One S/A/B/C/D row (droppable)
│   └── PlayerCard.tsx              # Draggable player card
├── lib/
│   ├── types.ts                    # Shared TypeScript types & constants
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       ├── server.ts               # Server Supabase client (RSC / API routes)
│       └── middleware.ts           # Session-refresh helper for middleware
├── middleware.ts                   # Next.js middleware (auth guard + session refresh)
├── supabase/schema.sql             # Full DB schema + seed data
└── .env.local.example              # Environment variable template
```

---

## How the Components Communicate

```
Browser                          Server
───────                          ──────
/auth page (Server Component)
  └─ renders <AuthForm /> ──────────────── Client Component
       │ supabase.auth.signInWithPassword()
       │ (direct browser → Supabase)
       └─ router.refresh() ──────────────► triggers Server Component re-render
                                           → redirects to /tierlist/[topic]

/tierlist/[topic] (Server Component)
  ├─ createClient() (server) ──────────── reads session from cookie
  ├─ fetches topic, players, rankings from Supabase
  └─ renders <TierlistBoard /> ─────────── Client Component
       │  Local state: tierMap (player positions)
       │  DnD events update tierMap in real-time
       │
       └─ "Save Rankings" button
            fetch POST /api/tierlist/save
              │
              └─ Route Handler (Server)
                   ├─ validates auth + payload
                   ├─ DELETE old rankings
                   └─ INSERT new rankings
```

### Key design decisions

| Decision | Reason |
|----------|--------|
| Server Components for data fetching | Zero client-side loading state; SEO-friendly |
| Client Component for drag & drop | DnD requires browser events (pointer, touch) |
| Delete-then-insert save strategy | Simpler than row-level upserts when tier assignments change |
| `UNIQUE (user_id, topic_id, player_id)` DB constraint | Server-side guarantee a player can't be in two tiers |
| `@dnd-kit` instead of `react-beautiful-dnd` | Active maintenance, accessible, supports touch |
| `@supabase/ssr` instead of legacy auth-helpers | Official, cookie-based, works with Next.js App Router |

---

## Database Schema (summary)

```sql
tierlist_topics   (id, slug, title, description, created_at)
tierlist_players  (id, topic_id → topics, name, position, club, image_url, created_at)
tierlist_rankings (id, user_id → auth.users, topic_id → topics, player_id → players,
                   tier CHECK IN ('S','A','B','C','D'),
                   UNIQUE(user_id, topic_id, player_id))
```

Row Level Security ensures each user can only read and write **their own** rankings.
Topics and players are publicly readable.

---

## Adding a New Topic

1. Insert a row into `tierlist_topics` with a unique `slug`.
2. Insert up to 12 players into `tierlist_players` referencing that `topic_id`.
3. Navigate to `/tierlist/<your-slug>`.

---

## Production Deployment (Vercel)

```bash
npm run build   # verify the build passes locally first
```

1. Push to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. Add the same env vars from `.env.local` in Vercel's project settings.
4. Update Supabase **Redirect URLs** to include your `https://` production domain.
5. Deploy.
