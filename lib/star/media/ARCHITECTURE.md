# The Football Media Engine

> Design document, and the thing the code was built against. **Built** — see §16
> for what the implementation changed, and `tests/star/media.mts` for the
> measurements that changed it.

---

## What it is

A procedural content system that turns **what actually happened in your career**
into a living football media feed: club accounts, journalists, insiders, stat
pages, fan accounts, rival fans, pundits, league accounts, your own team-mates.

It is not a bag of posts with a random picker. It is a pipeline:

```
     MATCH ENDS
         │
         ▼
   ┌─────────────┐   a frozen, structured description of the match.
   │ MatchRecord │   Nothing downstream ever reads CareerState directly.
   └─────────────┘
         │
         ▼
   ┌─────────────┐   ~60 pure detectors. Each answers one question:
   │  DETECTION  │   "did a hat-trick happen?" "was that an upset?"
   └─────────────┘   Output: FootballEvent[] with facts + tags.
         │
         ▼
   ┌─────────────┐   how big a deal is each one, in THIS context.
   │ IMPORTANCE  │   A 25-yard winner in a derby ≠ the same goal in a 5-0.
   └─────────────┘
         │
         ▼
   ┌─────────────┐   streaks, threads, "six in three", "unbeaten in nine".
   │   MEMORY    │   Reads events, writes threads, feeds them back as facts.
   └─────────────┘
         │
         ▼
   ┌─────────────┐   which of the ~40 accounts in your world care,
   │  SELECTION  │   given their interests, their bias and their reach.
   └─────────────┘
         │
         ▼
   ┌─────────────┐   what ANGLE does this account take on this event?
   │  NARRATIVE  │   Then: which template, filled with which phrasing.
   │ + TEMPLATES │
   └─────────────┘
         │
         ▼
   ┌─────────────┐   graphic payloads, trending topics, timestamps on a
   │  SCHEDULE   │   virtual news cycle: instant → hour → evening → next day
   └─────────────┘   → weekly awards.
         │
         ▼
      THE FEED
```

Every stage is a pure function of its input. That is what makes it testable, and
it is what lets the feed be **regenerated identically on a refresh** — a lesson
this codebase has already learned the hard way three times.

---

## 1. Where it lives in the game

Two entry points, deliberately:

**As a moment.** `post-match` → `Continue` → **`media`** phase. You see the
immediate wave — the club's full-time post, breaking news if it earns it, the
first fan reactions, a scoreline graphic. Then `Continue` resumes the existing
flow (press conference → contract offer → dilemma → dashboard). It sits *before*
the press conference, which is right: the papers react before they ask you about
it.

**As a place.** A `Media` tab on the dashboard nav. The whole feed, scrollable
back through the career, with trending topics at the top. This is where the
later waves land — the next day's back pages, the weekly awards — so opening it
on a Tuesday shows things that were not there on Saturday night.

Adding `"media"` to `StarPhase` and to `RESUMABLE` in `storage.ts` costs two
lines. It is resumable because it is generated from saved state, so a refresh
lands you back on it showing exactly the same feed.

---

## 2. The MatchRecord — the seam

The single most important decision in this design: **nothing downstream reads
`CareerState`.** The engine reads one frozen object built once at full time.

```ts
interface MatchRecord {
  id: string;                 // "s3-w14-league" — deterministic, dedups everything
  season: number;
  week: number;
  competition: string;        // "Premier League" | "FA Cup" | "Champions League" …
  kind: "league" | "cup" | "europe" | "international";
  round?: string;             // "Semi-Final"
  derby: boolean;
  home: boolean;
  neutral: boolean;           // a final

  club: string;
  opponent: string;
  clubStrength: number;       // for upset detection
  opponentStrength: number;

  score: { us: number; them: number };
  result: "win" | "draw" | "loss";

  you: {
    goals: number; assists: number; rating: number; starMan: boolean;
    minutes: number; chances: number; passes: number;
    hooked: "form" | "legs" | "rested" | null;
    captain: boolean; squadNumber: number; position: string;
    seasonGoals: number; seasonAssists: number;   // AFTER this match
    careerGoals: number; careerAssists: number;
    clubAppearances: number;                       // 1 = debut
  };

  goals: GoalRecord[];

  table: {
    before: { position: number; points: number; gd: number };
    after:  { position: number; points: number; gd: number };
    leaderGap: number;         // + = behind the leader, − = clear at the top
    relegationGap: number;
    matchesLeft: number;
  };

  cup?: { advanced: boolean; eliminated: boolean; trophy: boolean };

  context: {
    managerName: string;
    conditions: string;        // "Heavy pitch"
    fansStanding: number;      // relationships.fans
    fame: number;
    reputation: number;        // transfers.reputation()
  };
}
```

