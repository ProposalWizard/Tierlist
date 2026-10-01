---
name: playtest-video
description: Harry and Mikey playtest with a screen recording running (OBS, mp4) and hand over the video instead of describing it. Load WHENEVER someone gives a video link or file of the game being played — "here's the recording", "watch this", a Google Drive/Dropbox link, a .mp4 — or asks what happened at a timestamp. Turns the video into pictures and a transcript Claude can actually read, then checks every claim against the real game before reporting it.
---

# Watching a playtest recording

Asked for directly (Harry, 27 Sep 2026): *"from now on when im playtesting im
gonna screen record my whole screen and give u the recording to look over the
whole actions im doing"*. It came straight after a plan that got two things
wrong from a 40-minute spoken playtest, because the words were paraphrased
without the picture. The recording is the picture. Use it.

## 1. Get the file

The drop folder is **Knowitball playtest recordings** in Harry's Drive:
https://drive.google.com/drive/folders/1w_AJFndensiBWMicxiSReM9ZDlyQfBik
(folder id `1w_AJFndensiBWMicxiSReM9ZDlyQfBik`). Once the folder itself is set
to **Anyone with the link**, every video dropped in it inherits that, so they
only have to say "new recording's in". Find the newest one with the Google
Drive connector:

`search_files` with `parentId = '1w_AJFndensiBWMicxiSReM9ZDlyQfBik' and mimeType contains 'video/'`

then pass its `id` straight to fetch.py. A link pasted in chat works too.

```bash
bash scripts/playtest-video/setup.sh                       # once per container
python3 scripts/playtest-video/fetch.py "<link or file id>" --name harry-0927
```

YouTube / TikTok / Instagram / X links work too (yt-dlp, installed by setup.sh). TikTok works from a cloud session; YouTube blocks cloud servers, so a YouTube link only works in a LOCAL Claude Code session on someone's own computer (desktop app or terminal). From the cloud, ask them to download it and drop it in the Drive folder.

A link that isn't public comes back as "Got a web page, not a video" — ask
them to change the sharing, don't guess. The Google Drive connector can FIND a
file (`search_files`, mimeType video) but can't carry a video this size: the
download itself has to come through `fetch.py`.

### Big videos: break them down on the Mac instead

A long or big recording is slow to upload and slow to chop up in the cloud.
`scripts/playtest-video/Breakdown-on-Mac.command` (and `Breakdown-on-Windows.bat`
for a PC) is ONE file per system
(built by `build-mac-button.sh`, with `breakdown.py` folded inside, so no git
is needed on his side). It does the breakdown on the Mac and drops a small
zip in the same Drive folder. When they say "new breakdown's in", find the
newest `.zip` there and pass its file id to `fetch.py`: it sees the zip and
unpacks it into `.playtests/<name>/`, ready to read (skip step 2). Under about
20 minutes, the normal route below is fine.

## 2. Break it down

```bash
python3 scripts/playtest-video/breakdown.py .playtests/<name>/video.mp4
```

Run it in the background for anything over ten minutes. On a 1080p hour it
takes a while: `--fast` (keyframes only) is a quick first look, `--model base.en`
a quicker transcript. `--crop x,y,w,h` if the game only fills part of the
screen.

Out comes `.playtests/<name>/index.md`: the video in stretches, each with what
was said during it and the sheet of pictures that shows it.

## 3. Read ALL of it

- Read `index.md` end to end, and **open every sheet**. Not a sample.
- Anything said about a moment ("he dived the wrong way", "I couldn't drag
  back") gets its frames checked. A fast moment gets a clip:
  `breakdown.py <video> --clip-only --clip 12:31-12:34 --clip-fps 20`
  (every frame of those three seconds, sixteen to a sheet).
- Chatter that isn't about the game is ignored — they've said so.

## 3b. Match the mouse to every "here", "there", "this" (standing rule)

Harry, 1 Oct 2026: *"I was using my mouse to point at things whilst saying
this should go 'here' or 'there', so maybe match that with the transcript"* —
then: *"add this to rules for analysis of recordings."*

- Find EVERY pointing word in the transcript ("here", "there", "this",
  "these", "that one", "up here", "over here", "to the left", "top right",
  "this guy"…) with its time (word-level timing where possible).
- Take frames from 0.5 s before to 1 s after; find the cursor; pick the
  frame where it rests or clicks as the word is said.
- Save an annotated keyframe per moment (game column crop, a ring + arrow on
  the cursor) and a `pointing.md` table: time, his words with the pointing
  word in bold, the exact on-screen element under the cursor, the resolved
  meaning in plain English, and CLEAR / LIKELY / UNCLEAR.
- Put the resolved meaning into each point in `points.md`. Never leave
  "where is 'here'?" as an open question when the cursor answers it; if
  the cursor can't be found, say so instead of guessing.
- Do this BEFORE deleting the video.

## 4. Check before you report

A frame shows what happened; it doesn't show why. Before any claim about the
game's rules goes back to them:

- Reproduce it in the real game in a browser (star-playtest, or record the
  engine's state frame by frame as in `scripts/playtest-video/README.md`).
- Say which of the three it is, every time: **seen in your video at 12:31**,
  **measured in the real game**, or **reasoned from the code** (not yet seen).
- Their words are about what they SAW. If your number seems to contradict
  them, first check you mean the same thing by the same word (the "his line"
  mistake: the goal line to them, the keeper's own position in the code).
  Show a picture rather than argue.

## 5. Hand back

Findings go into the patch notes (artifact-house-style), each with the
timestamp and a frame from their own video where one helps.
