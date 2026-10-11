# Gameplay round 15 — camera, score mismatch, tournament (job "camera")

Branch: `worktree-agent-a1e84c0b115c72cf6`. Switch: Settings → Look → Gameplay →
**Match camera: New | Old** (`actionCamera` in `lib/star/gameplayVersion.ts`,
default New).

## A. Camera round 3 — less empty grass

Harry, 11 Oct 2026: *"camera view shows a huge area of the pitch where no one's at"*.

### Reference

There is no published statistic for "how much of the picture is empty grass".
The references used, and where they come from:

- A phone match canvas is about twice as tall as wide (366 × 686–744 px on a
  390 × 844 phone, measured in the game). Any camera wide enough for one
  straggler is therefore twice as tall, and the height is grass.
- TV and console football keep the camera on the ball and the players near it,
  not on every player on the pitch (watched, not measured): a man 25 m away
  from the ball is routinely off the picture.
- A penalty is the taker, the ball and the keeper; the others wait outside the
  box (Laws of the Game, Law 14).

So the target is: the men the chance is about always wholly on screen; nobody
cut in half by an edge; as little grass below the lowest man as that allows.

### The rule (what New promises, `framingPromise` / `framingFaults`)

- **The action** (`actionOf`): the ball, you, the man the pass is for,
  team-mates within 15 m of the ball, defenders within 9 m of the ball, marking
  one of those team-mates, or goal-side in the lane to the posts; plus the
  keeper and both posts. Always on the glass (tilt included).
- **Everyone else**: wholly on (his centre 3.5% of a screen width inside an
  edge; a drawn figure is about 6% of a screen width across at any zoom) or
  clearly off (4% outside). Never cut in half. The first version used 1.5% and
  a real-game still showed a man sliced by the right edge; fixed.
- **Build-up / midfield pass**: the action is the passers (`passersOf`).

Every candidate camera (today's, the zoom, the glass fit, the action fit) is
held to the rule and the tightest that keeps it wins. When none does, it may
pull back a little past today's camera (at most to the widest camera) rather
than cut the action.

### The 4 steps from the plan

1. `chanceFraming`, `cameraTilt`, `emptyGrass` rewritten to the rule, each run
   for both Old and New.
2. **Why `deadBallFraming` failed on the cutback check (74 of 120 flat):** not a
   fault. The check asks for EVERY defender and runner inside the camera. New
   frames the action and lets a man away from it fall clearly off the screen.
   Measured on those drawn cutbacks: the men left off are 80% defenders, 20%
   team-mates, 19–26 m from the ball (median 24 m). The check now holds New to
   its own rule: 0 of 120 flat, 0 of 120 at 20°; Old keeps the old check (0/120).
3. `passersFit` connected for build-ups. Two limits added so it cannot bring
   back old playtest bugs: the top edge stays the engine's out line (a forward
   ball never leaves the top of the screen while in play, and no out line sits
   in the visible grass), and a stray pass leaves a SIDE of the screen at most
   4 m before it is out (measured: median 2.3 m, worst 4.0 m, 900 chances).
4. Stills and drag: see below.

### Numbers (node, 150 drawn chances a kind, 390 px phone, 20°, upright)

Empty grass below the lowest man on the glass (`tests/star/emptyGrass.mts` §6):

| kind | Old | New |
|---|---|---|
| one-on-one | 31% | 26% |
| long range | 32% | 19% |
| cutback | 48% | 40% |
| through ball | 37% | 20% |
| tight angle | 56% | 53% |
| free kick | 24% | 19% |
| penalty | 55% | 22% |
| volley | 42% | 39% |
| midfield pass | 34% | 28% |
| build-up | 29% | 19% |
| **average** | **39%** | **28%** |

New is never emptier than Old on any kind. Cutbacks and tight angles stay
39–52% upright: as the plan said, side-on (Wide chances: New) is the answer
there (16–27% side-on, already measured), and that is Harry's call.

Mean zoom with New (`chanceFraming.mts`, 40 a kind, flat and 20°): penalty
2.38, free kick 2.01, one-on-one 1.80, long range 1.78, volley 1.77, header
1.72, through ball 1.40, midfield pass 1.29, cutback 1.28, tight angle 1.25,
build-up 1.12. New may pull back up to 1.45× past today's camera when that is
the only way to keep the action whole (a tilted corner).

**Old is exactly today:** 0 of 21,060 framings differ from `main`'s
matchView.ts (3 zoom settings × 13 kinds × 60 chances × 3 tilts × 3 phone
shapes; camera, play area and zoom compared).

### Drag power

The drag is read in screen pixels against a fixed reference height
(`screenPull`), never in pitch metres, so the camera cannot change it.
Measured in the real game: see "Stills".

## B. The score mismatch (bug fix, no switch)

Seen 3 times: stats screen France 3-0, scoreboard France 2-0 (intl2 playtest
stills b-06/b-07).

**Cause** (`CanvasMatch.tsx` startSimulation): a free kick or penalty you do
not take is handed to the taker and the match runs on. The loop did
`step = advanceUntilInvolved(...)` and kept only the LAST run's lines. Every
line from the runs before a handed-over set piece was dropped — goals too. The
score (the simulation's own count) still had them; the scoreboard counts goal
LINES. It looked tied to being taken off late only because the bot that saw it
was never the set-piece taker (every handed-over set piece is a chance to drop
lines), and that bot's bad afternoons got it hooked.

**Fix:** `lib/star/stretchRun.ts` `runStretch` keeps every run's lines in the
order they happened. **Test:** `tests/star/stretchScore.mts` plays 1,500 whole
matches as a non-taker who is hooked late: the old loop leaves the scoreboard
short of the score in 88 of 1,500 (5.9%); the new one in 0.

## C. International tournament on screen

See "Tournament playthrough" below.
