# Star Pass: which level you reach at which age

For Harry and Mikey. Written 28 Nov 2026. A measurement only. No game number was changed. The Star Pass is Mikey's, so every change below needs his yes.

**Key point.** Today the average player is on **level 14 at age 16, level 30 at age 20 and level 55 at age 30**. Level 10 arrives at **age 17 (about 32 matches)**. Harry wants level 10 at about **age 20**.

**Key number.** One edit to one list of 29 numbers moves level 10 to **age 20 (about 163 matches)**. Level 50 moves from age 25 to age 27. Level 75 and above stay about where they are.

**Key change (Option F2 below).** Make each of the first 29 levels cost about 100,000 to 120,000 points. Today they cost 12,000 to 91,000. Level 30 and up stay exactly as they are.

## How I know this

- **Measured:** I played **40 careers** through the real game code (`careerFlow.ts`, `starPoints.ts`) with no screen. 8 each of five ability types, start ages 16, 17 and 18 mixed, start in the National League. Each ran to age 38. About 1,100 matches each. The retune numbers re-price the same 40 careers with a new level list. The check: re-pricing with today's list gives the game's own level in 885 of 885 age-ends.
- **Guessed (my choices, not the game's):**
  - The five ability types are my own: how often they win, score and what rating they get. `low` wins 42% and rates 6.6. `elite` wins 78% and rates 8.3.
  - A player who averages a rating of 7.2 or more moves up one division most summers (60% chance). The game's real transfer screen was not used.
  - Every player plays every match. A real player who is dropped or injured plays fewer, so everything below would come a little later.
  - Matches a season come out at about 50 (league plus cups).
- **Not measured:** 40 careers is a small sample. The 10th and 90th percentile columns are rough. Level 100 needs ten Legend tasks, not points. No career got near it.

## Today: level at each age

Level, the 10th percentile (slow), the median (middle), the 90th percentile (fast). Matches and points are medians. "n" is how many careers were that age. Fewer at 16 and 17 because some start at 17 or 18.

| Age | n | Level slow / middle / fast | Matches played (median) |
|---|---|---|---|
| 16 | 15 | 9 / 14 / 19 | 49 |
| 17 | 30 | 11 / 18 / 25 | 76 |
| 18 | 40 | 13 / 21 / 29 | 100 |
| 19 | 40 | 17 / 27 / 36 | 152 |
| 20 | 40 | 21 / 30 / 42 | 203 |
| 21 | 40 | 24 / 35 / 47 | 252 |
| 22 | 40 | 26 / 39 / 51 | 302 |
| 23 | 40 | 27 / 41 / 53 | 353 |
| 24 | 40 | 28 / 44 / 54 | 402 |
| 25 | 40 | 29 / 47 / 56 | 454 |
| 26 | 40 | 29 / 49 / 57 | 504 |
| 27 | 40 | 29 / 51 / 59 | 553 |
| 28 | 40 | 29 / 53 / 61 | 602 |
| 29 | 40 | 29 / 54 / 62 | 649 |
| 30 | 40 | 29 / 55 / 63 | 704 |
| 31 | 40 | 29 / 56 / 65 | 746 |
| 32 | 40 | 29 / 57 / 67 | 797 |
| 33 | 40 | 29 / 59 / 69 | 844 |
| 34 | 40 | 29 / 59 / 70 | 893 |
| 35 | 40 | 29 / 60 / 72 | 942 |
| 36 | 40 | 29 / 62 / 73 | 988 |
| 37 | 40 | 29 / 63 / 74 | 1,032 |
| 38 | 40 | 29 / 64 / 76 | 1,076 |

The slow column sits on **29** from age 25. That is the League Two gate: the weak, never-promoted players are held there. Level 29 needs 10 games in League Two or higher, but the weak players only stop at 29 because the next gate (level 39) needs League One games.

## Today: when each level arrives

| Level | Careers that got there (of 40) | Age slow / middle / fast | Matches played (median) |
|---|---|---|---|
| 10 | 40 | 16 / **17** / 18 | 32 |
| 20 | 40 | 17 / **18** / 20 | 80 |
| 30 | 34 | 18 / **20** / 23 | 173 |
| 50 | 31 | 22 / **25** / 31 | 444 |
| 75 | 6 | 35 / **37** / 38 | 971 |
| 90 | 0 | none by 38 | none |
| 100 | 0 | none by 38 | none |

Age is the age during the match that took you there. A player who starts at 17 cannot reach level 10 before 17, so "age 17" for level 10 is mostly "right at the start".

By ability, median age at level 10 / 20 / 50:

| Type | Level 10 | Level 20 | Level 50 |
|---|---|---|---|
| low | 18 | 20 | never (held at 29) |
| mid | 17 | 18.5 | 30 |
| riser | 17 | 18 | 26.5 |
| star | 17 | 18 | 25 |
| elite | 17 | 18 | 22.5 |

## Why level 10 comes so early

Level 10 costs **148,000 points**. A middling player earns about 5,000 to 8,000 points a match, so that is about 30 matches. Levels 1 to 9 cost 12,000 to 22,000 each, which is two to four matches a level. Harry's rule from 1 Oct 2026 said levels near the top must be very slow. It never set how slow level 10 should be.

## Retune options

Each option re-prices the same 40 careers. Median age (and matches played) when level 10 / 20 / 50 / 75 is reached. Level 100 is set by the Legend tasks, so no points option moves it. I list level 90 instead.

| Option | Level 10 | Level 20 | Level 50 | Level 75 | Level 90 |
|---|---|---|---|---|---|
| **Today** | 17 (32) | 18 (80) | 25 (444) | 37 (971), 6 of 40 | none |
| A. Every level costs 8 times more | 20 (182) | 24 (363) | **never** | never | never |
| B. The game's own "brutal" curve | 17 (45) | 19 (107) | 30 (655) | never | never |
| C. A flat 120,000 a level | 20 (170) | 22.5 (304) | 27 (530) | **31.5 (749), 22 of 40** | 1 of 40 at age 30 |
| **F2. First 29 levels about 100,000 each, rest as today** | **20 (163)** | **22 (266)** | **27 (527)** | 37.5 (1,015), 4 of 40 | none |
| F1. Same, stronger (+130,000) | 20.5 (200) | 23 (308) | 28 (550) | 37 (1,016) | none |
| F3. Same, strongest (+160,000) | 21 (227) | 23 (338) | 28 (595) | 38 (1,049) | none |

What each one does, in plain words:

- **A (multiply every cost, or divide every point).** Level 10 lands at 20, but level 50 never comes. The same thing happens if points are cut by 8 in the XP Book. Do not do this.
- **B (switch `STAR_CURVE` to "brutal").** One word. Level 10 stays at 17, because the early levels barely move. Does not meet the ask.
- **C (flatten the whole curve).** Level 10 at 20, but level 75 arrives at 31 for more than half of careers and level 90 is reachable. That wrecks Harry's "level 60 is far harder than level 5" rule. Shown to explain why not.
- **F (dearer early levels only, fading out by level 30).** Level 10 at 20. Level 30 and up cost the same as today, so the top stays as hard as Mikey made it. Level 75 is rare, as today.

## Recommendation: F2

Matches played from level 10 to 20 are 106 (today 55). From 20 to 30 they are 72 (today 90). From 30 to 50 they are 255 (today 309). Nothing breaks shape: no sudden cliff, no sudden rush.

Median level at each age under F2: age 16 level 3, age 18 level 6, **age 20 level 12**, age 22 level 22, age 25 level 39, age 30 level 51, age 35 level 59, age 38 level 62. (Today: 14, 21, 30, 39, 47, 55, 60, 64.)

**Side effect to decide on.** The first reward cards come much later. Median matches played at levels 2 / 4 / 6 / 8 / 10:

| | L2 | L4 | L6 | L8 | L10 |
|---|---|---|---|---|---|
| Today | 2 | 9 | 15 | 18 | 32 |
| F2 | 20 | 52 | 101 | 133 | 163 |

A new player waits 20 matches for the first card. If Mikey wants a quick first card, give level 1 and 2 their old cost (12,000 and 13,000) and take that points total off the later levels. That is his call.

### Exactly what would change (do not change it; Mikey's lane)

1. `lib/star/starPoints.ts`, line 353. `EARLY_LEVEL_COST` is empty today (`[]`). The game already reads this list first: levels 1 to 29 take their price from it, and level 30 on use the curve. Put these 29 numbers in it (the cost to go from level 1 to 2, 2 to 3, and so on):
   `[110000, 110000, 110000, 120000, 120000, 120000, 120000, 120000, 120000, 120000, 120000, 110000, 110000, 110000, 100000, 100000, 100000, 98000, 96000, 96000, 94000, 93000, 92000, 93000, 92000, 93000, 93000, 95000, 96000]`
   Nothing else in this file changes. The curve line 342 (`recommended: { start: 15_000, grow: 1.075, growTop: 1.02 }`) stays.
2. `lib/star/starPoints.ts`, the comment above line 353 (lines 348 to 352) says level 10 comes "after about 30 matches". Update it to about 160.
3. `tests/star/starPoints.mts`: the header table and the checks about level 4 and 4 to 5 taking 4+ matches will need new numbers. The test also checks that 60 to 61 is many times 4 to 5. That still holds, because levels 60+ are unchanged.
4. `lib/star/rewardCatalogue.ts`, the comment above `DEFAULT_PASS_LEVELS` (line ~204) says non-league lasts "to level 13" and the Premier League starts "from 38". Those would be about "to level 25" and "from 45". The card positions (the numbers in `DEFAULT_PASS_LEVELS`, `starPassClaim.ts`, `StarRatingSheet.tsx`) do not move. Cards are tied to a level, not an age, so every card stays where Mikey put it. The cards just arrive later.
5. Not touched: gates, Legend tasks, the XP Book (`xpConfig.ts`, `/admin/star-xp`), `starPassClaim.ts`.

If Harry wants level 10 nearer 19 instead, use +100,000 less: the flat part at about 80,000. I did not run that exact number. F2 sits between my "+100,000" and "+130,000" runs and gave a median of exactly 20.

### Open items for Mikey

- **Old saves.** The game keeps a "best level reached" (`starBest`), so nobody loses a level. But a save at level 40 would have a different points bar. I did not test an old save.
- **Soak after the change.** Run `npx tsx scripts/soak/careerSoak.mts 20` and this printout again. I did not run the soak, because nothing changed.
- **Recommend a playtest** after the change: the first card now takes 20 matches, which is a feel question.

## How to repeat this

```
# play the careers (4 at once; each takes about 4 minutes)
for i in 0 1 2 3; do npx tsx scripts/analysis/starPassByAge.mts 40 $i/4 shard$i.json & done; wait
# print the tables and the retune options
OPTIONS=1 npx tsx scripts/analysis/starPassAggregate.mts shard0.json shard1.json shard2.json shard3.json
```

Scripts: `scripts/analysis/starPassByAge.mts` (plays the careers), `scripts/analysis/starPassAggregate.mts` (tables and re-pricing). Neither changes any game file.
