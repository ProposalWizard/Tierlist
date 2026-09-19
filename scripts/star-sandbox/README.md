# Star sandbox — playing Road to Ballon d'Or headlessly

Lets an agent (or you) actually **run and see** `/star-dev` without signing in,
so a gameplay or rendering change can be verified in the real app instead of
only by `tsc` and the unit suite.

This exists because CLAUDE.md / SESSION_LOG.md are full of entries conceding
"none of this has been seen live" — and several real bugs (keeper frozen
mid-dive, the face outline tracing a rectangle, Touch Mode catching instantly)
survived multiple rounds of type-clean, test-green work because of it.

## One-time setup

```bash
npm install
npx playwright install chromium        # skip if PLAYWRIGHT_BROWSERS_PATH is preset
cp .env.local.example .env.local       # then fill in the two NEXT_PUBLIC_ values
```

`.env.local` needs only:

```
NEXT_PUBLIC_SUPABASE_URL=https://cagkgfketucousksgtbk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key>
```

The **anon key is not a secret** — it is `NEXT_PUBLIC_`-prefixed and already
shipped in the browser bundle of every page on the live site. It is enough for
real player data because every table the career game reads is public-read by
RLS policy (`sofifa_players`, `club_logos`, `league_logos`, `star_lineups`).

`SUPABASE_SERVICE_ROLE_KEY` is **not** required and should not be put here
unless you need admin writes. Without it, `lib/supabase/publicRead.ts` falls
back to the anon key for the read-only data routes.

Without any Supabase values at all the game still runs, but every club shows
"NO SQUAD YET" and falls back to `generateSquad`'s invented roster — fine for
physics and layout work, useless for anything involving real players.

## Run it

```bash
npm run dev &                                   # http://localhost:3000
node scripts/star-sandbox/drive.mjs --help
```

Examples:

```bash
# start a fresh career at Arsenal, screenshot each step
node scripts/star-sandbox/drive.mjs --club Arsenal --shots /tmp/shots

# resume, dump the live CareerState, screenshot the dashboard
node scripts/star-sandbox/drive.mjs --resume --dump-state --shot /tmp/dash.png
```

The driver always reports **console errors and uncaught page errors**, which is
the single thing the unit suite cannot see and where this class of bug lives.

## Why signed-out play works

`lib/star/devMode.ts` re-enables the local-only `ANON_SCOPE` career that
`storage.ts` has always supported. It is gated on `NODE_ENV === "development"`,
which a production build inlines to `false`, so it cannot reach the deployed
site. Careers started this way are localStorage-only and never sync to a cloud
account — correct, since there is no account.