`GoalRecord` is `GoalEvent` plus the thing that makes a goal *interesting*:

```ts
interface GoalRecord {
  minute: number;
  scorer: string;
  assist?: string;
  isUser: boolean;
  /** How it was scored. Read off the scenario the chance was built from. */
  how?: "one_on_one" | "tight_angle" | "long_range" | "volley" | "header"
      | "penalty" | "free_kick" | "corner" | "cutback" | "byline_cross"
      | "through_ball" | "rebound" | "solo";
  /** Metres from the goal at the strike. Drives "25-YARD SCREAMER". */
  distance?: number;
  /** Running score AFTER this goal, so equaliser/winner/opener is derivable. */
  scoreAfter?: { us: number; them: number };
}
```

**This is the one change needed outside the media module.** `CanvasMatch`
already knows `scenario.kind`, the ball's start position and the minute at the
moment it pushes a goal event — it just throws all three away. Three extra
fields at two push sites (`CanvasMatch.tsx:1720` and `:1725`), and every
"WONDER GOAL", "35 YARDS OUT", "VOLLEYED IT FIRST TIME" headline in the whole
system becomes possible. Everything else in `MatchRecord` is derived from state
that already exists.

Old saves have no `how`. Detectors that need it simply do not fire, which is the
same graceful-degradation rule the rest of the career already uses for optional
fields.

---

## 3. Event Detection Engine

A registry of small pure functions. Adding a new detectable event is **one entry
in an array**.

```ts
interface FootballEvent {
  id: string;                 // "hat-trick", "late-winner", "cup-shock"
  subject: Subject;           // { kind: "you" | "club" | "teammate" | "opponent"
                              //   | "league" | "rival", name: string }
  facts: Facts;               // the slots. { goals: 3, opponent: "Everton", … }
  tags: Tag[];                // "goal" | "record" | "derby" | "cup" | "table"
                              // | "transfer" | "award" | "drama" | "shame"
  baseImportance: number;     // 0-100 before context
  window: Window;             // "instant" | "hour" | "evening" | "nextDay" | "weekly"
  threadKey?: string;         // joins a running story (see §4)
}

type Detector = (r: MatchRecord, m: StoryMemory) => FootballEvent | FootballEvent[] | null;
```

Organised by file so the registry stays readable:

| File | Detects |
|---|---|
| `detect/goals.ts` | hat-trick, brace, four, five, first goal, debut goal, opener, equaliser, winner, last-minute winner, 90+ winner, long-range, volley, free kick, header, penalty scored, penalty missed, wonder goal, rebound finish |
| `detect/creation.ts` | assist, double assist, hat-trick of assists, goal + assist, involvement in every goal |
| `detect/result.ts` | comeback (2+ down and won), collapse (2+ up and dropped), thrashing given, thrashing taken, upset (strength gap), cup shock, derby win/loss, clean sheet, goalless, six-pointer |
| `detect/personal.ts` | debut, first start, 50th/100th/200th appearance, star man, 9+ rating, hooked for form, captain's performance, milestone goal (10/25/50/100/150) |
| `detect/table.ts` | went top, lost top spot, into the European places, into the relegation zone, title decided, promotion, relegation, mathematically safe, points record |
| `detect/competition.ts` | into the next round, knocked out, into a final, trophy won, European qualification secured, golden boot lead taken/lost |
| `detect/streaks.ts` | scoring streak, unbeaten run, winning run, losing run, drought, clean-sheet run, club unbeaten run — all read from memory |
| `detect/career.ts` | fires outside matches: transfer rumour, contract signed, international call-up, manager sacked, award won, Ballon d'Or, testimonial, retirement |

**Importance scoring** is separate from detection, and multiplicative:

```
importance = baseImportance
           × competitionWeight   (league 1.0, cup 1.15, Europe 1.3, final 1.6, international 1.25)
           × derbyWeight         (1.4 in a derby)
           × stakesWeight        (title race / relegation six-pointer: up to 1.5)
           × latenessWeight      (89'+ winner: 1.35)
           × rarityWeight        (memory: your 1st hat-trick 1.5, your 6th 0.85)
           × fameWeight          (a 5★ player's ordinary Tuesday is news; a rookie's is not)
```

