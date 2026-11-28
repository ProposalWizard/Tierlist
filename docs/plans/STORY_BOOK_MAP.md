# The story book map (28 Nov 2026)

Harry, 28 Nov: *"make sure that across the game at different career stages they can randomly pop up —
make some of them much rarer and some less, and some only unlock based off of other stories."*

The stories are still OFF in the real career (`lib/star/life/flag.ts`). Everything here is measured
by the life soak (`scripts/soak/lifeSoak.mts`), which plays careers by the dice. Nothing here has
been seen on a phone screen.

## 1. The audit: the book as it was (180 stories + the kit man)

Measured: `REACH=0 npx tsx scripts/soak/lifeSoak.mts 200 15`, before any change to the book, with
the soak's new career model (start at 17 to 20, a move about one season in four, injury spells, the
armband, caps, Europe).

### 1a. What was wrong, in numbers

1. **Everything happened in the first seven seasons.** A story beat every 1.6 weeks at 17 to 19,
   every 1.7 weeks up to 26, then every 5.9 weeks at 27 to 30, and **almost nothing from 31**: one
   beat in 493 weeks at 31 to 33, zero new stories. The worst quiet spell at 27 to 30 was 184 weeks.
2. **Too much at the start.** 9.6 new stories a season at 17 to 19 (target: about 4 to 6).
3. **Two big stories at once, all the time.** 57,192 of 138,000 career-weeks (41%) had two or more
   big stories open together.
4. **51 stories started in all 200 careers** (batch 1: no share of careers, no condition). Every
   career met the same 51 stories. Six stories started in fewer than 25 careers (his-boots 15,
   the-highlighter 7, the-first-wage 5, the-scout 16, her-job 24, the-big-screen 24): their only
   window was age 19 or under, and the early-season crush used it up.
5. **The file order decided who went first.** One new story a moment, first come in `index.ts`
   order. The 24 batch-1 stories with no condition at all: the first half of the alphabet started
   at a median season 4.5, the second half at 7 (brothers-trial season 3, unknown-number season 8).
6. **No story asked for a stage.** Only 4 stories needed age 29+ (the-knees, the-last-contract,
   the-young-lad) and none needed a level, an injury spell, a new club, Europe, caps or the
   armband. Lower-league careers and Premier League careers met the same book.
7. **Endings that almost never came:** the-first-wage "the-watch" 1, the-highlighter
   "signed-alone" 2, the-best-man "the-under-twelves" 2, the-chairmans-son "the-truth" 2,
   the-documentary "pulled-it" 2, the-penalty-taker "your-penalties" and "shared" 3 each,
   the-rec "the-gate" 3. Last round two of these failed the soak by luck.
8. **No chains.** No story waited on how another one ended.

### 1b. Per stage (before)

| Age | Career-seasons | A beat every | New stories a season | Big-story beats a season | Longest quiet (median / worst, weeks) |
|---|---|---|---|---|---|
| 17-19 first seasons | 300 | 1.6 wk | 9.6 | 3.83 | 11 / 20 |
| 20-22 breaking through | 600 | 1.7 wk | 8.3 | 4.05 | 12 / 26 |
| 23-26 established | 800 | 1.7 wk | 7.6 | 2.31 | 12 / 28 |
| 27-30 peak | 800 | 5.9 wk | 1.4 | 0.55 | 45 / 184 |
| 31-33 veteran | 450 | 493 wk | 0 | 0.04 | 92 / 138 |
| 34+ last seasons | 50 | 383 wk | 0 | 0.04 | 46 / 46 |

By level the book was flat (a beat every 2.4 to 2.9 weeks at every level), because no story read
the level.

### 1c. Every story (before)

