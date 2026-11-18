# X vs 1000 cuts (golden ball)

Knowitball's own version of the "X vs 1000 cuts" format (references R18-R22 in
`docs/marketing/video-ideas.md`). A gold ball with a football core, on a board,
cut in rounds of 10 / 100 / 1000. All drawn in three.js; sounds made in code.

Run from a folder that has `three@0.169` in `node_modules` (npm i three@0.169)
and these files, with a local server on port 8765 (`python3 -m http.server 8765`):

1. `node stills.mjs 100 4.5 8.7` — test stills at chosen seconds.
2. `node render.mjs 100` — frames to `frames100/` (1080x1920, 30 fps; new page every 250 frames, FACT-KIB-008) and `events100.json`.
3. `python3 audio.py 100` — `audio100.wav` from the events (chops, swishes, crunches, landing ticks; silence in the two pauses).
4. `ffmpeg -framerate 30 -i frames100/f%05d.jpg -i audio100.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest out.mp4`

Known flaws (7 Nov 2026): one-frame grey box at about 3.5 s in the 10-cut round;
the knife swings across the board between moves.
