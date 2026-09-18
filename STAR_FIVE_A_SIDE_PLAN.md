# The Five-a-Side — Plan (v1)

> **Status: PLAN ONLY. Nothing here is built.** Written 18 Sep 2026, against the
> real files, after reading `STAR_CAREER_OPENING_AND_ECONOMY.md`
> §3.2/§3.5/§9/§9a/§10/§11, `CLAUDE.md`, and the engine, match, lineup,
> formation, rule-book, trial and career-flow sources in full.
>
> Governing rule, unchanged from the opening plan: **we add, we never change.**
> No engine constant, physics function or existing scenario behaviour is retuned
> here. Where something in §3.5 turned out to be wrong when checked against the
> code, it is said plainly in §1.
>
> **Provenance:** planned by Fable, then spot-checked line by line against the
> working tree before being committed. Every number in §2 was re-read from
> `canvasEngine.ts`/`pitch.ts` and confirmed, including the derived ones (the
> 26.25 × 42 frame, the corner frame's real bounds, and the 29.1 m drag floor).
> `squadSize`'s own doc comment was read and confirms §8's verdict in its own
> words.

---

## 0. In one paragraph (for everybody)

The five-a-side is a real small-sided game: you and three team-mates plus a
keeper, against four opponents plus a keeper, on a small pitch that fits
**entirely** inside the match engine's normal camera frame — which turns out to
be, to the centimetre, the frame the game already uses for a corner. Every kick
you take goes through the exact `launch()` / `stepBall()` / `stepKeeper()` the
Saturday match uses, with the same drag-to-aim gesture. What is new is a thin
layer *above* the engine that keeps the whole pitch on screen, remembers where
all ten players are between kicks so nobody teleports, decides what happens when
the other side has the ball, keeps the score and the clock, and writes the
result onto your saved career the instant the final whistle goes. It reports one
number (0–100) into the trial score, scaled by how hard the game was. It is
built as its own self-contained screen, the same way the penalty trial and the
first-person dribble already are, so it can be reused whenever a free agent is
invited to another trial.

---

## 1. §3.5 checked against the code — what was right and what was not

| §3.5 said | Checked | Verdict |
|---|---|---|
| "even the cheap version is a new scenario-sequencing component" | True — but so is the real one. The difference between the "run of chances" compromise and a real five-a-side is **not** a different engine; it is (a) one fixed frame that never changes, (b) positions persisting between kicks, (c) five a side, (d) a score and a clock. All four are additions above the engine. | Right, incompletely |
| "The rule book already carries a `squadSize` field … that's its home" | **Wrong.** `RuleBook.squadSize` (`lib/star/ruleBook.ts:57-65`) is the FA's rule for the 11-a-side competitions; `STAR_POWER_POLITICS.md:533-537` records that no safe gameplay hook for it exists. Reading it here would make a free agent's replayed trial 9- or 20-a-side if he ever voted the rule through. See §8. | Red herring |
| "a small-sided match: genuinely absent" (§2) | True. But three relevant precedents were not named: `lib/star/liveAttack.ts` + `components/star/LiveAttack.tsx` (a standalone component that runs the live engine with its own renderer, 307 + 331 lines), `lib/star/scenarios.ts` / `scenarioRender.ts` (a caller-owned camera rectangle drawn with the match's own look), and `TrialPenalty.tsx`'s "ported rather than shared" renderer. They settle the component question in §9. | Incomplete |
| §3.2: the penalty stage is "on the live engine already" | True, and worth knowing for §7: `TrialPenalty.tsx:121` seeds its rng from `Date.now() & 0xffff` (unseeded, unstored), hard-codes keeper strength 52 (`:157`) and shooter 62/62 (`:226`). None of §3.3's seeding rule exists yet anywhere — it is step 5's job, and this plan assumes step 5 creates the `career.trial` object it hangs off (§7). | Right |

---

## 2. Pitch and geometry (Question 1)

### 2.1 What the engine actually fixes, and where

The engine's coordinate system is `lib/star/pitch.ts`: `PITCH_W = 68` (:21),
`HALF_LEN = 52.5` (:23), `CX = 34` (:25), `GOAL_W = 7.32` (:28),
`GOAL_H = 2.44` (:30), `POST_L = 30.34` / `POST_R = 37.66` (:32-33),
`NET_DEPTH = 1.2` (:45), `SIX_DEPTH = 5.5` (:48), `BOX_DEPTH = 16.5` (:53),
`PEN_SPOT_Y = 11` (:58). The attacking goal is always the line `y = 0`; the ball
must cross it between `POST_L..POST_R` (`insideGoalMouth`, :69-71) under
`scenario.crossbar`.

The camera is **not** the pitch. `canvasEngine.ts:926` `VIEW_ASPECT = 5/8`,
`:940` `VIEW_H = 42`, and `:941/:946` pin min and max to the same 42 — "a
tactics board does not zoom". So every situation is a **26.25 m × 42 m**
rectangle (`42 × 5/8 = 26.25`). Crucially, the engine treats the frame as the
world: a ball more than 1 m outside `scenario.viewport` is `"out"`
(`stepBallRaw`, :5776-5779) and nobody reacts to it there (`stepReactions`,
:4595-4597).

`Scenario.viewport` (:450) is a plain field on the scenario. `buildScenario`
fills it (:2418) but **any caller may set it**: `CanvasMatch.tsx:2771` already
overwrites `sc.viewport` mid-move when a cross cuts to the box view. Setting our
own rectangle is therefore not an engine change.

### 2.2 The five-a-side frame is the corner's frame

`WIDE_DELIVERY_VIEW` (`canvasEngine.ts:955-959`) is
`{ x1: CX − 13.125 = 20.875, x2: 47.125, y1: −4.5, y2: 37.5 }` — the fixed
rectangle every corner and byline cross is played in: goal across the top, net
visible, 42 m deep. A five-a-side pitch of **24 m × 36 m** (x 22..46, y 0..36)
sits inside it with 1.125 m of grass either side, 1.5 m behind your own goal
line, and the far net fully in shot. (FA recommended five-a-side is up to
36.5 × 27.4 m; futsal is 25–42 × 16–25 m. 24 × 36 is squarely small-sided.)

That constant is private, but the same numbers are exposed on every corner
scenario as `sc.crossSwitchView` (:2413), so a test can pin our frame to the
engine's own corner frame rather than to a copied number.

**Nothing else needs parameterising.** The engine's per-frame limits that matter
are all read off `scenario.viewport`: the out-of-play band (:5776), reaction
band (:4595), support-placement bounds (:2658-2669), and the first-touch clamp
(:3756-3759). The pitch-wide fallbacks (`ball.pos.x < −2 || > PITCH_W + 2 ||
y > HALF_LEN + 8`, :5779) are all outside our frame and never fire first.

### 2.3 What is genuinely hard-wired, and the honest choices

1. **Goal width.** `stepBallRaw`'s goal-line test (:5736-5760) and
   `headedForGoal` (:4812-4823) call `insideGoalMouth`/`hitsPost` from
   `pitch.ts` — fixed at 7.32 m. `Scenario.goal` (:415) exists but is only read
   by `isDriveAtGoal` (:4552) and the keeper's shading target (:5591). The
   keeper's whole save model (`KEEPER_SAVE_R_MIN 1.95 / MAX 2.65`, :695-696;
   `keeperAttempt`, :4927) is tuned to that goal. **Recommendation: keep the
   full-size 7.32 × 2.44 goal.** A narrower goal would need a new optional
   `Scenario.goalMouth` read by those two functions with a default of
   `POST_L/POST_R` — three lines, behaviour-identical for every existing caller
   — but it would put the tuned keeper in front of an untuned goal. Open
   question 1.
2. **Crossbar** is already per-scenario (`scenario.crossbar`, :416, :5740).
   Leave at 2.44 for the same reason.
3. **The bottom-fifth drag rule.** `fitToView` keeps the ball out of the bottom
   20 % of the frame so you can drag back (:1264-1272):
   floor = `37.5 − 8.4 = 29.1`. `fitToView` is private and only runs inside
   `buildScenario`, so **our passage builder must apply the same rule itself**:
   every passage you take starts with `ball.y ≤ 29` (engine frame). In football
   terms: your keeper rolls it out to you at least ~7 m off your own line, never
   on it. Cheap and natural.
4. **Touchlines.** The engine only calls "out" at the frame edge, 1.125 m beyond
   our touchline. The sequencing layer's flight loop checks
   `insideFivePitch(ball.pos)` after each `stepBall` that returned `null`, and
   resolves `"out"` itself — one extra `if` in *our* loop, nothing in the engine.
5. **Markings.** `CanvasMatch.tsx:1638-1672` draws the IFAB 11-a-side markings
   from the pitch constants. A five-a-side pitch needs its own (D-shaped areas,
   no halfway circle) — a rendering job for the new component (§9), not an
   engine one.

### 2.4 Mirroring (used in stage 6 only)

The engine only knows "you attack `y = 0`". For an opponent attack decided by
the real engine, world → engine is `mirror(p) = { x: 2·CX − p.x, y: 36 − p.y }`
(an involution: applying it twice is identity — testable). The engine never sees
the world frame; the renderer draws the world. This keeps the engine untouched.

---

## 3. Reduced squads (Question 2)

### 3.1 The engine's figures, and which of them carry over

A `Scenario` (`canvasEngine.ts:408-548`) is plain data. Its people are: `player`
(you, `Vec2`), `defenders: Defender[]` (:366-406 — `Vec2` plus AI fields
`initDefenders` fills in), one `keeper: Keeper` (:155-213), one `follower` (the
poacher, :272-292), `runner: Runner | null` and `secondaryRunners: Runner[]`
(:298-332), decorative `teammates` (:427), and an optional `receiver`
(:346-357). Every one of these is a type the engine exports; every constructor
the private builders use is trivial to reproduce (`makeKeeper` :883-903 is
fifteen plain fields; `makeRunner` :905; `makeFollower` :910).

**Five-a-side cast, your attack (engine frame):**

| Side | Engine slot | Count | Why |
|---|---|---|---|
| You | `sc.player` | 1 | the striker of the passage |
| Team-mates | `sc.secondaryRunners` (role `"support"`) | 2 | receive passes; step out of shots; shoot on reception in goal-in-view kinds (:5642-5665) |
| Team-mate 3 | `sc.follower` | 1 | the man nearest goal; a reception candidate (:5489-5505) and the rebound poacher (:4684-4704) — drawn and named like any team-mate (`CanvasMatch.tsx:2083-2090`) |
| Your keeper | `sc.teammates[0]` (decorative) | 1 | never a pass target; drawn only. **Cast identities ourselves** (§3.3), never via `castScenario`, because that function makes `teammates[0]` the `crosser` and `creatorOf` would then credit your keeper with assists (`lineup.ts:167-171, :316`) |
| Opponents | `sc.defenders` | 4 | press/cover/intercept, block, tackle, win 50-50s (:5387-5448) |
| Their keeper | `sc.keeper` | 1 | the real save model |

Totals: 5 v 5, exactly.

### 3.2 What carries over unchanged

- `initDefenders(sc, rng)` (:4190-4211): nearest man presses, the rest cover,
  per-man speed jitter. Call it per passage as `loadScenario` does
  (`CanvasMatch.tsx:3884`).
- `stepReactions` (:4582-4716): everybody reacts to a ball inside `REACT_R = 9` m
  at `REACT_SPEED = 2.6` m/s, walks to a dead ball, the follower pokes in a
  rebound. On a 24 × 36 pitch almost everybody is inside 9 m of almost
  everything — that is the five-a-side feel, and it comes for free.
- `stepDefenders` (:4227-4251) — free-kick walls only; harmless to call.
- `stepKeeper` (:4101-4150), `keeperAttempt`, `resolveKeeper`, `settleBall`,
  `stepBallInNet`, `stepBallPastBar` — as any match.
- `defenderReachMultiplier(d.who?.defending ?? d.who?.overall)` (:807, read at
  :5395) and the receiver's finishing from `r.who.shooting ?? r.who.overall`
  (:5576-5579): **opponent and team-mate quality are already real engine inputs
  via `Identity`**. This is the additive difficulty dial (§6).
- `orderDefensively` (`lineup.ts:260-265`) for choosing which four real men
  defend when a real roster exists (stage 4+).

### 3.3 What is genuinely new

- **`buildPassage(world, opts): Scenario`** in `lib/star/fiveASide/passage.ts` —
  constructs the scenario literal directly from persisted world positions (no
  `buildScenario`, so no `fitToView`/`addCover`/`addSupport` reshuffle). It must
  itself enforce the three placement invariants `buildScenario` enforces
  privately: nobody within `CLEAR_OF_BALL = 1.8` m of the ball (:1373-1394), the
  keeper at least `KEEPER_BODY_R + 1.6 = 2.35` m off it and within
  `POST_L − 2.5 .. POST_R + 2.5` (:884, :1409-1421), and you beside the ball not
  on it (`STANDOFF_SIDE = 1.3`, :1503). Tests pin all three.
- **`castSides(...)`** — puts five `Identity`s on each side directly
  (`who` on runners, follower, defenders, keeper, and the decorative keeper).
  `castScenario`/`castDefence` assume an 11-man pool shaped by position
  preference; a five-man side is explicit and needs no heuristic.
- **Your keeper** as a real engine `Keeper` only in the mirrored opponent
  passage (§4.4); otherwise decorative.
- **No `formations.ts`.** Its 31 shapes are eleven slots on a 0–1 fraction grid
  (`FORMATIONS`, :95-277). A five-a-side has one shape (diamond or square) in
  real metres; `autoPick` (:359) is greedy-by-slot and would work on a 5-slot
  formation, but the whole "pick an XI" machinery (`teamsheet.ts:858-871`
  refuses a sheet under nine men) is 11-a-side to the bone. Two hand-written
  5-slot shapes in the new module, nothing more.

---

## 4. Continuous play (Question 3)

### 4.1 What the engine is

One passage = one strike by you and its consequences. `launch` (:3978) makes a
`Ball`; `stepBall` (:5245) returns an `Outcome` (:550-574) when the passage ends;
the component then decides what to load next. There is no engine concept of "the
next kick from where the ball now is". The one thing that continues a scenario
in place is `resetForTouchOn` (:2880-2894), which repositions the **same** object
at a new ball position.

The existing chain machinery is the wrong tool for continuity: `chainKindFor`
(:2908) picks a *new kind*, `buildScenario` builds a *new picture* with its own
random placement, and `CHAIN_MAX = 2` (:2826) caps it at two links. Its own doc
says why that is a bug for a continuing move (:2850-2879, quoting the live
report). A five-a-side needs the opposite: same frame, same men, same places.

### 4.2 The three options, honestly

| | (a) Chain scenarios with `CHAIN_MAX` | (b) A sequencing layer that builds each passage from persisted positions | (c) Rewrite the engine as continuous |
|---|---|---|---|
| Frame | changes per kind | **fixed, whole pitch** | fixed |
| Positions | re-rolled | **carried over** | carried |
| Engine edits | none | **none** | many — forbidden |
| Cap | 2 links | none — the clock ends it | none |
| Opponent possession | not modelled | modelled by the layer | modelled |
| Verdict | the "run of chances" the user rejected | **pick this** | violates the rule |

**Decision: (b).** The layer is `lib/star/fiveASide/match.ts` — a pure reducer
over a `FiveASideState` (world positions in pitch metres, score, clock,
possession, restart type, rng stream). Each of your touches is one engine
passage; between passages the layer moves the world a small, plausible amount (a
give-and-go returns the ball to you; a save hands it to their keeper; a
clearance lands somewhere), and the renderer tweens figures to their new spots
over ~0.6 s so nothing jumps. Inside a passage, nobody moves until you kick —
exactly the engine's own rule (:4560-4562), so this reads as the game, not as a
different game.

### 4.3 The one engine rule that shapes passage choice

"If the goal is on screen, whoever you find shoots" (:1593-1600; enforced at
:5642-5665 after a 0.45 s control, `RECEIVER_CONTROL_T` :2946).
`goalInView(kind)` (:1552-1554) is keyed purely off `kind`. So the layer picks
the passage's `kind` by ball depth, exactly as `kindsForZone`
(`hiddenMatch.ts:276-289`) does for the big match:

- ball `y ≤ 18` (attacking half): `"one_on_one"` / `"tight_angle"` /
  `"long_range"` — a pass to a team-mate is a lay-off and he shoots; the poacher
  is live; the keeper shades (:5589-5593).
- ball `y > 18`: `"midfield_pass"` / `"buildup"` — a completed pass is
  `"delivered"` (:5671) and the layer continues the move. The keeper is still
  simulated (his line test :5688 and the goal-line test :5736 are **not** gated
  on `goalInView`), so a long shot can still go in; only the poacher-as-receiver,
  keeper shading, and `headedForGoal`'s "blocked" wording (:4816) switch off,
  which is cosmetic.

`kind` also feeds `setPieceSkills` (free-kick rating for dead balls — kick-ins
use `"midfield_pass"`, not `"free_kick"`, so ordinary technique applies) and
`initDefenders`' dead-ball hold (only penalty/free kick/corner — never ours).

### 4.4 The opponent's possession — two stages

- **Stage 3 (first shippable):** an abstract beat, the same abstraction the whole
  game already uses for the minutes you are not on the ball (`hiddenMatch.ts`). A
  small seeded roll off their quality vs your keeper's and your defenders'
  (`resolvePenalties`'s bounded-edge shape, `ruleBook.ts:139-142`, is the right
  idiom): goal / saved / turnover, with a landing spot; the figures tween; a line
  of text. `hiddenMatch.tick` itself is **not** reusable — it is per-minute with
  `CHANCE_BOX = 0.55` (:178) tuned for ninety minutes; a six-minute five-a-side
  at those rates yields one or two chances.
- **Stage 6 (the real thing):** decide their attack with the **real engine,
  headless**: build a mirrored passage (their striker as `sc.player`, your four
  as `sc.defenders`, your keeper as `sc.keeper` with his rating as
  `keeperStrength`), have an AI policy call `launch()` (the same idiom
  `tests/star/outcomes.mts:52-87` uses to play a chance "the way somebody who
  knows what they are doing would"), step to an outcome in a tight loop
  (2000 × 1/60 s, instantaneous), record the ball path and keeper travel per
  step, then **replay the recording mirrored in real time** on the world frame.
  Physics decides; the screen shows it; your keeper genuinely dives. No live
  input handling in the mirrored frame, no engine change.

### 4.5 Restarts, and the honest simplifications

- Goal → kick-off from the centre (y = 18) to the conceding side.
- Ball out over a touchline → kick-in to the side that did not touch it last
  (`ball.lastTouch`, :128). Over their goal line: goal-kick to their keeper (a
  beat) or a corner-style kick-in to you.
- Over **your** goal line going backwards (a miskick): treated as out → their
  kick-in. An own goal from your own backward miskick is **not** modelled in v1
  — say so in the HUD text ("behind for a corner") rather than pretending.
- Offside: none. `setOffsideRuleEnabled(false)` (:1093) on mount, `true` on
  unmount. It is a module-level flag; `CanvasMatch` re-sets it from the rule book
  on every mount, so restoring `true` is safe. Tested: a mirrored passage never
  returns `"offside"`.
- Head-height rule: **not** enforced (it would change how a strike feels). Open
  question 9.
- Dead-ball timeouts (`DEAD_BALL_TIMEOUT 3 s`, `DEAD_BALL_SETTLED 1.2 s`,
  :601-606) end stalled passages exactly as in a match.

---

## 5. The opponent (Question 4)

The trialist has `club: ""`, `squad: []`, `league: []` (`makeIdentity`,
`careerFlow.ts:125-232`; `hasClub`, `calendar.ts:175-177`).
`opponentStartingXI` (`teamsheet.ts:858-871`) needs a fixture and nine men;
`castDefence` needs a sheet. None applies.

**v1: everyone on the pitch is a trialist like you.** Both sides are drawn from
`generateSquad(seed)` (`squadData.ts:38-71`): twenty invented names with stable
fake faces (`fakeFaceFor`, :68), positions in a fixed template (:28-36). Take
slot 0 (GK) and four outfielders per side, seeded off the trial seed so a reload
sees the same men. Bibs vs non-bibs (`keeperKit`, `kits.ts:378`, picks a keeper
colour neither side wears — reuse for both keepers). Their
`overall`/`defending`/`shooting` are set by the difficulty roll (§6) — these are
the real engine inputs from §3.2, so the roll changes how they actually play,
not just a label.

**Free-agent replays (§3.7):** the same builder accepts a `roster?: Identity[]`
(the `FirstPersonDribble.newRun({ roster })` pattern,
`firstPersonDribble.ts:460`). Once Mikey's lower tiers are playable, feed it
`fetchLeagueSquads([club])` (`leagueSquads.ts:390-402`) for the inviting club's
real youth players, ordered by `orderDefensively`. Not needed for v1; the seam is
designed in.

---

## 6. Scoring (Question 5)

### 6.1 Difficulty (seeded, stored)

`d = clamp(trial.baseDifficulty + stageRoll.fiveASide + 0.03 × reloads, 0, 1)` —
all three on the career (§7). It sets:

- opponents' outfield `overall`/`defending`: `48 + 30·d` →
  `defenderReachMultiplier` (:807) and 50-50s;
- their keeper's `keeperStrength`: `40 + 45·d` → `keeperSaveRadius`
  (:4841-4850), the same dial `powerDrill`'s ladder already turns
  (`trainingDrills.ts:92`, 38→93);
- your team-mates' `shooting`/`passing`: fixed 55 (they are trialists too);
  `teamRelationship` fixed 55.

### 6.2 What is measured

Per passage you take, one quality `q ∈ [0,1]`, using **existing pure
functions**: shots via `shotQuality(outcome, crossX)`
(`trainingDrills.ts:325-342` — goal 0.55–1.0 by placement, saved 0.34, post
0.42, blocked 0.16, wide/over by how close); completed passes via
`0.45 + 0.55 × max(sc.passDifficulty, sc.passAmbition ?? 0)` (both set by the
engine at reception, :5598-5606); intercepted 0.12; tackled/short 0.05; out
0.08; +0.25 when a team-mate you found scores (assist). Plus the match facts:
your goals, assists, the result.

### 6.3 The number

`score = 100 × clamp( mean(q) × (0.70 + 0.60·d) + 0.05·min(goals,3) + 0.10·[win] + 0.03·[draw], 0, 1 )`

— the *shape* §3.3 asks for: the same performance scores more when it was
harder; a converted hard chance (placement × difficulty) beats a converted
tap-in; a miss costs less when it was hard. The constants are tunable and are
**tested for properties, not values**: monotone in every input, within 0–100, a
blank game (no events, lost) scores > 0 but < 20, a perfect game cannot exceed
100. Its weight against the other four stages is open question 6 (recommend
equal fifths; the ⅕ is combined by step 5's `trialScore`, not here).

---

## 7. Resume (Question 6)

Assumes step 5 adds `CareerState.trial?: TrialProgress` (seed, base difficulty,
per-stage rolls, per-stage results, `reloads`). This plan adds only optional
fields under it — no new required field, so `identity.mts`'s byte-identity guard
keeps holding.

```ts
// lib/star/types.ts — additive
interface FiveASideSnapshot {           // small; serialisable; written at every passage end
  clock: number; half: 1 | 2; score: [number, number]; possession: "you" | "them";
  world: { ball: Vec2; you: Vec2; mates: Vec2[]; yourKeeper: Vec2; opps: Vec2[]; theirKeeper: Vec2 };
  events: PassageEvent[];               // the q's of §6.2 so far
  rngDraws: number;                     // how far into the seeded stream we are
}
interface FiveASideResult { score: number; goals: number; assists: number; result: "win" | "draw" | "loss"; difficulty: number; decidedAt: number }
// on TrialProgress: fiveASide?: { inProgress?: FiveASideSnapshot; result?: FiveASideResult; reloads: number }
```

Rules, per the decisions already made:

1. **The result is written the moment the whistle goes**
   (`finishFiveASide(career, summary)` — pure, idempotent: a second call with a
   result already present returns the career unchanged). A reload after that
   resumes into the *next* stage.
2. **Mid-match, resume exactly where you were.** The snapshot is written to the
   career at every passage end (the autosave effect at `page.tsx:282-294` then
   persists it locally at once and to the cloud 3 s later). On load, the phase is
   resumed via `RESUMABLE` (`storage.ts:148-160`) and the clubless branch that
   already exists (`page.tsx:1235-1240`), and the component rebuilds a fresh
   passage from the snapshot's world. A strike in flight at the moment of
   closing is lost; a goal already decided is not.
3. **Reloading is never a free retry.** `reloads` increments on every
   resume-from-snapshot and feeds `d` (+0.03 each, capped at +0.15) — the hidden
   escalating bump the user chose over a hard block. The rng stream is rebuilt
   from the seed and `rngDraws`, so the next passage's random content is what it
   would have been anyway.
4. The trial occupies its slot from the start (already true: `listSaveSlots`
   reports "No club yet", `storage.ts:426-449`).

---

## 8. `squadSize` in the rule book (Question 7)

Not its home. `RuleBook.squadSize` (`ruleBook.ts:57-65`, default 11 at :122,
proposable as 9 or 20 at `RuleBookScreen.tsx:272-273`, costing fans 1.5 per
player at :236) is a rule of the FA's 11-a-side competitions whose own comment
says it changes nothing on the pitch, and `STAR_POWER_POLITICS.md:533-537`
records that wiring it would mean the match engine and every team-sheet screen
honouring N-a-side for existing saves — a change, not an addition. Reading it
from the five-a-side would also be wrong on its own terms: a free agent who once
voted 20-a-side through would find his trial played twenty a side. **The
five-a-side takes its own `sideSize: 5` config and never reads the rule book.**
The one honest link: the passage builder here is the first code in the game that
places N outfielders per side on a fixed frame, which is the shape a future
`squadSize` hook would need — but that hook stays unbuilt and separate.

---

## 9. Component: port, don't share (decision)

Two routes:

- **R — a `smallSided` prop on `CanvasMatch.tsx`.** ~150 lines of insertions
  behind `if (smallSided)` in the 4,590-line file: swap `loadScenario`'s builder,
  bypass `startSimulation`, the sandbox six-chance cap (:3282), chain logic
  (:3214-3268), half-time/hook/shootout, kind-named commentary, markings. Every
  future match feature would need an "unless five-a-side" guard or it silently
  breaks the trial.
- **P — a new self-contained `components/star/FiveASide.tsx`** with
  `embedded?: boolean` (`FirstPersonDribble.tsx:239-243`) and
  `onComplete(result)`. Its loop is `LiveAttack.tsx:193-226` (launch → 3
  substeps of `stepKeeper`/`stepReactions`/`stepBall`,
  `TrialPenalty.tsx:262-266`). Its renderer is `TrialPenalty.tsx`'s ported
  pitch/goal/keeper/ball plus a ported `footballer()` body
  (`CanvasMatch.tsx:1788`) using the already-shared `drawPlayerHead` /
  `createFaceImageCache` / `loadFaceStyle` (as `FirstPersonDribble.tsx:261-268`
  does), with new small-pitch markings. Aim gesture: `MIN_PULL = 0.008` and
  `dragForFullPower(power)` exactly as `TrialPenalty.tsx:113-114` and
  `CanvasMatch.tsx:4153-4160`.

**Decision: P.** It is the codebase's own settled answer four times over
(`CanvasMatchTest`, `TrialPenalty`, `scenarioRender.ts:17-31`'s stated
reasoning, `FirstPersonDribble`), it keeps the one component that must never
break untouched, and it is what makes the piece reusable for §3.7. Cost:
~600–700 lines of copied drawing code; the playtest agent must compare it side
by side with a real match so it is not "the trash placeholder" `TrialPenalty`
once was. The engine-driving code is the same `launch`/`stepBall`/`stepKeeper`
the match uses — so the physics parity the governing rule demands is exact, and
it is what the tests measure.

---

## 10. Files and shapes

New (all additive):
- `lib/star/fiveASide/geometry.ts` — `FIVE_PITCH = { x1: 22, x2: 46, y1: 0, y2: 36 }`,
  `FIVE_VIEW = { x1: 20.875, x2: 47.125, y1: -4.5, y2: 37.5 }`,
  `insideFivePitch`, `mirror`, `KICK_FLOOR_Y = 29`.
- `lib/star/fiveASide/passage.ts` — `buildPassage(world, opts)`, `castSides`,
  `worldFromScenario(sc)` (reads live positions back after an outcome).
- `lib/star/fiveASide/match.ts` — `newFiveASide(opts)`,
  `applyOutcome(state, outcome, sc, ball)`, `oppPossession(state, rng)` (stage
  3), `aiKick`/`decideOppAttack` (stage 6), `isFullTime`.
- `lib/star/fiveASide/score.ts` — `passageQuality`, `fiveASideScore(summary, d)`.
- `lib/star/fiveASide/career.ts` — `startFiveASide`, `snapshotFiveASide`,
  `finishFiveASide`, `difficultyFor`.
- `components/star/FiveASide.tsx`.
- `tests/star/fiveASide.mts`, `tests/star/fiveASideMatch.mts`,
  `tests/star/trialFiveASide.mts`.

Touched (additive only):
- `lib/star/types.ts` — optional fields above; `StarPhase` gains
  `"trial-five-a-side"` next to `"trial"` (:1106).
- `lib/star/storage.ts` — `"trial-five-a-side"` added to `RESUMABLE` (:148).
- `app/star-dev/page.tsx` — one route above the `profile-setup || !career`
  fall-through (:1970), beside `"trial"` (:1955); the trial's stage sequencer
  (step 5) calls it as stage 5.
- `lib/star/canvasEngine.ts` — **nothing**, unless open question 1 chooses a
  small goal (then the optional `goalMouth` field, default = today).

---

## 11. Build order, smallest shippable first (Question 8)

| # | Piece | Verified by (`tests/star/*.mts`) |
|---|---|---|
| 1 | `geometry.ts` | `fiveASide.mts`: frame equals `buildScenario("corner", rng).crossSwitchView` exactly; frame is 5:8 and 42 m deep; pitch inside frame with ≥ 1 m margin; `POST_L..POST_R` and `−NET_DEPTH` inside the pitch/frame; `mirror∘mirror = id`; `KICK_FLOOR_Y` equals the engine's own bottom-fifth floor |
| 2 | `passage.ts` + `castSides` | same file: 4 defenders, 1 keeper, 2 runners, 1 follower, 1 decorative; `initDefenders` yields exactly one `"press"`; every figure inside the frame; nobody < 1.8 m of the ball, keeper ≥ 2.35 m and between the post clamps, you 1.3 m beside the ball; positions differ from the world by ≤ 2 m (no teleport); every `Identity` lands on the right figure. **Headless drive** (the `outcomes.mts:52-87` idiom) over 2,000 seeded passages: every returned outcome is in the engine's union; none runs past the step cap; a corner-aimed shot from 10 m scores in a sane band (20–70 %); our touchline check always fires before the engine's frame "out"; `"offside"` never appears with the flag off |
| 3 | `match.ts` (abstract opponent beat) + `score.ts` | `fiveASideMatch.mts`: deterministic for a seed; ends at full time; over 500 stand-in games total goals land in a five-a-side band (2–12) and harder `d` concedes more (monotone); snapshot round-trips through JSON; `fiveASideScore` bounded, monotone in each input and in `d` |
| 4 | `career.ts` + types + `RESUMABLE` | `trialFiveASide.mts`: a clubless `makeIdentity` career round-trips a snapshot through `saveCareer`/`loadCareer` (the `saveSlots.mts` store shim); `finishFiveASide` is idempotent; reloads bump and cap; `makeInitialCareer` byte-identity (`identity.mts`) still green; `listSaveSlots` still "No club yet" |
| 5 | `FiveASide.tsx` + page route | `tsc --noEmit`, the full suite, then the **`star-playtest` agent** driving a whole match: aim from a found ball, a goal, a kick-in, a save, a reload mid-match resuming with the score kept, the final whistle writing the result. Compare figures/keeper side by side with a real match screenshot |
| 6 | Engine-decided opponent attacks with recorded replay (§4.4) | `fiveASideMatch.mts` extended: the AI striker's scoring rate falls as your keeper's strength rises; a recorded path mirrored back lands in the world frame; no `"offside"`; playtest again |
| 7 | Real rosters for free-agent replays (§5) | roster cycling test as `firstPersonDribble.mts` does; only when §3.7 lands |

Steps 1–4 are pure TypeScript with no UI and can ship dark. Step 5 is the first
thing a player sees.

---

## 12. Where this could break something that works, and the guard (Question 9)

| Risk | Guard |
|---|---|
| Engine physics drift | Zero edits to `canvasEngine.ts` (default path). `finishing/keeperDive/aiming/outcomes.mts` unchanged and green is the proof |
| `setOffsideRuleEnabled(false)` leaking into a real match | Restore `true` on unmount; `CanvasMatch` re-sets from the rule book on mount anyway; test asserts the flag after a five-a-side lifecycle |
| `CanvasMatch.tsx` | untouched (route P) |
| `page.tsx` collision point | one route + one phase string; `"trial"` route pattern at :1955 copied exactly |
| Existing saves | every new field optional under `trial`; `identity.mts` byte-identity guard; backfill not needed |
| `RESUMABLE` | additive; `loadStarPhase` filters by membership (:195), so old saves never see the new phase |
| Cloud save size | snapshot is ~20 numbers + a short event list |
| `castScenario` assist bug via `teammates[0]` | never call `castScenario`/`creatorOf` here; assists come from the layer's own `PassageEvent` |
| Chain fiction / `CHAIN_MAX` | not used; positions persist instead |
| Frame bottom-fifth | passages clamp `ball.y ≤ 29` — a test |
| Ported renderer looking worse than the match | playtest side-by-side is a gate for step 5, not a nicety (`CLAUDE.md`, "ALWAYS PLAYTEST") |
| `star-match-dev` fork | untouched |
| Tuning suites (`tuning.mts`) | no shared constant changes |

---

---

## 13a. DECIDED — and two pieces of new scope

Answered directly, after the plan was written and reviewed.

### The goal is small

> *"make the 5 aside goals small"*

**3.66 m wide** (real five-a-side, twelve feet) on a 24 m pitch — about 15% of
the width, the proportion futsal uses too. A full-size 7.32 m goal would have
been **30%** of the width in front of a keeper who reaches about two metres:
a shooting gallery, not five-a-side.

**The crossbar is 2 m, not the real 1.22 m**, and that is a deliberate
compromise stated rather than hidden: the engine's striking model is tuned
against a 2.44 m bar, and a four-foot bar would put a large share of ordinary
well-struck shots over it. Two metres is a real futsal height and keeps the
goal genuinely small without fighting physics tuned for something else.

**This cost the engine nothing**, and open question 1's own cost estimate was
wrong in the other direction — it proposed adding a `goalMouth` field.
`Scenario.goal` and `Scenario.crossbar` ALREADY EXIST on every scenario in the
game; the three places that decide whether a ball has gone in simply never read
them, using the module constants instead. They read the scenario now. All
thirteen of the engine's own builders set those fields to the real goal, so
every existing match is unchanged — confirmed by the four tuned engine suites
(`finishing`, `keeperDive`, `aiming`, `outcomes`) still passing untouched, and
pinned by a test asserting an ordinary scenario still has a full-size goal.

### This way of playing is eventually for the ELEVEN-a-side match too

> *"we also need to add this new match playing to the 11 aside goals — for now
> it isn't going to supersede the engine we've worked on but I could see it
> being good in the future, like when u get certain boots you get to play more
> of the match, or if you get to a certain level"*

Not built now, and it does not supersede anything. But it changes how the match
layer is BUILT, today:

- **Side size and goal size are parameters, not constants.** A continuous
  eleven-a-side match becomes a configuration of the same layer rather than a
  second implementation of it.
- Nothing in the layer may assume "four outfielders", "24 × 36", or a small
  goal. The pitch, the frame, the goal and the squad sizes all arrive as data.
- **The natural gate is already in the game.** `Boot.extraTouch` (NS-Maestro)
  is exactly this shape: a boot that unlocks a whole ability rather than a stat
  bump. "Better boots let you play more of the match" fits that idiom exactly,
  and the same is true of a level or star-rating gate.

What that future feature actually IS, stated plainly so it is not mistaken for
something smaller: today you play the handful of moments the ball reaches you
and the other 89 minutes are simulated. Continuous play would let you keep
playing after your touch instead of cutting away — the same passages-in-a-row
machinery the five-a-side needs, pointed at a full pitch. That is a real
feature in its own right and wants its own round; the point here is only that
the five-a-side must not make it harder to build.

### The five-a-side comes back in TRAINING

> *"the 5 aside will also come back in training… let's say level 20 of a
> passing drill will turn into a 5 aside drill, as difficulty increases we can
> increase drill difficulty by introducing 5 aside scenarios"*

The drills already climb a ladder (`trainingDrills.ts`: `ladder(level)` reads a
stat 0-100 and every drill's numbers ramp along it). Adding a five-a-side at
the top of a ladder is a natural extension of a system that already exists, and
it is the single strongest argument for building the five-a-side as a reusable
piece rather than a one-off trial screen — it will have at least three callers:
the opening trial, a free agent's replayed trial, and training.

**One assumption stated rather than guessed:** "level 20" is read as a point on
the existing ladder, which is the STAT (0-100), not a session count — so a
passing drill becomes a five-a-side once your vision is high enough that cones
and gates stop testing anything. The exact threshold is a tuning number, not a
design decision, and belongs in `tuning.ts` with the rest. **Worth confirming
before that round is built**, because if "level 20" meant something else — a
twentieth session, say — the trigger is a different thing entirely.

Not built in this round. The match layer is built to make it cheap.

## 13. Open questions — in plain English (Question 10)

1. ~~**Goal size.**~~ **ANSWERED: small.** See §13a — and it turned out to cost
   the engine nothing at all, because the fields it needed were already there.
2. **Who you play against.** In v1 both teams are other made-up trialists with
   invented names and generated faces, because you have no club yet. Later, when
   a real club invites a free agent to a trial, it can be that club's real young
   players. Is made-up fine for the very first trial?
3. **How long.** Suggested: two halves of three minutes on the match clock,
   roughly 10–12 of your own touches, about 3–5 real minutes of play. Longer or
   shorter?
4. **The other side's attacks.** First version: their attacks are a short
   animated moment decided by a fair roll (the same way the big match handles
   the minutes you are not on the ball). Later version: decided by the real
   physics and shown as a replay, with your keeper genuinely diving. Is the
   first version acceptable to ship with, and is the later one wanted?
5. **Your own keeper.** You never control him. Fine?
6. **Weight.** Should the five-a-side count the same as each of the other four
   stages in the final trial score (recommended), or more?
7. **Closing the app mid-match.** Recommended: you come back to the same score
   and clock, with a tiny hidden difficulty bump so reloading is never a free
   retry. Or would you rather the whole match restarts?
8. **Offside.** Five-a-side has none; recommended off. Agree?
9. **Head-height rule.** Real five-a-side often bans the ball above head height.
   Recommended NOT to enforce it (it would change how a strike feels and that is
   the engine's business). Agree?
10. **Kit.** Bibs vs no bibs for the two trialist sides, keepers in a third
    colour. Any colour preference?
