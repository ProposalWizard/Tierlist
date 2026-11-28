# The story world plan (28 Nov 2026)

Job A of the story world build (`docs/handoffs/story-world-api-2026-11-28.md`). Plan only: no game
code changed. Written for Harry (not a coder). Each claim says how I know it: **[seen]** = read in
the code, **[reasoned]** = my judgement. Nothing here was measured or played. Nobody has seen these
stories on a phone yet.

Harry, 28 Nov: *"a new cut scene, a new area, a new skill, a new thing that unlocks specifically when
you get to that cut scene, or at a certain star pass level, or when you hit a certain age, or when you
go to Chelsea, when you go to Manchester United … so much depth and memory and an amazing feel."*

---

## 0. The short version

1. **One list of unlocks** (43 entries): places, cut scenes, skills, items, game modes. Each has an
   id, what opens it, what it does and how big the build is. A story grants one with `"unlock": "<id>"`.
2. **New start conditions** (16 new words, plus 7 that already work): your club, clubs you have
   played for, the opponent, a derby, star level, birthdays, first call-up, trophies, Ballon d'Or,
   seasons at a club, promotion. Most read data the save already has; milestones, unlocks and the
   scrapbook need a few bytes more.
3. **Club hooks** for 26 clubs (20 English, 6 European): an invented legend, a place, a tradition,
   a rivalry moment, and 1-2 story seeds each. Real tragedies are only places of quiet.
4. **One memory model**: people keep their feelings and 6 memories (as now); the career gets a
   **scrapbook** (48 lines, about 0.6 KB) that any story can read seasons later; unlocks are kept for
   good. All new story-world parts together: under 2 KB.
5. **10 stories wait on games that are not built.** 6 have a ball and must run on the real match
   engine; 4 are small mini-games.
6. **Build order:** B (engine hooks, about 2 days) first; C (55 stories) and D (10 game modes) side
   by side after B's first day.

---

## 1. The UNLOCKS registry

### 1a. What exists today [seen]

1. A story outcome can already say `give` (an item) or `unlock` (a word). Both go into `life.got`
   (`lib/star/life/arcs.ts:567`). The ending card shows "You got · …" or "Unlocked".
2. The book uses 4 such words: `item:dens-ball-bag`, `item:legends-boots`,
   `garden:hundred-balls-corner(+den-visits)`, `trophy:the-kit-room-door`.
3. **Nothing in the game reads them.** No garden, house or page looks at `life.got`. It is also cut to
   the last 20 (`arcs.ts:568`, `migrate.ts:120`), so an early unlock could fall off in a long career.
4. Only one item has words for its card (`ITEM_WORDS`, `arcs.ts:504`: the ball bag).

### 1b. The proposal

1. One file, `lib/star/life/unlocks.ts`: every unlock with an id, a kind, a 3-letter save code, its
   card words (name + one line) and where it shows in the game.
2. A story writes `"unlock": "heritage-room"`. The checker fails an id not in the list.
3. Saved in a new `life.ul`: the 3-letter codes joined by spaces, **never trimmed** (43 × 4 bytes =
   under 0.2 KB). The 4 old words map to their new ids, so old saves keep them.
4. New condition `has(<id>)` so stories, topics and places can read it.
5. The ending card shows "Unlocked · Heritage room" and the one line, using what is there today.

### 1c. The list

Status: **exists** = built and working; **small** = under half a day; **big** = a day or more.
"Unlocked by" names a story and beat (or ending), or a condition. Stories marked *(new, C)* are job
C's, from the club seeds in part 3.

**Places**

| id | Unlocked by | What it does | Status | Would live in |
|---|---|---|---|---|
| `heritage-room` | `club:manchester-united`, your first week (no story) | A quiet room of old photos and the 1958 memorial. You can walk in and stand. No lines, no story is set inside it. Flowers on the wall in the anniversary week. | big | `lib/star/world3d/clubPlaces.ts` (new) |
| `legends-lounge` | *The stopped watch* (new, C) beat 3, or any big-club legend story's last beat | The matchday lounge where the club legend sits. Tap him: the round menu, his memories. | big | `lib/star/world3d/clubPlaces.ts` |
| `old-boot-room` | first club-legend story beat at any club | A drawn backdrop for talk scenes (the place word `compound:boot-room` is already in 6 beats). | small | `components/star/life/StoryCards.tsx` backdrop list |
| `cage-pitch` | `legends-boots` promise `p-cage` kept | A town cage pitch you can visit for a kickabout drill on the real engine. | big | `lib/star/world3d/` + `EnginePlay` profile |
| `hundred-balls-corner` | `hundred-balls` ending (writes it today) | Den's corner in your garden: a ball bag and a cone; tap it to play his hundred again. | small | `lib/star/garden3d/scene.ts` reads `has()` |
| `den-visits` | `hundred-balls` ending (writes it today) | The kit man sometimes visits your garden. | small, after people plan P4 | `dayPlan` (people plan) |
| `kit-room-door` | `hundred-balls` ending (writes it today) | Your name on the kit room door: a still on the People page. | small | `components/star/life/PeoplePage.tsx` |
| `the-rec` | `the-rec` ending `the-rec-saved` | The council pitch in town. Sunday kickabouts with the pal (five-a-side mode). | big | `lib/star/world3d/` |
| `museum-case` | `the-pram-in-the-museum` museum ending; any first trophy at a top-26 club | A case in the club museum with your thing in it (a 2D page in the Club tab). | small | `components/star/` Club tab |
| `town-mural` | `the-wall` ending `the-mural` | Your mural on the drive to training (a still on the drive screen). | small | drive screen |
| `statue-plinth` | `the-statue` ending `the-sheet`, at 300+ apps for one club | The statue outside the ground; its unveiling cut scene. | big | `lib/star/world3d/clubPlaces.ts` |
| `europe-night-hotel` | `europe` + an away tie at one of the 6 European clubs | The team hotel abroad as a talk backdrop (`away:hotel` is already used 8 times). | small | `StoryCards.tsx` |

