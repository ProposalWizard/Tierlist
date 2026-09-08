# Star Career — "Life of a Footballer" Event Ideas (Brainstorm)

> Not implemented yet. Pure idea bank, captured so it survives context resets —
> see `CLAUDE.md` → "What Needs Improvement" for the pointer back here.
> Requested: lots of random/triggered events tied to football or a footballer's
> life, deep enough that each has a real trigger, real stakes, and real
> consequences — not a shallow list — so the player is always half-expecting
> something to happen. Events don't all have to be choice-based: some should
> resolve as a wheel spin, a coin flip, or a flat guarantee of something
> good/bad happening, no decision involved.
>
> The existing narrative-choice system this would most naturally extend is
> `lib/star/dilemmas.ts` (`effects: {money, happiness, fame, sponsors, boss,
> team, fans, ...}`). Non-decision events (below) are a new shape for that
> system, not a fit for the existing one as-is.

---

## Mechanic types

Everything below is written as a **choice event** (2-4 options, each with its
own consequence) unless tagged otherwise:

- **[WHEEL]** — a spin with several weighted segments, no player input beyond
  triggering it. Presented as an actual spinning-wheel/slot moment.
- **[COIN]** — a straight 50/50 (or similarly simple binary odds) between two
  outcomes, no player input.
- **[GUARANTEED]** — always resolves the same way when triggered; the "choice"
  is just watching it happen. Used for things that shouldn't be gameable.
- **[CHOICE]** — the default: the player picks between options with different
  risk/reward, same depth as the match-fixing example.

Several events below are written once but flagged as reworkable into a
different mechanic type — noted inline where it's a natural fit.

---

## Integrity & corruption

### The approach — match-fixing bribe **[CHOICE]**
Trigger: mid-table obscurity, a "big" game coming up, low-ish fame.
A man you don't recognize catches you leaving training. He knows your name,
your agent's name, your mother's address. He wants you to concede a needless
free kick in the box in the first twenty minutes, or "not track back" for one
specific corner. Payment: a lump sum, way more than your appearance fee.
- **Take it and do it** — paid immediately. Hidden roll: a betting pattern
  flags your name to an integrity unit. If it hits, weeks later: FA
  investigation, real suspension (months), the fine, boss relationship
  cratered, possibly kicked from the club and forced to sign for a worse one.
- **Take it and don't deliver** — keep the money, play normally. He finds you
  again; next time it's not a request.
- **Report him to the club** — no on-pitch effect, but word gets around the
  dressing room ("that guy") — team relationship swings depending on how it's
  received.
- **Report him to the police** — slowest reward, safest: fame/reputation bump
  later as a "whistleblower," zero money.

### The insider tip **[CHOICE]**
Trigger: random, mid-season. A friend of a friend texts you that a match is
already decided — no fixing required from you, just betting knowledge.
- **Bet on it** — real payout if it plays out, but you're now provably
  connected to a fix even though you didn't arrange one.
- **Screenshot and report it** — reputational upside, the other player's
  career gets wrecked, possible relationship hit with anyone tied to his club.
- **Ignore it** — safest, a wasted-opportunity beat the game can reference later.

### Doping temptation **[CHOICE]**
Trigger: returning from a long injury, low match fitness, a big game looming.
A fill-in club doctor offers something "not technically banned yet."
- **Take it** — performance boost this game; hidden clock: the substance can
  get added to the banned list retroactively and a stored sample re-tested.
- **Refuse, play under-cooked** — worse performance, zero risk.
- **Refuse and report the doctor** — club investigation; may create a grudge
  with that staff member either way.

---

## Discipline & public behavior

### The night out that goes wrong **[CHOICE→escalating COIN]**
Trigger: random, more likely right after a good result.
A stranger films you in a bar, needling you about a missed chance.
- **Walk away** — nothing happens.
- **Clap back verbally** — goes viral either way; a weighted coin flip
  (weighted by current reputation) decides "puts entitled fan in his place"
  (fame up) vs. "loses it at a fan" (fame down, sponsor risk).
- **It gets physical** — police report, club statement distancing itself,
  boss relationship craters, fine/suspension, a tabloid nickname that sticks
  for the rest of the save.

### The teammate's party **[CHOICE]**
Trigger: low team relationship / new to the squad, night before a lighter fixture.
A senior player invites you to something against curfew.
- **Go, stay disciplined** — team relationship up, no downside.
- **Go all in** — team relationship up more, energy/fitness hit next game,
  and a dice roll decides if the manager finds out.