Rarity is why the engine stops shouting. A career full of hat-tricks should
produce a media world that treats a hat-trick as normal — because that is what
happens to real players, and it is the cheapest way to make a great career feel
different from a good one.

---

## 4. Story Memory

Stored on the career, bounded, small.

```ts
interface StoryMemory {
  /** Last 12 matches, ~10 fields each. Enough for every streak and "in his last N". */
  recent: MatchDigest[];

  streaks: {
    scoring: number;        // consecutive matches with a goal
    assisting: number;
    unbeaten: number;       // club
    winning: number;
    losing: number;
    cleanSheets: number;
    drought: number;        // matches without a goal
  };

  /** Open narratives. This is what makes it feel like a season and not a match. */
  threads: StoryThread[];

  /** Template ids used in the last ~40 posts, so the same joke is not made twice. */
  saidRecently: string[];

  /** Every event id ever fired, with a count. Drives rarity weighting. */
  seen: Record<string, number>;
}

interface StoryThread {
  key: string;              // "form-hot", "goal-drought", "title-race", "transfer-linked:Milan"
  opened: { season: number; week: number };
  touched: { season: number; week: number };
  heat: number;             // 0-100. Rises when reinforced, decays every week.
  facts: Facts;             // accumulating: { goals: 6, matches: 3 }
}
```

The thread lifecycle is the answer to the "six goals in three matches" ask:

```
  hat-trick      → opens thread "form-hot"   heat 55  facts {goals:3, matches:1}
  brace          → touches it                heat 78  facts {goals:5, matches:2}
  late winner    → touches it                heat 92  facts {goals:6, matches:3}
                        │
                        ▼
   the NARRATIVE stage now has a fact nobody detected in isolation:
   "six goals in his last three matches" — and the stat account leads with it
   instead of repeating "he scored again".
```

Threads decay 12 heat per week untouched and close below 20. A closed thread can
be *reopened*, which is how a media world says "back among the goals" rather than
starting from nothing.

Threads also carry across the career boundary: `transfer-linked:Milan` opened in
January is still warm in June when the window opens, which is how a rumour
becomes a saga.

---

## 5. Account Personality System

Accounts are **generated per career**, not hardcoded. A career at Arsenal has a
different media world from one at Leeds, and both change when you move.

```ts
interface MediaAccount {
  id: string;
  handle: string;              // "@ArsenalFC", "@tomburtonsport"
  name: string;
  archetype: Archetype;
  platform: "x" | "instagram" | "youtube" | "tiktok" | "news";
  verified: boolean;
  followers: number;           // drives reach, and the order of the feed
  avatar: { seed: string; tint: string };   // procedural, no assets
  voice: VoiceProfile;
  interests: Partial<Record<Tag, number>>;  // 0-1 weight per tag
  allegiance?: { club: string; polarity: 1 | -1 };  // -1 = they enjoy your failures
}
```

Thirteen archetypes, each a genuinely different writing register:

| Archetype | Register | Signature |
|---|---|---|
| `club` | Professional, celebratory, never negative | Full caps for the scorer, ⚪🔴 club emoji, `#COYG` |
| `league` | Neutral, informative, faintly corporate | "🏆 RESULT ·", stat lines, no opinion |
| `competition` | Ceremonial | "Into the semi-finals." |
| `broadsheet` | Measured journalism, subordinate clauses | "…as Arsenal edged past a stubborn Everton" |
| `tabloid` | Sensational, present tense, ALL CAPS verbs | "SANCHEZ SINKS THEM" |
| `insider` | Clipped, breathless, ⚠️🚨, "understands" | "🚨 Milan have made contact. Talks ongoing. More to follow." |
| `stats` | Data only, never an adjective | "6 goals in his last 3 league matches. 🔢" |
| `aggregator` | Repackages, adds nothing | "🎥 WATCH: the finish that won it" |
| `pundit` | First person, opinionated, contrarian | "I've been saying it for weeks and nobody listened." |
| `fan` | Emotional, lowercase, typos, unpunctuated | "im actually shaking" |
| `rivalFan` | Sarcastic, dismissive, grudging | "one good game and it's Ballon d'Or talk again" |
| `teammate` | Warm, short, emoji-heavy | "big three points 💪 @9" |
| `meme` | Format-driven | polls, "nobody: / him:", caption + fake thumbnail |

