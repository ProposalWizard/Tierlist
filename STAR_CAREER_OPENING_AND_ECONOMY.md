# The Career Opening & Economy Rework — Plan (v2)

> **Status: PLAN ONLY. Nothing here is built.** Written 17 Sep 2026.
> **v2** — rewritten after an adversarial review found several things in v1
> that were arithmetically impossible. Those are recorded in §13 rather than
> quietly deleted, because the mistakes are instructive.
> Read this whole file before starting any of it.

---

## THE GOVERNING RULE — we add, we do not change

**Raised by Mikey, and it overrides everything else in this document.**

> **We are not changing gameplay. We are only ever adding to it.**

In particular: **the trial uses the current gameplay system and the current
physics.** It is not a separate mini-engine with its own feel. Every strike
goes through the same `launch()` / `stepBall()` / `stepKeeper()` the real match
uses, with the same aim-and-power gesture, so what you learn in the trial is
literally what you do on a Saturday.

Forbidden: retuning the match engine, keeper, finishing rates or curl; editing
how an existing drill or screen behaves; "while we're in here" refactors of
shared gameplay code.

**§11 names every item here that is genuinely a change rather than an addition.**

---

## 0. In one paragraph

Today: you type a name, **pick your own club**, take **one penalty you cannot
fail**, and a contract you never see is signed for you. Every player at every
club starts on the **same ★2,000 wage** with the same ★5,000 — and the cheapest
shop item is ★6,000, so day one has nothing to buy. This plan replaces that with
a **real multi-stage trial you can fail**, **clubs that scout you** on how you
did, a **contract you negotiate**, **wages that reflect the club paying them**,
and a **shop that works at both ends** of a career.

---

## 1. The five problems

1. **The trial doesn't matter.** Cannot be failed, reads hardcoded skills of
   62/62 instead of yours, and `onScored` takes no arguments — no score leaves
   the component. It is a cutscene.
2. **Every career is identical at birth.** Same wage, same money, same
   reputation.
3. **Wages ignore who's paying them.** See §4 — the real fault is subtler than
   v1 claimed.
4. **The shop is wrong at both ends.** Nothing below ★6,000; and the top is
   calibrated to a ★2,000 wage that this plan multiplies.
5. **Most shop items don't do anything distinct.**

---

## 2. What already exists

| We need | Exists as | State |
|---|---|---|
| Penalty stage | `TrialPenalty.tsx` | On the live engine already. Cannot be failed |
| Difficulty ladders | `lib/star/trainingDrills.ts` | **Done** — pure `(level, rep) => config` |
| Dribbling stage | `FirstPersonDribble` + `pickWaveSizes()` | **Ready** — `embedded` mode, needs no change |
| Negotiation + mood face | `negotiation.ts` + `NegotiationScreen.tsx` | Works; single-scalar only (§5.3) |
| Manager targets | `SponsorObjective` + `makeObjective` | Already speaks "start 27 matches in a row" |
| Club quality data | `CLUB_DATABASE` | Real, all 125 clubs — but see §4.1 |

