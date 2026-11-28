# What the gym should do in the career: research and options (27 Nov 2026)

Research only. No game code changed. Asked by Harry: the gym should build up very slowly (extra gains on
top, or a boost for the next match), body shape should follow the stats, more exercises (pull-ups, squats,
push-ups, abs, football-specific), and research on energy, power and pace.

Tags: **[code]** = I read it in the repo (file:line). **[source]** = a web page says it. **[guess]** = my
number, not measured. Read with `docs/research/gym-compound-driving-2026-11-27.md` (the GTA 6 plan).

---

## 0. Short answer

1. Today the gym changes nothing in the career. `GYM_CAREER_EFFECT = "off"` [code: `lib/star/gym/progress.ts:62`].
2. Even with the switch fully on, it is tiny: at most +3 Power and +3 Pace across the whole gym, and about
   6 energy per visit [code: `progress.ts:248-252`, `:243`]. Players would not feel it.
3. My pick is Option C: a slow permanent bonus that needs upkeep, plus a small one-match "warmed up" boost.
   Reasons are in section 4.
4. Body shape should follow the gym's own stat points (the same numbers), so look and stats cannot disagree.
5. Football-only exercises that use a ball must go through the real match engine, not a mini-game of their own
   (the one-engine rule). So keep them out of the first build [code: CLAUDE.md "ONE ENGINE", RUL-ENG-002].

---

## 1. How the career's stats work today (plain English)

### 1a. The six skills

- Six skills: Pace, Power, Technique, Vision, Free kick, Aerial. Each is 0 to 100 [code: `lib/star/types.ts:149-163`].
- A new career starts every skill at 40 [code: `tuning.ts:113-123`, `trainingLevels.ts:27`].
- The star rating counts five of them: Pace 0.20, Power 0.20, Technique 0.26, Vision 0.22, Free kick 0.12.
  Aerial counts for nothing yet [code: `tuning.ts:430-452`, `rating.ts:37-46`].

### 1b. How a skill goes up

- Each skill has 30 training levels. You get up to 3 stars per level (first try 3, second 2, third 1).
  Skill = 40 + stars x 60 / 90. So one star is worth two thirds of a point, and 90 stars take a skill from
  40 to 100 [code: `trainingLevels.ts:1-60`].
- Only new stars count, so a level cannot be farmed [code: `trainingLevels.ts:94-120`].
- Matches no longer give skill points. It is switched off by one line, `MATCHES_GIVE_SKILL = false`
  [code: `careerFlow.ts:1127`].
- You get 2 training sessions a week. They reset after a Saturday match [code: `week.ts:112-135`].
- Each session costs 30 energy [code: `tuning.ts:212-214`].

### 1c. How a skill goes down

- Not trained for 18 weeks: the skill may drop. 12% chance per match once overdue, 1 to 2 points a time,
  never below 20 [code: `tuning.ts:143-167`, `careerFlow.ts:631-655`].
- Age: from 30 Pace, Power and Aerial lose 1 a year; from 34, 3 a year [code: `careerFlow.ts:1754-1766`].
- A trained point lost to decay is won back one per star on the next level you pass [code: `trainingLevels.ts:94-120`].

### 1d. Energy (the "fitness" number)

- Energy is 0 to 100. A full Premier League match costs about 30 (Low), 60 (Medium) or 95 (High)
  [code: `energy.ts:1-20`].
- Every rest day gives back 8. Saturday to Saturday is 6 rest days = 48. Saturday to Wednesday = 3 = 24
  [code: `tuning.ts:247-251`, `energy.ts:121-135`]. Extras: +0.5 a day with a working property, +0.3 or +0.6 with
  a tier 2 or 3 training ground [code: `energy.ts:136-142`].
- The Rest action gives +10 (scaled by happiness). An unused action is worth nothing any more
  [code: `week.ts:42`, `:68-77`, `:97-100`].
