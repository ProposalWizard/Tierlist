# Dribbling — real take-ons vs the game (gameplay round v0.15, 11 Oct 2026)

## Real football (the target)

| What | Number | Where it comes from |
|---|---|---|
| Take-on success, whole league | about 45–50% | Opta "successful take-ons" / FBref "Take-On success %", Premier League seasons since 2017. From memory of the public tables, not fetched this session. |
| Take-on success, elite dribblers | about 60–65% | Same tables: the best high-volume dribblers (Messi, Hazard at his peak, Doku, Saint-Maximin) sit around 55–65%. |
| Take-ons ending in a foul | roughly 1 in 8–10 | Reasoned from fouls won per 90 vs take-ons per 90 for wingers (about 1.5–3 fouls won against 4–8 take-ons). An estimate. |
| How a defender defends 1v1 | jockey goal-side, back off, show you one way (outside), stab only when close | Coaching material (FA / UEFA B-licence 1v1 defending). Qualitative. |
| Human reaction to a cue + a phone swipe | about 0.3 s | Simple visual reaction ≈ 0.2–0.25 s, plus the flick being recognised. Used for the bot. |

## How it is measured

`tests/star/dribbleDuels.mts`: a human-like bot plays 1,500 seeded runs per row
against defenders with defending 60–85. It reacts to what is on screen after
0.30 s ± 0.08 and goes the wrong way 12% of the time; it tries a feint on about
60% of men. A **take-on** = the man who took you on, was square on you (within
1.6 m across), and reached you. Fouls are not counted as won.

## Before (today's duel, 2,000 runs a row)

| | take-ons won |
|---|---|
| human (0.25 s) | 75–77% |
| perfect timing | 72–78% |
| slow (0.40 s) | 36–37% |
| **blind random swipes** | **42–44%** |
| pace 40 → 100 | 75.4% → 75.6% (pace did nothing) |
| dribbling | not in the game |

So: you did not really have to time anything, and stats did not count.

## After (Settings → Gameplay → Dribble duels: New)

| | take-ons won |
|---|---|
| dribbling 30 / pace 50 | 29.7% |
| **dribbling 60 / pace 70 (average)** | **46.0%** (target ~50) |
| **dribbling 92 / pace 88 (elite)** | **65.7%** (target ~65) |
| pace 40 → 95 (dribbling 60) | 43.9% → 50.1% |
| perfect timing | 89.9% |
| slow (0.5 s) | 18.6% |
| blind swipes | 18.0% |
| no feints (burst only) | 40.8% |
| fouls | 11.6% of take-ons (elite 8.0%) |
| runs cleared | 19.3% (elite 38.3%); 18.2% end in a free kick |

Old: duels off is fingerprinted identical to the code before (sha256 over 600 seeded runs).

## What changed
- Defenders: close → **jockey** (back off at 70% of your speed, stand 0.6 m across you, show you outside) → plant (the tell, 0.23 s at defending 0 → 0.11 s at 100, world slowed) → tackle. One man takes you on at a time; the rest of his wave cover 6.5 m behind; the next wave drops off with you.
- Moves: tap a side = drop of the shoulder; swipe down = step-over (sells better, slower); flick = knock it past; a flick towards the middle from out wide = cut inside (sharper). A feint that bites leaves him leaning for 0.3–0.55 s; go the other way and he is gone. A feint he reads makes him step in sooner.
- Too early (he is balanced): he steps in and goes with you. Too late: a burst after a share of his tackle (5% at dribbling 0 → 60% at 100) is mostly wasted.
- Stats: dribbling = feints sell, later bursts still work, fewer heavy touches (13% × (1−d)^1.3). Pace = how far a knock-on goes and whether a narrowly beaten man gets back.
- Fouls end the run with a free kick (yours if you are on them).
- Runs are shorter with duels: 2–3 waves of 1–2 men (5 at most); clearing having beaten 4 = top reward.