Genuinely absent: a small-sided match; any league below the Championship
(**Mikey's lane**, §8); a career with **no club at all** (§3.7).

---

## 3. The new opening

### 3.1 Career creation — split it, don't defer it

**v1 proposed a parallel `TrialRun` object. That is now rejected.** Review
found a third option that is strictly less risky:

> **Split `makeInitialCareer` into `makeIdentity(player)` and
> `attachClub(state, club, clubs, division)`.**

Roughly 40 of ~55 fields — skills, relationships, reputation, money, cans,
sponsors, week actions — are club-independent. Only league, fixtures, kits,
squad, manager, squad number, European qualification and cups need a club.

So during the trial a **real `CareerState` exists** with `club: ""` and
`fixtures: []`. Every existing consumer keeps working against a real object.
A parallel `TrialRun` type would have needed its own storage key, its own cloud
sync, its own backfill, its own slot lifecycle and its own save-summary
handling — four places it would have been forgotten.

#### The resume path — v1 was wrong about this

v1 said "add the trial phases to `RESUMABLE`." **That alone does nothing.**
`loadCareerIntoState` bails at `page.tsx:1208`:

```ts
setCareer(saved ?? null);
if (!saved) { setPhase("profile-setup"); return; }
```

`loadStarPhase` isn't read until ~70 lines later. With no career, load always
returns early and dumps you on ProfileSetup regardless of `RESUMABLE`.

The `makeIdentity` split fixes this almost for free — there **is** a saved
career during the trial, so the early bail never fires. Still required: add the
trial phases to `RESUMABLE` (`storage.ts:147`), and **fix `relegation-move`
while we're there** — it has the same bug today.

#### What else must be handled (measured, not guessed)

- **Autosave**: the cloud-save effect (`page.tsx:280`) returns early on a null
  career. With a real identity career it saves normally — this is the single
  biggest argument for the split. A trial started on a phone survives to a
  laptop.
- **`handleStartNewInSlot`** (`page.tsx:1336`) doesn't touch localStorage —
  it only calls `setCareer(null)`. With the split there's nothing orphaned.
- **`listSaveSlots`** (`storage.ts:402`) must summarise an in-progress trial as
  something other than "Empty", or Settings invites you to overwrite it.
- **Render fall-through**: `page.tsx:1939` is
  `if (phase === "profile-setup" || !career)`. Trial routes go **above** it,
  and the `&& career` guards at `:1924`/`:1928` come off.
- **Prefetch**: today's four squad fetches start when you pick a club and use
  the trial as cover. That window moves — prefetch the **candidate clubs**
  (3–4) at the offer screen instead.
- **`ProfileSetup` step 2 is deleted entirely.** Its `/api/draft/clubs`
  availability filter must move into the offer generator, or you can be scouted
  by a club with no squad in the database.

### 3.2 The four stages

**Cut from five to four for v1.** The small-sided game moves to §3.5.

| # | Stage | Built from | Score from |
|---|---|---|---|
| 1 | Penalties | `TrialPenalty`'s pattern, made failable | Goals/attempts, placement |
| 2 | Free kicks | Live engine + `freeKickDrill()`'s numbers | `shotQuality()` |
| 3 | Dribbling | `FirstPersonDribble` (`embedded`), **unmodified** | `{ cleared, beaten }` |
| 4 | Vision / passing | Live engine + `visionDrill()`'s numbers | Correct picks under the clock |

**Difficulty numbers** come from the drill ladders (pure functions, reading them
changes nothing). **Behaviour** comes from the live match engine — never from
`TrainingMinigame`'s components, which still use the stale aim constants
(`MIN_PULL = 0.04`) the real match moved away from. This keeps the trial
feeling like the game and keeps us out of a 972-line file Mikey may be in.

**New plumbing this needs (v1 assumed it existed):** the existing drills report
`onFinish(xp)`, and `qualitiesToXp` collapses per-rep quality into a floored
number — a bad performance and a terrible one both read as 3. **The stages need
to report the raw quality values, not XP.**

### 3.3 Difficulty, and how it counts

Difficulty is rolled per trial and per stage, and **how hard it was feeds the
rating** — not just whether you scored. A converted hard chance beats a
converted tap-in; a missed hard chance costs less than a missed easy one. The
score is *performance relative to what was asked*.

**Everything random must be seeded and stored** — the trial's base difficulty,
each stage's roll, the adversity event, and the scout offers. Otherwise a
refresh re-rolls them and players farm for an easy trial.

### 3.4 Adversity — ship exactly one

v1 listed six events. **Two of them had no plumbing at all** — neither
`TrialPenalty` nor `TrainingMinigame` passes `conditions` to any engine call, so
"heavy pitch" is new plumbing in two components, and `visionDrill` computes its
window internally with no parameter to turn.

**v1 ships one: "the keeper is better than he should be" (+15 keeper
strength)** — a single existing field. More can follow once the trial ships.

### 3.5 The five-a-side — wanted, and out of v1

**You've said you want this and aren't backing down. It is not dropped.**

But the review's argument is worth hearing: even the cheap version is a new
scenario-sequencing component, it's the *fifth* stage of a trial that already
has four, and it's the largest open question on the critical path.

**Recommendation: ship the four-stage trial, then add the small-sided game as
its own piece** — and when we do, build the *real* one (reduced squads, smaller
pitch) rather than the chance-run compromise. The rule book already carries a
`squadSize` field whose own comment admits it does nothing yet; that's its home.

**This is a recommendation, not a decision — see §10.**

### 3.6 Who scouts you

`trialScore` (0–100) drives a **new** `generateScoutOffers(trialScore, rng)`.

**v1 said the existing offer machinery was "reusable nearly as-is". It isn't.**
Every formula in `relegationOffers.ts` is career-shaped: it reads
`career.league`, `career.contract.wage`, `career.starRating`, and the offer card
compares each offer against your current contract. **During a trial there is no
contract to compare against.** What's reusable is the `TransferOffer` *type* and
the card's *layout*; the generator and its anchor formula are new work.

**No ceiling — handle the consequences instead.** A first draft proposed
capping a perfect trial at upper-mid Premier League, because an 18-year-old
with 40/40/40/40/30 skills at a top-five club is benched immediately by
`selectionFor`, and season-1 reputation (~22) means no summer offers — a career
stuck on a bench it cannot leave.

**Overruled, and the replacement is better.** Keep the tiny chance of signing
for a giant, and fix what happens next:

- **You are never a reserve.** Mikey, directly: *"I think you should never be a
  reserve, it's too boring."* The floor is a place on the bench every week.
- **Or you get loaned out.** A manager who rates your potential but can't play
  you sends you somewhere you will play. That is a real football career, and a
  far better story than a cap.
- **The wage follows your standing, not just the badge** — see §4.1a.

This turns the 0.1% outcome from a trap into the most interesting start in the
game.

### 3.6a Going out on loan — and loans already half-exist

Mikey's answer to the giant-club problem (§3.6) needs you to be loanable.
**Checked before costing it: loans are already a real, tested system in this
game** — just not for you.

What exists today, for AI squad and league players:

- `activeLoans` on `CareerState` — everybody currently out on loan, with parent
  club, loan club and the player's stable id.
- `returnLoansHome` — runs automatically at every season rollover and puts
  them back.
- `leagueLoanNews` — loan moves already reach the media feed as real stories.
- `tests/star/loans.mts` — real coverage, including that a borrowing club
  can't deal a player it's only borrowing.

What does **not** exist: the player character being the one loaned out. Every
one of those paths moves a `SquadPlayer` or `LeaguePlayer`; `career.player.club`
is only ever *read*, to know which club is yours.

So this is **new work on a real, tested foundation** rather than from scratch —
the data shape, the season-end return and the news story are all already there.
The genuinely new parts are: choosing the loan club, moving your own career to
it for a season, playing a real season in another club's fixtures, and coming
back with whatever you earned.

**Honest flag:** "play a season at a club that isn't yours" touches the league
and fixture model, which is the one area §8 reserves for Mikey. Worth agreeing
who builds it before either of us starts.

### 3.7 Failing the trial — the free-agent life

**DECIDED.** A bad enough trial means **nobody comes in for you.** No club, no
contract, **zero in the bank**, living at home, training alone.

The `makeIdentity` split (§3.1) is what makes this representable at all — a
free agent is exactly a career with `club: ""`. **The two stand or fall
together.**

#### The loop
Weeks pass. You train. Skills improve slowly with nobody coaching you. Trials
come up periodically — the same four stages, fully reused.

#### The two dangers
1. **It must not be an inescapable grind.** Trials earned from this state must
   be at **lower-tier clubs with a lower bar**, so the way back is *downward
   into the leagues* — which gets much better once Mikey's tiers land (§8).
2. **Zero money plus a shop is a dead screen.** With ★0 you cannot buy a ★150
   item. Either the free-agent life carries a small income (trial expenses,
   non-contract appearance money, a part-time job) **or** the shop is honestly
   closed until you sign. **Needs a decision (§10).**

---

## 4. Wages

### 4.1 Starting wage — the v1 formula was impossible

v1 proposed scaling by `currentReputation` alone, with a table claiming a rep-7
Championship club. **Measured directly against the data:**

| Division | `currentReputation` spread | Capacity | Training |
|---|---|---|---|
| Premier (20) | 13×6, 1×7, 1×8, 5×9 | 11,307–75,543 | 6–10 |
| Championship (24) | **all 24 are 5** | 10,120–62,500 | 5–8 |

So reputation alone gives **every Championship club an identical wage** — v1's
own problem #2 rebuilt inside the new system. v1's four target numbers were
also mutually unsatisfiable by one exponential (fitting the ends gives ★3,868
mid; fitting the middle gives ★603,000 top).

**The fix: blend the signals that actually vary, and normalise within the
division** so each tier uses its whole band:

```
raw(club)  = 0.45×currentReputation + 0.30×(capacity scaled to 0-10)
           + 0.15×trainingRating   + 0.10×youthRating
wage(club) = base × (top/base) ^ ((raw − divisionMin) / (divisionMax − divisionMin))
```

with `base/top` of **★4,500 → ★20,000** (Premier) and **★600 → ★2,500**
(Championship). **Computed against the real data**, not aspirational:

| | Top | Bottom | Distinct values |
|---|---|---|---|
| Premier | Man United ★20,000 | Bournemouth ★4,500 | 18 of 20 |
| Championship | West Ham ★2,500 | Lincoln City ★600 | 11 of 24 |

**Fallback:** clubs can be minted at runtime (`mergeClubs` in `clubPowers.ts`,
`customClubs.ts`) and won't be in the database. Fall back to `base` for the
division explicitly — never let `undefined` reach the arithmetic.

### 4.1a Your standing changes the wage too — Mikey's idea, and it's a good one

> *"Maybe you just earn less wage if you're at United and not a starter — so
> similar wage to a League Two or National League player."*

§4.1 prices the **club**. This prices **you at that club**, and the two multiply:

```
wage = startingWage(club) × statusFactor(yourStanding)
```

A benched sixteen-year-old at Manchester United is not on ★20,000 a week — he's
on a fraction of it, which lands him near a starting Championship player. A
first-teamer at the same club gets the full figure.

Why this is worth doing beyond realism:

- **It fixes the giant-club problem from the money side** at the same time §3.6
  fixes it from the football side. You can sign for United; you just aren't
  rich until you play.
- **It makes the Ballon d'Or harder to win early**, which Mikey called out
  directly as a goal — and it is currently far too easy to snowball.
- **It gives being dropped a real, felt cost**, which nothing in the game does
  today.

The hook already exists: `selectionFor` (`selection.ts`) already computes your
standing and status every week. Nothing new needs measuring — the number is
already there, it just never touches money.

**One thing to watch:** combined with §6.3's ★50 starting money, a benched
player at a big club is poor for a long stretch. That is probably the intended
feel, but it should be a deliberate choice rather than a surprise.

### 4.2 The real wage fault — v1 diagnosed it backwards

v1 claimed the ratchet traps a low-wage player. **Worked numerically, it
doesn't.** For a good season-1 player (3.5★, 15 goals, form 7.8, fame 40 →
reputation ≈ 66.6) moving up 16 strength points:

