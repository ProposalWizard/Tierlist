# Handoff: the story world, on the API credit (28 Nov 2026)

Paste the block under "Starter" into a NEW chat in the "The space" environment,
repository ProposalWizard/Tierlist, branch Harry. That environment has
ANTHROPIC_API_KEY, so the heavy work is paid from the API credit.

## Starter

You are running the Knowitball story world build overnight, paid from the
ANTHROPIC API CREDIT (the key is in this environment as ANTHROPIC_API_KEY —
never print, log or commit it). Read CLAUDE.md, then
docs/handoffs/story-world-api-2026-11-28.md (this file) in full, and follow it.
Work on branch Harry. Plain English to Harry (not a coder), progress updates
every 20 minutes with pictures, and nothing goes to main unless Harry says
"push".

## What Harry wants (his words, 28 Nov 2026)

- "I want stories and talking to people to be perfect."
- "Stories can be unbelievable … if it gets to a point where you need to create
  a new cut scene, a new area, a new skill, a new thing that unlocks
  specifically when you get to that cut scene, or at a certain star pass level,
  or when you hit a certain age, or when you go to Chelsea, when you go to
  Manchester United — maybe at United you visit the Busby Babes / heritage area
  and meet a club legend — there's so much we could do."
- "Just needs to be so much depth and memory and an amazing feel."
- "Make some of them much rarer, some less, and some only unlock based off other
  stories." (done: tiers + 27 chains)
- "Run them all on the API credits."

## Where it stands (all on branch Harry, not live as stories)

- 216 stories in lib/star/life/book/arcs/*.json, each with a career stage, a
  rarity tier (Common 40, Uncommon 113, Rare 55, Very rare 4, Legendary 4) and
  27 follow-on chains. Map and numbers: docs/plans/STORY_BOOK_MAP.md.
- Club people are per club (kit man, legend, physio, groundsman, canteen,
  coach, chairman). The kit man story starts by chance under 21, hard stop at 21.
- Save storage: finished stories ~14 bytes; the life block limit is 50 KB
  (LIFE_BLOCK_LIMIT in scripts/soak/lifeSoak.mts).
- Den and the gaffer have 67 paid voice lines (scripts/life/voice-lines.mts).
- Stories are switched OFF in real careers (lib/star/life/flag.ts). Keep them
  OFF until Harry says they are perfect.
- The people plan: docs/plans/PEOPLE_AND_MEMORY_PLAN.md (clock, visitors,
  conversation menu, one memory model, 46 things to do). Phases 1–3 (clock,
  visitors, real effects) are being built in another chat — do not touch those
  files (world3d/houseLife, Home3D, the clock).
- The Story Book page (every story, being redesigned with real screenshots):
  https://claude.ai/artifact/NbhaQ4z6SJPUiErUiQHQW7 — generator
  scripts/life/story-book-page.mts.

## How to spend the API credit

1. Prove it works first: `claude -p "Reply OK" --model claude-haiku-5-5
   --output-format json` must return is_error false and total_cost_usd > 0.
   If not, write the exact error type (never the key) and stop.
2. Run the jobs below as headless API jobs:
   `claude -p "<job prompt>" --model claude-opus-5-5 --output-format json
   --max-turns 200` from their own git worktree (one per job, from branch
   Harry), at most 3 at once. Record each job's total_cost_usd. Budget for the
   night: stop starting new jobs once the total passes $150, and report it.
3. After each job: read its diff, merge the latest origin/Harry, run the checks
   below, then push to Harry.

## The jobs (in this order)

A. STORY WORLD PLAN (alone, first) — docs/plans/STORY_WORLD_PLAN.md:
   - an UNLOCKS registry: places, cut scenes, skills, items, game modes — id,
     what unlocks it, what it does, build status;
   - new start conditions: by club (ids from lib/star/clubs.ts), star pass
     level, age milestones, caps / first call-up, trophies;
   - club hooks for the 20 biggest English clubs + 6 big European ones: an
     invented club legend, a place at the club, a tradition, a rivalry moment;
   - memory across stories (one memory model, per the people plan);
   - the list of new things stories need, including the 10 stories waiting on
     unbuilt games.
   Show Harry the plan (a short segmented page) before job B starts.
B. ENGINE HOOKS: the new conditions and the unlocks registry + an "unlock"
   effect a story can grant (small in the save, shown in the ending). Additive
   only; old saves must load (tests/star/lifeSaveFixture.mts).
C. CLUB STORIES: 40 new stories across the clubs in the plan (many legendary /
   very rare at the biggest clubs), each tied to its club and using the unlocks,
   deep (middle beats, callbacks seasons later, memories other stories read),
   chained together; plus 15 last-seasons stories (ages 34+ run dry today).
D. GAME MODES FOR THE WAITING STORIES (alongside C): head tennis, two-touch,
   1v1 duel, penalties, testimonial/charity match, the gym board, karting, the
   drive, the sprint race, five-a-side. Build the smallest real version each
   story can use. Anything with a ball runs on the REAL match engine (read
   .claude/skills/one-engine/SKILL.md; never a copy of the engine); the rest
   (karting, sprint, drive) as simple mini-games in the game's style. Wire each
   story so it plays on the life test page (/star-life-dev).
E. THE STORY BOOK: regenerate and republish it after each job (same URL), so
   Harry can read every new story with screenshots.

## Rules for every job

- No Higgsfield or any paid image/voice service without Harry's yes to an exact
  proposal (what, how many, model, cost).
- No real people's names or real brands. Club legends are invented. Real
  tragedies (e.g. Munich 1958) are only honoured respectfully — never
  dramatised, never given invented words.
- Never edit scripts/one-engine-guard.mjs.
- Plain British football voice, short lines, specific details; run the de-ai
  check if present; no AI-shaped lines.
- Before each commit: the story checker; `npx tsx tests/star/lifeArcs.mts`,
  `lifeEvents.mts`, `lifeSaveFixture.mts`, `lifeVoice.mts`; the soak
  (`scripts/soak/lifeSoak.mts`); `NODE_OPTIONS=--max-old-space-size=5000 npx
  tsc --noEmit -p tsconfig.json`; `node scripts/one-engine-guard.mjs`;
  `node scripts/admin-look-guard.mjs`.
- Nobody has seen these stories on a phone yet: say so in every report.

## Other chats working at the same time (don't touch their files)

- People plan phases 1–3: the clock, visitors, Home3D, houseLife, HousePhone.
- The compound test place (lib/star/world3d/compound*), the walk (people/life.ts,
  stride, cut-scene timing), the gym-from-Training button, the saves fix
  (storage.ts, career route), the Story Book redesign (until it lands).

## Open questions for Harry (ask, don't assume)

1. Switch stories on for our three accounts first? (suggested: yes, once he
   calls the Story Book perfect)
2. The kit man start chance: 0.05 (88% of careers starting at 17 meet him) or
   0.08?
3. The 5 people-plan questions in docs/plans/PEOPLE_AND_MEMORY_PLAN.md.

## Status after the first try (28 Nov 2026, night)

Step 1 stopped the run. Error type: **ANTHROPIC_API_KEY not set** in "The space".
`claude -p` still answered (is_error false, cost shown about $0.003), but with no
key it is billed to the chat account, not the API credit. So no jobs were started.
A network secret can't hold this key (Anthropic hosts are refused). Fix: Harry
adds `ANTHROPIC_API_KEY` as an environment variable in "The space" settings
(cloud environment menu → Edit → environment variables), then starts a NEW chat
with the starter above. Before job A, check `[ -n "$ANTHROPIC_API_KEY" ]` as well
as the test call.