**Cut scenes** (all as data on the one cut-scene system, `lib/star/cutscene/`; never a bespoke loop)

| id | Unlocked by | What it does | Status | Would live in |
|---|---|---|---|---|
| `cs-anthem` | `just(first-call-up)` (part 2) | Line-up for the anthem at your first cap. | small (tunnel set + "debut" kind exist) | `lib/star/cutscene/story.ts` |
| `cs-legend-handshake` | first meeting with a top-26 club's legend | He waits by the tunnel and shakes your hand. | small ("The Icon" fixture exists) | `cutscene/story.ts` |
| `cs-number-retired` | `the-last-number` retired ending | Your shirt framed and held up at your last home game. | small (farewell fixture exists) | `cutscene/story.ts` |
| `cs-testimonial-walkout` | testimonial match played | You walk out with your family and old team-mates. | small (walk-out fixture exists) | `cutscene/story.ts` |
| `cs-guard-of-honour` | `just(trophy:league)` | Both teams clap you out. | medium (new beat; sets exist) | `cutscene/story.ts` |
| `cs-trophy-parade` | first league title at a club | The open-top bus through town. | big (new set, bus prop) | `cutscene/` + new set |
| `cs-statue-unveiling` | `statue-plinth` | The sheet comes off. | big (new set) | `cutscene/` |

**Skills** (things you can now do)

| id | Unlocked by | What it does | Status | Would live in |
|---|---|---|---|---|
| `drill-dens-hundred` | `item:dens-ball-bag` | Den's hundred as a repeatable garden drill; small technique training, once a week. | small (`HundredDrill.tsx` exists) | garden entry |
| `drill-legends-six` | a top-26 club legend story, its "teach me" ending | The legend's six rounds (challenge rounds, `drill.ts`) at training, once a week. | small | `lib/star/life/drill.ts` round sets |
| `celebration-legend` | Chelsea, Spurs, Palace seeds (part 3) | The legend's own celebration added to yours. | medium (move in `celebration.ts` + a clip) | `lib/star/celebration.ts` |
| `runup-for-stan` | `grandads-teammate` ending `the-penalty-for-stan` | A penalty run-up named for your grandad's team-mate. | medium (run-ups exist; a new clip) | shop run-ups list |
| `talk-captains-word` | `the-armband` or `the-national-armband` | A new answer in pre-match team talks ("Captain's word"). | small | `lib/star/life/decision.ts` |
| `crossbar-with-a-mate` | any team-mate bond 60+ | Garden crossbar challenge against a visitor (people plan item 32). | small (crossbar mode exists) | garden entry |

**Items** (kept in the save; shown on the house shelf or the wardrobe)

| id | Unlocked by | What it does | Status | Would live in |
|---|---|---|---|---|
| `item-dens-ball-bag` | `hundred-balls` (exists) | Opens `drill-dens-hundred`. | exists (no place shows it) | `arcs.ts` ITEM_WORDS |
| `item-legends-boots` | `legends-boots` ending `his-boots` | Boots in a case in your house. | small (needs card words) | `arcs.ts` ITEM_WORDS |
| `item-grandads-medal` | `grandads-teammate` ending `the-medal-home` | The 1961 county medal on your mantel. | medium (house shelf prop) | `lib/star/home3d/` |
| `item-old-scarf` | `the-lucky-scarf` ending `the-boy-has-it` → chain | The 1971 scarf, framed. | small (2D) | Locker |
| `item-match-ball` | `the-match-ball` ending `the-ball` | The signed ball. | small (2D) | Locker |
| `item-stopped-watch` | *The stopped watch* (new, C) | The legend's watch; wear it (wrist slot, `wearables.ts`). | medium | `lib/star/wearables.ts` |
| `item-framed-shirt` | first cap, or testimonial | A framed shirt on your wall. | medium (house prop) | `lib/star/home3d/` |
| `item-clay-print` | *The clay tray* (new, C) | A cast of your boot print from the old boot room. | small (2D) | Locker |

