# Screen recording breakdown

Turns a screen recording, with you talking over it, into pictures and a
transcript side by side, so Claude can read what happened and check every
comment against what was on screen at that second. The working method for
Claude is in `.claude/skills/screen-video/SKILL.md`.

## Recording

- **Mac:** Cmd+Shift+5 → Record Entire Screen (or a window) → Options →
  Microphone on. Saves a `.mov`, which works as it is.
- **Windows:** OBS Studio (Settings → Output → Recording Format **mp4**), or
  Win+Alt+R with the Xbox Game Bar and the mic switched on.
- **Phone:** the built-in screen recorder, with the microphone switched on.
- **Talk the whole way through.** Say what you expected and what happened:
  "I clicked Pay and nothing happened", "this menu is cut off". The talking
  becomes a timestamped transcript lined up with the pictures.
- 1080p at 30 fps is plenty.
- Put the file somewhere Claude can reach: a Google Drive or Dropbox link set
  to **Anyone with the link**, or drop it into the repo's `.recordings/`
  folder directly.

## What it does beyond the basics

- **Two modes.** `--mode screen` (default) for someone talking over their screen.
  `--mode ad` for somebody else's ad: looks every 0.1 s, so a cut shorter than a
  second is never missed (screen mode once missed a reference ad's key
  shot entirely). Tuned on that ad: every cut kept, caption duplicates dropped.
- **report.html.** Every run also writes the whole video on one page, each
  stretch's pictures beside what was said. Publish it as an artifact (see the skill).
- **More links.** Loom, TikTok, YouTube, Vimeo, Instagram and X links go through
  yt-dlp.
- **An optional Drive inbox.** A Drive folder (Screen recordings / Ads / Breakdowns)
  whose folder ids you fill in at `.claude/skills/screen-video/SKILL.md`.
- **Clean re-runs.** A re-run clears the old frames and sheets first.
- **Tests.** `bash scripts/screen-video/test.sh`.
- Default speech model is `small` (language still forced to English).

## Running it

```bash
bash scripts/screen-video/setup.sh
python3 scripts/screen-video/fetch.py "<share link>" --name checkout-bug
python3 scripts/screen-video/breakdown.py .recordings/checkout-bug/video.mp4
python3 scripts/screen-video/breakdown.py .recordings/some-ad/video.mp4 --mode ad
python3 scripts/screen-video/breakdown.py .recordings/checkout-bug/video.mp4 --clip-only --clip 02:14-02:17 --clip-fps 20
```

Output, in `.recordings/<name>/` (git-ignored):

| File | What it is |
|---|---|
| `index.md` | Every stretch of the video, what was said in it, which sheet shows it |
| `transcript.txt` / `.json` | Everything said, stamped `[mm:ss]` |
| `frames/` | One picture each time the screen really changes, at least every 8 s |
| `sheets/` | Those pictures twelve to a page, each stamped |
| `clips/<from>/` | Every frame of a short stretch (`--clip`), for fast moments |

## Options

| Option | Default | What it does |
|---|---|---|
| `--fast` | off | Keyframes only: much quicker, coarser. A first look at a long video. |
| `--mode` | `screen` | `screen` = someone talking over their screen; `ad` = a short-form ad (looks every 0.1 s, threshold 14, a picture at least every 2 s, 540 px wide). Any flag below overrides the mode's default. |
| `--model` | `small` | Speech-to-text size: `tiny`, `base` (quicker), `small`, `medium` (slower, more accurate); `.en` variants work too |
| `--crop x,y,w,h` | whole screen | Only look at part of the screen, e.g. the browser window |
| `--no-audio` | off | Skip the transcript |
| `--every` | 0.5 s (ad: 0.1 s) | How often the screen is looked at |
| `--threshold` | 10 (ad: 14) | How much the screen must change (0–255) for a new picture |
| `--max-gap` | 8 s (ad: 2 s) | Keep a picture at least this often, even if nothing changes |
| `--width` | 720 (ad: 540) | Width of saved pictures |
| `--clip mm:ss-mm:ss` | — | Every frame of that stretch (can repeat) |
| `--clip-fps` | 15 | Frames per second for a clip |
| `--clip-only` | off | Only make the clips |

## Speed

A 47-second recording took about 17 s for the transcript. An hour at 1080p
takes minutes: run it in the background, and use `--fast` and
`--model base.en` for a quick first pass.
