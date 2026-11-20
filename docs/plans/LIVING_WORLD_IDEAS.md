# Living world ideas (Harry, 20 Nov 2026)

"Bit by bit but this needs to work on mobile and PC — this turns it from AI slop to
revolutionary football career mode game." Idea bank, not designed yet. Brain: RUL-UI-013.

## 1. Hair that grows (Red Dead Redemption style)
"ur hair and potentially facial hair grows over a szn naturally and then when in ur
bathroom u can style it and u can also go to a barbers"
- Hair length and beard grow week by week through a season (a number on the career).
- The look follows it: hair goes through length steps (short → medium → long) and the
  face goes stubble → short beard → full beard.
- Bathroom (the house already has a dressing room with a wardrobe and mirror): trim,
  shave, restyle yourself; a barber (a place to visit, costs money) for styles you can't do.
- Already in the game: hair styles and colours (lib/star/playerIdentity.ts HAIR_STYLES),
  a 3D hair system on the bodies, the dressing room (home3d TIER_ROOMS "dressing").
- Fame/reputation/sponsor hooks later (a sponsor that wants a clean look, a lucky beard).

## 2. A training centre you live in
"a training centre where u can actually interact with teammates in like a food hall,
and they naturally go about their day"
- A 3D training ground: pitch, gym, physio, canteen/food hall, changing room.
- Team-mates follow a simple daily routine (arrive, gym, canteen, train, leave) on a
  clock, with idle animations; walk up and tap one to talk (relationships already exist).
- Small cast (6–10 people visible), simple schedules, not a full life sim.

## 3. Random events
Already brainstormed in STAR_LIFE_EVENTS.md (366 lines) and lib/star/dilemmas.ts; these
tie in: a scene in the canteen, a call on the 3D phone, something at the barber.

## 4. Driving (RUL-UI-012)
From the house to training / matchday in your own car.

## Mobile and PC
Every piece has a phone version first (small casts, still frames at rest, LOD, the
quality governor) and a richer PC version where it is worth it.

## Harry, 20 Nov 2026 (05:20) — the bigger picture

"I want to literally have 1,000, 1,500 random events. I want it to feel almost like a GTA … and I want
these events to have a feeling." "Random events need to feel like they have weight, and they can't just
happen for the sake of it." "The star pass obviously needs updating in with that."
- **Memory (nemesis-style):** "if I'm having a random event happen with an NPC … they should remember that."
- **Every event has an effect:** reputation +1, or the relationship with that team-mate up or down, "like the Sims".
- **Social actions:** "You click on a teammate, and you have options of what you can say with them. Maybe you can
  take them to go horse racing, maybe you can take them in your car for a drive, and then a random conversation."
- **3D areas:** the training centre and food hall approach "need to translate across all the 3D areas"; every 3D
  area needs a pass on look, lag and "making sure characters interact with the world. Are they walking around?"
- **Research asked for:** driving to training/matchday (repos), hair growth/barber/bathroom (repos + Red Dead ideas).

From Harry and Mikey's chat (20 Nov, 03:13–03:19):
- Events while driving: "maybe u get a call and ur teammate asks to borrow smth … yes/no", "a random agent call".
- Mikey: random or staged events "have to be fully built before going into the game. Otherwise it's just in there and being weird."
- Harry: "completely ur career u do what u want, but based on where u are there's loads of set events and cut scenes."
- "u click on training one time and randomly a club legend chillin there … 1 vs 1 in front of the squad … u play a
  random game vs him … and then u get his boots."
- Mikey: "We haven't done the star pass properly … Imagine at lvl 10 you get that legend walk in and if you impress you get smth."
- Harry: map story elements to star pass levels ("level 10 would happen averagely at like 20 yrs old"); "events
  rather than gifts — beat club legend, unlock celebration, wager ur car vs him".
- PC first; phone gets the simple 3D areas (phone, house, casino); training and in-game 3D maybe PC only.

