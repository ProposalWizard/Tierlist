# Events v2: follow-through, real gameplay, and stories that come back

For Harry and Mikey. 20 Nov 2026. Design only: nothing in the repo was changed.
Built on `docs/plans/living-world-design-2026-11-20.md` (v1) and Harry's 16:00 note in `docs/plans/LIVING_WORLD_IDEAS.md`.

**Key point.** An event stops being one card with three buttons. It becomes a **talk of several rounds**, which can
**launch a real game mode**, inside a **named story of 3 to 8 beats** that runs for weeks or seasons, with
**promises** that sit in your phone until they are kept or broken.
**Key number.** 3 arcs written in full: 27 events, 139 talk nodes, 304 replies, 11 promises, 4 debts, 8 game modes
used (counted by `work/check.py`). One v2 event is about 5.8 KB of data against 2.1 KB for a v1 event (measured).
**Key change.** "Kit man offers to stay out with you" used to end at the button. Now yes means you play the drill,
he counts it, he tells the gaffer in the morning, your best goes on the kit room door, and three seasons later he
retires and holds you to what you said on the back step of his van.

What I did and did not check:
- **Read:** the v1 design, `lib/star/life/*` (types, director, cond, text, validate), the 30 live events and the 80 on
  the pilot branch, the one-engine rules, every playable mode named below, the decision-screens proposal, the de-ai skill.
- **Measured:** the counts and sizes above; the de-ai detector's numbers in part 6.
- **Saw:** every storyboard picture (I looked at each one).
- **Reasoned, not measured:** save size, API cost, and every "days" figure. None of the new format runs in the game.

Files:
- `arcs.json`: the 3 arcs, every round of dialogue, in the v2 format.
- `storyboard/00-contact-sheet.jpg` and `storyboard/01…17-*.png`: the kit man arc as 17 phone screens.
- `work/`: the checker, the mock-up page and the render script.

---

## 1. What the big story games do (mechanisms, not plots)

A link means the claim is on that page. "(memory)" means it is my own knowledge of the game and I did not find a
page for it today. I could not open the GDC talks themselves.

