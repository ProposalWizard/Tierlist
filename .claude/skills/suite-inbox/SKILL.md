---
name: suite-inbox
description: Work through everything left in the Studio's editing suite (Admin → Marketing → Studio) from a Claude chat - edits for Claude, review notes, Lock & render and Done presses - across many cuts at once. Load when someone says "I've left edits on v02 and v03", "go through my edits", "process the suite", "what's waiting in the Studio", "I pressed Done", or pastes the suite's copied notes. Triage first, render only on Done (or a Lock), report per edit. NOT how the suite itself is built (that is `review-timeline`) and NOT making a new video (that is `video-board`).
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes. Client record: marketing/clients/knowitball/client.md.

# suite-inbox: going through the Studio's edits from a chat

Ported 22 Oct 2026 from the other app's routine of the same name, rewritten for Knowitball (one client, our own
videos, no outside review tool).

## 1. Collect: one read of everything waiting

1. `npx tsx scripts/marketing/suite-notes.mts inbox` — every cut with open edits or a press waiting, with each
   edit's id, type, range, words and status. It needs the R2 settings in this chat's environment (R2_ACCOUNT_ID,
   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET). Without them it says so: ask the person to press
   **Copy notes** on the cut (review notes) and paste, or to paste what they typed for Claude.
2. Read each cut fresh (`show <key>`). An edit marked EDITED is re-done from its NEW words.
3. Paste the triage table in chat FIRST:

| Cut | Edits (status) | Review notes | Presses | Route |
|---|---|---|---|---|
| v02 · Goalie Mode | 4 open, 1 locked | 3 | Done: render all | rebuild from its build script |

## 2. Route each cut by how it was made

| Made by | Edits for Claude |
|---|---|
| Our own build (frames drawn in a browser, a voice, sounds; e.g. v01) | Change the build (its script, timeline, voice line) and render again. Words for a new line go back to the person as text BEFORE any voicing. |
| Someone else's cut, or a screen recording | A plain cut or whole-mix volume is mechanical (ffmpeg); anything creative becomes a review note for whoever cut it. |

- An edit with an `element` block: read the block, not just the words (volume in dB, a shot's trim, speed, punch-in).
- An edit with `qc` came from the auto-QC lane or a taste note: apply it the same way.
- Every number a video shows still comes from a patch note (RUL-KIB-004); real footage only, or "ILLUSTRATION" on screen (RUL-KIB-002).

## 3. Render only on Done or a Lock

- Saved edits on their own are COLLECT ONLY. Say you have seen them; do not render.
- **Done: render all** (`render_all`) = make every edit it names in one pass. **Lock & render** (`render_one`) = just that one edit, now.
- While rendering, keep the page's bar alive: `suite-notes.mts render <key> <pct> "<step>" --eta "<n> min" --ids <edit ids>`; finish with `--status done`.
- Upload the new version (Admin → Marketing → Uploads, same card), then `suite-notes.mts add-render <key> <new key>` so it shows as "Render N" under the video.
- Move the board card (`video-board`).

## 4. Close the loop, every time

1. `suite-notes.mts applied <key> <edit ids>` for each edit made (`undone` for an undo). Pending presses whose edits are all done close by themselves; `request <key> <id> failed <why>` if one could not be done.
2. Report per cut, per edit, with the suite's numbers: **done / partly / not done, and why**.
3. Commit what changed in the repo (scripts, board card), never a video.

## Traps

- A summary line can hide the edit: always read the edit itself.
- Two presses can carry the same edit: check by edit id before rendering twice.
- A cut changed after a Lock has a new range: re-read before rendering.