The `VoiceProfile` is what stops it reading as one writer:

```ts
interface VoiceProfile {
  register: "formal" | "neutral" | "casual" | "raw";
  caps: number;          // 0-1 chance of shouting a key phrase
  emoji: number;         // density
  hashtags: number;
  length: "short" | "medium" | "long";
  punctuation: "clean" | "loose" | "none";
  exclaim: number;
  firstPerson: boolean;
}
```

**Roster generation.** From the league you are in:
- one `club` account per club (20)
- one `fan` account for your club, one `rivalFan` for your derby rival, one
  `rivalFan` for the current league leader (they rotate as the table moves)
- one `league` + one `competition` account per active cup
- a fixed national cast: 2 broadsheets, 2 tabloids, 2 insiders, 2 stat pages,
  1 aggregator, 2 pundits, 1 meme page

**No real footballer gets an account.** `buildRoster` used to also generate
3-4 `teammate` accounts straight off the actual squad — real names, real
players, posting first-person as if they had written it themselves. Removed:
a real, currently-playing professional has not consented to a fictional
persona putting words in his mouth, however supportive, and this game has no
license to do that. `selfAccount` (below) — your own, fictional, created
player — is the only individual who ever posts as himself; a real player can
still be talked ABOUT, by the club/fan/stats/press accounts that already
cover every other event, which is commentary and opinion rather than
impersonation. See `tests/star/noRealPlayerAccounts.mts`.

~40 accounts, generated deterministically from the club list and season. It
re-generates on a transfer, which is exactly right: your new club's fans have
never heard of you, and your old club's rival fan account is no longer interested.

**Selection.** For each event, each account scores:

```
score = Σ(interest[tag] for tag in event.tags)
      × allegianceFit(account, event)      // rivals want your failures, not your goals
      × reachFit(followers, importance)    // a national tabloid ignores a 6.8 rating
      × platformFit(archetype, event)
      × jitter(seed)                       // so it is not the same six accounts every week
```

Top N by score, where N scales with the biggest event's importance — a 1-0 win
produces four posts, a hat-trick in a derby produces eighteen. Hard caps: max 2
posts per account per cycle, max ~24 posts per match.

---

## 6. Narrative Engine + Template Engine

Two layers, and the split is the point.

**The Narrative Engine picks the angle before a single word is chosen.**

```ts
interface Angle {
  lead: FactKey;          // which fact goes first
  sentiment: -1 | 0 | 1;
  thread?: StoryThread;   // reference a running story, or don't
  frame: "celebrate" | "analyse" | "question" | "mock" | "hype" | "report" | "joke";
  secondary?: FactKey;    // the supporting detail
}
```

The same event, three accounts, three angles:

```
EVENT   late-winner  { minute: 89, scorer: "you", opponent: "Spurs", derby: true }
        thread: form-hot { goals: 6, matches: 3 }

club     → frame "celebrate", lead "minute"    → "89 MINUTES. GET IN. 🔴⚪"
stats    → frame "report",  lead thread.goals  → "6 goals in his last 3. 3 of them
                                                  winners. 🔢"
rivalFan → frame "mock",    lead "opponent"    → "typical spurs. hand them a title
                                                  race and they'll find a way"
```

**The Template Engine fills it in.** Templates are indexed by
`(eventId × archetype × frame × platform)` with a fallback chain, so a missing
combination degrades to a generic template for that archetype rather than
crashing or going blank.

```ts
interface Template {
  id: string;
  match: { event: string; archetype: Archetype; frame?: Frame; sentiment?: number };
  weight: number;
  body: string;      // "{SCORER|caps} does it AGAIN. {goals} in {matches}. {hashtag}"
  graphic?: GraphicKind;
  requires?: FactKey[];   // skipped if the facts aren't there
}
```

Slots resolve through a **phrase grammar** rather than a lookup, which is where
the combinatorics come from:

```
{goals:3}  →  "a hat-trick" | "three goals" | "a matchball" | "all three"
{minute:89} → "in the 89th" | "with a minute left" | "at the death"
              | "deep into the second half"
{win:3-2}  →  "edged it" | "found a way" | "somehow won it" | "held on"
```

Each pool is weighted by the account's `register`, so the tabloid draws
"matchball" and the broadsheet draws "a hat-trick" from the same slot. Add
inflection helpers (`|caps`, `|short` for player names, `|nick` for club
nicknames, `|ordinal`, `|possessive`) and the arithmetic is:

```
   ~60 events
 ×  ~13 archetypes
 ×   ~7 frames
 ×  ~4 templates per combination
 ×  ~3-5 phrase alternatives per slot, ~4 slots per post
 ─────────────────────────────────────────────────────────
   millions of distinct posts from roughly 1,200 authored fragments
```

**Determinism.** Every random draw is seeded from
`hash(matchId + eventId + accountId + templateSlot)`. Refresh the page and the
feed is character-for-character identical. This is not a nicety — this codebase
has already shipped three bugs where React state that should have been derived
was lost on reload.

---

## 7. Timeline Scheduler

A feed that dumps 24 posts at full time reads as a wall of text. A real news
cycle has shape.

```
  T+0m    ⚽ FULL TIME              club account, league account, scoreline graphic
  T+2m    🚨 the moment            breaking news IF importance ≥ 70
  T+4m    😤 fans                  3-6 fan reactions, immediately, unfiltered
  T+8m    📸 player post           your own account
  T+15m   🔢 the numbers           stat accounts, player card graphic
  T+40m   🎙 the reaction           manager quotes, pundit takes
  T+2h    📰 the write-up          broadsheet match report, tabloid headline
  T+4h    🚨 the rumour            insider, IF a transfer thread is warm
  T+18h   📰 back pages            next-day headlines, polls, debates
  Weekly  🏆 awards                Team of the Week, POTM, golden boot table
```

Implementation: every post carries `at` on a **virtual career clock**
(`season × 10⁶ + week × 10⁴ + minutes`). Generation is eager — the whole cycle is
computed at full time — but *reveal* is gated on the clock. The `media` phase
straight after the match shows T+0 to T+15. Open the tab later that week and the
rest has arrived. It costs one comparison and it is the entire difference between
"a list" and "a feed".

---

## 8. Trending Topic Engine

```ts
interface Trend { label: string; volume: number; tag: Tag; hot: boolean; }
```

Aggregate the cycle's events by subject and tag, rank by
`Σ(importance × reach of the accounts that posted)`, format the volume as a
plausible number scaled by your `fame`. Six trends, refreshed per cycle, pinned
above the feed. Cheap to build, and it is the single strongest signal that you
are looking at a platform rather than a log.

---

## 9. Graphic Generation Data

Posts carry **typed data, never images**. Rendering is React, in the visual
language the game already has.

```ts
type GraphicSpec =
  | { type: "scoreline";     home: string; away: string; hs: number; as: number;
                             competition: string; scorers: string[] }
  | { type: "breaking";      strapline: string; headline: string }
  | { type: "playerCard";    name: string; number: number; position: string;
                             rating: number; stats: Row[] }
  | { type: "statLine";      title: string; rows: Row[] }
  | { type: "tableSnippet";  rows: TableRow[]; highlight: string }
  | { type: "topScorers";    rows: Row[]; highlight: string }
  | { type: "teamOfTheWeek"; formation: string; players: TotwSlot[] }
  | { type: "hatTrick";      name: string; minutes: number[] }
  | { type: "transfer";      player: string; from: string; to: string; fee?: string }
  | { type: "trophy";        competition: string; club: string; season: number }
  | { type: "poll";          question: string; options: string[]; votes: number[] }
  | { type: "thumbnail";     title: string; badge: string };
```

Twelve components, one per variant, each reading the same tokens the rest of
`/star-dev` uses. **No grey text anywhere** — greyish-white or white, per the
standing rule for this project.

---

## 10. Persistence

```ts
// on CareerState, optional, so every existing save loads unchanged
media?: {
  posts: StoredPost[];      // capped at 150, oldest dropped
  memory: StoryMemory;
  lastCycleId: string;      // dedup guard — a replayed match cannot double-post
};
```

**Posts are stored rendered.** The alternative — storing `(templateId, facts,
seed)` and regenerating — is more elegant and is the wrong call: it means editing
a template silently rewrites history in someone's save. A rendered post is
~120 bytes; 150 of them is 18 KB, which is nothing next to what the career
already stores. History should be history.

Memory is ~2 KB. `lastCycleId` matters because this game has *already* had a
double-crediting bug from a replayed season.

---

## 11. Module layout