**Game modes** (the 10 waiting stories need these; detail in part 5)

| id | Unlocked by | What it does | Status | Would live in |
|---|---|---|---|---|
| `mode-penalties` | `ten-minutes` | A penalty in a real match moment, or a shoot-out. | small (trial penalties already on `EnginePlay`) | `components/star/life/ActivityHost.tsx` |
| `mode-two-touch` | `keep-ups` | Keep-ups to a count. | small/medium | `ActivityHost.tsx` + play3d keepy-ups (the 3D exception) |
| `mode-head-tennis` | `head-tennis` | Heading over the physio bed, first to 11. | medium (engine) | `EnginePlay` profile |
| `mode-duel-1v1` | `legends-boots` | First to three, one against one. | medium (engine) | `EnginePlay` profile |
| `mode-five-a-side` | `wednesday-fives`, `the-rec` | Five against five, small goals. | big (engine; a new profile, never the old copy) | `EnginePlay` profile |
| `mode-testimonial` | `the-charity-match`, last-seasons stories | A short friendly with invented sides. | medium (engine) | `EnginePlay` profile |
| `mode-gym-board` | `the-gym-board` | Beat a record on the bench or treadmill. | small (gym games exist) | `lib/star/gym/games.ts` |
| `mode-karting` | `the-karting` | Three laps against the squad's fastest. | medium (new mini-game) | `components/star/life/minigames/` |
| `mode-sprint` | `the-race` | Forty metres against a team-mate. | small/medium (reuse `legs.ts`) | `components/star/life/minigames/` |
| `mode-drive` | `the-lift` | Drive the young lad in; talk on the way. | medium (new mini-game) | `components/star/life/minigames/` |

---

## 2. New start conditions

All additive to `lib/star/life/cond.ts`. The checker (`validate.ts`) must learn each word. Club words
use a **slug**: the club's name from `lib/star/clubs.ts`, lower case, accents and `&` dropped, spaces
as dashes (`Manchester United` → `manchester-united`, `Brighton & Hove Albion` →
`brighton-hove-albion`, `FC Bayern München` → `fc-bayern-munchen`). The checker fails a slug that is
not a real club in `clubs.ts`.

### 2a. What already works [seen]

| Condition | Reads | Note |
|---|---|---|
| `starLevel>=50` | `starLevel(c)` (`facts.ts`) | Star Pass level, 1-100. **B must check** old-scale saves read the same number (`isOldStarScale`, `starPoints.ts:528`). |
| `age>=30`, `age==30` | `c.player.age` | Works, but true for a whole season. A birthday moment needs `just()` below. |
| `caps>=1` | `c.caps` | Added 28 Nov. |
| `captain`, `europe`, `injured` | save flags | Added 28 Nov. |
| `clubApps<=10` | `c.clubAppearances` | "New at the club". |
| `divisionLevel<=2` | division | Top two levels. |
| `ended(arc-x:ending)` | `life.fin` | Chains. |

### 2b. New, by club

| Condition | Example | Reads | Data exists? |
|---|---|---|---|
| `club:<slug>` | `club:chelsea` | `c.player.club` | yes |
| `everClub:<slug>` | `everClub:leeds-united` (played for them, any season) | `c.seasonHistory[].club` + now | yes |
| `opponent:<slug>` | `opponent:real-madrid` (last or next match) | `c.fixtures[].opponent` | yes (needs a fact) |
| `derby` | last or next match is a derby | `profileOf(club).rivals[].derby` (`clubProfiles.ts`) | yes (needs a fact) |
| `clubTop26` | at one of the 26 clubs in part 3 | a list in `unlocks.ts` | new list |
| `seasonsAtClub>=3` | | `seasonHistory` rows at this club | yes |

The 6 European clubs cannot be joined (moves abroad are not built on purpose; CLAUDE.md, transfers).
Their hooks fire on **European nights**: `europe && opponent:<slug>`, at `after-match`, `walkout`
or the hotel the night before.

### 2c. New, by star level, age and milestones

`just(<milestone>)` is true for **3 weeks** after the thing happened. It needs no new hook in
`app/star-dev/page.tsx`: at each story moment the life block compares a tiny snapshot with the career
and notes the life week anything changed.

| Condition | Example | What changed | Save |
|---|---|---|---|
| `just(birthday)` | `just(birthday) && age==30` | `c.player.age` went up | new: snapshot, 1 number |
| `just(star-level)` | `just(star-level) && starLevel>=50` | star level crossed 10, 25, 50, 75 or 100 | new: 1 number |
| `just(new-club)` | `just(new-club) && club:manchester-united` | `c.player.club` changed | already `life.home`; + 1 week |
| `just(first-call-up)` | | `c.international.callUps` went 0 → 1 | new: 1 number |
| `just(call-up)` | | a later call-up | same |
| `just(trophy)` / `just(trophy:<comp>)` | `just(trophy:fa-cup)` | `c.trophies.length` went up | new: 1 number |
| `just(promoted)` / `just(relegated)` | | last `seasonHistory` row's `move` | yes |

