---
name: patch-note-video
description: Turn a Knowitball patch note (one version or a range) into a 30-60 s vertical 9:16 short in the "we're building the best football game ever" format. Load when someone says "make a video from the patch notes", "patch note to video", "video for v0.4", "next short from 0.4 to 0.6", or starts a new patch-notes video. Covers hook, script beats, real stills, offline voice, render, board, upload, Studio, notes. NOT for a video copied from a TikTok (that is `tiktok-remix`) and NOT the board mechanics themselves (`video-board`).
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes. Client record: marketing/clients/knowitball/client.md. This is a DRAFT skill that Harry develops in the Studio: when he corrects a step, change this file in the same commit.

# patch-note-video: patch note in, finished short out

The proven example is v01 (`docs/marketing/videos/v01-patch-0.1-0.3/script.md`, REF-KIB-001). Copy its method, never its content.

## Cost rule (first, always)
- No paid tools. Voice, frames and sound are free and offline.
- Higgsfield and AI-generated video stay OFF until Harry unblocks them (RUL-3D-002). Do not plan a shot that needs them.

## Steps

1. **Name it and make the card.** Read `marketing/board.json`, take the next free `vNN`, say id + title in one line, create the card in `idea`, commit (skill `video-board`, step 0).
2. **Read the note.** Open the patch note page (`patch-notes/pages/<version>/`, data in `lib/patchNotesData.ts`; Harry's versions end in `h`, so check the branch). Every number must come from it, and never claim a feature that is not live (RUL-KIB-004).
3. **Pick the hook = the biggest player-facing change.** Something a player would feel (a keeper that saves everything, an aim that was 0.42 m off), not an internal fix. Say the reason in one line.
4. **Premise first.** Offer Harry 2 or 3 different stories (different hook, different before to after). He picks one. A note that changes the premise is a restart (`video-board`, step 2).
5. **Write the beats: Problem, Why, Fix, one number each.** Voice per RUL-KIB-001: short, cheeky, football-mad, numbers first ("9.8% to 47.6%"). 30 to 60 s total, about 3 to 6 s a beat. Open with the headline on screen from frame 0 and the line "3 mates are building the best football game ever". Write `script.md` in v01's table shape: time, voiceover, on screen, source (the note line each number comes from).
6. **Pictures.** Only real screenshots or clips from the note's own `img/` folder or a real run of the game. Anything drawn is marked "ILLUSTRATION" on screen (RUL-KIB-002). If a version has no stills, either ask for a capture or use drawn diagrams marked ILLUSTRATION (FACT-KIB-007). No real club badges or player photos (RUL-KIB-003). A goal on screen is a recording, never a re-run (see CLAUDE.md "Goal videos are recordings"; no Brain code yet).
7. **Lock the script.** Card to `script`, then `script-ok` only when Harry says it is locked. New words after the lock go back to `script`.
8. **Voice (offline, free).** Kokoro v1.0, voice `bm_george`, speed 1.2, lang `en-gb` (FACT-KIB-006). Same engine as `scripts/commentary/generate.py` (`pip install kokoro-onnx soundfile av numpy`, model files `kokoro-v1.0.onnx` + `voices-v1.0.bin`). Write numbers as words ("nine point eight percent"). One audio file per line; the line lengths set the timeline.
9. **Sound.** Whooshes and low hits synthesised with numpy. Whistle, kick, net, save and crowd from the game's own `public/sfx/`. No music (no licensed tracks).
10. **Render (HTML canvas per frame + ffmpeg, as v01).** Keep working files OUTSIDE the repo (scratchpad): `video.html` (everything drawn from time `t` alone, so every render is identical), `timeline.py`, `render.cjs`, `tts.py`, `lines.json`. Playwright Chromium screenshots each frame at 30 fps in chunks of 250 frames, one page per chunk (FACT-KIB-008). ffmpeg encodes libx264 + AAC. Target 1080x1920, 30 fps, H.264 High, AAC 48 kHz stereo, about -13 LUFS (FACT-KIB-003). v01's working files sat in a session scratchpad and were not saved, so rebuild them from this description; once Harry approves, commit a cleaned-up copy (for example `tools/video-render/`) so the next video starts from code (no Brain note yet).
11. **Safe areas.** Captions and cards inside x 64 to 950, y 150 to 1536 (FACT-KIB-004). End card: KNOWITBALL, the versions so far, a green knowitball.co.uk pill, "FOLLOW FOR v0.N" (FACT-KIB-005).
12. **Check.** Pull the cover (hook frame near 0.6 s) and 2 or 3 stills; show Harry. Check every number against its note line and the loudness. Card to `check`; set `video`, `cover`, `seconds`.
13. **Upload.** Admin, Marketing, Uploads, on the video's card. Keep at most one small final cut in the repo, never raw footage (`video-board` Never list).
14. **Load into the Studio.** `python3 scripts/marketing/studio-prep.py <file> --key <key> --out <scratch>`, then `npx tsx scripts/marketing/suite-notes.mts put-side <key> <scratch>`. Send Harry `https://knowitball.co.uk/admin/marketing/studio?key=<key>` (skill `review-timeline`).
15. **Apply his notes.** Skill `suite-inbox`: triage table first, render only on Done or Lock, then `applied`, `add-render`, move the card. Words for a new voice line go back to Harry as text before any voicing.
16. **After posting.** Add post links to the card; write what it taught as a new `FACT-KIB-NNN` (`video-board`, step 8). Never invent view numbers.

## Checklist (paste in chat before handing over)
- [ ] Card exists, on the right stage, pushed (or said it is not pushed)
- [ ] Hook is the biggest player-facing change
- [ ] Every beat has one number and its patch-note source line
- [ ] Only real pictures; drawn ones say ILLUSTRATION
- [ ] No unreleased feature, no club badges or player photos
- [ ] Voice bm_george 1.2 en-gb; numbers spoken as words
- [ ] 9:16, 30 fps, 30 to 60 s, inside the safe area, end card present
- [ ] No paid tool used; Higgsfield untouched
- [ ] Uploaded, loaded in the Studio, link sent
- [ ] `node scripts/marketing/private-names-guard.mjs` says 0 hits before any push
