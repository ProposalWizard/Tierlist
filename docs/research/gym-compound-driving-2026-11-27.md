# Gym, training compound, driving and the bigger shop: research and plan (27 Nov 2026)

Research and plan only. No game code changed. Asked by Harry: "training compounds, shops, driving to
training, driving back, also a gym based on the GTA 6 gym". Builds on `docs/research/world-3d-2026-11-20.md`
(driving, barber, training centre, world kit) and `docs/research/revolution-3d-2026-11-20.md` (look and cost).

Tags: **[seen]** = I looked at it (page, data, code). **[measured]** = a number I pulled myself (TikTok views
via Apify, 27 Nov). **[source]** = a web page says it; I did not play the game. **[reasoned]** = our
conclusion. **[rumour]** = pre-launch report, not confirmed.

GTA 6 came out on 19 Nov 2026 [source: release-date coverage below; guides dated 18-25 Nov describe the
real game]. So the gym facts below are from post-launch guides, not leaks. Older pre-launch claims are marked [rumour].

---

## 0. The five findings that matter most

1. **The GTA 6 gym is a "keep it up" loop, not a grind.** Three stats (Strength, Cardio, Focus), four levels
   each. After a session a "workout window" bar opens and drains. Train inside the window to level up. Miss
   it and Strength or Cardio slips. Once you close the daily ring, more training does nothing [source].
   This fits our week-by-week career exactly: one gym visit per gap between matches.
2. **The lift itself is two triggers: hold to lift, let go slowly to lower.** Let go too fast and you hurt
   yourself. Cardio on the heavy bag = keep a cursor in a pink zone [source]. On a phone this becomes
   "press and hold, ease off slowly", one thumb. Cheap to build: no physics, one meter, one clip per lift.
