# Star career tests

    npx tsx tests/star/hiddenMatch.mts
    npx tsx tests/star/support.mts
    npx tsx tests/star/defending.mts
    npx tsx tests/star/contest.mts

**support** — the attack: space evaluation, supporting runs, pursuit of a ball
not played straight at anyone, and chaining a completed pass into the next
decision. What every assertion here guards against is the state this replaced —
team-mates as furniture, a `Vec2[]` the renderer drew and nothing read.

Three of these were written because the first implementation was wrong, and the
measurements are the reason we know:

- **A cover defender at 0.62 along the lane is unbeatable.** He only has to move
  62% as far as the man he is covering, so at 3.4 m/s he can never be outrun by
  a support player at 4.8. Support play was mathematically pointless until the
  marker on a support player was moved to 0.85.
- **The man closing YOU down was blocking every lane at once.** He stands within
  two metres of the start of every passing lane, so raw distance-to-segment made
  him shut all of them equally: the best available option fell by the same
  amount wherever a support player ran. Defenders are now only counted in lanes
  they are actually in.
- **Support players were stealing 66 shots in 400.** A team-mate wandering into
  your shot and controlling it turns a goal into a completed pass. Whether a
  ball is your strike is now decided once, at the moment you hit it, and sticks
  — a shot that deflects, curls away or is parried is still your shot.

Measured effect of supporting runs on the best pass available after two seconds
of being closed down (change in the best option's space score):

    long_range   frozen +0.001   support +0.035   improved 78% of the time
    one_on_one   frozen +0.018   support +0.077   improved 93%
    cutback      frozen -0.027   support +0.009   improved 60%

**hiddenMatch** — the ninety minutes you are not playing. Everything the
simulation does is statistical, so it is measured over 2,000 matches per case
(evenly matched, heavy favourite, heavy underdog) rather than asserted on one.

The constants in `lib/star/hiddenMatch.ts` were tuned against these bounds, not
by eye. What the file pins down:

- **Possession changes naturally** — around 28 changes of hands a match, two
  equal teams inside a point of an even split, and no match where one side
  holds the ball from first minute to last.
- **Quality shows without deciding** — a much better team creates about 2.6×
  the chances of a much worse one and wins 83% of the time, but the underdog
  still wins 9% and still gets roughly four moments of its own.
- **Chances come from where the ball is** — a scenario is only requested from
  the final third or the box, except when the match has ignored you for twenty
  minutes and you go and find the ball; those deep requests can only ever be
  safe football (a build-up pass), never a one-on-one from your own half.
- **Quiet periods exist without stranding you** — the longest gap averages 26
  minutes, and no match in 2,000 passed without the player being involved.
- **Scorelines are footballing** — about two goals a match between two even
  sides, and nothing is a foregone conclusion in either direction.
- **Effort buys involvement, not better football** — a tired or a poor player
  sees less of the ball; neither is frozen out, and neither plays worse
  football when they do get it.
- **Time compression is lossless** — jumping straight to the next moment still
  reports every event in the minutes that were skipped.

The most common way to break this file is to make one side's rates diverge from
the other's: the pitch is deliberately symmetric, so the same numbers that
produce your chances at their end produce theirs at yours.

---

**defending** — reading a pass, committing to the interception, recovering
goal-side, and offside judged live. What this replaced: a defender only ever
deflected a ball that happened to pass within a metre of where he was already
standing, never turned when he was played past, and the offside risk on a
through-ball was a fixed number decided before you had taken aim.

Two measurements shaped the implementation:

- **Re-solving the interception every frame is worse than not trying.** He
  chases the earliest point he can still theoretically reach, which moves away
  from him as fast as the ball does, so he trails it the whole way: 20,000
  frames of chasing changed 7 passes in 500. Worse, he had vacated the lane he
  was covering — measurably worse than standing still. He now commits to the
  point he picked and only leaves his position for an interception he can make
  at 80% of his pace.
- **Defenders must not read shots.** A cone around the goal was the obvious test
  for "is this a shot", and it is wrong: from the byline every forward pass sits
  inside the cone, so a cutback to a team-mate was unplayable. It is now decided
  by where the ball would actually cross the line, once, at the strike — and it
  sticks, so a shot that deflects or curls away is still your shot.

Offside is judged only on the through-ball. A scenario carries one or two
defenders, not a back four, so `min(defender.y)` is a meaningful line only in
the scenario built around one — applying it everywhere flagged two thirds of
ordinary midfield passes offside, which is exactly the kind of thing that looks
fine in code and is obvious in a distribution.

---

**contest** — the ball as something both sides can win: ownership, the 50-50 on
a loose ball, the aerial duel, and the touch you take when it comes back to you.

What this replaced: a deflection or a parry rolled until it stopped and the
chance fizzled out as "scrambled clear" with nobody involved; a header was
struck as though the man marking you were not there; and a chained scenario
started with the ball glued to your foot however poor your technique.

Tuned by measurement:

- **The aerial contest radius was too small to matter.** At 2.2 m most headers
  were not contested at all — the marker is placed 1.5 to 2.6 m away — so a
  powerful player lost 1.6% of duels. At 2.8 m the duel is real at both ends of
  the scale.
- **The 50-50 has to be a cost, not the usual outcome.** Losing the second ball
  runs at 1-2% of chances, which is enough that leaving a rebound rolling in
  front of a defender is a mistake and not so much that a deflection ends the
  move.
- **First touch is not a dice roll.** The defence simply gets the time your
  touch cost them, using the same closing behaviour it uses everywhere else:
  technique 20 leaves you 2.2 m of room, technique 95 leaves you 3.1 m.

Outcome distributions the whole engine currently produces, from a full-power
strike straight at the middle of the goal (800 runs each). These are the numbers
to compare against after any change to physics, the keeper or the defence:

    one_on_one    goal 53%   saved 36%   lost 1%
    tight_angle   goal 35%   saved 51%   lost 2%
    header        goal 27%   saved 34%   lost 1%
    volley        goal 32%   saved 38%   lost 2%
    long_range    goal 16%   saved 32%   lost 1%
