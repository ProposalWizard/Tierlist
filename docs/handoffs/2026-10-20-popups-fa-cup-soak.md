# Handoff — 20 Oct 2026 (Mikey): pop-ups, FA Cup, fixes, career soak

Branch `Mikey`. Nothing merged to `main`: merge only when Mikey says push.
Patch notes v0.19 (site 0.61): https://claude.ai/artifact/QsxGeWuEK6C7GwcCQJSD3r

## Done this chat
- **Mikey's new pop-ups** (Settings → Match, default Old): `components/star/MikeyPopup.tsx`,
  `lib/star/mikeyPopups.ts`, wired in `CanvasMatch.tsx` `showAction` → `showMikeyPopup`.
  A goal shows a scoreboard (score rolls over, scorer and assist read from `goalEventsRef`
  a tick later). Every other word is a caption. Seen in a real match.
  Font: Oswald Bold (`public/star/banners/Oswald-Bold.woff2`, OFL).
  Adobe and Blender could not be reached here; if Mikey wants outside art, that's the next step.
- **FA Cup: 10 rounds**, leagues join at their real rounds, 24 byes never to your club
  (`cups.ts openFaCup`, `competitions.ts faCupEntrantsFor`/`newCupFixtures`, `calendar.ts FA_CUP_SLOTS`).
- **Team-mate goals kept on reload** (`realSquad.ts squadAfterFetch`).
- **Your player on every chance**, moved clear of ball and arrow (`lib/star/youSpot.ts`). To be agreed with Harry.
- **Corners need reach**: 34.4 m carry, about power 60 (`lib/star/cornerReach.ts`, measured through
  `canvasEngine.ts airCarry` so the one-engine guard passes).
- **PL Draft FC 27**: 177 clubs → the game's 20 (`app/api/draft/clubs/route.ts`).
- **Player search**: one query per accent spelling (an OR timed out on "kane").

## How it was checked
- `npx tsx scripts/soak/careerSoak.mts 20`: 21 careers × 20 seasons, 20,029 matches, all held.
- Production build passes; one-engine guard clean.
- Star suite: same failures as before this chat (Leo's keeper/long-shot area, wembley3d).

## Open
- Mikey: is a Basic KIB can meant to cost more than Premium (2 vs 1 weeks' wage)?
- Leo: keeperPro, keeperBrain, longRangeRules, chanceJudge, chanceMaker, match2dCam fail.
- Data: PL Draft FIFA 13/22/24 each list one stray club (mislabelled rows).
- `star_xp_config.sql` not run (safe fallback).

## Starter for the next chat
> Branch Mikey. Read `docs/handoffs/2026-10-20-popups-fa-cup-soak.md` and CLAUDE.md.
> Patch notes v0.19 are up. Wait for my word before merging to main.
