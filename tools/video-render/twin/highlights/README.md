# Highlights reel: goals list to a vertical MP4 in the game's goal-clip look

```bash
node tools/video-render/twin/highlights/make_reel.cjs GOALS.json OUT_DIR [--silent] [--stills-only]
```

The output is `OUT_DIR/reel.mp4` (1080 x 1920, 30 fps, H.264 with AAC sound) and `OUT_DIR/stills/gNN_{a_start,b_strike,c_goal,d_after,e_replay}.png`.
A 4-goal reel is about 31 s of video and takes about 40 s to make. The first run on a new machine also fetches esbuild with npx.

## Needs

- `npm ci` in the repo (the bundle reads `lib/`, and `tsconfig.json` supplies the `@/` paths).
- Playwright with Chromium. The script finds it in the repo, in the global npm root, or through `NODE_PATH=$(npm root -g)`.
- ffmpeg.

## GOALS.json

```json
{"scorer":"Vinícius Júnior","scorerShort":"Vinícius","club":"Bayern München",
 "goals":[{"opp":"Atlético Madrid","home":true,"comp":"Champions League","round":"Final","score":"3-0","minute":70}]}
```

- `home`: true when his club is at home.
- `score`: the final score from his club's side. It is shown as the score after this goal, so the scoreboard reads 2-0, then 3-0 as the goal goes in.

Optional fields:

- per goal: `"kind"`, one of `run_in`, `header`, `long_range`, `tap_in` or `penalty`. Without it, each goal gets a different open-play finish. A goal is never a penalty unless you ask for one.
- `"kits": {"Club": {"home": {"shirt":"#hex","trim":"#hex"}, "away": {...}}}`: these kits override all others. Trim is drawn as the shorts.
- `"liveAngle"`: default `high`, the spider-cam behind the scorer. It reads best upright. The others are `tv`, `fan`, `side`, `net` and `tight`.
- `"replayAngle"`: default `net`, behind the goal.
- `"replay": false` leaves out the slow replay. `"replayRate"` sets its speed (default 0.5).
- `"look": "2d"` draws the game's top-down goal videos.

## How it works

`page.ts` is bundled with esbuild into one browser script. No Next server is used.
`make_reel.cjs` serves the bundle and `public/` (sprite atlases and sounds) from a local HTTP server. Headless Chromium then draws every frame.

The page builds each goal in four steps:

1. `lib/star/goalClip/synth.ts` `synthTrack` makes the goal. This is the same path the social feed uses for goals from matches you did not play.
2. The goals are cut into one broadcast-style `Edit`: each goal live, then a slow replay.
3. The game's `drawEditFrame` draws each frame, with its 3D figures, stadium, score bug, GOAL banner, REPLAY tag and wipe. The page adds its own caption box on top: competition, round and opponent.
4. The game's own `planAudio` and `mixAudio` make the sound: crowd, kicks, net and commentary.

Nothing in `lib/` is edited.

## Kits for clubs

A club's kit is chosen in this order:

1. `kits` in GOALS.json.
2. The game's own kit for that exact name (`lib/star/kits.ts`, which includes the club-sheet kits).
3. The game's own kit under the game's spelling of the name, for example "Bayern München" is filed as "FC Bayern München".
4. This tool's table of club colours (`FOREIGN` in `page.ts`).
5. The game's neutral green, with a warning.

The log prints where each club's kit came from. Stripes are drawn as one plain colour.
If both sides wear the same home shirt, the opponent changes to its away kit. That rule is in `synth.ts`.

## Limits

- No name or number on the shirts. The game's figures do not draw any.
- The scorer's name appears only in the game's GOAL banner.
- The score bug shows the game's 3-letter codes, for example BMN, ATL, DOR and LEI.
- The commentary lines are generic recorded lines. One replay line ("What a game this has been") assumes all the goals come from one match.
- The goals are invented moves, not real ones. The same input always gives the same video.

Set `REEL_DEBUG=1` to log every sound file that loads and every 404.