## Camera for 3D areas (Harry, 20 Nov 2026, 05:45)
"D is good and should be the base for all 3d areas — I do think maybe you should be able to zoom out though?"
Camera D: as close as C, centred straight behind you, a slightly higher angle like A. Pinch/scroll to zoom out
towards A's distance. Every 3D area (house, garden, shop, casino, training centre) uses it as the default.

## Every house, fully 3D (Harry, 20 Nov 2026, 14:55)
On the world-kit test (sofa + TV, fridge): "things like the fridge and couch + tv are genuinely incredible, if we
have this level of 3d throughout the game this is gonna be insane, the environment and house itself is looking
better but could still improve, also remember there is gonna be like 2-8 house options and we need 3D FOR ALL OF them."
=> Every house tier (starter, flat, penthouse, house, villa, estate, and any later ones) gets the full 3D treatment:
its own rooms, look pass, and usable things (sofa, TV, fridge, bed, mirror, shower, gym, pool…) from the world kit.

## Decision and talk screens (Harry, 20 Nov 2026, 15:05)
"look more in depth in walking dead telltale games and sims for the options to talk to people, I think the screens
could be way better when making decisions even maybe with the timed slow motion effect"
=> Research Telltale (The Walking Dead) choice screens and The Sims social menus; propose better decision/talk screens
for the living-world events and team-mate chats, including a timed choice with the world slowing down behind it.

## Decision screens: all three, each for its job (Harry, 20 Nov 2026, 15:35)
"I love all of these, especially sims and telltale, think they can both be in the game, I love the sims round bar to
decide what to interact on and then the telltale for actual conversing - also for random events where the other person
forces the interaction with you or something happens telltale is perfect - think there's a use for the football mix too,
maybe press conferences, training stuff, dilemmas etc - this has opened up a whole new avenue in the game"
=> Sims round menu = choosing what to do with a person you tap. Telltale = the conversation itself, and any event
where the other person (or the world) forces the moment. Football tone dial = press conferences, training, dilemmas.

## "Revolutionary", not "2010 indie web game" (Harry, 20 Nov 2026, 15:35)
"when I look online I see these amazing AI 3d games, perfect no clipping, great environments … the way their
characters move, interact with objects, the environment around them it's all so clean. I feel like there's something
we haven't found, a way to have lag free, stylised, perfect animations, perfect environments - whether this is github
skills, paid blender projects, using animation inspiration from games like gta and red dead 2 (maybe finding open
source movement/interaction animations). Right now it looks like a classic indie web game from like 2010 - I want
REVOLUTIONARY."

## Events need follow-through (Harry, 20 Nov 2026, 16:00)
"it's important that they have follow through - kit man offers to stay with u - what happens if u say yes? Random ex
legend challenges u - the game mode u play has to be built - a conversation should be able to go multiple rounds and
not just be simple - I have a de-ai skill in my zocialgen repo - maybe try using that - analyse stories like gta, red
dead and the nemesis system. follow through complexity and a story that comes back even seasons on is great."
"We could change the shop area to the training compound and then move that shop into a different bigger shop which
would allow for more random events maybe, remember we had a whole plan for garden level by star pass/club size too"
=> Events v2: say yes and you PLAY it (the hundred balls drill, the legend 1v1 as a real game mode); conversations of
several rounds; arcs that return seasons later. Writing passes through the de-ai skill
(harryv2157-dev/zocial-gen-operations .claude/skills/de-ai). Places: the shop's spot becomes the training compound; the
shop moves to a bigger shop; garden levels by star pass / club size (docs/plans/2026-10-19/harry-answers-round.md:164).
The remaining ~1,420 events are NOT written until the v2 format is agreed.

## Go-ahead and Zelda (Harry, 20 Nov 2026, 16:50)
"yes merge the 50 events and build the kit man story, also another game to look at for very cool side quest
maintenance is Zelda - ocarina of time is a good one and breath of the wild"
=> 50 trial events merged into Harry (80 in the book). The kit man arc ("A hundred balls in the dark") is being built
for real. Side-quest upkeep to study: Ocarina of Time (the trading sequence, mask quests, people whose lives change
between child and adult time) and Breath of the Wild (the quest log, Tarrey Town built up over visits, Kass).
