# People, time and memory: the plan (27 Nov 2026)

Plan only. No game code changed. Written for Harry (not a coder): short sentences, numbered points.
Each claim says how I know it: **[seen]** = read in the code, **[measured]** = I ran it, **[reasoned]** = my judgement.

What Harry asked for tonight:
> "I think there needs to be more to do … there doesn't need to ALWAYS be an NPC in my house … there should
> also be a time of day either on the phone or somewhere on screen, and I should be able to pull up the phone
> again after putting it down. We need to build the conversation menu and the full system for memory tracking /
> how actions affect things, and merge it in with stories. Also that affects NPCs naturally doing things: he
> should not be sitting there all day, he needs to leave / do a different action / make food / do something etc."

Earlier: "tons of stories", "hundreds of things like this big and small".

Mockups (phone size), in the session scratchpad `people-plan/`:
- `1-clock-and-phone.png`: the clock in the 3D house, the Phone pill, the phone's status bar and Today list.
- `2-conversation-menu.png`: the round menu over a real house still (Kyle on the sofa).
- `3-visitor-day.png`: one day at the villa: you, a visiting team-mate, the chef.
- `4-memory-card.png`: the person card: today's mood, bars, memories that fade, habits, what's waiting.

---

## 0. The short version

1. **One clock.** The career gets a real time of day between matches. Doing things costs minutes. Sleep jumps to 07:00. The clock shows top middle in every 3D place and in the phone's status bar.
2. **People come and go.** Most days in a small flat nobody is round. Team-mates drop by or come when you text them. A partner can move in through a story. Big homes have a cleaner and a chef. Everyone follows a routine written as data. Nobody sits on one thing for more than 45 game minutes.
3. **Tap a person, get the round menu.** It is already written (`components/star/life/RoundMenu.tsx`) but not used in 3D. Its topics come from who he is, how he feels about you, the time, what just happened and any story waiting for him.
4. **One memory model.** Stories and the house write to the same records. Small things change a person's mood for a few days. Repeat a small thing three times and it becomes a real memory.
5. **More to do.** 46 new things across the house, garden, gym and shop. Each one costs time and does one small, real thing.
6. **13 build days.** Each phase is one builder-day or less and can ship and be tested alone.

---

## 1. What exists today (honest)

### 1a. Built and working

1. **The living house** [seen]. `lib/star/world3d/houseLife.ts`. You tap a thing, walk up and use it (sofa, TV, fridge, bed, shower, bath, mirror, coffee, treadmill, mat, pool table, arcade, darts, cinema, loungers). Things are listed per room in `lib/star/home3d/livingRooms.ts` (e.g. fridge effect at line 159, shower at 489, pool table at 747). It is switched on for every home tier (`lib/star/home3d/homes.ts:203` `LIVING_TIERS`).
2. **Team-mates who drop round** [seen]. `houseLife.ts:31` `GUESTS_BY_TIER`: 1 in the starter flat, up to 4 at the estate. They are **always there**, and **sit in the same place for the whole visit** (`seatGuests`, `houseLife.ts:236`). This is exactly what Harry saw.
3. **The world kit** [seen]. Smart objects (`lib/star/world3d/smartObject.ts`), people who walk and use things (`npc.ts`, states at line 139), the tap card (`interact.ts`), a people budget per tier (`budget.ts:20`: phone at most 4 moving and 8 present).
4. **Routines and a day clock** [seen]. `lib/star/world3d/routine.ts`: `DayClock` (line 18), `planRoutine` (line 99, seeded), `RoutineRunner` (line 131), three templates: garden visitor, bench mate, gym mate (lines 167-200). **Only the test page and the gym use them** (`testScene.ts:534`, `gymPlace.ts:423`). The house does not.
5. **Sleep** [seen]. `lib/star/home3d/sleep.ts:49` `sleepNight`: once per gap between matches it counts as the week's Rest. The house plays the night and moves its own clock to 07:00 (`houseLife.ts:420`).
6. **The living world's people and memories** [seen]. `lib/star/life/`. Each person has respect, bond, grudge (0-100) and up to 6 memories (`types.ts:170-182`). A memory is `[tag, life week, strength 1-3]`. Strength 1 lasts about a season (46 weeks), 2 about three seasons (138), 3 for good (`people.ts:197`). A weekly tidy forgets people who no longer matter (`people.ts:233`, cap 60).
7. **Stories** [seen + measured]. 121 stories in `lib/star/life/book/arcs/` and 80 one-off events in `book/events.json`. Stories have multi-round talks, promises, objectives and games on the real match engine. 120 lines across the stories already name the `home:evening` moment, so many stories are meant to happen at home. A finished story packs to about 14 bytes [measured: 13.9 bytes each].
8. **The round menu (data and screen)** [seen]. `lib/star/life/roundMenu.ts:94` `roundMenuFor` and `:130` `playRoundLine`; screen `components/star/life/RoundMenu.tsx:39`. A story can put a gold bubble on a person (`arcs.ts:417` `bubblesFor`). It runs on `/star-life-dev` only.
9. **The 3D phone** [seen]. `components/star/HousePhone.tsx`. Its "📱 Phone" pill is at line 265.
10. **The gym** [seen]. Bench, treadmill, bag mini-games and Strength / Cardio / Focus (`lib/star/gym/progress.ts`). Its effect on the career is **off** (`progress.ts:62`) until Harry decides.

