# Star Career — Power & Politics (a.k.a. "Club Politics" / "The Rule Book")

> **Status: idea bank + rollout plan, NOT built.** Nothing in this document is
> implemented yet. This is the complete, faithful record of a single large
> brain-dump session (11 Sep 2026) — every idea, every example number, every
> named mechanic — plus a staged plan for turning it into real code across
> multiple future sessions. Read this file in full before touching anything
> under this feature; do not start building from a partial re-read.
>
> Same spirit as `STAR_LIFE_EVENTS.md`/`STAR_SPONSOR_IDEAS.md`: a brainstormed
> idea bank, not a finished spec. Unlike those two, this one also carries a
> **rollout plan** (see the bottom) because the scope is an order of magnitude
> bigger than either — explicitly described as "a very big project" that will
> "take a long time to complete perfectly" and must ship in reviewable stages.

---

## 0. What this actually is, in one paragraph

A branch off Road to Ballon d'Or, unlocked by progression rather than
available from career start (starts with the investment system that already
exists — `lib/star/investments.ts` — buying club stakes, majority ownership,
the Boardroom). It adds two overlapping power tracks — a **player/manager**
track (formations, tactics, kits, transfers) and a **player/chairman** track
(ownership, boardroom votes, club presidency) — and then escalates that same
ownership-and-voting pattern all the way up to **governing bodies** (FA,
UEFA, FIFA, ...), where the "shares" are political influence instead of
equity and the thing you're voting on is the actual rule book of football
itself. A parallel **reputation system** (several distinct sub-reputations,
not one number) gates how much of this you can get away with, and a
**voting/ceremony mechanic** is the one reusable piece of UI that every tier
of this — a boardroom sale, a fan kit vote, a FIFA rule change — is built out
of.

---

## 1. Foundation: what already exists to build on

- `lib/star/investments.ts` — buy a % stake in any club, `MAJORITY_THRESHOLD`
  for boardroom control, `ownedClubState` (budget, manager).
- `components/star/Investments.tsx` — Market/Portfolio/Boardroom tabs; the
  Boardroom already lets a majority owner sign/sell players, fund the club,
  replace the manager, just redesigned this session (amount-based buy/sell,
  capped at what you can afford).
- The existing "Life" screen's relationship bars (boss/team/fans) are the
  explicit visual model the user wants reused for a new **reputation**
  screen — see §5.

Everything below is new.

---

## 2. Club-level powers (shareholder → majority owner → president)

Three tiers of involvement, each unlocking more:

1. **Any shareholder** (below majority): can **recommend** actions to the
   board/manager rather than force them — "I think we should sign a left
   back", "I'd like Erling Haaland" — a soft, non-binding suggestion the
   club "might get on board with". Not guaranteed; framed as influence, not
   control.
2. **Majority shareholder**: can act **unilaterally** — force a transfer
   through directly (buy/sell players), same as the existing Boardroom
   sign/sell but explicitly named as the "forceful" version of the tier-1
   recommendation. Also unlocks:
   - Changing **formations and tactics** (a player/manager hybrid role —
     "you are able to become a manager in your team").
   - **Kit design**: a real in-game kit creator ("a place where you can
     create a kit, and you can change this kit with different signs" —
     "signs" likely means crests/sponsor logos/patterns). Kit designs can
     also be **put to a public fan vote** between options.
   - More power scales with more ownership: "you get more power the more
     of the clubs that you own."
3. **Club president / chairman of the board** — a real, formally-voted-in
   role, distinct from just "owns >50%":
   - Elected via a **vote among shareholders specifically** (not fans) —
     "you could vote for a president for your club based on the
     shareholders instead of the fans. So you'd have to try and get the
     shareholders on board with you."
   - At sufficient ownership, you can **choose your own wage** — "only if
     you want a position of extreme power" (e.g. owning the whole club) —
     and the higher the wage, the more it drains the club's own finances.
   - **100% ownership → club takeovers/mergers**: buy out another club
     entirely, then dissolve it and absorb its assets — players, money,
     stadium, "all that stuff." Can rename the combined entity to represent
     both. Absorbs the dissolved club's fanbase (net gain in total fans),
     but a real chunk of those absorbed fans specifically **hate you** for
     "stealing their club" — a mixed reputation effect, not a pure win.