- You get 3 actions a week: train, work on a relationship, or rest [code: `week.ts:37`; `tuning.ts:172-175`].
- Below 65 energy a starter becomes a sub. Below 40 you are left out [code: `tuning.ts:192-200`].
- Tired legs: nothing is lost at 85 energy or more. At 50 you lose about 15% of Power and Technique. At 19 about
  35%. At 0, 40% [code: `energy.ts:144-170`]. **Pace is not cut by tiredness.** Only Power and Technique are.
- Low energy also raises injury risk below 30 at the final whistle [code: `tuning.ts:304-307`].

### 1e. What Pace and Power do in a match

- Pace: how fast a player runs in the 3D play. About 4.2 m/s run and 5.6 m/s sprint at Pace 0, up to 6.0 and
  8.2 at Pace 100. So one Pace point is about 0.026 m/s of sprint [code: `three3d/gait.ts:47-56`].
- Pace in the ninety minutes you do not play: it makes a "one on one" chance more likely. The weight is
  1 + 0.45 x (Pace - 50) / 50, so Pace 40 gives 0.91 and Pace 100 gives 1.45. It also makes a "grass in front of
  you" run likelier: 0.7 + 0.6 x Pace/100 [code: `hiddenMatch.ts:454`, `:498-503`, `:1470-1480`].
- Power: how hard a shot is hit and how far it travels. Shot speed grows with skills.power
  [code: `canvasEngine.ts:5125-5129`]. It also leans "long range" chances by up to 45%
  [code: `hiddenMatch.ts:498-505`].
- The match already has a place to add a bonus on top: `effectivePower` adds boots and cans to Power before a
  match. There is no `effectivePace`, and the engine reads Pace raw [code: `app/star-dev/page.tsx:4310`,
  `types.ts:635-650`].

### 1f. The look of your player

- Your 3D body is a one-time choice of three builds: Slim, Strong, Tall. A build only scales the whole man a little:
  across x0.95 / x1.07 / x1.0, front to back x0.95 / x1.06 / x1.0 [code: `style3d/toon/bodies.ts:15-26`].
  There is no body that changes over time yet.

### 1g. What the gym has built so far

- Three stats (Strength, Cardio, Focus), four levels each, 100 points a level, 300 points to the top
  [code: `gym/progress.ts:35-43`].
