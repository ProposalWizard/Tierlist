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
```

### 1. People: name a ROLE, never a person

`cast: [{ "slot": "kitman", "pick": "kitman" }]`. The career picks one person for the role and
keeps them for good (`pool.ts`, `people.ts`). Never write a name ("Den") into a story: the test
fails if a pool name appears.

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

### 5. Voice and pictures

- Voice: `voice.ts` plays recorded clips whose words are on screen. A pool person's clips
  (manifest `speaker` = his pool id) play only when he is the one in the story; his folder is
  `public/star/life/voice/<folder>/manifest.json` (`POOL[...].voice`). No clips = silent text.
  Never regenerate Den's clips.
- Pictures: a pool person's drawn stills (`POOL[...].stills`) show only for him; anyone else
  gets the empty backdrop and the drawn head.
