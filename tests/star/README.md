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
    npx tsx tests/star/club.mts
    npx tsx tests/star/money.mts
    npx tsx tests/star/conditions.mts

**support** — the attack: space evaluation, where your team-mates are standing
when the scenario opens, receiving a ball played near a man rather than at him,
and chaining a completed pass into the next decision.

Two things this has had to survive. First, team-mates as furniture — a `Vec2[]`
the renderer drew and nothing read, so a pass not struck straight at somebody
was simply wasted. Second, and more recently, team-mates who ran about while you
were still aiming. **Nothing moves until you kick the ball**, so the space a
support player occupies has to be found when the scenario is BUILT, not jogged
into while you look at it.

Written because the first implementation was wrong, and the measurements are the
reason we know:

- **A cover defender at 0.62 along the lane is unbeatable.** He only has to move
  62% as far as the man he is covering, so at 3.4 m/s he can never be outrun by
  a support player at 4.8. (The whole covering system has since been deleted —
  nobody covers anything while you aim — but the arithmetic is why `spaceScore`
  still weights lanes the way it does.)
- **The man closing YOU down was blocking every lane at once.** He stands within
  two metres of the start of every passing lane, so raw distance-to-segment made
  him shut all of them equally. Defenders are only counted in lanes they are
  actually in.
- **Support players were stealing 66 shots in 400.** A team-mate wandering into
  your shot and controlling it turns a goal into a completed pass. Whether a
  ball is your strike is decided once, at the moment you hit it, and sticks — a
  shot that deflects, curls away or is parried is still your shot. He steps out
  of the way of a live one and picks up a dead one, which is a different thing
  and is counted separately.
- **A target ten metres beyond a man's feet is an instruction to give the ball
  away.** Every runner used to be built with a `to` he sprinted for; the game
  marked that spot for you. With the pitch frozen, four scenarios (through-ball,
  cutback, byline cross, corner) were asking you to hit a point five to eleven
  metres from anybody. Every marked spot is now inside six metres of the man it
  belongs to, and the suite asserts it for every kind and seed.

Receiving, measured over 120 passes each with only the target man on the pitch
(a 15 m/s ball, defenders removed):

    3.5 m off his foot    119/120 end up his   ·  69 stretched for inside two seconds
    24 m off his foot      83/120 end up his   ·   6 stretched for inside two seconds

The difference is not whether he gets it — a ball that stops is fetched by
somebody, always — it is whether it was a pass or a walk.

---

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

**defending** — nobody moves until you kick it.

This section replaced one that described the opposite. The engine used to run a
whole Pressure Curve while you were still aiming: the nearest defender closed
you down, the others slid onto your passing lanes, holding the ball too long
lost it, and team-mates drifted into space at the same time. Playing it, that is
simply not this game. **You have unlimited time to decide. The only action you
take is the strike. Everything else is a consequence of it.**

What the model is now:

- The pitch is frozen during the aim phase. The match loop calls nothing that
  moves an outfield player, and no step function moves anybody without a live
  ball. The keeper is the single exception, deliberately — he patrols his line,
  which is the timing puzzle a shot is actually asking you to solve.
- Once the ball is struck, a player reacts only when it comes inside his radius
  (9 m), and then he moves at 2.6 m/s. A stretch and a step, not a chase.
- Both sides move at exactly the same pace. Who wins a loose ball is a question
  of where it went, not of who is quicker — asserted to floating-point equality.
- A defender who reaches the ball **clears it**, and the move is over. A blocked
  shot, a cut-out pass and a lost second ball are all the same event: possession
  gone, hoofed back down the pitch.
- A ball that has stopped is the one exception to the radius. Everybody jogs to
  it (4.6 m/s, or 7 m/s if it is more than 12 m away) however far off it is,
  because otherwise it sits on the grass and the move never ends. A resting ball
  is no longer an outcome in itself.

Deleted along with the curve: `stepSupport`, `stepRunner`, `stepFollower`,
`interceptPoint`/`interceptFrom` and the pursuit horizon. The poacher's tap-in
survived — folded into `stepReactions` at the same slow pace as everybody else.

