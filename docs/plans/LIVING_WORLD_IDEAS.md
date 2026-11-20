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
