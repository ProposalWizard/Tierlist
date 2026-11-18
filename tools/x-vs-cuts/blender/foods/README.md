# Foods: cut anything, not just the avocado

The cutting (knife, sync checks, lines, cubes, pile, counters, sound, 72 s timeline)
is the same for every food. A food is one small Python file here that says what the
thing looks like. The avocado is built into `cuts2.py`; every other food is
`foods/<name>.py`.

    python render_all.py --blender "<Blender 4.1>" --food apple --test   # round 1 only
    python render_all.py --blender "<Blender 4.1>" --food apple          # full 72 s

Output goes to `out_<name>/<name>_full.mp4` (the avocado keeps `out/avocado_full.mp4`).

## What a food file can set

Coordinates: X across the board (length `L`), Y depth (front = -Y), Z up. Every
slice across X is an ellipse: half-width `rad(x)`, half-height `rad(x)*EH`, centred
at height `CZ_A*rad(x)+CZ_B`. The food must fit that (round, oval, pear, egg,
lemon, potato, tomato... yes; a banana curve or a pepper's hollow inside, no).

| name | what it is |
|---|---|
| `L, RM, EH` | length, biggest half-width, height/width ratio |
| `rad(x)` | half-width at x (0 outside -L/2..L/2) |
| `CZ_A, CZ_B` | centre height of each slice. Avocado: rests flat. Round fruit: `0, ~0.97*RM*EH` |
| `STONE` | the inside core `(cx,cy,cz,rx,ry,rz)`: stone, apple core, seeds... |
| `YAW` | turn on the board (radians) |
| `LOOK.update(...)` | colours: `ramp` (flesh by depth under the skin), `core`, `core_ring`, `skin_out`, `skin_dark`/`skin_light`, `pores`, `bump`, `rough`, `coat`, `line_skin`, `line_face`, `pile`/`glow` (cube pile per round 2-6) |
| `LOOK` tuning | `tip` (how far slices tip in round 1; lower for wide slices), `pile_floor` (raise the mound if pieces dip into the board) |
| `EXTRAS(rig)` | extra parts such as a stem; return the objects; they vanish when dicing starts |

Start from `apple.py`. Then, before any full render:

1. Build and check every round with the food set (`XCUTS_FOOD=<name>`):
   `blender -b --factory-startup --python cuts2.py -- build` / `-- check`, and
   `cuts3.py -- build <1..5>` / `-- check <1..5>`. All must say CHECK PASS.
2. Look at stills (`cuts2.py -- still 0 72 130 165`, `cuts3.py -- still 4 1320 1440 1580 1690`).
3. `render_all.py --food <name> --test`, watch it, then the full run.

The avocado must stay pixel-identical: new settings go in `LOOK` with a default
that does nothing (for example `LOOK.get('tip',1.0)`).