### GTA V
- **Strangers and Freaks are chains, not single missions.** A "?" on the map starts one; later parts unlock as you
  progress, with no fixed moment ([Gamepressure](https://www.gamepressure.com/gtav/strangers-and-freaks-missions-1/z18d1d)).
  One chain is five tow jobs for the same woman, each asked for separately
  ([GTA Base](https://gtabase.com/grand-theft-auto-v/strangers/)).
- **The phone starts things.** A contact rings you, or you ring them, and that is the mission start
  ([Gamepressure, order of missions](https://www.gamepressure.com/gtav/unlocking-missions-order/z35617)).
- **Each chain belongs to one contact** with one voice and one kind of job (memory).
- **Take:** a story has an owner (a person), an entry point you can see (a marked bubble on him), and its next part
  arrives by phone when you have moved on.

### Red Dead Redemption 2
- **Stranger missions come in parts**, given by the same or a different person, and can be done in any order
  ([GTA Base](https://gtabase.com/red-dead-redemption-2/strangers/)). Some make you wait real days between parts
  ([Segmentnext](https://segmentnext.com/rdr2-stranger-missions-guide)).
- **Letters arrive later.** After some stranger missions a letter is waiting at a post office
  ([Red Dead Wiki, Strangers](https://reddead.fandom.com/wiki/Strangers)).
- **Honour** changes prices and how people treat you ([Red Dead Wiki, Honor](https://reddead.fandom.com/wiki/Honor)).
- **Camp talk reacts to what you just did**, and a stranger you never go back to moves on without you (memory).
- **Take:** gaps between parts are part of the story. The quiet follow-up (a letter, a note in a boot) often lands
  harder than the scene. If you never turn up, the story still ends, and it ends differently.

### Shadow of Mordor: the Nemesis system
- An ordinary enemy becomes a named character **because of something the player did**; the game tracks each fight
  in detail, down to scars on the face ([GamesRadar](https://www.gamesradar.com/shadow-mordor-nemesis-system-amazing-how-works),
  [Game Developer](https://www.gamedeveloper.com/design/core-system-analysis-of-middle-earth-shadow-of-war)).
- The designers wanted the **competition and revenge of multiplayer and sport**
  ([PC Gamer](https://www.pcgamer.com/shadow-of-mordors-nemesis-system-inspired-by-multiplayer-sports)). It was
  partly inspired by football rivalries, which is why it fits us
  ([GamesBeat](https://gamesbeat.com/shadow-of-mordors-nemesis-system-draws-from-burnout-football-and-an-architecture-book/)).
- It is "a relatively small number of overlapping systems" (Mike Bithell, quoted in
  [PC Gamer](https://www.pcgamer.com/why-hasnt-anyone-copied-shadow-of-mordors-nemesis-system)).
- **The parts** (memory): a title, strengths and weaknesses, a promotion when he beats you, a return with a scar
  and a changed trait when you beat him, and a taunt that names your last meeting.
- **Take:** five small parts. A trigger (what happened), a record (meetings), two traits, a title that is rebuilt
  after each meeting, and a rule for what he gains when he wins.

### Football Manager
- **Promises** are a currency in a negotiation, with a deadline, and a broken one can upset the player and then
  the squad ([RealSport](https://realsport101.com/article/football-manager-2022-promises-reworked-opinion-guide),
  [Magic Game World](https://guides.magicgameworld.com/football-manager-2021-what-are-the-consequences-of-a-broken-or-failed-promise/)).
- **Its failure is the lesson.** Players hate promises that fail for reasons they cannot see: one was marked broken
  after the player scored three penalties
  ([SI bug tracker](https://community.sports-interactive.com/bugtracker/previous-versions/football-manager-2023-bugs-tracker/dynamics-interactions-press-conferences-club-vision-supporter-confidence-staff-appointments-meetings/set-as-penalty-taker-promise-not-successful-r15873)).
- **Take:** every promise shows its date and exactly what keeps it, from the day it is made. Never a surprise.

### FIFA 17 The Journey
- One rival who starts as a friend (Gareth Walker), three answer tones, and events that "happen no matter how
  you're performing on the pitch" ([Wikipedia](https://en.wikipedia.org/wiki/FIFA_17),
  [GameSpot](https://www.gamespot.com/reviews/fifa-17-review/1900-6416526/)). FIFA 18 promised real branches after
  the complaints ([Engadget](https://www.engadget.com/2017-08-24-fifa-18-the-journey-alex-hunter-interview.html)).
- **Take:** our beats must read the match. The gaffer quotes your drill score; the legend's TV line depends on
  your rating that night; the nemesis duel is scored from the real game.

### Telltale
- Covered in the decision-screens proposal: "will remember that" only works if something comes back. Stories
  branch and then rejoin at fixed points (memory).
- **Take:** we branch inside a beat and rejoin between beats. What carries across is a few small values (who won,
  what was wagered, was the promise made), not a separate script per path. That is what keeps 1,500 events writable.

### Disco Elysium and Citizen Sleeper
- Citizen Sleeper's **clocks**: a ring that fills as time passes or as you act, and something happens when it is
  full. They come from the tabletop game Blades in the Dark
  ([Rascal](https://www.rascal.news/tracing-citizen-sleepers-circuitous-vector-from-tabletop-to-hit-video-game/),
  [Game Developer](https://www.gamedeveloper.com/business/how-citizen-sleeper-was-inspired-by-tabletop-rpgs-and-gig-work)).
- Disco Elysium: a talk remembers what you said earlier in the same talk, and failing a check opens a different
  line, not a dead end (memory).
- **Take:** a clock is the simplest honest way to say "this is coming". Two clocks racing (the legend rates you /
  the legend has gone off you) make a relationship that can go either way.

### Hades
- After every run, each character has new lines chosen from the state of that run, and the writers can weight which
  come up first ([Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death)).
  Lines carry a priority and unlock conditions ([Film Stories](https://filmstories.co.uk/?p=83138)).
- **Take:** a repeated activity should never repeat its talk. Thursday on pitch two has a different opening line
  for night 1, night 3, after a snub, and after a new best.

### The nine mechanisms we take
| # | Mechanism | From | In v2 |
|---|---|---|---|
| 1 | A story has an owner and a marked way in | GTA | `entry: offer` puts a gold bubble on that person's round menu |
| 2 | Parts with real gaps; quiet follow-ups | RDR2 | arc beats with `after: weeks / seasons`; letters and notes |
| 3 | It ends even if you never come back | RDR2 | `ifIgnored`, `@ignore` endings, expiry |
| 4 | Rivals made from what happened | Mordor | the nemesis generator (part 2d) |
| 5 | Promotion, scar, title, taunt | Mordor | `nemesis.promote`, `scar`, title rebuilt per meeting |
| 6 | Promises with visible terms | FM (and its mistakes) | `promise` and `debt`, listed in the phone |
| 7 | The story reads the pitch | The Journey's weakness | match objectives; lines that quote your score and rating |
| 8 | Clocks | Citizen Sleeper | arc `clocks`, one or two per arc |
| 9 | Talk that advances each time | Hades, Disco | talk nodes with conditions on arc state and on the talk so far |

---

## 2. The v2 format

Everything is **added** to v1. A v1 event with no new fields still loads and plays as it does today. The full
field list is in `arcs.json`; this is what each part means.

### 2a. Talks of several rounds
A talk is a small map of **nodes**. A node is one person speaking and 2 to 4 replies. A reply goes to another node,
or ends the talk.

```
talk
  start        the first node
  nodes        id → { who, say[], replies[] }   or   { activity, result[] }
  reply        label, tone, goto | end, silent?, requires?,
               mood ±n      the talk's running mood: how he is taking you
               set [..]     a note for later in this same talk ("snapped")
               var {..}     a value the whole arc keeps ("tell the gaffer: yes")
  ends         name → outcome (the v1 outcome: text, effects, npc, remember, followUp)
               plus  arc, promise, debt, objective, nemesis
```

- **Tone memory inside the talk.** `mood` goes up and down as you answer. Later lines read it: the legend only
  raises the bet to your car if you have made him laugh. `set` remembers one thing you said: Den's next line is
  colder if you told him he washes the kit. Both are thrown away when the talk ends, so they cost nothing in the save.
- **Lines change with what happened.** `{if arc.last>=50}…{/if}` is the same `{if}` v1 already has, reading arc values.
- **Exits.** Every node has a way out. Silence is still a reply, and at most one per node. Walking away is an ending
  with its own result, not a cancel button.
- **Limits the checker enforces.** Proposed: at most 8 talk nodes in a row before a game or an ending (the longest path in the
  three arcs is 13 nodes, and that includes two games). A reply is 72 characters or under; a spoken line 240 or under, the same
  limits as v1.
- **Which screen.** Unchanged from the decision-screens ruling: `telltale` for a talk and for forced moments, `dial`
  for the gaffer, the press and speeches, and the Sims round menu to get in.

### 2b. Activities: a reply that launches real gameplay
A node can be an **activity** instead of a line. The game mode opens, you play, and the result picks the next node.

```
activity
  mode         one from the list below
  dials        that mode's own settings (balls, distance, opponent, light)
  stakes       wager: your car, boots, a week's wage, a signed shirt, pride
  watchers     who sees it (a squad memory is written if the squad watched)
  caller       who talks during it, and his lines (Den counting in tens)
  canAbandon   stopping early is a result, with its own talk
  fallback     a skill check for a device that cannot run the mode, or null
result         abandoned · won · lost · score bands → the next node
```

After it, lines can quote the score (`{activity.tens}`), and the arc can keep it (`best`, `last`).

**Rules.**
1. **One engine.** A football activity mounts an existing mode through `EngineFeature` / `EnginePlay`
   (RUL-ENG-002). No event gets its own football. 3D games stay in `lib/star/play3d/` (RUL-3D-001).
2. **Not built, not in the game** (Mikey). An event whose activity has `fallback: null` and whose mode is not
   built is left out of the pool. The legend never fires as a dice roll.
3. **The fallback is only for a device that cannot run the mode**, and only where a dice roll does not gut the
   event. The kit man's drill has one. The 1v1 has none.

**What exists today, and what must be built.** "Wrapper" means a small file that sets the dials and reports the
score, like `relgames/WoodworkChallenge.tsx` does now. Days are my estimate for one builder.

| Activity in the book | Mode | State today | Work |
|---|---|---|---|
| A hundred balls, target drills, "beat the door" | `strike-drill`: training's own strike drill (`buildStrike` + `EngineFeature`) | Exists; real engine | Wrapper + dusk light + corner targets + caller lines: 1.5 days |
| Crossbar for the ward, shirt-number duel | `crossbar`: 3D training crossbar (your shots are the real engine) | Exists | Wrapper: 0.5 day |
| Woodwork with two team-mates | `woodwork` (relgames) | Exists | Wrapper: 0.5 day |
| Penalties for the armband, pens bet | `penalties`: trial and boss penalties | Exists | Wrapper + "his go" shown: 1 day |
| A full shoot-out | `shootout` (ShootoutPlay) | Exists | Wrapper: 0.5 day |
| Free-kick bet | `free-kicks` (trial free kicks) | Exists | Wrapper: 0.5 day |
| Keep-ups with a mate | `two-touch` (play3d) | Exists, PC and phone | Wrapper: 0.5 day |
| Wembley, headers and volleys, free roam | play3d drills | Exist | Wrapper: 0.5 day each |
| Go in goal for the kids | `goalie` (GoalieMode) | Exists, but tied to the casino's money code | Untie + wrapper: 1 day |
| Race him | `pace-sprint` (play3d) | Exists on a pitch | Garden setting: 1 day |
| Your horse runs | `horse-race` | Exists (v1 minigame) | None |
| You feed, he shoots | `feed-drill` | Passing through the gate exists; the shooter does not | 1.5 days |
| **1v1 in the ring** (legend, cage, right side only) | `duel-1v1` | **Does not exist.** Closest: the 3D dribble run (`play3d/dribbleRun.ts`) | **3 to 4 days.** One man who waits, a ring, first to three; his goes are rolled and shown, as the crossbar team-mate's are |
| You against him, in a real match | `match-duel` | Does not exist | A scoreboard over the real match that reads goals, dribbles and cards. No new football. 1.5 days, plus the engine warning if he is to be your marker |
| Testimonial, charity game | `testimonial-match` | Does not exist | The real match through `EnginePlay` with invited squads, 20 minutes: 2 days |
| Five-a-side | FiveASide | Exists but is still an engine copy (FACT-ENG-003) | Port first (already on the list): 3 to 5 days. Until then no event may use it |
| **The host** | the piece that opens a mode from a talk and hands back the result | Does not exist | 2 days, once |

Build order: host → strike-drill → crossbar and penalties → duel-1v1 → match-duel → the rest.

### 2c. Arcs: a named story of 3 to 8 beats
```
arc
  id, title, summary
  cast        the people, picked once at the first beat and kept
  vars        up to 8 small values (who won, what was wagered, your best)
  clocks      up to 2: segments, what ticks them, what happens when full
  beats[]     id, when it can fire (after: weeks | seasons | a clock | a promise | a fixture),
              requires, repeat?, and the event itself
  ends[]      the named endings, shown on the People page under "Stories"
```
- **State is small on purpose.** Beats branch inside; between beats only the `vars` carry over.
- **Clocks** tick on moments the game already has (`season-end`, `after-match`) or on an ending.
- **Time gaps are real.** `after: { seasons: [2, 8] }` waits. The director treats a due beat like a due follow-up:
  it goes first.
- **If you change club.** A beat can have a `variant` (Den rings from the old club's landline). People with a
  strength-3 memory are already kept when they leave (v1).
- **A beat can repeat** (`repeat`): Thursdays on pitch two is the same beat up to 12 times, with a different
  opening line each time.
- **A beat can start another arc** (`startArc`): the kid you feed becomes "The kid".
- **Star pass stops** are arcs with `starPassStop` on a beat. The legend at level 10 and you in the circle at level
  80 are the first and last beats of one arc.
- **Where you see it.** People page → a person → "Stories": the title, the beats so far as dots, the clock as a
  ring, and the promise. Future beats show as "?". The storyboard's frame 09 shows this.

### 2d. The nemesis and ally generator
Nobody writes a nemesis in advance. A rule promotes an ordinary person when something happens.

| Part | What it is |
|---|---|
| Origin | A foul that injures you for 2+ weeks; your red card on him; a snub; an unpaid wager. Any ending can also say `promote: nemesis` |
| Record | Who, origin, tier 0 to 4, two traits, one scar, a title, up to 6 meetings, the feud clock |
| Traits | One style (hatchet man, talker, golden boy, grafter) and one weakness (hot-head, slow on the turn, hates the press, pays his debts). Each has one rule in a match or off the pitch |
| Scar | One thing that stays visible: your ankle strapped all season; the clip of your nutmeg pinned under his name; his ban with your name on the report |
| Title | Built from the last meeting: "the man who did your ankle" → "Two-nil Brandt" → "the man who never got the ball" |
| Promotion | He wins a meeting: tier +1, and next window he moves to a bigger club or gets the armband. You win: he comes back having learned (your favourite side is covered) |
| Callbacks | Tunnel line by trait and last meeting; the tabloid man asks about him before each game; his new club shows in your summer list with "Brandt plays here" |
| Ally | The same record with the sign flipped. A truce, or signing for his club, turns a nemesis into an ally who vouches for you |
| Cap | 3 nemeses at once (v1's rivals cap) |

**One thing to decide (D1).** Opponents at clubs with real squads are real footballers. The generator would be
writing taunts and a tackle story for a real person. My recommendation: **a nemesis is only ever an invented
player** (a club with no real squad, a generated youth player, an invented signing). The v1 checker already bans
real names in written lines; this keeps that rule true at run time.

### 2e. Promises and debts
```
promise   id, to (who), text (what your phone shows), due (weeks | a beat | a date | a fact),
          keptBy (the exact thing that keeps it), remind?, cost?, kept{…}, broken{…}
debt      the same, for something owed after a wager: a car, a signed shirt, a favour
objective a promise the match can keep: "score in the next 2 matches"
```
- **Phone → Promises** lists every open one with the date and what keeps it. This is the FM lesson: you can always
  see the terms.
- A promise is made **only by a reply the player picks**. No promise is made for you.
- **Kept** writes a strength-3 memory and usually opens the next beat. **Broken** writes one too, tells the squad
  if they would know, and can tick a clock.
- A reminder comes 1 to 2 weeks before (a text). If you have changed club the promise still stands, and keeping it
  costs more (a day, part of a week's wage).
- Limit: 6 open promises at once. A seventh ask shows "You have a lot on" beside the reply.

### 2f. Places: where events live
Harry's three changes: the shop's spot becomes the training compound; the shop moves to a bigger shop; the garden
grows in levels.

**The map after the change**
```
            [ TRAINING COMPOUND ]  ← stands where the shop stood, at the top of the garden path
                    │  doors (same door mechanic as the shop has today)
 [ HOUSE ] ──── [ GARDEN ] ──── gate ──── [ THE ARCADE: the bigger shop ] ── [ CASINO ]
                    │                          (drive or walk; barber, boot room, car floor)
               garden levels 1-5
```

| Place | What is there | Events that live there | Share of the 1,500 |
|---|---|---|---|
| **Training compound** (new; PC open plan, phone one room at a time) | Car park, reception, changing room, kit room, boot room, gym, physio, canteen, gaffer's office, pitch one (first team), pitch two (extra work), the bottom pitch | Kit man, legend, new signings, the kid, pranks, the gaffer, physio, canteen tables, every "stay behind" drill, 1v1 ring, crossbar bets | about 420 |
| **The Arcade: the bigger shop** | Today's shop floor plus a barber, a boot room with the sponsor rep, a car floor, a café, a street outside | Fans who stop you, the rep and the wrong boots, a rival buying the same car, a paparazzo, the barber's talk, signing sessions, a team-mate short at the till | about 180 |
| **Garden** (levels below) | Bench, team-mates, horse, the training corner, later the cage and the track | Social actions, mates round at yours, the horse, Den's bag, foot races, the kid's Thursdays in later years | about 160 |
| House (every tier) | Sofa, TV, fridge, bed, mirror | Calls, texts, family, the TV verdict, letters on the mat | about 300 |
| Stadium | Tunnel, mixed zone, dressing room, directors' box, car park | Walkout taunts, the press, nemesis meetings, testimonials | about 220 |
| Driving and the city | Car, services, cricket club, cage pitch, hospital | Agent calls, drives with a mate, presentation nights | about 220 |

**Garden levels.** `harry-answers-round.md` (21 Oct) already says: a garden level, XP from garden training drills
and casino play, levels give more space and areas. Today the garden only follows the home you own
(`lib/star/gardenLevel.ts`). Proposal: garden level = the **lower** of (a) what your star pass and club size allow
and (b) what your home has room for, so buying a mansion in League Two does not skip the story.

| Level | Unlocks at (placeholder: Mikey's levels) | New in the garden | Events it opens |
|---|---|---|---|
| 1 | Start | Lawn, bench, one goal | Chats, a kickabout |
| 2 | Star pass 10 or a League One club | Training corner (cones, a wall), room for 3 mates | "Hundred balls" at home once you own Den's bag; crossbar bets |
| 3 | Star pass 25 or a Championship club | Stable and paddock, the car port | Horse events, drives starting from home |
| 4 | Star pass 45 or a Premier League club | The cage (5-a-side size), floodlight | 1v1 rematches at yours, the sponsor's cage shoot, team nights |
| 5 | Star pass 70 or a Champions League club | Riding field and track, a pool, guest house | Family staying, the kid's sessions, your own testimonial |

A story reward can unlock a garden thing directly (Den's bag → the hundred-balls corner). That is "events rather
than gifts" from Harry and Mikey's chat.

---

## 3. The three arcs (all in `arcs.json`)

| | A hundred balls in the dark | The legend in the circle | The man who did your ankle |
|---|---|---|---|
| Kind | Written | Written; star pass stops 10 and 80 | **Generated** from a tackle; one worked example |
| Beats | 10 (7 on the main line) | 8 | 9 |
| Runs over | 3 to 11 seasons | 12+ seasons | 5 to 14 seasons |
| Rounds | up to 7 in the first talk | up to 6 before the game | up to 4, on a clock |
| You play | The strike drill (repeatable), crossbar, feeding a kid | The 1v1, three ways; kids' penalties in goal | The real match as a duel; 1v1 in a cage; penalties; his testimonial |
| Memory | "stayed out with him", "the empty chair", your best on the door | "beat him in the circle", "ducked him", "welshed on the bet"; the squad saw it | Every meeting, his scar, his title |
| Promise | Be at his night when he retires; say a few words | Give out the medals in May; go to his box on goal 213 | The signed shirt; the summer school; play in his last game |
| Clock | Den's last seasons (3) | He rates you / he has gone off you (6 each, racing) | The feud (6, goes both ways) |
| Seasons apart | Offer → his night 3 seasons on → you feed a kid 2 to 8 after that | 18 → the call before a final → goal 212 → you in the ring at 30 | The tackle → return fixtures → his move → the cage → his last game |
| Ends | The bag moves on · the empty chair · you went in | The circle carries on · a recovery session | Old enemies · team-mates · never shook hands |

**In one line each.**
1. **Kit man.** Say yes and you play ten balls that count as a hundred; he tells the gaffer; it becomes Thursdays;
   your best is chalked under the old number nine's 94; you promise to come when he retires; years later you roll
   the balls for a kid.
2. **Legend.** First to three in a ring of team-mates for his cup final boots or your car; after that he is on the
   television for your big games, and two clocks decide whether he rings you the night before a final or says he
   would sell you; at 30 an 18-year-old asks you for first to three.
3. **Nemesis.** A centre-half puts you out for weeks and comes to the physio room; a signed shirt rides on the
   return fixture; each time he wins he goes up a level; it ends in a cage for a boot advert, outside the
   referee's room, on the peg next to his, or in his last game.

**Storyboard: the kit man arc, 17 screens** (`storyboard/`). 01 the round menu with the gold "Stay out" bubble ·
02-05 four rounds of talk · 06 the drill on the real training screen · 07 the score and round 5 · 08 the van and
the promise · 09 "Den will remember that" and the promise card · 10-11 next morning, the gaffer on the tone dial,
a match objective · 12 Saturday, ten fingers and the note in your boot · 13 one season later, the kit room door ·
14 three seasons later, the promise is due and you play for another club · 15 kept: the bag · 16 broken: the
empty chair and his letter · 17 eight seasons later, you feed a kid.
They are mock-ups drawn over real stills (the garden in camera D, the training drill screen, the kit man and
manager from the people presets), tinted to dusk. The figures are low-resolution cut-outs. None of it runs.

---

## 4. What changes in `lib/star/life`

All additive (types.ts rule). Old events and old saves keep working.

| File | Change | Size |
|---|---|---|
| `types.ts` | `LifeTalk`, `TalkNode`, `TalkReply`, `LifeActivity`, `LifeArc`, `ArcBeat`, `LifePromise`, `Nemesis`; optional `talk`, `entry`, `arc` on `LifeEvent`; new save fields below | 0.5 day |
| `talk.ts` (new) | Pure: start a talk, take a reply, return the next node or the ending. Holds mood and notes while the talk is open | 1 day |
| `activity.ts` (new) + `components/star/life/ActivityHost.tsx` | The list of modes, their dials, and the host that mounts one and returns `{won, score, abandoned}` | 2 days + wrappers (part 2b) |
| `arcs.ts` (new) | Start an arc, bind its cast, move to a beat, tick clocks, find due beats | 1.5 days |
| `promises.ts` (new) | Make, remind, keep, break; the phone list | 1 day |
| `nemesis.ts` (new) | Promote, traits, title, meetings, promotion rules | 2 days |
| `director.ts` | Due arc beats and due promises go before fresh events; `entry: offer` puts a bubble on a person and does not open a screen; quiet weeks unchanged | 1 day |
| `cond.ts` | New words: `arc.x`, `arc.clock(id)`, `talk.mood`, `said:x`, `activity.won/score`, `promise(id)`, `debt(id)`, `nem.tier`, `bigMatch`, `sameClub`, `teammate(x)`, `clubGoals` | 1 day |
| `resolve.ts` | Apply `arc`, `promise`, `debt`, `objective`, `nemesis`, `give`, `unlock` from an ending | 1 day |
| `validate.ts` | Every `goto` resolves; every node has an exit; one silent reply at most; chances add up; an arc has at least one activity or one promise, at least one beat a season away, and at least two endings; an activity names a real mode | 1 day |
| `roundMenu.ts` | The gold "offer" bubble and the standing bubble (Thursdays) | 0.5 day |
| `book/` | `events.json` stays; add `arcs/*.json`, one file per arc, so two writers never touch the same file | none |
| Tests | `tests/star/lifeTalk.mts`, `lifeArcs.mts`, `lifePromises.mts`; the 80 v1 events must still pass unchanged | 1.5 days |

**Save size (reasoned from the shapes, not measured).**

| New part | Shape | Size |
|---|---|---|
| Arcs in progress | up to 12: arc number, beat number, cast ids, up to 8 small values, 2 clock numbers | about 1.8 KB |
| Arcs finished | arc number → ending number | about 0.4 KB |
| Promises and debts | up to 6 open + the last 20 kept or broken: number, person, due week, state | about 0.5 KB |
| Nemeses and allies | up to 3 + 3: id, origin, tier, traits, scar, title number, 6 meetings | about 1.2 KB |
| Objectives | up to 2 | about 0.1 KB |
| Talk in progress | not saved: a talk closed half-way restarts, and an activity counts as abandoned only if you pressed Stop | 0 |
| **Total added** | | **about 4 KB** on top of v1's 20 to 25 KB |

`LifeState.v` goes to 2; `migrate.ts` adds the empty fields.

---

## 5. Writing the other 1,400 on API credit

**The new mix.** Same 1,500 total, different shape:

| Kind | Count | Events |
|---|---|---|
| Written arcs of 4 to 8 beats (like the kit man) | 60 | about 380 |
| Generated arc templates (nemesis, ally, the kid, the protégé, the journalist's vendetta, your brother, the agent's favour, a sponsor) | 8 | about 60 |
| Two-parters (a v1 event plus one follow-up, now with rounds) | 150 | 300 |
| Singles with a 2 to 4 round talk | 530 | 530 |
| Chats (one line, as v1) | 150 | 150 |
| Already written (30 live + 50 pilot), kept as v1 | | 80 |

So about 440 of 1,500 events sit inside a story that runs for seasons, against a handful of two- and three-part chains today.

**The pipeline.** v1's five gates stay (write, check, judge, soak, human). Three things change.

1. **The unit of writing is an arc or a place, not five loose briefs.**
   - *Arc batch:* one request writes one whole arc. It gets the pack (schema, cast, places, the activity list with
     what is built, the memory tags so far, the de-ai rules) plus **one** of the three sample arcs and a one-page
     arc brief: owner, the activity, the promise, the clock, the seasons-later beat, three endings.
   - *Place batch:* one request writes 5 singles for one place and one owner (the canteen and the academy kid),
     so they share detail and the checker can catch near-copies in the same room.
   - Harry strikes dull arc briefs before anything is written. 60 briefs is one page each; about an hour to read.
2. **A de-ai pass after the check, before the judge** (new gate).
   - Run `measure.py` on the event's lines. Any STRICT shape is rewritten, no exceptions.
   - One rewrite request per event with the skill's rewrite steps: say it aloud; each reply answers what was said;
     join with and, but, so; one odd true detail per talk, not per line; no closing line that sums the scene up;
     at most one joke per talk.
   - **A blind judge on a sample.** One arc in ten is shown to a fresh judge that has never seen the rules, beside
     real football talk, and asked which was written by a machine. This needs a **pool of real football speech**
     (player and staff interviews, autobiography passages, fan-channel transcripts), which does not exist yet.
     The skill's own pool is cat-food and supplement adverts.
3. **The checker grows** (part 4), and the soak must also show: every arc reaches each of its endings at least
   once in 200 careers; no promise is left open at retirement; no more than 12 arcs open at once; a beat due
   "seasons later" does fire; activities are offered at most about once a fortnight.

**Cost (estimate).** Prices are the ones in the v1 design (Opus 5.5 $4 in / $20 out per million tokens, Sonnet 5.5
$2 / $10, batch halves both). I did not re-check them today. One v2 arc event is about 1,550 tokens (measured from
the three arcs); I assume a single is about 950.

| Step | Tokens | Cost |
|---|---|---|
| Write, 2.5 written for 1 kept (Opus, batch) | 12 M in, 5 M out | about $75 |
| Judge (Sonnet, batch) | 14 M in, 1.2 M out | about $20 |
| Rewrite about 40% (Opus, batch) | 4 M in, 2.7 M out | about $35 |
| De-ai pass on every kept event (Sonnet, batch) | 5 M in, 2.5 M out | about $18 |
| Blind judge samples, briefs, spare | | about $7 |
| **Total** | | **about $155, about £120** (range £90 to £220) |

The money is small. The real costs are the game modes (part 2b), Harry and Mikey's review (v2 events take longer
to play through: about 60 an hour, so about 23 hours for 1,400), and the football speech pool.

---

## 6. The de-ai pass on these three arcs: what it showed

- **Detector, STRICT shapes: 0** in 753 lines and 10,636 words (measured, `scripts/de_ai/measure.py`). I rewrote
  about 80 lines after the first run: stacked fragments joined with and / but, four closing lines that summed the
  scene up, three mirror-shaped endings.
- **Still off the skill's targets.** Sentences under 5 words: 29% over all lines, 24% in spoken and narrated lines
  only, against about 10% in the skill's human adverts. "But" is 1.3 per thousand words against 7.9. Reply buttons
  are capped at 72 characters, which pushes them short; that explains part of it, not all.
- **The skill's whole-script score says 99 out of 100 (AI).** That model was trained on filmed adverts against typed
  scripts, and the skill itself says it is unreliable on dialogue ("judge only"). It names real things all the
  same: too few everyday long words, too many day and month names (Thursday, Saturday, May), contractions.
- **The blind judge was not run.** That is the skill's real gate, and there is no football pool to judge against.
  So I cannot say these lines pass. I can say they have none of the banned shapes and that I read every line.
- Harry's ear on the 17 storyboard screens is the fastest test there is today.

---

## 7. Phases

Days are one builder's working days, my estimate. Each phase ends with something Harry can play on `/star-life-dev`.

| Phase | Built | Harry sees | Time |
|---|---|---|---|
| **1. The kit man, playable** | Talks of several rounds (`talk.ts`, Telltale screen takes nodes), the activity host, the `strike-drill` wrapper with Den counting, arcs with one clock, promises with the phone list, the offer bubble. Beats 1, 2, 2b, 3 of the kit man arc for real; beats 4 to 7 reachable with the test page's "skip a season" | Tap Den, four rounds, play the hundred, the gaffer next morning, score on Saturday and find the note, Thursdays, the promise in your phone. Skip three seasons: his night, kept or broken | 8 to 10 days |
| **2. The legend** | `duel-1v1`, wagers that take the car, the crossbar and penalties wrappers, two racing clocks, the feed-post callback, the star pass stop (with Mikey) | Level 10: first to three in the ring. Lose your car. Hear about it on the television | 7 to 9 days |
| **3. The nemesis** | The generator, `match-duel`, the People page card, transfer-list line, debts. Needs D1 and the engine warning for "he marks you" | Get injured by an invented centre-half; he is in the tunnel in the spring | 7 to 9 days |
| **4. Places** | Events hooked to the training compound, the Arcade and garden levels as those areas land (other builders) | Den is on pitch two in 3D with the shed light on | follows the 3D work |
| **5. Volume** | The pipeline with the arc and place batches and the de-ai gate; the football speech pool; 10 arcs first as a pilot, then batches of about 250 events | The review page, an arc at a time | 3 days to set up, then about 2 days + 4 hours of review per batch |

Phase 1 is the test of the whole idea. If saying yes to Den and finding his note in your boot does not feel like
a different game, more events will not fix it.

## 8. To decide

- **D1. Nemesis only from invented players** (part 2d)? Recommended yes.
- **D2. Wagers.** Already ruled "you'd lose whatever you wager". v2 adds welshing: you can refuse to pay, the squad
  sees it, and the debt stays in your phone. OK?
- **D3. Promises capped at 6 open.** Too few, too many?
- **D4. The Arcade** as the bigger shop's name and what is in it (barber, boot room, car floor, café).
- **D5. Garden level = the lower of star pass / club size and your home.** Mikey's area for the levels.
- **D6. A phone fallback for the 1v1.** I say no: no 1v1 on a device that cannot run it, so the legend waits.
  The top-down dribble already runs on phones, so the mode may simply work there; that needs a test.
- **D7. The football speech pool** for the blind judge: who collects it, from where.