```
lib/star/media/
  types.ts          MatchRecord, FootballEvent, Post, GraphicSpec, MediaAccount…
  record.ts         buildMatchRecord(career, fixture, stats, tableBefore)
  detect/
    index.ts        the registry + detect()
    goals.ts  creation.ts  result.ts  personal.ts
    table.ts  competition.ts  streaks.ts  career.ts
  importance.ts     contextual scoring
  memory.ts         streaks, threads, decay, rarity
  accounts.ts       roster generation + voice profiles
  select.ts         which accounts react to what
  narrate.ts        angle selection
  grammar.ts        phrase pools, inflection, seeded weighted pick
  templates/
    index.ts        the index + fallback chain
    club.ts  league.ts  press.ts  insider.ts  stats.ts
    fan.ts  rival.ts  pundit.ts  player.ts  meme.ts
  trending.ts
  schedule.ts       the virtual clock + windows
  feed.ts           the façade: generateCycle() / feedFor()

components/star/
  MediaFeed.tsx     the screen
  media/PostCard.tsx
  media/Graphics.tsx
  media/Avatar.tsx  procedural, no assets

tests/star/media.mts
```

The façade is two functions. Nothing outside the module imports anything else:

```ts
generateCycle(career, record, rng) → { posts: Post[]; memory: StoryMemory; trends: Trend[] }
feedFor(career, now) → { posts: Post[]; trends: Trend[] }
```

---

## 12. How the subsystems actually interact

Read this as the answer to "explain how every subsystem interacts":

1. **`creditMatchResult` finishes.** `page.tsx` calls
   `buildMatchRecord(before, after, fixture, stats)`. It needs the career on
   *both* sides of the match, because "went top of the table" is a comparison.
2. **`detect(record, memory)`** runs all ~60 detectors. Each is independent and
   sees the same two inputs. Output: a flat `FootballEvent[]`.
3. **`score(events, record, memory)`** attaches contextual importance. Memory is
   read here for rarity — the fifth hat-trick is worth less than the first.
4. **`memory.absorb(events, record)`** updates streaks, opens/touches/closes
   threads, increments `seen`. Threads it touched are attached back onto the
   relevant events as `event.facts.thread`, which is how the stat account learns
   about "six in three" without any detector knowing that fact existed.
5. **`select(events, accounts)`** pairs each event with the accounts that care.
   Output: `(event, account)` pairs, capped and deduped.
6. **`narrate(pair, memory)`** picks the angle. This is the only stage with
   deliberate variety in it — the same pair on two different weeks should not
   pick the same frame, and `memory.saidRecently` is what enforces that.
7. **`render(pair, angle)`** picks a template, resolves the grammar against the
   account's voice, and attaches a `GraphicSpec` if the template asks for one.
8. **`schedule(posts)`** assigns each post a virtual timestamp from its window,
   with jitter, and sorts.
9. **`trending(events, posts)`** derives the topic list.
10. **`feed.ts`** writes `{posts, memory, trends}` onto the career, capped, with
    `lastCycleId` set. `page.tsx` sets phase `media`.
11. **`MediaFeed.tsx`** calls `feedFor(career, now)`, which filters by the
    virtual clock and renders. It reads; it never generates.

Non-match events (`detect/career.ts`) enter at step 2 with a synthetic record —
transfers, contract signings, awards, the Ballon d'Or, manager sackings and
retirement all produce cycles the same way. The Ballon d'Or ceremony generating
a wave of congratulation posts costs one call.

---

## 13. What is detectable today, and what needs work

Honest accounting, because a design that promises detection the game cannot
supply is a design that fails on contact.

**Works from state that already exists** — hat-trick, brace, four, five, first
goal, debut, assists, multiple assists, opener, equaliser, winner, last-minute
winner, comeback, collapse, clean sheet, thrashing, upset, cup shock, derby,
title decider, promotion, relegation, league title, cup win, European
qualification, golden boot race, appearance milestones, goal milestones, star
man, hooked for form, unbeaten/winning/losing/scoring/drought streaks, contract
news, transfer rumours, international call-up, manager sacking, Player of the
Month, Player of the Season, Ballon d'Or, testimonial, retirement, record
breaking, manager quotes, match previews, predictions, polls, debates, trending.

**Needs the three-field `GoalRecord` addition in §2** — wonder goal, long-range,
volley, header, free kick, penalty scored, penalty missed, solo goal, rebound
finish, goal-of-the-month.

