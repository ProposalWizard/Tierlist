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
    npx tsx tests/star/offside.mts

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
- **The ball never goes through anybody.** Two things were letting it. A support
  player steps out of the way of a ball that is going in — right, but he was
  stepping out of EXISTENCE, so a shot that would have hit him in the chest
  carried straight on. He now takes anything that would pass within a body's
  width of him, whatever it was aimed at. And `shot` is sticky so a team-mate
  cannot turn your goal into a completed pass, which is right while it is still
  your shot and wrong the moment the keeper has palmed it away: **every one of
  your players stepped aside from the rebound and it rolled visibly through
  them**, 862 times in 1047 parries. A parried ball, and one off the woodwork, is
  a loose ball and nobody's shot.
- **A scramble was a perpetual motion machine.** Reception was the one contact
  test in `stepBall` that did not respect `contactCd`, and it is the one place it
  mattered most: a team-mate who shoots is standing ON the ball he has just hit,
  so on the very next frame he was inside his own two-metre control radius and
  collected it again. Then shot. Then collected. A move either had no team-mate
  shot at all or ran to the runaway cap — 306 of 1200, and **never one, two or
  three of them**, which is the shape of a loop rather than of football. With the
  guard in: 288 followed in once, 17 twice, 1 three times.

  Two other things came out of chasing it. When the cap does bite, the move ends
  as a scramble petering out rather than as `delivered` — which credited you with
  a pass you never played and put PASS on the screen at the end of a shot. And a
  keeper who has already been beaten twice in one move falls on the third rather
  than palming it out again.
- **A ball nobody has is a ball everybody can have.** Once ANY team-mate had
  touched it, `receiverDone` stayed set and nobody could collect it again — so a
  shot the keeper parried away rolled to a stop with your players walking toward
  it and the move was cut off before the nearest of them arrived. It read,
  correctly, as your side declining to chase a loose ball in their own box. He
  has struck it; he no longer has it. The two-shot cap now limits the SHOOTING
  rather than the collecting, so a scramble ends with a man in possession
  instead of frozen two metres short. Asserted: a loose ball with somebody
  inside six metres of it is never given up on, over 1,200 shots at the keeper.
- **A first touch does not get to place you differently from everything else.**
  It planted you 1.2 m straight BEHIND the ball — the old model, left behind
  when the rest of the game moved to standing alongside — so every chance that
  came out of a completed pass, which is most of the good ones, put the ball on
  your chest.
- **The man in the box could not be passed to.** He is drawn like a team-mate,
  stands where a team-mate stands and is the obvious ball in half the chances in
  the game — and he was not on the reception list, so a ball hit at his feet went
  through him and rolled away. He was not allowed to want it: his only job was
  poking in a loose ball in the six-yard box, which is a poacher's job rather
  than a whole player's. He is a candidate now, at "support" role so a live shot
  still steps around him, and he is on the line-of-the-ball check so a ball aimed
  AT him reads as a pass.
- **A tipped save teleported the ball.** Twice, in two different directions,
  and for the same reason both times: the outcome is terminal, so wherever the
  ball is PUT is where it appears, instantly, with nothing in between. He does
  not put it anywhere now — he hits it, away from his goal, from the point he
  reached it, and the result phase keeps stepping it (`settleBall`) until it
  stops. You watch it go, which is the whole of the difference.
- **Defenders standing behind their own keeper.** Cover was placed by
  alternating left, right, left off a random spread, so three of them put two on
  the same side a stride apart marking nobody, and the depth was free to land
  between the keeper and his own goal line. They are spread across lanes now and
  never nearer the goal than the keeper is.
- **A firm ball at a team-mate went straight through him.** The most-reported
  bug in the game, and the cause is one line that was missing rather than one
  that was wrong. Anything struck hard toward the goal is flagged as your shot so
  a team-mate cannot wander into it — and a support player steps out of the way
  of your shot. Hit a man firmly, which is what you do when he is ten metres off
  with defenders about, and he stood aside from a ball aimed at his feet. **A man
  on the line of the ball, before it reaches the goal, means you meant to find
  him.** Asserted at under 2% misread for every situation with a goal in it;
  headers are exempt and legitimately so, because a ball won in the air off you
  belongs to nobody.
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

**THE CAMERA IS FLAT.** A metre is the same number of pixels everywhere in the
frame, in both directions. The pitch is a grid seen from directly above: lines
stay parallel, the centre circle is a circle, and a player at the goal is exactly
the size of a player at your feet.