| Start wage | Ratchet part | Flat `rep×90` | Offered |
|---|---|---|---|
| ★750 | 1,017 (15%) | 5,994 (85%) | **★7,011** |
| ★2,000 | 2,712 | 5,994 | **★8,706** |
| ★20,000 | 27,120 | 5,994 | **★33,114** |

At a low wage the ratchet is nearly irrelevant — the flat term does 85% of the
work. **The real fault is that the flat term is capped**: reputation maxes at
100, so it can never exceed ★9,000 however good you are. And at the top the
same formula runs away, compounding every move.

**v1's "take whichever is higher" fix only ever pushes wages up** — it fixes the
underdog and accelerates the runaway.

**Correct fix: blend toward the paying club in both directions.**

```
offered = 0.15 × ratchet + 0.85 × clubAnchor(clubQuality, yourReputation)
```

**Set at 15/85 by Mikey**, up from a first-draft 35/65 — the club paying you
should dominate; what you used to earn is a minor influence, not a co-equal one.
He is right, and it makes the fix stronger: at 35/65 a lucky early ratchet still
followed you for several moves.

So joining a smaller club genuinely costs you money — which is the decision the
transfer screen exists to present, and which today it never does.

### 4.3 There is no Championship → Premier League route

**Not in v1 at all, and it undercuts the whole underdog premise.**
`generateOffers` iterates **your own division only**. The sole cross-division
path is relegation offers, gated on reputation ≥ 74 *and* a 35% roll, *and* only
when your club is relegated out of the Championship.

