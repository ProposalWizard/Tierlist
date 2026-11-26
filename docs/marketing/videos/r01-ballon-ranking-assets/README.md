# r01: Ballon d'Or ranking countdown (test list, Mikey 26 Nov 2026)
Format from a TikTok: opens on 17 sliding in (20-18 already shown), 17 to 6 revealed one by one (2 s each), top 5 hidden as silhouettes ("WHO'S YOUR TOP 5?"), part 2 tomorrow. 29 s.
- cut/: players cut out (rembg isnet-general-use) from Wikimedia Commons photos (credits.json; CC BY-SA 4.0 / public domain; credit line in the video). raw/: the originals.
- stadium/: three blurred stadium backgrounds (Higgsfield), one per player in turn, so the player is never shown twice.
- podium_cut.png: the Ballon d'Or on a black marble podium (Higgsfield, from a Wikimedia photo of the real trophy), cut out and made solid. Its ball is also the big gold curve on the left.
- badge/: club badges from the game's club_logos store; flag/: flagcdn.com (public domain flags).
- Font: Montserrat 800/900 (tools/video-factory/assets, OFL). Text is centred by its cap height; check with tools/video-render/ranking/check_centre.mjs (prints each number's and name's offset from the box centre, from the pixels).
- ranking.json: the list (rank, name, cut, badge, flag). Render:
  `node tools/video-render/ranking/render.mjs docs/marketing/videos/r01-ballon-ranking-assets/ranking.json OUT.mp4 public/star/music/09-last-attack.mp3`
- Layers, back to front: stadium, gold sparkles (in waves), player, the gold panel (the ball's panels close up, right edge a "(" curve), board, trophy on its podium (always in front, down to the bottom edge).
- The front silhouette at the end is always Noni Madueke ("front" in ranking.json), whatever the top 5 is (Mikey, 26 Nov 2026).
- The gold panel is the TikTok's measured size (Mikey, 26 Nov 2026): its right edge is a circle, 55% of the width at the top and bottom, 40% in the middle (EDGE in ranking.html); outline 7 px. Measured from the empty rows above and below their board, because the board hides the edge in the middle.
- Madueke's silhouette wears a silver chain with a "NONZINO" pendant ("chain" in ranking.json, drawn by chain() in ranking.html onto the front silhouette).
