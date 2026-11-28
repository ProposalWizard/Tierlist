# Plan: the Star Pass, the Barber and the Food Hall

For Harry (and Mikey for the Star Pass part). Written 28 Nov 2026. A plan only: no game code was changed.

**Key point.** All three features fit onto systems that already exist. The Star Pass gets **story stops**
(events you play to win the reward). The barber's shut door on the shopping street **opens**, and your hair
and beard **grow** between visits. The training compound's canteen door ("coming soon") opens as the
**food hall**: one plate a day that nudges your next session, plus lunch with a team-mate.
**Key number.** About **60 bytes** more in a save for all three together (a save is 180 to 550 KB today).
Every real effect is small and capped, the same way the gym and the house things are.
**Key change.** Today the Star Pass only hands out items, the barber is a "coming soon" card, and the canteen
is a "coming soon" card. After this, all three are places and moments you actually play.

How I know what is below: I **read** the code and the plans named in each part. I did **not** run the game
or any soak, so every "how often" number is a design target, not a measurement. Effort is in working days
for one builder, my estimate from the size of each piece.

Brain search first (CLAUDE.md): `star pass` → no note yet. `barber`, `food hall`, `hair` →
**RUL-UI-013** (Harry's idea bank: hair that grows, a barber, a food hall where team-mates go about their
day). Also used below: **RUL-3D-010** (coily hair styles only on coily hair), **RUL-3D-006** (3D sizes never
change), **RUL-ENG-002** (anything with a ball runs the real match engine), **RUL-UI-002** (unfinished work
lives on a test page first), **RUL-TEAM-009** (build slowly: smallest real piece first).

A few words used below:
- **Gap** = the time between one match and the next. The gym, sleep and the week's 3 things all run on it.
- **Clock minutes** = the career clock's time of day (`lib/star/life/clock.ts`). Doing something moves it on.
- **Flag** = one on/off line in the code, so a feature can be built and tested but switched off in the game.
- **Unlock** = an entry in the one list of things a story can open (`lib/star/life/unlocks.ts`, 44 today).
- **Save code** = the 3-letter short name an unlock is stored as, so the save stays small.

---

## 1. The Star Pass

### 1.1 What it is

Harry, 20 Nov: **"events rather than gifts — beat club legend, unlock celebration, wager ur car vs him"**.
Mikey: *"We haven't done the star pass properly … Imagine at lvl 10 you get that legend walk in and if you
impress you get smth."* Harry: *"level 10 would happen averagely at like 20 yrs old"*.

In one line: **the Star Pass road keeps its 100 levels and its reward cards, and gains about 12 story
stops, where the reward is won in a scene you play, not handed over.**

### 1.2 What exists in code today

| Piece | Where | State |
|---|---|---|
| Levels 1 to 100, the points curve, gates, Legend tasks | `lib/star/starPoints.ts` | Built (Mikey). Level 10 comes after about 30 matches, in season 1, age about 16 (code comment, 1,000 simulated careers) |
| The road screen (Trophy Road look, 5 themes) | `components/star/StarRatingSheet.tsx`, `lib/star/starPassRewards.ts` | Built |
| 50 reward cards, one every 2 levels | `lib/star/rewardCatalogue.ts` `DEFAULT_PASS_LEVELS` | Built. All are items: run-ups, celebrations, boots, cars, homes |
| Claiming, the Locker | `lib/star/starPassClaim.ts` (`starPassClaimed` in the save) | Built |
| Shared layout, admin page | `lib/star/starPassStore.ts`, `/admin/star-pass` | Built |
| Spinning 3D reward | `components/star/Podium3D.tsx` | Built |
| Story conditions that read the level | `lib/star/life/cond.ts` (`starLevel>=N`), `lib/star/life/milestones.ts` (`just(star-level)` at 10, 25, 50, 75, 100) | Built: a story can already wait for a level |
| Unlocks list | `lib/star/life/unlocks.ts` | Built: 44 entries, `has(<id>)` reads them |
| A "story stop" on the road | none | **Not built.** `starPassStop` is only in the design docs |