Two measurements from the old model are kept because they still explain code:

- **Re-solving the interception every frame is worse than not trying.** He
  chases the earliest point he can still theoretically reach, which moves away
  from him as fast as the ball does: 20,000 frames of chasing changed 7 passes
  in 500, and he had vacated the lane he was covering.
- **Defenders must not read shots.** A cone around the goal was the obvious test
  for "is this a shot", and it is wrong: from the byline every forward pass sits
  inside the cone, so a cutback was unplayable. It is decided by where the ball
  would actually cross the line, once, at the strike — and it sticks.

The load-bearing assertion in the file is the last one: **1,200 scenarios across
every kind, struck every which way from a barely-touched dink to a full-power
hammer, and every single one resolves.** Nothing chases you, a stopped ball is
not an outcome, and a defender clears rather than deflects — if any of those
three drops a case the highlight hangs and the match cannot continue. Slowest
resolution is well under 25 seconds of simulated time.

Offside is judged only on the through-ball. A scenario carries one or two
defenders, not a back four, so `min(defender.y)` is a meaningful line only in
the scenario built around one — applying it everywhere flagged two thirds of
ordinary midfield passes offside.

---

**contest** — the ball as something both sides can win: ownership, the 50-50 on
a loose ball, the aerial duel, the woodwork, and the touch you take when it
comes back to you.

What this replaced: a deflection or a parry rolled until it stopped and the
chance fizzled out as "scrambled clear" with nobody involved; a header was
struck as though the man marking you were not there; a chained scenario started
with the ball glued to your foot however poor your technique; and hitting the
post ended the highlight.

Tuned by measurement:

- **The aerial contest radius was too small to matter.** At 2.2 m most headers
  were not contested at all — the marker is placed 1.5 to 2.6 m away — so a
  powerful player lost 1.6% of duels. At 2.8 m the duel is real at both ends.
- **Two different things wear the outcome "tackled".** A body in the way of the
  strike, and the second ball lost afterwards. They are counted apart, because
  a single threshold across both hid which one had moved: currently 13% blocked
  and 23% lost afterwards on volleys and headers.
- **First touch is not a dice roll.** Nobody moves before you kick, so a heavy
  touch cannot cost you time — it costs you POSITION. Technique 20 pushes the
  ball 1.7 m away from you, technique 95 kills it inside 0.3 m, and you move
  with it rather than being left standing where it was.
- **The post keeps a lot of the power.** It cannons back out at 78% of the pace
  it arrived with and is loose from that moment: your poacher can follow it in,
  a defender who gets there first hoofs it clear. Only a second ricochet off the
  frame ends it, because that is pinball rather than football.

Outcome distributions the whole engine currently produces, from a full-power
strike straight at the middle of the goal (800 runs each). These are the numbers
to compare against after any change to physics, the keeper or the defence:

    one_on_one    goal 39%   saved 30%   lost 13%   collected 18%
    tight_angle   goal 17%   saved 50%   lost 26%   collected  7%
    header        goal 14%   saved 28%   lost 38%   collected 20%
    volley        goal 20%   saved 33%   lost 38%   collected  9%
    long_range    goal 14%   saved 24%   lost 60%   collected  2%

"lost" is a defender getting the ball, either in front of the strike or after
it. "collected" is a team-mate tidying up a ball that had already died. Long
range is punishing by construction — there are bodies between you and the goal
and it is meant to be the shot you take when nothing better is on.

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

---

**club** — the manager, the derby and the press.

Your standing with "the boss" was a relationship with nobody: no name, never
changing hands, and a number five seasons in the building that nothing could
take away except your own form. Every fixture was the same fixture. And the
dilemma system, which fires on a timer and asks about your life, was the only
thing in the game that ever asked you a question — nothing ever asked about the
match you had just played.

- **A manager can be sacked**, judged on the season the CLUB had rather than the
  one you had, with more rope in his first year. The man who walks in has never
  picked you: a boss relationship of 96 lands somewhere in the forties, the
  armband goes back in the drawer, and a reputation is worth something but
  nothing like what you had built. The file asserts a good season keeps him too,
  so this can't fire on everything.