---

## 3. The voting mechanic (the one reusable system everything else needs)

This is the load-bearing piece of infrastructure. Every tier above and every
rule-book change below (§4) goes through the same mechanic:

- Any significant decision can be **put to a vote** of whichever group it
  actually concerns — shareholders for club business, fans for a kit design,
  a governing body's full membership for a rule change.
- The result is shown as **real numbers**, not a percentage bar — the user's
  own worked example: *"638 votes. 338 to sell, 298 to keep, 2 no votes"*
  (abstentions — "they didn't even bother to vote").
- Your **reputation/power** biases the odds of a vote swinging your way —
  not a guarantee, a real weighted roll.
- **Above a power/ownership threshold, you can overrule any vote outright**
  — "almost like you are some sort of dictator" — regardless of how it
  actually went.
  - Overruling **costs reputation**, every time, as a real and direct
    penalty — the core risk/reward: get exactly what you want right now, at
    a cost to your future ability to sway votes and to how you're seen.
  - You can also **deliberately hold a vote you didn't have to** purely to
    *build* reputation — "you can put things up to vote almost as a way of
    gaining reputation" — letting people feel heard is itself worth
    something, separate from whether you'd have overruled a "no" anyway.

### The ceremony (presentation layer for a vote)

Big votes get a real ceremony screen, scoped to the audience:
- A **shareholders' meeting** (club-level votes).
- A **fan vote** ("thousands and thousands of fans").
- A **public/online vote**.
- A **FIFA-scale ceremony** — "all of those people, like all of the national
  and club people."

Presentation: you're shown **offering** the proposal, then a **live-counting
animation** — the vote tally climbing rapidly, then slowing down as it
approaches the final numbers, then settling — followed by the pass/fail
reveal. The UI should still surface the overrule option even after a "fail."

---

## 4. Governing bodies and the Rule Book

### 4.1 Investing in governing bodies