There was a shallow pinhole perspective here for a long time, and it was the
single biggest reason the game looked wrong. Everything at the goal end was drawn
at 64% scale — and in a shooting situation the goal end is where all of it
happens, so the goal, the keeper and every defender were a third smaller than
they should have been while the empty grass in front of you was full size. It
read as "too zoomed out" no matter how tight the framing got, because the
tightening was being spent on the part of the frame with nothing in it. Two
screenshots of the reference game settled it: it is flat, and side by side that
is the whole difference.

**Figures are anchored at the FEET.** (px, py) is where a man is standing and it
is where his boots are: the shadow goes there and the body is drawn upward from
it. The figure used to hang off its own middle, so every player was drawn half a
body ahead of the spot he actually occupied — a keeper standing on his line had
his head on the line and his boots two metres in front of it, and looked like he
had come out to meet the ball. It also put the ball, which IS drawn at its ground
point, level with a player's waist instead of his boots.

Sized against that reference rather than against the laws of the game: a sprite
there stands about 7% of the frame's width tall, which is roughly two and a half
metres. Footballers are not two and a half metres tall and it does not matter —
at a true 1.8 m they are specks. The canvas is a tall slice (5:8, was 3:4),
because a shooting situation needs the goal and a player thirty metres off it in
the same frame.

---

**A CROSS IS WATCHED FROM THE SIDE.** A wide ball has two rectangles: a turned
one you aim from, and the ordinary one it cuts to when the ball reaches the area.
From the ordinary camera a crossing position puts the goal off in the corner and
the whole penalty area edge-on; turned a quarter turn, you are looking straight
across the six-yard box at everybody in it, which is the decision a cross
actually asks you to make. It is a CUT, not a pan — the camera is replaced, not
moved, which is the only kind of camera change this game has.

The turn goes all the way down: `toPx` and its inverse rotate together, the
metres-per-pixel spans swap with the axes, **arcs turn with it** — `ctx.arc`
takes screen-space angles, so the D detached itself from the front of the
penalty area and floated out into the middle of the pitch until the angles were
expressed in pitch space — and, the one that would have been a silent bug,
**"beside you" is a fact about the picture, not about the pitch.**
The ball sits on the axis that runs ACROSS the screen, which in a turned frame is
pitch y rather than pitch x. Placing it along x there would have put the ball
back on your chest, in the one situation built to show the box off.

Both frames have to hold everybody who matters after the cut, because the engine
treats outside-the-frame as not-in-the-game: a man stranded outside the second
frame would stop going for the ball the instant the picture changed. You are the
exception, and rightly — you are on the touchline, and once the ball has gone you
are not part of what happens next.

---

**THE RECTANGLE IS THE SITUATION.** The single most important thing in this
directory, and the thing three separate rounds of bugs came from getting wrong.

There is no pitch that the camera visits. A situation is the frame you are
looking at, entire — a run is getting from the bottom of this rectangle to the
top of it, a pass is finding a man inside it, a cross is delivered from its
corner. Nothing outside it is part of the game, so:

- **The camera never moves.** Not to follow the ball, not to lead it, not to
  follow you on a run. It is set when the situation loads and that is the last
  thing that happens to it. Panning was the single most disorientating thing in
  the game, and it is what made a run "start dribbling and then drift toward a
  goal".
- **The frame comes first and the situation is built inside it.** A wide
  delivery has a FIXED rectangle — goal along the top, the D along the bottom —
  and the ball is delivered from the corner of that, not from a flag forty
  metres outside it. Framing the flag meant a frame wide enough to hold it and
  the far post, which at a 3:4 portrait canvas buys fifty metres of depth: you
  could see the halfway line and the goal was the size of a stamp.
- **Everybody is inside it** (`fitToView`), asserted for every kind and seed. A
  man beyond the edge is not off-camera, he is absent — and he used to be, in
  169 byline crosses out of 200.
- **Frames are capped at 46 m** down the screen. What the framing cannot hold
  gets pulled inside rather than the rectangle growing to go and find it.
- **A ball that leaves the frame is gone**, on the tick it leaves, and nobody
  walks off the edge of the situation after it. There is no pitch out there for
  it to roll around on. The margin `stepReactions` stops at has to be the SAME
  one `stepBall` calls "out" on — it was a metre tighter, which left a
  one-metre band where the ball was still in play and everybody had stopped
  going for it.
