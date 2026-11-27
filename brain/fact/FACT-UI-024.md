---
id: FACT-UI-024
type: fact
client: ui
tags: [ui, admin, rule]
status: live
date: 2026-11-26
source: "lib/siteLook/look.ts:1-20"
summary: The New look preview: an admin-only switch (Admin → New look, or ?look=v2 / ?look=off) shows the new site look on that device only, Light (cream) or Dark; public pages only, never the game or admin. All Tailwind colours read CSS variables whose normal values are Tailwind's own.
---
Leo, 26 Nov 2026: "is there a way I can test all this without having to change the entire website … just make it a lil secret admin setting." Cookie kib_look=v2 (+ kib_theme). html gets data-look/data-theme/data-scope (boot script in app/layout.tsx, kept in step by tests/siteLook.mts). Colours: lib/siteLook/palette.ts (light swaps each scale's pale and dark halves; indigo/purple/violet become the Play-now green; the top bar and footer use the dark set on green). Frame CSS: app/site-look.css. New site work goes behind this switch until Leo says go; going live means making the preview values the normal ones. Decisions (Leo, 26 Nov): dark mode as an option, keep the game links in the top bar, bring Tierlists back, everything for Draft, Ten-A-Ball challenge of the day.
