---
id: RUL-UI-009
type: ruling
client: ui
tags: [three-d, economy, ui]
status: live
date: 2026-11-19
source: "docs/brain-sources/harry-chat-2026-11-19.md:31-35"
summary: Every page has the relevant stats as the top 2 bars, in the Home bar style (3D icon over the bar): shop fame + money with a dollar bill icon; phone level + money; relations happiness + rep.
---
Harry, 19 Nov 2026. Extends TopHud's HUD_SPEC (P13, 1 Oct) from one swapped bar
to BOTH bars per page. Not built yet.

| Page | Left | Right |
|---|---|---|
| Home, Stats, League, Training | Star level | Energy |
| Shop | Fame (crown) | Money (3D dollar bill, public/icons3d/cash.png) |
| Style | Reputation | Fame |
| Relationships | Happiness | Reputation |
| Sponsors | Fame | Money |
| Phone | Star level | Money |
| Investments | Money | Reputation |
| Casino | Money | Happiness |
| Settings | none | none |

Shop extras: Fame shows a lighter piece for what the item would add
(fame.ts fameGainFromBuying); Money shows the item's cost striped.
Money's sign becomes $ everywhere (prices, wages, shop) — ★ then means only the
star level. Separate note on the shop layout: RUL-UI-010.