- **The ball is never in the bottom fifth of the frame.** You aim by dragging
  BACK from it, and a chance at the very bottom is one you cannot pull the arrow
  far enough for — the drag ran off the canvas and the shot stuck. (The drag
  itself is no longer clamped to the canvas either.)

---

**defending** — nobody moves until you kick it, and the keeper does not move at
all.

This section replaced one that described the opposite. The engine used to run a
whole Pressure Curve while you were still aiming: the nearest defender closed
you down, the others slid onto your passing lanes, holding the ball too long
lost it, and team-mates drifted into space at the same time. Playing it, that is
simply not this game. **You have unlimited time to decide. The only action you
take is the strike. Everything else is a consequence of it.**

What the model is now:

- The pitch is frozen during the aim phase. The match loop calls nothing that
  moves an outfield player, and no step function moves anybody without a live
  ball.
- **The keeper is not an exception.** He stands on his line — never more than
  1.6 m off it, asserted for every scenario kind — and he stands still. He does
  not sweep, does not track the flight, and does not move an inch before the
  save animation, which is picked after the outcome is already settled. Where he
  is standing is the whole puzzle: you look at him, and you put the ball where
  he is not.

  **And he dives to the ball he saves.** The save is decided against where he
  was standing — that part is untouched — but until recently that was the end of
  it: the figure stayed put and the ball vanished, so a shot into the corner was
  recorded as a save by a keeper drawn two metres clear of it. Reported three
  separate times as "I scored and it did not count", and the picture was the one
  telling the truth. The same mistake in reverse also had to be undone: the save
  radius had been raised to 2.55–3.35 m to compensate for a keeper who no longer
  moved, which is nearly half the goal. It is back to 1.95–2.65 m — a distance a
  dive actually covers — and the dive is drawn covering it.

  **And the save is judged where HE is, not at the goal line.** He is usually on
  it, so most of the time those are the same test — but about one chance in five
  he has come out, and then they are not remotely the same. Judging at the goal
  line meant a keeper standing five metres off it could save a ball that had
  sailed past him three metres wide: it flew visibly beyond him, and was then
  compared against his x once it reached a line he was nowhere near. He is a man
  standing somewhere with arms of a certain length; the ball either comes within
  reach as it passes him or it does not, and if it does not, he is beaten and
  nothing later changes that. Asserted over 1,500 shots threaded past an advanced
  keeper: none of them saved from behind.

  He used to patrol continuously, and it was wrong in two ways. It turned every
  shot from a placement decision into a timing one, and on screen he was visibly
  gliding back and forth across his six-yard box for no reason a player could
  see. Several scenarios also started him three or four metres out, which from
  this camera reads as a keeper standing on the penalty spot. Removing the sweep
  made him far too easy to beat — a static keeper covering 2.55 m of a 7.32 m
  goal leaves most of it open — so the save radius went up by about 20%, and
  `KEEPER_TIERS` lost the two constants (`amp`, `period`) that described a sweep
  that no longer happens.
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

**THE PITCH**, sampled off the reference rather than chosen by eye — which is
the only reason any of these numbers are right:

    plain grass      rgb(31,144,6)     ours was rgb(20,144,70)
    markings         rgb(224,255,217)  ours landed at rgb(154,204,137)
    goalmouth wear   rgb(78,134,16)    ours had none
    grain            8 luminance levels, p5 to p95

Three things came out of that. The green had **seventy points of blue in it**
that the reference does not, which is why it read as emerald or teal beside it.
The markings were at 0.55 alpha, which over grass lands at a pale grey-green and
made the pitch read as a diagram rather than a painted field. And there are **no
mowing stripes**: six patches sampled at six different heights came back within
two units of each other, where five-metre bands would differ by far more. Ours
differed by twenty-six, and that banding was the loudest thing on the screen.

What the reference does have is a very fine grain and worn grass where a season's
football happens — the goalmouth, the penalty spot, the centre. The grain is
deliberately almost invisible (±4 levels, pinned to pitch space so it does not
crawl when the frame changes); the wear is most of what stops a pitch looking
printed. The floodlight wash and the vignette went at the same time: the
reference is evenly lit end to end, and a gradient across the pitch is a
television idea that fought the flat overhead camera every time.

---