So a great trial that lands you in the Championship can only go up by being
promoted with the club. **If a Championship start is meant to be a real chosen
path, a cross-division summer window is required work** — a new mechanic, not a
formula tweak.

### 4.4 Wages become weekly

**Specified directly: paid at the weekend game if there is one, otherwise split
evenly across that week's games.**

Today the wage is added **once per match played** and **once per missed week** —
so a week with a midweek cup tie *and* a Saturday game pays **two full weeks'
wages**. Nobody has noticed. It scales with the wage, so §4.1 makes it much
worse.

| That week has | Wage paid |
|---|---|
| A weekend game | All of it, at that game |
| Only midweek games | Split evenly across them |
| No games | Once at the rollover (as now) |

The replay guards in `careerInvariants.mts` must keep holding: a replayed match
still never pays twice.

### 4.5 Clauses must be recomputed after negotiation

**v1 said clauses need no change because they're wage-multiples. That is true
today — and §5 breaks it.**

`releaseClause = wage × (14 + star×6 + …)` and the trigger test is
`wage × (8 + strength/100×55)`. Both derive from the same wage, so the
comparison is scale-invariant — a 10× wage changes nothing. ✅

**But clauses are computed when the offer is built.** Negotiate the wage up 30%
afterwards and the clause stays pinned to the old wage while the trigger test
uses the new one. Result: **the better you negotiate, the faster you get sold.**