- **Decline** — safe, but reads as stand-off-ish; can gate the captaincy track.

### The red card cover-up **[CHOICE]**
Trigger: sent off for something borderline. Club PR wants a statement blaming
the ref entirely, even the parts that weren't his fault.
- **Tell the truth, own your part** — slow-burn respect from fans/media.
- **Blame the ref fully** — short-term fan approval; if the FA reviews the
  incident and finds you partly at fault, a second, bigger punishment lands
  for "bringing the game into disrepute."

---

## Money & business

### The investment pitch **[CHOICE]**
Trigger: fame/wealth crosses a threshold. A "money manager for other pros"
pitches a scheme — crypto, a restaurant chain, whatever fits the era.
- **Invest big** — rare big payoff, or a total loss + embarrassing headline
  that dents fame/sponsor trust.
- **Invest small "to be polite"** — small guaranteed loss most of the time.
- **Ask your agent to vet it first** — free delay; agent either saves you or
  greenlights it and you're back to the same choice.

### The image-rights fight **[CHOICE]**
Trigger: after a real stat milestone (first hat-trick, POTM, etc.). The club
wants your face on merch/promo without extra payment, citing contract small print.
- **Let it go** — small boss-relationship boost, no money.
- **Push back via your agent** — chance of a real payout, chance of quiet
  club resentment that can leak to teammates.
- **Go public** — big fan sympathy if handled well, real boss-relationship hit.

