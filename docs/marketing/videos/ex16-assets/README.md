# ex16 pictures and moving clips (Why Vini loves Mourinho, not Alonso)
Remake of a TikTok's story (Mikey, 25 Nov 2026), full screen, no talking head, facts checked (see the story's "facts").
- Pictures: Higgsfield GPT Image 2.6 (medium, 2K, 9:16), from Wikimedia reference photos of Mourinho, Vinícius and Xabi Alonso.
  *_portrait_cut.png: the portraits with the grey background cut out (flood fill), used by the versus scenes.
- clips/: Higgsfield Kling 3.0, 5 s, each started from the picture of the same scene, sound removed.
To rebuild: copy the pictures to tools/video-factory/work/ex-people/ (portraits as xabi_cut/jose_cut/vini_cut.png),
clips to tools/video-factory/work/clips/, then `python3 make.py stories/ex16-mourinho-vini.json`.