**Fix: recompute clauses from the final agreed wage at the moment the contract
is committed, in one place**, with a test asserting the clause-to-wage ratio
stays in band after any negotiation.

---

## 5. Negotiating

### 5.1 First contract
After choosing an offer you negotiate it. Reuse `NegotiationScreen` with
`mode: "selling"` and the §4.1 fair wage as the anchor.

### 5.2 Later contracts
Today there is **no cooldown at all** — ask every week, nothing happens. Add a
`lastContractApproachWeek`; asking too soon or on bad form **worsens the opening
mood** rather than blocking. A walkout costs `relationships.boss`, which is 45%
of selection standing — so it shows up as being dropped, not as a number.

**Add the negotiation route alongside the existing card game first**, and retire
the card game only once negotiation is trusted. Note `contractRenewal.mts`
guards the current behaviour.

### 5.3 The multi-axis problem

**`negotiation.ts` is a single-scalar haggle.** Its state holds one number.
There is no representation of seasons, a status promise, or targets.

So §5.1's headline decision — *"worse money for a guaranteed place, or better
money for no guarantees"* — **is not expressible in the current engine.** Either:

- **(a)** extend the state into a multi-axis deal object (a real rewrite), or
- **(b)** agree the money first, then present the promise/targets as a separate
  beat afterwards (cheaper, weaker).

**Needs a decision (§10).** v1 asserted the feature without noticing the engine
can't hold it.

---

## 6. The shop

### 6.1 What's wrong

- **Nothing below ★6,000**, and you start with ★5,000.
- **`Boot.pace` is completely inert.** No `effectivePace` exists anywhere.
- **Lifestyle is degenerate at both ends.** It feeds four sponsor gates
  (25/40/45/60) and nothing else — and the **Diamond Rolex alone (62) clears all
  four**, making the other 26 items redundant *below* 60 as well as above it.
- **Happiness is near-dead** — one reader in the whole game.
- **Only the Horse Stable has a unique effect.** That's the template.

