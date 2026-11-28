---
id: RUL-UI-014
type: ruling
client: ui
tags: [ui, rule]
status: live
date: 2026-11-26
source: "scripts/site-look/contrast.mjs:1-20"
summary: Any change to the site's look must pass the readability check (scripts/site-look/contrast.mjs) on every public page, light and dark, signed out AND signed in, phone and computer, before it ships; never only signed-out pictures.
---
Leo, 26 Nov 2026, after the Hall of Fame boards came out unreadable in the new look (only visible signed in): "you should NEVER be letting stupid shit like this pass. so so easy to check for surely." The check measures every text against what is really behind it (3 : 1 minimum), fakes a signed-in player and an admin inside the test browser, and a local build can borrow the live site's data with --api-from https://knowitball.co.uk. Dark-made art cards (Mikey's Draft pictures) are kept dark on the cream page, measured automatically (lib/siteLook/keepDark.ts).
