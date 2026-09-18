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

### 3.2 The stages

**Four of them are settled. The fifth — the five-a-side — is back in (§3.5)
and is being planned separately before anything is built.** So build these
four first, in this order, and slot the small-sided game in as stage 5 when
its own plan lands.

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

### 3.3a Closing the app mid-trial — DECIDED

**This is a phone game, so "refresh" is really "closed the app".** That
reframes the whole question, and the answer given directly is:

> *"The more important thing from a refresh is that they don't lose progress.
> If people want to cheat we shouldn't necessarily stop them, but it should be
> difficult — maybe a hidden feature where if someone refreshes more than once
> in a trial the difficulty gets bumped. If people are trying to cheat to get
> a better start, that means the game is pretty cool."*

So, three rules for building the trial:

1. **Never lose progress.** Every stage writes its result onto the career the
   instant it is decided, and the trial resumes into the stage you were on. A
   train going into a tunnel must never cost somebody their opening.
2. **Do not hard-block a retry.** Closing the app during a stage and coming
   back to that stage is allowed. No lockout, no "you already had your go".
3. **Make farming cost something, quietly.** A counter on the career records
   how many times this trial has been resumed. Past the first, each resume
   **bumps the difficulty** of the stage being replayed. Never announced,
   never explained, no error message — the trial simply gets harder the more
   you re-open it.

Rule 3 is the whole of the anti-cheat. It is deliberately not a wall: a player
who lost signal twice pays almost nothing, and a player grinding for a perfect
roll walks into a genuinely harder trial. It also costs almost nothing to
build — the difficulty roll (§3.3) already takes a number, so this adds to
that number rather than adding a mechanism.

**What this replaces:** the earlier plan's "a reload must resume into the NEXT
stage, never the same one". That was the only way to get both halves of §12's
promise while treating a retry as something to prevent. It isn't, so the
simpler rule wins.

### 3.4 Adversity — ship exactly one

v1 listed six events. **Two of them had no plumbing at all** — neither
`TrialPenalty` nor `TrainingMinigame` passes `conditions` to any engine call, so
"heavy pitch" is new plumbing in two components, and `visionDrill` computes its
window internally with no parameter to turn.

**v1 ships one: "the keeper is better than he should be" (+15 keeper
strength)** — a single existing field. More can follow once the trial ships.

### 3.5 The five-a-side — IN, and being planned properly

**Previously deferred out of v1. That is reversed.** Asked whether to attempt
it now, the answer was: *"Should we just try it and we might surprise
ourselves?"*

So it is stage 5 of the trial, and it is the **real** thing — reduced squads
on a smaller pitch — not the "run of chances" compromise an earlier draft
proposed as a cheaper stand-in. The argument for deferring it was never that
it was a bad idea; it was that it is the largest open question on the critical
path. That is still true, which is why it gets its own plan before a line of
it is written.

**Being planned separately in `STAR_FIVE_A_SIDE_PLAN.md`.** That plan has to
answer, against the real engine code rather than from memory:

- what actually has to be parameterised to get a smaller pitch, and whether it
  can be done additively so no existing caller changes;
- how four outfielders and a keeper a side get placed and driven, and how much
  of the existing defender/runner machinery carries over;
- whether continuous play comes from chaining scenarios or from a new
  sequencing layer above the engine;
- who the opponents are, when the player has no club and no squad yet;
- what number it reports into `trialScore`;
- how closing the app mid-game resumes (§3.3a);
- and whether the rule book's `squadSize` field is genuinely its home or a red
  herring — **honestly**, because wiring `squadSize` would otherwise mean
  touching the 11-a-side engine for every existing save, which the governing
  rule forbids.

**The governing rule applies in full here**: the five-a-side is built from the
live engine, additively. Nothing about how an ordinary match plays may change
to accommodate it.

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
come up periodically — the same stages, fully reused. This is the second
reason the trial has to be a reusable piece rather than a one-off opening
sequence, and it is why the five-a-side (§3.5) has to be reusable too.

#### The two dangers
1. **It must not be an inescapable grind.** Trials earned from this state must
   be at **lower-tier clubs with a lower bar**, so the way back is *downward
   into the leagues* — which gets much better once Mikey's tiers land (§8).