Snapshot `life.ms`: `[age, starLevel, callUps, trophies, club code]` plus `life.msw` (milestone → life
week). About 60 bytes.

### 2d. New, by caps and trophies

| Condition | Example | Reads | Data exists? |
|---|---|---|---|
| `callUps>=1` | | `c.international.callUps` | yes |
| `intlGoals>=1` | | `c.internationalGoals` | yes |
| `inTournament` | in this summer's squad | `c.tournament` | yes |
| `won(<comp>)` | `won(champions-league)` | `c.trophies[].competition` | yes |
| `won(<comp>)>=n` | `won(fa-cup)>=2` | same, counted | yes |
| `wonAt(<comp>,<slug>)` | `wonAt(league,sunderland)` | `c.trophies[].club` | yes |
| `ballonDor>=1` | | `c.ballonDorWins` (add to `FACT_NUMBERS`) | yes |
| `has(<unlock>)` | `has(heritage-room)` | `life.ul` | new (part 1) |
| `book('<tag>')`, `since('<tag>')>=2` | | the scrapbook (part 4) | new |

Competition slugs: `league` (any division title), `fa-cup`, `league-cup`, `lower-league-trophy`,
`champions-league`, `europa-league`, `community-shield`, `world-cup`, `european-championship`. The
checker maps each to the strings in `c.trophies` (B confirms the league title strings in
`careerFlow.ts:1492`).

---

## 3. Club hooks: 20 English clubs and 6 European

Rules for all of it:

1. Every legend is **invented**. Job C searches each name once before shipping, to make sure it is not
   a real footballer. No real brand, sponsor or person anywhere.
2. Places and traditions are invented too. Real stand names are not used.
3. **Real tragedies are honoured, never dramatised.** Munich 1958 (Manchester United) and Hillsborough
   1989 (Liverpool) appear only as a place of quiet (the heritage room, a memorial with flowers). No
   story is set there, no invented person was there, nobody says words about it, no choice touches
   it. The legend for those clubs played in a different era on purpose.
4. Each club's legend is the club's `legend` role (the people system already gives each club its own
   legend; `people.ts` `CLUB_ROLES`). For these 26, B adds a fixed table so the legend is the one below,
   not a pool pick. Every other club keeps the pool.
5. Stories fire with `club:<slug>` (or `europe && opponent:<slug>`) in `start.when`. Most are rare or
   rarer; the biggest clubs get a legendary one.

### 3a. English clubs