**THE GOAL STANDS UP.** The pitch is a flat plan and the goal is the one thing on
it drawn with HEIGHT: posts standing on the goal line, a crossbar across their
tops, the netting stretched back behind them. That is not a departure from the
overhead camera — it is the same trick the ball already uses, being lifted off
its own shadow — and the goal is drawn at exactly that scale, so a ball over the
bar is visibly over the bar and one that hits the bar hits the bar you can see.

Three versions of this, each caught by rendering it beside the screenshots
rather than reasoning about it, and each mistake invisible from a description:

1. The inside was DARK, and read as a hole cut in the pitch. What you are
   looking at is white netting catching the light.
2. No crossbar — the back edge was the same weight as the mesh, so the frame
   never closed. And the posts had round caps, which put a black blob on the
   grass at each foot.
3. It was still FLAT: a footprint drawn on the ground. Correct to the centimetre
   from directly above, and unrecognisable as a goal, because from directly
   above a goal is a line with a rectangle behind it. Cropping the reference goal
   out of the screenshot and magnifying it settled it — the posts are standing.

Height is therefore drawn at TRUE scale (`heightScale = uy`, was `uy * 0.75`).
Foreshortening it broke the agreement between the ball's height and the goal's,
and that agreement is the only thing that makes drawing height honest on a camera
which is otherwise a flat plan.

It also used to be drawn with `fillRect` off two corners, which silently assumed
the ordinary camera — in a crossing frame that rectangle would have come out
inside out.

**Not** widened. Measured against its own pitch markings the reference's goal is
about 1.4× wider than the laws allow, but its camera is wider too, so on screen
its goal takes the same fraction of the width as ours already does. Widening ours
would either make the picture lie about where the posts are or quietly make
scoring much easier.

**WHERE IT WILL LAND.** A ball in the air gets a mark on the grass at the spot it
will first bounce, and only the first: once it is down you can see where a
rolling ball is going. This is the one thing drawn on the pitch that is not part
of the pitch — every other aid has been taken out — and it earns its place
because height is the single thing a flat overhead camera cannot show you, so
judging a lofted ball is otherwise guesswork.

It is worked out ONCE, at the kick, and pinned. Recomputing it each frame from
the ball's current state was the obvious thing and it was wrong: a curling ball's
projection sweeps round as the curl bites, so the mark crawled across the grass
and chased the ball in.

Pinning it only works if it is right, so it runs the same flight the ball
actually flies — curl, drag, wind — **and at the same integration step**. At the
coarse step used for reading passing lanes it came out 1.17 m long, every single
time: a systematic offset rather than noise, because a bigger step under gravity
consistently overshoots. Matched to the match loop's substep it is 2 cm, and the
suite asserts the ball lands on the mark across 700 curling flights.

**HOW MANY PLAYERS, AND WHOSE.** Counted off the reference: four to seven
opponents in a chance, and ONE team-mate beside you, sometimes two. Ours had it
exactly the wrong way round — two or three team-mates and one or two defenders —
which is why the pitch looked empty at the goal end and crowded around the ball,
and why the offside line was a fiction drawn round the nearest recovering
full-back.

    before   1-2 opponents,  2-3 team-mates
    after    4-6 opponents,  1-3 team-mates

And the team-mate count is **what vision buys**. §13.1 asks that an attribute
widen your vocabulary rather than raise a hidden percentage, and the player's own
words for this one were "vision gives you more players to pass to in scenarios".
So it does, literally: at 30 you have the man in the box and nobody else, at 90
you have three. It used to draw rings over people instead, which is a HUD feature
wearing an attribute's clothes.

The keeper, too, was over-corrected. "Always on his line" made him readable and
made every chance the same question; he is on it about four times in five and
otherwise somewhere out to the front of his six-yard box, which is a different
question and gives the ball somewhere to go it would not otherwise have.

And he is drawn smaller. Measured off the reference: its goal is about five and a
half keepers wide and its keeper is roughly as wide as he is tall — a squat
figure spreading himself. Ours was three and a half goals wide and drawn like an
outfielder in gloves, so he filled the mouth, every save looked inevitable and
every goal looked like it had squeezed past him.

---

**offside** — the law, mapped onto what this game has and nothing invented to
make it fit. There are no body parts here, no referee and no indirect free kick;
every entity is a single point, so a point is what gets compared.

