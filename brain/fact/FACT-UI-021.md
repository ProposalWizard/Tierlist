---
id: FACT-UI-021
type: fact
client: ui
tags: [ui, admin]
status: live
date: 2026-11-12
source: "components/admin/shell/houseTokens.css:1-16"
summary: The admin's default look is "Knowitball": calm tiles on the admin home, a dark green menu and rows everywhere else; the four older looks stay as skins.
---
Harry, 12 Nov 2026, from option pictures (docs/stills/admin-look-options): "A for admin home and C for the rest — however I think we can do one more pass over and improve it a lot." Built as the look `house` (lib/adminLook.ts), named Knowitball on the Look switch, the one every browser starts on; Broadcast, Bento, Ops room and Clean light stay as skins (RUL-UI-007). Rules for anything added to the admin: one font family; type 12/14/16/20/24 px; spacing 4/8/12/16/24/32; corners 6 px on controls, 8 px on boxes; one button (outline, main action green); green only for the current page, the main action and a good status; no tracked capitals, no violet, no pills except the recorder pill; small text at least 4.5:1 (measure: node scripts/admin-look/shots.mjs). Shell: components/admin/shell/house.css; framed pages: components/admin/broadcast/skins.css. Replaces "Clean light is the default" (20 Oct 2026). Full ruling: .claude/skills/ui-house-style, 12 Nov 2026.