### 6.2 The principle

> An item earns its place if removing it would change how you play, not just
> how big a number is.

### 6.3 Two structural facts that reshape the cheap band

1. **Items are permanent one-time owns.** `handleBuyItem` refuses any `id`
   already owned. **Every consumable needs its own counter** on `CareerState`
   (the `kibCans` pattern), its own use action, and its own backfill. That is a
   system per item, not a hook.
2. **Starting money must scale too.** v1 never mentioned it. ★5,000 buys the
   whole proposed cheap band in one click-through. Scale starting money with the
   club alongside the wage, or the "early game" lasts one screen.

### 6.4 The cheap band, corrected

| Item | Price | Effect | Verdict |
|---|---|---|---|
| ~~Energy gel ★150~~ | **★1,500** | +8 energy | **Repriced.** At ★150 it was ★18.75/energy point against the Basic KIB Can's ★240 — **12.8× better**, obsoleting the entire can line and making the energy gate (which drives selection) purchasable |
| Strapping & tape | ★300 | Injury risk down N matches | Needs the `statBoost` countdown pattern **with a replay guard** |
| ~~Bus pass~~ (Mikey: *"what's a bus pass?"*) | — | **Already cut.** It was a proposed free-agent item — a cheap way to get an extra action in a week. `WEEK_ACTIONS` is a module constant; `startNewWeek()` takes no career. Changing it means signature changes in the two most replay-sensitive functions in the codebase. Highest risk on the list, disguised as the cheapest |
| Second-hand boots | ★800 | Weak stats, poor durability | Cheap and clean |
| Ice baths | ★1,200 | Better Rest regen | `REST_ENERGY` is read in **three** places that must agree, or the pre-match screen promises energy the match doesn't grant |
| Training aid (merged) | ★2,000 | Training XP up | **Video analysis and gym membership merged** — two items with identical mechanics failed §6.2's own rule |
| Physio | ★3,500 | Injury weeks tick faster | One line |
| Agent retainer | ★5,000 | Better negotiation opening mood | **Ships with §5, not before** — earlier it's a dead item |

### 6.4a Tiered items — Mikey's restructure of the whole catalogue

> *"Change the prices of the shop so they have 5 standards. So level 1 car maybe
> costs £500, then level 3 car maybe costs £7,500."*

Instead of 31 unrelated items, the shop becomes **item families with five
tiers each** — a car, a house, a watch, each climbing from something a
non-league trialist can save for to something only a Ballon d'Or winner owns.

This is the best single idea in the shop section, because it solves several
problems at once with one restructure:

- **It fills the empty 0–5,000 band naturally** — every family's tier 1 lives
  there, rather than us inventing a separate set of cheap items.
- **It fixes the top end at the same time** (§6.5), because every family's
  tier 5 can be priced against a late-career wage.
- **It gives a real sense of climbing** — the same object, visibly better,
  rather than a list of unrelated things.
- **It replaces "lifestyle value" as the only progression axis**, which §6.1
  showed is degenerate at both ends.

**On locking tiers behind level or seasons played** — Mikey's own observation is
the important one: *"you wouldn't be able to afford level 2 unless you reach the
next division anyway."* Affordability is already a natural gate. So:

- **Start with no explicit locks.** Price the tiers so the gate is money.
- **Add locks only where money alone doesn't bite** — and keep them to one
  simple rule (seasons played, or division), never a per-item unlock table.
  Harry's steer: *"don't want it too complex, just a feeling like you unlock
  stuff."*

Mikey also noted locking *"entices people to play more seasons"* and *"makes it
harder to win the Ballon d'Or early on"* — both real design goals, and both
better served by §4.1a's status-scaled wage, which slows early money without
adding any new rules at all.

### 6.5 The top of the shop needs repricing too

**v1 only patched the bottom.** Personal income scales with wage through five
paths (match wage, missed-week wage, appearance fee, loyalty bonus, and signing
fee paid straight into your money). A top-flight career's lifetime income rises
roughly **10×**. The shop's top does not: NS-Galaxy ★200,000, Private Island
★3,000,000. The "career-defining splurge" becomes a season-two purchase.

