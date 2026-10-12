# Next 5-hour window: 2D gameplay to "perfect"

Leo, 11 Oct 2026: "plan massive gameplay (2d) progress prompt for next 5 hour
window. goalie needs to be perfect. shots need to be perfect. ball physics
needs to be perfect. match radar (progression of play) needs to be perfect.
dribbling so far from perfect and needs to be perfect."

Paste the prompt at the bottom into a new session (or say "go" in this one).

## How "perfect" is judged

A green test suite is not enough. Every job is judged on the real game's screen.
1. **Real reference first.** Each job writes down what real football looks like,
   with numbers: for example keeper save rates by shot type, how far a struck
   ball travels, how a dribble beats a man. Sources: StatsBomb free data (already
   in the repo, see Mikey's Kane drawings), Opta-style public stats, and match
   footage descriptions.
2. **Measure the game against it.** A script over 1,000+ seeded chances gives
   the before numbers.
3. **Fix the gaps.** Anything that changes the feel goes behind
   Settings → Look/Gameplay "New | Old". Old is exactly today's game.
4. **See it.** Real-game screenshots and short clips at 390×844, before and
   after. The builder looks at every one.
5. **Ask the person.** Things that are a matter of taste go into the patch notes
   as a question, with a clip.

## The jobs (one builder each, run side by side)

### 1. The goalkeeper
- **Now:** `keeperBrain.ts`, `keeperAttempt` and `resolveKeeper` in
  `canvasEngine.ts`, `penaltyKeeper.ts`. Today's keepers are human (they read
  the shot, see the sightline, sometimes go the wrong way) and their dive
  animation keeps running after the result is decided.
- **Perfect means:**
  - Positioning and angle play that looks right: he narrows the angle, comes off
    his line for through balls, holds his line for crosses. Set against the
    real-football numbers above.
  - Saves land where the ball is: no hand passing through the ball, no save
    after the ball is past him.
  - Parries go somewhere believable: away from goal, out for a corner, or a
    rebound into the danger area at real rates.
  - Catches versus parries depend on how hard and how high the shot is.
  - He claims crosses and punches.
  - He can be lobbed, chipped or nutmegged at the right rates.
  - Keeper quality shows: a 90 keeper and a 60 keeper feel different.
- **Measure:** save % by shot zone, distance, power and keeper rating, against
  the real numbers. Clips of 20 saves and 20 goals, checked by eye.

### 2. Shots
- **Now:** `launch()`, curl, contact screen (`ContactBall`), drag power
  (`dragForFullPower`), finesse aiming wide then curling back, chips, the
  test-match-only knuckleball and power shot.
- **Perfect means:**
  - The aim arrow tells the truth: the ball goes where the arrow says,
    allowing for skill.
  - Power and contact feel right: low and driven, placed side-foot, curler,
    chip, volley.
  - Good contact rewards you and poor contact punishes you, both visibly.
  - Real conversion rates by chance type: a one-on-one roughly 30–40%, not 68%
    (Mikey measured real one-on-ones at 20%). Blocks and deflections happen at
    real rates.
  - Knuckleball and power shot move from the test match into the real game,
    behind a switch.
- **Measure:** conversion by kind against StatsBomb xG. Arrow vs actual
  landing error. Clips.

### 3. Ball physics
- **Now:** `stepBall` / `stepBallRaw`: air drag, gravity, bounce, ground
  friction, spin and Magnus curl (`CURL_K`), post and bar bounces, net.
- **Perfect means:**
  - Real flight times and distances for passes, shots and clearances.
  - A real bounce and roll-out: grass slows a rolling ball like real grass.
  - Spin decays.
  - Posts and the bar deflect at the right angles.
  - The net catches the ball and drops it (no ball stuck in the post, no ball
    stopping dead in the air).
  - The shadow and height read clearly from the top-down camera.
  - Same results on every device: fixed sub-steps, no frame-rate effects.
- **Measure:** compare flight against a reference trajectory table (speed,
  angle, distance, apex) from real ball-physics data. Edge cases: posts, bar,
  keeper hands, ball under the bar. Clips.

### 4. The match radar: how play moves between your chances
- **Now:** `hiddenMatch.ts` simulates the 90 minutes you don't play
  (possession, zone, lane, momentum). `matchRadar.ts` and `MatchRadar.tsx`
  draw that, but only on the test page `/star-radar-dev`. In the real match you
  see commentary lines.
