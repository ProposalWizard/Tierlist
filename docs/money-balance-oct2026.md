# Money across a whole career — October 2026

STAR_ROADMAP.md #3: "Money balance after Sponsors. Wages were set on 21 Sep,
before weekly sponsor fees and the new shop prices. Check money across a whole
career."

**Measured, not seen.** Every number here comes from a 20-season simulator
that runs the real career code. Nobody has played these careers on a screen.

## Verdict

- The bottom of the ladder works as designed: National League money is a slog
  (★25 a week, first boots 15 weeks away).
- One real bug, fixed: contract renewals ignored the ★100,000 wage cap. A star
  reached ★271k a week. The save guard calls that an edited save.
- Three things need an owner's decision (options below): renewals still
  compound with no club ceiling, sponsor renewals compound the same way,
  and a KIB can costs 2 weeks' wage at every level of the game.

## How it was measured

`npx tsx scripts/money-sim/sim.mts` (add `--before` for the game before the
fix, `--club-cap` for proposal 1A). Seeded, so the same every run.

It drives the real code: signing (attachClub), every fixture (finaliseMatch →
creditMatchResult, or simulateMissedFixture when he is not picked),
advanceSeason, the real sponsor deals (offers arrive, he signs every one),
transfers at the real offer wage (offerWageFor) and signing-on fee, and real
renewals (+8% a right guess; the sim assumes **2 right guesses** a renewal,
when the contract runs out and whenever the club offers early). Prices are the
real catalogue and the real can price.

What the sim decides for itself (a "typical" player, stated so it can be
argued with):

| Choice | Rule |
|---|---|
| Career path | Fixed per shape (table below). Skills climb in a straight line; training is not simulated. |
| Plays | Average 85% of fixtures, good 93%, star 97%. Rating 6.7 / 7.1 / 7.8. |
| Boots | When a pair runs out: the best pair costing at most half the bank and 6 weeks' wage. |
| Cans | One Basic can every 5th match played, if under a quarter of the bank. |
| Lifestyle | Every 4 weeks: keep 4 weeks' wage back, spend half the rest on the cheapest next level. |
| Not in it | Casino, investments, club ownership, dilemmas (switched off in the game). |

| Shape | Path |
|---|---|
| Average | National League s1–3 → League Two s4–8 → League One s9–13 → mid Championship s14–20 |
| Good | League Two s1–2 → League One s3–5 → Championship s6–8 → Brentford (mid PL) s9–20 |
| Star | League One s1 → Championship s2–3 → mid PL s4–6 → Liverpool s7–20, 5 Ballon d'Ors |

## The headline numbers (after the fix)

Bank balance at the end of the season. The bank is low on purpose: the
typical player spends. "Shop" is the share of the 186 shop items (35 boots,
151 lifestyle) priced at or under that one season's income.

| Shape | Season 1 | Season 5 | Season 10 | Season 20 |
|---|---|---|---|---|
| Average — wage | ★25 | ★84 | ★162 | ★1.4k |
| Average — bank | ★153 | ★1.3k | ★3.1k | ★17k |
| Average — shop | 14% | 33% | 46% | 72% |
| Good — wage | ★77 | ★276 | ★13k | ★33k |
| Good — bank | ★879 | ★4.0k | ★129k | ★460k |
| Good — shop | 32% | 54% | 83% | 92% |
| Star — wage | ★277 | ★13k | ★53k | ★100k |
| Star — bank | ★2.4k | ★190k | ★1.19m | ★5.57m |
| Star — shop | 51% | 85% | 94% | 98% |

Shop share by item level (1 = cheapest version, 5 = top), priced under one
season's income:

| Shape | Season 5 (L1–L5) | Season 10 | Season 20 |
|---|---|---|---|
| Average | 61 · 59 · 30 · 14 · 0 % | 84 · 70 · 35 · 24 · 14 % | 100 · 100 · 81 · 49 · 30 % |
| Good | 84 · 84 · 59 · 30 · 14 % | 100 · 100 · 89 · 68 · 59 % | 100 · 100 · 100 · 84 · 76 % |
| Star | 100 · 100 · 97 · 70 · 59 % | 100 · 100 · 100 · 86 · 84 % | 100 · 100 · 100 · 100 · 89 % |

Where the money comes from, whole career:

| Shape | Career income | Wages | Goal/assist bonuses | Sponsors | Other (signing-on, loyalty, appearance) | Spent on boots / cans / lifestyle |
|---|---|---|---|---|---|---|
| Average | ★561k | 73% | 2% | 15% | 11% | ★108k / ★146k / ★290k |
| Good | ★12.8m | 85% | 4% | 10% | 1% | ★995k / ★4.80m / ★6.58m |
| Star | ★83.1m | 56% | 8% | 34% | 2% | ★2.29m / ★26.8m / ★48.4m |

What reads right:

- **The slog is real.** National League ★25 a week; the first boots (★365) are
  15 weeks. Average never has more than about ★4k in the bank for 13 seasons.
- **No double payments found.** Wage, sponsor fee, bonuses and target money
  each arrive once a week; replays pay nothing (careerInvariants.mts).
