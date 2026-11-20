# The living world: design

For Harry and Mikey. Written 20 Nov 2026 from `docs/plans/LIVING_WORLD_IDEAS.md` and the code as it is today.
Nothing in the repo was changed. Samples: `sample-events.json` (same folder).

**Key point.** One event system with three parts: an **event book** (1,500 events as data), a **memory** for every
person you meet, and a **director** that decides what fires and when. Social actions and the star pass are both
just ways INTO the same event book.
**Key number.** About 25 KB added to a save that is 180 to 550 KB today (figure from `storage.ts`). Writing all
1,500 events by script costs about £165 once (estimate, see part 5).
**Key change.** Dilemmas today are random pop-ups that touch three shared bars. After this, every event names a
real person, that person remembers, and it comes back later.

What I read, and what I did not measure: I read the code named below. I did NOT run anything, so every "how often"
number here is a design target, not a measurement. Two numbers come from code comments (marked "from code").

---

## 0. What is in the game today (so the design fits)

| Thing | Where | State |
|---|---|---|
| Dilemmas (about 30 choice pop-ups) | `lib/star/dilemmas.ts`, `DilemmaModal` | **Switched off** (page.tsx line 1985). Effects: money, boss, team, fans, fame, reputation, scandal, skills. Money is fixed at Championship level (the file itself says this is wrong) |
| Relationships | `lib/star/relationships.ts`, `types.ts Relationships` | Three bars for groups: boss, team, fans. **No per-person relationship at all.** One relationship game each, once a week |
| The week | `lib/star/week.ts` | A set number of actions between matches: train, relationship, or rest. Social actions should cost one of these |
| Star pass | `starPoints.ts`, `starPassRewards.ts`, `rewardCatalogue.ts`, `/admin/star-pass` | Levels 1 to 100. A reward card can sit on any level. Rewards are items. No story |
| Cut scenes | `lib/star/cutscene/` | Scenes are generated from an event kind (18 kinds). 9 places: office, tunnel, pitch, dressing room, awards stage, press room, training ground, airport, garden |
| People looks | `lib/star/people/presets.ts` | Any person id → the same face every time. Roles: manager, staff, player, journalist, agent, fan. Not wired into scenes yet |
| Media memory | `lib/star/media/types.ts StoryMemory` | The feed already remembers threads, streaks and "said recently". Journalists are account types (tabloid, broadsheet, insider), not people |
| Things you own | `CareerState` | cars (`ownedItems`), horse, boots, girlfriend, sponsors (`brands`), casino scandal state |
| Not in the game | STAR_ROADMAP 18 | Agent, family, physio, kit man, club legend as people |
| Idea banks | `STAR_LIFE_EVENTS.md`, `STAR_SPONSOR_IDEAS.md` | About 60 event ideas and 40 sponsor ideas, none built |

---

## 1. The event model

### 1.1 One event, as data

Every event is one JSON object. Nothing about an event lives in code. See `sample-events.json` for 16 real ones.

```
id, title, category, place, size (small | medium | big), rarity
present      how it is shown (see 1.4)
trigger      when        the moment: arrive:training, driving:any, after-match, home:evening, leave:casino,
                         social:<action>, followUp, walkout, starPassStop
             requires    facts that must be true (star level, age, owns a car, a team-mate with bond 35+,
                         a memory exists, last match lost, energy low ...)
             cooldownWeeks, group, once, maxPerCareer, starPassStop
cast         named slots, each filled by a rule: "the team-mate you are closest to", "the journalist who
             dislikes you most", "whoever owns the memory 'crashed-your-car'"
setup        the lines, with {mate.short}, {legend.name} filled in
choices[]    label, requires (some choices only show if you own the car / horse), cost, minigame
  outcomes[] chance or condition, text,
             effects   the game's existing bars and things (boss, team, fans, fame, reputation, moneyWeeks,
                       energy, item give/take, unlock, injuryWeeks, flags)
             npc       respect / bond / grudge changes for ONE named person
             remember  one memory line written to that person
             followUp  another event, 1 to 320 weeks later
callbacks[]  where this event's memories show up again (a line in another event, a match behaviour, a text)
build        which presentation template it uses, and what must exist before it is allowed in the game
```

