---
name: screen-video
description: Watch a video someone hands over instead of describing it - screen recordings (OBS, a phone, a Loom, a playtest capture) AND other people's videos (an mp4, a TikTok, an ad, a tutorial). Load WHENEVER a video arrives - "here's a recording", "watch this", "new recording's in", a Google Drive / Dropbox / Loom / TikTok link, a .mp4/.mov/.webm - or someone asks what happened at a timestamp. Turns the video into time-stamped pictures + a transcript lined up side by side, reads ALL of it, checks every claim against the frames before reporting, and publishes the whole breakdown as a page.
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes.

# Watching a video

Claude can't watch a video, but it can read pictures and text. This is the
bridge: time-stamped pictures of every real change on screen, and everything
said, lined up by the second. The voice matters as much as the picture: what
the person says at 12:31 is about what is on screen at 12:31.

The tool lives in `scripts/screen-video/` (setup, fetch, breakdown, report,
tests). Everything it writes goes to `.recordings/<name>/`, which is
git-ignored and never committed.

## 0. Which kind of video is it? (decide first, it changes everything after)

| It is... | Mode | Playbook (step 4) |
|---|---|---|
| Someone talking over this project's app, site or game ("this is broken", "this feels cramped", a playtest) | `screen` | A. App |
| Someone doing a task and talking it through | `screen` | B. Task |
| Somebody else's video with fast cuts (an ad, a short, a trailer) | `ad` | C. Someone else's video |
| A tutorial, a meeting, a course lesson | `screen` | B, without the automation list |

**Why the modes differ:** a screen changes slowly, so `screen` looks every
0.5 s. An ad can cut in under a second: on one reference ad, `screen` missed a
0.6 s shot completely. `ad` looks every 0.1 s, and its change threshold (14)
was tuned on a real ad: real cuts score 25+, movement inside a shot 10-15, a
caption word appearing 6-8. So it keeps every cut and drops the caption
duplicates (213 pictures down to 124 on that ad, all 6 opening cuts kept).

## 1. Get the file

```bash
bash scripts/screen-video/setup.sh                      # once per machine / container
python3 scripts/screen-video/fetch.py "<Drive file id | Drive/Dropbox link | Loom/TikTok/YouTube link | direct .mp4 link>" --name <short-name>
```

A file already in `.recordings/<name>/` (for example dropped there by hand):
skip to step 2. A file anywhere else: copy it to `.recordings/<name>/video.mp4`.

**The Drive inbox (Knowitball, set 18 Oct 2026).** Harry's Drive, folder
"Knowitball playtest recordings":

| Folder | Id | For |
|---|---|---|
| Knowitball playtest recordings | `1w_AJFndensiBWMicxiSReM9ZDlyQfBik` | recordings to break down |
| Breakdowns (Claude writes here) | `18Gn5Q-pluXr_FjBTqtvADLOwq-oMAq87` | every breakdown goes here, automatically (step 5) |

**Recorded on the site (18 Oct 2026).** Admin → Videos records the screen and
voice in the browser and saves the file into the recorder's OWN Drive, folder
"Knowitball screen recordings" → <who> (in Harry's Drive that folder sits
inside "Knowitball playtest recordings"), already set to "anyone with the link" and
named `date · who · what (length).webm`. The person pastes
"Watch this recording: <link>"; pass that link straight to `fetch.py`.
Since 19 Oct 2026 nobody has to paste it: the recorder also stores the link
(/api/dev-recordings) and the UserPromptSubmit hook
(`scripts/hooks/recordings-hook.mjs`) adds it to that person's next message
with "break it down first". Treat that note exactly like a pasted link. Use the
file's name for the breakdown's name (it already follows the rule in step 5).

To pick up the newest video, use the Google Drive connector (`search_files`,
`parentId = '<folder id>' and mimeType contains 'video/'`) and pass the file id
to `fetch.py`. **Never download a video through the connector itself:** it
returns the file as base64 text into the context, which a video floods.

A Drive file must be shared as "Anyone with the link" (a file in a folder
shared that way inherits it). If not, `fetch.py` says "Got a web page, not a
video". Check the sharing (`get_file_permissions`) and ask the owner to change
it; don't guess and don't retry.

**Links.** Loom, TikTok, YouTube, Vimeo, Instagram, X, Twitch, Facebook and
Reddit links go through `yt-dlp`. TikTok needs `curl_cffi` (setup.sh installs
it). If a page link fails, ask for the mp4 instead.

