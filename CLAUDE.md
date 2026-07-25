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

---

## Recent Session

25 July 2026 — Squad feature added to star career game: named 20-player squads generated per club (`lib/star/squadData.ts`), goal events tracked per match with named scorer/assister, squad stats (season + career G/A) persisted on `CareerState.squad`, League screen has a third "Squad" tab. `SquadPlayer` and `GoalEvent` interfaces added to `types.ts`. TypeScript clean.

See `SESSION_LOG.md` for full history.