### 1.3 How it fits the career

- **What you do.** You reach a story-stop level. The road shows a locked scene card ("Someone is waiting for
  you at training"). The next time you are in the right place, and old enough, the story fires and you play it.
- **How often.** About 12 stops in a whole career: roughly one a season early on, then one every two seasons.
  Reward cards stay on the levels between stops.
- **What it changes.** You **win** the reward: the legend's boots, a celebration, a squad number. Lose, and the
  stop stays on the road as "unfinished business" and comes back later. No stat effects at all: the rewards
  are items, unlocks and scenes (the same as today's cards). The one real loss is a wager you choose
  (Harry, 20 Nov: "u'd lose whatever u wager", the car is gone).
- **The age problem, said plainly.** Today level 10 arrives at about age 16, not 20. Harry's answer was
  "roughly B" (re-tune the levels to ages), "but it's rlly more important that the actual rewards and story
  aspect of the game is actually working". So this plan builds the stops first, each with a **level AND a
  youngest age** (it fires when both are true). The re-tune comes after, with Mikey, once a printout shows
  the real level at each age.

The first stops (placeholders until the printout; from `docs/plans/living-world-design-2026-11-20.md` part 4):

| Stop | Level | Youngest age | You play | You can win |
|---|---|---|---|---|
| First boots deal | 6 | 16 | a rep watches you train; hit 3 of 5 targets | a first sponsor + a colourway |
| The legend | 10 | 19 | the legend 1v1 (real engine) | his boots and a celebration, or lose your car |
| The number | 15 | 18 | crossbar challenge with a senior pro | the shirt number you choose |
| **The barber's chair** (new) | 20 | 18 | the barber's first visit as a known face | your signature cut (part 2) |
| **The captain's table** (new) | 30 | 21 | lunch in the food hall when the squad splits | the senior table (part 3) |
| The kid | 70 | 27 | a 17-year-old takes your shirt in training | a protégé who remembers |
| The legend returns | 80 | 30 | you are the one in the circle now | a kid's respect |

### 1.4 Where it lives

- **The road:** the existing Star Pass screen (from the star rating in the top bar). A story stop is a new card
  type: a still from the scene, the place, and "from age 19".
- **Where it plays:** wherever the story says (training, the street, the food hall, the garden). The road
  never plays a scene itself; it only points.
- **Admin:** `/admin/star-pass` gets a "story stop" choice next to the card picker, so Mikey can move them.

### 1.5 Data in the save

| What | Size |
|---|---|
| Each stop's state (not reached, waiting, unfinished, won): one letter per stop, 12 stops | about 20 bytes |
| What you won | already in `life.ul` (unlocks) and `ownedItems`: 0 new bytes |
| **Total** | **about 20 bytes** |

### 1.6 Tie-ins

- **Unlocks registry:** each stop's prize is an unlock id. New ones proposed: `signature-cut` (save code `bsc`,
  part 2) and `senior-table` (save code `snt`, part 3). Both codes are free today (checked against the 44).
- **Garden levels:** the events plan's D5 says the garden level is the **lower** of what your Star Pass / club
  size allows and your home (`docs/plans/living-world-events-v2-2026-11-20.md`, D5). Garden XP from drills and
  the casino stays as it is (`lib/star/gardenLevels.ts`); the Star Pass only sets the ceiling. Mikey's area.
- **Stories:** a stop IS a story in the book with one extra word saying which level it sits on. One system.
- **Clock:** a stop fires only on arrival at its place, so it uses that place's clock minutes.

### 1.7 Build phases

| Phase | What | Harry / Mikey sees | Effort |
|---|---|---|---|
| **S0** | A printout: the middle Star Pass level at each age, over 200 soak careers | A table: level at 17, 18 … 35 | ½ day |
| **S1** | The story-stop card on the road, its 4 states, a stop written as a story in the book; on a test page first | The road with a locked scene card at level 10 | 1 to 2 days |
| **S2** | The first 2 stops for real: "First boots deal" (drill exists) and "The number" (crossbar exists) | Reach level 6, play it, win the boots colour | 2 to 3 days |
| **S3** | "The legend" stop, once the legend 1v1 is built (events plan phase 2) | Level 10 + age 19: the legend is waiting | 1 day on top of the 1v1 |
| **S4** | The re-tune with Mikey ("roughly B"), if S0 shows it is needed; every card moved with it | A soak: level 10 lands near age 20 | 2 to 3 days + soak |
| **S5** | Garden ceiling by Star Pass / club size | Garden level 3 needs Star Pass 25 or a Championship club | 1 day |

Total about 8 to 11 days, not counting the legend 1v1 itself.

### 1.8 Open questions (with our suggested answer)

1. **Re-tune now, or stops first?** *Suggested:* stops first, with a youngest age on each; re-tune only after
   the S0 printout, and only with Mikey's yes. It keeps every card Mikey placed where it is.
2. **Does a story stop replace the reward card on its level?** *Suggested:* no, it sits beside it. The card is
   claimed as normal; the stop is extra.
3. **If you lose a stop, how often does it come back?** *Suggested:* once a season, at most 3 tries, then it
   becomes a memory ("you never beat him") that a later story can use.

### 1.9 Risks

- **Mikey's lane.** The Star Pass is Mikey's. Every change here needs his agreement, and the shared files
  (`app/star-dev/page.tsx`, `types.ts`) get small, added-on edits only.
- **Re-tuning moves everything.** Gates, the curve and 50 cards are tied to it. One soak before and after.
- **A stop that never fires.** If the place it needs (the compound, the street) is not in the career yet, the
  card would wait for ever. Rule: a stop only goes on the road once its place is live.
- **Old saves.** A save already past level 10 should see stops it passed as "waiting", not lose them.

---

## 2. The Barber

### 2.1 What it is

Harry, 19 Nov (RUL-UI-013): **"ur hair and potentially facial hair grows over a szn naturally and then when in
ur bathroom u can style it and u can also go to a barbers"**.

In one line: **your hair and beard grow week by week; you trim or shave at your own mirror for free, and you
go to the barber on the shopping street, for money, for the styles you can't do yourself.**

### 2.2 What exists in code today

| Piece | Where | State |
|---|---|---|
| The barber's shopfront, shut, "Opening soon", pole turning | `lib/star/street3d/scene.ts` (line ~710), `textures.ts` `barberCanvas`, `soonCanvas` | Built |
| The door rule (barber `opens: false`, shows a card) | `lib/star/street3d/plan.ts` | Built |
| The street screen, the "Barber ›" button and the card | `components/star/Street3D.tsx` | Built |
| A "barber chair" kind of thing to sit in | `lib/star/world3d/smartObject.ts` (`barberChair`) | The word exists; no chair built |
| Sitting down (one capture, held to stay sat) | `lib/star/world3d/` world kit | Built |
| Your hair in the save | `types.ts` `hairStyle` (short, long, buzz, shaved), `hairColour` (4), `head3d` | Built, chosen in Settings → Your look |
| 15 modelled 3D hairstyles + 4 head shapes, hair that swings | `lib/star/style3d/toon/hairStyles.ts`, `hair.ts`, `tools/hair3d/` | Built for **presets only**: nobody in the game changes hair yet |
| Beards on the drawn face (stubble to full) | the face system, `faceBuild` (`docs/3D_HANDBOOK.md` section 2) | Built for people presets |
| The bathroom mirror in every house tier | `lib/star/home3d/livingRooms.ts`, `lib/star/life/houseActs.ts` (`mirror`: 5 minutes) | Built; today it only gives the house's small mood |
| Hair that grows | none | **Not built** |

### 2.3 How it fits the career

- **Hair grows.** Your hair has a length step (0 cropped, 1 short, 2 medium, 3 long) and your beard has one
  (0 clean, 1 stubble, 2 short beard, 3 full). The beard goes up one step about every 2 weeks; hair about
  every 6 weeks. That is the same week counter the season already has: no timer runs while you are away.
- **The mirror (free, 10 clock minutes).** At home: shave, trim the beard a step, tidy the hair. You can only
  go **shorter** or **tidier** yourself, never a new style. (Red Dead's rule.)
- **The barber (money, 45 clock minutes).** Walk through the door on the street, sit in the chair, pick a
  style from the list that suits **your** hair (RUL-3D-010: locs, afro, twists, braids, high-top only on
  coily hair; slick back and tied back only on straight or wavy). The barber talks while he cuts: this is
  where barber stories and gossip happen.
- **Price.** Priced off your weekly wage, like the energy cans, so it stays a small spend at every club:
  a cut is about 2% of a week's wage; a "big change" (locs put in, braids) about 5%.
- **Real effects, small and capped:**
  - a fresh cut: **mood +1** (the house's mood scale, -10 to +10), once a gap;
  - a fresh cut before a big match (a final, a derby): **fans +1**, at most once a month;
  - nothing else. No skill, no rating, no energy. The look is the reward.
  - Left untidy for 10+ weeks: the gaffer or a team-mate says something (a line in a story). No penalty.
- **How often.** Most players will go every 4 to 8 weeks, about 6 to 10 times a season. It is never forced.

### 2.4 Where it lives

- **3D (phone and PC):** the barber's door on the shopping street opens into **one small room**: a chair, the
  mirror wall, a shelf of tins, the barber, and one customer waiting. The camera is camera D (the base for all
  3D areas), then a close shot in the mirror for the cut.
- **The cut itself:** not a minigame at first. You pick, the screen fades on a few seconds of the barber
  working, and you see the new look in the mirror. (A later phase can add a simple "hold still" moment.)
- **At home:** the existing bathroom mirror gets "Shave", "Trim beard", "Tidy hair" on its card.
- **Phone without 3D:** a still of the room and the same list.

### 2.5 Data in the save

| What | Size |
|---|---|
| Hair style id (one of 15 + the 4 old words) | 1 to 4 bytes |
| Hair length step, beard step | 2 bytes |
| Week of the last cut, week of the last shave | about 8 bytes |
| The barber as a person (bond, memories) | already in `career.life` people: about 30 bytes when you first meet him |
| **Total** | **about 15 bytes, plus the barber's person entry** |

An old save has none of this: it reads as "short, tidy, clean shaven", which is how it looks today.

### 2.6 Tie-ins

- **Star Pass:** level 20 "The barber's chair" story stop wins **`signature-cut`** (save code `bsc`): a style
  only you wear, named after you. The barber then calls you by your name.
- **Stories:** the event book already plans 30 "barber, hair, style" events (`living-world-design-2026-11-20.md`
  section 5.1). The Liverpool legend story already has "you are fined for a haircut"
  (`docs/plans/STORY_WORLD_PLAN.md`). A sponsor that wants a clean look can read the beard step later.
- **Clock:** barber 45 minutes, a big change 90 minutes, the mirror 10 minutes.
- **Gym:** none (on purpose).
- **Drive back from training:** "the barber" is one of the drive-back choices in the driving plan
  (`docs/research/gym-compound-driving-2026-11-27.md` section 4).
- **Everywhere you appear:** the match, the signing, the house and the cut scenes all read the same hair
  fields, so a new cut shows everywhere at once.

### 2.7 Build phases

| Phase | What | Harry sees | Effort |
|---|---|---|---|
| **B1** | The rules on their own: growth by week, the mirror's "shorter only", the price, the caps; a test | A season printout: hair and beard steps week by week | 1 day |
| **B2** | **Your** 3D head wears any of the 15 modelled styles and the beard steps (today only presets do); Settings → Your look shows them | Your player with locs, then a crew cut, in the house | 2 to 3 days |
| **B3** | The barber opens: the door leads in, one room, the chair, the barber, the style list, pay, the mirror shot; on `/star-street-dev` first | Walk in, sit, pick, see yourself | 4 to 6 days |
| **B4** | Growth you can see: hair length steps by swapping to the next-longer style of the same hair type; beard steps on the face | Week 1 vs week 12: stubble to full beard | 2 to 4 days |
| **B5** | The home mirror's Shave / Trim / Tidy; the first 10 barber stories | Shave at home; the barber's gossip | 2 days |

Total about 11 to 16 days. No paid service needed: the hair tools (`tools/hair3d/`, Blender) are free and
already in the repo.

Optional cost line, **needs Harry's yes:** writing the 30 barber stories through the events pipeline on the
team's API credit, about $1 (the 50-event trial cost about $1.50, Harry read it from the Usage page).

### 2.8 Open questions (with our suggested answer)

1. **Should hair really grow by itself, so you have to look after it?** *Suggested:* yes, slowly, but never a
   penalty. Untidy only gets a line from someone. Players who don't care can ignore it.
2. **Money, or free?** *Suggested:* money, cheap (about 2% of a week's wage), so it is a choice but never a
   worry. A "big change" costs more.
3. **Should a cut ever do anything real?** *Suggested:* only mood +1 a gap and fans +1 a month before a big
   match. The look is the reward. Nothing on the pitch.

### 2.9 Risks

- **Android lag.** The street is new and Mikey's S20 already lags in the garden. The barber room must be one
  small room under the house's draw budget, measured with `?fps=1` before it goes in.
- **Hair that looks wrong.** Long styles on some head shapes, beards that don't sit on the jaw (Harry, 20 Nov:
  "His beard isn't really on his face"). Every style × head shape gets a contact sheet checked by eye.
- **RUL-3D-010.** Darker-skinned players must get styles of their own hair type, and the list must not offer
  a style that looks wrong on them.
- **Growth steps need more models.** Swapping to the next style of the same type is cheap but not perfect;
  a true "same style, longer" needs more Blender work later.

---

## 3. The Food Hall

### 3.1 What it is

Harry, 19 Nov (RUL-UI-013): **"a training centre where u can actually interact with teammates in like a food
hall, and they naturally go about their day"**. The compound's canteen door already says: *"You'll pick a
plate here, and it will change your next session."*

In one line: **the training compound's canteen, where you pick one plate a day that nudges your next
session, and where team-mates eat at their own tables and you can sit with one.**

### 3.2 What exists in code today

| Piece | Where | State |
|---|---|---|
| The training compound, with a canteen door ("Look in", "coming soon") and a drawn, lit canteen behind the glass | `lib/star/world3d/compoundPlan.ts` (`door-canteen`, `DOOR_SOON`), `compoundPlace.ts` | Built, **test page only** (`/star-world3d-dev?place=compound`): not in the career yet |
| Team-mates on a daily routine on a clock | `lib/star/world3d/routine.ts`, `npc.ts`, `lib/star/life/dayPlan.ts` | Built |
| A protein shake at the gym's water cooler: gym points ×1.2 for the gap | `lib/star/gym/progress.ts` (`takeProtein`, `PROTEIN_BOOST`) | Built |
| The gym's effect on the career | `lib/star/gym/effect.ts` | Built, behind a flag that is **off** |
| The house fridge and coffee: small energy and mood, capped at +3 a day each | `lib/star/life/houseActs.ts` | Built |
| Energy (rest days, match drain, the week's 3 things) | `lib/star/energy.ts`, `lib/star/week.ts` | Built |
| Energy cans in the shop (+65 energy) | `lib/star/shopDefaults.ts` `KIB_CANS_DEFAULT` | Built |
| "Lunch in the food hall" as a social action | `living-world-design-2026-11-20.md` section 3 | Designed, not built |
| The academy kid alone in the food hall (a story) | events book, `fdh-kid-sits-alone` | Designed |
| Seats you can sit in without two people taking one | world kit `SlotBook`, `sit_down` | Built |
| A plate that changes anything | none | **Not built** |

### 3.3 How it fits the career

- **What you do.** On a training day, lunch is from 12:30. Walk to the counter, pick **one plate**, then sit:
  alone, or at a team-mate's table.
- **The plates (one a day, the second plate does nothing):**

| Plate | What it does (all for the NEXT session only) | Cap |
|---|---|---|
| Lean protein (chicken, fish, eggs) | gym points ×1.1 this gap | Counts as the shake: plate + shake together never pass ×1.2 |
| Pasta and rice | **+3 energy** now | Shares the house's +3 a day energy cap |
| Balanced plate | +1 energy and gym ×1.05 | same caps |
| A treat (burger, cake) | **mood +1** | Shares the house's +3 a day mood cap |
| Skip lunch | nothing | No penalty |

- **Sitting with someone.** A short chat at the table is free (a bond nudge, +1 to +3, like the Chat action).
  The **long lunch** (a talk-scene with one real choice, often the start of a story) costs **one of the
  week's 3 things**, as the living-world design says.
- **How often.** At most once a day, on training days: about 2 to 4 times a gap.
- **What it does NOT do.** No weight, no body fat, no diet score over a season (yet). The body already follows
  the gym (`lib/star/gym/body.ts`); adding food to the body is a later idea, not this plan.
- **Club size matters (look only).** Step 3 and National League: a tea urn and sandwiches, two plates. League
  One / Two: a small counter. Championship and up: a proper canteen, all plates. Premier League / Europe: a
  chef. (From the compound research's club sizes, `docs/research/gym-compound-driving-2026-11-27.md`.)

### 3.4 Where it lives

- **3D:** inside the compound, through the canteen door. The canteen already drawn behind the glass becomes
  the room: the counter, long tables, team-mates sat by friend group, the card school in the corner.
- **Phone without 3D:** the Training screen gets a "Lunch" card: a still of the canteen, the plates, and who
  is sitting where. This is the first version (phase F1), so it works before the compound is in the career.
- **The 3D phone:** nothing new; the fitness app can show "Fed: pasta" next to the gym's ring.

### 3.5 Data in the save

| What | Size |
|---|---|
| Today's plate (one letter) and the day it was eaten | about 4 bytes, on the clock's day counters |
| This gap's food lift (none, protein, carbs, balanced) | 1 byte, beside the gym's protein flag |
| Who you sat with today | 0 bytes: a person's memory, already in `career.life` |
| **Total** | **about 5 bytes** |

### 3.6 Tie-ins

- **Gym:** the protein plate and the shake share one ×1.2 ceiling. Gym effects stay behind the gym's own
  flag: while that is off, the plate's gym part changes nothing on the career either.
- **House:** the carbs plate and the treat share the house's daily caps (+3 energy, +3 mood), so food can
  never be farmed and Rest stays the way to recover (Harry's rule for the house things).
- **Clock:** lunch is 12:30 to 14:00; eating takes 20 clock minutes, the long lunch 45.
- **Stories:** team-mate stories (260 planned, "food hall" is their main place), the academy kid, the club
  legends' canteen rituals already written (the new signing sings and the legend marks it; everyone who
  scores dances once in the canteen: `docs/plans/STORY_WORLD_PLAN.md`).
- **Star Pass:** level 30 "The captain's table" stop wins **`senior-table`** (save code `snt`): you sit with
  the senior players from then on, which changes who talks to you at lunch.
- **Garden levels:** none.

### 3.7 Build phases

| Phase | What | Harry sees | Effort |
|---|---|---|---|
| **F1** | The rules (plates, caps, the shared ceilings) and the phone "Lunch" card on the Training screen, behind a flag | Pick pasta, see "+3 energy", try a second plate: "You're full" | 1 to 2 days |
| **F2** | Sit with a team-mate: the free chat and the long lunch (one week thing), 5 first food-hall stories | Sit with your best mate; a story starts | 2 to 3 days |
| **F3** | The 3D canteen inside the compound, on the test page: the counter, tables, team-mates eating on their routine, you walk in and sit | Walk in at 12:30, the room is busy | 4 to 6 days |
| **F4** | When the compound joins the career (compound plan phase 3): the canteen door leads in for real; club-size looks | Step 3 tea urn vs a Premier League canteen | 2 to 3 days |

Total about 9 to 14 days. F3 and F4 wait on the compound itself.

### 3.8 Open questions (with our suggested answer)

1. **Should food do anything real at all?** *Suggested:* yes, small and for the next session only (the table
   above), sharing the house and gym caps, so it is a nice choice, never a chore.
2. **Should a run of treats ever hurt?** *Suggested:* not now. A line from the physio or the gaffer after a
   week of burgers, nothing more. A weight system is a separate, later idea.
3. **Should sitting with a team-mate cost one of the week's 3 things?** *Suggested:* the short chat is free;
   only the long lunch talk costs one.

### 3.9 Risks

- **The compound is not in the career yet.** The 3D room can't go live before it. That is why F1 is a phone
  card on the Training screen.
- **A busy room is heavy.** Eight people eating, sitting and talking is the most expensive thing in any 3D
  area. Phone budget: 4 moving, 8 present (`lib/star/world3d/budget.ts`); seated people still, the rest on
  the far-bodies trick. Measured on an Android at `?fps=1` first.
- **Stacking.** Plate, shake, sleep and energy cans could add up. Every boost has one shared ceiling, and a
  test checks the worst stack.
- **Real food brands.** None: plates are plain words ("pasta", "chicken"), no brands.

---

## 4. Order to build, across all three

1. **S0** (Star Pass printout, ½ day) and **B1 + F1** (the barber's and the plates' rules, about 3 days). Pure
   rules and a printout, no 3D, nothing in the live game.
2. **B2 + B3** (your own hair, then the barber opens on the street): the street is already built, so this is
   the first one Harry can walk into. About 6 to 9 days.
3. **S1 + S2** (story stops on the road, the first two stops), with Mikey. About 3 to 5 days.
4. **F2** (lunch with a team-mate, phone card), then **B4 + B5** (visible growth, the home mirror).
5. **F3 + F4** and **S3**, as the compound and the legend 1v1 land.

All three together: about 28 to 41 working days. Each phase ends on a test page Harry can open on his
phone, with stills, before it touches a career (RUL-UI-002).

## 5. All the open questions in one place

| # | Question | Our suggested answer |
|---|---|---|
| S1 | Re-tune the Star Pass now, or stops first? | Stops first, each with a youngest age; re-tune after the printout, with Mikey |
| S2 | Does a stop replace the card on its level? | No, it sits beside it |
| S3 | A lost stop comes back how often? | Once a season, 3 tries, then it becomes a memory |
| B1 | Should hair grow by itself? | Yes, slowly; untidy only gets a line, never a penalty |
| B2 | Barber: money or free? | Money, cheap: about 2% of a week's wage, 5% for a big change |
| B3 | Should a cut do anything real? | Mood +1 a gap, fans +1 a month before a big match; nothing on the pitch |
| F1 | Should food do anything real? | Yes, small, next session only, sharing the house and gym caps |
| F2 | Should treats ever hurt? | Not now; a line from the physio, no weight system yet |
| F3 | Does lunch with a mate cost a week thing? | Short chat free; the long lunch costs one |
