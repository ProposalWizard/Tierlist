# gamecap: film football moments in the game's own look

gamecap turns a JSON spec into frames of the game's animated goal highlights: the goal-clip renderer (`lib/star/goalClip/`), the 3D figures, the stadium and the real goal pop-up (`components/star/MikeyPopup.tsx`). Use it for moments in videos, such as "Kompany's header against United in 2012", "Henry scores for Arsenal" or "Dalot skies a free shot". The rules are in `../V2_RULES.md` ("Knowitball gameplay").

```bash
node tools/video-factory/gamecap/capture.mjs <spec.json> <outdir/>     # one command
python3 tools/video-factory/gamecap/sheet.py <outdir>/<clip>           # contact sheet: look at it before you use the clip
node tools/video-factory/gamecap/capture.mjs --cleanup                 # only after a run was killed with kill -9
```

Options: `--port N` (default: a free port), `--quality 0.9` (JPEG), `--no-popup`, `--no-preview`.

## What one run does

1. **Checks first.** It refuses to start if `lib/star/sprites.ts` or `lib/star/goalClip/render.ts` has changes in git, if `app/zz-gamecap-tmp/` exists, or if another capture is running in this checkout (`.lock`). It runs one capture at a time per checkout.
2. **Patches.** It applies `patches/game-patches.mjs` and copies `template/` to `app/zz-gamecap-tmp/`. Each patch must find its anchor text exactly once; if one does not, the run stops before it changes anything.
3. **Serves.** It starts `next dev` on a free port. The first compile of the page takes 1 to 3 minutes.
4. **Films.** It opens the page in Playwright, builds every clip, warms every sprite atlas, then draws each camera frame by frame.
5. **Always reverts.** On success, on an error and on Ctrl-C, it checks out the two patched files, deletes `app/zz-gamecap-tmp/` and stops the server. It also checks out `next-env.d.ts`, `tsconfig.json` and `lib/star/three3d/assetVersions.ts`, but only if `next dev` rewrote them and they were clean before the run.

After a kill -9, run `--cleanup`. It reverts only files that contain the `GAMECAP-TMP` marker, and only our own page folder.

**Never commit `app/zz-gamecap-tmp/` or the patched files.** The page and the patches live only in this folder.

### The patches (temporary; reverted every run)

| File | What it changes |
|---|---|
| `lib/star/sprites.ts` | Gives each man a skin and hair colour. The baked figures have one skin and one hair, so the unmasked pixels are recoloured by brightness. Also grows the tinted-atlas cache from 24 to 72, because every look counts as a kit. |
| `lib/star/goalClip/render.ts` | Passes skin and hair to the sprite kit, and draws the ball as a real football with black panels that rolls. |

The move planner does not patch `synth.ts`: it is `template/moves.ts`, which has its own paths.

## Fresh cloud session

- Run `npm ci`. Playwright's Chromium comes from `npx playwright install chromium` if it is missing; `/opt/pw-browsers/chromium` or `GAMECAP_CHROMIUM` also work. You also need `ffmpeg` (only for `preview.mp4`) and Python 3 with Pillow (only for `sheet.py`).
- `.env.local` needs only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The anon key is public: it ships in the live site's JavaScript. The capture page reads no data. Without `.env.local`, the script uses the public project URL and a placeholder key, which is enough for the site's middleware.
- Disk: `.next/` grows when `next dev` compiles. A clip is about 30 to 60 MB of JPEGs per camera; delete frame folders you do not need.
- Nothing here depends on files outside the repo.

## The spec

```jsonc
{
  "teams": {
    "home": { "name": "Manchester City",          // full club name: used for the pop-up's short name (shortClub) and the crowd's colours
              "short": "Man City",                 // optional: what the pop-up shows instead
              "kit": { "shirt": "#6CABDD", "shorts": "#FFFFFF", "socks": "#6CABDD" },
              "keeperKit": { "shirt": "#1F2A44", "shorts": "#1F2A44", "socks": "#1F2A44" },
              "popupTrim": "#FFFFFF" },            // the pop-up's edge colour (default: the shorts)
    "away": { ... }
  },
  "people": {
    "kompany": { "name": "Vincent Kompany", "skin": "#5a3826", "hair": "#0d0a09", "popupName": "Kompany" }   // popupName optional (default: surname, as the game does it)
  },
  "popupPosition": "top",                          // "top" (default, 3%), "game" (70%, where the game puts it) or any CSS top, e.g. "8%"
  "clips": [{
    "id": "kompany-header",                        // the folder name
    "kind": "header",                              // see Clip kinds
    "attacking": "home",                           // which team attacks (the goal is always the one in shot)
    "scorer": "kompany", "assister": "silva",      // ids from people
    "defenders": ["smalling", "giggs", "ferdinand"],   // 0-7. The first marks the scorer; for a corner the second stands at the near post
    "keeper": "degea",
    "teammates": ["lescott", "toure"],             // 0-6 extra attackers (fill the box at a corner)
    "minute": 45, "minuteLabel": "45+1",
    "scoreBefore": [0, 0], "scoreAfter": [1, 0],   // [home, away]; scoreAfter defaults to scoreBefore + 1 for the attacking side
    "night": true,                                 // floodlights (omit: the game picks from the clip id)
    "weather": "rain",                             // optional: rain | snow
    "celebration": "roar",                         // optional; see Celebrations
    "cameras": ["tv", "high", "tight", { "angle": "fan", "from": "shot-1", "to": "goal+2", "name": "fan-short" }],
    "recreate": { ... },                           // optional; see Recreating a real goal
    "seed": "kompany-2012-a",                      // same seed, same film; change it for another version of the move
    "popup": true                                  // false = no pop-up for this clip
  }]
}
```

