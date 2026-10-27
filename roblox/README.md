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
| `src/Server/` | The Roblox server: careers, saving (DataStore), real squads (HttpService). |
| `src/Client/` | The Roblox screens: draws what the server sends. |
| `twin/` | Twin tests: each runs on the website code and on the converted code; every printed line must match. |
| `tools/` | The converter and the tools below. |

## Tools (from the repo root)

```bash
node roblox/tools/build.mjs        # convert the game and build build/RoadToBallonDor.rbxlx
node roblox/tools/twin.mjs         # every twin test (website v Roblox, same output)
node roblox/tools/twin.mjs flow    # only the twin tests named "flow"
node roblox/tools/smoke.mjs 150    # the server, played like a client, 150 presses (build first)
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
- Stage 1 has no trial: a new career picks its club, as the website's career
  soak does. The trial needs the match (stage 2).