### 1b. Half-built

1. **The whole living world is OFF in the real career** [seen]. `lib/star/life/flag.ts:9` `LIFE_IN_CAREER = false`. No story, event or memory happens in a real career today. This plan needs it on, at least for the team (question 3).
2. **Chat with a visitor does nothing in the game** [seen]. `Home3D.tsx:198` passes the mates but not `chat`. So tapping a team-mate in your real house shows two lines (`interact.ts:277` `smallTalk`) and "See you". Nothing is saved.
3. **"Mood +1", "Energy +1", "Fitness +1" on things are just words** [seen]. `houseLife.ts:73` has an `onEffect` hook, but nothing in the game passes it. The coffee does not give energy.
4. **Two clocks that do not agree** [seen]. The house has its own clock that always starts at 15:00 (`houseLife.ts:147`) and forgets itself when you leave. The phone's status bar shows a **date**, not a time (`lib/star/phoneClock.ts:28`, used at `PhoneHome.tsx:200`). The career itself has no time of day, only the week (`lib/star/week.ts`: 3 things a week, `WEEK_ACTIONS`).
5. **The phone pill** [seen; cause not reproduced]. The pill only shows when three things are all true (`HousePhone.tsx:264`): the house has finished loading, no move is playing, and the phone app is open on this career (`page.tsx:5162` `phoneFrom3d`). Also, tapping it goes through `navTo("media")` (`page.tsx:4819`), which opens the boss talk instead when one is due. Any of these can leave Harry with no way to pull the phone back up [reasoned]. Phase 1 fixes it.

### 1c. Missing

1. A career clock (day + minute) that all screens share.
2. Who is in your house, day by day (most days: nobody).
3. People who move round the house on a schedule, between rooms, and leave.
4. The round menu in 3D, and a book of conversation topics.
5. Small acts in the world writing to people (taking a can, ignoring a call, being late).
6. Stories that wait for "the next time you see him" in person.
7. Partner, family, staff living in or working in the house.

---

## 2. THE CLOCK

### 2a. What it is

1. One time of day for the whole career, between matches: **a day and a minute** (e.g. Tue 3 Nov, 14:20).
2. The day comes from the real calendar the game already has. Today = the day after your last match (`lib/star/phoneClock.ts` `phoneToday`). The next match day comes from `calendar.ts` `fixtureTimestamp`, and the kick-off time from `lib/star/kickoff.ts:40` (15:00 on Saturdays, 19:45 or 20:00 on weeknights).
3. Saved on the career as two small numbers: `clock: { d, m }` (days since the last match, minute of the day). About 20 bytes.
4. After a match the clock is set to the evening (home by about 19:00 after a 15:00 game, 23:00 after a night game).

### 2b. How it moves

1. **Doing a thing costs time.** Each smart object gets a `mins` (coffee 10, shower 15, cook 40, nap 60, film 120). When you finish, the screen dips for a moment with "40 minutes later" (the bath already does this: `houseLife.ts` `dip`).
2. **Inside a 3D place the clock also ticks slowly by itself:** 1 game minute every 6 real seconds [recommended, question 1]. Ten real minutes walking about = 1 hour 40 game minutes. (1 game minute per real second was too fast: 10 real minutes would be 10 game hours [reasoned].) This makes visitors' routines visibly move while you watch, without the day racing away.
3. **Menus and flat screens stop the clock.** Reading the phone, the People page, the shop list: no time passes. Only actions with a cost move it there.
4. **The week's 3 things keep working** [recommended, question 2]. Training a skill, a relationship action or Rest still use one of the 3. Each now also costs half a day on the clock (09:00 to 13:00, or 14:00 to 18:00). The economy stays the same, so nothing in the match balance moves.
5. **Sleep jumps to 07:00 the next day** (or the alarm you set: 06:30, 07:30, 09:00). The first night's sleep in a gap still counts as Rest (`sleep.ts`), as today. Later nights give a small fixed amount of energy (+2) so sleeping is never pointless.
6. **Very late:** at 00:30 a card offers "Bed?". At 02:00 you fall asleep where you are (sofa), with a "slept badly" note: energy -2 the next day.

