# Bicycle kicks and a "flair" stat — plan only (B10, 20 Oct 2026)

Mikey's idea, via Harry: *"bicycle kicks; a 'flair' stat that grows with fame;
trying them, and hitting the centre of the ball matters more."* Nothing here is
built. It sits on top of B10 (headers and volleys back on, the ball in the air
with its shadow, `airContactRead` in `lib/star/airborneChance.ts`).

## 1. The flair stat

- One new number, 0–100, on the career (`CareerState.flair`). Starts at 15.
- It is NOT trained. It comes from two places:

| Source | How much | Why |
|---|---|---|
| Fame (`fameOf(career)`, 0–100) | flair floor = 15 + 0.5 × fame | A famous player is given licence to try things |
| A clean trick (a bicycle kick met clean) | +1, a goal from one +3 | You earn it by doing it |
| A season with none tried | −2 (never below the fame floor) | It fades if unused |

So an Unknown (fame 0) sits at 15, a Global Star (fame 60) at 45 or more, an Icon
(fame 80) at 55 or more. Shown on Stats, under Technique.

## 2. When a bicycle kick is offered

- Only on a header or a volley chance (the ball already in the air), 6–14 m
  from goal, with the ball arriving from beside or behind you (the crosser
  level with or behind you).
- How often: flair decides. A "Bicycle" button on the strike screen on
  flair / 2 % of those chances (15 → 7.5%, 45 → 22.5%, 80 → 40%).
- Measured today (B10): 0.92 headers and volleys a match in the even mix
  (40 matches). Reasoned from that: offered about once in 14 matches for a new
  player (0.92 × 7.5%) and once in 3 for an Icon (0.92 × 40%), fewer once the
  6–14 m rule bites.

## 3. The input

Two options for Harry to pick (shown, not described, before building):

- **A. One more button on the strike screen.** "Head it?" / "Volley it?" gets
  a third choice, BICYCLE. Same tap on the ball, but the middle ring is half
  the size and the timing band (the green on the height meter) is half as wide.
- **B. Hold and let go** (the deleted `/star-bicycle-dev` prototype, Oct 2026):
  hold to swing your legs over, let go as the ball drops through the green.
  A sideways drag while holding leans it left or right (up to 22°).

Recommended: A. It reuses the strike screen everyone already knows, and B
needs a side-on camera the match does not have.

## 4. How it is judged

The same rule as B10's volley (`airContactRead`), only stricter:

| | Volley (built) | Bicycle (plan) |
|---|---|---|
| Clean if met within | 0.2 ball radii of the middle | 0.1 |
| Timing band (share of the bounce) | 0.25–0.9 | 0.4–0.8 |
| Off line at worst | 26° | 40° |
| Pace when clean | ×1.06 | ×1.2, and the keeper reacts later (he cannot read your body) |
| Technique and flair soften a miss | technique | technique + flair |

A clean one is a big moment: the media feed and the crowd treat it like a
hat-trick goal. A miss is a miss (no injury, no foul).

## 5. What it costs

| Piece | Size |
|---|---|
| Flair stat, its fame floor, Stats row, old saves backfilled | small (half a day) |
| Offer rule + BICYCLE button on the strike screen | small |
| Strike rule (stricter `airContactRead`) + tests + measured conversion by flair | small |
| The picture: a 2D bicycle pose; a 3D clip (none exists yet: a Blender/mocap job, `docs/3D_HANDBOOK.md`) | medium — the biggest part |
| Media lines and crowd | small |

About 2 build days, most of it the animation. No change to the match engine
(`canvasEngine.ts`): it is a strike rule on top of `launch`, like B10's.

## 6. Questions for Harry

1. Input A or B?
2. Should flair also unlock other tricks later (rabona, scorpion), or bicycle kicks only?
3. Offer rate: flair / 2 % of air chances — more, or fewer?