The two halves are kept apart, because conflating them is what makes offside
systems wrong. **Position** is a state, judged once, at the instant a team-mate
deliberately plays the ball, with the pitch frozen for the judgement. **Offence**
is an act: a man who was in an offside position then playing the ball. Standing
in an offside position is legal and is asserted to be.

Three deliberate touches by your side create a snapshot — you striking the ball,
the team-mate you found striking it, and the man in the box poking in a rebound.
Each judges everybody afresh against the line as it is at that moment.

What does NOT clear a flag: a save, a parry, the post, the crossbar, a deflection
off a defender. That is the "gains an advantage" clause and it needs no code at
all — the flag simply survives, so a flagged man who buries a rebound is offside.
What DOES clear it is a deliberate play by a defender: winning a header, or
clearing the ball.

**The trap this rule sets for a game like ours, and the measurement that caught
it.** A real penalty area has a back four in it. Ours has one or two defenders,
and in a one-on-one the only one is BEHIND you, recovering — so the second-last
opponent sits twenty metres from goal and every attacker in the box is beyond
him. Applied straight: **400 of 400 one-on-ones flagged somebody and 391 ended
in an offside.** The law was being applied correctly to positions that were
fiction.

The answer is not to weaken the rule but to place people legally, which is what
footballers do — a striker following a shot in times his run rather than standing
permanently beyond the last man. Support players are now offered space inside the
legal area rather than corrected out of it afterwards, and the poacher drops in
level with the line. He still gets on the end of rebounds, because he reacts to
the ball once it is struck.

**Which exposed something the rule had been hiding.** Defenders were placed
relative to YOU — three and six metres up the pitch from wherever you were
standing — so a long-range chance had a back line thirty metres from its own
goal. That had always been wrong; it only became visible once the offside line
started following it, because your team-mates may not go past the second-last
opponent and so settled level with a line drawn round your feet. Six players in
a knot, twenty-five metres of open grass between them and the goal, and nothing
to aim at but the keeper.

A block belongs to the goal it is defending. It drops as you come deeper, the way
a real one does, and it never comes out to meet you; forwards hold its shoulder
and move ACROSS to find an angle rather than walking back down the pitch to find
a cleaner lane. Measured on the long-range chance — you, the defence, your
forwards, in metres from goal:

    before   you 27.7    defence 23.2    forwards 26.2
    after    you 27.3    defence 13.8    forwards 16.9

That leaves exactly one situation that can produce an offside at your own touch,
and it is the one built around the line: the through-ball's target man has gone
a yard early about a fifth of the time, and playing him in then is an offence you
can SEE — he is drawn in front of the last defender, on a flat camera, with
nothing moving. Everywhere else it arises on the SECOND snapshot, once the ball
has been struck and everybody has reacted into new positions.

Rate across a realistic mix of chances, half of them looking for a man and half
having a go at goal:

    ST    1.0% of chances
    CAM   1.8%
    CM    2.1%

Not modelled, and honestly so: "interferes with an opponent" — blocking a
keeper's line of sight, screening a defender. There is no line of sight in this
engine to block.

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
- **A saved ball has to LOOK saved.** The shot-stopping test decides at the goal
  plane, having just moved the ball to (crossing point, y = 0.02) — and a catch
  or a tip then froze it exactly there. So a save left the ball sitting still in
  the middle of the goal mouth, on the line, which is indistinguishable from a
  goal that was not given, and was reported as one. A catch now ends in the
  keeper's gloves and a tip goes over the bar or round the post and behind the
  line. Gameplay was right and the picture was lying, which is the worse way
  round to have it.
- **A tipped save is pushed AWAY, out in front of goal.** Behind the line and
  outside the post is where a tipped ball really goes, and from directly above
  that reads as the ball sitting in the side netting — worse than the thing it
  replaced.
- **The ball goes BESIDE you and level with your boots, never in front.** The camera looks down the pitch,
  so "in front of you" is "up the screen" — and a figure is drawn up the screen
  from the point it stands on. There is no distance directly in front that reads
  as a ball at your feet: at 1.2 m it looked like a ball resting on your head, at
  2.6 m like one floating above it. Sideways is a different axis. 1.5 m across
  and 0.15 m back — asserted as across > 4 × along, and as within 0.4 m of level,
  which only became meaningful once figures stood on their own feet.
- **First touch is not a dice roll.** Nobody moves before you kick, so a heavy
  touch cannot cost you time — it costs you POSITION. Technique 20 pushes the
  ball 1.7 m away from you, technique 95 kills it inside 0.3 m, and you move
  with it rather than being left standing where it was.