**YouTube from a cloud session usually fails:** YouTube answers "Sign in to
confirm you're not a bot" to server addresses. Try the link once at most; if it
is refused, ask for the downloaded mp4 (or run the breakdown on a local machine,
where the same link works: setup.sh installs `deno` and a bundled ffmpeg for
YouTube). `fetch.py` can send YouTube login cookies from the environment:

| Env var | Holds |
|---|---|
| `YT_COOKIES_B64` | a Netscape cookies.txt, base64-encoded (the main one) |
| `YT_COOKIES` | the cookies.txt text, or it base64-encoded |
| `YT_COOKIES_FILE` | a path to a cookies.txt file |

All optional. Check by NAME only (`env | cut -d= -f1`), never print a value,
never ask for a password, never put cookies in the repo. If YouTube still
refuses with cookies sent, they have probably expired: say so. Downloading other
people's YouTube videos breaks YouTube's terms: personal research only, never
re-upload.

## 2. Break it down

```bash
python3 scripts/screen-video/breakdown.py .recordings/<name>/video.mp4               # screen
python3 scripts/screen-video/breakdown.py .recordings/<name>/video.mp4 --mode ad     # fast cuts
```

**Phone videos (4K, portrait):** `breakdown.py` honours the video's rotation
flag (needs `ffprobe`; without it a portrait phone clip comes out on its side).
A 6-minute 4K clip took about 11 minutes with
`--every 1 --threshold 30 --max-gap 3 --width 960`: use those for a handheld
walk-round, where the camera moves constantly and the default would keep nearly
every frame.

Run it in the background for anything over ten minutes. `--fast` (keyframes
only) is a quick first look; `--model base` gives a quicker transcript.
`--crop x,y,w,h` if the thing being tested only fills part of the screen.

Out come, in `.recordings/<name>/`:
- `index.md`: the video in stretches, each with what was said and its sheet. Read this first.
- `sheets/`: the pictures, 12 to a page, each stamped with its time.
- `transcript.txt` / `.json`: everything said, stamped `[mm:ss]`.
- `report.html` + `report-files/`: the whole video on one page (step 5).

**`--stills`: copyable frames, for a video you will re-create in an AI image
tool.** `breakdown.py <video> --mode ad --stills` also saves every kept picture
on its own, 720 px on the long side, as
`report-files/stills/still_0008_t00-03.5.jpg` (order, then mm-ss.tenth;
`frames.json` holds the exact second). The report gains a Frames grid: tap a
frame, then Copy image or Save. Cost on a 30 s ad (161 frames): about 4 s more
per run and about 7 MB more to publish. Leave it off for screen recordings and
long videos: a 2-hour video keeps 600-900 frames, past what one page can hold.

## 2b. Reviews: read the cursor and the screen, not just the words

In a review or playtest recording, every "here", "this", "that bit" or "what
happened there" points at whatever is on screen at that moment. Resolve it
before acting:
1. Find the app, game or player region in one full frame. Crop to it and pull
   frames at 1-2 fps across each stretch where they talk about a moment.
2. If there is a player, read its own timestamp and the scrub bar position. That
   gives the exact second of the thing being reviewed.
3. Note where the cursor (or finger) sits and what they scrub back and forth
   over. That is the object they mean.
4. If they leave the app (open another tab, a doc, a reference), say which page
   and which file, because "the example video" is a real file.

Write each comment as "their words, the on-screen moment (file + second), what
they point at", then act on that, not on the words alone.

## 3. Read ALL of it

- Read `index.md` end to end, and open every sheet. Not a sample.
- Anything said about a moment ("I clicked and nothing happened", "it jumped")
  gets its frames checked. A fast moment gets a clip:
  `breakdown.py <video> --clip-only --clip 02:14-02:17 --clip-fps 20`
  (every frame of those three seconds, sixteen to a sheet).
- Chatter that isn't about the thing being looked at is ignored.
- **No claim leaves without its frame.** Every finding you report names the
  timestamp and what the picture at that timestamp actually shows. If the frame
  and the words disagree, say so; don't pick one silently.

**Long videos (a 1-3 hour playthrough, a long meeting):** ask what they want
from it first ("every crash", "how the tutorial flows"). Run `--fast` for a
first pass, read `index.md` + the transcript to find the stretches that answer
the question, then re-run those stretches with `--clip`. Reading ALL still
applies to the stretches that matter; say plainly which stretches were only
skimmed.