### 2c. How it ties to the calendar and match days

1. **Training days** (the club's own sessions, `week.ts` `TRAINING_SESSIONS_PER_WEEK = 2`): training is 10:30 to 12:30. Your phone buzzes at 09:30: "Leave by 09:50". Leave late and the coach notes it (a habit on him, see 5c). Miss it and it is a real memory (strength 1) plus boss -1.
2. **Match day:** the clock **cannot pass "time to leave"** (kick-off minus 2 h 30). At that time a big "Go to the match" button shows and everything else waits [recommended, question 4]. You can never sleep past a match.
3. **Days in a gap:** a Saturday-to-Saturday gap has 6 free days. A Saturday-Tuesday gap has 2. The clock simply runs out of days. On the last day, the match-day rule above takes over.
4. **Story moments use the clock.** `home:evening` = 18:00 to 23:00 at home. New moments: `home:morning` (07:00 to 10:00), `home:visit` (someone just arrived), `clock:late` (after 00:30).

### 2d. Where it shows

1. **3D places** (house, garden, gym, shop, later training ground and car): a small pill, top middle: "14:20" and a line under it ("Tue 3 Nov · Training tomorrow"). Tap it: the Today list (mockup 1, left).
2. **The phone:** the status bar shows the game time (it shows the date today: `PhoneFrame.tsx:22`). The lock screen shows a big time and a **Today and next** list: what is planned, who is coming, when to leave (mockup 1, right).
3. **The Phone pill never hides** in a 3D place, and always opens the phone (never the boss talk). If the phone app is not unlocked yet, it shows locked with one line why.

---

## 3. VISITORS AND NPC LIFE

### 3a. Who is in your house, and when

The rule: **the house is empty unless there is a reason.** A planner decides each day who comes (`dayPlan(career, day)`, pure code). It reads the save; it never invents a person.

| Who | When | How often (recommended) |
|---|---|---|
| Nobody | the default | about 6 days in 10 in a flat; about 4 in 10 at a villa |
| Team-mate, dropped round | a free afternoon, bond 40+ | 1 to 2 a week, never on match day |
| Team-mate, invited | you text "Come round?" on the phone; he answers yes/no by his bond and his week | when you choose (max 1 a day) |
| A story visitor | a story beat says so (the kit man, the neighbour, your brother) | when the story says |
| Mum / dad / brother / sister | Sunday lunch, a birthday, after a bad loss | about once a month |
| Partner (lives with you) | after a story moves her in (e.g. `her-shop`, `her-sisters-wedding` arcs) | every day: own routine (works, out, home in the evening) |
| Cleaner | owns the House tier or bigger | 2 mornings a week, 09:00 to 12:00 |
| Chef | Villa or Estate | every day: lunch 11:00 to 13:40, dinner 17:00 to 20:40 |
| Gardener / security | Estate, in the garden only | daytime |

1. The planner is seeded, so the same day plays the same way on any device, and a test can check it.
2. A visitor knows your day: no drop-ins 4 hours before a match or during training.
3. Ignore a knock at the door (or a text) and he remembers (see 5c).

### 3b. What they do: routines as data

1. Each person type has a **routine template**: a list of steps with times, chances and choices. This builds on `routine.ts`, which already has steps, gaps, chances and repeats.
2. **New kinds of step:**
   - `go`: walk to another room (through the doorway, never a fade).
   - `pick`: choose one of several (TV, fridge, phone call, pool), weighted, never the same one twice in a row.
   - `away`: hidden off screen for a while (the toilet, a shower, "out"). He walks out of the room first.
   - `call`: stand at a window with the phone to his ear.
   - `cook`: stand at the hob, a chopping loop, then "plates up" (puts food on the table).
   - `meet`: walk up to another person and talk (two people facing, gestures).
3. **The 45-minute rule:** no step on one thing lasts more than 45 game minutes. A test fails any template that breaks it.
4. **Every visitor leaves.** A visitor template must end with `leave`. A test fails any that does not.
5. **Example: team-mate dropping round** (mockup 3, middle lane): arrive at the gate → greet you at the door → sofa and TV (20-45 min) → fridge, a can → `pick` (pool with you if you are free, darts, phone call at the window) → toilet, off screen (5 min) → dinner if the chef cooked → leave, says bye at the door.
6. **Example: chef** (mockup 3, right lane): arrives 11:00 → cooks → serves → cleans → out → back 17:00 → cooks (for two if a visitor is in) → plates up → cleans → leaves.
7. **Example: partner, lives with you:** wakes 07:30 → coffee → shower (away) → out to work 08:30 on weekdays → home 18:00 → cooks or orders food → TV with you → bed 23:00. Weekends: in the garden, out with friends, at your home games.

### 3c. Smooth and believable

1. **Where is everyone right now?** A pure function: `whereAt(routine, minute)` returns room, step and how far through it. So when you walk into a room mid-afternoon, people are already mid-action in the right place. Nothing is simulated in rooms you cannot see.
2. **Only your room is drawn.** People in other rooms are hidden and cost nothing [reasoned]. When a person's routine sends him into your room, he walks in through the door.
3. **Hand-offs:** every step ends with its exit clip, a 1-3 s "look round" idle, then the walk. Never a snap from one pose to another.
4. **Reacting to you:** he looks up when you walk in. If you sit next to him he turns to you. If you leave him alone for 30 minutes he goes and does something else. If you are in bed he does not come in.
5. **Reacting to each other:** two people on one sofa take turns looking at each other (already in `houseLife.ts` update). With `meet`, the chef and a visitor say a line to each other ("Smells good").
6. **Reacting to what happened:** after a loss, visitors sit more and talk less; after a win, the TV is on and they play pool more (weights in the template read the last result).

---

## 4. THE CONVERSATION MENU

### 4a. How it opens

1. Tap a person in any 3D place. You walk up (already built: `houseLife.ts` `tapPerson`). The **round menu** opens round his head (mockup 2). It replaces the plain card.
2. Mounting: the 3D scene tells the screen where his head is (a new `headOnScreen(id)` on the house controller). The ring sits round it. The camera already frames you both (`houseLife.ts` `talkTo`).
3. Phone and computer both: tap a bubble, or keys 1-6 then 1-3, Esc to go back (already in `RoundMenu.tsx`).

### 4b. What is on the ring (built fresh each time)

1. **His name plate:** name, role, mood face, bond and respect (already built).
2. **One memory line first** if he has something to bring up ("You took his last can on Monday. 'Still owe me, by the way.'"). Taken from his strongest recent memory or habit.
3. **Up to 6 bubbles**, chosen from these sources in order:
   1. A story waiting for this meeting (gold bubble; `bubblesFor` already does this).
   2. What he is doing now: on the sofa = "What's on?"; cooking = "What are you making?"; at the pool table = "Game?".
   3. What just happened: last match, his own goal, an injury, a transfer rumour, your new car.
   4. Your relationship: high bond unlocks "Fancy going out?" and invites; a grudge unlocks "Clear the air".
   5. Time of day: late = "You staying over?"; morning = "Lift to training?".
   6. The usual ring: Friendly, Banter, Football, Business, Mean, See you (already built).
4. **Tones on the answers:** each topic has 2-3 replies tagged humble / confident / fiery, or kind / honest / lie / cold (the tags already exist: `types.ts:98`). The tag shows what it is likely to do (▲ BOND, ▲ RESPECT, ▲▼ RISKY).
5. **Each topic costs time** (1-5 game minutes), shown on the hint line.

### 4c. The topic book

1. A new folder `lib/star/life/book/topics/`, one JSON file per group of topics. **A topic is a tiny talk** in the same format as a story's talk (`types.ts:302` `TalkNode`, `:338` `LifeTalk`). So one checker, one writer's guide, and a topic can grow into several rounds.
2. Each topic has: who it is for (role, bond, conditions using the existing `cond.ts`), where (room, what he is doing, time), a cooldown (not the same topic twice in a week), replies and their outcomes (bond, respect, grudge, today's mood, a memory, a flag, start a story).
3. Start with 60 topics, then grow in batches of 30. Writing goes through the de-ai skill.
4. Small topics change today's mood and small numbers only. Big moments stay in stories and events.

### 4d. Stories inside conversations

1. **New entry kind: `inPerson`.** A story beat can wait for "the next time you see Den". It shows as a gold bubble on his ring, in any 3D place where he appears.
2. If you do not see him within N days (the beat says how many, default 6), the beat falls back: he texts or calls you on the phone. Nothing is lost.
3. A topic can **start a story** (`startArc`, already in `types.ts:335`), e.g. "Ask about his boot deal" starts `his-boots`.
4. Stories can **ask about the house**: conditions like `habit:kyle:cans>=3`, `visited:kyle>=2`, `act:invited`, `clock:late` (new atoms in `cond.ts`).

### 4e. People remembering

1. **What he says when you walk up** comes from his memories first (a "remark" line per memory tag), then from what he is doing (as today).
2. **Callbacks already exist** (`types.ts:118` `LifeCallback`). They get a new place: `talk:any` (any conversation with him in 3D).

---

## 5. MEMORY AND CONSEQUENCES

### 5a. One model, three layers

| Layer | What | How long | Saved where | Who writes it |
|---|---|---|---|---|
| Today's mood | -5 to +5 per person: how he feels about you right now | drifts back to 0 over about a week | per person, 1 number + the day | small acts, small talk |
| Habits | counts of small acts on one person ("took his can: 2") | this season | per person, up to 4 counts | small acts |
| Memories | the existing `[tag, week, strength]` lines, up to 6 | strength 1 about a season, 2 about three, 3 for good | per person (`types.ts:173`) | stories, events, big acts, a habit's 3rd time |
| Relationship | respect, bond, grudge (0-100) | stays | per person | everything, through `nudge` (`people.ts:188`) |

1. **The rule that keeps it small: habits become memories.** Taking a can once only drops his mood a little. The 3rd time writes a real memory ("can-thief", strength 1). A story can then read it.
2. **Your own state:** energy (exists), and a new **mood** for you (-10 to +10, drifts to 0). Things like the bath and darts move it. It feeds the existing happiness a little (capped).

### 5b. What actions do (examples)

| Act | Who it touches | Effect |
|---|---|---|
| Take the can he was going to have | him | mood -1, habit "cans"; 3rd time: memory |
| Invite him round | him | bond +1; he comes: mood +2 |
| He knocks, you don't open | him | mood -2, habit "ignored"; 2nd time: memory, grudge +2 |
| Ignore mum's call | mum | mood -1; 3 in a month: memory, a story can fire ("Call your mum") |
| Late for training | coach / manager | habit "late"; 2nd time: memory, boss -1 |
| Slept in on match day (not allowed past leave time, but late leaving) | manager | boss -1, a press line |
| Cook for a visitor | him | bond +2, mood +2 |
| Let him win at pool | him | mood +2; he beats you 3 times: "pool king" memory, banter topic unlocked |
| Coffee | you | energy +1 (the 3rd a day: nothing; the 5th: "jittery", mood -1) |
| Nap after 18:00 | you | energy +2 now, sleep gives 1 less |

1. Every effect has a **daily cap**, so nothing can be farmed. Example: house things give at most +3 energy a day in total.
2. All numbers live in one table, `lib/star/life/acts.ts`, and are tested.

### 5c. Stories and the house share it

1. A story's `remember` (already in `types.ts:74`) writes the same memory lines.
2. A story's conditions read habits and today's mood (new atoms).
3. A house act can fire a story moment (`act:<id>`), e.g. three ignored knocks fires the "the-alibi" kind of story.

### 5d. Save size budget

Measured tonight: 30 careers × 15 seasons, the life block is at most **14.6 KB** (mean 12.9 KB), most people 55, finished stories 13.9 bytes each [measured: `npx tsx scripts/soak/lifeSoak.mts 30 15`]. The limit is 50 KB (`scripts/soak/lifeSoak.mts:59`). So there are **35 KB free**.

| Feature | Budget |
|---|---|
| The clock | 30 B |
| Household and staff (who lives or works there) | 200 B |
| Today's mood + day, per person (60 people) | 1.2 KB |
| Habits, up to 4 per person, this season only | 2.4 KB |
| Topic cooldowns (last 40 topics used) | 1 KB |
| Visits log (last 14 days: who, when) | 0.5 KB |
| The Today diary (last 7 days, short) | 1 KB |
| **Total new** | **about 6.3 KB, hard ceiling 10 KB** |

1. The soak prints each part's bytes and fails past its budget.
2. Old saves load with none of it (all fields optional), like every life field today.

---

## 6. MORE TO DO

46 new things. Each has a time cost and one small real effect. Ranked by **fun ÷ build effort** (fun 1-5, effort 1-5, my judgement [reasoned]). Effects use the daily caps in 5b.

| # | Where | Thing | Time | Effect | Fun | Effort |
|---|---|---|---|---|---|---|
| 1 | Phone | Text a team-mate "Come round?" | 1 min | he comes at the time you pick; bond +1 | 5 | 1 |
| 2 | Phone | Order a takeaway; the doorbell goes 35 min later | 2 min | mood +2; the night before a match: fitness -1 | 5 | 1 |
| 3 | House | Answer the door (visitor, parcel, neighbour) | 1 min | starts a visit, a story or a gift | 4 | 1 |
| 4 | House | Nap on the sofa | 60 min | energy +2 | 3 | 1 |
| 5 | Phone | Video-call mum or dad from the sofa | 15 min | family bond +2 | 4 | 1 |
| 6 | Bed | Set the alarm (06:30, 07:30, 09:00) | 0 | late risk for training | 3 | 1 |
| 7 | House | Watch your last match's goals on the TV (the real goal clips) | 20 min | mood +1; with a mate: bond +1 | 5 | 2 |
| 8 | Shop | Buy food; the fridge fills (and empties as people use it) | 10 min | fridge stocked; empty fridge = takeaway | 4 | 2 |
| 9 | House | Cook a meal (healthy or comfort) | 40 min | energy +2 or mood +2; with guests: bond +2 each | 5 | 2 |
| 10 | House | Ice bath (the bath, cold) | 15 min | match fitness +2, only the day after a match | 3 | 1 |
| 11 | Gym/house | Foam roller / stretch | 15 min | injury risk down next match (a flag) | 3 | 1 |
| 12 | Kitchen | Protein shake | 5 min | gym points ×1.2 this gap (exists for the cooler) | 3 | 1 |
| 13 | House | Read the paper at the kitchen table | 10 min | shows real headlines (media feed); mood ± | 3 | 1 |
| 14 | Wardrobe | Pick a smart outfit for a press day | 5 min | next press conference: fans +1 | 3 | 1 |
| 15 | Mirror | Practise a celebration 3 times | 5 min each | unlocks that celebration | 5 | 3 |
| 16 | Pool table | Play a visitor (aim-and-power mini-game) | 20 min | winner memory; pool-king banter | 5 | 3 |
| 17 | Darts | 501 against a visitor | 15 min | same as pool | 4 | 3 |
| 18 | TV | Play a console match with a visitor (a quick result screen) | 30 min | bond +1; a rivalry habit | 4 | 2 |
| 19 | TV | Watch the next opponent's game | 45 min | next match vs them: a small vision boost (+1 for that match) | 4 | 2 |
| 20 | Table | Sign shirts for charity | 20 min | fans +1; the kid fan remembers | 3 | 1 |
| 21 | House | Tidy up / wash up | 15 min | partner or mum mood +1; mess level down | 3 | 2 |
| 22 | House | Water the plants | 5 min | a plant dies after 3 weeks ignored (a house memory) | 2 | 1 |
| 23 | House | Open a sponsor parcel | 2 min | a sponsor item in the wardrobe | 4 | 1 |
| 24 | Phone | Answer or ignore the agent / mum / a team-mate | 2-10 min | memories (5b) | 4 | 1 |
| 25 | Villa | Sauna | 20 min | energy +2 | 3 | 2 |
| 26 | Villa | Swim lengths | 30 min | cardio points | 4 | 3 |
| 27 | Villa+ | Host a team night (invite 3-4) | 3 h | team bar +1; the neighbour may complain (`next-door` story) | 5 | 4 |
| 28 | Garden | BBQ with visitors | 90 min | bond +2 each | 4 | 3 |
| 29 | Garden | Sunbathe on a lounger (exists: wire the effect) | 30 min | mood +1 | 2 | 1 |
| 30 | Garden | Feed and groom the horse | 10 min | horse form + for the races | 3 | 2 |
| 31 | Garden | Keepy-ups / kickabout (exists, play3d) | 15 min | technique practice | 4 | 1 |
| 32 | Garden | Crossbar challenge with a visitor (real engine) | 15 min | bond +1; winner memory | 5 | 2 |
| 33 | Estate | Walk round the grounds | 20 min | mood +1 | 2 | 1 |
| 34 | Gym | Bench / treadmill / bag (exist: wire to clock) | 20-40 min | gym stats | 4 | 1 |
| 35 | Gym | Train with a team-mate (he spots your bench) | 40 min | safer set, bond +1 | 4 | 3 |
| 36 | Gym | Book the physio for a yoga session | 45 min | injury risk down | 3 | 3 |
| 37 | Villa+ | Personal trainer visit (staff) | 60 min | a full ring with bonus | 3 | 3 |
| 38 | Shop | Try on clothes and buy | 15 min | wardrobe; fame tiny | 3 | 1 |
| 39 | Shop | Sign autographs for fans | 10 min | fans +1; kid fan memory | 4 | 3 |
| 40 | Shop | Buy a gift, give it in person later | 15 + 2 min | strength-2 memory (birthday stories) | 5 | 3 |
| 41 | Shop | Coffee at the café with a team-mate (`the-cafe` story) | 30 min | bond +2 | 4 | 3 |
| 42 | Phone | Book a barber / home haircut (hair growth plan) | 45 min | look; sponsor conditions later | 4 | 5 |
| 43 | Phone | Group chat banter | 5 min | squad mood; a topic for next time | 4 | 2 |
| 44 | House | Lend your car to a mate | 1 min | bond +3; a story may follow (`the-bad-car`) | 4 | 2 |
| 45 | House | Let a mate stay the night (spare room) | overnight | bond +3; he is there at breakfast | 4 | 3 |
| 46 | House | Play with a pet (dog) | 10 min | mood +2; needs a pet system | 5 | 5 |

Top 10 to build first (best fun per effort): 1, 2, 3, 5, 4, 7, 9, 23, 24, 31.

---

## 7. BUILD PHASES

Each is one builder-day or less, ships alone, and is tested alone. Order matters: the clock and the pure planners come before any 3D.

| Phase | What | Ships | Tests |
|---|---|---|---|
| **P1** | The career clock (pure): `lib/star/life/clock.ts`. Day + minute, costs, sleep to 07:00 or the alarm, training and match-day times, the "time to leave" stop. Save field + old saves load. **Plus the Phone pill fix** (always shown, never reroutes). | the pill fix; clock hidden | `tests/star/lifeClock.mts`: a match is never skipped; sleep lands at 07:00; costs add; days run out at match day. Old-save fixture still loads. |
| **P2** | The clock on screen: the pill in 3D places, the phone's status bar and Today list. The house reads the career clock (not its own 15:00). Actions cost time (dip + "X minutes later"). | yes | Tap check on the phone: pill shows, time matches the phone. Frame meter: no change in draws. |
| **P3** | Routines v2 (pure): `go`, `pick`, `away`, `call`, `cook`, `meet` steps; `whereAt(routine, minute)`; the 45-minute rule; visitors must leave. 6 templates: team-mate drop-in, invited mate, partner, mum, cleaner, chef. | no (pure) | `tests/star/routine.mts` grows: 1,000 seeded days, nobody over 45 min on one thing, every visitor leaves, same seed = same day. |
| **P4** | Who is home (pure): `dayPlan(career, day)`: rates by tier, invites, story visits, staff, never near a match or during training. | no (pure) | `tests/star/dayPlan.mts`: a flat is empty 50-70% of days; no visitor 4 h before kick-off; an invite always shows up if he said yes. |
| **P5** | 3D: people move between rooms on their routine, enter by the door, hide when not in your room. Arrival at the front door with the doorbell. Replaces "always seated" `seatGuests`. | yes | Seat check (RUL-3D-005) still 0 cm; `?fps=1` on a mid Android: no more than the room budget below; a 10-minute watch: nobody frozen. |
| **P6** | The round menu in 3D: `headOnScreen`, ring round his head, `playRoundLine` saved, gold story bubbles. Turn on the living world for team accounts (question 3). | yes | `tests/star/roundMenu3d.mts` (pure parts); playtest: tap, ring, pick, bond moves, saved after reload. |
| **P7** | The topic book: format, checker, picker (`topicsFor`: what he is doing, time, last match, memories, stories), 60 topics. | yes | `tests/star/lifeTopics.mts`: every topic valid, no pool names in text, every topic reachable in the soak. |
| **P8** | Acts and consequences: `lib/star/life/acts.ts`, today's mood, habits → memories, your mood, daily caps; wire `onEffect` (coffee really gives energy). | yes | `tests/star/lifeActs.mts`: caps hold; 3rd habit writes a memory; mood drifts back. Soak: bytes under budget. |
| **P9** | Stories in person: `inPerson` entry, the fallback to a text, new moments (`home:morning`, `home:visit`, `act:*`, `clock:late`) and condition atoms. Convert 3 stories (kit man, next-door, her-birthday). | yes | `lifeArcs.mts`, `lifeSoak.mts` (every beat still reached), `lifeSaveFixture.mts` unchanged. |
| **P10** | More to do, batch 1: items 1, 2, 3, 4, 5, 6, 23, 24 (phone invites, takeaway, door, nap, video call, alarm, parcel, calls). | yes | Pure tests for each effect; one playtest. |
| **P11** | More to do, batch 2: items 7, 9, 10, 11, 12, 13, 14, 31, 34 (goals on TV, cooking, ice bath, foam roller, shake, paper, outfit, wire garden + gym to the clock). | yes | same |
| **P12** | Partner and staff living in: household in the save, partner from a story, cleaner and chef by tier, their routines in 3D. | yes | dayPlan tests; 3D budget check at the villa. |
| **P13** | Lateness and match day from the house: training buzz, late habits, "Go to the match" button, can't pass leave time. | yes | lifeClock tests; career soak `npx tsx scripts/soak/careerSoak.mts 20` (no season breaks). |

Later batches: pool and darts mini-games, team night, BBQ, gifts, the shop café, the training ground with the same people system.

### 7a. Tests that run every phase

1. Pure tests: `npm run test:star life` (all life suites).
2. The life soak: `npx tsx scripts/soak/lifeSoak.mts` (200 careers). Extended to play a simulated day each week: random acts, visits, topics. It checks bytes per feature, nobody stuck, every promise closed.
3. The career soak for anything touching the calendar.
4. On a phone: `?fps=1`, and `npx tsx scripts/perf-report.mts --since 24h --device S20` after Mikey plays.

### 7b. Risks

1. **Speed on a mid Android (Mikey's S20).** A person costs about 4 draws and 14.5k triangles [measured, `docs/3D_HANDBOOK.md` lines 841 and 1183]. Rooms today are 37-63 draws and 30-92k triangles, limit 120 draws and 150k [measured, handbook line 547]. **Room budget:** android-mid and Low: you + 2 others in your room; Medium: you + 3; High: you + 5. Only your room's people are drawn. Over the budget, the planner sends the extra person to another room. Every new person type is measured before it ships.
2. **The one-engine rule.** Anything with a ball (crossbar with a mate, keepy-ups) runs the real match engine or the play3d exception (RUL-ENG-002, RUL-3D-001). Pool, darts, cooking and the gym are not football, so they may have their own small games.
3. **The economy.** If house things give energy, players could skip Rest. The daily caps (5b) and keeping the 3 weekly things stop that [reasoned]. Check with the soak: average energy before matches must not rise more than 2.
4. **`app/star-dev/page.tsx` is shared.** Keep edits there small and additive (the clock field, the pill fix, the go-to-match button).
5. **Save size.** Ceiling 10 KB for all of this, checked by the soak.
6. **Writing volume.** 60 topics, then more. Every line goes through the de-ai skill; never write a pool name into a line.
7. **The living world is off in the career.** Until question 3 is answered, the memory and story parts can only be seen on test pages.

---

## 8. Harry's questions (5)

1. **How fast does the clock move in 3D places?**
   Recommended: slowly by itself (1 game minute every 6 real seconds) and in jumps when you do things. Menus stop it. So people visibly move about, and the day still lasts.
2. **Do the week's 3 things stay?**
   Recommended: yes. They keep the match balance as it is. Each now also costs half a day on the clock. House things are small extras with daily caps.
3. **Turn the living world on in the real career?** (`LIFE_IN_CAREER`, off today)
   Recommended: yes, for team accounts at the end of phase 6, then for everyone after one week of playtests.
4. **Match day: does the game make you leave?**
   Recommended: yes. At kick-off minus 2 h 30 the clock stops and a "Go to the match" button shows. You can never sleep past a match.
5. **Who can live with you?**
   Recommended: a partner only through a story (never forced), family only for visits, staff by home: cleaner from the House tier, chef from the Villa, gardener at the Estate.
