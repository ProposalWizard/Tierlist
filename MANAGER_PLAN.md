# Manager relationship + office — decided, not built (Harry, 6 Oct 2026)

Harry: "I don't think the pens game is ideal for manager stuff, the relation
could have a few different options" → "all 3 choices for manager". And the
3D office is for manager moments (option 2).

## 1. The manager relationship: pick 1 of 3 each week
Same cost and the same +/- points scale as now. Router:
`components/star/relgames/RelationshipGame.tsx` (kind "boss" today goes
straight to BossPenalties). Add a small picker screen first.

| Choice | Build | Not easy because |
|--------|-------|------------------|
| Penalties | Mikey's `BossPenalties` (keep as is) | your aim, real engine |
| Office talk | `relgames/BossChat.tsx` + `Office3D` (kept, unreached since 5 Oct) | the best reply depends on the manager's style (press/possession/low/mid → effort / ideas / loyalty / discipline, from `lib/star/playstyle.ts`) and your recent form; his lines hint at the style, the answers never label it. Mikey dropped the old chat because it was "too easy to read" — that is the thing to fix. |
| Extra session | one training strike drill (`EngineFeature`, one-engine rule) while he watches | your drill score sets the result |

Tell Mikey: Penalties stays as one of the three.

## 2. The office for manager moments
Open `Office3DCareer` (components/star/Office3D.tsx) for: contract talks,
being dropped, being made captain, news about your place. Keep the
"Talk to your manager: 3D office | Old" switch (lib/star/look3d.ts) as the
Old fallback. page.tsx is shared: add phases, don't refactor.

## Built (7 Oct 2026)

**1. The picker.** Relations → Boss opens "Your manager" with 3 cards.
Back on the picker = the old Back. Back inside a game (before the first
kick/answer) returns to the picker. Cost is unchanged (page.tsx charges it
as before). All three use the penalties' scale (`bossGain`): +2 per "hit",
up to +6; no hits = −2.
- **Penalties** — Mikey's `BossPenalties`, unchanged.
- **Office talk** — `relgames/BossChat.tsx`, rules in `lib/star/bossTalk.ts`.
  His style comes from his name: a famous name's real style
  (`playstyleForManager`), else a fixed roll off the name. Style → what he
  values: press = effort, possession = ideas, low block/counter = discipline,
  mid-block = professional. 3 questions, 3 replies each: the one he values
  (+1), a neutral one (0), the one that clashes (−1). Score = max(0, total).
  Every value is best for one style and the clash for another, so no
  wording is "the nice one". Your last rating swaps the middle question:
  under 6 → he tests how you take it; 7.5+ → whether it went to your head.
  Measured (`tests/star/bossTalk.mts`): best answers = +6 every time; a
  random clicker averages −0.16.
- **Extra session** — `relgames/BossExtraSession.tsx`, scoring in
  `lib/star/bossSession.ts`. Four shots of Training's power drill
  (levels 3, 4, 5, 6 — a keeper from the first, a blocker from the third),
  on the real engine (`EngineFeature`). Goals 0/1/2/3/4 → −2/+2/+4/+4/+6.

**2. The office for manager moments** (Settings → Look → "Talk to your
manager": 3D office; Old = as before; a phone that can't run 3D falls back).
- Contract talks: a club's offer reason is said in his office, Continue →
  the talks as before (`ManagerMoments.tsx` `ContractInOffice`). A talk YOU
  ask for has no words from him, so it goes straight to the talks.
- Manager news on Home: full-screen in his office; Continue = the banner's
  own dismiss (`ManagerNewsInOffice`).
- Left out of the squad: the office sits above the "Not in the squad" card
  (`LineupIntro.tsx`); the card's buttons work as before.
- **Not done:** being made captain (the armband is given silently in
  `careerFlow.ts`; no screen says it) and being dropped to the bench (the
  team sheet just shows you on the bench; no screen says it). Each needs a
  new screen first, which is a design call.