| Club (slug) | Legend: name, position, era, one detail | Place | Tradition | Rivalry moment | Story seeds |
|---|---|---|---|---|---|
| Manchester United (`manchester-united`) | **Walter Penhale**, inside forward, 1963-74. Keeps a pocket watch stopped at the minute of his first goal. | The heritage room (quiet; see rule 3). He waits outside it in the corridor, never inside. | New signings press a boot into the clay tray in the old boot room. The trays go back sixty years. | Derby week: he never says the other club's name. He calls them "that lot". | 1. **The stopped watch** (legendary): he gives you the watch when you score at the minute it shows; years on you give it to an academy lad. → `item-stopped-watch`, `legends-lounge`. 2. **The clay tray** (rare): your tray cracks the day you arrive; he says that is luck. → `item-clay-print`. |
| Liverpool (`liverpool`) | **Eddie Calloway**, centre half, 1971-83. Tapes his wedding ring before he shakes your hand, out of habit. | The bus stop where the team used to wait for the ride to training. | Thursday "court" in the boot room: seniors judge the young lads' fines with a toy gavel. | Derby across the park: his dad supported the other lot and never forgave him. | 1. **The court** (rare): you are fined for a haircut; he defends you. 2. **His dad's season ticket** (very rare): his late dad's seat in the other club's ground, and an invite from them. |
| Arsenal (`arsenal`) | **Reggie Thorne**, left back, 1986-98. Irons his own laces. | The marble corridor with the old team photos. | The youngest player carries the match ball out and gives it to the captain in the tunnel. | North London week: a mural of his tackle is painted over every year by the other lot's fans and repainted. | 1. **The laces** (rare): he teaches you to iron yours; a game later, a cup final. 2. **The ball carrier** (uncommon, `age<=20`). |
| Chelsea (`chelsea`) | **Frankie Delacourt**, winger, 1969-78. Wears a flower in his lapel every home game. | The old pub across the road, now the supporters' club bar. | The squad signs a ball for the oldest season-ticket holder each Christmas. | London derbies: he still owes the other club's legend a fiver from a bet in 1974. | 1. **The flower** (legendary): his florist is closing; the flower, the last bunch, and his celebration. → `celebration-legend`, `cs-legend-handshake`. 2. **The fiver** (rare). |
| Manchester City (`manchester-city`) | **Norman Ashby**, keeper, 1976-89, through the lean years. Counts the crowd from his seat every match. | The old ground's turnstile, kept by the car park. | Anyone who scores on debut buys pies for the ground staff. | Derby day: he kept goal in the worst derby defeat and has the ball in his loft. | 1. **The ball in the loft** (very rare): he wants to see it go in the bin after you win a derby. 2. **The crowd count** (uncommon). |
| Tottenham Hotspur (`tottenham-hotspur`) | **Lenny Marchetti**, playmaker, 1981-92. Whistles opera in the tunnel. | The old training ground's cockerel weathervane, now on a roundabout. | The newest signing sings in the canteen, and Lenny marks it out of ten. | North London week: his opera gets louder. | 1. **The aria** (rare): he hums one on your best night; his celebration. → `celebration-legend`. 2. **The weathervane** (rare). |
| Newcastle United (`newcastle-united`) | **Billy Rennison**, centre forward, 1968-79. Still walks to the ground from the river every match day. | The walk up the hill from the river. | The number nine walks up the hill with the fans before the first home game of the season. | Wear-Tyne derby: he scored the derby winner in 1974 and tells you about it every week. | 1. **The walk** (legendary, `club:newcastle-united` and you wear 9). 2. **The derby winner** (rare). |
| Everton (`everton`) | **Tommy Gilfoyle**, midfielder, 1962-73. Carries a tin of travel sweets and gives one to every debutant. | The church by the ground, where the old players are remembered. | First home goal: you give a sweet to the kit man. | Derby across the park: Tommy and Eddie Calloway (Liverpool) are old friends who never sit together. | 1. **The sweet tin** (rare). 2. **Two old men** (very rare, needs `everClub` both): the two legends at one table. |
| Aston Villa (`aston-villa`) | **Arthur Pendry**, centre half, 1977-85. Keeps a European final ticket stub in his wallet. | The trophy room's empty shelf, kept for the next big one. | The captain rubs the old lion statue on the stairs before cup ties. | Second City derby: Arthur's wedding was on a derby day and he went to the match first. | 1. **The stub** (legendary, `europe`). 2. **The wedding** (rare). |
| West Ham United (`west-ham-united`) | **Georgie Fenwick**, full back, 1964-80, academy-made. Keeps racing pigeons. | The old academy hut, now a garden shed. | Academy lads clean a senior's boots in their first season (he did yours). | London derbies: his pigeons fly over the other ground on derby day. | 1. **The pigeons** (rare). 2. **The hut** (uncommon, `age<=20`). |
| Leeds United (`leeds-united`) | **Jack Ormsby**, hard midfielder, 1968-78. Never sits with his back to a door. | The old gym under the stand. | Pre-season: the squad runs up the hill behind the training ground, and the last man buys fish and chips. | Roses rivalry: he still won't eat red sweets. | 1. **The hill** (uncommon, links to `the-hill`). 2. **The door** (rare). |
| Nottingham Forest (`nottingham-forest`) | **Colin Tarrant**, winger, 1977-84. Two European nights; keeps a tea towel of that team on his kitchen wall. | The river walk to the ground. | The team photo is taken on the river steps. | East Midlands derby: he once scored and fell into the photographers. | 1. **The tea towel** (legendary, `europe`): he lends it to you for a European night. 2. **The river steps** (rare). |
| Sunderland (`sunderland`) | **Hal Dunstone**, keeper, 1966-79. Does one lap of the pitch on his birthday, every year. | The old pit wheel by the ground. | Before the first home game, the squad visits the pit wheel. | Wear-Tyne derby: he and Billy Rennison (Newcastle) ring each other after every derby. | 1. **The lap** (rare, `just(birthday)` for him, his lap with you). 2. **The phone call** (very rare). |
| Wolverhampton Wanderers (`wolverhampton-wanderers`) | **Ronnie Bickerstaff**, forward, 1972-82. Keeps the floodlight bulb that blew in his best game. | The old floodlight pylon, kept in the car park. | The night games: last one off switches off the dressing-room light. | Black Country derby: he and the other club's legend run a charity five-a-side. | 1. **The bulb** (rare, links to `the-lights`). 2. **The charity fives** (uncommon, `mode-five-a-side`). |
| Leicester City (`leicester-city`) | **Desmond Pryor**, striker, 1991-2001. Tells the same story about a fox in the car park. | The car park, and the fox. | A new signing feeds the fox once (it never shows). | East Midlands derby: he missed a penalty in one and still practises them. | 1. **The fox** (rare). 2. **His penalties** (rare, `mode-penalties`). |
| Crystal Palace (`crystal-palace`) | **Kenny Abara**, winger, 1988-96. Dances in the canteen. | The canteen, where his photo is. | Every goal-scorer dances once in the canteen. | South London derby: his dance in that game got him booked. | 1. **The dance** (rare). → `celebration-legend`. 2. **The booking** (uncommon). |
| Southampton (`southampton`) | **Graham Lisle**, midfielder, 1975-88, then academy coach. Carries a tide table. | The academy pitch by the water. | Academy graduates sign the academy wall. | South Coast derby: he keeps a map of the 1976 trip. | 1. **The wall** (rare, `age<=21`). 2. **The tide** (uncommon). |
| Derby County (`derby-county`) | **Clive Hemsworth**, centre half, 1970-79. Leaves mud on his shoes on purpose. | The old ground's centre spot, now in a housing estate. | Captains dig a spade of earth from the centre spot each spring. | East Midlands derby: he thinks the other lot's 1970s manager stole his idea. | 1. **The centre spot** (legendary). 2. **The spade** (rare). |
| Middlesbrough (`middlesbrough`) | **Albert Crane**, striker, 1971-80. Worked a steel shift before early matches. | The old transporter bridge, seen from the training ground. | The squad crosses the bridge on the first day of pre-season. | Tees-Tyne-Wear: he scored in all three and keeps the scores in a notebook. | 1. **The shift** (rare). 2. **The bridge** (uncommon). |
| Brighton & Hove Albion (`brighton-hove-albion`) | **Maurice Quell**, keeper, 1979-87. Swims in the sea every morning, any weather. | The beach below the old ground's road. | The squad swims in the sea on New Year's Day. | The motorway rivalry: he had a banner made about it in 1983. | 1. **The swim** (rare). 2. **The banner** (uncommon). |

