# Injuries revamp: a plan for Mikey to say yes or no to

Written 22 Oct 2026 for Mikey. Plan only, no code. Roadmap item 11 (`STAR_ROADMAP.md:55`).
Tags: **[code]** = number read from the code today. **[proposal]** = my suggestion, you decide. **[reasoned]** = worked out on paper, not measured.

Reply with letters, like "1a yes". Questions are in section 10.

---

## 1. What exists today, and why it is off

You switched injuries off on 4 Oct 2026: *"take injuries out of the game right now. They will be added in later, once a revamp has happened"* (`lib/star/injurySwitch.ts:1-4`). That quote is the only reason on record. I found no bug behind it.

The old system is still all there, ready to switch back on:

| Part | Where | What it does today [code] |
|---|---|---|
| The switch | `injurySwitch.ts:7` | `INJURIES_ON = false` |
| The roll | `careerFlow.ts:827-831` | One roll at full time, once per match you play |
| The chance | `careerFlow.ts:102-112` | 1.5% base, plus up to 8.5% more as end-of-match energy falls below 30 |
| The length | `careerFlow.ts:118-130` | 60% knock (1-2), 30% injury (3-4), 10% serious (5-8) |
| The countdown | `careerFlow.ts:2347` | Drops by 1 for each fixture you miss |
| Who plays | `selection.ts:200-206` | Injured = "Injured", cannot be picked |
| The screen | `MatchdayScreen.tsx:427-433` | Red box with the note and weeks left |
| Old saves | `storage.ts:411` | While off, a saved injury is wiped on load |
| Match radar | `matchRadar.ts:136-139` | Same full-time check for the unseen match |
| Tired hook | `selection.ts:427` | "Legs gone, withdrawn before you get injured" |

Today's chance is about 1.5% to 2% a match **[reasoned]**: that is about 1 injury per 50 to 65 matches. Too rare to feel.
Not there today: no feed posts about injuries (the feed has no injury detector, `lib/star/media/detect/`), no moment in the match, no rehab choice, no comeback period.

Note: "weeks" in the code really means fixtures missed. A midweek cup game counts as one.

## 2. Kinds of injury and weeks out

| Kind | Share [proposal] | Weeks out [proposal] | Average |
|---|---|---|---|
| Knock | 45% | 1 | 1 |
| Strain | 35% | 2 to 4 | 3 |
| Tear | 17% | 6 to 10 | 8 |
| Long one (rare) | 3% | 12 to 20 | 16 |

Average = 0.45 + 1.05 + 1.36 + 0.48 = **3.3 weeks per injury** [reasoned]. Today's average is 2.6 [code].
At 1 injury per 20 matches and about 50 matches a season, that is 2.5 injuries and about 8 weeks out a year: roughly 1 week in 5. That is a lot. See question 2.

## 3. Risk from tiredness, and from too many matches

The chance per match, by your energy at the moment it is rolled. Today's energy numbers [code]: a full Medium match costs 60, you regain 8 a day resting, a tired starter below 65 cannot start.

| Energy | Today [code] | Proposed per match |
|---|---|---|
| 70 to 100 | 1.5% | 2.0% |
| 50 to 69 | 1.5% | 3.5% |
| 30 to 49 | 1.5% | 5.5% |
| 15 to 29 | 1.5% to 6.9% | 9.0% |
| under 15 | up to 10% | 14.0% |

Many matches in a short time **[proposal]**: the 3rd match in 7 days adds +2 points; the 4th adds +4. This would count cup and international games. It also makes the "rotate or rest" choice matter.

## 4. Going down in the match

What you see **[proposal]**:

```
 minute 63 ──► play stops ──► "You're down" banner ──► physio runs on
          ──► short pause (about 3 s) ──► "Subbed off: [kind], out N weeks"
          ──► you keep watching from the bench, score carries on
```

How: the match picks a minute at kick-off from the match seed (between 20 and 88). At that minute the game reads your live energy and rolls once, using the table in section 3. This keeps the same result on a replay. If you are hurt, you leave the pitch and your minutes are cut to that minute (the stats already carry minutes).

Which file: only `components/star/CanvasMatch.tsx` changes, and only lightly: one "stop and show" step beside the existing withdraw step. The match physics do not change. **The engine-warning hook will ask** (this file is in its list), and I would say so in the reply (`PRO-ENG-001`). Most of the work sits in `selection.ts`, with a new reason "injury".
The unseen match keeps its full-time roll (`matchRadar.ts`), on the same table.

## 5. A rehab choice

When you are hurt, Home offers two buttons **[proposal]**:

| Choice | Weeks out | Risk | Comeback |
|---|---|---|---|
| Full rest | all of them | none | Energy cap 75 / 85 / 95 for 3 matches |
| Rush back | half (round up, at least 1) | 20% it flares up in your first match back (then a new injury, one kind worse, 1 extra week) | Energy cap 60 / 70 / 80, and injury chance x1.5 for 3 matches |

Example: a 4-week strain. Rest = 4 weeks, safe. Rush = 2 weeks, 20% chance of a 6-week tear. Expected: 2 + 0.2 x 6 = 3.2 weeks [reasoned]. So rushing is faster on average, but you can lose a big game to it.
Knocks (1 week) have no choice; there is nothing to rush.