- **Bonuses are small** (2–8% of income), as `TOTAL_INCOME_SHARES` intends.
- **Boots are cheap at the top** (1–3% of a good or star player's income):
  durability-from-price works.

## The fix (built, tested)

**Renewals now stop at the ★100,000 wage cap** (`renewalWage`, economy.ts;
used by the renewal screen, SecondaryScreens.tsx).

The renewal screen added 8% a right guess to the wage you already have. It
compounds, and it never read `PREMIER_WAGE_CAP`. The cap is the owners' own
number ("capped at 100,000… for the best of the best") and saveGuard.ts uses
it as the limit of a legal save, so honest play produced a save the guard
flags (or, with `STAR_SAVE_GUARD=enforce`, puts back).

| Star at Liverpool | Before | After |
|---|---|---|
| Wage, season 15 | ★129k | ★100k |
| Wage, season 20 | ★271k | ★100k |
| Career income | ★108.8m | ★83.1m |
| 38 weekly asks from ★29k | ★540k a week | ★100k |

A wage already over the cap (an old save) is kept, never cut. Below the cap
the raise is exactly as before. Test: `tests/star/moneyBalance.mts`.

## Top 3 problems still open (for Harry / Mikey — not changed)

### 1. Renewals have no club ceiling

You can press **Propose renewal** any week once your star rating is 3 or
better (`willingToRenegotiate`). Each one compounds 8% a right guess. The cap
above stops it at ★100k, but not before: a National League player could, in
principle, renew his way to ★100k a week with no move at all.

Measured on the honest path (2 right guesses, only when the contract ends or
the club offers): the good player at Brentford earns ★33k a week by season 20.
Brentford's own star wage (`weeklyWageFor`, standing 1.0) is about ★15.6k
before honours. Renewals alone doubled it.

| Option | What changes | Good, wage s20 | Good, career income | Star, career income |
|---|---|---|---|---|
| A (recommended) | A renewal also stops at the club's own star wage (`weeklyWageFor(club, division, 1.0, career)`) | ★21k | ★9.6m (−25%) | ★69.5m (−16%) |
| B | A + one player-asked renewal a season | same as A on this path; stops the weekly-ask exploit | — | — |
| C | Leave it | ★33k | ★12.8m | ★83.1m |

(A measured with `--club-cap`. B is a rule on the button; the sim never spams it.)

### 2. Sponsor renewals compound too, and new wages never reach old deals

A deal's weekly fee is fixed the day you sign it. A happy renewal adds 15–30%
to the OLD fee (`brandsAfterSeason`); it never looks at your wage now.

| Case | Deals pay now | A fresh deal set would pay (`fairWeekly`) |
|---|---|---|
| Star, season 20, ★100k wage | ★99k a week — the whole wage again | ★42k (the file's own note says "★20–40k") |
| Good, season 15, ★24k wage | ★3.4k a week | ★16.7k |

So at the top, sponsors (★4.4m a season) out-earn the wage (★4.2m); one
promotion later they are pocket money because they were priced at
Championship wages. (Fair figures worked out from `fairWeekly`, not played.)

| Option | Renewal fee |
|---|---|
| A (recommended) | `fairWeekly` today × the mood multiplier (1.15–1.30 happy, 0.85–1.1 on the fence) |
| B | max(old fee, today's fair fee) × mood, capped at 1.3 × fair |
| C | Leave it |

### 3. A KIB can costs 2 weeks' wage at every level

`KIB_CAN_WAGE_WEEKS = { basic: 2, premium: 1, elite: 2 }` (Mikey, 6 Oct). Two
things follow:

- The **Basic** can (+65 energy) costs **twice the Premium** (★50 vs ★25 in
  the National League; ★200k vs ★100k at ★100k a week). Worth checking that
  is meant.
- At one can every 5 matches, cans are **39% of the good player's spending**
  and 35% of the star's — more than boots by 5–12 times. A Basic can at ★100k a
  week (★200k) costs more than a level-3 car (★10k–77k).

| Option | Basic / Premium / Elite (weeks of wage) |
|---|---|
| A | 0.5 / 1 / 2 (the 5 Oct order, cheapest first) |
| B | 1 / 1 / 2, and cap any can at ★25k |
| C | Leave it |

## Smaller things noticed

- **The Championship → Premier League step is ×10 in one summer** (good
  player: ★1.3k → ★13k a week; season income ★110k → ★650k; shop share 73% →
  85%). That is `DIVISION_STEP_INTO.premier = 5.5` × the club factor. It is
  the agreed design (so a career can buy a club), noted only because every
  level-1–3 item becomes pocket money that same week.
- **The average career can never reach 32 of 186 items** even with all 20
  seasons of income (★561k): the level 4–5 cars, jets, homes and island.
  Level 5 items run ★5m–11m. Fine if those are meant for Premier League
  careers only.
- **Achievements "Comfortable Living" (save ★100) and "Wealthy" (save ★500)**
  unlock in the first season or two of any career. Out of this lane
  (achievements.ts); flagged for whoever does roadmap #4.

## Files

- `scripts/money-sim/sim.mts` — the simulator (`--before`, `--club-cap`, `--json`)
- `lib/star/economy.ts` — `renewalWage`, `renewalMultiplier`, `RENEWAL_RAISE_PER_WIN`, `RENEWAL_SOURED_CUT`
- `components/star/SecondaryScreens.tsx` — the renewal screen uses them
- `tests/star/moneyBalance.mts` — the cap, and the simulator runs end to end
