# Chat 7 · Bug hunt round 2, with Leo's update on (25 Oct 2026)

Branch `leo-bughunt` (main ac28a57d merged in, fast-forward). Started 12:29 UTC, when the job arrived. Everything was played on a **production build**, signed out, at phone size (390 × 844). The sandbox can't reach the database, so squads were invented and badges showed initials. Sound was not heard (headless browser); no sound errors were logged.

## In one look
- **Played (seen):** with the switch fully on, 1 career for 2 full seasons into season 3: 9 real matches, 3 goals, 2 of them under a 4× slower CPU. It went through the season video ×2, the Ballon d'Or night ×2 (one watched in full), the summer window ×2 (one walk-away, one move to Wealdstone) and the 3D awards night ×2. With the switch off, 1 full season (3 real matches). Separately: 10 refresh moments and back/Escape on the new screens.
- **Bugs found:** 13. **Fixed:** 4, all behind "Bug fixes", each with a before → after still. One more fix was tried and taken out: its bug didn't reproduce.
- **Switch off = the old game (seen):** 6 of the 7 old-behaviour checks were seen; the 7th (the "game today" tip) can't show, because new careers start in Mikey's story mode. No Leo feature leaked through with the switch off.
- **Refresh (seen):** nothing in the career was lost at any of the 10 moments. Ballon d'Or night, the awards night, the season video, the window list and the talks all came back.
- **Tests (measured):** 421 of 430 pass. The 9 that fail are Harry's chance/match tests; 5 of them were re-run on main alone and fail there too. tsc clean, one-engine guard passed, production build passed, 20-season soak all held.

## Fixed (behind Leo's switch → "Bug fixes")
| # | Where | Before → after (seen) | Still |
|---|---|---|---|
| 1 | Contract talks in the summer window → ⚙ Settings → Back | Landed on Home, out of the window → back on the talks | `fix-talks-settings-back.jpg` |
| 2 | Stats → Goals → a goal's facts card | "How: long_range" (a code) → "How: Long shot" | `fix-goal-how.jpg` |
| 3 | Same goal sheet, Escape key | Did nothing → closes the sheet | `fix-goal-escape.jpg` |
| 4 | Signing scene after a summer move | "THE MANAGER · MANAGER" → "BRUNO VOSS · MANAGER" (the man who becomes your manager) | `fix-signing-manager.jpg` |

Left side = switch off, right = on. For 2 and 3 the left side has only "Bug fixes" off, because the goals list itself needs the update on.

**Taken out:** a change to the swipe pages (a drag on a goal sheet turning the page to Home). It didn't reproduce on the production build either way, so I removed it rather than ship a guess in a shared component.

## Found, not fixed
| # | What | Where / how | Area | Sure? |
|---|---|---|---|---|
| 5 | Browser back (or Android's back gesture) leaves the game from every screen; screens that can't resume land on Home | Any screen → back. The game keeps no browser history | App-wide (design) | High |
| 6 | Refresh mid-match loses the match; it can be replayed (a retry trick) | Score, refresh → Home, fixture unplayed | Match flow (Harry) | High |
| 7 | "Too many active WebGL contexts. Oldest context will be lost." after Ballon d'Or night → signing → awards night in a row | Console, once per run | 3D screens (Harry) | Medium |
| 8 | Star Pass "You levelled up" pop-up has only "Open the Star Pass"; tapping outside does nothing | Home after a match | Mikey (economy) | Medium |
| 9 | Opening wage in the same talks changes between visits (★18, then ★15) | Window → club → Negotiate twice | Mikey (economy; known since round 1) | Medium |
| 10 | Feed says "does it again 🚨" after a career's very first goal | Feed after goal 1 | Media feed | Low |
| 11 | Ballon d'Or top 10: #1 has 17 G + 6 A, #2 has 22 G + 9 A | Result page, season 2 | Ballon d'Or | Low (maybe by design) |
| 12 | Fame drops to 0 at the season turn | Home, season 3 | Mikey | Low |
| 13 | Training, Phone and Shop locked until the manager's chat chain is done; the pop-ups block taps on Play | Early career | Mikey (story/tours) | Low (maybe by design) |

**Withdrawn after checking:**
- The season 2 video did include the goal (the first shot was taken late).
- The 3D awards night does show all 5 awards. I pressed "Next award" on its test page: Assist King, Golden Glove, Young Player, Player of the Season, in order. The tester had pressed twice.

## Refresh at 10 moments (switch on, seen)
| Moment | Where it lands | Lost |
|---|---|---|
| Trial, mid-stage | Same stage | Nothing |
| Home | Home | Nothing |
| Line-up | Home | Nothing |
| Mid-match | Home, match replays | The match so far (#6) |
| Post-match | Home, result already saved | Nothing |
| Season video | The video | Nothing |
| Ballon d'Or night | The night, from its start | Nothing |
| Awards night | The night, from its first award | Nothing |
| Window list | The list | Nothing |
| Talks / "Deal agreed" | The window list | Nothing (the unsigned deal is re-done) |

## Slow phone (4× slower CPU, measured on one run)
- In a match: about 48 frames a second, worst gap 200 ms.
- Settings was slow to react to taps (about 2.5 s once).
- The season video and feed drew fine.
- Nothing broke only when slow.

## Not reached
- Celebrations and big moments in play: no clear goal + celebration was filmed.
- Goal of the Month poll card on screen: it exists in the save and the winner post showed.
- Season 3 matches.
- Sound by ear.

## Files
- Code: `app/star-dev/page.tsx` (1 line, Settings from talks), `components/star/CareerGoalsGallery.tsx`, `lib/star/goalLog.ts` (`goalHowLabel`), `components/star/TransferSigning.tsx`.
- Stills: this folder. `on-*` = switch-on run, `off-*` = switch-off run, `nav-*` = refresh/back, `fix-*` = before | after.
