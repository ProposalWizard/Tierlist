# r01: Ballon d'Or ranking countdown (test list, Mikey 26 Nov 2026)
Format from a TikTok: 20-18 shown at the start, 17 to 6 revealed one by one (2 s each), top 5 hidden as silhouettes ("WHO'S YOUR TOP 5?"), part 2 tomorrow. 29 s.
- cut/: players cut out (rembg isnet-general-use) from Wikimedia Commons photos (credits.json; CC BY-SA 4.0 / public domain; credit line in the video). raw/: the originals.
- stadium/: three blurred stadium backgrounds (Higgsfield), one per player in turn, so the player is never shown twice.
- podium_cut.png: the Ballon d'Or on a black marble podium (Higgsfield, from a Wikimedia photo of the real trophy), cut out and made solid. Its ball is also the big gold curve on the left.
- badge/: club badges from the game's club_logos store; flag/: flagcdn.com (public domain flags).
- Font: Montserrat 800/900 (tools/video-factory/assets, OFL). Text is centred by its cap height; check with tools/video-render/ranking/check_centre.mjs (prints each number's and name's offset from the box centre, from the pixels).
- ranking.json: the list (rank, name, cut, badge, flag). Render:
  `node tools/video-render/ranking/render.mjs docs/marketing/videos/r01-ballon-ranking-assets/ranking.json OUT.mp4 public/star/music/09-last-attack.mp3`