- One visit per gap between matches. Each of the three machines pays once a gap. A perfect machine is 40 points.
  Closing all three adds up to 10 more. One stat gets at most 50 a gap. So level 1 to 4 takes at least 6 perfect
  gaps [code: `progress.ts:45-49`]. A realistic 0.7 quality game is about 28 + 7 = 35 a gap, so about 9 gaps
  [guess, from the code's numbers].
- Sleeping in your bed x1.2. Protein shake x1.2. Both x1.44 [code: `progress.ts:55-56`].
- A "workout window" of 2 gaps. Outside it, points count half. Miss a window: Strength and Cardio lose 30 points
  each time, at most 3 times at once. Focus never slips [code: `progress.ts:51-58`, `:103-132`].
- Switch on `"energyPowerPace"`: a visit costs one of the week's 3 actions, gives back up to 60% of what Rest gives
  (so 6 energy at most), and each Strength level-up adds +1 Power, each Cardio level-up +1 Pace
  [code: `progress.ts:62-64`, `:238-253`].
- Mini-games: bench (hold to push, let go slowly), treadmill (stay in the green zone), heavy bag (keep the cursor
  in the pink) [code: `gym/games.ts:1-34`].

---

## 2. What other games do

Search note: guides and wikis were easy to find. Real forum and Reddit opinion was thin in the results. Where I
could not find what players said, I say so. I did not play any of these games.

| Game | Permanent or temporary | Caps and decay | Body shape | What players said |
|---|---|---|---|---|
| GTA San Andreas | Permanent muscle and stamina, but muscle falls if fat is zero and you do not eat. Fat rises with food. | Muscle 0 to 100%. A weight rep gives 0.1% to 0.9%, less as you get stronger. Treadmill gives 1% muscle per 14 s. There is a hidden daily limit; go past it and muscle drops [source: gta.wiki, sportskeeda]. | Yes. Muscle and fat change the body. At 50% muscle the walk changes [source: gta.wiki/w/Muscle]. | Fans remember it fondly. The one named complaint I found: the Definitive Edition turned the alternating-button workout into button mashing [source: sportskeeda]. The hidden cap that costs muscle is a known trap. |
| GTA 6 (out 19 Nov 2026) | Strength and Cardio can slip; Focus only rises. A window opens after a session. | 4 levels each. The daily ring closes, more does nothing. Protein cuts recovery by half [source: from the earlier research file]. | Weight follows calories; body changes after sleep. | Pre-launch Reddit mood was excited. I found no post-launch "too grindy" posts. A writer warned realism could become a chore. |
| GTA V | Strength rises by doing (punches). No usable gym. | Not found. | Little. | A gym nobody can use is set dressing. |
| NBA 2K MyCareer | Gym gives +2 Stamina per workout whatever the result. 3 stars on all 4 weekly workouts gives a short Turbo boost and a new body type. All 12 workouts: badge, Stamina 99, permanent Turbo boost [source: nba.2k.com, dexerto, dotesports]. | 4 workouts a week. Body types do not add strength [source: dexerto]. | Body type is the reward, and it is look only. | I found no real forum opinion. TikTok interest in "fastest new body type" was 475k views (earlier file). |
| EA FC 26 player career | Up to 3 drills before a match. Harder drills give bigger boosts. Doing well boosts match XP [source: magicgameworld]. | Not found. | None. | EA forums: drills feel like a chore with little payoff; free kicks and penalties cannot be trained; bugs [source: forums.ea.com threads]. |
| Football Manager | Training raises attributes slowly. Natural Fitness governs how long a player stays at his best. | You pick intensity. Heavier = faster gains and more injury and tiredness. Pre-season is the heavy-work window [source: footballmanager.com, fmscout]. | None. | Guides stress that too much training in-season tires the squad. I found no per-session gain numbers. |
| Fight Night Champion | Camp before a fight: skills by mini-game, athletics in the background. Training costs stamina; train and rest in the right order or you enter the fight tired [source: engadget, gamespot]. | Best gyms cost money. | None. | Reviewers: skill mini-games "hard" to some, "repetitive after a few tries" to others. Single mini-game can be enough. |
| Madden franchise | XP drives progress; regression happens in the off-season and can be slowed, not stopped. Training camp mini-games, each once only. Weekly mini-games only act as a small modifier [source: help.ea.com, ea.com]. | Camp: one mini-game per player. | None. | Not found. |

What I take from this, and the confidence:

1. **Nearly every game gives a small permanent gain, a hard weekly cap, and some way to lose it.** (high: 5 games)
2. **A temporary boost is common as a side reward** (2K Turbo, FC drills, Madden weekly modifier), but it is
   never the main way to grow. (medium)
3. **Body shape is nearly always look only** (2K says so outright). GTA is the exception: its body is the stat.
   The strongest link to stats is GTA's, and it is the one fans still talk about 20 years later. (medium)
4. **Hidden rules are what players resent.** San Andreas's hidden daily limit is the clearest. Ours shows the
   window and the ring on screen, which is the GTA 6 fix. (medium)
5. **Real science backs a slow build:** 2 to 4 weeks off costs elite players little strength or sprint speed;
   after about 4 weeks the loss is real. One study of 24 elite under-20 players saw no drop in 10 m sprint or
   leg press after 26 days off. Repeated-sprint fitness fell even after 2 weeks in another [source: PMC7692758
   and a 2-week semi-pro study from the same search]. So "slip after about 2 missed windows" is fair.

---

## 3. Real football gym work, and 15 phone mini-games

What pros do (sources are from the search; position-specific gym programmes were NOT found, only match demands):

- **Hamstring and groin protection.** Nordic hamstring curls cut hamstring injuries; a 10-week in-season block
  raised eccentric hamstring strength 19% in amateurs. Copenhagen adductor work cut groin injuries; under-19s
  gained 36% hip adduction strength [source: PMC review in the search; Copenhagen RCTs].
- **Sprint work beats leg curls for speed.** In one trial a sprint-acceleration group improved sprint speed;
  a Nordic-only group did not [source: Nordic vs sprint RCT in the search].
- **Mixed programmes (strength + balance + plyometrics) cut non-contact injuries** [source: review in the search].
- **Positions differ in the match.** Full-backs cover the most high-intensity distance; wingers have the most
  accelerations and decelerations; centre-backs have the lowest running output but do more 0 to 90 degree turns;
  goalkeepers cover far less ground and need short, explosive moves [source: match-demand studies in the search].
  The gym should lean the same way (my reasoning).

The list. All are 20 to 40 s, one thumb, no ball. "Stat" is which of the gym's stats it feeds.

| # | Exercise | Real reason | Phone mini-game | Stat |
|---|---|---|---|---|
| 1 | Back squat | Leg strength, base of sprint power | Hold to go down slowly into a green depth band, tap to drive up. 5 reps. Too fast = a wobble strike. | Strength |
| 2 | Bench press (built) | Upper body, contact | As built. | Strength |
| 3 | Pull-ups | Back and grip, shielding the ball | Tap left and right thumbs in turn to climb; chin over the bar clicks; taps must slow as the arms tire. | Strength |
| 4 | Push-ups | Chest, core, shoulders | Tap to a metronome beat; hits inside the window count; 30 s. | Strength |
| 5 | Romanian deadlift or hip thrust | Hamstrings and glutes, the sprint engine | Hold to lift, ease off slowly; keep a back-angle needle in the green. | Strength |
| 6 | Plank and ab roll | Core, stays upright in a tackle | Hold a finger down; a dot wobbles; small slides keep it in the ring. 30 s hold. | Strength (body) |
| 7 | Nordic hamstring curl | Hamstring injury cut | A bar falls forward slowly; hold harder as it drops; let go too early and you collapse. Best score = lowest controlled drop. | Resilience (injury) |
| 8 | Copenhagen plank | Groin injury cut | Two 15 s balances (left, right): keep a side-tilt dot in the zone. | Resilience (injury) |
| 9 | Box jump or jump squat | Explosive power, jumping for headers | Release when a swinging bar is in the gold band; 6 jumps; perfect timing = higher box. | Power |
| 10 | Sled push | Acceleration, first 10 m | Hold to push, tap in rhythm to keep the sled speed in a band; a stamina bar drains. | Pace |
| 11 | Flying 20 m sprint | Top speed | Tap on the start light, then alternate two thumbs in stride rhythm; 3 short runs. | Pace |
| 12 | Agility ladder | Quick feet, change of direction | Tap the lit squares in a pattern that speeds up; mistakes break the chain. | Pace |
| 13 | Single-leg balance and landing | Knee (ACL) protection | Hold to balance a wobble; after a jump, "stick the landing" by tapping at the right moment. | Resilience |
| 14 | Hip and ankle mobility flow | Warm-up, injury cut | Trace a slow shape with the thumb inside a tube. Short; works as the warm-up before a visit. | Resilience |
| 15 | Rondo (5 v 2) | Quick passing under pressure | **Ball work: must run the real engine via EnginePlay, not a mini-game of its own.** Later phase. | Football |

Also built: treadmill and heavy bag (cardio, focus). Boxing, swimming and cycling can be added the same way
if wanted (GTA 6 lists them as Cardio).

Which exercises pay more by position (proposal, [guess] on the size): wingers and full-backs +20% on 10 to 12;
centre-backs +20% on 1, 3, 6; goalkeepers +20% on 9, 13; strikers +20% on 9, 10; midfielders +20% on treadmill and 12.
Position comes from `career.playAs ?? career.player.position` [code: `simMatch.ts:117`].

---

## 4. Three options

### Shared set-up for all three

- **A visit is one of the week's 3 actions** (as GTA's ring and as already coded), so it competes with Rest.
  Rest gives +10 energy; a training session costs 30 energy [code: `week.ts`, `tuning.ts:212`].