### 3b. European clubs (European nights only)

| Club (slug) | Legend | Place | Tradition | Rivalry moment | Story seeds |
|---|---|---|---|---|---|
| Real Madrid (`real-madrid`) | **Tomás Arribeta**, holding midfielder, 1980-91. Wears a black tie to every match. | The away dressing room's old bench. | Visiting captains are given a white rose. | Your club's last visit: he played in it and lost. | 1. **The white rose** (legendary, `europe && opponent:real-madrid`). |
| FC Barcelona (`fc-barcelona`) | **Pau Rovellat**, centre half, 1989-99. Plays chess in the kit room. | The chapel by the tunnel. | The away team is shown the chapel. | Your club's legend once swapped shirts with him. | 1. **The chess game** (rare): he plays you before the tie; the result changes nothing but he remembers. |
| FC Bayern München (`fc-bayern-munchen`) | **Klaus Wendemuth**, sweeper, 1972-83. Sets his watch by the stadium clock. | The stadium clock. | The home side gives visitors a pretzel at the hotel. | His last game was against an English club. | 1. **The clock** (rare). |
| Juventus (`juventus`) | **Aldo Ferrabrini**, full back, 1982-93. Wears a tie on match days and folds it into his pocket at kick-off. | The old training ground's gate. | Visiting players sign the guest book. | His team lost a final to an English side; he sends that club a card every year. | 1. **The guest book** (rare): years on, your page. |
| AC Milan (`ac-milan`) | **Sandro Liveri**, centre half, 1990-2002. Folds paper napkins into swans. | The restaurant across from the hotel. | The visitors' captain is given one swan. | He marked your club's best striker of the 1990s. | 1. **The swan** (rare). |
| Paris Saint-Germain (`paris-saint-germain`) | **Yannick Doumbé**, winger, 1991-2000. Writes poems on the back of team sheets. | The press room's back row. | The home kit man leaves the visitors a team sheet with a line on it. | He scored against your club and wrote a poem about it. | 1. **The team sheet poem** (rare). |

---

## 4. Memory across stories

### 4a. What exists [seen]

| Store | What | How long | Read by |
|---|---|---|---|
| A person (`life.people[id]`) | respect, bond, grudge + 6 memories `[tag, week, strength]` | strength 1 ≈ a season, 2 ≈ three, 3 for good | `mem(slot,'tag')` |
| The squad (`life.squad`) | what the dressing room saw | same fading | `mem(squad,'tag')` |
| You (`life.self`) | things about you | same; 6 lines | `mem(you,'tag')` |
| Flags (`life.flags`) | words a story set | **only the last 12** | `flag:x` |
| Finished stories (`life.fin`) | story + ending + beats, ~14 bytes | for good | `ended(...)` |
| Things you got (`life.got`) | items and unlocks | **only the last 20** | nothing yet |

The gap: a story cannot safely leave a fact for another story **three seasons later** unless it is
about one person. Flags fall off after 12. `life.self` holds only 6.

### 4b. The model (one model, following the people plan)

The people plan's layers stay as they are (today's mood, habits, memories, relationship; its own
budget, 10 KB ceiling). This plan adds **one** layer for the career, and keeps unlocks separate.