3. **On TikTok the car park beats the gym.** "Footballer drive to training" had the biggest videos by far:
   25.2M, 8.9M and 7.0M views for players arriving at training in their cars; median 604k per video
   [measured]. Footballer gym routines: median 563k. GTA 6 gym clips in week one: up to 233k (a real
   personal trainer correcting Jason's form). So the ARRIVAL at the compound in your car is the moment
   to make beautiful, with a camera shot fans would film.
4. **Pre-season testing is its own hit format.** Liverpool's "Before -> After" pre-season clip: 2.4M. The
   Brentford "1K test" record: 254k. Milner's lactate test: 195k. Pochettino's Gacon test: 149k [measured].
   A pre-season fitness test in the compound (beep test, 1K run) is a ready-made yearly event with a
   score the squad compares.
5. **Our Galaxy S20 problem is real and partly in the code.** A UK S20 (8 cores, 8 GB) opens on Medium,
   the same tier as an iPhone 16 (`lib/star/three3d/quality.ts:171-176`), and its Mali-G77 GPU is read as a
   "high" GPU (`quality.ts:191`) [seen in code]. The garden is 215k triangles [measured 20 Nov]. Any new
   place (compound, road, gym) must ship with a phone budget AND a test on a real Android with `?fps=1`
   first [reasoned].

---

## 1. Game gyms: what they do

### 1a. GTA 6 (out 19 Nov 2026) [source: post-launch guides]

| Part | What it is |
|---|---|
| Where | Gyms across the map, each with different kit; some better than others. Jason's first home (Key Lento) has a back-deck home gym: kettlebells, bench, deadlift, pull-up bar, squats. A heavy bag sits in the shed; you hang it under the house. (Shacknews, 18 Nov) |
| Paying | Most gyms need a membership, bought once at the front desk. Jason and Lucia share it. (Shacknews) A TikTok guide claims 9 gyms, from a free Vice Beach gym to one costing $1,800 [TikTok claim, not checked]. |
| Stats | Strength (pink heart, health), Cardio (green bolt, stamina/sprint), Focus (purple eye, slow-time in fights). 4 levels each. Strength and Cardio can drop if you stop; Focus only goes up. (Superset blog; Playday, 19 Nov) |
| Strength | Deadlift, bench, squat, pull-ups at a gym. |
| Cardio | Running, swimming, cycling, kayaking, treadmill, bike, heavy bag. Not gym-only. |
| Focus | Basketball, fishing, golf, pool, meditation. |
| The lift | Hold both triggers to lift; release slowly to lower; release too fast and you hurt yourself. Listen for the click at the top of a rep. Heavy bag: keep the cursor in the pink zone. (Superset blog; G2A/GamesRadar listings) |
| The loop | A session opens a "workout window" bar that drains. Train in it to level up; miss it and you slip. A daily ring closes after a full session; extra work does nothing until the next window. (Superset blog; Playday) |
| Body | Weight follows calories: surplus = gain, the body changes after sleep. Days of fast food make you overweight (a trophy, "Personal Best"). (Superset blog) |
| Recovery | Protein after a workout cuts recovery by 50%. Tired or hungry = worse workout. Sleep sets up the next window. (Superset; Shacknews) |
| The phone | A Fitness app on Jason's phone: the three stats, a countdown to the next session, hunger, body composition. (Superset; GameSpot headline) |
| Trailer | Trailer 2 (6 May 2025): Jason lifting at an outdoor beach gym in Vice City; an official screenshot shows Lucia at a punching bag. (PC Gamer, Red Bull) |
| What fans did | Week one TikTok: a personal trainer "correcting Jason's form" (233k), "Jason went so hard he looks like the final boss" (212k), "where is the free gym" guides [measured]. |

**[rumour] Pre-launch claims, not confirmed:** a TGG creator preview said "three exercises complete a daily
workout" and stamina drains during each set; a "Dazed deep dive" (via GTABase, 26 Aug) said a grocery
system was cut; NoobFeed (4 Sep) said vending machines in the locker room sell protein shakes and coffee.
The first matches the post-launch "daily ring"; the others I could not confirm.

**Not found anywhere:** gym outfits as a mechanic, other gym-goers reacting to you, social moments at
the gym. Guides do not mention them. Treat as "not a feature" until someone sees it.

### 1b. The others

| Game | Gym / training | Lesson for us |
|---|---|---|
| GTA San Andreas (2004) | Bench 20-145 kg, treadmill with 10 speeds. Each rep: mash a button to fill a power gauge before it drains; on the treadmill keep it full or CJ falls off. Muscle and fat are stats; body shape changes. Gym boss fight teaches a fighting style. [source: gtabase, gta.wiki, progameguides] TikTok nostalgia: "+100,000 aura" gym clip, 2.6M [measured]. | Falling off the treadmill is funny and shareable. Unlock a move (for us: a celebration or a skill) from the gym coach. |
| GTA V (2013) | No usable gym in story. Strength rises by doing (e.g. every 20 punches in GTA Online) [source: sportskeeda]. Muscle Beach weights only via mods [source: gta5-mods]. | A gym nobody can use is set dressing. Ours must be usable. |
| Red Dead Redemption 2 (2018) | No gym. Health, stamina and Dead Eye "cores" drain and refill with food and sleep; eating changes weight (under / over weight changes stats) [reasoned from memory, not re-checked this round]. | The idea of a meter that drains between visits is the same as GTA 6's window. |
| NBA 2K25 MyCareer | Gatorade gym: 4 workouts a week; each gives +2 Stamina whatever the result; 3+ stars on all 4 = a short turbo boost and a new body type. All 12 workouts = a badge, 99 Stamina, all body types. Body types are looks only. [source: 2k.com Courtside Report, dexerto, twinfinite] TikTok: "fastest way to unlock a new body type", 475k [measured]. | A weekly limit (4) and stars per workout. A body type as the reward people chase. |
| EA FC 26 player career | Pick up to 3 drills before a match by skill group; harder drills give bigger boosts; doing well boosts the XP you earn from match actions. [source: magicgameworld, altchar] No walkable training ground. | Our compound can be what FC never had: a place you walk in. |
| Football Manager | Weekly schedules and intensity (Recovery, Balanced, Heavy, Intense) [source: operationsports for FC manager; FM from memory]. No 3D. | Intensity vs injury risk is a real football trade we can borrow. |
| The Sims 4 | Machines are smart objects: treadmill, weight machine, punching bag. Fitness skill levels unlock harder workouts (Heavy Lifting at 4, Epic Workout at 8). Body sliders change fast, so you see results. [source: help.ea.com, sims fandom, carls-sims-4-guide] | Our world kit already uses this idea (`lib/star/world3d/smartObject.ts` has a `gym` kind). Show a body change soon, or it feels like nothing happened. |

---

## 2. TikTok: what people share [measured, Apify, 27 Nov 2026]

One run of the public actor `clockworks/tiktok-scraper`: 8 searches x 10 videos = 80 videos. Cost $0.241.
Medians per search: drive to training 604k · footballer gym routine 563k · pre-season testing 136k ·
NBA 2K gym 86k · day in the life at a training ground 79k · training ground tour 53k · GTA 6 gym 51k
(one week old) · San Andreas gym 22k (but one clip at 2.6M).

Top themes:
1. **Cars at the training ground.** Fans film players arriving. "What are the players driving" is a series.
2. **Athletic gym work, not bodybuilding.** "Train for performance, not size"; plyometrics for speed.
3. **Pre-season tests and before/after.** Numbers and records (the 1K test) make people comment.
4. **The GTA gym as comedy and coaching.** Real coaches rating game form; the huge body joke.
5. **Training ground tours.** The building itself is content (Arsenal tour, 1.2M).
6. **Body type unlocks** (NBA 2K): the visible reward.

Ten example links:

| # | Views | Likes | Date | What | Link |
|---|---|---|---|---|---|
| 1 | 25.2M | 1.8M | 19 Oct 2025 | Man City players arrive at training | https://www.tiktok.com/@mxp_psg/video/7562865472274894082 |
| 2 | 8.9M | 228k | 29 Oct 2025 | PSG players' cars at training | https://www.tiktok.com/@ahmed.ibrahim.eg/video/7566726774294449426 |
| 3 | 2.6M | 157k | 14 Apr 2026 | San Andreas gym "+100,000 aura" | https://www.tiktok.com/@gtasanstore/video/7628605239922363670 |
| 4 | 2.4M | 410k | 15 Jul 2026 | Liverpool pre-season "Before -> After" | https://www.tiktok.com/@liverpoolfc/video/7662699830476557590 |
| 5 | 1.3M | 116k | 12 Sep 2026 | What Everton players drive to training | https://www.tiktok.com/@premierarrivals/video/7684540496454225174 |
| 6 | 1.2M | 164k | 21 May 2026 | Tour of the Arsenal training centre | https://www.tiktok.com/@soheil.var/video/7642493769719254293 |
| 7 | 1.2M | 109k | 16 Aug 2026 | Footballer: strength plus functional gym | https://www.tiktok.com/@hrtraining/video/7674564131399290134 |
| 8 | 579k | 67k | 6 Feb 2026 | "Can I survive a Premier League fitness test?" | https://www.tiktok.com/@bpofooty/video/7603655227169869070 |
| 9 | 475k | 22k | 29 Aug 2025 | NBA 2K26: fastest new body type | https://www.tiktok.com/@kobitv._/video/7544070282835692814 |
| 10 | 233k | 15k | 22 Nov 2026 | Trainer corrects Jason's form in GTA 6 | https://www.tiktok.com/@oscarpfit/video/7711091213092424962 |

Also useful: Brentford 1K test record (254k) https://www.tiktok.com/@statsports/video/7611115892511968534 ·
Isak's day in the life (245k, 25 Nov 2026) https://www.tiktok.com/@liverpoolfc/video/7712069017837505814 ·
Fleetwood's small training ground "Poolfoot" (48k) https://www.tiktok.com/@officialftfc/video/7066081241849826606.

Limits: TikTok search is ranked by TikTok, not by views; 10 per search is a small sample. View counts are
from 27 Nov 2026. Raw data: session scratchpad `world-research/apify/out.json` (not in the repo).

---

## 3. The training compound for Knowitball [reasoned, from sections 1-2 and the 20 Nov plan]

### 3a. The rooms, in walking order

| Room | What you do | Mini-game / engine | Team-mates' routine there |
|---|---|---|---|
| Car park | Your car pulls in (end of the drive). Others arrive in theirs. | Camera shot only (the TikTok moment). Tap a team-mate's car to see it. | Arrive 08:15-09:00 by personality; late arrivals get fined (event). |
| Reception | Sign in; the receptionist has messages (agent, sponsor, fan mail). | Talk card (Sims round menu). | Kit man, receptionist, the manager walking through. |
| Changing room | Your peg and locker; change into training kit; banter. | Cloth clothes swap (exists for houses). Telltale talks for forced moments. | Sit on the bench, phones, music, dressing. |
| Gym | The GTA 6 style session (3b). | Its OWN simple games, not football (allowed: it is not a match). | 2-3 lifting or on bikes; a spotter can be asked. |
| Physio | Treat a knock, ice bath, massage; injury rehab steps. | A short hold-the-breath ice bath timer; nothing with a ball. | Injured players live here; the physio talks injury news. |
| Canteen | Eat: pick a plate (protein, carbs, a treat). Sit with someone. | Plate choice changes the next session's result (GTA's "hungry = worse"). | 12:30 lunch; tables by friend group; the card school. |
| Pitches | Team training, finishing, set pieces, the legend 1v1, the kit man drill. | **Anything with a ball runs the real engine through `EnginePlay`** (one-engine rule; RUL-ENG-002). 3D free play stays in `lib/star/play3d` (RUL-3D-001). | 14:00 session; shooting practice after; a few stay late. |