- **Perfect means:**
  - A clear, live radar in the real match, between chances: a mini-pitch with
    the ball moving zone to zone, which side has it, a momentum bar, and a flash
    for shots and goals. It sits alongside the commentary, not instead of it.
    Behind a New | Old switch.
  - The hidden match itself must be believable:
    - possession around 50/50 against an equal side, and lopsided against a
      much stronger one;
    - real counts per 90 minutes: shots, corners and goals;
    - momentum swings after goals;
    - chances come to you at sensible minutes;
    - the ball moves through midfield before it reaches the box.
- **Measure:** 1,000 simulated matches compared with real Premier League
  averages: shots 25 a game, goals 2.8, possession, corners about 10. Clips of
  the radar over a full match.

### 5. Dribbling ("so far from perfect")
- **Now:** the first-person duel mode (`FirstPersonDribble.tsx`,
  `firstPersonDribble.ts`, `firstPersonRender.ts`) replaced the top-down run
  in real matches.
- **Open issues from earlier:**
  - the ball reads as behind or attached to the body, not in front of it;
  - the legs look like they are flailing;
  - you don't have to time anything;
  - the waves and reward ladder are new and not yet felt.
- **Perfect means:**
  - The ball is clearly ahead of your feet, with touches you can see.
  - Natural running with knock-ons.
  - Real dribble moves: step-over, drop of the shoulder, cut inside, burst.
    Each beats a defender only with good timing against his commit.
  - Defenders who jockey, show you one way, and tackle or foul.
  - Pace and dribbling stats matter.
  - The camera stays steady.
  - Success rates close to real take-ons: about 50% overall, about 65% for
    elite dribblers.
- **Choice for Leo:** the alternative is a top-down dribble inside the normal
  match view, built the same way the rest of the 2D game is. Show both and let
  Leo choose.
- **Measure:** take-on success by stat and timing. Clips of 20 duels.

### 6. A playtest after every job, and one at the end
- A `star-playtest` run per job on the real game, plus a final combined
  playtest.
- Patch notes Leo v0.15 with clips for every gameplay change, filmed after the
  push, following the house rules.

## Rules for every builder

- The one-engine guard stays clean.
- `canvasEngine.ts` may change, but each edit shows a warning; record what
  changed and why, with before and after numbers.
- Run the match tests (`finishing keeper aiming outcomes`) and every test the
  job touches.
- Every change to the feel goes behind a New | Old switch; Old is exactly
  today's game.
- Stills and clips are taken from the real game, not drawings.
- Memory is tight on this machine: one dev server per builder at a time, stopped
  at the end.
- Merge to main after each job's checks pass.

## The prompt to paste

> New 5-hour window, gameplay (2D) to perfect. Read docs/next-window-gameplay-plan.md
> and run it: one top-model builder per job (keeper, shots, ball physics, match
> radar, dribbling), side by side, each measuring against real-football numbers
> first, building behind New | Old switches, judging by real-game screenshots and
> clips, merging to main as each passes. Playtest each job, then one final
> playtest and patch notes Leo v0.15 with clips. Give me 3–5 quick questions
> first if anything needs my call (e.g. dribble style), then go.

## Carry-over from 11 Oct (do first)

- **Camera round 3** (`lib/star/matchView.ts`, switched off: `ACTION_FIT = false`).
  - Cause found and measured on the real screen: the camera keeps every man on
    screen, so one straggler sets the width and the tall screen is left mostly
    empty below.
  - `actionOf` / `fitAction` frame only the men the chance is about. Replayed
    on real captures, empty grass below:
    - one-on-one: 58% → 32%
    - long range: 37% → 15%
    - cutback: 78% → 65%
  - To switch it on:
    1. Rewrite `chanceFraming`, `cameraTilt` and `emptyGrass` to the new rule
       (the action is always on screen; everyone else is wholly on or clearly
       off).
    2. Find out why `deadBallFraming` fails on the cutback check.
    3. Connect `passersFit` for build-ups.
    4. Capture real-game stills after, and measure the drag before and after.
  - Cutbacks and tight angles stay 44–65% empty upright. The side-on view is the
    answer there; that is Harry's call.
  - Captures and scripts: scratchpad `jobs/camera3/`.
- **International duty round 2:** merged on 11 Oct. Still to do:
  - Play a whole tournament in the real game: knockout, extra time,
    penalties, final, trophy.
  - A score mismatch: when you are taken off late, the stats screen can show
    one more goal for the other side than the scoreboard does. Seen 3 times. The
    cause is somewhere in the code that plays the rest of the match without you
    (`CanvasMatch.tsx`, around line 5925); the line was not found.