2. **Zero money plus a shop is a dead screen.** With ★0 you cannot buy a ★150
   item. **DECIDED: ★10 a week.** Asked directly, and deliberately much lower
   than the ★50 originally floated — it is a scrape, not a living. The point is
   that the cheap shop band is *reachable if you save for it*, which is exactly
   the feeling this phase is meant to have. At ★10/week a ★150 item is fifteen
   weeks of doing nothing else, so the free-agent shop's own cheapest tier has
   to be priced against that number, not against a signed player's wage.

### 3.8 What a career with no club actually looks like — DECIDED

The trial and the free-agent life both run on a real saved career with no
club, which makes every screen in the game technically reachable from them.
Most of those screens are about a club and would be nonsense.

**Decided: a cut-down dashboard, not the club dashboard.** What's on it:

- **Home** — where you are, what's next, the trial or the road back to one
- **Video games** — already exists
- **Gym** — training on your own, the free agent's only way to improve
- **Social** — already exists

And by omission, what is NOT on it: fixtures, the league table, the squad, the
team sheet, the manager, cups, Europe, the transfer window, the contract
screen. None of them have anything to point at.

Settings is already handled — it reads **"No club yet"** for a trial in
progress rather than a blank club name, so nobody starts a new career on top
of the one they're halfway through.

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

**DECIDED: (b) — money only for v1, shaped so (a) can be added later.**

The question needed rewriting before it could be answered. Asked as
"multi-axis negotiation, or money-then-promise?" the reply was *"what?"* —
fair, because that means nothing outside code. In plain English it is:

> When you sit down to agree a contract, is the ONLY thing you're haggling
> over the money — or can you also push for things that aren't money, like
> "promise me I'll start games", a shorter deal, or a release clause so you
> can leave if a big club comes in?

Agreed directly: **money only, built so promises can be added later without a
rewrite.**

**What that actually obliges step 8 to do**, because "shaped so it can be
extended later" is the kind of promise that means nothing unless it is
written down as a constraint:

1. The thing being negotiated is a **deal object with a `terms` collection**
   from day one, even while money is the only term in it. Adding a game-time
   promise later is then a new entry in that collection, not a new engine.
2. Each term carries **its own concession behaviour** — how far the club will
   move on it, and what moving costs them. Money's is the existing single-
   scalar haggle, unchanged. A promise's would be its own, added beside it.
3. The counterpart's mood (`negotiation.ts` already has one, and
   `NegotiationScreen.tsx` already draws it as a face) reads the **whole
   deal**, not the money field specifically — so a term added later
   automatically affects mood rather than needing mood rewritten around it.
4. **Nothing in the UI hard-codes "one row".** The screen renders the terms
   collection, so a second term appears without the screen being rebuilt.

If step 8 ships without those four, it has shipped (b) and closed the door on
(a), which is not what was agreed.

**And the honest caveat that comes with (a) whenever it lands:** a promise
nobody remembers is set dressing. "You'll start games" only means something if
the game records it, checks it against what actually happened, and lets you
hold it against the club — which is real work in its own right, not a
follow-on afternoon. Worth knowing before it is scheduled.

v1 asserted the feature without noticing the engine can't hold it.

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
`startingWage` monotonic and bounded across all 44 clubs (step 6); resume from
every trial stage (step 5); **no-offers never softlocks** (step 6).

**Written:**
- `tests/star/moneyScale.mts` — nothing is left behind by a rescale (step 1)
- `tests/star/wages.mts` — a week pays exactly one week's wage, however many
  games it has (step 2)
- `tests/star/clauseInvariant.mts` — clause-to-wage ratio survives a
  negotiation, and the bug is demonstrated as well as fixed (step 3)
- `tests/star/identity.mts` — `makeInitialCareer` is byte-identical to
  `makeIdentity` + `attachClub`; an identity is genuinely clubless, not
  placeholdered; the same identity can be signed by different clubs (step 4)
- `tests/star/saveSlots.mts` — an identity career round-trips through
  save / load / clear / slot-switch and is summarised as a trial, not an
  empty slot (step 4)
- `tests/star/career.mts` — `relegation-move` resumes after a reload, and
  does not lose a Ballon d'Or won on the way to it (step 4)

---

## 8. Below the Championship — MIKEY'S LANE