When it could start (its first beat's moment and conditions), its chance per try, its share of
careers, its size, and from the soak: how many of 200 careers it started in, the median age and
season it started, and how often each ending came. "Waits" = its game is not built, so it never
plays.

| # | Story | Batch | Size | Can start when (first beat) | Chance | Careers | Started in (of 200) | Median start: age / season | Endings reached (count) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | his-boots | 2 | small | arrive:training: age<=19 ; squad.any(veteran) | 0.22 | 0.18 | 15 | 18 / 1 | the-envelope 10 · cleaned-my-own 5 |
| 2 | the-highlighter | 2 | small | home:evening: age<=19 | 0.22 | 0.18 | 7 | 19 / 2 | his-copy 5 · signed-alone 2 |
| 3 | the-first-wage | 2 | small | home:evening: age<=19 | 0.22 | 0.18 | 5 | 18 / 2 | the-boiler 4 · the-watch 1 |
| 4 | the-scout | 2 | small | arrive:training/home:evening: age<=19 | 0.22 | 0.18 | 16 | 18 / 1 | played-my-game 11 · showed-off 5 |
| 5 | after-the-casino | 2 | small | leave:casino: any time | 0.22 | 0.18 | 45 | 27 / 10 | paid-back 17 · the-meeting 28 |
| 6 | bar-for-breakfast | 1 | small | arrive:training: !injured | 0.3 | all | 200 | 19 / 1 | breakfast-club 74 · never-paid 126 |
| 7 | brothers-trial | 1 | big | home:evening: any time | 0.2 | all | 200 | 21 / 3 | his-own-man 32 · in-your-shadow 134 · brothers 34 |
| 8 | chairmans-dinner | 1 | medium | arrive:training: clubApps>=5 | 0.25 | all | 200 | 20 / 2 | the-club-was-sold 49 · you-told-the-truth 151 |
| 9 | dads-last-shift | 2 | small | home:evening: any time | 0.22 | 0.18 | 33 | 21 / 4 | the-gate 8 · the-video 25 |
| 10 | dads-notes | 1 | small | after-match: lastRating<7 | 0.3 | all | 200 | 19 / 1 | he-said-it 109 · the-calls-stopped 43 · the-notebooks 48 |
| 11 | deadline-day | 2 | small | home:evening: clubApps>=10 | 0.22 | 0.18 | 37 | 21 / 4 | the-other-one 28 · stayed-put 9 |
| 12 | derby-week | 3 | big | arrive:training: clubApps>=6 | 0.22 | 0.3 | 66 | 20 / 2 | derby-day 14 · the-wind-up 26 · shook-on-it 26 |
| 13 | dont-post-me | 1 | small | home:evening: any time | 0.3 | all | 200 | 21 / 3 | she-asked-you-to 63 · still-in-the-photos 67 · ran-with-her 70 |
| 14 | free-kick-duty | 1 | small | arrive:training: squad.any(veteran) | 0.3 | all | 200 | 19 / 1 | your-free-kicks 27 · his-free-kicks 173 |
| 15 | head-tennis | 2 | small | arrive:training: any time (waits for the head-tennis game: never plays) | 0.22 | 0.18 | waits | - | - |
| 16 | her-birthday | 1 | small | home:evening: hasPartner | 0.3 | all | 100 | 21 / 3 | never-again 47 · the-same-again 21 · the-wall 32 |
| 17 | her-job | 2 | medium | home:evening: hasPartner | 0.22 | 0.2 | 24 | 22 / 4 | four-hours 5 · she-stayed 8 · the-motorway 11 |
| 18 | her-shop | 2 | medium | home:evening: any time | 0.22 | 0.2 | 48 | 22 / 5 | still-open 18 · the-sign 30 |
| 19 | her-sisters-wedding | 1 | medium | home:evening: hasPartner | 0.25 | all | 100 | 21 / 4 | she-remembers-you-came 37 · the-empty-seat 63 |
| 20 | her-song | 2 | small | arrive:training: any time | 0.22 | 0.18 | 42 | 20 / 2 | her-song 20 · the-kit-room 22 |
| 21 | his-last-season | 3 | big | arrive:training: squad.any(veteran) | 0.22 | 0.3 | 67 | 20 / 2 | his-last-penalty 24 · kept-his-secret 27 · the-leak 16 |
| 22 | his-mates-tickets | 2 | small | home:evening: any time | 0.22 | 0.18 | 41 | 21 / 4 | the-ban 17 · just-him 24 |
| 23 | his-old-club | 1 | small | arrive:training: any time | 0.3 | all | 200 | 19 / 2 | respect-in-the-away-end 100 · the-knee-slide 68 · a-share-in-it 32 |
| 24 | keep-ups | 1 | small | arrive:training: fans>=0 (waits for the two-touch game: never plays) | 0.3 | all | waits | - | - |
| 25 | kid-in-digs | 1 | big | arrive:training: squad.any(age<=19) | 0.2 | all | 200 | 20 / 2 | passed-on 38 · never-looked-back 93 · the-one-that-got-away 69 |
| 26 | left-back | 1 | small | arrive:training: !injured | 0.3 | all | 200 | 20 / 2 | the-utility-man 135 · strikers-only 47 · left-back-for-life 18 |
| 27 | legends-boots | 1 | big | arrive:training: clubApps>=10 (waits for the duel-1v1 game: never plays) | 0.2 | all | waits | - | - |
| 28 | next-door | 1 | medium | home:evening: any time | 0.25 | all | 200 | 22 / 5 | biggest-fan 105 · the-source 95 |
| 29 | number-nine | 1 | big | arrive:training: squad.any(samePosition) | 0.2 | all | 200 | 21 / 3 | brothers-in-arms 74 · the-feud 63 · quiet-ending 59 |
| 30 | on-commentary | 1 | small | after-match: lastRating<6.8 | 0.3 | all | 200 | 20 / 2 | he-changed-his-tune 61 · still-not-good-enough 83 · his-last-commentary 56 |
| 31 | pe-teacher | 1 | small | home:evening: clubApps>=1 | 0.3 | all | 200 | 22 / 4 | old-school-pride 80 · still-sore 93 · sirs-scrapbook 27 |
| 32 | play-through-it | 1 | medium | arrive:training: !injured | 0.25 | all | 200 | 20 / 2 | she-had-your-back 97 · you-left-her-to-it 103 |
| 33 | players-player | 2 | small | season-end: any time | 0.22 | 0.18 | 35 | 28 / 11 | his-award 20 · my-award 12 |
| 34 | released | 1 | small | arrive:training: squad.any(age<=19) | 0.3 | all | 200 | 20 / 2 | he-found-his-way 147 · one-more-kid 53 |
| 35 | roommates-phone | 1 | medium | home:evening: any time | 0.25 | all | 200 | 23 / 5 | he-got-clean 44 · the-ban 156 |
| 36 | she-grows-up | 2 | big | after-match: any time | 0.22 | 0.3 | 64 | 19 / 1 | her-shirt 17 · she-stopped 30 · the-ticket 17 |
| 37 | ten-minutes | 1 | big | arrive:training: squad.any(veteran) ; clubApps>=5 (waits for the penalties game: never plays) | 0.2 | all | waits | - | - |
| 38 | the-advert | 2 | small | arrive:training: fame>=10 | 0.22 | 0.18 | 39 | 21 / 3 | the-line 29 · the-hands 10 |
| 39 | the-agents-party | 3 | small | home:evening: any time | 0.22 | 0.2 | 38 | 22 / 5 | the-speech 9 · the-fountain 29 |
| 40 | the-alibi | 1 | small | arrive:training: any time | 0.3 | all | 200 | 21 / 3 | kept-out-of-it 88 · the-lie 83 · his-dad 29 |
| 41 | the-ankle | 2 | small | arrive:training: !injured | 0.22 | 0.18 | 36 | 21 / 4 | told-her 16 · the-same-ankle 20 |
| 42 | the-armband | 2 | medium | arrive:training: squad.any(veteran) ; clubApps>=6 | 0.22 | 0.2 | 46 | 21 / 3 | the-armband 7 · one-game 39 |
| 43 | the-assembly | 1 | medium | arrive:training: any time | 0.25 | all | 200 | 21 / 4 | the-grandson 48 · he-was-lying 152 |
| 44 | the-bad-car | 2 | small | arrive:training: any time | 0.22 | 0.18 | 41 | 21 / 4 | the-shine 24 · said-no 17 |
| 45 | the-ball-girl | 3 | small | after-match: any time | 0.22 | 0.2 | 35 | 18 / 1 | quick-hands 27 · just-a-throw 8 |
| 46 | the-balls-in-the-car | 1 | small | arrive:training: any time | 0.3 | all | 200 | 21 / 3 | got-you-back 29 · the-tip-off 98 · last-laugh 73 |
| 47 | the-best-man | 3 | medium | home:evening: any time | 0.22 | 0.2 | 39 | 23 / 5 | the-speech 15 · the-under-twelves 2 · not-the-best-man 22 |
| 48 | the-big-screen | 2 | small | arrive:training: hasPartner | 0.22 | 0.18 | 24 | 21 / 4 | the-screen 13 · just-a-text 11 |
| 49 | the-bins | 2 | small | home:evening: any time | 0.22 | 0.18 | 43 | 23 / 6 | the-favour 21 · locked 22 |
| 50 | the-birthday-card | 2 | small | arrive:training: any time | 0.22 | 0.18 | 39 | 22 / 4 | his-birthday 26 · nobody-knew 13 |
| 51 | the-boots-auction | 3 | small | home:evening: any time | 0.22 | 0.2 | 40 | 23 / 6 | dads-boots 12 · the-other-bidder 28 |
| 52 | the-boots-for-a-kid | 3 | small | arrive:training: any time | 0.22 | 0.2 | 32 | 22 / 4 | her-boots 19 · the-advert-kid 13 |
| 53 | the-cafe | 2 | big | home:evening: any time | 0.22 | 0.3 | 63 | 23 / 6 | the-sandwich 29 · the-shutter 7 · just-a-customer 27 |
| 54 | the-call-up | 3 | big | home:evening: fame>=15 ; clubApps>=10 | 0.22 | 0.3 | 64 | 24 / 7 | a-shirt-for-mum 14 · his-shirt 25 · back-in 25 |
| 55 | the-car-park | 1 | small | after-match: lastLost | 0.3 | all | 200 | 20 / 2 | the-good-clip 41 · the-bad-clip 126 · the-season-ticket 33 |
| 56 | the-caretaker | 2 | medium | arrive:training: any time | 0.22 | 0.2 | 30 | 22 / 4 | backed-him 9 · two-games 21 |
| 57 | the-chairmans-car | 2 | small | arrive:training: clubApps>=5 | 0.22 | 0.18 | 38 | 22 / 4 | owned-up 23 · the-scratch 15 |
| 58 | the-chairmans-son | 2 | medium | arrive:training: clubApps>=10 | 0.22 | 0.2 | 38 | 22 / 4 | the-truth 2 · the-favour 36 |
| 59 | the-charity-match | 1 | medium | home:evening: any time (waits for the testimonial-match game: never plays) | 0.25 | all | waits | - | - |
| 60 | the-charity-ref | 3 | small | home:evening/arrive:training: any time | 0.22 | 0.2 | 39 | 21 / 4 | the-red 17 · the-whistle 22 |
| 61 | the-checkout | 3 | small | home:evening: any time | 0.22 | 0.2 | 41 | 24 / 6 | her-notes 31 · self-service 10 |
| 62 | the-chip-shop-special | 3 | small | arrive:training/home:evening: any time | 0.22 | 0.2 | 39 | 21 / 4 | on-the-board 24 · off-the-board 15 |
| 63 | the-christening | 2 | small | arrive:training: any time | 0.22 | 0.18 | 29 | 23 / 5 | her-godfather 16 · the-card 13 |
| 64 | the-christmas-lights | 1 | small | arrive:training: week>=10 | 0.3 | all | 200 | 22 / 4 | the-lights-man 57 · the-weather-man 46 · her-button 97 |
| 65 | the-coach-leaves | 1 | medium | arrive:training: any time | 0.25 | all | 200 | 23 / 5 | his-first-signing 45 · he-went-without-you 155 |
| 66 | the-coach-retires | 3 | medium | arrive:training: any time | 0.22 | 0.2 | 33 | 23 / 5 | his-drill 12 · the-last-session 14 · the-speech 7 |
| 67 | the-coin | 3 | small | after-match/arrive:training: any time | 0.22 | 0.2 | 39 | 19 / 1 | the-letter-back 11 · the-ban 28 |
| 68 | the-column | 2 | small | home:evening: fame>=15 | 0.22 | 0.18 | 37 | 23 / 6 | your-words 22 · his-words 15 |
| 69 | the-crumble | 1 | small | arrive:training: clubApps>=2 | 0.3 | all | 200 | 22 / 5 | crumble-saved 69 · crumble-gone 55 · her-recipe 76 |
| 70 | the-cup-final-boot | 2 | small | arrive:training: any time | 0.22 | 0.18 | 43 | 22 / 5 | on-the-shelf 19 · half-true 24 |
| 71 | the-curfew | 3 | small | home:evening: any time | 0.22 | 0.2 | 38 | 24 / 6 | covered 28 · the-knock 10 |
| 72 | the-dark-week | 3 | big | arrive:training: any time | 0.22 | 0.3 | 58 | 23 / 5 | sunday-walks 8 · he-spoke-up 24 · someone-else-knocked 26 |
| 73 | the-delay | 3 | small | home:evening: any time | 0.22 | 0.2 | 42 | 24 / 7 | gate-fourteen 38 · the-lounge 4 |
| 74 | the-documentary | 2 | big | home:evening: fame>=20 | 0.22 | 0.3 | 53 | 24 / 7 | the-good-one 15 · the-row 23 · pulled-it 2 · said-no 13 |
| 75 | the-driving-lessons | 3 | small | home:evening: any time | 0.22 | 0.2 | 40 | 23 / 6 | he-drives-you 13 · the-instructor 27 |
| 76 | the-envelope | 3 | small | driving/home:evening: any time | 0.22 | 0.2 | 43 | 22 / 4 | handed-it-back 27 · the-envelope 16 |
| 77 | the-ex | 3 | small | arrive:training: any time | 0.22 | 0.2 | 41 | 23 / 5 | the-invitation 28 · the-other-end 13 |
| 78 | the-fake-you | 3 | small | home:evening: any time | 0.22 | 0.2 | 40 | 24 / 7 | paid-him-back 17 · the-account 23 |
| 79 | the-fans-forum | 3 | small | home:evening: any time | 0.22 | 0.2 | 45 | 24 / 7 | the-answer 19 · the-line 26 |
| 80 | the-fines-book | 2 | small | arrive:training: squad.any(veteran) | 0.22 | 0.18 | 32 | 23 / 5 | the-book 13 · not-the-book 19 |
| 81 | the-fire-alarm | 2 | small | home:evening: any time | 0.22 | 0.18 | 30 | 24 / 7 | took-the-blame 9 · he-owned-up 21 |
| 82 | the-food-bank | 3 | medium | home:evening: any time | 0.22 | 0.2 | 38 | 23 / 6 | tuesday-mornings 20 · the-photo-op 14 · the-cheque 4 |
| 83 | the-gaffers-word | 3 | medium | arrive:training: clubApps>=5 | 0.22 | 0.2 | 35 | 23 / 5 | his-word 10 · you-backed-him 21 · the-truth-in-print 4 |
| 84 | the-golf-day | 3 | small | home:evening/arrive:training: any time | 0.22 | 0.2 | 38 | 22 / 5 | the-worst-pair 7 · a-good-day-out 31 |
| 85 | the-grass | 1 | medium | arrive:training: any time | 0.25 | all | 200 | 23 / 5 | real-grass 98 · plastic 102 |
| 86 | the-groundsmans-dog | 2 | small | arrive:training: any time | 0.22 | 0.18 | 37 | 24 / 6 | her-ball 11 · just-a-dog 26 |
| 87 | the-groundsmans-goal | 1 | small | arrive:training: !injured | 0.3 | all | 200 | 23 / 6 | the-wellies 101 · he-retired-from-goal 99 |
| 88 | the-group-chat | 2 | small | arrive:training: any time | 0.22 | 0.18 | 40 | 24 / 6 | never-knew 4 · it-was-him 36 |
| 89 | the-gym-board | 2 | small | arrive:training: !injured (waits for the gym game: never plays) | 0.22 | 0.18 | waits | - | - |
| 90 | the-haircut | 1 | small | arrive:training: any time | 0.3 | all | 200 | 24 / 6 | the-twins 96 · his-own-look 23 · passed-on 81 |
| 91 | the-hairdryer | 3 | small | after-match: lastLost | 0.22 | 0.2 | 45 | 20 / 2 | spoke-up 29 · the-tea-stain 16 |
| 92 | the-hard-shoulder | 2 | small | home:evening: any time | 0.22 | 0.18 | 26 | 24 / 7 | the-minibus 8 · the-hard-shoulder 18 |
| 93 | the-head-shave | 1 | small | arrive:training: any time | 0.3 | all | 200 | 23 / 6 | for-his-nan 26 · kept-your-hair 124 · the-bench 50 |
| 94 | the-heckler | 2 | small | after-match: lastLost or lastRating<6.5 ; !mem(fan,'passed-away') | 0.22 | 0.18 | 28 | 19 / 1 | row-f 24 · the-steward 4 |
| 95 | the-hill | 2 | small | arrive:training: week<=6 | 0.22 | 0.18 | 38 | 27 / 9 | off-the-bottom 15 · the-bottom 23 |
| 96 | the-ice-bath | 1 | small | arrive:training: any time | 0.3 | all | 200 | 23 / 6 | ice-king 42 · frozen-out 124 · last-in-the-ice 34 |
| 97 | the-investment | 2 | medium | home:evening: moneyWeeks>=6 | 0.22 | 0.2 | 31 | 24 / 6 | the-car-park 7 · kept-it 10 · got-out 14 |
| 98 | the-karting | 2 | small | arrive:training: any time (waits for the karting game: never plays) | 0.22 | 0.18 | waits | - | - |
| 99 | the-kit-row | 3 | medium | arrive:training: squad.any(veteran) | 0.22 | 0.2 | 37 | 24 / 7 | the-food-bank-shirt 10 · the-loan-shirt 17 · the-zip 10 |
| 100 | the-knees | 2 | small | arrive:training: age>=29 | 0.22 | 0.18 | 35 | 29 / 12 | the-sheet 12 · sideways 23 |
| 101 | the-lantern | 1 | medium | after-match: lastLost | 0.25 | all | 200 | 20 / 2 | a-friend-in-print 116 · burned 84 |
| 102 | the-last-contract | 2 | medium | arrive:training: age>=29 | 0.22 | 0.2 | 49 | 29 / 12 | the-tuesdays 10 · one-more 39 |
| 103 | the-last-year | 3 | medium | home:evening: age>=22 ; clubApps>=15 | 0.22 | 0.2 | 46 | 25 / 7 | said-it-out-loud 20 · kept-them-guessing 14 · the-agents-game 12 |
| 104 | the-letter-from-inside | 3 | small | home:evening: any time | 0.22 | 0.2 | 47 | 24 / 7 | the-car-wash 24 · no-reply 23 |
| 105 | the-lift | 1 | small | arrive:training: owns:car ; squad.any(age<=19) (waits for the drive game: never plays) | 0.3 | all | waits | - | - |
| 106 | the-loan-abroad | 3 | medium | home:evening: age<=25 ; clubApps>=3 | 0.22 | 0.2 | 27 | 23 / 6 | stayed-home 11 · the-gaffer-kept-you 12 · the-sunshine-lad 4 |
| 107 | the-loan-lad | 2 | small | arrive:training: squad.any(age<=20) | 0.22 | 0.18 | 39 | 24 / 7 | came-back 18 · just-back 21 |
| 108 | the-long-read | 1 | small | home:evening/arrive:training: fame>=5 | 0.3 | all | 200 | 23 / 6 | the-piece 70 · the-stock-answers 97 · dads-own-words 33 |
| 109 | the-long-way-back | 2 | big | after-match: any time | 0.22 | 0.3 | 59 | 19 / 1 | back 20 · back-angry 22 · never-quite 17 |
| 110 | the-lost-medal | 3 | small | arrive:training: any time | 0.22 | 0.2 | 36 | 25 / 7 | in-the-mower 16 · still-out-there 20 |
| 111 | the-lucky-scarf | 1 | small | after-match: lastLost or lastRating<6.5 | 0.3 | all | 200 | 19 / 1 | the-empty-seat-by-the-tunnel 75 · just-a-scarf 45 · the-boy-has-it 80 |
| 112 | the-mascot | 2 | small | walkout: any time | 0.22 | 0.18 | 35 | 19 / 1 | the-badger 23 · a-new-badger 12 |
| 113 | the-match-ball | 3 | small | after-match: lastGoals>=1 | 0.22 | 0.2 | 33 | 20 / 2 | the-ball 22 · his-shed 11 |
| 114 | the-neighbours-lad | 3 | small | home:evening: any time | 0.22 | 0.2 | 38 | 25 / 7 | the-trial 18 · the-fence 20 |
| 115 | the-nemesis | 2 | big | after-match: any time | 0.22 | 0.3 | 59 | 19 / 1 | even 29 · his 19 · yours 11 |
| 116 | the-new-boots | 1 | medium | arrive:training: any time | 0.25 | all | 200 | 25 / 7 | the-face-of-the-boot 82 · dropped-by-the-brand 118 |
| 117 | the-new-menu | 2 | small | arrive:training: any time | 0.22 | 0.18 | 35 | 24 / 7 | fridays 18 · the-quinoa 17 |
| 118 | the-new-signing | 2 | medium | arrive:training: any time | 0.22 | 0.2 | 42 | 24 / 7 | room-mates 28 · same-as-ever 14 |
| 119 | the-night-out | 1 | small | arrive:training: fame>=0 | 0.3 | all | 200 | 24 / 7 | trusted 78 · on-a-short-lead 107 · the-talk 15 |
| 120 | the-number | 3 | small | arrive:training: any time | 0.22 | 0.2 | 48 | 25 / 7 | gave-it-up 28 · kept-it 20 |
| 121 | the-other-agent | 2 | medium | after-match: fame>=15 | 0.22 | 0.2 | 40 | 20 / 2 | stuck-with-him 28 · signed-the-other 12 |
| 122 | the-own-goal | 3 | small | after-match: lastLost | 0.22 | 0.2 | 44 | 22 / 4 | the-letter 30 · the-end 14 |
| 123 | the-parking-space | 3 | small | arrive:training: squad.any(veteran) | 0.22 | 0.2 | 41 | 24 / 7 | his-space 20 · the-far-end 21 |
| 124 | the-passport | 3 | small | arrive:training: any time | 0.22 | 0.2 | 47 | 25 / 7 | stayed-behind 18 · boarded 29 |
| 125 | the-penalty-taker | 3 | medium | after-match: any time | 0.22 | 0.2 | 41 | 19 / 1 | your-penalties 3 · his-penalties 35 · shared 3 |
| 126 | the-petrol-station | 1 | small | home:evening: any time | 0.3 | all | 200 | 24 / 6 | the-sweets-story 59 · no-comment-man 108 · his-last-piece 33 |
| 127 | the-phone-in | 2 | small | home:evening: any time | 0.22 | 0.18 | 32 | 25 / 7 | dave-from-the-east-stand 22 · hung-up 10 |
| 128 | the-photo | 2 | medium | home:evening: any time | 0.22 | 0.2 | 35 | 25 / 7 | the-birthday 30 · the-shirt 5 |
| 129 | the-pie | 3 | small | arrive:training: clubApps>=2 | 0.22 | 0.2 | 42 | 25 / 8 | the-pie-man 26 · no-pie 16 |
| 130 | the-pile-on | 3 | medium | after-match: lastLost | 0.22 | 0.2 | 44 | 22 / 4 | the-next-one 17 · off-the-post 12 · phone-off 15 |
| 131 | the-podcast | 2 | small | home:evening: any time | 0.22 | 0.18 | 39 | 25 / 7 | on-the-pod 18 · a-listener 21 |
| 132 | the-quiet-lad | 1 | small | arrive:training/home:evening: squad.any(veteran) | 0.3 | all | 200 | 24 / 6 | the-lad-came-good 92 · still-a-stranger 89 · passed-it-on 19 |
| 133 | the-quiz-night | 3 | small | home:evening: any time | 0.22 | 0.2 | 48 | 25 / 7 | the-trophy 34 · the-cheats 14 |
| 134 | the-race | 1 | small | arrive:training: !injured (waits for the pace-sprint game: never plays) | 0.3 | all | waits | - | - |
| 135 | the-reality-show | 1 | small | home:evening: fame>=10 | 0.3 | all | 200 | 25 / 8 | the-villa 108 · kept-it-football 85 · the-good-summer 7 |
| 136 | the-rec | 3 | medium | home:evening: any time | 0.22 | 0.2 | 41 | 25 / 8 | the-rec-saved 20 · flats-on-the-rec 18 · the-gate 3 |
| 137 | the-red-card | 1 | small | arrive:training: any time | 0.3 | all | 200 | 25 / 7 | he-stayed-on 62 · he-went-again 47 · his-turn 91 |
| 138 | the-ref-remembers | 2 | small | walkout: any time | 0.22 | 0.18 | 28 | 19 / 1 | shook-hands 13 · arms-folded 15 |
| 139 | the-referee | 1 | medium | after-match: lastLost | 0.25 | all | 200 | 20 / 3 | a-fair-hearing 45 · marked-man 155 |
| 140 | the-referees-son | 1 | small | after-match: any time | 0.3 | all | 200 | 19 / 1 | his-sons-shirt 64 · no-shirt 87 · his-last-game 49 |
| 141 | the-reunion | 3 | small | home:evening: any time | 0.22 | 0.2 | 40 | 25 / 8 | the-old-team 25 · the-photo 15 |
| 142 | the-scarf-man | 3 | small | arrive:training/walkout: any time | 0.22 | 0.2 | 38 | 18 / 1 | the-pram 28 · moved-on 10 |
| 143 | the-scout-who-said-no | 3 | medium | home:evening: clubApps>=10 | 0.22 | 0.2 | 50 | 25 / 8 | he-got-it-wrong 17 · the-letter 16 · walked-past 17 |
| 144 | the-shirt-swap | 2 | small | after-match: any time | 0.22 | 0.18 | 44 | 19 / 1 | the-lad 38 · no-swap 6 |
| 145 | the-shoot-at-mums | 1 | small | home:evening: any time | 0.3 | all | 200 | 25 / 7 | mums-kitchen 95 · the-studio 89 · her-own-advert 16 |
| 146 | the-sign | 1 | small | after-match: lastWon or lastGoals>=1 | 0.3 | all | 200 | 19 / 1 | she-remembered 53 · she-remembered-too 147 |
| 147 | the-signing-session | 3 | small | arrive:training/home:evening: any time | 0.22 | 0.2 | 41 | 24 / 7 | her-programme 22 · forty-photos 19 |
| 148 | the-signs | 3 | medium | arrive:training: any time | 0.22 | 0.2 | 43 | 25 / 8 | the-sign-for-goal 20 · your-words 11 · the-quiet-one 12 |
| 149 | the-snorer | 1 | small | home:evening: any time | 0.3 | all | 200 | 25 / 8 | the-recording 38 · good-sleep 128 · the-machine 34 |
| 150 | the-snow | 3 | small | home:evening: any time | 0.22 | 0.2 | 32 | 25 / 8 | the-shovel 19 · called-off 13 |
| 151 | the-stag-do | 2 | medium | home:evening: any time | 0.22 | 0.2 | 51 | 26 / 8 | best-man 19 · the-fountain 16 · missed-it 16 |
| 152 | the-standby-list | 2 | medium | arrive:training: fame>=12 | 0.22 | 0.2 | 34 | 25 / 7 | the-shirt 12 · next-time 22 |
| 153 | the-statue | 2 | small | arrive:training: clubApps>=8 | 0.22 | 0.18 | 31 | 25 / 8 | the-sheet 23 · the-crowd 8 |
| 154 | the-superfan | 2 | medium | after-match: !mem(fan,'passed-away') | 0.22 | 0.2 | 30 | 19 / 1 | the-sixtieth 4 · the-calf 26 |
| 155 | the-tablets | 1 | small | arrive:training: clubApps>=3 | 0.3 | all | 200 | 25 / 7 | clean-sample 126 · the-letter-from-testing 45 · the-talk-to-the-kids 29 |
| 156 | the-tackle | 1 | small | after-match: any time | 0.3 | all | 200 | 19 / 2 | the-visit 78 · the-grudge 113 · his-leeks 9 |
| 157 | the-tattoo | 3 | small | home:evening: any time | 0.22 | 0.2 | 46 | 26 / 8 | spelt-wrong 19 · covered-up 27 |
| 158 | the-team-photo | 3 | small | arrive:training: any time | 0.22 | 0.2 | 40 | 25 / 8 | next-to-him 28 · the-back-row 12 |
| 159 | the-team-sheet | 3 | medium | arrive:training: clubApps>=8 | 0.22 | 0.2 | 37 | 26 / 8 | back-in-the-side 17 · the-bench 15 · told-the-kid 5 |
| 160 | the-tunnel | 1 | small | walkout: clubApps>=3 | 0.3 | all | 200 | 19 / 1 | the-nemesis 89 · the-nod 111 |
| 161 | the-under-nines | 2 | medium | home:evening: any time | 0.22 | 0.2 | 42 | 26 / 8 | the-league 10 · the-cones 32 |
| 162 | the-van | 1 | medium | home:evening: any time | 0.25 | all | 200 | 26 / 9 | his-name-on-the-van 70 · the-money-went 20 · no-loan 110 |
| 163 | the-wages | 3 | big | arrive:training: clubApps>=5 ; squad.any(veteran) | 0.22 | 0.3 | 58 | 25 / 8 | saved-by-the-buckets 29 · the-new-man 9 · your-speech 20 |
| 164 | the-walkout | 3 | medium | home:evening: any time | 0.22 | 0.2 | 42 | 26 / 8 | prices-frozen 17 · the-empty-stand 9 · seventy-four 16 |
| 165 | the-wall | 3 | small | home:evening: any time | 0.22 | 0.2 | 45 | 26 / 8 | the-mural 32 · no-wall 13 |
| 166 | the-watch | 1 | medium | arrive:training: squad.any(veteran) ; squad.any(age<=19) | 0.25 | all | 200 | 26 / 8 | second-chance 28 · the-dressing-room-knows 172 |
| 167 | the-wedding-party | 3 | small | home:evening: any time | 0.22 | 0.2 | 49 | 26 / 8 | in-the-album 35 · curfew 14 |
| 168 | the-whip-round | 1 | small | arrive:training: any time | 0.3 | all | 200 | 25 / 8 | godparent 121 · left-out 37 · uncle 42 |
| 169 | the-wind-up-call | 3 | small | home:evening: any time | 0.22 | 0.2 | 43 | 26 / 9 | got-him-back 17 · the-voice 26 |
| 170 | the-woods | 3 | small | arrive:training: any time | 0.22 | 0.2 | 42 | 25 / 8 | the-raft 27 · dry-land 15 |
| 171 | the-wrong-coach | 3 | small | after-match: any time | 0.22 | 0.2 | 42 | 19 / 1 | seat-fourteen 29 · a-taxi 13 |
| 172 | the-wrong-like | 3 | small | arrive:training: any time | 0.22 | 0.2 | 42 | 26 / 8 | the-thumb 24 · the-like 18 |
| 173 | the-young-lad | 2 | small | arrive:training: age>=29 ; squad.any(age<=19) | 0.22 | 0.18 | 30 | 29 / 11 | passed-it-on 14 · kept-it 16 |
| 174 | the-young-reporter | 3 | small | arrive:training: any time | 0.22 | 0.2 | 44 | 25 / 8 | her-first 30 · the-press-line 14 |
| 175 | tickets-for-the-street | 1 | small | home:evening: any time | 0.3 | all | 200 | 25 / 8 | the-banner 105 · just-mum 78 · the-corner-shop-man 17 |
| 176 | unknown-number | 1 | small | home:evening: any time | 0.3 | all | 200 | 26 / 8 | reported-it 55 · deleted-it 108 · the-witness 37 |
| 177 | unsettled | 1 | medium | driving/home:evening: clubApps>=8 | 0.25 | all | 200 | 23 / 5 | sacked-the-agent 104 · kept-him 96 |
| 178 | wednesday-fives | 1 | small | home:evening: any time (waits for the five-a-side game: never plays) | 0.3 | all | waits | - | - |
| 179 | your-first-coach | 3 | medium | home:evening: any time | 0.22 | 0.2 | 50 | 27 / 9 | his-whistle 16 · the-awards 13 · a-wave 21 |
| 180 | your-grandad | 2 | medium | home:evening: any time | 0.22 | 0.2 | 39 | 26 / 9 | he-knew 18 · wednesday 21 |
