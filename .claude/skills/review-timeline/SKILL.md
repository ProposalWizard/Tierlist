---
name: review-timeline
description: The EDITING SUITE in Admin → Marketing → Studio (Editing tab), Knowitball's only client being Knowitball. One cut on a timeline with two tabs that never mix - REVIEW NOTES (fix / keep / check at a moment) and FOR CLAUDE (cut this out, change this at 0:07, a change for the whole video), plus Lock & render, Done, the auto-QC lane and tap-a-lane changes. Load when someone says "put v02 in the suite", "load this cut into the Studio", "open the editing suite", "I've left notes in the Studio", "make the filmstrip / QC lane for this cut", or asks how the suite saves. NOT how to work through what was left (that is `suite-inbox`) and NOT how to make the video (that is `video-board`).
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes. Client record: marketing/clients/knowitball/client.md.

# review-timeline: the Studio's editing suite

Ported 22 Oct 2026 from the editing suite in Harry's other app (its newest version: the mobile-first suite, the
auto-QC lane, taste notes, tap-a-lane changes), with Knowitball as the only client. Harry: *"port over the whole
studio ... and apply it to our 'client' which is Knowitball"*. Left out on purpose: the outside review tool, the
other app's docs tool, the client reviewer's pass, offer and price checks, the revision checker, the reference
beside the cut, the script check. The Statics tab is a placeholder: Harry said to wait on it.

## Where things are

| What | Where |
|---|---|
| The page | `/admin/marketing/studio` (list) · `?key=<video key>` (one cut) · `?tab=statics` (placeholder) |
| The suite | `components/admin/studio/cut-editor.tsx` (+ `scrub-timeline`, `element-inspector`, `qc-panel`, `use-element-audio`, `mic-button`, `thumbnails`, `icons`) |
| Its paint | `components/admin/studio/studio-skin.css` (dark "Soft Studio"), tokens in `tailwind.config.ts` (only inside `.studio-skin`) |
| The rules (pure) | `lib/studio/{schema,edit-lock,elements,qc,timeline,dictation,suite}.ts` |
| Saving | `lib/studio/store.ts` · route `/api/admin/marketing/studio[/edits|/qc|/requests|/render|/strip|/stem/<lane>]?key=` |
| Video storage | Cloudflare R2, private (`lib/marketing/{r2,storage,mediaApi}.ts`); upload on Admin → Marketing → Uploads |
| Tests | `tests/star/marketingStorage.mts` |

## How one cut is kept

Everything for a cut is ONE small JSON beside the video in R2, never in the code (the repo is public; a note can
name an unreleased feature):

- `<video key>.suite.json` — `{review: {concept, version, comments, qc_answers, transcript}, edits: {edits, renders}, requests, render}`
- optional helper files beside it: `.peaks.json` + `.strip.jpg` (sound wave and filmstrip), `.lanes.json` (shots,
  sound, captions, banner), `.qc.json` (auto-QC flags and taste notes), `.voice|music|sfx.mp4` (stems)

Times are always seconds in the cut as uploaded. A render is a NEW upload; `add-render` lists it under the video
as "Render N" (times stay in the original).

## Load a cut into the suite

1. The cut must be in storage: Admin → Marketing → Uploads (pick its video card), or Videos → Send to Marketing.
   Never put the video in the repo.
2. Make its helper files (filmstrip, wave, shots, QC):
   `python3 scripts/marketing/studio-prep.py <the video file> --key <its storage key> --out <a scratch folder>`
   then `npx tsx scripts/marketing/suite-notes.mts put-side <key> <that folder>` (needs the R2 settings in this
   chat). Without them the page draws the filmstrip from the video and shows plain Video / Audio lanes.
3. Send the person the link: `https://knowitball.co.uk/admin/marketing/studio?key=<key, URL-encoded>`.

## What the page does (both tabs)

- Phone: the video sticks at the top (48% of the screen, 38% while writing), one transport row (play, time,
  frame steps, zoom), the timeline (ruler, filmstrip, wave, Review lane teal, For Claude lane violet, striped =
  cut out, amber = QC), then the panel. Computer: video left, panel right, timeline full width.
- **For Claude:** Add an edit at the playhead (Change / Cut out / Whole video, From / To "Set to 0:03.0"), tap a
  lane (a shot, the sound, a caption) to change just that (volume, trim, speed, punch-in, swap, text). Each card:
  Lock & render (that range blurs "In edit" until Claude is done), Edit, Delete/Remove cut, Undo this edit (once
  applied). **Done: render all N edits** asks Claude to make every open edit in one pass.
- **Review notes:** Add a note (Fix / Keep / Check) for whoever cuts the video. Copy notes copies them as lines.
- Auto-QC lane and taste notes: Accept as edit (an ordinary edit for Claude), Accept as review note, Dismiss.
- The mic on every text box (the browser's own speech-to-text; nothing recorded).

## The site cannot wake Claude

Every press (Lock & render, Done, Undo) is saved in the cut's file as a request, and the page says "Saved for
Claude". The next Claude chat that checks the suite (`suite-inbox`) picks it up. Progress shows on the page from
the same file: `suite-notes.mts render <key> <pct> "<step>"`, then `applied <key> <edit ids>` ends the lock.

## Change both

The page's rules live once in `lib/studio/`; the tests in `tests/star/marketingStorage.mts`. If a rule changes,
change it there, and update the page's eye guide (`lib/adminGuides.ts` → `/admin/marketing/studio`) in the same
commit (admin-page-guide skill).

## Never

- Never copy anything from the other app's clients: names, footage, scripts, notes. The repo is public. Run
  `node scripts/marketing/private-names-guard.mjs` with your list from OUTSIDE the repo before pushing.
- Never commit a video, a filmstrip or a wave file. They live in R2 only.
- Never log a signed link or the R2 secret.