- **Resting still matters.** Sleep in your bed and protein (x1.2 each) already feed gym points
  [code: `progress.ts:55-56`].
- **Pace is not hurt by tiredness, Power is.** So a gym that only raises Power can be wasted by a tired player.
  That is a real football truth too: tired legs hit shot strength first [code: `energy.ts:144-170`].
- **Gain shown on the player card** as a separate "Gym +n" line (like boots and cans in `effectivePower`
  [code: `page.tsx:4310`]), so Harry can see it and so it can be turned off in one place.

### Option A: slow permanent extra on top, with a cap

What it does: each gym level adds a bonus on top of the trained skills. It is kept only while you keep up
the gym (the window rules already in the code).

| Item | Number | Basis |
|---|---|---|
| Strength level 1 / 2 / 3 / 4 | Power +0 / +2 / +4 / +6 | [guess] |
| Cardio level 1 / 2 / 3 / 4 | Pace +0 / +2 / +4 / +6 | [guess] |
| Cardio also | Extra energy back each rest day: +0 / +1 / +2 / +3 (base is 8) | [guess] |
| Focus level 1 to 4 | Tired-legs cut shrinks: 40% max cut becomes 40 / 37 / 34 / 31% | [guess] |
| Time to the top | At least 6 perfect gaps, about 9 realistic. A season is 38 league games plus cups, so level 4 in about a quarter of a season | [code] for 6 and 9; the season length is [guess] |
| Cap | +6 Power and +6 Pace is 9 stars each, about 10% of the 60-point training range | [code] for the star maths |
| Decay | 30 points per missed 2-gap window; at most 3 at once. Lose a whole level after 4 missed gaps | [code: `progress.ts:53-54`] |
| What +6 Pace is worth | +0.16 m/s sprint speed. A "one on one" weight at Pace 70 goes 1.18 to 1.23 (+5%) | [code] maths |
| What +6 Power is worth | About one and a half training levels of Power | [code] maths |
| Body | Shoulders and arms grow with Strength level; legs and waist lean with Cardio level (section 5) | proposal |

