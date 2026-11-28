# The unlock flow: what opens when, and a planned order (28 Nov 2026)

For Harry, Mikey and Leo. Plan only. No game code was changed.

Harry, 28 Nov, 11:55: *"the flow of how things unlock needs to be very well thought out and planned."*

**Key point.** Today things unlock by **five different keys** that nobody lines up: story beats, Star Pass level, money, club division and settings that are switched off. So the first 3 matches are crowded (6 new things), seasons 2 and 5 are nearly empty, and a fast riser gets about 8 things in one week when the money jumps.

**Key number.** Most places (garden, street, barber, casino, the 3D shop's garden doors) sit behind **★3,500 to ★5,000 of App Store money**. At National League pay (about ★35 a week) that is **2.5 to 3.5 seasons**. In the Championship (about ★1,600 a week) it is **3 weeks**.

**Key change.** One rule per kind of thing: the **story** brings the basics (first 15 matches), **club size** brings club places, **money** brings things you buy, the **Star Pass** brings looks and moves, **stories** bring special places. Then a pace rule: about **one new thing every 4 matches in season 1**, and **one every 6 to 10 matches** after. Places arrive one at a time, so the game also loads light early (Plan 1).

How sure each number is: **measured** (I ran the game code or read a recorded measure), **read** (in the code), **guessed** (my own reckoning).

---

## Part 1. Everything that unlocks today

### 1a. The first hour: the story (read, `lib/star/story.ts`, `lib/star/unlocks.ts`)

A career started now has `unlocks.story`. Older saves keep their own order.

| When | What opens | Brought by |
|---|---|---|
| Signing day (match 0) | Home, your player, energy, **League**, **Play** | the welcome |
| After match 1 | **Training** (a free training day: Power, then Technique) | "Time to train" |
| Training day done | Half-price first energy can in the club shop | the can deal |
| Star level 2 (and match 1 played) | **Star Pass** ("claim your reward") | pop-up |
| After match 2 | A free can; a **cracked phone**: Messages, Fixtures, Squad, Relations, Settings, League, Social | a team-mate |
| After match 3 | **Shop** (2D shop, 3D shop inside it) | the chairman |
| First goal | **Stats**, **Achievements** | your card |
| First sponsor offer | **Sponsors** | a message |
| Buy the new phone (★150) | **Kickabout**, **Your house** (3D) and the **App Store** | the Shop |

### 1b. The App Store: places bought with money (read, `unlocks.ts` line 468)

| App | Price | What it opens |
|---|---|---|
| Awards | ★1,000 | achievements as an app |
| Store | ★1,500 | daily specials |
| Shop | ★2,000 | shortcut to the shop |
| Sponsors | ★2,500 | shortcut to sponsors |
| **Casino** | ★3,500 | the casino (2D menu and 3D room; not in the phone app build) |
| **Garden** | ★5,000 | the **3D garden**, and through it the **street**, the **barber**, the **3D shop doors**, the **casino doors** and the **training gate** |
| Owner | ★15,000 | buy into clubs (the cheapest club is ★5,000,000) |

### 1c. Style items: star level AND money (read, `unlocks.ts` `styleUnlockStar`; prices from `shopData.ts`, measured with tsx)

| Star level | Items that open (level-1 price) |
|---|---|
| 0 | phone (★25; the shop's own new phone is ★150) |
| 4 | console (★70), headphones (★70), moped (★725), first car (★1,300) |
| 6 | radio (★200), cap (★250), tablet (★275), shades and fitness band (★650), TV (★825), first flat (★4,300) |
| 8 | laptop (★1,000), suit (★1,200), chain (★1,700), print (★2,900), hatchback (★3,200), steel watch (★4,100) |
| 10 | pendant (★8,800), flat 2 (★9,300), penthouse (★21,500), SUV (★42,000), stable (★56,000), sports car (★151,000), classic (★161,000) |
| 15 | watch (★17,000), houses (★186,000 to ★280,000), supercar (★293,000) |
| 30 | estate (★349,000), jet (★1,153,000), island (★1,330,000) |

Each item has 5 levels; levels 3 to 5 cost 4x, 12x and about 19x more (`shopDefaults.ts`). Your **house in 3D** follows the best home you own: starter, flat, penthouse, house, villa, estate (`home3d/homes.ts`).

Today the star lock almost never bites: star level 10 comes at about match 32 (measured, `docs/analysis/star-pass-levels-by-age-2026-11-28.md`). **Money is the real gate.**

### 1d. Money by division (measured with tsx, `economy.ts` `typicalWeeklyIncome`)

| Division | A week's total income | A season (about 40 weeks, guessed) |
|---|---|---|
| National League (and North/South) | ★35 | ★1,400 |
| League Two | ★112 | ★4,500 |
| League One | ★358 | ★14,300 |
| Championship | ★1,613 | ★64,500 |
| Premier League | ★8,870 | ★355,000 |

### 1e. The Star Pass (read, `starPoints.ts`, `rewardCatalogue.ts`)

- A card every 2 levels (`DEFAULT_PASS_LEVELS`): celebrations, tape, run-ups, boots, a car, watches, a penthouse card, a supercar card, a jet card, the Golden Ball. Mikey can move cards on the admin page.
- **Gates**: you cannot pass level 29, 39, 49, 59 until you play 10 league games in League Two, League One, the Championship, the Premier League.
- Levels 90 to 100: ten Legend tasks (4 Golden Balls, 3 Champions Leagues, and so on).
- Median level today (measured, 40 careers): **age 16: 14, 18: 21, 20: 30, 22: 39, 25: 47, 30: 55.**
- The proposed retune F2 (Mikey's call) moves level 10 from age 17 to age 20 and the first card from match 2 to match 20.

### 1f. Club, division and season things (read)

| Thing | Opens when |
|---|---|
| Promotion and relegation | each season, from the world tables |
| Transfers for your player | only in the summer window, end of each season |
| League Cup, FA Cup (from its real round), Lower League Trophy | by division, from season 1 |
| Europe (CL, EL, Conference) | when your club qualifies (top divisions) |
| International call-up | when your rating beats your nation's bar (`international.ts`) |
| Season Awards night, Ballon d'Or night | end of every season |
| Gym | open from the Skills (training) screen once Training is open; its effect on your player is OFF |

### 1g. The stories' unlocks list (read, `docs/plans/STORY_WORLD_PLAN.md` part 1)

43 planned unlocks: 12 places (heritage room, legends lounge, cage pitch, the rec, statue plinth and more), 7 cut scenes, 6 skills, 8 items, 10 game modes. Each is opened by a story ending or a condition. **None is in the game yet**: the stories are switched off (`LIFE_IN_CAREER = false`, `lib/star/life/flag.ts`).

### 1h. Switched off today (read)

| Switch | File | What it would open |
|---|---|---|
| `GARDEN_LEVELS_IN_GAME = false` | `garden3d/levelsFlag.ts` | Garden levels 2 to 5: paddock and your horse, riding field, race track, fast travel. XP from garden drills and casino, at most 250 a week; 3,400 XP in all = at least 14 weeks |
| `DRIVE_IN_GAME = false` | `drive3d/careerFlag.ts` | The drive to training and the **training compound** (today only on `/star-world3d-dev?place=compound`) |
| `LIFE_IN_CAREER = false` | `life/flag.ts` | Stories, and with them the 43 unlocks |
| `INJURIES_ON = false` | `injurySwitch.ts` | Injuries |
| `GYM_CAREER_EFFECT = "off"` | `gym/progress.ts` | The gym making you better |
| `RIDE_CAREER_EFFECT = "off"` | `garden3d/riding.ts` | Riding training you |
| `SPONSOR_NEGOTIATION = false` | `sponsorDeals.ts` | Haggling with sponsors |
| `CASINO_ON_SERVER = false` | `casinoRules.ts` | The casino's server checks |
| `REAL_MOMENTS_DEFAULT = "off"` | `fhr/realMomentToggle.ts` | Real moments in matches |

---

## Part 2. The first 10 seasons today, for a middle player

Who: starts at 16 in the National League. Moves up about every second season (the Star Pass study's middle player reaches the League One gate around age 22 and the Championship gate around 25; measured). Money from 1d, Star Pass from 1e. Places open on the day the App Store money is there (guessed: he saves everything).

| Season (age) | Division (guessed) | Star level (measured median) | What is new | Count |
|---|---|---|---|---|
| **S1** (16 to 17) | National League | 1 → 14 | Training, Star Pass, cracked phone, Shop (+3D shop), Stats, Achievements, Sponsors, new phone, Kickabout, **your house (3D)**, gym card; 7 Star Pass cards; cheap style items | **about 20**, 6 of them in the first 3 matches |
| **S2** (17 to 18) | National League | 14 → 21 | 3 to 4 cards; Awards app; maybe shades | **about 5** |
| **S3** (18 to 19) | League Two | 21 → 27 | 3 cards; **Casino** (★3,500) near the end | **about 5** |
| **S4** (19 to 20) | League Two | 27 → 30 | 1 to 2 cards; **Garden** (★5,000) and with it **street, barber, 3D shop doors, training gate**, all on one day | **about 7, 5 of them on one day** |
| **S5** (20 to 21) | League Two / One | 30 → 35 | 2 to 3 cards; first car; first flat (your house grows) | **about 5** |
| **S6** (21 to 22) | League One | 35 → 39 | 2 cards; gate 39 opens; style items | **about 4** |
| **S7** (22 to 23) | League One | 39 → 41 | 1 card | **about 2 (empty)** |
| **S8** (23 to 24) | Championship | 41 → 44 | 1 to 2 cards; **income x4.5**: Owner app, penthouse, SUV, stable, sports car within weeks | **about 8 in a few weeks** |
| **S9** (24 to 25) | Championship | 44 → 47 | 1 to 2 cards; houses (star 15) | **about 4** |
| **S10** (25 to 26) | Premier League | 47 → 49 | 1 card; **income x5.5**: supercar, villa, estate (star 30 not yet); maybe Europe | **about 6 in a few weeks** |

### Where it is crowded and where it is empty

Simple picture, one mark per new thing (guessed counts from the table):

```
S1  ████████████████████   20   (6 in the first 3 matches)
S2  █████                   5
S3  █████                   5
S4  ███████                 7   (5 on ONE day: the garden and everything behind it)
S5  █████                   5
S6  ████                    4
S7  ██                      2   <- empty
S8  ████████                8   (most in a few weeks: the money jump)
S9  ████                    4
S10 ██████                  6   (most in a few weeks)
```

1. **Crowded: matches 1 to 3.** Six new things in three matches (read: the story order). The story already spreads them, but the Star Pass, phone and shop land together.
2. **Crowded: the garden day.** One ★5,000 buy opens five 3D places at once (garden, street, barber, shop doors, casino doors). It is also the heaviest download in the game: the garden cold open is 17.8 s (measured, handbook).
3. **Crowded: each money jump.** Promotion to the Championship multiplies income by 4.5 (measured). Everything priced for League One opens in a few weeks.
4. **Empty: seasons 2, 6 and 7.** Only Star Pass cards. No new place, system or story.
5. **Empty if F2 goes in.** With Mikey's proposed retune, season 1 would get 1 card (level 3), not 7. Season 1 would lose its main drip.
6. **Uneven by player.** A weak player in the National League never earns ★5,000 in time: the garden stays shut for years (reasoned). A fast riser gets the garden in season 2.

---

## Part 3. A planned flow

### 3a. Five keys, one job each

| Key | What it brings | Why this key |
|---|---|---|
| **Story** (matches 0 to about 15) | The basics, one at a time: training, phone, shop, house, gym, garden | A new player needs a guide, not a price list |
| **Club size** (division, club stature) | Club places: the drive and training compound, the club's heritage rooms, Europe, awards nights, the casino's VIP room | They belong to the club, so a better club shows a better world |
| **Money** | Things you buy: homes (your house grows), cars, the stable and horse, the casino, the Owner app | Buying is the money's point |
| **Star Pass** | Looks and moves: celebrations, run-ups, boots, tape, a few showpiece items | Shows you are getting better, every few matches |
| **Stories** (life arcs) | Special places, items, skills and modes from the 43-entry list | Rare and personal, never on a timer |

Rule: **a place is never behind the Star Pass.** The Star Pass is a reward for playing. A place is a part of the world.

### 3b. The pace rule

- **Season 1:** one new thing about every **4 matches** (about 12 things in about 50 matches).
- **Seasons 2 to 10:** one new thing every **6 to 10 matches** (5 to 8 a season).
- **Never more than one announced per match week.** If money opens three things at once, they are all open, but the pop-ups queue: one per match week (`unlocks.announce` already queues; it just needs a limit).
- **Every season has one "big" new thing**: a place, a system or a story chain.

### 3c. Day one: few and strong

Open: **Home** (your player), **Play** (the match), **League**. Nothing else. This is today's story start; keep it.

Load on day one: the 2D game, the match, the Home player. No 3D place files at all (Plan 1, item C).

### 3d. The proposed timeline

"Load" = what that unlock adds to the download (from Plan 1's measures; guessed where marked).

| When | New thing | Key | Load it adds |
|---|---|---|---|
| Match 0 | Home, Play, League | story | first load only |
| Match 1 | Training (the training day) | story | none (2D drills) |
| Match 2 | Star Pass, first card (keep levels 1 and 2 cheap) | Star Pass | a card's model (under 1 MB) |
| Match 3 | Cracked phone | story | none |
| Match 5 | Shop (2D) | story | small |
| Match 8 | New phone: Kickabout, **your house (3D)** | story + money (★150) | house: cold open 4.7 s, the lightest 3D place (measured) |
| Match 12 | Gym (in training) | story | gym room (not measured) |
| Matches 15 to 45 | Star Pass card every 6 to 8 matches; first sponsor; style items as money allows | Star Pass, money | small each |
| Match 25 | 3D shop (the shop "moves into its new store") | story | about 25 MB of item models, preloaded in the weeks before (Plan 1, item C) |
| **End of season 1** | **Garden** given free (your agent finds you a place with a garden) | story | the biggest: about 6.6 MB (measured 15 Oct), preloaded during the last weeks of the season |
| S2, early | Street (out of the garden gate) | story | street files (not measured) |
| S2, middle | Barber on the street; first haircut | story | barber files (not measured) |
| S2 | Stories switched on: one about every 10 matches | stories | text only (under 10 KB a save, plan's budget) |
| S2 to S3 | Garden levels on: paddock and horse (level 2) | garden XP (playing in the garden) | paddock and stable (in the garden's files) |
| Age 18 and ★3,500 | Casino | money | casino: cold open 7.3 s (measured) |
| First car bought | Drive to training and the training compound | money + club | drive and compound files (not measured) |
| League One | The compound's second pitch and the stand | club size | small |
| S4 to S5 | Riding field, race track (garden levels 3 and 4) | garden XP | in the garden's files |
| Championship | Club heritage room or legends lounge (at the big clubs); Owner app | club size, money | one room each (not built) |
| Each home bought | Your house grows one tier | money | a room preset (small) |
| Premier League / Europe | Europe nights, the team hotel abroad | club size | small |
| From any season | The stories' 43 unlocks, when their story ends | stories | each one small or one place |

### 3e. Why this also loads lighter (Plan 1)

| Season | 3D places a player can reach | Rough 3D download (guessed from Plan 1's numbers) |
|---|---|---|
| S1, first half | House only | under 3 MB |
| S1, second half | House, 3D shop | about 28 MB, fetched in quiet weeks |
| S2 | + garden, street, barber | + about 10 MB |
| S3 to S5 | + casino, drive, compound | + about 8 MB |
| Today, match 0 | Home preloads garden, shop, casino and house for everyone | about 10 MB+ on day one (6.6 MB of it the garden, measured 15 Oct) |

The place list in Plan 1 holds each unlock's rule in its `opens` field. The preloader fetches the **next** unlock in the quiet weeks before it opens. So a player never waits for a place on the day he gets it.

### 3f. What would have to change (not done; named so it can be judged)

1. One unlock file for places and systems, next to Plan 1's place list (`lib/star/places/placeList.ts`), read by the phone's App Store, Home's buttons and the preloader.
2. `lib/star/story.ts`: add the beats for house, gym, 3D shop, garden, street, barber (the beat list already exists: `ORDER`).
3. `lib/star/unlocks.ts` `APP_STORE`: the Garden stops being a ★5,000 app (open question 1).
4. `unlocks.announce`: at most one pop-up per match week.
5. Turn on `GARDEN_LEVELS_IN_GAME`, `LIFE_IN_CAREER` and `DRIVE_IN_GAME` in the order above, each after its own playtest.
6. Old saves: nothing here may lock a thing an old save already has (the rule in `unlocks.ts` today). Old saves keep everything open.

---

## Part 4. Five open questions for Harry and Mikey

| # | Question | Suggested answer | Why |
|---|---|---|---|
| 1 | Should the **garden** stay a ★5,000 App Store buy, or be given by the story at the end of season 1? | **Given by the story at the end of season 1.** | At National League pay it takes 3.5 seasons (measured income). A weak player may never see the game's main 3D hub. And five places open on one day. |
| 2 | Should the **casino** wait until your player is **18**, as well as cost ★3,500? | **Yes, 18 and the money.** | A 16-year-old in a casino reads wrong. Age 18 is season 2 or 3: a gap that needs filling anyway. |
| 3 | If Mikey takes the Star Pass retune F2, should **levels 1 and 2 stay cheap** so the first card comes after about 2 matches, not 20? | **Yes.** Keep levels 1 and 2 at their old cost; take the difference off levels 3 to 29. | Season 1 would otherwise lose its main drip (1 card instead of 7). Mikey's lane: his yes needed. |
| 4 | In which order do the **switched-off systems** come on? | **Garden levels first (S2), then stories (S2), then the drive and compound (first car), injuries last.** | Garden levels are built and tested and fill season 2. Stories fill every season. The drive needs a car to make sense. Injuries take things away, so they come once the player has things. |
| 5 | When money opens many things at once (promotion to the Championship), should the **pop-ups queue**, one per match week? | **Yes.** Everything is open at once; only the announcements wait. | 8 new things in a few weeks (guessed count) is the same "a lot of information" problem Harry's friend hit on 1 Oct. |

## What I did not do

- I did not play the seasons. The 10-season table joins three measured things (Star Pass level by age from 40 careers, income per division, prices) with a guessed promotion pace and a guessed "saves everything" spender.
- I did not open the admin page's live Star Pass layout. Mikey may have moved cards from the built-in `DEFAULT_PASS_LEVELS`.
- Load numbers for the street, barber, gym, drive and compound are not measured.

## Harry's answers and pacing decisions (28 Nov 2026, 12:10)

His words: "unlocking things slower, progress being somewhat limited by current facilities, money matching
better, instead of 5 tiers of every item — 1 for a lot of them, just DIFFERENT items that cost more or less.
Training should be a lot larger, like it should take a LONG time to train — after finishing all the 3 star
training I don't think you should just be max, being a 99 should take years and years. And yeah unlocking
everything at once [is a problem]. I think we could slow the pace down a lot whilst still keeping a lot going
in season 1. This kind of pacing can be really worked on when all features of base game are in."

Decisions:
1. Free unlocks come through the STORY or a RANDOM EVENT (e.g. the garden at the end of season 1), not only by buying.
2. Casino: on PC yes (waits until age 18); on phone the casino isn't fully allowed (store rules) — keep it off on the phone app.
3. Star Pass F2 retune: yes, with levels 1–2 kept cheap (Mikey's lane: needs his yes on the numbers).
4. Switched-off systems come on over time (garden levels, stories, drive + compound, injuries last).
5. Pop-ups after a money jump: queue them, one per match week.
6. Slower unlocking overall; progress partly limited by your current facilities (club/training ground/house).
7. Money must match prices better across divisions.
8. Shop: instead of 5 tiers of every item, mostly ONE of each item, and DIFFERENT items at different prices.
9. Training much larger: finishing all the 3-star training must NOT make you max; reaching 99 should take years and years.
10. Keep plenty happening in season 1 while slowing the overall pace.
WHEN: the full pacing pass is done once all base-game features are in. Until then, new features are built
to these rules (one item, not five tiers; nothing opens everything at once; facilities can gate progress).
