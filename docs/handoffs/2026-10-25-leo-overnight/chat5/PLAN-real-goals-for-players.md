# Real Goals for players — a plan (chat 5, 25 Oct 2026)

Docs only. Nothing here is built. Leo decides.

## What players would get
Real Goals as a side mode of Road to Ballon d'Or: the home screen with today's
Daily Real Goal and the 8 paths (World Cup & Euro, 5 leagues, Worldies,
Bangers). Each level is a real goal: the real move plays, then you take the
shot. Stars are for how close you get to the real goal.

## Where the button goes (pick one)
| | Where | For | Against |
|---|---|---|---|
| **A (recommended)** | Title screen menu, under "Load game": **⚽ Real Goals**, with today's streak as the hint ("🔥 3") | One tap from the game's front door. No career needed. The streak hint brings players back each day. | One more row on the title menu (it has 4–6 rows today). |
| B | Inside the career: Home → a "Real Goals" card | Feels part of the career | A new player has to start a career first. Touches `app/star-dev/page.tsx` (the shared hot spot). |
| C | Site home page, next to Road to Ballon d'Or | Reaches people who never open the career | Its own game, away from the career. |

A and C can both be done. A is a small, additive change to `components/star/TitleScreen.tsx`.

## What is needed
1. **A player page, not the test page.** A new route (e.g. `/real-goals`) with no admin gate. It reuses
   the same parts (`lib/star/realGoal*.ts`, the paths home, PlayGoal). Leave out what only the team needs:
   the admin fixer, the page guide, the "test" header. Use the game's own look (the title-screen style), not the admin page style.
2. **Leo's switch first.** A new `LEO_FEATURES` entry "realGoals" (`lib/star/leoUpdate.ts`). With it off, the
   title menu has no Real Goals row and the game is exactly as now.
3. **The one-engine guard.** The match is the real one (EnginePlay). But the Real Goals extras (`realGoal`:
   the real sides, the names, the ghost; and `Scenario.realLane`) are listed as TEST_ONLY in
   `scripts/one-engine-guard.mjs`. A player page using them needs that entry reworded to cover a player mode.
   That is Harry's area (RUL-ENG-004: never change the guard's lists without asking). **Harry's yes needed.**
4. **Licences and names.** The Wyscout data is CC BY 4.0: the credit line must show on the player page (it
   does on the test page). The 61 Bangers are written by us from match reports, with real player and club
   names as labels only (no badges, photos or clips). **Decision for Leo/Harry:** are real names fine for
   players, or show them only in a "real names" setting?
5. **Saving.** Stars, the daily streak and the paths are kept on the phone only (localStorage). For players
   that is fine to start with. Later: save to the account (a small table), so stars follow you across phones.
   A leaderboard needs that table plus a guard against faked scores (plan part 8a said: later).
6. **Help on the first goal.** First-time players do not know to "follow the ghost". A 3-step overlay on the
   first level: watch the move → pull back from the ball toward the ghost line → tap the ball low or high.
7. **The daily list runs out on 20 Feb 2027** (121 days). Append more goals before then
   (`lib/star/realGoalDaily.ts`, then `npx tsx scripts/realmoments/build_rg_index.mts`).
8. **Speed.** Done already: the home shows in under 0.6 s on a 6× slower phone; data loads only for the path
   you open; the match loads only when you play.
9. **Known weak spots to fix first** (from the 25 Oct playthrough, see REPORT.md): see the list there.

## Size
About a day of work for A + the player page + the switch + the first-goal help, once Harry agrees on the guard and names.

## Decisions for Leo
1. Where the button goes: A (recommended), B, C, or A + C.
2. Real names on the Bangers for players: yes / setting / no.
3. Saving to the account now or later (later recommended).