Good: simple, slow, matches "extra gains on top". Bad: a little invisible per match; nothing special on the day
you visit. Risk: it must not break match balance. +6 on a stat that lives between 40 and 100 is small, but it
changes every match, so run the career soak (`scripts/soak/careerSoak.mts`) before turning it on.

### Option B: temporary boost for the next match

What it does: a visit this gap gives a "warmed up" effect for the next match only. It is gone after the whistle.

| Item | Number | Basis |
|---|---|---|
| Size | Power and Pace +1 to +5 for the next match, by ring quality (all three machines done, average quality) | [guess] |
| Fresh legs | The "full strength above" line moves from 85 to 75 energy for that match | [guess], from `energy.fatigueFreshAbove` [code: `tuning.ts:272`] |
| Starts at | Needs at least 1 machine; all 3 gives the full size | [guess] |
| Lasts | One match. Expires after the next whistle, even if you skipped playing | [guess] |
| Decay | None needed (it expires). There is nothing to lose by missing a week | by design |
| Time to top | Immediate. No progression at all | by design |
| Body | Look only, tied to visit count | proposal |

Good: instant payoff you can feel and film ("I trained, I scored"). Bad: it is a weekly chore with nothing
to show for it (the EA FC complaint: drills feel like a chore with little payoff [source: forums.ea.com]). And
it fights Harry's "very slow build-up" wish.

### Option C: mix (my recommendation)

What it does: Option A's slow bonus, a smaller one-match "warmed up" lift for the day you visit, and an
injury-protection stat so football-specific work has a point.

