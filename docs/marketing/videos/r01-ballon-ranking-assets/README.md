# r01: Ballon d'Or ranking countdown (test list, Mikey 26 Nov 2026)
Format from a TikTok: opens on 17 sliding in (20-18 already shown), 17 to 6 revealed one by one (2 s each), top 5 hidden as silhouettes ("WHO'S YOUR TOP 5?"), part 2 tomorrow. 29 s.
- cut/: players cut out (rembg isnet-general-use) from Wikimedia Commons photos (credits.json; CC BY-SA 4.0 / public domain; credit line in the video). raw/: the originals.
- stadium/: three blurred stadium backgrounds (Higgsfield), one per player in turn, so the player is never shown twice.
- podium_cut.png: the Ballon d'Or on a black marble podium (Higgsfield, from a Wikimedia photo of the real trophy), cut out and made solid. Its ball is also the big gold curve on the left.
- badge/: club badges from the game's club_logos store; flag/: flagcdn.com (public domain flags).
- Font: Montserrat 800/900 (tools/video-factory/assets, OFL). Text is centred by its cap height; check with tools/video-render/ranking/check_centre.mjs (prints each number's and name's offset from the box centre, from the pixels).
- ranking.json: the list (rank, name, cut, badge, flag). Render:
  `node tools/video-render/ranking/render.mjs docs/marketing/videos/r01-ballon-ranking-assets/ranking.json OUT.mp4` (add a music file as a 3rd argument only if you want sound)
- Layers, back to front: stadium, gold sparkles (in waves), player, the gold panel (the ball's panels close up, right edge a "(" curve), board, trophy on its podium (always in front, down to the bottom edge).
- The front silhouette at the end is always Noni Madueke ("front" in ranking.json), whatever the top 5 is (Mikey, 26 Nov 2026).
- The gold panel is the TikTok's measured size (Mikey, 26 Nov 2026): its right edge is a circle, 55% of the width at the top and bottom, 40% in the middle (EDGE in ranking.html); outline 7 px. Measured from the empty rows above and below their board, because the board hides the edge in the middle.
- Madueke's silhouette wears a silver chain with a "NONZINO" pendant ("chain" in ranking.json, drawn by chain() in ranking.html onto the front silhouette).
- v6 (Mikey, 26 Nov 2026): the gold panel is a still picture, made by tools/video-render/ranking/make_gold_panel.py (a lit golden football with real seams; gold_panel.png), clipped to the curved edge and never moving. Players are drawn tall (head near the top, zoomed out only when too wide). No audio: render without the music argument. Ending: box says TOP 5 / REVEALED TOMORROW, button says WHO'S YOUR TOP 5?
- v7 (Mikey, 26 Nov 2026): players 20% smaller (max height 1456, max width 1160, head top at y=300, centre x=825; set playerH/playerW/playerTop/playerX in ranking.json to change). The bottom of each cut-out fades into the dark so there is no hard cut-off line.
