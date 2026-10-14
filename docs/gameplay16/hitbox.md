# Hitboxes & jumping (Leo, 14 Oct 2026)

> "A BIG problem in the game has always been hitboxes are too high, so it's
> really hard to chip the ball over defenders or the goalie or even to shoot
> sometimes over a teammate's head … I want jumping to actually affect the
> hitbox … I don't want crosses and headers and blocks to be worse."

Switch: **Hitboxes & jumping (Leo)** — `hitboxes` in `lib/star/gameplayVersion.ts`
and `lib/star/lookRows.ts`. Default **New**. Old is the engine from before
(fingerprint `7bae47a8`, `tests/star/hitbox.mts`). Shown on the test pages only
(Infinite Highlights, Infinite Match), not in Settings.

Code: `lib/star/hitbox.ts` (the shape, the jump, the dials),
`lib/star/canvasEngine.ts` (where the engine uses them),
`components/star/HitboxPanel.tsx` (the test panel),
`components/star/CanvasMatch.tsx` (drawing the hitboxes and the jumps).

## Real reference numbers

| What | Real | Source |
|---|---|---|
| Height of a man, top of head | 1.80–1.85 m (Premier League mean ≈ 1.82 m) | Squad listings (e.g. Premier League player profiles); `standHeight` = 1.85 |
| Standing reach of the head | ≈ 1.85 m (arms do not count for an outfield player: handball) | Laws of the Game, Law 12 |
| Jumping header contact | 2.3–2.6 m (feet 0.4–0.6 m off the ground) | Sports-science vertical-jump data for footballers: counter-movement jump 40–55 cm |
| Leg stretch sideways for a block | ≈ 0.9 m at low height | Leg length ≈ 0.9–1.0 m |
| Keeper reach, standing, arms up | ≈ 2.4–2.5 m | Height 1.90 m + arm |
| Keeper reach, jumping | ≈ 2.9–3.1 m | As above + 0.5 m jump |
| Ball radius | 0.11 m | Law 2 (size 5, 68–70 cm round) |

The game keeps the ball's centre, so a ball touches the top of a standing man's
head with its centre at 1.85 + 0.11 = **1.96 m**.

## What changed (New)

1. **A man is the shape of a man.** His reach is widest at his feet, 65% of
   that at his chest, 45% at his head, and **nothing above his head** — unless
   he is in the air. Old: a tall cylinder (defenders 0.95–1.15 m wide all the
   way up to 1.9 m; team-mates took any ball within 2 m below 2.6 m).
2. **Jumping is physical.** A man leaves the ground (0.5 m, a real jump arc)
   when a ball he is going for is about to pass above his standing reach. His
   reach rises and falls with the jump, and the picture draws him in the air at
   the same height. Who jumps: a team-mate for a ball played to him; a defender
   for a ball coming DOWN on him (a cross, a long ball). Nobody jumps for a shot;
   nobody jumps for a chip still rising past him from close in. The free-kick
   wall keeps its own jump.
3. **The "cheats" (special situations).**
   - Header bonus 0.3 m (up and out) for a team-mate attacking a ball played to him.
   - Block bonus 0.2 m for a defender in a shot's path, full up to his chest,
     gone by his head (a leg or a body thrown at it).
   - A slow ball (under 10 m/s, blending to 16 m/s) he can step under: full
     reach up to his head. Only a ball going past quicker than he can move meets
     the narrow shape.
4. **Over a team-mate's head.** A ball struck at shot pace (over 18 m/s) that is
   still rising as it passes over a team-mate is a shot over him, not a ball to
   him. A ball in the air that comes down to head height clearly nearer another
   team-mate is not his to take.
5. **Over a keeper.** Above his standing reach (2.45 m) height costs him 0.9×
   more, so a chip over a keeper off his line has a real chance. Under the bar
   nothing changes.

Not changed: the free-kick wall, the keeper's body (0.75 m up to 2.5 m), the
poacher's tap-in, the loose-ball 50-50.

