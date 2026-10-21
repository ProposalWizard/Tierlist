---
name: video-board
description: The creation skill for Knowitball's own videos (Marketing tab, Harry 21 Oct 2026). Every time Claude starts, moves or finishes a Knowitball video (a short, a patch-notes video, a TikTok/Reels/Shorts cut), it updates that video's card in marketing/board.json (Idea → Script → Script OK → Making → In edit → Final check → Posted), commits and pushes, so the Production board in Admin → Marketing shows it within a minute or two. Load WHENEVER someone asks to make, script, render, edit, review or post a Knowitball video, says "new video", "next short", "v02", "put it on the board", "move the card", or after a video file, cover or script lands in docs/marketing/videos/.
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes.
Before writing a word of a script, read the client record: marketing/clients/knowitball/client.md
and the notes it lists (tag `client-kib`: voice RUL-KIB-001, real footage RUL-KIB-002,
rules RUL-KIB-003/004, format FACT-KIB-003/004/005). One home per fact: point at the
note, never paste a copy of it into a script or a card (a copy drifts).

# Video board: keep the board true while a video is made

Harry, 21 Oct 2026: the board shows every video and the step it is at, and
"Claude keeps the board up to date as it makes each video". The board reads
`marketing/board.json` from GitHub (main and the Harry, Mikey and Leo
branches) about once a minute. No SQL, no deploy, same as team jobs
(RUL-TEAM-007). If the card is not pushed, the team cannot see it.

## The card

One object in the list in `marketing/board.json`:

| Field | What goes in it |
|---|---|
| `id` | Stable, unique, never changed: `v<NN>-<short-name>`, e.g. `v02-goalie-mode`. Letters, numbers, `-` `.` `_`. |
| `title` | `v02 · Goalie Mode` — the number, then a few plain words. |
| `stage` | `idea` · `script` · `script-ok` · `making` · `edit` · `check` · `posted` |
| `owner` | `Harry`, `Mikey`, `Leo` or `Claude` (who is making it now). |
| `updated` | When you changed the card, ISO (`2026-10-22T09:30:00Z`). ALWAYS set a newer time on every change: the newest wins across branches. |
| `postOn` | The day it goes out (`YYYY-MM-DD`), or `null`. |
| `line` | One plain sentence: what the video is. |
| `script` / `cover` / `video` | Paths in the repo, e.g. `docs/marketing/videos/v02-goalie-mode/script.md`. `null` until they exist. |
| `seconds` | Length once rendered. |
| `links` | `[{ "label": "TikTok", "url": "https://…" }]` — https only. Add the post links here when it is out. |
| `log` | Short lines, newest LAST: `"2026-10-22 Script v2: hook now leads with 0.42 m"`. One line per move. |

Anything malformed is left off the board and named at the top of it. Never delete the file; an empty board is `[]`.

## The steps (what moves a card)

0. **Name it first.** Pick the next free `vNN` (read the board). Say the id and title back in one line. Then CREATE THE CARD AT ONCE in `idea` (or `script` if writing starts now), with `docs/marketing/videos/<id>/` as its folder. **Commit and push straight away**: the card is made at kickoff, not after.
1. **idea → script.** Writing starts. Every beat names the patch-note line its number comes from (RUL-KIB-004). Real footage only, or "ILLUSTRATION" on screen (RUL-KIB-002). Write `script.md` in the folder in v01's shape (time, voiceover, on screen, source). Set `script`.
2. **Before drafting lines, pick the premise.** Two or three genuinely different stories for the video (different hook, different "before → after"), Harry picks one. A note that changes the premise is a RESTART (back to step 1), not an edit. Four versions all polishing the same first premise = stop and ask whether the premise is right.
3. **script → script-ok.** Only when Harry (or whoever owns it) says it is locked. Bump nothing after this; a change after lock is a new version and goes back to `script`. Log `"Script OK (v3)"`.
4. **script-ok → making.** Recording the voice, capturing game footage, rendering frames. Footage is the real game (a dev server or the sandbox harness), never re-simulated for a goal (goal videos are recordings). Log what was made and where the working files are.
5. **making → edit.** The cut is being assembled. Set `video` once a file exists in the folder (keep it small: one finished cut, no raw footage in the repo; big files wait for video storage in a later slice).
6. **edit → check.** The finished cut, plus `cover.png`. Check against the client record: safe area FACT-KIB-004, format FACT-KIB-003, end card FACT-KIB-005. Show Harry a still or two. Set `cover`, `seconds`.
7. **check → posted.** Only when a person says it is out (or says "done"). Set `postOn`, add each post link under `links`.
8. **After it is out: close the loop.** When views, watch time or comments come in, write what it taught us as a NEW Brain note (`FACT-KIB-NNN`, tag `client-kib`, `source:` the line that says it), add its code under "Learnings" in the client record, and run `python3 scripts/brain/build_index.py` (errors=0). A script that did best gets a `REF-KIB-NNN` note and goes under "Winning scripts". Numbers that change every day do not go in notes.

## Every change, the same three lines

```bash
# 1. edit marketing/board.json (newer `updated`, one new `log` line)
# 2. commit on your own branch
git add marketing/board.json docs/marketing/videos/<id>/ && git commit -m "Board: <id> → <stage>"
# 3. push your own branch (never someone else's; never main unless told)
git push origin HEAD
```

If you are working in a worktree or were told not to push, commit and SAY that the card will show only after the branch is pushed. In the reply, always give the card's id, its new stage, and the branch it was pushed to.

## Never

- Never put another business's names, clients, scripts or footage in this repo. The repo is PUBLIC. Before pushing, run `node scripts/marketing/private-names-guard.mjs` with your list (`KIB_PRIVATE_NAMES_FILE` pointing OUTSIDE the repo); it must say 0 hits.
- Never claim a feature in a video that is not live (RUL-KIB-004).
- Never use AI-generated video while Higgsfield is off (RUL-3D-002).
- Never put a raw recording or more than one cut in the repo.