**A full-catalogue reprice is required**, and `tests/star/tuning.mts` pins three
of those prices deliberately — those assertions get updated, not worked around.

Knock-on: `buyStake` spends personal money on club equity, so 10× income brings
the whole ownership arc forward proportionally.

### 6.6 Settled catalogue decisions

- **`Boot.pace`: delete the column.** Wiring it would risk four measured test
  suites to make a display string honest. Not worth it.
- **Lifestyle: save it** — let it scale sponsor *fees* rather than only gate
  them (cheap fix), and give big-ticket items their own unlocks the Stable way
  (the good fix).

### 6.7 Three missed rescales
`sponsorPay` caps at **★5**; the retirement testimonial pays **~★250–500 for a
whole career**; `HorseRacing.tsx` holds an orphaned un-rescaled horse list
(dead code — just delete it).

---

## 7. What this must not break

- **Existing saves** — every new field optional and backfilled.
- **`tests/star/tuning.mts`** pins three shipped prices. Update deliberately.
- **`tests/star/careerInvariants.mts`** — a replayed match or week never pays
  twice.
- **`tests/star/contractRenewal.mts`** — will go red when the card game retires.
- **`tests/star/sponsorObjectives.mts`** — depends on the current `OwnedItem`
  shape.
- **`makeInitialCareer` is called directly by at least eight test suites.**
  Splitting it touches all of them.
- **Correction to v1:** `facilities.mts` does *not* prove a wall between club and
  personal money — it asserts one specific thing (stadium revenue). President
  wages already move club money into personal money by design.

### Tests to write
`startingWage` monotonic and bounded across all 44 clubs; clause-to-wage ratio
invariant after negotiation; identity-career round-trips through
save/load/clear/slot-switch; resume from every trial stage; **no-offers never
softlocks**.

---

## 8. Below the Championship — MIKEY'S LANE

Mikey is adding League Two and below as simulated clubs down to **National
League South**, and expanding the FA Cup to take them in.

**This plan must not touch the division model, promotion/relegation, the
calendar, match-week counts, cup slots or post-season.**

What we need from him: a club list and a way to ask how good one is. What we
must agree: whether a career can be **played** at that level or only **scouted**
from it. Until it can be played, offers stay Premier/Championship only.

His work makes §3.7's "the way back is downward" dramatically better — a failed
trialist climbing from National League South is a far better story than bouncing
at the Championship door.

---

## 9. Build order (reordered — v1's was wrong)

v1 claimed steps 1–5 were independently shippable. **They weren't:**
`startingWage`'s only consumer is the call site the restructure deletes, and the
cheap band depends on the negotiation that was scheduled after it.

| # | Step | Risk |
|---|---|---|
| 1 | Economy sweep (§6.7) + delete the fake "Pac" column | Low |
| 2 | Wages become weekly (§4.4) | Medium — changes existing saves |
| 3 | Clause recomputation invariant (§4.5) | Low, and a prerequisite for §5 |
| 4 | **`makeIdentity`/`attachClub` split + resume path** (§3.1) | **Highest** — lands alone |
| 5 | The four trial stages (§3.2–3.4) | Medium, lots of surface |
| 6 | Scout offers **+ `startingWage` + club-anchored wages** (§3.6, §4.1–4.2) | Medium — one system, ship together |
| 7 | Starting money scaling (§6.3) | Low |
| 8 | Negotiation, added alongside the card game (§5) | Medium |
| 9 | Full shop reprice + cheap band (§6.4–6.5) | Medium — priced against the wages that now exist |
| 10 | Free-agent life (§3.7) | **Highest** — depends on 4 |
| 11 | Cross-division summer window (§4.3) | Medium — new mechanic |
| 12 | Status-scaled wage (§4.1a) | Low — `selectionFor` already computes the input |
| 13 | Player loans (§3.6a) | Medium — real foundation exists; needs Mikey's agreement (§8) |
| 14 | Real five-a-side (§3.5) | Its own project |

