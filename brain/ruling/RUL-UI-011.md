---
id: RUL-UI-011
type: ruling
client: ui
tags: [economy, ui]
status: live
date: 2026-11-19
source: "docs/brain-sources/harry-chat-2026-11-19.md:38"
summary: Money should be £ instead of dollars (£ pounds): the shop goes into the game, the Owner app gets Money + Reputation, the Sponsors fame pill goes.
---
Harry, 19 Nov 2026, later the same day as RUL-UI-009: "should it be £ instead of
dollars" → "£ pounds". Replaces RUL-UI-009's "$" only; its bars table stands,
with two additions: the phone's Owner app (Ownership) shows Money + Reputation
("yes"), and the Sponsors header's "★ N fame" pill goes (the Fame bar shows it;
Harry: "idk", my call).

- One sign everywhere: `MONEY_SIGN` ("£", lib/star/money.ts). ★ is only the star level.
- Bar icon: public/icons3d/cash.png, a green 3D note with a raised £
  (tools/blender-shop/scripts/icons3d.py `cash`).
- The money pill reads "£12.4k", sign and number as one word.
