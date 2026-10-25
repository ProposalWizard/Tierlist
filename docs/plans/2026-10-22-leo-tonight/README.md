# Leo's tonight build (22 Oct 2026) — 7 chats

Plan Leo approved ("all your picks go"): `plan.html` here, also https://claude.ai/artifact/RERQk9D5BLaDv14ebha8qf
Every amber call took the recommended answer:
1a every goal, skippable · 1b hand-make the knee slide · 1c shop prices like other accessories ·
2a speed only (no new look) · 3a either side, above head and across you · 3b more often with Aerial (about 1 in 4 at 40, always at 80+) ·
4a weather + pitch on a TEST PAGE first, not the real game · 5a 85'+ level or one down · 7a write ~60 bangers ourselves ·
8a daily goal streak on the phone only, no leaderboard · 10a your 3 v 2 other players' goals · 13a a smaller hall, same system ·
14a injuries: a written plan for Mikey, no code · 15a match-engine bugs → team jobs only; small clear fixes elsewhere OK.

## Rules for every chat (read all)
- **Branch:** your own branch only (given in your prompt). Never push to `Leo`, `main`, `Harry` or `Mikey`. Never merge to main. The hub chat joins the branches.
- **Your files only.** Stay inside your lane (your prompt lists it). If you must touch a shared file (`app/star-dev/page.tsx`, `lib/star/types.ts`, `components/star/CanvasMatch.tsx`, `lib/adminGuides.ts`, `lib/adminRegistry.ts`), keep the edit small and additive (new fields, new phase, new block), never a refactor. Merge `origin/Leo` into your branch before your final push.
- **Progress bars to the team board** (Leo reads them on the admin): every ~15 minutes and at every stage change, write bars in the progress-update shape to a file whose FIRST line is `UPDATE · HH:MM · <your chat name>` and run `DEV_NAME=Leo node scripts/post-status.mjs --file <file>`. Also put the same bars in your chat.
- **Brain first:** grep `brain/_index.md` for your nouns. Load skills that apply: `one-engine` (anything that plays football), `3d-building` (any 3D/animation), `admin-page-guide` (any admin/dev page), `ui-house-style` (any screen).
- **Match changes:** the engine-warn hook asks on the match file; say so plainly in your report. Run `node scripts/run-star-tests.mjs finishing keeper aiming outcomes` (plus your own suites) before your final push. Never touch KNOWN_COPIES / CEILING / the canary.
- **See it:** a type-check is not enough. Use the `star-playtest` agent (or scripts/star-sandbox) and take phone-size stills (390×844). Save stills as you go to `docs/handoffs/2026-10-22-leo-tonight/<your-chat>/` (small JPEGs).
- **Spend well:** use helper agents in parallel where work splits (top model for building and hard logic, the everyday model for checks and playtests). Leo has a big budget tonight; use it on quality, not re-takes.
- **Checks before your final push:** `npx tsc --noEmit`, your tests, `node scripts/one-engine-guard.mjs`, and `npm run build` (set NEXT_PUBLIC_SUPABASE_URL=https://cagkgfketucousksgtbk.supabase.co and NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy if no .env.local).
- **Finish by 23:15 UK time.** Push what is done and checked; leave unfinished work out or behind a test page. Write `docs/handoffs/2026-10-22-leo-tonight/<your-chat>/REPORT.md`: what was built, numbers before→after, what was seen in a browser, what was not, known issues, files touched. Push it. Do NOT write patch notes; the hub writes them.
- Plain English in every message to Leo (short sentences, no coder words).