**Needs game systems that do not exist yet** — red cards, injuries, own goals,
penalty shootouts, bicycle kicks. The design reserves the event ids and the
detectors are written to return `null` when the fields are absent, so the day
any of those is added, the media world starts talking about it with no changes
here. **They are out of scope for v1** and I would not build them just to feed
the feed; they should be added because they make the *football* better, and the
media engine will pick them up for free.

---

## 14. Build order

**v1 — the spine.** `MatchRecord` (+ the `GoalRecord` fields), ~25 detectors
covering goals/results/table, importance scoring, streaks-only memory, 6
archetypes (club, league, tabloid, stats, fan, rivalFan), ~150 templates, the
grammar, 4 graphics (scoreline, breaking, statLine, playerCard), the two-window
schedule (instant + hour), the `media` phase and the feed screen. This is
already a feature people would open.

**v2 — the world.** The remaining 7 archetypes, threads and thread-aware
narration, the full 5-window news cycle, trending topics, the dashboard tab and
feed history, career-event cycles (transfers, awards, sackings), 8 more
graphics, Team of the Week.

**v3 — the depth.** Polls and fan debates with the player able to reply,
memes, YouTube/TikTok formats, opposition-manager quotes, pundit feuds that run
across weeks, and a "story of the season" recap generated from the thread
history at the Ballon d'Or.

---

## 15. Testing

`tests/star/media.mts`, in the style of the other seventeen suites — statistical
rather than golden-file, because the output is generative:

- 500 simulated seasons: **no crash, no empty feed after any match**
- every detector fires at least once across the sample, and none fires on
  every match (a detector that always fires is a bug, not an event)
- **determinism**: same career + same record → identical feed, twice
- no post is byte-identical to another within a 40-post window
- every archetype's voice is distinguishable by measurement (caps rate, emoji
  rate, mean length) — if the tabloid and the broadsheet measure the same, the
  voice system is not doing anything
- importance is monotonic in the ways it claims: a derby hat-trick outranks a
  friendly hat-trick, the fifth outranks nothing
- thread arithmetic is correct: 3 + 2 + 1 goals over three matches produces
  "six in three", not "six in six"
- stored feed stays under 25 KB after 15 seasons


---

## 16. What building it changed

Six things the design got wrong, all found by writing the thing and reading the
output rather than by thinking harder about the design. They are recorded here
because each one is a trap the next person to extend this will otherwise fall
into.

**Threads must not do arithmetic.** §4 has a thread accumulating goals across
every event that touches it. A hat-trick fires four detectors, so over a season
the form thread reached *"67 goals in 25 matches"*. The run detectors already
measure properly — `red-hot` reads `goalsInLast(memory, 3)` — so a thread's job
is only to carry the latest measured pair forward and remember the story is
open. Facts are replaced, never summed, and only by events that arrive with
their own window.

**A template must not be usable twice in one cycle.** Two stat accounts wrote
the identical line a minute apart; so did both broadsheets; so did two
supporters. `chooseTemplate` now takes the set already used this cycle, and
`commit` also suppresses any post whose rendered text matches one of the last 24
— because the same template with the same facts produces a byte-identical post a
fortnight later, and reading it twice is the same tell.

**`position` meant two things.** Your position on the pitch and the club's
position in the table, in one fact bag, and whichever detector wrote last won:
*"Arsenal — NaNth, 43 points"*. Your position is now `role`.

**A word like "today" needs a guard.** `goals: 7` means seven this afternoon on
a hat-trick and seven across three matches on a run. `Template.excludes` is the
valve: a line that says "today" excludes `matches`.

**Register was doing two jobs.** A tabloid and a supporter are both "raw", and
only one of them types in lower case — so every back-page headline came out as
*"arsenal 2-1 aston villa"*. `VoiceProfile.lowercase` is now its own field.

**Reveal is driven by navigation, not a clock.** §7 assumes a virtual clock the
feed is filtered against, which is right — but crediting a match advances the
career week *before* the feed is ever shown, so staging off `career.week` makes
every post instantly visible and quietly deletes the news cycle.
`MediaState.lastCycleClock` records what the cycle was stamped from; walking out
of the ground shows the first fifteen minutes, and opening the tab later in the
week shows the rest.

Everything else in this document is as built. The volley of small things — one
defender rather than two, the club account's coverage gaps, "both of them" as a
bare noun phrase — came out of reading 135 generated posts and fixing what read
wrong, which is the only way any of it was ever going to be found.
