# Star career tests

    npx tsx tests/star/hiddenMatch.mts
    npx tsx tests/star/support.mts
    npx tsx tests/star/defending.mts
    npx tsx tests/star/contest.mts
    npx tsx tests/star/perception.mts
    npx tsx tests/star/career.mts
    npx tsx tests/star/selection.mts
    npx tsx tests/star/competitions.mts

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

---

**perception** — vision buys knowledge, not accuracy; fatigue costs execution,
not intent.

Everyone is drawn on the pitch whatever your vision is — hiding players would
read as a bug and be unfair besides. What a low-vision player lacks is being
TOLD who is free: at vision 20 he is shown the obvious man, at 55 two options,
at 92 three, and only inside the range he is scanning (11 m up to 32 m). A
high-vision player is pointed at the genuinely best option on the pitch 86% of
the time, not merely the best of a shortlist he happened to be handed.

The legs model is mirrored here exactly as the component implements it, so
changing one without the other fails the file. A 90-minute match with seven
chances leaves an unfit player (40) on 39 and a fit one (95) on 69; an empty
player loses a fifth of his technique and a fifth of his power, and never more.

---

**career** — the season loop, and the dead end at the end of it.

The career state has always been saved to localStorage; the PHASE was React
state only, so a reload always dropped you on the dashboard. Everywhere else
that is harmless — you navigate back. At the end of a season it was a soft-lock:
every fixture played, so the dashboard had no match to offer and no route to the
Ballon d'Or, and the career could never advance again.

The fix has two halves and this file covers both. The phase is persisted for the
three screens you cannot navigate back to (`ballon-dor`, `contract-renewal`,
`dilemma`) and explicitly NOT for the rest — resuming into a `match` whose state
was never saved would be worse than the bug. And the dashboard offers the end of
the season directly, which means it can now be reached twice, so awarding the
title had to become idempotent.

Also asserted: a corrupt or hand-edited phase record is refused rather than
trusted, and clearing a career clears the pending phase with it — otherwise a
brand new career resumes the old one's awards screen.

---

**selection** — team selection and set-piece duty: two systems that existed as
numbers deciding nothing.

`career.status` was stamped "1st Team" when the career was created and never
touched again, so you could be on 3 out of 100 with the manager and start every
week. `skills.freeKick` was trainable, had an achievement for maxing it,
appeared on two screens, and was read by no code anywhere.

Measured shape of the selection curve, playing 4.2 every week from a standing
start, then recovering with 8.2s:

    3 bad games      -> the bench
    11 bad games     -> out of the squad
    3 weeks sat out  -> back on the bench (the manager softens: +3 a week)
    4 good games     -> back in the side

Two things the measurements changed:

- **One bad game benched you.** Form averaged only the games actually played, so
  a single 4.2 in your opening week swung the whole judgement. The window is a
  fixed five, padded with neutral performances, so one poor game moves you a
  fifth of the way.
- **`minutes` had been an argument of `finaliseMatch` since it was written and
  was read by nothing.** A substitute who played twenty minutes was rated as
  though he had played ninety. Ratings now regress toward a neutral 6.5 in
  proportion to the minutes NOT played — a full match multiplies by exactly 1,
  so nothing about starting changed.

Set-piece duty is judged against your own club, so the same player takes free
kicks at a mid-table side and loses them on a move to the champions. The file
asserts that specifically, because it is the whole reason the skill stays worth
training.

---

**competitions** — cups, Europe and the national team.

There was one competition: league football and a title if you finished top. The
`Trophy` type has always carried a `competition` field and only ever held one
value.

All three are the same shape underneath — a knockout you are either still in or
out of — so most of this file asserts that one progression function behaves for
all three. A knockout cannot be drawn up in advance the way a league can,
because who you play next depends on still being in it, so a season starts with
the FIRST round of each on the calendar and winning it puts the next one there.

The assertions that matter most:

- **A cup night moves nobody in the table.** Running the division's round after
  a cup tie would hand everyone else a free week of points; the test compares
  every team's played and points across a cup match.
- **The next fixture is the next one by DATE.** It used to be
  `fixtures.find(f => !f.played)`, which relies on the array being in calendar
  order — true for a league built up front, and false the moment a round earned
  in week 9 is appended after week 18. League football comes first when two land
  in the same week.
- **A group is played on points.** Resolving every round identically sent you
  home from a tournament on one drawn group game, which is not football.
- **Cup goals count for your club season; international goals do not.** Caps and
  international goals are their own record, because the club numbers are what
  the Ballon d\'Or and the club achievements read.
- **Cup weeks and European weeks never collide**, checked by playing both runs
  the whole way through and comparing the calendars.
- **A tie cannot be drawn**, and a shootout is nudged by quality rather than
  decided by it: 99-strength beats 95-strength opposition in roughly two thirds
  of 200 shootouts, never all of them.
