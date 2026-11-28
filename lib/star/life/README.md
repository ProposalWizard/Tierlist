# The living world (`lib/star/life/`)

Events (one-off moments), arcs (stories over weeks and seasons), the people in them, and the
games a story can open. Screens are in `components/star/life/`; the test page is `/star-life-dev`.

## How to add a story

A story is one JSON file in `book/arcs/`, listed in `book/arcs/index.ts`. Copy
`hundred-balls.json` (the kit man) for the shape: `cast`, `vars`, `clocks`, `promises`,
`beats` (each an event with a `talk` or `choices`), `ends`.

Then run, and keep green:

```bash
npx tsx tests/star/lifeArcs.mts     # the checker, every story played by the dice, the people pool
npx tsx tests/star/lifeEvents.mts
npx tsx scripts/soak/lifeSoak.mts   # every beat and ending reached across 200 careers
npx tsx tests/star/lifeSaveFixture.mts  # old saves still load and play the same
```

### 0. Who meets it: `start`

```json
"start": { "chance": 0.22, "careers": 0.18 }
```

- `chance` (above 0, at most 1): each time its first beat could play, the odds it begins then.
  A seeded roll, the career's own, so careers do not all meet it in the same week.
- `careers` (optional, above 0, at most 1): the share of careers that ever meet it, rolled once
  per career from the player's name. 0.18 = about 1 career in 5. Leave it out and every career
  can meet it (batch 1's 60 stories). Use it for stories that should feel rare, and to spread a
  big book across careers: no single career should meet all of them.
- No `start` at all = the story always starts when its first beat can. No story in the book does that
  now: the kit man has a start roll too (Harry, 28 Nov: "a chance up until 21 with a hard stop at
  21"): chance 0.05 at each bad game (rating under 6.6) at training while you are 20 or under, and
  never from 21. A career already in his story plays on unchanged.
- Pacing on top (`arcs.ts`): at most one new story per moment, three weeks apart
  (`START_GAP_WEEKS`), at most 12 open at once (`MAX_OPEN_ARCS`).

### 0a. Stage, rarity and chains (28 Nov 2026; the map: `docs/plans/STORY_BOOK_MAP.md`)

```json
"start": { "chance": 0.0076, "careers": 0.22, "tier": "rare", "stage": "veteran", "when": ["age>=29"] }
```

- `tier` (every story has one): `common` (every career can meet it), `uncommon` (0.45 of careers),
  `rare` (0.22), `very-rare` (0.08), `legendary` (0.025, about 1 career in 40). The checker holds
  `careers` inside the tier's band (`STORY_TIERS`, `validateArcs.ts`).
- `stage` (words for the map) and `when` (the window, checked only when the story would start):
  first seasons `age<=20, season<=3` · breaking through `age 19-23` · established `age 22-29` ·
  peak `age 24-31` at the top two levels or famous · veteran `age>=29` · last seasons `age>=32` ·
  any. Add a level (`divisionLevel>=3`), a situation (`injured`, `europe`, `caps>=1`, `captain`, a
  new club `clubApps<=10`) when the story needs it. Once started, a story plays on wherever the
  career goes.
- `chance` is set from the window: about 2.5 tries' worth over the window's weeks (1.5 for `any`),
  more when the first beat needs something that only holds some weeks (a defeat, a partner, an
  injury). The soak shows whether it worked.
- A tiered book starts its stories in a fair draw each moment (a seeded shuffle, not file order)
  and never opens a second big story while one is open. A book with no tiers (an old save's
  replay) plays exactly as before.
- **Chains.** A story that follows another waits on how it ended: `"when": ["ended(arc-the-van:his-name-on-the-van)"]`
  (any ending: `ended(arc-the-van)`; two stories colliding: two `ended(...)`). The ending is kept in
  the save for good (`life.fin`), unlike the story's own values, flags (only the last 12) or
  memories (6 a person). The same role is the same person, so the reporter in the sequel is the one
  from the first story. The checker fails if the parent is not in the book, has no such ending,
  never ends that way, waits for an unbuilt game, or waits on the child; and if a chain reads a
  flag nothing sets or a memory nothing writes.
- The soak's reach pass (`scripts/soak/lifeSoak.mts`) plays extra careers whose names put a rare
  story and its whole chain in, so every ending is still seen in real play.

### 0b. How a story is kept in the save (`arcPack.ts`)

- While it is open: a full record in `life.arcs[id]` (people, values, clocks, the weeks each
  beat played), about 0.3 to 0.5 KB. At most 12 are open.
- One moment after it ends it is shrunk (values, clocks, club wiped; only its owner kept), and
  at the next moment packed into ONE short word in `life.fin`, about 12 bytes:
  story code (4) + ending code (3) + start week + `.` + beats played on the main line
  (+ `.` + the owner's id, only for a team-mate). `arcsOf(c)` reads open and packed stories
  alike; a packed one reads exactly as its shrunk record did.
- So a finished story can only be read later for: its ending, its owner and which main-line
  beats you played. Anything another story or event must know later goes in a memory
  (`remember`), a squad memory, a flag, `give` / `unlock`, or a promise, never in `vars`.
- Never rename a story's `id` or an ending's `id`, and never renumber a beat's `n`, once the story
  is in the game: old saves name them. New endings and beats are fine anywhere.
- The checker fails if two stories' codes clash (set `"code": "ab12"`, 4 letters or digits, on the
  NEW story; never change a code later) or two endings of one story clash (rename the new one).
- Old saves load as they were (`migrate.ts` keeps every story) and are packed at their first
  story moment. `tests/star/lifeSaveFixture.mts` holds two real saves made before packing: it
  checks they load and play on exactly as they did. Never regenerate that fixture.
- That exact replay runs on the book as it was on 27 Nov 2026 (`fixtures/lifeBook-2026-11-27.json.gz`,
  swapped in by the test), so new stories and deeper old ones never break it. Today's book is checked
  there too: every story in the old saves keeps its ending, people and beats, and 30 weeks play on.
- To make an old story deeper: add beats with new ids (a side beat with no `n`, or the next `n`), keep
  every old ending reachable, and schedule a later beat from an old ending with `next` + `afterWeeks`
  (the story counts as over for pacing, and the later beat can still end it a new way).

### 1. People: name a ROLE, never a person

`cast: [{ "slot": "kitman", "pick": "kitman" }]`. The career picks one person for the role and
keeps them for good (`pool.ts`, `people.ts`). Never write a name ("Den") into a story: the test
fails if a pool name appears.

**Club people (28 Nov 2026).** The kit man, groundsman, physio, canteen, coach, chairman and legend
belong to a CLUB (`CLUB_ROLES`). Your first club keeps the plain ids; another club's person is
`staff:kitman@<club code>`, picked by the career and the club, pinned in `life.cpool` when a story
first meets him, never one the career has at another club while the pool allows. A story keeps the
person it cast, so after a move your old kit man still rings you (`fromOldClub`). Write a club
story so it reads at any club; a line for "you've moved" goes behind `sameClub`.

Roles (`pick`): `kitman`, `groundsman`, `physio`, `reporter`, `legend`, `manager`, `agent`,
`dad`, `mum`, `brother`, `sister`, `partner`, `pal`, `canteen`, `chairman`, `coach`, `fan`,
`kidfan`, `neighbour`, `rival`, `sponsor`, `referee`, `tabloid`, `broadsheet`, and `squad`
(a team-mate, with `where` and `order`).

**Roles with a pool** (several people, one per career; each has a name, age, where he is
from, manner, look preset and sign-off): `kitman` (Den, Ray, Sol, Mick), `groundsman`,
`physio`, `reporter`, `legend`. Add a person: one line in `POOL` (`pool.ts`). Add a pooled
role: a list in `POOL`, and the role in `people.ts`.

### 2. Slots in lines

`{slot.short}`, `{slot.name}`, `{slot.age}`, `{slot.from}` (where he is from),
`{slot.initial}` (the note's signature), `{slot.signoff}` (how he signs a text: Den "D",
Ray "Ray", Sol "God bless. S"), `{slot.outlet}` (a reporter's paper), `{slot.club}`.
You: `{you.short}`, `{you.name}`, `{you.club}`, `{you.number}`, `{you.age}`.
The story: `{arc.<var>}`; after a game `{activity.score}`, `{activity.tens}`.
`{if slot}…{/if}`, `{if !slot}…{/if}` and `{if <condition>}…{/if}`.

Titles, clock labels, bubbles, items and endings are filled too.

### 3. Games a story can open (`talk.nodes.<id>.activity`)

| mode | what it is |
|---|---|
| `challenge` | **Any rounds from the round library**, on the real match engine. Use this. |
| `strike-drill` | Den's hundred (the same screen with his six rounds). |
| `crossbar` | Five at the bar against someone's rolled five. |
| `feed-drill` | You pass through cones; a team-mate's shot is rolled. |

Every game is the real match engine (`EngineFeature` → `CanvasMatch`; one-engine skill). A
result row reads `activity.score` (balls that counted), `activity.tens` (×10, the last ball
double), `activity.won`, `activity.abandoned`; the checker wants a stop row, a fallback row
and a doing-well row.

### 4. A challenge

```json
"activity": {
  "mode": "challenge", "name": "{groundsman.short}'s penalties",
  "dials": {
    "rounds": [
      { "kind": "corners", "balls": 2 },
      { "kind": "keeper", "balls": 3, "line": "I was a keeper once, son." },
      { "kind": "lights-out" },
      { "kind": "double" }
    ],
    "keeperSlot": "groundsman",
    "lines": { "keeper:saved": "\"Ha! Not past {name}.\"", "hit": "\"Good strike.\"" }
  },
  "caller": { "slot": "groundsman", "lines": ["\"Ten.\"", "\"Twenty.\"", "…"] },
  "score": "balls that count (0-10)", "canAbandon": true, "fallback": null
}
```

Rounds (`drill.ts` `ROUND_LIBRARY`); each round can set `balls`, `name`, `line`
(its card) and `calls` (his words before each ball):

| kind | balls | what you do |
|---|---|---|
| `call-it` | 2 | he shouts a corner; hit that one, low |
| `crossbar` | 1 | hit the bar |
| `props` | 2 | through the tyre hung from the bar, then knock the bucket over |
| `keeper` | 2 | beat the person in goal (`keeperSlot`, else the caller): the match's own keeper, slow and short |
| `lights-out` | 2 | the light goes; he shouts the corner in the dark |
| `double` | 1 | last round only: someone in goal; twenty, or ten off |
| `corners` | 2 | low in a corner |
| `far` | 1 | from twenty yards, low |

Rules the checker holds: ten balls at most (each counts ten), `double` only last, a
`caller`, `keeperSlot` a slot of the story. Not rounds yet: weak foot and first time (the
engine has no switch a feature can ask for).

**Reaction lines** (`dials.lines`), looked up before the defaults: `"<kind>:<end>"` then
`"<end>"`. Ends: `hit`, `post`, `wide`, `over`, `central`, `saved`, `high`, `wrong` (the
other corner), `under-bar`, `missed-it` (the tyre or bucket). Also `streak3`, `streak4`,
`broken` (a miss after three), `double:hit`, `double:miss`. `{name}` = who is in goal,
`{age}` = the caller's age, plus every slot above. His counts after a hit are the caller's
`lines` (ten of them: "Ten." … "And a hundred.").

### 4b. Who is remembered (the 60-person cap)

`people.ts` `tidy`, run once a week and whenever a story's ending pushes past `PEOPLE_CAP` (60):
a team-mate who has left is forgotten unless he is in a story that is still open, is owed an
open promise, or left a strong feeling (bond 50+ or grudge 40+) with a memory of strength 2+.
Over the cap the weakest go first, never someone in an open story or owed a promise. So a
minor person is forgotten once his story closes; write a strength-3 memory only for something
he should carry for good.

### 4b2. Follow-through: promises and turn-downs (Harry, 28 Nov 2026)

"'I'll see you Thursday' and then not coming and seeing him when offered should do something."

- **You say you will do something later** ("I'll be there", "See you Thursday", "Home by eleven"):
  make it a promise (`promises` + `"promise"` on the reply), with a way to keep it (a later beat,
  `keptBy`), a `kept` reward and a `broken` cost that is felt: a short line from that person, their
  numbers down, a memory of strength 2+. A later beat can read that memory (`{if mem(slot,'tag')}`).
- **You turn someone down** (an invite's `@send-apologies` / `@ignore`, an offer's `ifIgnored`, a
  "no" when they ask you round, a promise broken by not turning up): add `"snub": "<slot>"` to the
  outcome. `snubs.ts` gives them a `turned-me-down` memory the first time; the second time, with the
  same person in any story, bond and respect drop, a grudge, a `turned-me-down-twice` memory
  (strength 3) and their line (`"snubTwice"`, else a plain one). Stories can read both memories.
- `npx tsx scripts/life/follow-through-check.mts` lists every reply that commits to something with
  no follow-up, every turn-down with no `snub`, and every promise whose keeping gives nothing or
  whose breaking is not felt. Keep it at 0. A reply that needs nothing (done on the spot, a figure
  of speech) goes in `scripts/life/follow-through-left.json` with the reason.

### 4c. A game that does not exist yet

Mark the story `"needsActivity": "<mode>"` and write the talk with that mode. It is checked
(`validateArcBook`) but never plays (`WAITING_ARCS` in `arcBook.ts`) until the mode is built.

### 5. Voice and pictures

- Voice: `voice.ts` plays recorded clips whose words are on screen. A pool person's clips
  (manifest `speaker` = his pool id) play only when he is the one in the story; his folder is
  `public/star/life/voice/<folder>/manifest.json` (`POOL[...].voice`). No clips = silent text.
  Never regenerate Den's clips.
- Pictures: a pool person's drawn stills (`POOL[...].stills`) show only for him; anyone else
  gets the empty backdrop and the drawn head.