### The "family emergency" money ask **[CHOICE, can recur]**
Trigger: random once wage crosses a threshold. A relative needs a large,
vaguely-explained sum urgently.
- **Give it, no questions** — happiness/family flavor positive, money gone,
  can recur (they learn you'll always say yes).
- **Give it, set a boundary** — same cost, less likely to recur.
- **Say no** — saves money, real relationship cost that can echo later.

### The endorsement wheel **[WHEEL]**
Trigger: after a genuinely good run of form or a milestone. A sponsor's offer
comes in — the exact terms are presented as a spin: segments range from a
modest one-off fee, to a multi-year boot deal, to (rare) a "worth telling
your grandkids about" mega-deal, to (rare, bad) a brand that turns out to be
controversial and costs you fame when it's later exposed.

---

## Media & fame

### The hot-mic moment **[GUARANTEED trigger, CHOICE follow-up]**
Trigger: post-match, more likely at high fame. You think the interview's over —
it isn't, and you said something honest and unflattering about a
teammate/ref/the training-ground food. The line itself is guaranteed to leak;
the follow-up is a real choice: apologize publicly, double down, or say
nothing and let it blow over (classic high-variance option — sometimes it
just dies, sometimes it festers).

### The rival's callout **[CHOICE]**
Trigger: an established on-pitch rival goes on a podcast and calls you
overrated, or dredges up an old incident.
- **Respond in kind publicly** — fans love a feud (fame up), but it can make
  your next meeting with him genuinely harder (more niggly fouls, hostile away crowd).
- **Take the high road, let it fuel you privately** — a small hidden
  performance boost specifically against him next time.
- **Ignore it entirely** — nothing; its own kind of choice for a quiet-life player.

### The deepfake/fabricated quote **[CHOICE]**
Trigger: random, fame-gated — a fake quote or doctored clip goes viral.
- **Legal action** — costs money, drags out, eventually vindicates you (fame
  recovers plus a bit extra for handling it with class).
- **Let your football answer** — slower recovery tied to actual form.
- **Address it directly yourself** — fastest resolution, but risks a "can't
  take a joke" backlash from part of the fanbase.

### The paparazzi doorstep **[COIN]**
Trigger: random, fame-gated, more likely after a bad run of form or a public
relationship event. A photographer catches you somewhere unflattering (leaving
a casino, an argument in public, nothing at all really). Coin flip: it's a
non-story that fades in a day, or a tabloid runs three follow-up pieces and it
costs you a real fame/happiness dip for a couple of weeks.

---

## Health, body, and mind

### Playing through it **[CHOICE]**
Trigger: carrying a knock (existing injury system) with a big fixture on.
Physio says don't start; manager hints he'd like you to.
- **Play anyway** — short-term team/boss love if it goes well, real risk the
  injury gets significantly worse (longer layoff than the original).
- **Sit it out** — no extra risk either way; a "we needed you" flavor beat if
  the team struggles without you.

### The mental health dip **[CHOICE]**
Trigger: after a bad run of form or a heavy personal event.
You're not sleeping right; training feels heavier than it should.
- **Talk to the club psychologist** — no flashy reward, genuine recovery
  curve on form/energy over following weeks, framed honestly.
- **Push through, say nothing** — faster short-term, higher chance of a
  bigger blow-up later (public incident, sudden request to be left out).
- **Talk about it publicly, unprompted** — big fan/media respect swing (well
  received in real football culture now); no on-pitch effect.

### The "miracle" recovery clinic **[CHOICE, hidden roll]**
Trigger: mid-rehab from a real injury, high impatience.
An associate suggests an expensive, semi-legit-sounding clinic abroad.
- **Go for it** — hidden roll: genuinely accelerated recovery, OR it does
  nothing (money and time burned), OR (rare, bad) it actively sets you back.
- **Trust the club's own medical staff** — the known timeline, no risk either way.

### The injury freak roll **[COIN, low-frequency]**
Trigger: any match, very low base chance, rises with existing fatigue (ties
into the real energy/injury systems already in the game). A pure bad-luck
coin flip completely outside the player's control — a reminder that not
everything in a footballer's life is earned or deserved.

---

## Career, ambition, and other people's plans for you

### The international call-up dilemma **[CHOICE]**
Trigger: eligible for a call-up (form/reputation threshold), clashing with
club fitness concerns or a nagging knock.
- **Go, chase the cap** — fame/milestone upside, energy cost, injury-risk tick.
- **Withdraw citing injury** — club loves you, country's press don't; a
  pattern eventually stops the national manager calling.
- **Let the club quietly manage it for you** — protects you physically, but
  if it ever comes out, real credibility hit with your country's fans.

### The transfer whisper **[CHOICE]**
Trigger: random, more likely with rising form/value or <18 months on your deal.
A journalist "friend" tips you that a bigger club is watching — nothing official.
- **Let it leak** — pressure on your club to offer a new deal or cash in;
  boss relationship dips regardless of outcome.
- **Shut it down publicly** — boss/fan love here, but if the move was real
  and now dead, a missed-opportunity feeling later.
- **Say nothing** — slowest burn, most realistic; resolves as its own later event.

### The "be a leader" ultimatum **[CHOICE]**
Trigger: established starter, captaincy-eligible, current captain out of form
or in the manager's bad books.
- **Step up publicly** — real shot at the captaincy track; team relationship
  swings on how it lands.
- **Stay in your lane** — safe, but the manager remembers you passed.

### Testimonial / benefit match politics **[CHOICE]**
Trigger: a veteran, long-serving teammate retires.
Asked to play in his testimonial for free, on a day the club would rather rest you.
- **Play** — meaningful team-relationship boost, small fatigue cost.
- **Skip it, cite rest** — boss approves, teammates quietly don't forget.

### The contract-year gamble **[CHOICE]**
Trigger: entering the final year of your deal.
- **Sign an extension early, take a slight discount for security** — locks in
  stability, boss loves it, no drama.
- **Run it down, bet on yourself** — higher potential payday/bigger move if
  form holds, real risk of an injury or bad season crashing your value with
  no safety net.

---

## Family and personal life

### The proposal/relationship milestone **[CHOICE]**
Trigger: tied to relationship length, if the game tracks a partner.
- **Propose publicly (post-match, on the pitch)** — huge fame spike, real
  backlash risk if it reads as attention-seeking or goes wrong.
- **Propose privately** — no game-facing reward, a clean warm happiness beat.

### A child is born **[CHOICE, deliberately low-stakes]**
Trigger: relationship-gated, low frequency, high impact.
- **Miss the game, be there** — universally positive reception (this is a
  real, current football-culture norm now); small energy/happiness boost, no
  downside — deliberately, since punishing this would misread how the sport
  actually treats it today.
- **Play, fly out after** — realistically divisive: some fans respect the
  dedication, some don't; partner relationship takes a real hit either way.

### A childhood friend's business pitch **[CHOICE]**
Trigger: random, personal rather than professional — someone from before fame.
He wants you to bankroll his gym/boutique/whatever with your name attached.
- **Back him fully** — real financial risk; if genuine, a long-running
  "his business is thriving" flavor thread.
- **Offer advice/contacts, not money** — protects you financially, tests the
  actual friendship.
- **Say no** — safest, can produce a real "he stopped talking to me" beat later.

---

## Smaller, high-frequency flavor events (volume/texture)

Meant to fire often and cheap, so the world feels alive between the big
choice-driven events. Mostly [GUARANTEED] flavor text with a tiny stat nudge,
occasionally a [COIN]:

- **Pre-match superstition breaks [COIN]** — boots aren't ready, someone's in
  "your" seat on the bus, wrong boot on first — cosmetic flavor, maybe a tiny
  confidence nudge.
- **A kid's letter/drawing arrives** **[CHOICE]** — reply personally (small
  fame/goodwill) or let the club's PR team handle it (nothing).