## 4. The playbooks

### A. App (someone talking over this project's app, site or game)
A frame shows what happened, not why. Before any claim about the cause:
- Reproduce it in the REAL running app: same page or screen, same window width
  as the video, same steps. Screenshot it.
- Find the cause in the code, fix it, and shoot it again.
- Label every finding (RUL-ALL-007): **SEEN** in the video at 12:31 · **REPRODUCED** in the
  app · **REASONED** from the code, not seen yet.
- The person's words are about what they SAW. If a finding seems to contradict
  them, first check you both mean the same thing by the same word. Show a
  picture rather than argue.

### B. Task (someone doing a piece of work and talking it through)
- Write the steps in order, each with its timestamp and the tool it happened in.
- Mark every step that repeats, or that is copy-paste between two tools, as an
  **automation candidate**: what would do it (a script, a skill, a hook, an app
  route, a scheduled job) and roughly how big (S/M/L).
- Candidates are proposals for the owner to approve, not changes to make
  straight away.

### C. Someone else's video (an ad, a short, a reference)
- Break it down beat by beat with timestamps: format, structure, the hook,
  captions, the transcript, every cut.
- If this project has a creative or review skill, load it before judging craft.
- Use `--stills` when the frames will be re-used as image references.

## 5. Hand back

Model split: everyday model for the breakdown, top model for analysis (RUL-TEAM-017).

1. **Paste the findings in chat, in full** (a file link alone is not a
   delivery). Each finding: timestamp, what was said, what was on screen, the
   cause, the fix.
2. **Publish the report page** as an artifact (Claude Code's Artifact tool): it
   is the proof the whole video was read, with every stretch's pictures beside
   what was said.
   - `file_path = .recordings/<name>/report.html`
   - `files` = one entry per file under `report-files/`:
     `{"report-files/sheet_001.jpg": ".recordings/<name>/report-files/sheet_001.jpg", ...}`
   - Print the whole map (sheets and stills) with:
     `python3 -c "import os,json,sys;d=sys.argv[1];print(json.dumps({os.path.relpath(os.path.join(r,f),d):os.path.join(r,f) for r,_,fs in os.walk(os.path.join(d,'report-files')) for f in sorted(fs)}))" .recordings/<name>`
   - With `--stills`, also pass `capabilities = {"downloads": true}` so the
     Save button shows (Copy works without it).
   - One publish takes at most 255 files: past that, publish again to the same
     `url` with the rest.
   - No Artifact tool in this session? `report.html` opens in any browser from
     the folder; say where it is.
3. **Always: put the breakdown in Drive** (Harry, 18 Oct 2026: "the screen
   recorder tool should auto update to the drive with a relevant name"). Don't
   ask; do it every time, right after publishing the report.
   - `create_file` with `parentId = 18Gn5Q-pluXr_FjBTqtvADLOwq-oMAq87`,
     `contentMimeType = text/markdown`, `textContent` = **first the video's own
     Drive link** (and the folder it sits in), then the report link, then the
     findings you pasted in chat, then `index.md`.
   - **Link them both ways (Harry, 19 Oct 2026: "the breakdown went in, but
     not the actual video").** When the video is in Drive, `update_file` its
     `description` to "Claude's breakdown: <doc link> · report page: <artifact
     link>". A video that came from elsewhere (TikTok, a pasted mp4): put the
     source link at the top instead.
   - The report page (artifact) is private to the account that made it: a
     chat on the same account can read it (Artifact `read`), others can't
     until it is shared. The Drive doc is the copy everyone can open.
   - **Name it so it can be found by name alone:**
     `YYYY-MM-DD · <who> · <what it is about, 3–6 plain words> (<length>) — breakdown`,
     e.g. `2026-10-18 · Harry · keeper dive feels slow (4m12s)`. The date is the
     day it was recorded if known, else today. "What it is about" comes from
     what was said, never the file name ("video.mp4", "Screen Recording 2…").
   - Images don't go through the connector; the report link carries them.
   - No Drive connector in this session: say so in one line, and paste the
     name you would have used.

## Tests

`bash scripts/screen-video/test.sh` builds a 4-second test video with a 0.3 s
cut hidden between two of screen mode's looks and checks: ad mode keeps it,
screen mode misses it, the report is built, `--stills` works, re-runs leave no
stale files, clips never share a folder, `--name` can't escape `.recordings`,
and share links are recognised. Run it after any change to the scripts.
