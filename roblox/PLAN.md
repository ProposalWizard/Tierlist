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

- **Language:** Roblox runs Luau, not TypeScript. Our own converter
  (`tools/ts2luau`, built 27 Oct 2026) turns each website file into a Luau
  file, one to one. Changed from the first plan (by hand): 320,000 lines
  would take months by hand and drift from the website every day.
- **Why not roblox-ts:** the converter that exists refuses the website's code
  (562 uses of `null` in the career code alone). Making it fit would mean
  editing the website, which is ruled out. Ours accepts it as it is.
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

1. **Career core** (built 27 Oct 2026: all of 2-7 below convert and pass
   their twin tests; the screens are built; waiting on a first play in Studio)
   1. Base: dice, tuning numbers, data converter, clubs, squads. Twin tests on.
   2. Season: fixtures, calendar, league tables, simulated matches.
   3. Cups and Europe: FA Cup (ten rounds), League Cup, Trophy, CL/EL/Conference.
   4. The world season: every other league and cup, promotion, play-offs.
   5. Your player: identity, skills, contract, energy, injuries, money.
   6. Transfers: the summer window list, negotiation.
   7. End of season: awards, Ballon d'Or vote, season history.
   8. Screens: simple Roblox menus for all of the above. A 20-season soak test.
2. **Playable match and the trial** (Mikey, 27 Oct 2026: "the trial adapted for
   Roblox ... matches should be played, not simulated ... maybe you can move
   around a bit more ... try Roblox-type menus. Contract and transfer are fine
   as they are.")
   1. **The match, without the screen** (`game/match.ts`): the website's
      CanvasMatch steps copied once, like `flow.ts` copies the page: the 90
      hidden minutes, a chance whenever one comes to you, your input, the real
      physics each frame, the result, the chain to the next chance, full time.
      Converted and twin-tested with the same inputs on both sides.
   2. **The 3D pitch**: a stadium, both teams as Roblox characters in kit
      colours, the ball, a camera that frames each chance. Every position
      comes from the engine; Roblox only draws it.
   3. **The controls**, as on the website: drag back from the ball to aim and
      set power, then tap the ball where you want to strike it; swipe to curve;
      tap to head; penalty run-up. **Moving more**: after a pass, and in the
      dribble, you run your own Roblox character with WASD or the thumbstick.
   4. **The trial**, all five stages as on the website: free kicks, through the
      gate, take him on, find the pass, the shootout. Then the manager's talk,
      the scout's offers and the signing.
   5. **Roblox-style menus**: big rounded buttons, icons, bold colour.
3. **Full screens:** home, league, transfer hub, stats, shop, Ballon d'Or night,
   in the Roblox look.
4. **Extras:** garden, casino, cut scenes, media feed, music, sponsors.
5. **The rest of knowitball.co.uk** (tierlists, draft and others), if still wanted.

## Not possible from a cloud session

- Opening Roblox Studio or publishing to Roblox. Mikey (or Harry/Leo) does the
  final open, play and publish.
- Seeing the 3D game. Rules are tested here; the look is checked in Studio.