| Layer | What it holds | Who writes | Who reads | Size |
|---|---|---|---|---|
| Person memories | how one person feels and why (exists) | stories, events, acts | `mem()`, callbacks, remarks | as now |
| **The scrapbook** `life.sb` | things that happened to YOU that the world remembers: "scored at the minute on the watch", "missed the derby penalty", "gave the watch away" | a story outcome: `"book": "watch-minute"` | `book('tag')`, `since('tag')>=n`, `{if book('tag')}…{/if}` in any line | 48 lines max, ~12 bytes each: **≤ 0.6 KB** |
| Unlocks `life.ul` | places, skills, items, modes | `"unlock": "<id>"` | `has(<id>)`, the places themselves | ≤ 0.2 KB |
| Milestones `life.ms`, `life.msw` | the snapshot for `just()` | the life block | `just(...)` | ≤ 0.1 KB |
| Echoes `life.ech` | a callback line due later | `"book"` with `echo` | the notes queue | 6 max, ≤ 0.3 KB |

1. **A scrapbook line** is packed as `tag.week.strength` (e.g. `wtch.412.3`). Tags are 4 letters in
   the save, from a list in `lib/star/life/book/scrapbook.json` (tag → code + one plain line for the
   People page). Strength 3 never goes; strength 2 goes after about three seasons; when full, the
   weakest and oldest goes first (the same rule as person memories, `people.ts remember`).
2. **How other stories read it:** `book('watch-minute')` in `start.when`, a beat's `requires`, an
   outcome's `if`, or inside a line. The checker fails a tag that is read but never written (the
   same check that memories and flags have today).
3. **Callbacks seasons later**, four ways:
   1. Inside one story: a later beat with `after.seasons` (exists).
   2. Across stories: a story starts on `since('watch-minute')>=3`, so it comes three seasons on.
   3. **Echoes:** `"book": { "tag": "watch-minute", "echo": { "seasons": [2, 4], "who": "legend", "line": "…" } }`
      writes one text from that person, due two to four seasons later. If he is forgotten by then
      (the 60-person cap), the echo is dropped. 6 echoes at most.
   4. Remarks: when you walk up to someone in 3D (people plan 4e), his first line comes from his
      strongest memory. Stories write those as today.
4. **Big moments are both:** a story that matters writes a strength-3 memory on the person **and**
   a scrapbook line, so the person remembers it and so does the world.

### 4c. Save budget

| Part | Today (max seen) | Added by this plan |
|---|---|---|
| Whole life block | 15.4 KB (500 × 20 soak) | |
| People plan (clock, visitors, moods, habits) | | ≤ 10 KB (its own ceiling) |
| Scrapbook, unlocks, milestones, echoes | | ≤ 1.2 KB |
| 55 more finished stories (C) at ~14 B | | ≤ 0.8 KB |
| More club pins (26 legends) | | ≤ 0.3 KB |
| **Worst case total** | | **about 28 KB of 50 KB** |

The soak must print each new part's bytes and fail past its budget.

---

## 5. New things stories need

### 5a. The 10 stories waiting on unbuilt games [seen: `needsActivity` in the arcs]

Anything with a ball runs on the real match engine through `EnginePlay` (one-engine skill;
RUL-ENG-002). Never a copy, never edit `scripts/one-engine-guard.mjs`. The old `FiveASide.tsx` copy is
left alone; the story's five-a-side is a new `EnginePlay` profile.

| # | Story (file) | Tier, stage | Mode it needs | Ball? | How to build the smallest real version | Size |
|---|---|---|---|---|---|---|
| 1 | `ten-minutes` (Miss it) | uncommon, established | `penalties` | yes | Trial penalties already run on `EnginePlay`; mount it from the activity host with a keeper and "miss on purpose" counting. | S |
| 2 | `the-gym-board` (The board) | uncommon, breaking through | `gym` | no | The gym's bench and treadmill games exist (`lib/star/gym/games.ts`); the board is a target number to beat. | S |
| 3 | `keep-ups` (Bet you can't do fifty) | uncommon, any | `two-touch` | yes | Keepy-ups to a count; the garden kickabout (play3d, the 3D exception) or a challenge round set. | S-M |
| 4 | `the-race` (Fastest in the squad) | uncommon, breaking through | `pace-sprint` | no | A 40 m tap-or-hold sprint using your legs and stamina numbers (`lib/star/legs.ts`), against his pace. | S-M |
| 5 | `legends-boots` (First to three) | uncommon, breaking through | `duel-1v1` | yes | `EnginePlay` with one attacker and one defender, first to three. | M |
| 6 | `head-tennis` (Over the physio bed) | uncommon, breaking through | `head-tennis` | yes | Engine headers over a low net: a rally game, first to 11. | M |
| 7 | `the-charity-match` (Captain for the day) | uncommon, any | `testimonial-match` | yes | A short friendly on `EnginePlay` with invented sides; your chances only. | M |
| 8 | `the-karting` (Team day) | uncommon, any | `karting` | no | A top-down three-lap kart race, one thumb, in the game's style. | M |
| 9 | `the-lift` (Can you give us a lift?) | uncommon, established | `drive` | no | A short drive (steer, brake at lights) with talk lines between; see `docs/research/gym-compound-driving-2026-11-27.md`. | M |
| 10 | `wednesday-fives` (Wednesday fives) | uncommon, breaking through | `five-a-side` | yes | A new `EnginePlay` profile: 5 v 5, small goals, short halves. | L |

Each must play on `/star-life-dev`, and the checker's `WAITING_ARCS` must drop the story once its
mode mounts.

### 5b. Engine and data (job B)

1. The unlocks list (`unlocks.ts`), `life.ul`, the `unlock` effect reading it, `has()`, card words.
2. The 16 new condition words in part 2, with checker words and tests.
3. The scrapbook: `book` effect (with optional `echo`), `book()`, `since()`, `life.sb`, `life.ech`.
4. Milestones: `life.ms` / `life.msw`, `just()`.
5. The fixed legend table for the 26 clubs (`pool.ts` or a new `clubLegends.ts`), overriding the pool
   pick only for those clubs and only for a career's **new** club (a first club's legend never changes,
   so old saves keep theirs).