Two fixes to old problems while we are here:
- **Money is in weeks of your own wage** (`moneyWeeks`). A 0.5-week cost is real in the National League and in
  the Premier League. This is the fix `dilemmas.ts` asks for in its own header.
- **Happiness is never set directly.** It stays the average of boss, team and fans (Mikey, 5 Oct).

### 1.2 What makes an event have weight (the rules every event must pass)

Harry: "they can't just happen for the sake of it." So the checker (part 5) rejects any event that fails one of these:

1. **A reason to fire.** The trigger must read the state of your career (a car you own, a bad match, a new
   signing in your position). "Random, any week" is not allowed.
2. **A named person or a named thing of yours.** Your car, your number, your horse, your dad, that team-mate.
3. **Every choice changes something you can see**, and at least one choice writes a memory.
4. **It comes back.** Every event has at least one callback or follow-up: a line weeks later, a changed option,
   a pass not given in a match, a scene years on. This is the whole feeling of weight.
5. **Something to lose.** At least one choice risks something (money, a bar, an item, a friendship). No event
   where every choice is a gift.
6. **Sized honestly.** Small = up to ±3 on a bar. Medium = ±4 to ±8. Big = ±10 or an item, an injury, a scandal.

### 1.3 The director: no spam, no repeats, across 15 seasons

A career is about 15 seasons × 46 weeks = about 690 weeks. Target: **1 to 2 events a week** = 700 to 1,300
event slots in a career. That is why 1,000 to 1,500 is the right size: one career sees about 60%, and the next
career is different. (Design target, not measured.)

The director runs at each "moment" (arriving somewhere, a call while driving, after a match, a new week):

- **Budget.** At most 2 events a week, at most 1 medium-or-big. A big event needs 6 quiet weeks since the last one.
  A set-piece (like the legend) needs 20.
- **Quiet after big things.** No event in the week of a cup final, a transfer, a retirement or the Ballon d'Or night.
- **Candidates → score.** Events whose trigger is true are scored: rarity × how long since anything from the
  same group fired × a bonus if it uses a strong memory × a bonus if you have not seen its category lately.
  Then one is picked by the career's seed, so a soak run is repeatable.
- **Follow-ups come first.** A due follow-up or callback always beats a fresh event. Paying off old stories
  matters more than starting new ones.
- **Never the same event twice** unless it says `maxPerCareer` (the car loan can happen 3 times, with 3 different
  team-mates). Groups stop near-copies: one "borrow" event per 30 weeks, whatever is borrowed.
- **Nothing fires if it is not fully built** on this device (rule from Mikey). An event whose `build.needs` is
  not all ticked is simply not in the pool. On a phone, an event with no phone version is not in the pool.

### 1.4 How an event is shown (8 templates, built once)

"Fully built" must not mean 1,500 hand-made scenes. It means: 8 templates are built and polished once; an event
picks one. About 95% of events need no new art.

| Template | What you see | PC | Phone |
|---|---|---|---|
| phone-call | The 3D phone rings (or the dash while driving); caller's face; lines; choices | yes | yes |
| text-thread | Messages on the phone, reply buttons | yes | yes |
| feed-post | A post or headline in the media feed, then a choice | yes | yes |
| talk-scene | Two or three people standing or sitting in a place, generated by the cut-scene director (`generateScript`) with a new event kind "talk" | 3D | a still frame + choices |
| 3d-moment | Something in the 3D area as you walk in (the kid alone in the food hall) with a tap to act | 3D | falls back to talk-scene |
| outing | A place backdrop and a short scene (races, drive, restaurant) | still first, 3D later | still |
| minigame | 1v1, crossbar, horse race, penalties: games that already exist (`play3d`, `training3d/crossbar`, `horse.ts`, `relgames/`) | yes | the simple versions |
| cutscene / set-piece | A full directed scene, hand-checked. About 40 in the whole game | yes | yes if the place is phone-framed |