## 6. Coming back below full fitness

After any layoff of 3 weeks or more, your first 3 matches back are at lower energy caps (section 5 numbers) **[proposal]**. Match sharpness (`matchFitness`, today 20 to 100 and already falls when you miss fixtures, `careerFlow.ts:2343`) starts at no more than 70 after a 3+ week layoff and climbs +3 a match as it does today (`careerFlow.ts:1190`). The Matchday screen shows a small "Match fit 2 of 3" pill next to the tired pills (`MatchdayScreen.tsx:398`).

## 7. Feed posts

Today there are none **[code]**. Proposed, one new detector, `detect/injury.ts` **[proposal]**:

| Account | Posts |
|---|---|
| Your club | "Update on [you]: [kind], expected back in N weeks" |
| Press / journalist | "Scan results: [tear]. Out around N weeks." (for tears and long ones only) |
| Your fan account | Worried reaction; welcome-back post on return |
| Rival fan | A cheeky post on a tear or long one |
| Stats account | "First game back after N weeks" |
| Manager | One line at the press talk: "We'll be careful with him." |
| League account | Nothing (keeps it quiet) |

A flare-up after a rush gets a press post: "Rushed back too soon?".

## 8. Target: about 1 injury per 20 matches (5%)

The arithmetic **[reasoned, mix of energy bands is my guess, not measured]**:

| Energy band | Share of matches (guess) | Chance | Contribution |
|---|---|---|---|
| 70 to 100 | 25% | 2.0% | 0.50 |
| 50 to 69 | 35% | 3.5% | 1.23 |
| 30 to 49 | 25% | 5.5% | 1.38 |
| 15 to 29 | 12% | 9.0% | 1.08 |
| under 15 | 3% | 14.0% | 0.42 |
| **Sum** | | | **4.6%** |
| Short-gap extra (20% of matches, +2) | | | +0.4% |
| **Total** | | | **5.0%, 1 in 20** |

How we measure it for real: copy `scripts/soak/careerSoak.mts` (20 seasons x 21 careers = about 20,000 matches in about 85 s [code comment]) into a new `scripts/soak/injurySoak.mts`. It switches injuries on, counts injuries per match and weeks out per season, per energy band, and checks 4.0% to 6.0%. Add a rule test `tests/star/injuries.mts` (kind shares, weeks ranges, rush maths, comeback caps, same result on replay). If the soak says 3% or 8%, I change the table in section 3, not the target.

## 9. Which files change

| File | Change | Size |
|---|---|---|
| `lib/star/injurySwitch.ts` | Switch to true when you say go | small |
| `lib/star/careerFlow.ts` | New chance table, kinds, countdown by fixture, rush, comeback caps | medium |
| `lib/star/selection.ts` | Hook reason "injury" at the rolled minute | small |
| `components/star/CanvasMatch.tsx` | Stop-and-show moment, sub off (engine warning) | medium |
| `components/star/MatchdayScreen.tsx` | Rehab buttons, "match fit" pill | medium |
| `lib/star/types.ts` | Add fields: kind, rushed, comeback count (add only) | small |
| `lib/star/storage.ts` | Fill the new fields for old saves; stop wiping | small |
| `lib/star/media/detect/injury.ts` (new) + template files | The posts in section 7 | medium |
| `lib/star/tuning.ts` | The numbers become tuning rows | small |
| `scripts/soak/injurySoak.mts`, `tests/star/injuries.mts` (new) | Measurement | small |

**Stays untouched:** match physics and AI in `canvasEngine.ts`, `hiddenMatch.ts`, suspensions in `corruption.ts` (they share the same slot and keep working), the old-UI folder `components/star/legacy/`, `app/star-dev/page.tsx` (only if a new phase is needed; I expect none).

## 10. Questions for Mikey

Reply with letters, e.g. "1a yes, 2b".

1. **Go ahead with the whole plan?** a) yes, build it in steps below. b) no, keep injuries off.
2. **Target 1 injury per 20 matches (about 1 week in 5 out)?** a) yes. b) lower it to 1 in 30 (recommended if you do not want to miss games often). Recommended: **b**. My arithmetic says 1 in 20 costs about 8 weeks a year.
3. **Kinds and lengths from section 2?** a) yes. b) no long one. Recommended: **a**.
4. **Fatigue table from section 3 plus the "3rd match in 7 days" extra?** a) yes. b) fatigue only. Recommended: **a**.
5. **Injury moment inside the match (touches CanvasMatch, engine warning)?** a) yes. b) no, keep it at full time as today, with a banner. Recommended: **a**.
6. **Rehab choice with the 20% flare-up?** a) yes. b) full rest only. c) rush at 30% flare-up. Recommended: **a**.
7. **Comeback caps for 3 matches?** a) yes. b) no. Recommended: **a**.
8. **Feed posts from section 7?** a) all. b) club and press only. Recommended: **a**.
9. **Build order?** a) all in one go. b) 1: table + kinds + soak, 2: match moment, 3: rehab + comeback + feed (recommended), each shown to you first. Recommended: **b**.
10. **Playtest at the end?** Per your standing rule I will not run one unless you ask. Recommended: yes, one, after step 2, because the moment in the match is something only your eyes can judge.
