---
name: tiktok-remix
description: Turn someone else's TikTok, Reels or Shorts link into a Knowitball viral video - keep the FORMAT (hook, beats, timing, captions, sound pattern, length), swap in Knowitball's own content. Load when Harry pastes a TikTok/Reels/Shorts link and says "remake this for us", "do this but for Knowitball", "TikTok to Knowitball video", "use this format". NOT for a video made from a patch note alone (that is `patch-note-video`) and NOT for just watching a video (that is `screen-video`).
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes. Client record: marketing/clients/knowitball/client.md. This is a DRAFT skill that Harry develops in the Studio: when he corrects a step, change this file in the same commit.

# tiktok-remix: keep their format, not their content

## Cost rule
No paid tools. Higgsfield and AI video stay OFF until Harry unblocks them (RUL-3D-002). Everything we show is real Knowitball footage or marked ILLUSTRATION (RUL-KIB-002).

## Steps

1. **Name it and make the card** in `idea` (skill `video-board`, step 0). Do not put the reference link or file in the repo.
2. **Watch it** with `screen-video`: `python3 scripts/screen-video/fetch.py "<link>" --name <short>`, then `python3 scripts/screen-video/breakdown.py .recordings/<short>/video.mp4 --mode ad` (playbook C). If the download is blocked, try once, then ask Harry for the mp4. Never use cookies or passwords from outside the environment's own settings. Personal research only: the file stays in `.recordings/` (git-ignored) and is never re-uploaded.
3. **Decode the format** in a table, every row with a timestamp from the frames: hook (first 1 to 3 s: line, picture, caption), beats and their length, cuts per second, caption style and position, text-on-screen pattern, voice vs music vs effects, total length, ending / call to action. Label each row SEEN or GUESSED (RUL-ALL-007).
4. **Map it onto Knowitball.** Pick the game moment (a chance, a save, a shop scene, a career moment), the patch note it comes from, and the real footage that exists. Every number comes from a patch note and no unreleased feature is claimed (RUL-KIB-004). No footage? Ask for a capture or mark ILLUSTRATION (RUL-KIB-002). No club badges or player photos (RUL-KIB-003).
5. **Premise check.** Give Harry 2 or 3 mappings (different game moment or hook). He picks one (`video-board`, step 2).
6. **Write the Knowitball script** in v01's table shape (time, voiceover, on screen, source). Same beat timing and structure as the reference, our own words, in our voice: short, cheeky, football-mad, numbers first (RUL-KIB-001). The shape matches; no line does.
7. **Lock, then make.** Same loop as `patch-note-video` steps 7 to 16: script-ok, offline Kokoro voice (bm_george, 1.2, en-gb, FACT-KIB-006), HTML-canvas frames + ffmpeg in 250-frame chunks (FACT-KIB-008), 1080x1920 at 30 fps (FACT-KIB-003), safe area (FACT-KIB-004), end card (FACT-KIB-005); card to `check`; upload via Marketing, Uploads; load in the Studio (`review-timeline`); apply notes (`suite-inbox`).
8. **Close the loop.** If it does well, write the format down as a Brain note (`REF-KIB-NNN` for the script, `FACT-KIB-NNN` for the format), tag `client-kib`, then run `python3 scripts/brain/build_index.py`.

## What never to copy
- Their audio: licensed music, trending sounds, their voice. We use our own Kokoro voice and the game's own sounds. Harry can add a trending sound himself inside TikTok when he posts (no Brain note yet).
- Faces, their footage, their screenshots, their logos and watermarks.
- Their exact words, jokes or on-screen text. Same shape, new lines.
- Their numbers or claims. Ours come from our patch notes.
- Any other business's names, clients, scripts or footage (the repo is PUBLIC). Run `node scripts/marketing/private-names-guard.mjs` with your list from OUTSIDE the repo; 0 hits before any push.

## Checklist
- [ ] Card exists, pushed or said not pushed
- [ ] Format table filled from frames, each row timestamped and labelled SEEN or GUESSED
- [ ] Mapping names the game moment, patch note and real footage
- [ ] Script matches the shape and shares no line with the original
- [ ] Nothing of theirs in our video (audio, faces, logos, words)
- [ ] Only real pictures or ILLUSTRATION; no badges or player photos
- [ ] 9:16, 30 fps, safe area, end card; no paid tool
- [ ] Uploaded, in the Studio, link sent to Harry