| Item | Number | Basis |
|---|---|---|
| Permanent layer (from A, smaller) | Strength level 1 to 4: Power +0 / +1 / +3 / +5. Cardio: Pace +0 / +1 / +3 / +5. Cap +5 each | [guess] |
| Cardio and rest | Extra rest-day energy +0 / +0.5 / +1 / +2 per day on top of 8 | [guess] |
| One-match layer (from B, smaller) | Full ring this gap: Power and Pace +2 for the next match only. One machine: +1 | [guess] |
| Fresh legs on the day | Full ring lowers the "full strength above" line from 85 to 80 | [guess] |
| Resilience (new, from exercises 7, 8, 13, 14) | Level 1 to 4 lowers injury chance for the player. -0 / -8 / -15 / -25% of today's rate | [guess]. The real basis: Nordic and Copenhagen work cut injuries in trials (section 3) |
| Focus (heavy bag etc.) | Smaller tired-legs cut: 40% max becomes 40 / 38 / 36 / 34 | [guess] |
| Time to top | About 9 realistic gaps per stat; the 4 stats are separate. Closing the ring needs 3 machines, so all four stats rise together only if variety is played | [code] + [guess] |
| Decay | The window rules as built: 30 points per missed window | [code] |
| Cost | One of 3 weekly actions; no energy cost; rest and sleep make it pay x1.44 | [code] + design |
| Body | From the same points (section 5) | proposal |

