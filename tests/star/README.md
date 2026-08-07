# Star career tests

    npx tsx tests/star/hiddenMatch.mts
    npx tsx tests/star/support.mts
    npx tsx tests/star/defending.mts
    npx tsx tests/star/contest.mts
    npx tsx tests/star/perception.mts
    npx tsx tests/star/career.mts
    npx tsx tests/star/selection.mts
    npx tsx tests/star/competitions.mts
    npx tsx tests/star/week.mts
    npx tsx tests/star/legacy.mts
    npx tsx tests/star/context.mts
    npx tsx tests/star/attributes.mts
    npx tsx tests/star/recognition.mts

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

---

**week** — the week between matches, and being taken off during one.

Energy was a one-way street. It started at 100, cost 40 a match and 15 a
training session, and outside an NRG drink or a dilemma never came back.
Eighteen league matches drain 720 against a pool of 100, so by the third week of
the first season you sat pinned at the floor and could never train again — the
one currency the whole life side of the game runs on was unspendable. The file
plays a whole season and asserts you are still training in its closing weeks.

A week is now three days: train, work on a relationship, or rest (+35 energy).
The week itself returns 45. Measured over a full season, three styles:

    train hard   66 sessions   arrives at every match on 15-17 energy
    balanced     50 sessions   67 average at kick-off
    rest a lot   44 sessions   100 every week

Arriving empty is a real cost now, not a cosmetic one: it feeds the hidden
match (fewer chances), the strike (worse execution) and the manager (hooked for
your legs).

**Being taken off** was completely absent — you played every minute of every
match you started, however badly it was going. Three reasons a manager makes a
change, and this has all three including the flattering one.

One measurement mattered more than the rest: **the "bad form" threshold could
never have fired.** The rating formula starts at 6.0 and the only thing that
pulls it down is a defeat, worth 0.3 — a contributionless loss bottoms out at
exactly 5.7, so a threshold of 5.6 was unreachable. It is 6.05, and the file
asserts the floor of the formula directly so the two cannot drift apart again.
The manager also reads the same `liveRating` mid-match that the scoresheet reads
at the end, rather than a second formula that could disagree with it.

---

**legacy** — transfers, and the end of a career.

A `"season-transfer"` phase had been sitting unused in `StarPhase` since the
game was written, and the only thing in the codebase that mentioned moving club
was a dilemma where your agent asks how you feel about it. You signed for one
club at eighteen and finished there whatever you did. And a career had no end:
you aged, your pace declined a few points a year past thirty, and then you
carried on for ever, because nothing knew how to stop.

Interest is judged relative to your own club, so who comes for you says
something about where you are. A full career, simulated end to end:

    S1  Brighton   rep 44   3 offers  ->  Spurs
    S3  Spurs      rep 58   1 offer   ->  Arsenal
    S5  Arsenal    rep 67   3 offers  ->  Man Utd
    S7  Chelsea    rep 73   the offers keep coming and he stays
    S23 age 40                            forced retirement
    FINAL: Club Legend — 368 goals and 14 trophies across 23 seasons (legacy 61)

The assertion that matters most is that **moving costs you something**. Without
it, taking the biggest wage every summer would be strictly correct and there
would be no decision in it: a new dressing room starts at 52, a new manager at
62, and the file checks directly that your standing with the manager — the thing
that decides whether you are picked — is lower the day after you sign than the
day before.

The verdict is weighted toward the hard things rather than the long ones: six
hundred quiet appearances scores under 60% of what a decorated career does, but
still scores. Every club you played for is remembered, not only the last.

---

**context** — match context (§2.9) and club expectations (§16.11).

Two things the specification asks for that the game had no idea about. The score
and the clock were both already in the hidden match state and read by nothing,
so a cup final away from home 1-0 down with fifteen minutes left played exactly
like a goalless friendly. And finishing sixth was worth the same at the club
that won the league last year as at the one that nearly went down.

