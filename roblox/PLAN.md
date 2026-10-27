# Road to Ballon d'Or on Roblox: the plan

Asked for by Mikey, 27 Oct 2026: "replicating the exact road to Ballon d'Or game,
but transferring it into a Roblox-style". A separate project. Nothing in the
website changes.

## Decisions (Mikey, 27 Oct 2026)

| Question | Answer |
|---|---|
| Match look | A real 3D Roblox pitch with Roblox characters. Same rules and chances as the website. |
| Real names | Real club and player names. No real badges, no player photos (Roblox takedown risk). Colour badges and Roblox avatars instead. |
| Where | This `roblox/` folder. The website's code is never edited for it. |
| First build | The career core, playable: make a player, play seasons with simulated matches, tables, cups, transfers. |

## How it works

- **Language:** Roblox runs Luau, not TypeScript. Every website file is
  rewritten by hand, one to one. A file on the website = one file here, same
  name, same functions, same order.
- **Why not an automatic converter:** the converter that exists (roblox-ts)
  refuses the website's code. The career code alone has 562 uses of `null`,
  which it forbids, and 29 places that touch the browser. Making it fit would
  mean editing the website, which is ruled out.
- **"Exactly the same" is tested, not hoped:** the website rolls its dice with
  one seeded generator (`mulberry32`, `lib/star/season.ts`). The Luau copy gives
  the same numbers to 15 decimal places (checked 27 Oct 2026, 4 seeds × 5 rolls).
  So every ported piece gets a **twin test**: run the same seed through the
  website code and the Roblox code, and compare the results line by line
  (league tables, cup draws, transfers, Ballon d'Or votes). A difference fails.
- **Keeping up with the website:** the website changes every day. Each Roblox
  file names the website file and commit it copies. `tools/drift` lists the
  website files changed since, so we know what to re-port.
- **Data:** the club, player and kit data (about 15,000 lines of JSON) is
  converted by a script, never by hand. Re-run it when the data changes.
- **Getting it into Studio:** `rojo build` makes one file,
  `roblox/build/RoadToBallonDor.rbxlx`. Download it from GitHub and open it in
  Roblox Studio. No `git pull` needed.
- **Saves:** Roblox DataStore, one career per player, in place of the website's
  browser storage and Supabase.

## Size

Road to Ballon d'Or is about 320,000 lines on the website (1,060 files). The
career core (stage 1) is 131 files and 60,000 lines, of which about 15,000 are
data.

## Stages

Each stage ends with something you can open in Studio and play.

1. **Career core** (now)
   1. Base: dice, tuning numbers, data converter, clubs, squads. Twin tests on.
   2. Season: fixtures, calendar, league tables, simulated matches.
   3. Cups and Europe: FA Cup (ten rounds), League Cup, Trophy, CL/EL/Conference.
   4. The world season: every other league and cup, promotion, play-offs.
   5. Your player: identity, skills, contract, energy, injuries, money.
   6. Transfers: the summer window list, negotiation.
   7. End of season: awards, Ballon d'Or vote, season history.
   8. Screens: simple Roblox menus for all of the above. A 20-season soak test.
2. **The match on a 3D pitch:** chances, shooting, passing, keepers, all on the
   website's rules, played by Roblox characters.
3. **Full screens:** home, league, transfer hub, stats, shop, Ballon d'Or night,
   in the Roblox look.
4. **Extras:** garden, casino, cut scenes, media feed, music, sponsors.
5. **The rest of knowitball.co.uk** (tierlists, draft and others), if still wanted.

## Not possible from a cloud session

- Opening Roblox Studio or publishing to Roblox. Mikey (or Harry/Leo) does the
  final open, play and publish.
- Seeing the 3D game. Rules are tested here; the look is checked in Studio.