- **His style bends selection symmetrically** — a trusting manager is harder to
  lose your place with AND harder to win it back from, so no style is simply
  better to play for. Asserted as a property, not just as a number.
- **Rivalries are symmetric by construction** and independent of the order the
  division was listed in. An odd division leaves one club without a rival rather
  than inventing a one-sided one. A derby is worth double to the supporters and
  half again to the dressing room; the manager is the least moved, because three
  points are three points to him. Losing one costs the same way.
- **The press only ask about something that happened**, and a derby leads the
  bulletin over a hat-trick and a rout. Every question is the same decision
  underneath — back yourself, back the team, or give them nothing — and the file
  checks that shape holds for every story rather than checking the wording.

---

**money** — sponsors that ask for something, contracts with a shape, a
testimonial, and the supporters finally saying something.

A `SponsorDeal` was `{ category, perMatch, active }` — passive money that
unlocked by counting, so the sponsors screen was a list of numbers going up on
its own. A contract was a wage, two bonuses and a number of seasons, so every
deal in the game was the same deal at a different price. A career at one club
had nothing to show for it that six clubs did not — if anything the mercenary
did better, because every move came with a signing fee. And the `fans`
relationship moved for fifteen seasons without the player ever hearing from
them.

What the file pins down:

- **A sponsor objective can be missed.** A term that runs out unmet lapses, and
  it takes the retainer and some standing with everybody else. That is the only
  thing that makes chasing one worth anything. A two-season target is not judged
  after one, and a delivered one is cleared rather than paying twice.
- **A release clause cuts both ways.** It is the price at which a club cannot
  say no, so a LOW one gets a nobody offers his reputation would never attract —
  asserted directly by giving a 0.6-star player a cheap clause and counting the
  offers.
- **Loyalty is the one thing that pays you for not moving**, and appearance
  money is worth nothing to somebody who plays every week — checked against a
  full season played end to end.
- **The testimonial is not available to somebody who arrived last summer**,
  however good he is.
- **The fan feed does not reshuffle under a re-render**, and it talks about what
  actually happened: the armband, an award, a bad run.

---

**conditions** — the surface, the wind, and a free-kick wall that jumps.

Every match was played on a perfect pitch in still air, so the ball behaved
identically in August and in February. And a wall was four men rooted to the
turf, which made a free kick a question of going round the end of it and nothing
else.

Both are deliberately small: the weather multiplies three physics constants and
pushes an airborne ball sideways, and the wall gains a height that the block test
reads. Nothing else in the engine knows either exists — a scenario that
specifies no conditions is byte-identical to the old behaviour, which is what
makes it safe for the sandbox and for saves that predate it.

Three things the measurements caught:

- **A jumping wall was unbeatable.** The block window was the defender's feet up
  to head height ABOVE his feet, so leaping raised the ceiling one-for-one to
  about 2.55 m — and the highest a free kick can be lifted over a wall nine
  metres away is roughly 2.2 m. Every lofted free kick in 200 was blocked, at
  every loft and every power. A wall keeps its arms down, so its ceiling is now
  capped at 2.05 m however high it jumps; the leap lifts its FEET instead, which
  is what makes a ball rolled under a jumping wall a real free kick too. Driven
  straight at them it is still blocked; lifted over at the right weight it goes
  in about 27% of the time, and overhit it clears the bar.
- **The wall hung in mid-air once the ball resolved.** The jump physics were
  gated on there being a live ball, so gravity stopped the instant the outcome
  was decided — exactly when the player is looking at the freeze frame. Gravity
  now always runs; only the START of a jump needs a ball.
- **"Wind does not affect a driven ball" is false in this engine.** A driven
  ball skips off the turf and spends most of its journey airborne. What is
  genuinely untouched is a ball ROLLING on the grass, and the test now builds one
  directly rather than striking it, because even the flattest strike leaves the
  boot slightly airborne.

Measured: a wet surface carries a ball further than a dry one and a heavy pitch
eats it, and both deaden the bounce.