- **The post keeps a lot of the power.** It cannons back out at 78% of the pace
  it arrived with and is loose from that moment: your poacher can follow it in,
  a defender who gets there first hoofs it clear. Only a second ricochet off the
  frame ends it, because that is pinball rather than football.

Outcome distributions the whole engine currently produces (800 full-power
strikes each), measured twice: at the corner away from the keeper, and at the
middle of the goal. **The keeper stands still, so the middle of the goal is the
middle of him** — and the gap between these two columns is the entire game.

                  placed        down the middle
    one_on_one    goal 97%      goal 17%
    tight_angle   goal 45%      goal 13%
    header        goal 57%      goal  5%
    volley        goal 67%      goal 10%
    long_range    goal 38%      goal  5%

The rest is saves and defenders: long range loses 55% to a body in the way and
is meant to, and a header loses 24% to the man marking you.

Note what these numbers are and are not. They come from a bot that hits the
exact spot it aimed at; a finger dragging on a phone does not, and the whole
difficulty of a shot now lives in that gap. When these move, ask whether
placement still pays before asking whether the average went up or down.

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
is a carry **through midfield** — you start at the bottom of the screen and have
to get to the top of it. Swipe to set a direction, keep going that way until you
swipe again; three or four men stand between you and the line, in different
spots, **not moving**, each waking only when you come within seven metres.
Getting through is not the end of the move; §6.1 is explicit that "dribbling is
rewarded when it creates a better football decision", so it chains straight into
a chance built from where you got to.

**Two rounds of measurement changed the design.**

First: chasers were faster than a slow player in a straight line. At 5.0 +
strength they outran a pace-20 player whatever line he picked, and 500 runs at
pace 20 produced not one that got through — pace below a threshold was not
"slow", it was locked out.

Then, from playing it: the run was **over in a second and a half**, on whatever
camera the previous chance had left behind — so it played out framed on a goal
thirty metres away, with a stray defender in the corner of the screen and two
white corridor lines nobody could identify as anything. You could not read it,
let alone play it. What changed:

- Everybody slowed down. You run at 4.0 + pace, chasers at 3.1 + strength, and a
  competent line now takes about five seconds.
- The run is **one rectangle that never moves** (`dribbleViewport`): the line to
  reach across the top, you at the bottom, the men in between, and the corridor
  narrower than the frame so the sides of the run are inside what you can see.
  It is set deep enough in midfield that **neither goal is ever in frame** —
  asserted over 200 full runs. Giving the run a camera that followed you up the
  pitch was the same mistake as inheriting the last chance's camera, in a
  politer form: it looked like the situation was drifting toward a goal.
- Drifting wide **holds you inside the corridor** instead of losing the ball.
  Running out was the commonest way a run ended, which taught you to fear the one
  thing the situation exists to ask of you.
- The diagram is gone: the line to reach is a lit band of turf and the sides of
  the run are the edges of the frame.

Through-rate for a competent line, which is what these numbers assume:

    pace 20   67% through
    pace 50   77%
    pace 80   82%

The older table (27% / 74% / 90%) was measured on the shorter, faster run and is
not comparable — it is quoted above only for the shape of the bug it caught.

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

---

## `outcomes.mts` — every outcome happens, and each one is called what it is

`npx tsx tests/star/outcomes.mts`

An 11,700-chance anomaly sweep over all thirteen scenario kinds found no bad
values at all, and then the outcome-coverage table underneath it found the real
problem: **four of the fourteen outcomes the engine declares had never once
occurred.**

| Outcome | Why it could not happen |
|---|---|
| `saved` | `resolveKeeper` only ever returns catch, tip or a live parry. A shot he pushed away and a defender then belted clear was reported `tackled` — "DISPOSSESSED". One that rolled out of the frame was "Out of play." |
| `post` | Returned only on a SECOND frame hit, which is pinball and never occurred. Hitting the woodwork once said nothing at all. |
| `rebound` | Tested `ball.loose`, which every re-strike clears before the ball reaches the line. Every rebound finish was filed as an ordinary goal. |
| `blocked` | Never returned anywhere in the engine — while `CanvasMatch` had a live branch for it and showed its **BLOCKED** banner for `tackled`, whose own text reads **DISPOSSESSED**. The banner and the line under it disagreed about the same moment. |