Colours are hex values. For skin and hair, look at a photo and pick the main tone. The figures show only the colour, not the shape: no beards, locs or bald heads (for a bald man, set hair close to his skin colour).

Times in `cameras` are seconds or a key word plus or minus seconds: `start`, `end`, `pass`, `shot`, `goal` (also the miss or save moment), `miss`, `save`, `celebration`, `celebration_move`.

## Clip kinds

| kind | The move | Notes |
|---|---|---|
| `header` | A corner (`delivery: "corner"`, default) or a cross from open play (`"cross"`), headed in | The marker trails the scorer; at a corner a man stands at the near post. Corners swing in by default (`swing`). |
| `tap_in` | Run to the byline, cut-back, first-time finish | |
| `long_range` | A pass inside, a touch, a shot from about 25 m | Half the seeds curl it. |
| `one_on_one` | A through ball, the run, the finish past the keeper as he comes out | `finish: "chip"` lifts it over him. |
| `volley` | A lofted cross met first time at waist height | Uses the game's volley move. |
| `penalty` | Run-up, keeper the wrong way | |
| `free_kick` | A 3-4 man wall (the first 4 defenders) that jumps, curled over into the top corner (far side by default) | |
| `miss` | Any move above (`recreate.base`, default `one_on_one`) with the shot over the bar into the first rows (`outcome: "over"`) or wide (`"wide"`) | Nobody celebrates; no pop-up. The `fan` and `tv` cameras show it best: from `high` (behind the shot) a ball rising over the bar can look as if it goes in. |
| `save` | Any move (`base`) with the keeper getting there: `save: "parry"` (default, pushed round the post) or `"catch"` | |
| any | `recreate.outcome: "post"` hits the post and comes back out | |