Football rule: any minigame that plays real football uses the one engine (RUL-ENG-002). The 1v1 is a 3D game,
which is the allowed exception (RUL-3D-001).

---

## 2. People who remember

### 2.1 The cast

Persistent people, each with an id that never changes:

| Who | How many | Id | New? |
|---|---|---|---|
| Team-mates | your squad (about 25) | the squad id that exists today (`sf_…`) | no |
| Manager | 1 | `mgr:<name>` | exists as data |
| Staff: physio, kit man, coach, chairman | 4 | `staff:physio` … | new people, looks from presets |
| Agent | 1 | `agent` | new |
| Family: dad, mum, one sibling, partner | 4 | `fam:dad` … | new (partner = today's girlfriend) |
| Journalists | 3 (tabloid, broadsheet, insider) | `hack:tabloid` … tied to the feed's accounts | new as people |
| Club legend | 1 per club | `legend:<club>` | new |
| Sponsor reps | 1 per deal category you hold | `rep:<category>` | new |
| Rivals | up to 3 at once (a team-mate or opponent whose grudge passed 40) | their own id | new status |

Names and looks come from the id (people presets already do this), so they cost nothing in the save.

### 2.2 What each person holds

Three numbers, 0 to 100, like the Sims but for football:

- **Respect**: what he thinks of you as a player and a man.
- **Bond**: how close you are.
- **Grudge**: separate from the other two on purpose. A team-mate can respect you and still hold a grudge.
  This is the nemesis part.

Plus a **memory log**: up to 6 lines per person. One line = a tag (`refused-car`), when it happened, and a
strength 1 to 3. Strength 3 never fades. Strength 1 fades after about a season. When the log is full, the
weakest line goes.

The squad as a whole has its own small log (`saw-you-duck-legend`) for things everyone saw.

### 2.3 How memory changes later things

A memory does one of five jobs. Each event's `callbacks` says which:

1. **A line.** In any later scene with that person, a matching line is added. ("Mum still asks after you.")
2. **A choice appears or goes.** The physio who lied for you once will not offer that choice again.
3. **A follow-up event.** The snubbed journalist's hit piece, 1 to 6 weeks later, only if his grudge is 20+.
4. **Match behaviour, small and bounded.** A team-mate with grudge 20+ squares the ball to you 10% less often;
   one with bond 70+ looks for you 10% more. A kid you helped runs to you when he scores. (This touches the
   match engine: it needs the engine warning and Harry's yes, RUL-ENG-001. It is phase 3, not phase 1.)
5. **A changed price or number.** The agent you went behind opens 5% lower. The physio who trusts you gets you
   back a week sooner.

**People leave and come back.** When a team-mate is sold, his record is kept if he has any strength-2 memory.
He can come back as an opponent in the tunnel, or call you from his new club. Otherwise it is dropped.

**The team bar stays.** `relationships.team` keeps working exactly as now (matches move it). A change to one
person's bond also moves the team bar by a fifth of it. Nothing is restructured; fields are added (types.ts rule).

### 2.4 Save size

New field `career.world`-style block, say `career.life`:

| Part | Shape | Size |
|---|---|---|
| People | up to 60 records: 3 numbers + up to 6 memories as `[tagNumber, week, strength]` | about 9 KB |
| Events fired | event number → the career week it fired (about 900 in a full career) | about 9 KB |
| Follow-ups waiting | up to 20: event number, due week, cast ids | about 1 KB |
| Director state | last-fired week per group and category | about 1 KB |
| Flags | duel in progress, shirt number picked, etc. | about 1 KB |
| **Total** | | **about 20 to 25 KB** |

Tags and event ids are stored as numbers that point into the event book, not as words. An old save simply has
no `life` block and starts one. (Sizes are worked out from the shapes, not measured.)

---

## 3. Social actions (the Sims part)

**Tap a person** (in the food hall, garden, dressing room, or the Squad list on the phone) → a small round menu.
What shows depends on bond, place and what you own.

| Action | Needs | Costs | Does |
|---|---|---|---|
| Chat | nothing | free, once a day per person | A random conversation from the book (about 150 short ones, picked by his memories and the week's football). Bond +1 to +3. This is where most callbacks land |
| Banter | bond 20+ | free | Risky chat: bond +4 or −3, by your "team" bar and his grudge. Squad memories come out here ("Still hiding from old men?") |
| Ask for advice | his respect for you 30+, he is older or better | free, once a month | A small boost to one drill this week, and he likes being asked (respect +3) |
| Train together | at the training ground | 1 week action, energy −5 | Play an existing drill side by side. Both of you gain. Bond +5 |
| Lunch in the food hall | PC area, or the phone list | 1 week action | A longer talk-scene; one real choice; often opens an event |
| Go for a drive | you own a car | 1 week action | A drive with him in the passenger seat. Car tier changes his lines. Calls can come in. Bond +6 to +10 |
| A day at the races | bond 25+, no match tomorrow | 1 week action, 0.3 weeks' wage, energy −4 | See `soc-races-day-out`. Your own horse can run |
| Gaming night at yours | you own a house tier 2+ | 1 week action, energy −3 | Up to 3 team-mates. Team bar +2, each bond +4. Late night: small energy cost |
| Casino night | casino open, bond 30+ | 1 week action, your own stake | Opens casino events. Risk: `scn-casino-photo` |
| Give a gift | an item from the shop | the item | Big bond gain once; much less each time after |
| Clear the air | his grudge 20+ | 1 week action | A talk-scene. Grudge −15 to −30, or it goes badly and it rises |
| Ask a favour | bond 50+ | his bond −5 | Borrow his car when yours is gone, a word with the boss, a lift |

Rules: each person has a "seen enough of you" limit (2 actions a week) so you cannot grind one team-mate to 100.
Bond gains shrink as bond rises, the same curve the bars already use (`scaledChange`). Actions that cost a week
action share the week with training and rest, so a friendship costs you something real.

Phone: all of it works from the Squad list as stills and text. PC: the same menu on a person walking around.

---

## 4. The star pass as a story (proposal for Harry AND Mikey)

This is Mikey's area. It is a proposal, not a decision. It keeps everything Mikey built.

**Keep:** levels 1 to 100, the points curve, the gates, the road and its five themes, the reward catalogue,
`/admin/star-pass`.
**Add:** a second kind of stop on the road: a **story stop**. A story stop is an event id, not a gift.

How a story stop works:
1. You reach the level. The road shows a locked scene card: "Someone is waiting for you at training."
2. The event fires the next time you are in the right place (and old enough). You play it.
3. **The reward is won, not given.** Beat the legend → his boots and a celebration. Lose → he invites you
   back, and the stop stays on the road as "unfinished business" until you win.
4. Item rewards (today's cards) stay on the levels between story stops.

**The age problem, said plainly.** Harry wants "level 10 ≈ 20 years old". Today's curve does not do that: a
career starts at 16, and a typical player is level 10 after about 30 matches, in his first season (from code,
`starPoints.ts`, simulated over 1,000 careers). So either:
- **(A, recommended)** keep the curve; give each story stop a level AND a youngest age, and it fires when both
  are true. No rebalance. The road shows the age ("from age 20").
- (B) re-tune the curve so levels match ages. That moves every reward and gate. Mikey's call; much more work.

Before choosing levels: one small script that prints the middle level at each age over 200 soak careers. Until
then, the levels below are placeholders.

| Stop | Level (placeholder) | Youngest age | Story | You can win |
|---|---|---|---|---|
| The phone | 2 | 16 | (exists) a team-mate's cracked old phone | the phone |
| First boots deal | 6 | 16 | a rep watches you train; hit 3 of 5 targets | first sponsor + a colourway |
| **The legend** | 10 | 18 to 20 | `trn-legend-1v1` | his boots, a celebration, or lose your car |
| The number | 15 | 18 | a senior pro offers you his shirt number if you beat him at crossbar | a squad number of your choice |
| The rival arrives | 20 | 19 | `rvl-new-signing-shirt`, then a season-long duel | "keep the shirt" scene |
| The captain's test | 30 | 21 | the dressing room splits; who do you back | the armband talk |
| The call from home | 40 | 22 | `fam-dad-old-club` | your name on the hut; a guard of honour at retirement |
| The big offer | 50 | 23 | the agent, a midnight flight, a contract on the table | a move, or a statue-level loyalty bonus |
| The country | 60 | 24 | the national manager visits training | a debut scene |
| The kid | 70 | 27 | a 17-year-old takes your shirt in training; mentor or crush him | a protégé who remembers (`chn-boots`) |
| The legend returns | 80 | 30 | you are now the one in the circle; a kid challenges YOU | his respect; wager his boots |
| The last contract | 90 | 33 | one more year, or go home to dad's club | the farewell |

The stops are ordinary events in the event book with `starPassStop` set. One system, not two.

---

## 5. Making 1,000 to 1,500 events, each fully built

### 5.1 How many of what

| Category | Events | Main places and templates |
|---|---|---|
| Team-mates (favours, fall-outs, birthdays, pranks, money) | 260 | food hall, dressing room, driving calls |
| Chats (short conversations for the Chat action) | 150 | anywhere |
| Manager and staff | 120 | office, training, physio room |
| Media and journalists | 120 | mixed zone, press room, feed |
| Family and partner | 110 | home, calls |
| Agent, transfers, contracts | 100 | calls, office, airport |
| Sponsors and money (uses STAR_SPONSOR_IDEAS) | 110 | texts, shoots, shop |
| Fans and the city | 90 | driving, garden gate, shop |
| Training ground life | 90 | pitch, gym |
| Health, injuries, body | 70 | physio room |
| Rivals and nemeses | 70 | tunnel, pitch, feed |
| Outings and social follow-ons | 80 | races, casino, restaurant, drive |
| Scandal and integrity (uses STAR_LIFE_EVENTS) | 60 | casino, calls, texts |
| Barber, hair, style | 30 | barber, bathroom |
| Set-pieces and star pass stops (hand-made) | 40 | anywhere |
| **Total** | **1,500** | of which about 450 are follow-ups and callbacks |

By template: about 420 phone calls and texts, 480 talk-scenes, 150 chats, 120 feed posts, 110 3D moments,
100 outings, 80 with a minigame, 40 set-pieces.

### 5.2 The pipeline (5 gates; an event is "in" only after all 5)

```
brief ──▶ 1 WRITE ──▶ 2 CHECK ──▶ 3 JUDGE + FIX ──▶ 4 SOAK ──▶ 5 HUMAN ──▶ event book
(a row in a    (script,     (code, free)   (script,          (code, free)   (review page)
 spreadsheet)   Batch API)                  Batch API)
```

**Brief.** One row per event: category, place, template, size, who is in it, the one-line idea. The first 300
ideas come from STAR_LIFE_EVENTS, STAR_SPONSOR_IDEAS and Harry and Mikey's chat. The rest are generated as
briefs first (cheap) and Harry strikes the dull ones before anything is written.

**1. Write** (`scripts/living-world/author.mts`, Anthropic Batch API). Each request = the fixed pack (the
schema, the cast list, the places, the things you can own, the memory tags so far, the style rules, the 16
samples) + 5 briefs → 5 events as JSON. The reply is forced to the schema with structured outputs
(`output_config.format`). Notes for whoever builds it: batch results come back in any order, so key by
`custom_id`; forced tool choice and the `fallbacks` option are not accepted on these models in a batch, so check
`stop_reason` for a refusal and re-queue those briefs.

**2. Check** (`scripts/living-world/validate.mts`, no AI, runs in seconds). Rejects an event if:
- it does not match the schema;
- it names a person rule, place, item, minigame, flag or follow-up event that does not exist;
- it fails a weight rule from 1.2 (no memory written, no callback, no risk, all-gift choices);
- its numbers are outside its size band, or a choice is worth far more than the others (the "always pick B" test:
  the best choice may be at most 2× the value of the second best);
- chances in an outcome list do not add up to 1;
- it reads like a copy: same cast + place + more than 60% shared word-triples with another event;
- a line is too long for the phone, or uses a real brand or a real person's name.

**3. Judge and fix** (Batch API again). A second pass scores each survivor 1 to 5 on: does it feel like
football, is the choice hard, does the callback land, is it funny or tense. Under 4 → one rewrite with the
judge's note → re-check. Still under 4 → binned. Expect to write 2.5 events for every 1 kept.

**4. Soak** (`scripts/soak/lifeSoak.mts`, built on `careerSoak.mts`). 200 careers × 15 seasons with random
choices. It must show: every event fired at least once across the runs; no event more than its limit; events per
week between 1 and 2; no week with two big ones; every follow-up either fired or was correctly dropped; no bar
pinned at 0 or 100 by events alone; money from events under 10% of career income; save growth under 25 KB.
An event that never fires in 200 careers has a broken trigger and goes back.

**5. Human review** (`/admin/events`, with the eye button). Cards, 20 at a time: the event played as the real
template, each choice clickable, the callbacks listed underneath. Keys: keep, fix (type a note → back to step 3),
bin. Harry or Mikey can do about 100 an hour. **Nothing reaches the game without a keep.** Each kept event is
also checked once on a phone-size screen.

### 5.3 The cost (estimate, not measured)

Prices used (per million tokens, checked 20 Nov 2026): claude-opus-5-5 $4 in / $20 out; claude-sonnet-5-5
$2 / $10. The Batch API halves both.

Assumed sizes (the pilot will replace these): fixed pack 15,000 tokens; one event about 1,800 tokens of JSON
plus about 700 of thinking; 3,750 events written to keep 1,500.

| Step | Tokens | Opus 5.5 batch | Sonnet 5.5 batch |
|---|---|---|---|
| Write 3,750 events (750 requests) | 11.6 M in, 9.4 M out | $117 | $59 |
| Judge 3,750 (375 requests) | 10.5 M in, 1.1 M out | $32 | $16 |
| Rewrite about 1,500 | 5 M in, 4.5 M out | $55 | $28 |
| Briefs, chats, spare | | $10 | $5 |
| **Total** | | **about $215 = about £165** | **about $108 = about £85** |

- Recommended: Opus 5.5 to write, Sonnet 5.5 to judge: about **£150**. Inside one month's £200.
- Real range: £100 to £250, because the token sizes are guesses.
- **Pilot first:** 50 events end to end costs about £5 and gives the real numbers.
- Caching the fixed pack would cut the input cost further, but it is not guaranteed inside a batch, so it is
  not counted.
- The AI cost is small. The real cost is step 5 (about 15 hours of Harry and Mikey's eyes for 1,500) and
  building the 8 templates.

---

## 6. The 12 worked samples

In `sample-events.json`, all in the schema, with real numbers, memories and callbacks:

| # | Id | What | Shows |
|---|---|---|---|
| 1 | `trn-legend-1v1` | The legend at training; 1v1; win his boots or wager your car | set-piece, minigame, star pass stop, item won or lost |
| 2 | `drv-mate-borrow-car` (+ `drv-mate-crash-payback`) | A team-mate calls while you drive | a refusal he brings up later; a 20% crash with a follow-up |
| 3 | `agt-quiet-call` | The agent: leak it, keep it quiet, or tell the boss | three people's opinions move in different directions |
| 4 | `med-mixed-zone-snub` (+ `med-hit-piece`) | The tabloid man after a bad game | the snub → the hit piece → who leaked |
| 5 | `fdh-kid-sits-alone` | Food hall: the academy kid on his own | a tiny act that pays off seasons later |
| 6 | `soc-races-day-out` | Horse racing with a team-mate | a social action; your own horse; he tells you a secret |
| 7 | `rvl-new-signing-shirt` | The new signing wants your number | starts a rival and a season-long duel |
| 8 | `fam-dad-old-club` | Dad's Sunday side is folding | quiet gift v photo op v no |
| 9 | `spn-rival-brand-boots` | Photographed in the wrong boots | sponsor rep remembers; blame a mate at a price |
| 10 | `scn-casino-photo` | Blackmail photo, 2:14 a.m. | scandal, risk, the boss texts "Don't." next time |
| 11 | `inj-tight-hamstring` | The physio asks what to tell the boss | a choice that is gone next time if you abused it |
| 12 | `chn-boots-1/2/3` | The kid with one pair of boots, then years later in the tunnel | a 3-part chain with a memory pay-off (good or bad) |

---

## 7. The plan, in phases

Times are working days for one Claude builder plus review time, counted from the pieces above. They are my
estimate from the size of each piece; none is measured. Each phase ends with something Harry can play.

| Phase | What gets built | What Harry sees | Time |
|---|---|---|---|
| **0. Pilot** | The schema as code, the checker, the author script; 50 events through all gates; the level-by-age printout for the star pass | A review page with 50 events to keep or bin; the real API cost; the real level at each age | 1 to 2 days, about £5 |
| **1. First slice** | Memory (`career.life`), the director, 4 templates (phone-call, text-thread, feed-post, talk-scene as a still), **30 events**, **3 social actions** (Chat, Go for a drive, A day at the races), the People page showing each person's three numbers and what they remember. Dilemmas stay off; this replaces them. On a test page first (`/star-life-dev`), then in the game when Harry says push | In one season: about 20 events fire; a team-mate you refused brings it up; the journalist you snubbed writes the piece; a Relations page where each team-mate has a face, bars and "remembers: …" | 4 to 6 days |
| **2. The legend + star pass stops** | The 1v1 set-piece, story stops on the road (after Harry and Mikey agree part 4), the staff, agent and family as people, 150 events total, all 12 social actions | Level 10: the legend is waiting. Win his boots or lose your car. The road shows scene cards | 5 to 7 days |
| **3. The places come alive (PC)** | Events hooked into the 3D food hall, training ground and driving as those areas land (other builders' work); 3D moments; talk-scenes played by the director in 3D; match behaviour from memories (needs the engine warning) | Walk into the food hall and something is happening that is about you | 1 to 2 weeks, depends on the 3D areas |
| **4. Volume** | The pipeline at full speed: 150 to 400 events, then 400 to 1,000, then 1,500, in batches of about 250. Each batch: write, check, judge, soak, review | The review page fills up; each batch goes live after his keeps | 2 to 3 days of building per batch + about 2.5 hours of review per batch; about £25 per batch |

Phase 1 is the smallest thing that proves the feeling. If 30 events with memory do not feel alive, 1,500 will not either.

## 8. Things to decide

1. **Star pass: A or B** (part 4). Mikey and Harry together.
2. **Match behaviour from grudges** (a team-mate passes to you less). It touches the match engine. Yes or no, and when.
3. **Losing your car for real** in the legend wager. Harry asked for it; it is in the sample. Confirm it is truly gone.
4. **Scandal content** (bribes, doping in STAR_LIFE_EVENTS): how dark is allowed?
5. **Family and agent** are new people (STAR_ROADMAP 18, Mikey's list). OK to add them in phase 2?
