# One Knowitball — the whole-site plan (Leo, 24 Nov 2026)

Leo: "the home screen, that's perfect. Across all pages we want a consistent
theme, look, header/footer … keep the other old games up to date … Draft can
be made a LOT better." Plan only: nothing on the site changes until Leo says
go. Pictures: patch notes 0.143.

## What is there today (seen on the live site, 24 Nov, 22 pages, phone + computer)

| | Home, All games, paused pages | Every other page |
|---|---|---|
| Background | cream `#f4efe2` | dark navy `#030712` |
| Top bar | green `#0a6a34`, no game links | near-black, game strip (Draft · Tic Tac Toe · Ten-A-Ball · Road to the Golden Ball) |
| Buttons | green `#0a7a3d`, cream "Sign in" | purple/indigo, violet tabs |
| Footer | green | near-black |

The home's look is NOT the site's look: it is a set of overrides that switch on
only when the home is on screen (`components/home/home.css`, `body:has(.kh-d)`).
So the plan is mostly: make those values the site default, then tidy each page.

### Faults found on the way (each one seen)
1. **Two menu buttons** in the top bar on phones (☰ left for games, ☰ right for account).
2. **Sign-in page says "⚽ Football Tierlist"** (the old name) and is purple.
3. **Page titles say Knowitball twice** ("PL Draft — Build Your Dream XI | Knowitball | Knowitball"; Tic Tac Toe and Ten-A-Ball the same). /objectives has no title.
4. **Home on a computer:** the orange "Objectives NEW" badge sits over Sign in.
5. **Game strip cut off on phones** ("Road to the Golden Ba…").
6. **Ten-A-Ball** says "A new challenge every day!" but is a fixed list of 30-odd challenges, with **"Danish Players to Play in the Premier League" listed twice**. The menu calls it "ten questions, ten lives"; the game gives **3 lives**.
7. **Draft: every player is a grey silhouette** (SoFIFA stopped serving faces in Aug; only the career game's roster was re-hosted).
8. **Draft: the Premier League club reel shows "RC Strasbourg Alsace 2023/24"** (a French club) — to check: the reel, or the pool too.
9. **Draft lets a keeper play up front** with no word (my test put Al-Habsi at ST).
10. **/legend** is a 404; **/tierlists, /rankings, /vote, /create, /find** all say "isn't running right now".

## Part 1 — One frame on every page (about 1 day)

```
┌───────────────────────────────────┐
│ KNOWITBALL          [Sign in] [☰] │  green top bar, everywhere (one menu)
├───────────────────────────────────┤
│ ←  PL Draft          (How to play)│  game bar, on game pages only
├───────────────────────────────────┤
│                                   │
│   page, on cream                  │
│                                   │
├───────────────────────────────────┤
│ © Knowitball  Discord·Credits·Privacy │ green footer + feedback box
└───────────────────────────────────┘
```
- **Top bar:** logo, Sign in (or your avatar), ONE menu. The menu holds: Home,
  All games, each game, Profile, Objectives, Discord. The game strip goes (the
  home never had it, and it does not fit a phone).
- **Game bar** (new, one shared piece): Back to All games, the game's name, How
  to play, and the game's own options. Same place in every game.
- **Footer:** the home's green footer everywhere: feedback, Join our Discord,
  Credits, Privacy. No sidebars anywhere.
- **Road to the Golden Ball inside the game** keeps its own full-screen screens
  (it already hides the top bar). Only its sign-in page and landing get the frame.

## Part 2 — One look (about 2–3 days)
- **Colours as named tokens** (Tailwind theme + CSS variables): cream page,
  ink text `#12151a`, muted `#474f5c`, green bar `#0a6a34`, green button
  `#0a7a3d` with a 4 px darker "press" edge, gold `#b8860b` for the one
  highlighted word, white cards with the home tiles' shadow and 14–18 px corners.
  The home then uses the tokens instead of overrides.
- **Type:** the home's: heavy 900 headings, tight letter spacing, 15 px body.
- **One set of parts:** Button (main / plain), Card, Pill, Tabs (the black
  pill tabs from Home | All games), List row, Empty state, Loading skeleton.
  Every page uses these; purple/indigo is removed.
- **Light only** (the home is light). Picture-heavy bits (the Draft poster,
  the pitch) stay dark as cards on the cream, like the home's phone picture.
- **A guard in the build**, like the one-engine guard: fails if a public page
  uses the old navy/indigo classes, so the look can't drift back.
- Pages, in order: sign-in, profile, Draft (all screens), Draft history and
  Hall of Fame, Tic Tac Toe (+ archive, builder), Ten-A-Ball, objectives,
  legal, credits, 404, the "not running" page.

## Part 3 — The old games, brought up to date (about 2 days)
**Tic Tac Toe**
- Today's grid opens straight away (the Daily card is the page, not a button
  to a "Solo or 2 player?" screen).