Once you have enough power/reputation, you can invest influence in a
governing body the same conceptual way you invest in a club — FIFA
specifically named, but the model implies others (see §4.2). Once invested,
you can **propose rule changes**, which go to a vote among that body's
members (§3's mechanic, reused).

### 4.2 Which body controls which competitions (a real structural map, not global rules)

Explicitly called out: **"the FA runs the Premier League and the FA Cup"**
— rule changes through a given body only affect the competitions THAT body
actually runs. This needs a real data table before any rule change can be
scoped correctly, e.g.:

| Body | Competitions it controls |
|---|---|
| The FA | Premier League, FA Cup (and by extension the English pyramid) |
| UEFA | Champions League, Europa League, Conference League, Euros |
| FIFA | World Cup, and global laws of the game where applicable |
| CONMEBOL | Copa América |
| *(others as needed)* | — |

This table is itself a real design task before §4.3 can be built — see the
rollout plan.

### 4.3 Corruption mechanics — bribery, illegal deals, banned equipment

- **Bribery**: pay money to sway a vote or a high-level official directly.
- **Lawyers**: hire "high-level lawyers" to push through deals that aren't
  strictly legal.
- **Illegal equipment**: specific boots or energy drinks can be made
  **illegal** (or legalised) by rule change. While illegal, you can still
  buy them from "shady guys" — a black-market channel with a real **chance
  of getting caught**. Getting caught triggers real consequences: fines,
  suspensions, damaged relationships.
- All of the above should plausibly feed the SAME "risk of exposure →
  reputation/financial/status consequence" mechanic, not three unrelated
  systems — worth designing as one shared corruption-risk mechanic (see
  rollout plan, Phase 5).

### 4.4 The rule book itself — concrete rules given directly

Framed explicitly as **the start of a list that could grow to "hundreds"** —
these are the seed entries, not the ceiling:

1. **Abolish offside** entirely, for whichever competition(s) the acting body controls.
2. **Match length**: e.g. 90 → 120 minutes, or down to 60 minutes.
3. **No draws allowed**: every drawn match goes straight to penalties.
4. **Points per result**: freely reconfigure win/draw/loss point values.
5. **Squad size per side**: up to "crazy" numbers (e.g. 20 a side) or down
   to 9–10. Team-sheet/formation screens would need to render however many
   players the rule sets, gated by whether the club actually HAS that many
   fit players. ("Scenarios can definitely be revamped in the future" — the
   user is aware the underlying match engine assumes 11 and treats that as
   a later problem, not a blocker to designing the rule.)
6. **Ban or legalise specific boots/energy drinks** — see §4.3.
7. **Change a competition's format** — named example: restructuring the
   Champions League. **Resolved in Phase 0 (11 September 2026)**: the
   target format is reverting the current single league-table phase back
   to the old groups-of-4-then-knockout structure — that specific,
   buildable target, not an open-ended format choice.
8. **Decide tournament hosting rights** — e.g. bring the next Euros to
   England, the next World Cup to Spain, Copa América to
   Argentina/Brazil — gated behind being a high-level official at the
   relevant governing body.
9. **Host a final at your own club's stadium** — generates club profit.
   **Resolved in Phase 0**: the home-advantage effect applies only when
   your own club is actually one of the two finalists; hosting a neutral
   final still banks the profit but carries no gameplay boost.
10. **Move a club between leagues by governing-body fiat** — worked
    example given directly: move Real Madrid into the Premier League,
    replacing whoever finished 17th; that replaced club drops to the
    Championship; a club is in turn relegated from the Championship into a
    new **holding/limbo tier**, eligible for promotion back the *following*
    season. (This does NOT require owning the club being moved — the
    example explicitly separates "own the club" from "high enough official
    at the FA/FIFA to force the move.")
11. **Change European competition slot allocations per country** — e.g.
    grant England 4 extra Champions League spots (top-5 → top-9) plus 3
    extra Europa League spots, or the reverse (only the league winner
    qualifies for the Champions League at all).
12. **Create new competitions** — a breakaway "Super League" of the world's
    best clubs, or an entirely new cup with its own rules/format (possibly
    international).

### 4.5 The one explicitly unusual rule — recorded verbatim, not softened

Given directly, and to be preserved exactly rather than quietly dropped:
*"You could have a child. You can give him growth hormones to increase his
age and ability, and you can promote him into the first team of your own
team and transfer him wherever you want because you're his dad, and you
have full control over him... he'd have your name with junior on the end."*

**Phase 0 tone discussion, resolved 11 September 2026**: this is fictional,
not a depiction of doping a real minor — the user's own framing is that
"it's not a real human son, it's kind of a son of your character that is
being used [with] magical powers to age and grow, basically like using a
potion." The mechanic is a magical/potion-based aging-up of a game
character (comparable in tone to a wonderkid or clone), not medical growth
hormones administered to a real child. Cleared to build once its phase is
reached — reframe the flavour text around a potion/magical-ageing effect
rather than "growth hormones" specifically, to keep that framing consistent
in-game.

### 4.6 Fan reaction to change

Explicit and important to the balancing of the whole system: **"fans
generally don't like change... you would probably be hated quite a bit for
changing big things"** — the size of a rule change should have a real,
negative fan-reputation cost roughly proportional to how disruptive it is,
independent of whether the vote passed. A hugely popular rule can still cost
you something with fans simply for being a big change.

---

## 5. Reputation, as a real multi-part stat

Explicitly NOT one number. Named sub-areas, given directly:
- **World reputation** (global/governing-body standing).
- **Club reputation** (standing within your own club).
- **Fan reputation** (`relationships.fans` already exists — likely reframed/
  extended, not replaced).
- **Government official relationships.**
- **Shareholder relationships.**

Proposed presentation: a new tab/section modelled directly on the existing
Life screen's relationship bars (boss/team/fans) — the user draws this
comparison explicitly: *"you could have a reputation area which has
relationships with fans, with government officials, with shareholders...
you might have a different area for that."*

Moves up from: charity/positive actions, popular rule changes, favourable
media coverage.
Moves down from: overruling votes, big/unpopular changes (§4.6), getting
caught doing something illegal (§4.3).

**Media** is both a lever and an outcome: you can actively manipulate media
coverage to sway votes (shareholder and fan alike), and doing so also
passively raises reputation through sheer publicity.

**End-game power fantasy, explicitly named**: at extreme reputation/power,
aim to become president or "king" of your own country, or of a governing
body like FIFA. Framed as an aspirational ceiling, not a specific mechanic
yet — needs real design before it's buildable (see rollout plan, cut from
early phases entirely).

---

## 6. Club facilities/structure (foundational content, not gated behind ownership)

Requested as something that should simply exist in the game, independent of
the politics system above — *"I'd also just like this to be added into the
game."* Each club should have real, distinct facilities:
- Its own **stadium**.
- A **training ground**.
- A **youth team**.
- **Kit designs** (see §2's kit creator — the facility is the persistent
  club asset; the creator is the tool that makes one).

---

## 7. Rollout plan — how this actually gets built, in stages

This is far too large for one session or one PR. The phases below are
ordered so each one is independently shippable, testable, and useful on its
own even if the next phase never lands — the same incremental discipline
this codebase already uses everywhere else (see e.g. how the sponsorship
objectives, wonderkids, and energy systems were each built as one
self-contained pass with their own tests). **Do not attempt to build more
than one phase in a single work session.**

### Phase 0 — Design questions, resolved 11 September 2026
All four open questions were settled in one pass, no code touched:
- **CL format (rule #7, §4.4)**: revert the league-phase back to
  groups-of-4 then knockout — the old, well-understood Champions League
  format, not the current single-table phase. Build rule #7 against this
  specific target, not an open-ended "some new format."
- **Host-a-final home advantage (rule #9, §4.4)**: applies ONLY when your
  own club is one of the two finalists. Hosting a final your club isn't
  playing in still banks the profit but gives no gameplay boost — no
  bespoke "neutral venue" mechanic needed.
- **Governing-body → competition map (§4.2)**: ship Phase 4 with exactly
  the four already seeded — FA, UEFA, FIFA, CONMEBOL — no more bodies
  added up front.
- **§4.5 (the aging-up "son" rule)**: cleared to build. The user confirmed
  directly it isn't a depiction of doping a real child — it's a fictional,
  magical/potion-based aging mechanic on a game character, tonally closer
  to a wonderkid/clone than anything real-world. See §4.5's updated note
  for the exact framing to keep in the flavour text when it's built.

### Phase 1 — Reputation as a real, multi-part stat
Foundational: almost everything else reads reputation to decide vote odds.
Build the sub-reputations from §5 as real `CareerState` fields, wire them
into a new screen modelled on the Life tab's relationship bars, and give
them real (if modest) hooks into things that ALREADY exist — e.g. winning
trophies/awards nudges world reputation, a strong Boardroom track record
nudges club reputation. No voting yet. Ships as a visible, testable stat
before it's ever the input to a vote.

**Done, 11 September 2026.** `lib/star/reputation.ts` (`Reputation` type on
`CareerState`, `nudgeReputation`/`clampReputation`,
`worldReputationFromSeason`/`clubReputationFromSeason`), wired into
`advanceSeason` (careerFlow.ts) alongside the boss-relationship nudge it
sits next to. New `ReputationScreen` (SecondaryScreens.tsx), reachable
from the dashboard's Quick actions. `tests/star/reputation.mts` proves the
hooks off the real `advanceSeason` path, not just in isolation. Government
and shareholder reputation exist as real fields with no hook yet, exactly
as scoped — see Phase 2 below for shareholder reputation's first hook.

### Phase 2 — The voting/ceremony engine, generic and reusable
Build §3 as a standalone system — given a proposal (who's voting, what the
options are, how reputation biases the odds), it produces a real vote
tally and a ceremony screen with the count-up animation. Prove it end to
end on the SIMPLEST possible real use case: a Boardroom decision that
already sort of exists (e.g. selling a player) routed through a vote
instead of instant action, with the overrule option gated by ownership
%. This phase is "the voting system works," not "every use of it exists."

**Done, 11 September 2026.** `lib/star/voting.ts`: `castVote` (real
per-option counts + abstentions over a real electorate, reputation-biased
via a capped swing that never guarantees a result — `MAX_SWING = 0.3`),
`OVERRULE_OWNERSHIP_THRESHOLD` (75%, deliberately above bare majority
control) and its reputation-cost/vote-held-reward hooks
(`applyOverruleReputationCost`, `applyVoteHeldReputation`, both moving
shareholder reputation specifically). Proven end to end on selling a
player from an owned club (`investments.ts`'s `proposeSellPlayerVote`/
`resolveSellPlayerVote`/`canOverruleClubVote`) — a 51-75% majority owner
gets a real vote with a real result; an owner past 75% can force the sale
through anyway, at a real, immediate reputation cost. New generic
`VoteCeremony` component (offer → animated count-up → pass/fail reveal →
overrule option when eligible), reusable as-is by every later phase's
votes (kit vote, fan vote, Rule Book). `tests/star/voting.mts` (the
engine, including a real bug it caught: an unbiased vote with no favoured
option was silently defaulting ~50% of unclaimed probability to whichever
option was listed last) and `tests/star/investments.mts`'s own new
section (the real wiring) both pass. Deliberately NOT done this phase: the
"hold a vote purely to build reputation" optional/voluntary flavour of
voting (every vote this phase holds is a required step in an existing
action, not a player-initiated one — there's nothing else in the game yet
for that to attach to) and every other future use of the engine (kit
votes, fan votes, the Rule Book) — this phase proves the mechanism works,
nothing more.

### Phase 3 — Deepen the existing club-ownership layer
Using Phase 1+2: minority-shareholder recommendations (a real, lightweight
suggestion queue the board "considers"), formations/tactics as manager,
the kit creator + public kit vote, shareholder-elected club president,
choosing your own wage at extreme ownership, the §4.5 aging-up "son"
mechanic (cleared in Phase 0 — a fictional, potion/magic-based ageing
effect on a game character, framed like a wonderkid rather than anything
literal — same "full unilateral control" tier as forcing a transfer), and
finally club takeovers/mergers (§2's hardest item — full assets
absorption, renaming, split fan reaction). This phase is scoped to YOUR
OWN club and clubs you can buy outright — no governing bodies yet.

### Phase 4 — The Rule Book, starting with the simplest rules only
Using Phase 1+2, and gated behind governing-body investment (a new,
smaller version of the club-investment system, scoped per §4.2's map).
Ship the EASIEST, most mechanically self-contained rules first — the ones
that are pure numeric parameters the match/season engine already has a
natural home for:
- Points per result (§4.4 #4) — a tuning-style value the season table
  already reads.
- No-draws-go-to-penalties (§4.4 #3).
- Match length (§4.4 #2) — bigger lift, touches the match engine's own
  minute clock.
Deliberately EXCLUDE from this phase: offside toggle, squad-size changes,
and anything competition-format-shaped — those need real match-engine or
team-sheet work (see Phase 6) and shouldn't block shipping the rule-book
UI and voting flow on the simplest possible real rules.

### Phase 5 — Corruption mechanics
Bribery, illegal-equipment black market, the getting-caught risk/consequence
system (§4.3) — built as one shared "risk of exposure" mechanic rather than
three separate ones. Depends on reputation (Phase 1) and the rule book UI
existing (Phase 4) enough to have real illegal-vs-legal states to toggle.

### Phase 6 — The harder rules: match-engine and competition-structure changes
Offside toggle, squad-size-per-side (needs real team-sheet/formation work —
the user is already aware "scenarios can definitely be revamped in the
future" and treats this as acceptable later work, not a blocker), the
Champions League format change (target confirmed in Phase 0: groups-of-4
then knockout, reverting the current league-table phase), European
slot reallocation per country, forced league movement (the Real Madrid →
Premier League example), and new-competition creation (Super League /
new cup). Each of these is closer to a full feature in its own right and
should likely be its own further-split set of sessions once reached.

### Phase 7 — Club facilities (§6)
Can actually be pulled EARLIER if it turns out to be simple pure-data work
(stadium/training-ground/youth-team as club attributes with no gameplay
hook yet) — flagged here at the end only because nothing above strictly
depends on it, not because it's necessarily hard. Worth a quick scoping
pass at the start of whichever session picks it up to decide if it's
actually a Phase 1-adjacent quick win.

### Cut entirely from the rollout plan for now
- Becoming president/king of a real country (§5's end-game framing) — no
  concrete mechanic given yet, needs real design before it's schedulable
  at all.

(§4.5's aging-up "son" mechanic was the other item here — cleared in Phase
0, see §4.5's updated note. It's a club-ownership power, not a Rule Book
vote, so it slots into Phase 3 alongside the rest of the ownership-layer
work rather than Phase 4 — see Phase 3's note below.)
