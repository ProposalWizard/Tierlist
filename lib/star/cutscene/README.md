# The cut-scene system

Every cut scene is DATA (a script) played by one director. A script can be
written by hand, or GENERATED from a game event.

```
StoryEvent ─ story.ts ─▶ beats ─ beats.ts + generate.ts ─▶ performance tracks ─┐
                          └─ shot intents ─ cinema.ts ─▶ camera tracks ────────┴▶ CutsceneScript ─ director.ts ─▶ pictures from t
```

| File | What it is |
|------|-----------|
| `types.ts` | The script format, story events, and the PEOPLE LAYER's interface (`CutsceneActor`). |
| `timeline.ts` | A script read at time t, no three.js, no memory: clips and weights, where people stand, the shot, letterbox, fades, captions. `lintScript` finds mistakes. |
| `director.ts` | Plays a script in three.js in any art style: poses actors, props follow hands, effects, camera, lights. `seek(t)`, `frameSeek(t)`, `window.__frameStep`. |
| `beats.ts` | The beat library: sit and talk, the contract, sign with the pen, handshake, shirt photo, strike, celebration, trophy, tunnel, walk-out, press, mentor, bad news, award, applause, injury, stare-down. Each gives tracks + shot intents. |
| `story.ts` | Event → place, mood, cast, beats (acts setup → build → moment → reaction → aftermath, chosen by weight with a seed). |
| `cinema.ts` | Shot intents → shots by film rules (open on the place, wide → close as feeling rises, 180° line, reaction after the moment, hero low / defeat high, no jump cuts, length by stakes). `shotQuality` scores a script against these rules. |
| `cinema.ts` → `filmPass` | Settings → Look → "Cut-scene camera: New": a second pass over any script (wide first, over-the-shoulder talk, weak moves hidden behind faces and props, every shot moving, cuts on action). Move quality tags live in `presets/clips.ts`. Old = the script as written. |
| `music.ts` | The music bed per scene (`public/sfx/cut-music-*.mp3`, made by `tools/cutscene-music/make_beds.py`): fades, ducks under talk, on the Sound Board. |
| `generate.ts` | `generateScript(event, seed)`; `compose()` lays beats end to end. |
| `fixtures.ts` | The hand-made scenes (signing, goal, trophy, walk-out, press, The Icon) = test benchmarks. |
| `presets/` | camera shots, locations (marks), moods, clip names and stand-ins. |
| `locations3d.ts` / `props3d.ts` / `fx3d.ts` / `perform3d.ts` | Sets, props, effects, procedural body holds. |
| `peopleStub.ts` / `peopleAdapter.ts` | Today's people layer (on people3d). When `people.ts` lands, change the one line in `peopleAdapter.ts`. |
| `signature.ts` | A signature from a name: the strokes the pen really follows. |

## Writing a scene by hand

```ts
const c = compose([officeSeated, signContract], ev, ids, "office", seed, 0.4, { cast, props });
const script = { ...c, set: { location: "office", mood: "golden-hour" }, tracks: [...c.tracks, ...myCameraTracks, ...frameTracks(c.duration, 0.7)] };
```

## Adding an event kind

1. Add it to `EventKind` (types.ts).
2. Give it a story in `story.ts` (place, other person, acts listing beats).
3. If no beat fits, write one in `beats.ts` (tracks + shot intents) and add it to `BEATS`.
4. Add it to `EVENT_KINDS_COVERED`; `tests/star/cutscene.mts` then checks it.

## Checking by eye

- `node scripts/cutscene/stills.mjs "<url>" <prefix> 1.5 4 8 --sheet` — stills and a contact sheet.
- `node scripts/film/frames3d.mjs "<url>" --out DIR` then `python3 scripts/film/frames3d_encode.py DIR out.mp4` — frame by frame.
- `node scripts/cutscene/probe.mjs "<url>" 3.2` — camera and where each head lands on screen.
- `npx tsx scripts/cutscene/shots.mts signing` / `… scored 0.8 joy 3` — the shot list and its film-rules score.

URLs: `/star-style-dev?scene=director&fixture=signing&clean=1` or `?scene=director&event=scored&stakes=0.8&emotion=joy&seed=3&clean=1`.
