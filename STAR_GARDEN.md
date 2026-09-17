# Star Career — "The Garden" (a personal home hub)

> Brainstormed, not built. Written the same way `STAR_POWER_POLITICS.md` was before any of
> its phases were built: real scope, real honest limits, real open questions — nothing here
> is committed to until a build session actually starts on it.

---

## The ask, as given

A personal space — "kind of like your own personal garden area" — that:

1. Shows off a **trophy collection** (real, from `career.trophies`).
2. Can hold **owned animals**, explicitly including your horse if you own one (`career.horse`
   already exists — see `lib/star/horse.ts`).
3. Has **teammates visiting and strolling around** — "kind of like a Wii character used to
   do," i.e. Mii Plaza / Tomodachi Life / Animal Crossing-style ambient wandering figures,
   not a static list.
4. Uses **real, designed art** — "properly designed," combining Adobe-generated/edited
   assets and images the user supplies directly.

This is a genuinely different kind of screen from everything else in `/star-dev`. Every
existing screen in this game is a flat 2D card/list UI (Tailwind divs) or the canvas MATCH
engine (`CanvasMatch.tsx`, ball physics, 90 real minutes). A garden with characters idly
wandering around a scene is closer to the second category — a small, persistent, ambient
simulation — and needs to be scoped as one, honestly, rather than promised as "just another
tab."

---

## Why this needs a real decision before building: three tiers, wildly different cost

### Tier 1 — A "room," not a simulation (cheapest, most consistent with this game's own art style)

A single designed illustration (or a few — trophy shelf view, the horse's paddock, a patio
where teammates hang out) with **static figures placed on it**, tappable for a name/stat
tooltip, matching exactly how `TeamOfSeasonPitch` (`SeasonAwardsScreen.tsx`) already places
real player photos at fixed `{x, y}` coordinates over a designed background. No animation,
no movement, no physics — just a good-looking scene with real data overlaid on it.

- **Real effort**: small. One new `GardenScreen.tsx`, a couple of designed background
  images, reusing the exact face/crest/silhouette components every other screen already has.
- **What "properly designed" gets you here**: a genuinely good-looking illustrated
  background (the garden, the trophy room, the stable) is exactly the kind of asset Adobe
  Stock search/licensing or a design pass can produce well, and it never goes stale — the
  DATA on top of it (trophies, horse, teammates) is what changes, not the art.
- **Honest limitation**: nothing actually "strolls." It's a diorama, not a plaza.

### Tier 2 — Gentle ambient motion (a real middle ground)

Same designed scene, but the figures **drift between a handful of fixed spots** on a timer
or a slow CSS/JS tween (teammate A is by the trophy cabinet for a while, then eases over to
the horse's paddock) — real movement, but scripted between named waypoints, not free
pathfinding. This is the same idea `CanvasMatch.tsx`'s canvas rendering already knows how to
do (drawing a sprite at an interpolated position over time) but at a MUCH smaller scale — a
handful of slow-moving figures, not 22 players and a ball at 60fps with collision physics.

- **Real effort**: moderate. A small new canvas or absolutely-positioned-div animation loop,
  a fixed list of "spots" per scene, and a simple per-character state machine (idle here →
  walk to there → idle there). No pathfinding, no obstacle avoidance, no player control.
- **Honest limitation**: it will read as "a nice living scene," not as a game you control —
  there's no camera, no walking your own character around, no interaction beyond tapping a
  figure.

### Tier 3 — A real free-roam plaza (what "like a Wii character" literally describes)

Actual player-driven or free-roaming movement in a real 2D space — a genuine top-down
mini-engine: a walkable area, collision against the trophy cabinet/fence/stable, characters
picking their own destinations and pathing around each other and obstacles, maybe your own
character walkable via drag/joystick.

- **Real effort**: large — this is a second, smaller game engine, full stop. Not a screen,
  a system: a tile/collision map, a movement+steering model, a camera, and enough animation
  states (idle/walk in at least 4 directions) per character to not look broken. It would be
  the single biggest non-match-engine build in this codebase's history, on the order of the
  original `CanvasMatch`/`canvasEngine.ts` build, not a "Phase" the way Rule Book phases were.
- **Real asset cost, not just build cost**: Tier 3 needs actual SPRITE SHEETS (a character
  walking in 4-8 directions, several frames each) for every teammate archetype, not single
  illustrations — a fundamentally different (and much larger) art ask than Tier 1/2's "one
  nice picture per scene." Adobe's tools available in this project can edit/crop/adjust
  existing images and search/license Stock photos; they cannot generate a coherent multi-
  frame walk-cycle sprite sheet from scratch (see this session's earlier answer on Adobe's
  real capabilities here) — so Tier 3's art would need either hand-drawn sprites (a real,
  separate art-production task) or a fundamentally different visual style (e.g. reusing this
  game's existing top-down canvas dots/silhouettes, which already exist for the match engine
  and could plausibly be repurposed cheaply — worth prototyping before committing).

