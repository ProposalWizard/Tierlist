---
id: FACT-TEAM-003
type: fact
client: team
tags: [ui, team]
status: live
date: 2026-11-12
source: "components/teamRoom/roomLook.css:1-30"
summary: The Team room has two looks: Dark = Midnight slate, Light = Light C. It follows the device until you tap the sun/moon beside your name (per device). Faces are club-style crests.
---
Harry, 12 Nov 2026, from the four option pictures (docs/stills/team-room-options): "Midnight slate and Light C as dark/light mode." Paint only: two palettes override the room's colour tokens on `.trr-host[data-room]` (roomLook.css); the choice (Auto, Dark, Light) is kept on the device (components/teamRoom/roomLook.ts, key kib-tr-look). Light C's channel list is dark green and carries its own inks. Faces: a crest per person and a round badge per bot (components/teamRoom/bits.tsx Crest, BotFace); there is no profile-picture field yet. Text contrast is measured, not judged: `node scripts/team-room/contrast.mjs` (12 Nov 2026: 5,604 texts, 23 screens x 2 looks x 2 sizes, lowest 4.5:1, 0 under). Full ruling: .claude/skills/ui-house-style, 12 Nov 2026.