Smart objects needed (new kinds for `smartObject.ts`): bench press, squat rack, treadmill, bike, sled,
physio table, ice bath, locker/peg, canteen counter, canteen seats, reception desk, car bay. The `gym`
and `car` kinds already exist [seen: `smartObject.ts:18`].

### 3b. The gym, GTA 6 style, made for a phone

- **A session = three lifts or runs, picked from what this gym has.** Closing all three closes the ring.
- **The lift:** press and hold to lift (a meter fills), ease off slowly to lower. Too fast = a "tweak"
  (a tiny injury risk event). A clean rep = a click and a flash. 5 reps per lift. One thumb.
- **Treadmill / bike:** keep a marker inside a moving band by tapping (San Andreas: fall off if you fail;
  it is funny and shareable).
- **Sled push or sprint test:** hold to push, tap in rhythm to sprint (feeds Pace).
- **The window:** after a session a bar on the 3D phone's Fitness app counts down to the next match.
  Train inside it to raise a "Fitness level" (1-4, like GTA). Skip two windows and it slips one.
- **What it changes (needs Harry's call):** Fitness level sets how much energy you get back between
  matches and how fast it drains in a match; the gym can also give small Power and Pace gains. It must
  not let a player max a stat in one evening (GTA's "you cannot max it in one afternoon").
- **Body shape:** a small, visible change on the Style A body (shoulders, arms) at each Fitness level.
  2K's lesson: the visible body is the reward people chase.
- **Food and sleep:** the canteen plate and sleeping at home (sleep already passes time, 21 Nov) feed the next
  session, like GTA's protein and rest.
- **Gyms by size:** the compound gym (free, your club's); a home gym room in big houses; later a public
  "beach gym" in the bigger-shop street for events.

### 3c. Scaled by club size

| Club level | Compound | Real-world example |
|---|---|---|
| Step 3 / National League North-South | A clubhouse and a council 3G pitch; evening sessions; a gravel car park; a tea urn, no canteen; the gym is a corner with dumbbells | Part-time clubs (reasoned) |
| League Two / League One | A small block or portakabins; one grass pitch; a small gym; physio room | Norwich had "49 Portakabins" before its rebuild (trainingground.guru); Fleetwood's Poolfoot tour |
| Championship | Proper building, canteen, 2-3 pitches, small pool | Preston's Euxton move (lep.co.uk) |
| Premier League | Full building: changing room with own lockers, big gym, hydrotherapy pool, chefs, recovery suites | Cobham (Bleacher Report), Carrington (Sky Sports), Newcastle refit (newcastleworld) |
| Elite / Europe | Glass, a players' lodge, many pitches, an indoor pitch | Arsenal and Spurs tours on TikTok |

Phone: one room at a time (the house `roomBuild` pattern) with a door fade. PC: walk between rooms.

### 3d. People and memory

6-10 team-mates on routines from the world kit (`routine.ts`, `npc.ts`), each booking an object slot. At most
4 moving on screen on a phone (`TIER_PROFILES.maxLiveCharacters`: low 2, medium 4). Each keeps a small
memory (who you sat with, who you spotted in the gym, who you fined). Tap one: Sims round menu (chat,
spot me, eat together, race to the car, lend money). Forced moments (a legend walks in, a row in the
canteen): Telltale screen. All writing goes through the de-ai skill, as agreed.

---

## 4. Driving to training and back: the earlier plan still stands, with three updates

Confirmed from 20-21 Nov (`world-3d-2026-11-20.md` section A; Harry's answers in
`docs/plans/2026-10-19/harry-answers-round.md:151-159`):
- Our own simple car on a drawn road line (no physics library). Steer yourself, plus Skip.
- The car you own from the shop; with several cars, tap one at the car park; no car = a taxi with a small fare.
- Calls on the 3D phone while you drive (GTA's habit; Mafia's story-in-the-car).

Updates [reasoned]:
1. **Arrive is the show, the road is the link.** TikTok says the arrival sells. Put the effort in the last
   8 seconds: the gate, the car park, team-mates looking at your car. Keep the road short (20-30 s).
2. **Drive back is different from drive in.** After training: your form, a call from the agent or a
   team-mate, a choice (go home, the casino, the barber, the bigger shop). It is the natural map.
3. **Phone budget for the road:** one road piece repeated (InstancedMesh for lamps, kerbs, trees), fog to
   hide the far end, no shadows except a blob under the car, no other moving cars on Low (2-3 on Medium),
   the car model at about 23k triangles is fine but its wheels must be cut out (the blocker from 20 Nov).
   Target: under the house's 37 draws and 21k triangles plus the car. Test on an Android at `?fps=1`
   before anything else is added.

---

## 5. The bigger shop

- Harry, 20 Nov: "change the shop area to the training compound and then move that shop into a different
  bigger shop which would allow for more random events" (`docs/plans/LIVING_WORLD_IDEAS.md:100`).
- [reasoned] The garden's shop doors become **the compound's gate** for a career's home ground, OR the
  car park where the drive starts. My pick: the garden door leads to **your car** (the drive), and the
  compound is reached by driving. That keeps the garden light (the S20 already lags there).
- The bigger shop becomes **a street you drive to**: a showroom (cars), a boutique (clothes), a jeweller,
  the barber, a public gym. Each is one room on a phone. Events live there: a fan asks for a photo, a
  paparazzo, a rival at the car showroom, a sponsor's launch.
- Reuse: `lib/star/shop3d/` scene and catalogue stay; the shop is split by item kind into rooms.

---

## 6. Phased build plan (estimates, not measured)

Each phase ends on a test page Harry can open, with stills, before it touches a career.

| Phase | What | Days | What Harry sees |
|---|---|---|---|
| 0 | **Android first.** Measure the garden and house on a real mid Android with `?fps=1`; set a per-place budget; decide whether the S20 opens on Low. | 1-2 | A table: fps per place on the S20 vs iPhone, and the fix |
| 1 | **The gym room alone** on `/star-world3d-dev?place=gym`: 3 machines, the hold-and-ease lift, treadmill band, the ring, one team-mate lifting | 4-6 | A playable session on his phone, a 10 s film |
| 2 | **Fitness level + the 3D phone Fitness app** (the window, the countdown, the slip). Pure rules first with a test | 3-4 | The app screen and a season soak showing the level rise and slip |
| 3 | **The compound, phone version**: car park, reception, changing room, gym, canteen, physio, one pitch view; one club size (League One) | 8-12 | Walk room to room; team-mates on routines |
| 4 | **The drive in and out** (road line, the cut-out wheels, Skip, the arrival shot) | 5-7 | The drive and the car park arrival, filmed |
| 5 | **Calls while driving + drive-back choices** | 2-3 | A call and a choice on the way home |
| 6 | **Club sizes** (five compound looks) and the yearly **pre-season test** event | 5-7 | Step 3 vs PL compound stills; the beep test |
| 7 | **The bigger shop street** (showroom, boutique, barber, public gym) | 6-9 | The street and its doors |
| 8 | **Body shape by Fitness level** on Style A | 3-5 | Before/after stills of the same man |

Total about 37-55 days of build. Phases 1-2 can start now; 4 waits on the car wheel cut.

---

## 7. Proposed first step

Phase 0 then Phase 1: put a real mid Android on the garden with `?fps=1`, set the budget, then build the
gym room alone on the world-kit test page. Reason: the gym is self-contained (no ball, so no engine work),
it is the thing Harry asked for by name, and the Android numbers decide how big the compound may be.

## 8. Open questions for Harry

1. What should the gym change: energy only, or also Power and Pace? How fast?
2. Body shape changing with fitness: yes, and how far (lean to big)?
3. Garden shop doors: lead to your car (my pick) or straight into the compound?
4. Gym input from him: he offered GTA 6 notes. The most useful: which lift felt best, and what he
   would cut.

---

## Sources (read 27 Nov 2026 unless dated)

GTA 6 (post-launch guides):
- Shacknews, "How to work out in GTA 6", 18 Nov 2026: https://www.shacknews.com/article/151398/working-out-gta6
- Playday, "GTA 6 Fitness Guide", 19 Nov 2026: https://playday.one/2026/11/19/gta-6-fitness-guide/
- Superset blog, "GTA 6 Workouts: How the Fitness App Works" (no date shown): https://www.supersetapp.com/blog/gta-6-workout-app
- GameSpot, "Want To Start Lifting Effectively? GTA 6 Is A Good Teacher" (403 to fetch; title and search summary only): https://www.gamespot.com/articles/want-to-start-lifting-effectively-gta-6-is-a-good-teacher/
- GamesRadar, "How to workout in GTA 6" (fetch truncated): https://www.gamesradar.com/games/grand-theft-auto/gta-6-workout/
- G2A News fitness guide (503 to fetch): https://www.g2a.com/news/gta-6-news/gta-6-fitness-guide/
- DualShockers, best workout sets (502 to fetch): https://www.dualshockers.com/gta-6-best-workout-the-gym/
GTA 6 (trailer, pre-launch, rumours):
- PC Gamer, "The GTA 6 trailer shows Jason and Lucia working out", May 2025: https://www.pcgamer.com/games/grand-theft-auto/the-gta-6-trailer-shows-jason-and-lucia-working-out-is-rockstar-bringing-back-some-of-san-andreas-rpg-lite-features
- Red Bull, GTA 6 side activities (Lucia punching-bag screenshot): https://www.redbull.com/us-en/gta-6-side-activities
- Game Informer, Trailer 2, 6 May 2025: https://www.gameinformer.com/2025/05/06/rockstar-just-unveiled-the-second-grand-theft-auto-vi-trailer
- GTABase, 26 Aug 2026 [rumour, cites Dazed]: https://www.gtabase.com/articles/gta-6/gta-6-brings-back-fan-favorite-gym-mechanics-from-san-andreas
- NoobFeed, 4 Sep 2026 [rumour]: https://noobfeed.com/news/gta-6-fitness-food-sleep-living-system
- Release date: GamesRadar delay story https://www.gamesradar.com/games/grand-theft-auto/gta-6-delayed-6-more-months-as-rockstar-commits-to-november-2026-and-says-sorry ; VGC https://www.videogameschronicle.com/news/grand-theft-auto-6-has-been-delayed-again-to-the-end-of-2026/
- Rockstar official: https://www.rockstargames.com/VI (launch gallery is script-drawn; no gym image could be read)
Other games:
- San Andreas: https://www.gtabase.com/gta-san-andreas/side-missions/gyms ; https://gta.wiki/w/Gyms ; https://gta.wiki/w/Muscle ; https://progameguides.com/gta/how-to-work-out-in-grand-theft-auto-san-andreas-definitive-edition/
- GTA V strength: https://sportskeeda.com/gta/how-increase-strength-gta-online ; mod: https://www.gta5-mods.com/scripts/gymnasium
- NBA 2K25: https://nba.2k.com/2k25/courtside-report/myplayer-and-mycareer/ ; https://dexerto.com/nba-2k/nba-2k25-how-to-get-the-workout-warrior-badge-2897699 ; https://twinfinite.net/guides/how-to-unlock-gym-rat-badge-in-nba-2k25/
- EA FC 26: https://www.magicgameworld.com/ea-fc-26-how-to-train-in-player-career-mode-training-growth-guide/ ; https://www.altchar.com/game-news/ea-sports-fc-26-all-new-changes-in-player-career-mode-aYswZ3y88Ajo ; https://www.operationsports.com/how-to-build-the-best-training-schedule-in-ea-fc-26
- The Sims 4: https://help.ea.com/en/articles/the-sims/the-sims-4/fitness-skill/ ; https://sims.fandom.com/wiki/Weight_machine ; https://www.carls-sims-4-guide.com/aspirations/bodybuilder.php
Training grounds:
- https://bleacherreport.com/articles/1804225-complete-guide-to-chelseas-cobham-training-complex
- https://www.skysports.com/football/news/11095/13408843/manchester-united-inside-carrington-the-red-devils-new-and-improved-50m-training-base
- https://newcastleworld.com/sport/football/newcastle-united/newcastle-united-release-incredible-training-ground-footage-as-upgrade-nears-completion-4162471
- https://archive.trainingground.guru/articles/inside-norwich-city-training-ground
- https://www.lep.co.uk/sport/football/preston-north-end/preston-north-ends-move-euxton-trip-down-memory-lane-trevor-hemmings-3003393
TikTok: the 13 links in section 2, via Apify actor clockworks/tiktok-scraper (pay per result, $0.003 each + $0.005 start), run 27 Nov 2026, $0.241.

Mood board: a text board with links and a drawn compound plan (session scratchpad
`world-research/moodboard.png`). No game screenshots or TikTok thumbnails were copied: they are copyrighted
and their licences do not allow reuse. Wikimedia Commons (free-licence photos) refused requests (rate limit) this round.
