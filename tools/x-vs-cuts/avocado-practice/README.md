# Avocado practice copy (7 Nov 2026)

A practice copy of R22 ("Avocado vs 1000 cuts", @jackescapes01): learn the
format exactly, then make our own. Never post this copy; the video itself is
not kept in the repo.

- Timeline measured from the original: both counters read on every 3rd frame
  (tesseract, run with OMP_THREAD_LIMIT=1 or it crawls). 6 rounds of 10, 50,
  100, 250, 500 and 1000 cuts; each: down, a silent pause, sideways, a silent pause, dice.
- `plan.json` (rebuild from the readings) holds each round's phase times and
  cut counts, the camera, and the counter text per frame.
- `node render.mjs <from> <to>`: frames, run 4 parts at once (about 50 min for 72 s).

Known differences from the original: the sideways knife is turned wrong (its
handle sticks up); motion-blur copies of the knife show under the board; the
skin goes pale under very dense cut lines; the stone is not clearly shown in
the last round's cut face.