Good: slow and earned (Harry's main wish), but a visit still shows up on match day, and there is a real football
reason for the injury-prevention exercises. Bad: three layers to explain. Fix: show them as three lines on the
phone's Fitness app. Number of new things to build: one new stat (Resilience), one new input to the match
(the one-match lift), injury maths hook into `energy.injuryFloor` [code: `tuning.ts:304`].

### How each option sits with Rest and energy (measured from the code)

A normal week, Saturday to Saturday, with Medium energy and a Premier League match:

- Energy in: 6 rest days x 8 = 48 (+0.5 to +1.8 with a property or ground).
- Energy out: about 60 for a full 90 minutes at Medium; 2 training sessions = 60.
- So a player who trains twice and plays a full match each week is already down about 72 a week. He cannot
  keep that up without Rest, and Rest costs an action. The gym is also an action. That is the squeeze that makes
  Option C's "+0.5 to +2 energy a day" matter: +2 x 6 days = +12 a week, which is one fifth of a Rest-and-match
  gap. It is meant to be felt but not to remove the squeeze.

Do not let the gym give energy through its own bar (the current 60% of Rest). That is at most 6 energy
[code: `progress.ts:243`], so it is a rounding error, and it makes the gym a worse Rest.

### Recommendation: Option C

1. It follows Harry's words: "very slow build-up... extra gains on top" is the permanent layer; "temporary boost for
   the next match" is a small second layer.
2. It copies what works in other games: small permanent gains, a weekly cap, upkeep (GTA, 2K), plus a small
   immediate reward (2K Turbo, FC drills).
3. It makes the football-specific work real: Nordic curls, Copenhagen planks and landing drills reduce injuries in
   trials, and injuries are already in the game.
4. It leaves the star rating alone: Power and Pace are 20% each of the rating [code: `tuning.ts:430-437`], and a
   +5 bonus is shown as a separate "Gym" line, not added to the trained skill.
5. It is cheap to turn off: one flag (`GYM_CAREER_EFFECT`) plus one `effectiveX` line each.

If Harry wants it simpler: ship Option A first with Power and Pace only, then add the one-match layer later.

Before turning anything on: run `npx tsx scripts/soak/careerSoak.mts 20` and the finishing tests, because Pace
and Power change every match. All numbers in the tables marked [guess] are starting points to tune in
`tuning.ts`, not measured results.

---

## 5. Body shape: tie it to the stats

Today: three fixed builds, a small scale each [code: `bodies.ts:15-26`].

Proposal:

1. **Use the gym's own points, not visit count.** If looks follow visits but stats follow points, they can
   disagree (a man looks huge but his Power fell). One source of truth avoids that. Harry said "if it's just a
   look it could be based on how much you work out"; the points are exactly how much you work out, with the
   window rules included.
2. **Strength level sets upper body.** Shoulders, chest and arms widen as Strength rises.
3. **Cardio level sets leanness.** Waist and legs get slimmer and defined as Cardio rises. (GTA's fat and
   muscle are the model.)
4. **Size of change:** each level changes across-width by about 1.5% and front-to-back by about 1%, so level 4 is
   about 4.5% wider across the shoulders than level 1 [guess]. That is the same size as the gap between Slim
   (0.95) and Strong (1.07) cut in two, so it is visible but does not break the kit. Test by eye on the real
   body; numbers alone will not say.
5. **Slow to shrink.** The body should lag the stat by one window, so one missed week does not flicker his look.
6. **The build choice stays.** Slim, Strong, Tall is the base; the gym adds on top, within limits.
7. **Show the reward.** 2K and The Sims show that a visible change is the reward people chase [source: 2K
   TikTok interest; Sims guides in the earlier file]. Add a before and after still in the Fitness app.

---

## 6. Open questions for Harry

1. Option C, or start with A? (My pick: C, A first if time is short.)
2. Is Resilience (injury cut) a new fourth gym stat, or should it live inside Strength?
3. OK that a visit costs one of the week's 3 actions (as GTA's ring does), or should it be free?
4. Should position change which exercises pay more (my proposal) or should every player train the same?
5. How big may the body change be: small (4.5% wider at the top) or dramatic (GTA's "final boss" joke)?

## 7. Sources

Code: files named inline with line numbers.
- GTA San Andreas muscle, fat, stamina numbers: https://gta.wiki/w/Muscle ; stats explained: https://gtaintel.com/news/san-andreas-cj-stats-explained ; daily limit: https://www.sportskeeda.com/gta/why-players-lose-muscle-gta-san-andreas ; Definitive Edition button mashing: https://sportskeeda.com/gta/5-ways-gta-san-andreas-de-disappointed-fans
- GTA 6 gym: see `docs/research/gym-compound-driving-2026-11-27.md` section sources; fan mood: https://www.gtabase.com/articles/gta-6/gta-6-brings-back-fan-favorite-gym-mechanics-from-san-andreas
- NBA 2K25 gym and body types: https://nba.2k.com/2k25/courtside-report/myplayer-and-mycareer/ ; https://dexerto.com/nba-2k/nba-2k25-how-to-get-the-workout-warrior-badge-2897699 ; https://dotesports.com/?p=1339929
- EA FC 26 training: https://www.magicgameworld.com/ea-fc-26-how-to-train-in-player-career-mode-training-growth-guide/ ; forum threads: https://forums.ea.com/discussions/fc-26-general-discussion-en/fixing-player-career-mode/13315554 and https://forums.ea.com/discussions/fc-26-feedback-en/ea-sports-fc-26-%E2%80%94-career-mode-no-fkpk-development/12704601
- Football Manager: https://footballmanager.com/node/474 ; https://www.fmscout.com/a-fm-guide-keeping-injuries-under-control.html?pg=9 ; https://www.footballmanagerblog.org/2024/09/football-manager-physical-attributes-guide.html
- Fight Night Champion: https://www.engadget.com/2011-01-12-fight-night-champion-producer-details-stamina-endurance-upgrade.html ; https://www.newgamenetwork.com/article/411/2/fight-night-champion-review
- Madden: https://help.ea.com/en/articles/madden-nfl/progression-regression-franchise-mode/ ; https://ea.com/games/madden-nfl/madden-nfl-24/amp/news/madden-24-franchise-mode
- Football science: https://pmc.ncbi.nlm.nih.gov/articles/PMC11446729 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC9980768 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC7012429 ; Nordic vs sprint: https://research.regionh.dk/da/publications/effects-of-the-nordic-hamstring-exercise-on-sprint-capacity-in-ma/ ; detraining: https://pmc.ncbi.nlm.nih.gov/articles/PMC7692758 ; positions: https://pmc.ncbi.nlm.nih.gov/articles/PMC10955741/ and https://pmc.ncbi.nlm.nih.gov/articles/PMC6409586

Limits: I could not fetch Reddit directly, so "what players hated" is thin. The search tool did not return per-session
gain numbers for FM, FC, Fight Night or Madden. The PMC page numbers above are the ones the search returned;
I did not open each paper, so the 19% and 36% figures are from the search summary.
