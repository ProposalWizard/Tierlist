---
id: FACT-UI-018
type: fact
client: ui
tags: [admin, ui]
status: superseded
superseded_by: FACT-UI-020
date: 2026-11-03
source: "lib/star/gamePath.ts:1-20"
summary: Players reach the game at /road-to-ballon-dor; /star-dev forwards there, and the page's code stays in app/star-dev/.
---
Mikey, 3 Nov 2026: "star-dev is clearly like a development link." next.config.mjs shows app/star-dev's page at /road-to-ballon-dor and sends /star-dev (old links, home-screen icons) on to it, query kept, not permanent. Link to the game with GAME_PATH and test "am I in the game?" with isGamePath (both in lib/star/gamePath.ts), never the literal "/star-dev". The /star-*-dev test pages and /star-dev/media-lab keep their addresses. Saves are per site, so none were lost.
