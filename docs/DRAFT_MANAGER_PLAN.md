# Draft: Manager mode and watching matches — plan (Leo, 27 Nov 2026)

Leo: "I'd LOVEEEE a more football manager or football chairman style … more
involved in everything and watching games or commentary … when u play a
friend in the online mode it should defo be more detailed and slow … or even
do all that for finals too. or maybe just let user decide."

## Built now (behind the New look switch)
- **Match Centre** (`components/draft/MatchCentre.tsx`, `lib/draft/matchTimeline.ts`):
  scoreboard, clock, commentary, ~45 s a match, Skip. Tells the result the
  season already made; never re-simulates, so watching changes nothing.
- **Watch the big games** under every season: finals and your biggest win.
  The player decides what to watch.

## Next: friend matches (one round)
- In a room, each head-to-head between friends gets a **Watch together**
  button: both screens play the same Match Centre at the same moment
  (the room already shares the season; add a start time to the room row).
- Cup finals between two friends play automatically in the Match Centre;
  "Skip" stays (the user decides).
- The commentary names both squads' players (both lineups are in the room).

## Then: Manager mode (a new mode, not a new rule set)
"Draft" stays the quick game. **Manager** is the long one, sharing the same
players, simulator and Match Centre, so nothing is built twice.

| Week to week | What you do |
|---|---|
| Before a match | Pick the XI and formation (SquadManager already does this), set a mentality: Defend / Balanced / Attack (small, measured shifts to the simulator's attack and defence) |
| The match | Watch it in the Match Centre, or Quick result. At half-time: one change (sub or mentality) that changes the second half |
| After | Table, form, injuries (from fitness), player morale |
| Transfer windows | Summer and January: bid for players from any club-season you have unlocked, sell, loan; a budget from finishing position and cups |
| Chairman layer | Board targets (top 4 / avoid relegation), ticket prices and stadium (small income), sack-or-stay at the end of a season |

Build order (each its own patch note, behind the switch):
1. Match by match season (38 weeks you step through; the season sim already
   plays week by week, `allFixtures`).
2. Half-time change + mentality (simulate each half separately).
3. Transfer windows with a budget.
4. Board, money, the chairman screens.
5. Records: Manager mode gets its own Hall of Fame (like Chemistry).

Measured before each step: the season simulator's numbers must not change
for the quick Draft (a test pins them).