**Note on 12:** it is listed late but is genuinely cheap, and it makes the
giant-club start work. If §3.6 ships without it, a benched sixteen-year-old at
United is on ★20,000 a week, which is the opposite of the intended feel. Pull it
forward if the trial lands first.

---

## 10. Decisions

### Made
| Question | Decision |
|---|---|
| Can you fail the trial? | **Yes, completely** — free-agent life (§3.7) |
| `Boot.pace` | **Delete the column.** Don't touch the engine |
| Wage labelled "/match" | **Fix it** — it's weekly (§4.4) |
| Lifestyle ladder | **Save it** (§6.6) |
| Career creation | **Split, don't defer** (§3.1) |
| Wage blend toward the paying club | **15/85**, set by Mikey (§4.2) |
| Can a perfect trial get you to a giant? | **Yes — no cap.** Handled by never being a reserve, loans, and a status-scaled wage (§3.6, §3.6a, §4.1a) |
| Being a reserve | **Never.** Bench every week, or loaned out (Mikey) |
| Shop structure | **Item families, five tiers each** (Mikey, §6.4a) |
| Tier locks | **Money first, no explicit locks.** Add one simple rule only if needed (§6.4a) |

### Open — needed before the relevant step
1. **Five-a-side in v1, or after?** Recommendation: after, and build the real
   one rather than the compromise (§3.5).
2. **Does a free agent have any income?** Without it the shop is a locked door
   during exactly the phase the cheap items exist for (§3.7).
3. **Multi-axis negotiation, or money-then-promise?** The current engine holds
   one number (§5.3).
4. **Can a career be played below the Championship?** Depends on Mikey (§8).

---

## 11. Everything that CHANGES existing behaviour

| # | Change | Who feels it | Status |
|---|---|---|---|
| 1 | Wages become weekly (§4.4) | Every save — tighter in cup/European seasons | **Asked for.** Also fixes a real overpayment |
| 2 | Wages anchored to the paying club (§4.2) | Every save. Smaller clubs now pay less | **Needs sign-off** |
| 3 | Career creation split (§3.1) | New careers only | **Needs sign-off.** Highest risk |
| 4 | Card game retired (§5.2) | Every save at renewal | **Needs sign-off.** Add alongside first |
| 5 | Full shop reprice (§6.5) | Every save | **Needs sign-off** |

### Explicitly NOT doing
- Wiring `Boot.pace` — would alter every match for every save.
- Unifying the training minigame's aim constants — trial uses the live engine.
- Retuning anything in the match engine to suit the trial.

---

## 12. How we'd know it worked

- A Championship and a Premier League career **feel financially different** in
  season one.
- Two trials produce **visibly different suitors**.
- There is something worth buying **in week one** — and still something worth
  saving for in year ten.
- Refreshing mid-trial **doesn't lose the opening**, and can't be used to retry
  a bad stage.
- A failed trial is a **story**, not a dead end.

---

## 13. What v1 got wrong (kept deliberately)

1. **The wage table was fiction.** Every Championship club is reputation 5;
   there is no rep-7 Championship club. The four targets were unsatisfiable by
   one exponential.
2. **"Add the trial phases to `RESUMABLE`"** — does nothing on its own; the load
   path bails before reading the phase.
3. **"Clauses need no change"** — true today, and broken by this plan's own
   negotiation step.
4. **The ratchet diagnosis was backwards** — the flat term does 85% of the work
   at a low wage; the real fault is that it's capped.
5. **"Reusable nearly as-is"** — the offer pipeline is career-shaped end to end
   and there is no career during a trial.
6. **Starting money was never mentioned** — it buys the whole cheap band at once.
7. **A ★150 energy gel** would have obsoleted the KIB can line and made the
   energy gate purchasable.
8. **The bus pass** was the riskiest item on the list, presented as the cheapest.
9. **No cross-division transfer route exists** — unnoticed, and it undercut the
   whole underdog premise.

The lesson worth keeping: **v1's numbers were written from targets rather than
from the data.** Every number in v2 was computed against the real files first.