- **Asked to be a teammate's best man [GUARANTEED]** — pure relationship
  flavor, no stat risk, "your life outside football exists" beat.
- **Recognized somewhere unexpected** (hospital waiting room, on holiday
  abroad) **[GUARANTEED]** — small fame tick, low-stakes human moment.
- **A young player idolizes you, wants advice [CHOICE]** — mentor him
  (long-run relationship/reputation payoff, a later "he credits you in an
  interview" callback) or brush him off.
- **Physio catches you skipping recovery work [CHOICE, escalating]** — a
  small, frequent nag; repeated ignoring escalates into the bigger
  injury-risk events above.
- **Free boots/gear delivery [WHEEL]** — a sponsor box arrives; spin for
  what's actually decent vs. what's a dud, purely cosmetic/flavor.
- **Fan meet-and-greet goes long [CHOICE]** — stay and sign everything (fan
  boost, late to the next thing) or leave on time (nothing).

---

## Non-decision mechanic examples (explicitly requested)

Standalone ideas built FOR the wheel/coin/guaranteed shape rather than
choice, so the roster isn't just choice-events with a spinner bolted on:

- **Squad number lottery [WHEEL]** — arriving at a new club, before you pick
  a preferred number, a wheel of "available numbers this transfer window"
  decides what's actually on offer; some are glamour numbers, some aren't.
- **Player of the Month shortlist reveal [WHEEL]** — if nominated, watch the
  wheel land on you or one of the others — the tension is in the spin itself,
  not a choice.
- **Boot deal renewal roulette [WHEEL]** — every few seasons, existing boot
  sponsor's renewal offer is randomized across a real range (small bump,
  big bump, flat, they drop you entirely) with no negotiation — you find out
  by watching it land.
- **Coin-flip penalty shootout call [COIN]** — before a shootout you're
  involved in, the actual "heads or tails" call for who goes first, rendered
  as a real coin flip rather than text.
- **Christmas bonus [GUARANTEED, seasonal]** — every December, a fixed,
  guaranteed small money/happiness bump — no roll, no choice, just a nice
  guaranteed beat to look forward to on the calendar.
- **Testimonial book/documentary offer arrives [COIN]** — late-career only;
  a flat coin flip on whether it's a respected, well-received project or a
  cash-grab that ages badly, discovered after the fact rather than chosen.
- **Training-ground prank war [WHEEL]** — random low-stakes team-bonding
  event, a wheel decides which teammate gets you (or you get) this week —
  pure flavor, small team-relationship tick regardless of outcome.
- **Awards-night seating draw [WHEEL]** — at a big end-of-season awards show,
  who you're seated next to is a spin — flavor text varies (a rival, a hero
  of yours, a pundit who's been critical of you) with no mechanical effect,
  just texture.
- **Weather-day welfare check [GUARANTEED]** — an extreme-weather matchday
  (storm, heatwave) guarantees a specific flavor beat (delayed kickoff, a
  brutal-conditions callout in commentary) with no choice attached.

---

## Design notes for whenever this gets built

- The bribery/doping/scam-style events are the most interesting because the
  consequence is **hidden and delayed**, not instant — that's what actually
  sells "this might happen" tension, since the anxiety isn't just "what do I
  pick" but "did that thing from months ago just catch up with me."
- Recommend building a handful of the hidden-delayed-consequence ones as the
  backbone (match-fixing, doping, the investment scam, the transfer leak),
  then leaning on the cheap high-frequency flavor events to keep the world
  feeling busy in between.
- The non-decision mechanics (wheel/coin/guaranteed) are best suited to the
  higher-frequency, lower-stakes end of the list — they keep things moving
  without demanding a decision every time something fires, which matters if
  these are meant to be frequent enough that the player is "always half
  expecting" one.