**Recommendation**: start at Tier 1, ship it, and only reach for Tier 2 if Tier 1 feels
static once it's real and in front of you. Tier 3 is a genuinely different, much bigger
project that deserves its own dedicated scoping session if it's still wanted once Tier 1
exists — exactly the same "don't build the biggest version speculatively" discipline the
Champions League rewrite and squad-size hooks were deliberately left alone for in
`STAR_POWER_POLITICS.md`.

---

## What's already real and reusable, regardless of tier

- **Trophies**: `career.trophies` (competition, season, club) already exists and already
  drives the Season Awards trophy cards — a garden trophy shelf reads the exact same data,
  no new tracking needed.
- **The horse**: `career.horse` (name, breed, speed, stamina, energy, races, earnings) is
  real and already ownable — see this session's own `lib/star/horse.ts` rework (fixed race
  purses, real weekly upkeep, a rename control). A garden paddock is a pure DISPLAY of data
  that already exists; no new horse mechanics needed to show it.
- **Teammates**: `career.squad` (SquadPlayer[]) is real, named, has faces/positions/ratings.
  "Teammates come over" can be entirely a display/flavour feature (who's currently "visiting"
  rotates on a schedule, or is influenced by `relationships.team`/individual chemistry if we
  wanted a reason) rather than a new relationship system.
- **Real photos vs. silhouettes**: every other screen's own convention — a real photo when
  the database has one, `SILHOUETTE_SRC` otherwise, never a fabricated player — applies here
  unchanged.
- **Other owned things**: `career.ownedItems` (Shop purchases, including a "Horse Stable" —
  `shopDefaults.ts`) and custom clubs (`lib/star/customClubs.ts`, if the player owns one) are
  both real, existing "stuff you own" data that a garden/home screen is a natural second home
  for, beyond the three things explicitly asked for.

## New ideas worth deciding on (not yet asked about directly)

- **A trophy CASE, not just a list** — genuinely different from the existing trophy cards on
  the Season Awards screen: a persistent shelf that fills up permanently over a whole career,
  rather than a one-time end-of-season reveal. Possibly the single most "garden-native" idea
  here — a real reason to open this screen between seasons.
- **Unlockable/purchasable decorations** — a real, small money sink (Shop-adjacent) tying
  into the existing economy: buy a bigger trophy cabinet, a nicer paddock, a fountain,
  seasonal decorations. Reuses the Shop's existing buy/own pattern rather than inventing one.
- **Other owned animals beyond the horse** — the ask says "maybe a horse" as one example, not
  the only one; if wanted, this needs its own small real system (a name, a species, no
  gameplay stats needed unless we want a second horse-style mini-game, which is likely
  overkill for e.g. a dog).
- **Visiting logic for teammates** — worth deciding whether "who's currently visiting" is
  purely cosmetic/random, or reads real relationship data (`relationships.team`, or a future
  per-teammate chemistry value this game doesn't currently track) to make it feel earned
  rather than arbitrary.

## Open questions before any building starts

1. **Which tier** — a designed static scene with real data overlaid (Tier 1), gentle
   scripted ambient drifting between fixed spots (Tier 2), or a genuine free-roam plaza with
   real sprite animation (Tier 3, a second engine, much bigger scope)?
2. **Art sourcing** — for Tier 1/2, are you planning to supply reference images/photos
   yourself for me to build the scene(s) from, or would you like me to search Adobe Stock
   for candidate backgrounds first (same process as the earlier profile-picture request)?
3. **Scope for v1** — trophies + horse only, or teammates visiting too in the very first
   version? (Given the tier discussion above, teammates-visiting is cheap at Tier 1 — just
   more figures on the same scene — so this mostly matters for Tier 2/3.)
4. **Extra owned things** — worth folding custom clubs / other Shop purchases into this
   screen in v1, or keep it strictly to what was asked (trophies, horse, teammates) and leave
   the rest as a clearly-flagged future idea (per the "idea bank" list above)?
