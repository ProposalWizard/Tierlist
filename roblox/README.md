# Road to Ballon d'Or on Roblox

A separate copy of the website's Road to Ballon d'Or, running in Roblox.
Nothing here changes the website. Plan and stages: `PLAN.md`.

## Play it

1. Download `build/RoadToBallonDor.rbxlx` from GitHub (open the file, then
   "Download raw file").
2. Open it in Roblox Studio (File → Open from File).
3. Home → Game Settings → Security: turn on **Allow HTTP Requests** (real
   players from knowitball.co.uk) and **Enable Studio Access to API Services**
   (saving). Without them it still plays, with invented players and no saving.
   Game Settings needs the place published once (File → Publish to Roblox).
4. Press **Play**.

## How it is made

The website's own code is converted, file for file, into Roblox's language
(Luau). Nobody writes the career code twice.

| Folder | What it is |
|---|---|
| `src/Game/` | The converted website code. **Never edit it**: it is rebuilt from the website. |
| `src/Runtime/Js.luau` | Makes Luau behave like JavaScript (lists from 0, key order, text, number printing, sorting). Hand-written. |
| `src/Runtime/Loader.luau` | Connects the converted files inside Roblox. |
| `src/Overrides/` | Hand-written Roblox versions of the few website files that cannot be converted. |
| `game/flow.ts` | The website page's steps (after a match, season end, transfer window) without the screens. TypeScript, converted like the rest. |
| `game/screens.ts` | What each Roblox screen shows and what its buttons do. TypeScript, converted. |
| `game/match.ts` | The website's match (CanvasMatch) without the drawing: the 90 minutes, every chance, your input, the ball. TypeScript, converted. |
| `game/strikeScreen.ts` | The strike screen (tap where on the ball) and the power shot, without the drawing. |
| `game/matchView.ts` | What is on the pitch each frame, for the Roblox match to draw. |
| `game/trialPlay.ts` | The trial's five tests without the drawing (played on the device). |
| `game/trainingPlay.ts` | A training level's drill without the drawing (played on the device). |
| `game/trainingFlow.ts` | Training's server rules: sessions, energy, which levels are open, banking the stars. |
| `game/lifeFlow.ts` | The Life tab's server rules: rest, the shop (cans, boots, lifestyle), the day off, the office talk, sponsors. |
| `game/relgamePlay.ts` | The relationship games without the drawing (woodwork challenge, signing session), played on the device. |
| `game/camera3d.ts` | The match camera: where it stands for each chance, the run and the commentary. Roblox only. |
| `game/trialFlow.ts` | The trial's server steps: the results checked, the scout's offer, the manager's talk, the signing. |
| `src/Server/` | The Roblox server: careers, saving (DataStore), real squads (HttpService). |
| `src/Client/Main.client.luau` | The Roblox menus: draws what the server sends. |
| `src/Client/Match.luau` | The 3D match: the stadium, the players, the camera, your controls. Draws `matchView`, decides nothing. |
| `twin/` | Twin tests: each runs on the website code and on the converted code; every printed line must match. |
| `tools/` | The converter and the tools below. |

## Tools (from the repo root)

```bash
node roblox/tools/build.mjs        # convert the game and build build/RoadToBallonDor.rbxlx
node roblox/tools/twin.mjs         # every twin test (website v Roblox, same output)
node roblox/tools/twin.mjs flow    # only the twin tests named "flow"
node roblox/tools/smoke.mjs 150    # the server, played like a client, 150 presses (build first)
node roblox/tools/smoke-client.mjs 3 "League One" 1   # 3 matches played through the 3D match script by a robot
node roblox/tools/drift.mjs        # which website files changed since the last build
node roblox/tools/typecheck.mjs    # type-check game/ and twin/ against the website code
```

They need `luau` and `rojo` (set `LUAU=` and `ROJO=` to where they are), and
Node with TypeScript. Twin tests run the website side with `npx tsx`.

## Keeping up with the website

1. `node roblox/tools/drift.mjs` lists what changed.
2. `node roblox/tools/build.mjs` converts it all again.
3. `node roblox/tools/twin.mjs` must still pass. A failure names the first
   line that differs.
4. If `app/star-dev/page.tsx` changed in a handler `game/flow.ts` copies, copy
   the change by hand (each flow function names the page handler it copies).

## Known differences from the website

- JavaScript's `null` and `undefined` are both Luau's `nil`. No game rule tells
  them apart.
- A gap in a list (writing past its end) reads as an empty slot.
- Sorting text by `localeCompare` copies the browser's order for every letter
  in the game's club and player names (accents, Æ, Ø, ß...), not for every
  alphabet in the world.
- The trial's teaching cards are not copied: each test shows a one-line hint.

## The match

Played on the player's device, with the website's own rules (the server sends
the match, the device sends back the stats, the server checks them and puts
them in the career). Controls:

| What | Computer | Phone |
|---|---|---|
| Aim and power | drag back from the ball, let go | the same |
| Strike | click where on the ball | tap where on the ball |
| Curve (curve boots) | swipe while the ball flies | the same |
| Penalty run-up aim | drag sideways | the same |
| Run after a pass | W A S D, Shift to sprint | thumb stick, SPRINT |
| Dribble | W A S D, Q / E to knock it past him, click a team-mate to pass | thumb stick, KNOCK buttons, tap a team-mate |

"Sim it" on the matchday screen still sims the match, as on the website.

The camera (`game/camera3d.ts`) films each chance from behind the ball
towards goal, as close as it can while the ball, the goal and you stay in
view; the keeper and the men nearest the ball come in when they fit. The run
follows behind you. To check a change by eye without Studio:
`npx tsx roblox/bench/frames.dump.ts` then `python3 roblox/tools/camera-preview.py`.

## Training

As on the website, training is the only way your skills grow. Train tab:
pick a skill, then a level (30 per skill). Three tries a level: in first time
is three stars, second two, third one; every new star adds to the skill. Two
sessions a week (back after a Saturday match), each costing energy. Power,
Technique, Free Kick and Aerial are played on the 3D pitch like a match
chance; Pace is the run (W A S D / stick, Q / E to knock it past him); Vision
is a tap on the right team-mate (or, on higher levels, the pass itself).

## Life

The Life tab has what the website has between matches, with the same rules:

- **Rest**: energy back (more when you are happy). One of the week's days.
- **Shop**: energy cans (buy, then drink), boots (the same pair adds its
  matches; a new pair replaces it), lifestyle (cars, homes, phone...; star
  locks as on the website).
- **Relationships**: one game per bar each week, each costing energy and a
  day. Boss: the office talk (three answers). Team: the woodwork challenge
  (hit the posts and bar, on the 3D pitch). Fans: the signing session (tap
  the shirts in time). Happiness: a day off (home, golf, a weekend away).
- **Sponsors**: offers as they come; ask for longer or easier targets, sign
  or decline, and answer a rival's poach.

## The trial

A new career starts as on the website: no club, a trial at the club you
picked, five tests on the same 3D pitch (free kicks, through the gate, take
him on, find the pass, a penalty shootout), then a scout's offer, the
manager's talk and a fixed first contract (National League North or South).
Take him on is played with W A S D or the thumb stick (Q / E or the KNOCK
buttons to knock it past him); find the pass is a tap on the free man.