All four had commentary written for them; three had sound and screen-shake wired
up to fire. The fix is naming rather than physics: `ball.lastTouch` records who
stopped it, `ball.deflected` records that the chance went through a second phase,
and `stepBall` wraps the physics to say what happened rather than where the ball
finished. `blocked` and `tackled` are now the real distinction — a defender in
the way of a ball **going in**, versus a defender reading one played to somebody.

Three things these measurements caught:

- **The keeper caught 7 balls in 2,484.** The gate was `speed < 17` when the
  median shot he gets a hand to travels at 21.2 m/s, and `margin > 0.5` — which
  sounds like half his reach and is not, because height is folded into the same
  distance and a ball along the ground spends 1.09 m of a 2.4 m budget before it
  has moved sideways at all. Half a metre either side of his boots was the whole
  catch window. A keeper who never holds one is not a hard keeper, he is a broken
  one: it made every save a rebound or a corner. At `speed < 23` and
  `margin > 0.35` he holds about one in ten, palms two thirds clear and spills
  the rest back into play.
- **47.5% of volleys were blocked before they started.** The two defenders were
  placed off YOU — one 1.5 m to your left, one 3 m to your right, both a stride
  in front — so a volley was struck into a pair of shins from two metres.
  `buildLongRange` documents exactly why that is wrong and `addCover` already
  avoids it; the volley was the one situation left doing it, and it is the
  situation where being crowded hurts most. Pushing them back changed almost
  nothing (48.8%) — **two** men spread across a 7.3 m mouth cover it between
  them however far out they stand, and that was the real fault. One man shades
  one side and leaves a lane: blocked 14.5%, scored 30% (was 21%).
- **Losing a 50-50 on a loose ball was reported as a tackle.** Nobody took
  anything off you — it is the scramble going the other way, which is what
  "Scrambled clear" is for. Calling it DISPOSSESSED put the blame for a keeper's
  parry on your last touch.

Measured after: all fourteen outcomes reachable; every chance the keeper ends is
called a save; a ball off the frame either goes in or is reported as the
woodwork; `goal` and `rebound` are never confused; nothing in midfield is ever
"blocked", because there is no goal in the rectangle to block it into.

### …and the line under the result

The same suite caught a second inversion, in the commentary rather than the
physics. `commentaryResult` asks two questions — "was there a man to find?" and
"did the ball get to him?" — and both were answered with the wrong flag.

`chain` was passed `receiverShot`, so a pass that never reached anybody was not
a chain at all and could never be described as a failed pass. `receiverReached`
was passed `receiverDone`, which is cleared the instant he strikes it, so it was
false for every chance where the pass had **worked**. Between them the two lines
were exactly swapped: you picked out a team-mate, he shot, the keeper saved it,
and the game said *"Cut out! A defender reads it well."* — while a ball
genuinely cut out in front of him fell through to a line about your own shot.

Measured over 1,600 chained chances: 1,398 where the ball reached him, all of
which drew from the failed-pass pool; 202 genuine failures, none of which could.
`Scenario.receiverReached` now records that he got it at any point in the move
and is never cleared, and `chain` is simply whether the situation had a receiver.

### …and where the ball finishes

`settleBall` exists so that a ball the keeper has pushed clear is SEEN going
clear rather than found already there. Measured: **74% of settling balls were
off the visible frame within two and a half seconds** — some seventeen metres
past it — and 1,695 of 1,701 were still rolling when the highlight ended. You
watched it leave, and then watched an empty rectangle.

The arithmetic: a tip left the keeper's hand at 9–16 m/s against 1.9 m/s² of
rolling resistance, which is the better part of forty metres of running, in a
frame twenty-six metres tall. Two changes — the tip is now a push to safety
(6–12 m/s) rather than a clearance, and `settleBall` takes the scenario so it
honours the pitch conditions and pulls up at the edge of the rectangle instead
of rolling out of it. There is no pitch outside the frame; `stepBall` already
says so and calls a ball that leaves it "out". Now 0.1% leave, and about half
come to rest against the touchline, which is what a tipped ball does.

---

## Situations that are playable as drawn (in `defending.mts`)

"The rectangle is the situation" is only true if everything the situation asks
of you is inside the rectangle, and if nobody is standing on the ball when the
whistle goes. Both were quietly false.