- Show how rare each answer was (it scores rare answers already; show the %).
- Streak and a shareable result square grid (the Wordle trick: free adverts).
- Archive cards in the new look; the labels on the mini grids are cut off today.

**Ten-A-Ball**
- Make "a new challenge every day" true: one featured challenge per day from
  the list (same for everyone, by date), the rest under "More challenges".
- Remove the duplicate; group by topic (Transfers, Europe, Nations, Prem).
- Fix the menu line (3 lives). Your best score on each card. Share your result.

**Tierlists / Rankings / Vote**
- Paused today. Leo decides: bring back in the new look, or take them out of
  menus and the site map so nobody lands on "isn't running".

## Part 4 — Draft, made a lot better (in three waves)
What it is today (played on the live site): pick filters (era, Normal/Prime,
Club-first/Position-first, hidden ratings, re-spins), a formation, then 14 spins
of a random club-season, pick one player each, then seasons are simulated,
with selling/signing, Hall of Fame, history, XP, multiplayer rooms and an
"American" turn draft. A lot is there; it's the shape around it that's missing.

**Wave 1 — fix and polish (about 2 days)**
- Faces back: run the existing face pipeline for every Draft edition
  (`scripts/scrape_missing.py --download-faces` + `upload_pl_draft_images.py`).
- Clean the club pool (no non-PL clubs); check every edition has a full squad.
- Out of position: show the rating in that slot and a warning (GK at ST).
- Faster picks: "Needs: RB, CM, ST" and best fits first; one tap places a
  player in his best free slot; shorter spin.
- New look (Part 2).

**Wave 2 — reasons to come back every day (about 3 days)**
- **Daily Draft:** the same 14 spins for everyone today. A score, today's
  ranking ("top 6%"), a streak, and a share grid of your 14 picks as colours.
  This is the single biggest growth idea: one link a day that people post.
- **Links (chemistry):** small bonuses for players next to each other from
  the same club, nation or era, shown on the pick card ("+2 with Fàbregas").
  Gives the picks a puzzle beyond "highest number".
- **Share my XI:** the team sheet as a picture (html2canvas is already in
  DraftResult) in the new look, sized for Instagram/TikTok stories.

**Wave 3 — depth (about 4–5 days)**
- **Challenge Draft** goes live (it is built on the test page
  /draft-challenge-dev: each pick is a brief like "a Dane", "under 23", "a
  2000s keeper").
- **Play a friend:** the multiplayer rooms in the new look, plus a share
  link "beat my XI" (same spins, async, no waiting for each other).
- **The season as a story:** key results and the table moving, cup draws,
  instead of only the final table.
- **Progress:** XP levels unlock eras, formations and card frames; achievements
  on the profile.
- **Cross-over:** the end screen offers Road to the Golden Ball, and the
  career's own player can turn up as a Draft card.

## Order and time (one person, all on branch `Leo`, live only when Leo says)
| Step | Time | Shown before going live |
|---|---|---|
| 1 Frame + tokens + guard | 1 day | stills of every page, phone + computer |
| 2 Restyle every page | 2–3 days | before/after stills of all 22 pages |
| 3 Fault fixes (list above) | ½ day | each one seen fixed |
| 4 Tic Tac Toe + Ten-A-Ball | 2 days | played on phone |
| 5 Draft wave 1 | 2 days | a full draft played to the end |
| 6 Draft wave 2 (Daily Draft) | 3 days | a full day's draft + share card |
| 7 Draft wave 3 | 4–5 days | one patch note each |
Each step is its own patch note and its own push. Harry made the home, so he
sees step 1 before it goes live.

## Decisions for Leo (feedback first, then go)
1. Light (cream) everywhere, no dark mode? — recommended yes.
2. Drop the game strip from the top bar, one menu instead? — recommended yes.
3. Tierlists: bring back or remove?
4. Draft: Daily Draft + links (chemistry) first? — recommended yes.
5. Ten-A-Ball: a featured challenge a day from the existing list? — recommended yes.