**Decision, given directly:** yes, a career below the Championship is agreed in
principle — *"but it's more about not breaking anything right now."* So it is
agreed as a direction, not as work to start. Nothing in steps 5-9 may assume
it, and nothing already working may be reshaped in anticipation of it. When it
does happen it is Mikey's, and `CareerDivision` widening from
`"premier" | "championship"` is where it starts.


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

| # | Step | Risk | Status |
|---|---|---|---|
| 1 | Economy sweep (§6.7) + delete the fake "Pac" column | Low | **BUILT** |
| 2 | Wages become weekly (§4.4) | Medium — changes existing saves | **BUILT** |
| 3 | Clause recomputation invariant (§4.5) | Low, and a prerequisite for §5 | **BUILT** |
| 4 | **`makeIdentity`/`attachClub` split + resume path** (§3.1) | **Highest** — lands alone | **BUILT** — see §9a |
| 5 | The four trial stages (§3.2–3.4) | Medium, lots of surface | Next |
| 6 | Scout offers **+ `startingWage` + club-anchored wages** (§3.6, §4.1–4.2) | Medium — one system, ship together | |
| 7 | Starting money scaling (§6.3) | Low | |
| 8 | Negotiation, added alongside the card game (§5) | Medium | |
| 9 | Full shop reprice + cheap band (§6.4–6.5) | Medium — priced against the wages that now exist | |
| 10 | Free-agent life (§3.7) | **Highest** — depends on 4 | |
| 11 | Cross-division summer window (§4.3) | Medium — new mechanic | |
| 12 | Status-scaled wage (§4.1a) | Low — `selectionFor` already computes the input | |
| 13 | Player loans (§3.6a) | Medium — real foundation exists; needs Mikey's agreement (§8) | |
| 14 | Real five-a-side (§3.5) | Its own project | **Being planned now** — `STAR_FIVE_A_SIDE_PLAN.md`. Slots in as trial stage 5 |

**Note on 12:** it is listed late but is genuinely cheap, and it makes the
giant-club start work. If §3.6 ships without it, a benched sixteen-year-old at
United is on ★20,000 a week, which is the opposite of the intended feel. Pull it
forward if the trial lands first.

---

## 9a. Step 4, checked line by line against §3.1

Everything §3.1 asked for, and what actually happened to it. Written after
building it, against the real files — several of §3.1's own claims were
assertions that had never been measured, and two of them were slightly wrong.

### Done

| §3.1 asked for | What was built |
|---|---|
| Split `makeInitialCareer` into `makeIdentity` + `attachClub` | Done. `makeInitialCareer` is kept and is now literally the two of them in a row |
| Every existing consumer keeps working | Proven, not asserted: a test builds five real careers (both divisions, five clubs) both ways and compares the **whole JSON**. Identical. The eight suites that call `makeInitialCareer` needed no change |
| Fix `relegation-move` "while we're there" | Done — added to `RESUMABLE`, plus the resume branch in `loadCareerIntoState` that actually reads it. Offers are regenerated from the same seed (`season * 8831 + fame`) the same way `season-transfer`'s already are, and a Ballon d'Or won on the way to the screen survives the reload |
| `listSaveSlots` must not summarise a trial as "Empty" | Done. `SaveSlotSummary` gained `signed`, and Settings now reads **"No club yet"** instead of printing a blank club name with a dangling separator |

### Verified rather than taken on trust

- **Autosave.** §3.1 claimed the cloud-save effect "returns early on a null
  career" and so would save a trial normally. Checked: true. It gates on
  `if (!career) return` and nothing else, and `saveCareerToCloud` is a blind
  POST of the whole state. A trial started on a phone will reach a laptop.
- **`handleStartNewInSlot`.** Claimed not to touch localStorage. True — it
  only calls `setCareer(null)`. Nothing is orphaned.
- **`npm run build`** fails in the sandbox with
  `PageNotFoundError: Cannot find module for page: /_document`. Confirmed
  **pre-existing** by stashing every change and reproducing it identically on
  a clean tree. This project has no `pages/` directory and no `_document`
  anywhere in source, so it is an artefact of the install here, not the repo.
  `tsc --noEmit` is clean and the app runs.

### Two things §3.1 got slightly wrong

