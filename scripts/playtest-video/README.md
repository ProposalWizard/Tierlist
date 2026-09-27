# Playtest video breakdown

Turns an OBS screen recording of a playtest into pictures and a transcript,
side by side, so every comment can be checked against what was on screen.
The workflow for Claude is in `.claude/skills/playtest-video/SKILL.md`.

## Recording (Harry / Mikey)

- **OBS**: Settings → Output → Recording Format **mp4** (or mkv, then File →
  Remux Recordings → mp4). 1080p at 30 fps is plenty.
- **Turn the microphone on.** The talking is half the value: it becomes a
  timestamped transcript lined up with the pictures.
- On a phone: the built-in screen recorder, with the microphone switched on.
- Put the file in Google Drive → Share → **Anyone with the link** → paste the
  link to Claude.

## Running it

```bash
bash scripts/playtest-video/setup.sh
python3 scripts/playtest-video/fetch.py "<drive link>" --name harry-0927
python3 scripts/playtest-video/breakdown.py .playtests/harry-0927/video.mp4
python3 scripts/playtest-video/breakdown.py .playtests/harry-0927/video.mp4 --clip-only --clip 12:31-12:34 --clip-fps 20
```

Output, in `.playtests/<name>/` (git-ignored):

| File | What it is |
|---|---|
| `index.md` | Every stretch of the video, what was said in it, which sheet shows it |
| `transcript.txt` / `.json` | Everything said, stamped `[mm:ss]` |
| `frames/` | One picture each time the screen really changes, at least every 8 s |
| `sheets/` | Those pictures twelve to a page, each stamped |
| `clips/<from>/` | Every frame of a short stretch (`--clip`), for fast moments |

Tested 27 Sep 2026 on a recorded 47-second session of the real game with a
speech track: 37 frames on 4 sheets, the speech transcribed word for word in
17 s, a 2-second clip at 15 fps (31 frames). A full hour at 1080p has not
been run yet — expect minutes, not seconds; `--fast` for a quick first pass.

## Checking what a frame can't show

A recording shows what happened. What the game was doing underneath (the
keeper's position, whether he had started his dive) needs the real game in a
browser with its state read every frame. That is how the keeper's timing in
patch notes v0.15 was measured: a temporary line in `CanvasMatch.tsx` exposing
the scenario and ball on `window`, and a Playwright script reading them on
every animation frame while it played real shots. The line is removed before
anything is committed.