Home advantage existed for every fixture in the division EXCEPT the one you
play: `simulateOtherFixtures` gives the home side +3 and so does a match you are
dropped for. Measured, evenly matched:

    away      5.9 chances   47.7% of the ball   29% win
    neutral   6.4           50.0%               38%
    home      6.9           52.3%               46%

Chasing the game ramps in over the closing half hour rather than switching on.
With the scoreline held fixed to isolate it, chances in the last twenty minutes:
1.1 while two ahead, 1.5 level, 2.0 while two behind. Two down in the first half
is not yet a crisis — the same scoreline early changes almost nothing.

One measurement changed the design: **the season judgement scale saturated
almost immediately.** Normalising the finish by 0.35 of the division meant that
in a ten-team league, finishing six places above target scored 1.71 against a
ceiling of 1 — so winning a cup on top of a good league season changed the
verdict by exactly zero. At 0.6 the range is actually reachable. The test that
caught it now builds a genuine sixth-place finish with explicit points, because
an earlier version left every club on zero and the sort fell back to array
order, which measured nothing at all.

---

**attributes** — the dribble (Chapter 6) and attributes as expanders (§13).

Chapter 6 of the specification is a whole chapter on dribbling and the game had
none of it: you were a fixed point who struck the ball and never moved. The run
is a carry from deep to the edge of their box — flick to set a direction, keep
going in it until you flick again, three or four defenders scattered across the
corridor who are not watching you until you come near. Getting through is not
the end of the move; §6.1 is explicit that "dribbling is rewarded when it
creates a better football decision", so it chains straight into a chance built
from where you got to.

**The measurement that changed the design: chasers were faster than a slow
player in a straight line.** At 5.0 + strength they outran a pace-20 player
whatever line he picked, and 500 runs at pace 20 produced not one that got
through. Pace below a threshold was not "slow", it was locked out. Chasers now
sit in the same speed band as a middling player, so a defender is beaten by the
line you pick and pace decides how much room that line needs:

    pace 20   27% through
    pace 60   74%
    pace 90   90%

§13.1: "Attributes should increase the player's football vocabulary, not simply
increase their success rate. If upgrading an attribute only increases hidden
percentages without changing player behaviour, the system has failed its design
goal." Ours did exactly the named failure case, and the file now pins the fix:

- **Technique decides how much of the ball you can use**, not how straight you
  hit it. The same contact on the very edge bends 2.2× as much for a technique-95
  player as for a technique-20 one, and lifts further. The accuracy coupling is
  halved rather than removed, because a beginner does miskick. A poor technician
  must still be able to finish a one-on-one — asserted directly, because an
  "expander" that gates you out of the game is a difficulty multiplier wearing a
  hat.
- **Power makes the arrow more generous**: full power needs a 42% drag at power
  0 and a 26% drag at power 100, so the same flick is worth more of a shot.
- **Pace was read by no code in the match at all.** It is now the whole point of
  the run.

---

**recognition** — awards, the armband and the number on your back.

Three things absent in the same way. The Ballon d'Or was the only individual
honour in the game, so a season of twenty-five goals that did not win it left no
trace at all. Captaincy existed solely as a dilemma about the CURRENT captain
being annoyed with you. And you played fifteen seasons without a squad number.

None of it changes how you play, so what the file mostly guards is that none of
it can be had for free:

- **Player of the Season needs more than goals.** Sixty goals for the worst team
  in the league does not win it; the same season at the top of the table does.
- **Every captaincy condition is necessary** — asserted one at a time. Not a
  dressing room that is against you, not a manager who is, and not a player who
  signed three weeks ago however good he is. A move takes the armband away and
  resets your appearances at the club to zero, which is a real part of what
  moving costs.
- **The scoring chart is stable within a season and different between them.**
  Rivals are derived from club strength and the season number rather than
  simulated, so the chart cannot reshuffle under a re-render, and their tallies
  grow with the season so the race is live all year.
- **End-of-season honours are banked before the stats that earned them are
  wiped** — asserted through a real rollover.