## Before → after (measured, `npx tsx tests/star/hitboxReport.ts`, `STAR_HITBOX=new` for New)

### Chip over a defender — the lowest ball-centre height that gets by (m)

Ball from 12 m/s (a chip) and 22 m/s (a driven ball), defender 3 / 6 / 9 m away,
standing on the line or 0.5 / 0.9 m to the side. He steps towards the ball as in
a real match.

| 12 m/s chip | on him | 0.5 m off | 0.9 m off |
|---|---|---|---|
| 3 m away | 2.77 → **2.41** | 2.51 → **2.16** | 2.36 → **1.60** |
| 6 m away | 2.18 → **2.18** | 2.18 → **2.08** | 2.13 → **1.62** |
| 9 m away | 1.83 → **1.83** | 1.83 → **1.78** | 1.83 → **1.41** |

| 22 m/s drive | on him | 0.5 m off | 0.9 m off |
|---|---|---|---|
| 3 m away | 2.56 → **2.31** | 2.56 → **2.16** | (0.29) → 1.10 |
| 6 m away | 2.21 → **2.16** | 2.21 → **1.95** | 2.11 → **1.34** |
| 9 m away | 2.15 → **2.15** | 2.10 → **1.89** | 2.04 → **1.38** |

Straight over his head it still needs about 2 m (he is 1.85 m tall, and he leans
into a ball coming at him). To the side it is 0.4–0.8 m lower. (The Old 0.29 at
3 m / 0.9 m off is a fast ball skipping between two frames past the cylinder
edge.)

### Over a team-mate's head (1,000 each)

| | Old | New |
|---|---|---|
| Lofted shot (passes him at 1.6–2.8 m): he takes it | **74.4%** | **31.7%** (the rest pass him at head height, 1.6–1.96 m) |
| Chip over him to the man 10 m behind: he takes it | **100%** | **41.3%** |

### Crosses, headers, blocks — not worse

| | Old | New |
|---|---|---|
| Byline crosses: reach their man | 84.9% | **88.5%** |
| Byline crosses: a defender cuts it out | 15.1% | **11.5%** |
| Byline crosses: scored | 42.6% | **44.3%** |
| Corners: reach their man / scored | 77.3% / 28.6% | 77.4% / 27.8% |
| A cross onto his head (1.4–2.8 m): reaches him | 90.7% | **92.5%** |
| …won in the air above a standing man's head (only a jump reaches it) | 0 | **25%** of crosses |
| …scored | 42.9% | 41.3% (−1.6 pts; 4,000 runs: 43.8% → 41.9%) |
| Shots blocked, long range drive / lofted / cutback | 29.3 / 37.0 / 8.3% | 26.3 / 41.7 / 9.9% (mean 24.9 → 26.0%) |
| One-on-one blocked | 3.2% | 2.6% |

### Keeper off his line (3 m), lowest height a chip clears

| Keeper | Old | New | Real |
|---|---|---|---|
| 90 | 3.30 m | **2.92 m** | 2.9–3.1 m jumping |
| 30 | 2.76 m | 2.76 m | ≈ 2.7 m |

## Tests

- `tests/star/hitbox.mts` (permanent, 12 s): Old fingerprint, the shape, and
  every before → after above with a bar.
- Match tests run Old by default (like ball physics). With `STAR_HITBOX=new`:
  finishing, aiming, keeperDive/OneDive/Human, headersVolleys, support pass;
  `outcomes.mts` "both still happen" sees 0 settling balls (Old: 2 in ~3,000 —
  a rare event, not a regression we could pin); keeperBrain and keeperPro fail
  the same way with Old as with New (they fail on main in this checkout).

## Open

- Header conversion is 1.6–1.9 pts lower in New though more headers are won.
  Tried: header bonus 0–0.45, block bonus 0–0.4, keeper change off — none
  closes it. The losses are mostly "saved" on balls won high (2.0–2.8 m).
- The 3D match view does not draw the jump or the hitboxes (2D canvas only).
