---
id: FACT-UI-022
type: fact
client: ui
tags: [ui]
status: live
date: 2026-11-12
source: "components/home/PublicHome.tsx:12-28"
summary: The new public home is on the test page /home-new-dev in three looks (a Stadium night, b Friv Classic, c Clean arcade); the live home is unchanged until Harry picks.
---
Harry, 12 Nov 2026 (recording): Road to the Golden Ball is the main thing, "Play now", a Friv style grid of games, a loading animation, beta sign-up, store links. Pieces: components/home/ (PublicHome, home.css, games.ts, storeLinks.ts, meta.ts). Order: loading picture, the game, Get the game, Join the beta, More games, contact. App Store and Steam are "Coming soon" tags until storeLinks.ts gets a real address. The beta box needs supabase/migrations/beta_signups.sql (NOT RUN, needs Harry's yes); until then it says "Sign-ups open soon". On this home the site bar hides its game links and games menu button. To go live: app/page.tsx returns <PublicHome look="…" /> and exports HOME_METADATA. Pictures: docs/stills/public-home/.
