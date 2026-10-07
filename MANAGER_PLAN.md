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