6. `ITEM_WORDS` entries for every item in part 1.
7. Old saves: every field optional; `tests/star/lifeSaveFixture.mts` byte for byte.

### 5c. Stories (job C)

1. **40 club stories** from the seeds in part 3: at least one per club; legendary or very rare at
   Manchester United, Liverpool, Chelsea, Newcastle, Aston Villa, Forest, Derby and Real Madrid.
   Each with a middle beat, a callback a season or more later, a scrapbook line another story reads,
   and an unlock where the table says so. Chain at least 6 of them (e.g. Everton's *Two old men* waits
   on Liverpool's *The court* and Everton's *The sweet tin*).
2. **15 last-seasons stories** (age 34+ runs dry today: a beat every 11.8 weeks, worst 183 weeks;
   STORY_BOOK_MAP 6.4): the testimonial, the last contract talk, coaching badges, the last away trip,
   the young lad who takes your number, your last derby, the farewell lap, the boot room's last
   Thursday, the first coaching session, the pundit offer, your kids' team, the last ice bath, the
   kit man's goodbye, the club ambassador job, the last penalty.

### 5d. Places, cut scenes and screens (later, after B-D)

1. `lib/star/world3d/clubPlaces.ts`: the heritage room, the legends lounge, the statue (big; follows
   the 3D handbook and the people budget).
2. Cut scenes as data: 7 in part 1 (4 small from existing fixtures).
3. The People page shows a moved player's club staff by `clubRoleId` (STORY_BOOK_MAP 7.9).
4. The garden reads `has(hundred-balls-corner)`; the house shelf shows items.

---

## 6. Build order for jobs B, C and D

```
Day 1        Day 2        Day 3        Day 4
B1 B2 B3 ────B4 B5 B6
       C (writes against B's words) ──────────────── C done
       D1 D2 D3 D4 ── D5 D6 D7 ── D8 D9 ── D10
```

| Step | What | Size | Waits on |
|---|---|---|---|
| **B1** | Club, opponent, derby, seasons-at-club, trophy, caps, Ballon d'Or conditions + checker + tests | S (½ day) | nothing |
| **B2** | Unlocks list, `life.ul`, `unlock` effect, `has()`, card words, old words mapped | S (½ day) | nothing |
| **B3** | Scrapbook + echoes, `book()`, `since()` | S (½ day) | nothing |
| **B4** | Milestones and `just()` | S (¼ day) | B1 |
| **B5** | Fixed legends for the 26 clubs | S (¼ day) | nothing |
| **B6** | Soak: bytes per new part, budgets; old-save fixture; full checks | S (¼ day) | B1-B5 |
| **C** | 40 club stories + 15 last-seasons stories, written in batches of 10, checker and soak after each | L (2-3 days) | B1-B3 to pass the checker |
| **D1** | Penalties | S | nothing |
| **D2** | Gym board | S | nothing |
| **D3** | Two-touch | S-M | nothing |
| **D4** | Sprint | S-M | nothing |
| **D5** | 1v1 duel | M | nothing |
| **D6** | Head tennis | M | D5's profile work |
| **D7** | Testimonial match | M | nothing |
| **D8** | Karting | M | nothing |
| **D9** | Drive | M | nothing |
| **D10** | Five-a-side | L | D5, D7 |

Smallest first in D, so stories start playing early. B stays additive: no change to what an old save
plays. Checks before every commit as in the handoff (story checker, the four life tests, the soak,
type check, one-engine guard, admin-look guard).

---

## 7. Questions for Harry (ask, don't assume)

1. **Munich and Hillsborough:** a quiet heritage room with no story inside it, as in part 3 rule 3.
   OK, or leave them out of the game entirely?
2. **European clubs:** their stories happen only on European nights (you cannot join them). OK?
3. **The 26 legends:** fixed people at these clubs (the same Walter Penhale in every United career),
   or picked from a pool like other clubs? Suggested: fixed. It makes them feel real.
4. **Unlock places (heritage room, legends lounge, statue):** these are big 3D builds. Build them
   after the stories work as talk scenes? Suggested: yes.