1. **`cups` is not a club-dependent field to fill in.** §3.1 lists "cups"
   among the fields needing a club. `career.cups` is the season's finished
   RUNS and is legitimately `[]` in August for every career ever created; the
   actual draw lives in `cupState`. `attachClub` seeds both, but a test
   asserting "signing enters you into the cups" has to look at `cupState`.
   Caught by that assertion failing.
2. **The line numbers have drifted.** `page.tsx:1208` (the early bail),
   `page.tsx:1939` (the render fall-through) and `storage.ts:147`
   (`RESUMABLE`) are all off by tens of lines now. Find them by name.

### Deliberately deferred to step 5, and why

- **"Add the trial phases to `RESUMABLE`."** There are no trial phases yet —
  they are step 5. Adding names for screens that do not exist would be
  scaffolding nobody could test.
- **Render fall-through** (`phase === "profile-setup" || !career`) and
  dropping the `&& career` guards above it. Same reason: nothing to route to
  yet. The early-bail fix that made this reachable at all **is** done — a
  clubless career now returns from `loadCareerIntoState` with its phase
  resumed instead of falling through to the three club-data fetches.
- **Prefetching the candidate clubs** at the offer screen — step 6 builds the
  offer screen.
- **Deleting `ProfileSetup` step 2** and moving its `/api/draft/clubs`
  availability filter into the offer generator — step 5/6, and the filter has
  nowhere to move to until the generator exists.

### One new question step 4 surfaced

§12 asks for two things that pull against each other: refreshing mid-trial
must **not lose the opening**, and must **not be usable to retry a bad
stage**. With the phase resumable and the stage's result held in React state
until the stage ends, a refresh mid-stage IS a retry. The only way to get
both is for **each stage to write its result onto the career the moment it
is decided**, so a reload always resumes into the NEXT stage. That is a
constraint on how step 5 is built, and it is cheap if it is designed in and
expensive if it is bolted on. Logged as open question 5 below.

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
| Five-a-side in v1? | **Yes — attempt it now.** *"Should we just try it and we might surprise ourselves?"* Plan it properly first (§3.5a) |
| Free-agent income | **★10 a week.** Enough to keep the cheap shop band alive, not enough to be comfortable (§3.7) |
| Mid-trial refresh | **Never lose progress. Don't hard-block cheating — make it cost.** See §3.3a |
| A clubless career's navigation | **A cut-down dashboard** — Home, video games, gym, social. Not the club dashboard (§3.8) |
| Does a trial take a save slot? | **Yes**, for now (§3.1) |
| Playable below the Championship | **Agreed in principle** — but not now, and nothing already working may break for it (§8) |
| Wages anchored to the paying club | **Signed off** (§4.2) |
| Career creation split | **Signed off** — built (§3.1, §9a) |
| Card game retired at renewal | **Signed off** (§5.2) |
| Full shop reprice | **Signed off** (§6.5) |
| What you haggle over in a contract | **Money only for now** — built so promises can be added later without a rewrite (§5.3) |

### Open — needed before the relevant step

**None.** Every question this plan raised has been answered.

The last one to close was the negotiation question (§5.3), and it is worth
recording how, because the lesson generalises: asked as *"multi-axis
negotiation, or money-then-promise?"* it came back **"what?"** — correctly,
because that sentence means nothing outside code. Re-asked as *"is the only
thing you're haggling over the money, or can you also push for things that
aren't money — game time, a shorter deal, a release clause?"* it was answered
immediately.

**Any future question in this doc gets asked the second way.** A question the
person answering can't parse isn't an open question, it's a badly written one.

### Signed off (previously §11's open column)

All four were signed off directly. They still ship in build order, and each
still gets its own team message before it lands.

| # | Change | Who feels it | Status |
|---|---|---|---|
| 2 | Wages anchored to the paying club (15/85) | Every save — smaller clubs pay less | **Signed off.** Not built, step 6 |
| 3 | Career creation split | New careers only | **Signed off. BUILT** — behaviour-identical until step 5 lands |
| 4 | Card game retired at renewal | Every save | **Signed off.** Not built, step 8 — add the replacement alongside it first |
| 5 | Full shop reprice | Every save | **Signed off.** Not built, step 9 |

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
- Closing the app mid-trial **never loses the opening** — and somebody who
  re-opens it over and over to farm an easy roll finds the trial quietly
  getting harder rather than being told off (§3.3a).
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