- **The aim marker could be off the screen.** `passTarget` is documented as
  "where the runner is heading" and is drawn as the marker — but the builders
  hand it a *different object* from the one they hand the runner, so every clamp
  that pulled the runner inside the frame left the marker behind. Measured off
  the frame in **7.3% of build-ups and 4.3% of byline crosses**: you were being
  asked to pick out a man on a part of the pitch the camera will never show you.
- **Somebody could be standing on the ball.** The clamps squeeze everybody
  inward, and at the edges they squeeze two people onto the same square metre. A
  defender inside 1.2 m of the ball in **5.4% of tight angles**; the keeper — off
  his line one chance in five, against a header met three to seven metres out —
  as close as **32 cm**. A defender inside `DEF_BLOCK_R` takes it on the first
  frame, and the keeper smothers anything inside `KEEPER_BODY_R`, so the chance
  was over before the strike left the boot and nothing you could have done would
  have changed it.

The keeper is not shoved away like a defender: a goalkeeper who needs room always
has the same room available to him, which is his own goal. He drops back toward
the line first, and steps across only if being on the line still leaves him
underneath the ball.

---

## `finishing.mts` — where a team-mate puts it

`npx tsx tests/star/finishing.mts`

Reported from playing it: *"when I pass to a teammate, they tend to shoot at the
center of the goal, which almost always is saved."* They did, and it was.

The aim model scattered the receiver around the **centre** of the mouth, in a
window that **narrowed as he got better**:

```
spread = 7 - composite * 0.05        aimX = centre ± spread/2
```

At the top of the range that is ±1.10 m. A keeper reaches about 2.4 m either side
of where he stands. So the better the finisher, the more certainly he shot
straight at him — and loft was subtracted for quality too, so he did it along the
floor. Measured over 1,500 chances per situation:

| | mean aim from centre | crossed within 2.4 m of the middle | height at the line | scored |
|---|---|---|---|---|
| cutback | 1.05 m | **97.6%** | 0.07 m | 16.8% |
| byline_cross | 0.90 m | **99.8%** | 0.13 m | 36.7% |
| corner | 0.99 m | **98.9%** | 0.12 m | 15.3% |
| through_ball | 2.50 m | 48.3% | 0.01 m | 24.2% |

The through-ball was the only one that converted respectably, for an accidental
reason: it is struck from further out, so the **angular** error had more distance
to spray him off the keeper. Being worse at it was the only thing that made it
work.

Three things came out of fixing it:

- **He aims at a side, not at the middle.** Which side is read off where the
  keeper is standing — the same thing the player does by looking at the screen —
  and how near the frame he dares aim rises with quality while his execution
  error falls with it. That is the trade a finisher is actually making.
- **`RECEIVER_CONTROL`.** These chances are not equally easy to *strike*, and the
  engine had no representation of that at all: a centre-back heading a corner in
  traffic was as composed as a striker with the ball rolled across the six-yard
  box. It scales what he aims for and divides into the error he makes, so a hard
  chance is both less ambitious and less accurate.
- **The keeper covers a ball played across him.** Fixing the aim alone took a
  byline cross to **45%**, because the keeper stood exactly where he had been
  when the ball was thirty yards away — leaving five metres of undefended goal
  against 2.4 m of reach. He now shuffles (3.4 m/s, at most 2.6 m) toward the
  angle once the ball is *at somebody else's feet*. He still never reads a shot
  in flight, which is the rule `defending.mts` protects; "does not read your aim"
  and "does not react to the ball being somewhere else" are not the same claim.

A fourth thing fell out of the measurements. In a one-on-one **the ball reached a
team-mate 43% of the time** and the team-mate scored more of them than the player
did — because the poacher is placed at half the distance to the goal, in the width
band the shot travels through, and any shot passing within a flat 2.4 m of him was
read as a pass *to* him. That lane now tightens with pace: a rolled ball near a
man is a pass, a ball struck at 25 m/s is a shot he would have to step into.

Measured after, end to end (the player picking corners, the whole scenario
including the delivery failing):

| | before | after |
|---|---|---|
| cutback | 16.7% | 37.3% |
| through_ball | 21.7% | 35.8% |
| byline_cross | 35.5% | 14.7% |
| corner | 11.8% | 12.2% |
| one_on_one | 43.3% | 55.7% |

The byline cross falling is the same fix as the cutback rising: it was converting
at 36% *because* the keeper never moved, not because anybody was finishing well.