Not possible: a deflection, an own goal, a goal from a rebound in one move (film two clips), more than one keeper, a dribble past several men, or a back-heel. Kit patterns (stripes, hoops, Arsenal's white sleeves) are not possible either: the sprite mask has one shirt colour.

## Recreating a real goal

All positions are **attacker's view metres** `[x, y]`. `x` is across from the goal centre, with **+ to the attacker's RIGHT** as he faces the goal (that is the side nearer the main TV camera). `y` is metres out from the goal line: the penalty spot is 11, the six-yard line 5.5 and the edge of the box 16.5.

```jsonc
"recreate": {
  "delivery": "corner",        // header: corner | cross; one_on_one: through | lofted; long_range: lofted
  "side": "right",             // which wing the ball comes from
  "swing": "in",               // corner/cross: in | out | none
  "passerStart": [31, 3],      // where the passer starts
  "passFrom": [33.6, 0.6],     // where he plays it from
  "scorerStart": [-2, 16.5],   // where the scorer starts his run
  "scorerSpot": [0.5, 6.5],    // where he meets it / shoots from
  "finish": "header",          // header | left | right | volley | curl | chip | ground
  "goalSide": "far",           // left | right | centre | near | far (near/far from where the ball came)
  "height": "mid",             // low | mid | high
  "outcome": "goal",           // goal | over | wide | save | post
  "save": "parry",             // parry | catch
  "base": "one_on_one"         // for kind miss/save
}
```

`finish: "left"` or `"right"` is written down only: the figures kick with the same leg. Anything you leave out comes from the seed.

## Cameras

| angle | What it is | Use |
|---|---|---|
| `tv` | The broadcast camera, high in the main stand level with the box, panning with the ball | The wide shot: shows a corner or cross being taken. The goal is on the left of the picture. |
| `high` | Spider-cam behind the scorer, looking down the line of the shot | The close shot of the finish. For header and volley it starts just before the strike, because the wing is off this camera. |
| `tight` | The TV camera zoomed in on the scorer | The celebration; starts 0.3 s before the goal by default. |
| `fan` | A phone in the end stand by the corner, a little shaky | Good for misses and saves. |
| `net`, `side`, `match`, `reverse`, `strike`, `follow`, `spider`, `fanSide`, `fanHigh` | The game's other cameras | Untested here. |

## Output

```
outdir/
  _dev.log                    the next dev log
  capture.json                every clip's meta + page errors
  <clip>/
    meta.json                 fps 30, size 720x1280, frames, times (pass, shot, goal|miss|save, celebration_start, celebration_move),
                              events, bodies, and per camera: from_s/to_s, frames, key_frames {pass, shot, goal, miss, save, celebration_*}
    <camera>/00000.jpg…       720x1280 JPEG, 30 fps, no text on screen
    popup/00000.png…00045     the goal pop-up, 720x1279 PNG with alpha (goals only)
    preview.mp4               360x640: tv then high, 2.5 s each around the goal, for a quick check
```

**Timings.**

- The clip starts 0.9 s before the first kick (the game's lead-in) and ends 2.2 s after the goal, or 4.7 s after it with a celebration.
- The pop-up has 46 frames (1.5 s): it slides in over frames 0 to 6, the score rolls over frames 10 to 15, and it slides out over frames 39 to 45.
- Put pop-up frame 0 on the goal frame, or a few frames after it.

## Celebrations

`celebration` takes one of the game's moves: `hands_up`, `arms_out`, `knee_slide`, `fist_pump`, `jump`, `roar`, `corner_flag`, `backflip`, `own_name`, `statue`, `fist`. The scorer runs to the nearest corner flag and does the move. Film it with `tight`.

It works for any scorer. Internally his body id is `"you"`, because the game plays the celebration run only for that id. Nothing on screen says YOU.

Without `celebration`, the scorer does the game's plain celebrate pose where he stands.

## The pop-up

The pop-up is the game's own MikeyPopup scoreboard. It shows the clubs' short names (`shortClub`), the score rolling from `scoreBefore` to `scoreAfter`, and GOAL and ASSIST with the surname (`popupName`).

**Position gotcha:** the game now draws the goal board at **70%** of the screen height, so it stays clear of the goal. Our videos put it at the top, so gamecap moves it up to 3% by default (`popupPosition: "top"`). Use `"game"` for the game's own place.

## Adding a new kind

1. In `template/moves.ts` → `planMove`, add a branch that sets:
   - the scorer, assister, defender, mate and keeper paths (`path([[t, A(x, y)], ...])`)
   - `pre(t)`, the ball up to the strike
   - `strikeT`, `from` (the strike point), `flyS`, `lift`, `bend` and `shotMode`
   - `events` (pass and touch)
2. The finish (goal, over, wide, save or post) is shared (`makeFinish`), so a new kind gets every outcome.
3. Add the name to `Kind`, and to `KINDS` in `capture.mjs`'s `validate`.
4. Run `examples/all-kinds.json` plus a spec for the new kind, and look at `sheet.py` output for every camera.
5. Type-check: `npx tsc -p tools/video-factory/gamecap/tsconfig.check.json`. Nothing should print for `gamecap/`.

## Gotchas

- **Look at every clip.** Use `sheet.py`, and look before you use the clip. Seeds differ, and some put two men on top of each other. A pass pushes apart any two men closer than 0.95 m. If something still looks wrong, change the `seed`.
- **The header pose** comes from the game's header move. It leans forward like a stooping header more than a standing leap.
- **The `tv` camera's first frames** are very wide when the move starts far out (a corner, or a one-on-one from 40 m). The men are small there.
- **"Their goal".** The real game names nobody for a goal by the other side. gamecap names the scorer by default. Set `"popupTheirs": true` on a clip for the game's own "Their goal" board, with no names.
- **Only one run per checkout** at a time. `.lock` is ignored by git.
- **Hydration warnings** in the page errors ("Text content does not match") come from the site's layout and are harmless.
- **A patch anchor fails** when the game's code has moved. Update the `find` text in `patches/game-patches.mjs` to match the new code.

## Examples

`examples/kompany-2012.json`, `henry-generic.json`, `miss.json`, `all-kinds.json` (every kind once: a smoke test). Their outputs are in `examples/out/` (ignored by git):

- each camera is compressed to `<camera>.mp4`, with `sheet.jpg`, `meta.json`, `preview.mp4` and `popup.tar.gz`
- re-run a spec to get the JPEG frames back
