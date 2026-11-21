# Match loop: what each round found (packed app vs KIB Next)

## Round 1 (21 Nov 2026): stopped in set-up, no full playtest

The loop was paused by a usage limit, then playtesting moved to separate playtesters. What was done:
- The bench was set up for three apps (packed, KIB Next, the website in dev mode). How: `../README-situations.md`.
- One pair of stills only: the bench at 53' of the Community Shield, website (dev mode) beside KIB Next, 412×915.
- No match was played to the end. No fix was made to the app. Nothing below is FIXED.

| # | screen | what | severity | how I know | status |
|---|---|---|---|---|---|
| 1 | Feed, on the bench at 53' | Website: board 0-0, the feed holds one line ("53 You are coming on"). KIB: board 2-0, the feed holds every line from 10' to 53' with both goals. The two were driven by the same script, which presses "Skip"/"Tap to skip" when it sees it, so the two may not have had the same presses. | MED if real | seen on one still pair (`scratchpad/loop/m/r1-chance.jpg`); not repeated; cause not read in the code | OPEN, needs a playtester: skip the feed in both apps the same way and compare the lines kept and the score shown |
| 2 | Scoreboard plate | Website shows the "2D" button; KIB does not | - | seen | KNOWN (MATCH.md row 2: no 3D match view on the phone) |

## Not reached (for the playtesters)

None of the task's list was reached in this round: your own goal in the packed code, half time, substitutions, captain
orders, a corner, a free kick, a penalty, an in-match dribble, a through pass with run and lay-back, a red card, an
injury, extra time, a shootout, added time, an international, the trial, the drills, Kickabout, 360×780 and 360×640.

## Still open from MATCH.md (not touched)

- Pop-up fades when the feed opens (LOW, 0.16 s).
- Kickabout: six-chance summary is the small card, not the post-match screen (MED); score pill place and replays button are the Phone shell's (world loop).
- Tries rings size in drills (LOW). Keeper slow-mo on a catch (LOW).
- Packed's own GOAL board on a still: now reachable through the dev website (`setBall`), not yet captured.

## Round 2 (Opus playtest, 21 Nov 2026)

Bench: `live.mjs --port 7841`, packed = `mobile/www` (built 18 Nov), KIB = web build of `claude/eloquent-bohr-6veqfh` (c7a08315).
Saves: `make-season-end.mts --left N` (Arsenal, season 1): **left48** = Community Shield (wk 0, seed 1000),
**left22** = FA Cup 3rd round away at Blackpool (wk 18, seed 1018), `make-intl.mts` (new) = Euro Qualifier
Switzerland v England (wk 4, seed 1004). Stills: `scratchpad/loop/m2/` (named below), worst pairs `loop/m2/worst.jpg`.
New tools: `auto.mjs` (auto-play an open bench page until a screen), `seed-scan.ts` (which week serves what),
`make-intl.mts` (a save whose next match is an international). live.mjs now survives a failed background `run`.
**The bench was very slow** (load average 16-17 on 4 cores, other agents building): KIB's clock is stepped by
frames with at most 0.25 s per frame (MatchPitch.tsx loop), so here KIB's match ran 2-5x slower than real time;
timings are given only where both were measured side by side.

| # | where | steps (save, seed, presses) | packed | KIB Next | sev | how I know | stills | KIB file (guess) |
|---|---|---|---|---|---|---|---|---|
| R2-1 | Open finding #1, bench at 53' (Community Shield) | left48 · seed 1000 · Home → PLAY (packed) / CONTINUE → PLAY → KICK OFF (KIB) · no other press | **2-0**, every line from 10' (Saka 32', Tzolis 42'), "53 You are coming on." | the same 2-0 and the same 14 lines, word for word | - | seen, both | `r2-bench-53.jpg` | **NOT REAL against packed.** Only the website in dev mode shows 0-0 and one line (third pane): React Strict Mode runs the bench effect twice under `next dev` (app router: strict mode on by default). Packed and KIB agree. Close it. |
| R2-2 | Scoreboard kit bars, a white (or pale) kit | intl save · PLAY → PLAY ANYWAY → KICK OFF (KIB) | names white with a **black outline**: "ENGLAND" reads on the white bar; "SWITZERLAND" outlined on red | names white with only a faint light edge: **"ENGLAND" on the white bar is almost invisible**; no dark outline on the red bar either | HIGH | seen (zoomed) | `r2-in-scoreboard.jpg`, `r2-in-ko.jpg` | `phone/src/screens/MatchHud.tsx` kit-bar name text (needs packed's black text stroke) |
| R2-3 | Plate RATING before / while you play | left48 bench 53' · left22 bench 52' · intl kick-off | 6.5 · 6.4 · 6.4 | 6.4 · **6.1** · **6.1** | MED | seen, three matches + code | `r2-bench-53.jpg`, `r2-fa-bench.jpg`, `r2-in-scoreboard.jpg` | `phone/src/match/driver.ts` `ratingSoFar()` / `MatchHud.tsx` l.25 shows `fairRating(...)` raw; CanvasMatch's RATING cell (~11089) is `regressForMinutes(ratingSoFar(stats, displayScore.user, displayScore.opp), matchMinute - enteredAt)` (score as SHOWN, regressed for minutes). So KIB's live box also disagrees with its own post-match number. |
| R2-4 | Feed lines (every match) | any bench feed, 412×915 | rows ~31 px; text wraps sooner ("…deep in the opposition / half." on two lines) | rows ~28 px; the same lines fit on one line; the list is ~85 px shorter at 412 | MED | seen + code (packed: site font 12 px `leading-snug` 16.5 + `py-1.5` + `pr-16`; KIB: Roboto 12/16 + 6/6 + 64) | `r2-fa-bench.jpg`, `r2-bench-53.jpg` | `phone/src/screens/MatchFeed.tsx` FeedLine (lineHeight 16 → 16.5; Roboto is narrower than the website's font, so lines wrap differently) |
| R2-5 | Feed on the bench at **360×640** | left48 at 360×640 · CONTINUE → PLAY → KICK OFF | lines fill down to the playstyle icons (icons float over the feed): 10 lines, last right above the icons | 8 lines and a **~55 px empty band** between "53 You are coming on." and the icons | MED | seen | `r2-640-bench.jpg` | `MatchFeed.tsx`: icons in their own strip AND bottom space kept under the list, so the space is counted twice |
| R2-6 | Pre-match line-up | all three saves · PLAY | **straight to the match** (no line-up) in all three | the line-up screen every time, then KICK OFF | MED (maybe bench-only) | seen | `cs-pre-packed.jpg`/`cs-pre-next.jpg`, `r2-in-pre.jpg` | packed LineupIntro skips when `teamsReady` is false (XI < 9) or "Skip the line-up" is on; neither set in the save, so packed's XI was probably empty **on this offline bench**. Check on a phone before changing `phone/src/screens/career/PreMatch.tsx` l.108 |
| R2-7 | Kick-off card (international) | intl save · kick-off | card fills the feed to ~y770; crests + name bars ~y710-750 | card ends ~y705 (~65 px shorter); crests + bars ~y645-690. The card exists now (MATCH.md "Kick-off card: missing" is out of date) | LOW | seen | `r2-in-ko.jpg` | `MatchFeed.tsx` KickOffCard height |
| R2-8 | Strike screen ball place | left48 · first chance (long range) · drag back 110 px | ball centre (185, 770), left of centre | ball centre (205, 805): centred and **35 px lower**, bottom ~25 px from the frame | LOW | seen | `r2-cs-contact.jpg` | `phone/src/match/drawContact.ts` |
| R2-9 | Post-match pay | left22, lose · FULL TIME | gold ★ icons before amounts; "Hold to speed up · double-tap to skip" pill during the count-up | white "★" text glyph; no pill (no count-up: known) | LOW | seen | `r2-fa-post.jpg`, `s-fa-post-p.jpg` | `phone/src/screens/career/PostMatch.tsx` |
| R2-10 | Low energy before a match | left22 or intl · PLAY | "LOW ENERGY" in the condensed display font, card y≈230, glowing button | Roboto bold title, card 10 px lower, no glow | LOW | seen | `r2-fa-lowenergy.jpg` | `PreMatch.tsx` (career side, on the Play path) |
| R2-11 | Same match after GET OUT THERE | left48, same presses | chance picture A | chance picture B | - | seen + code | `r2-cs-aim1.jpg` | **not a bug**: `lib/star/chanceMaker.ts` salts each page visit (crypto random) for which drawing is tried first, in both apps. Same minute and kind (60' long range in both), different picture. Compare kinds and minutes only. |

SAME (checked): bench lines, order, minutes and score (R2-1); "YOU ARE GOING ON" bar; energy panel; LOW ENERGY flow;
"Out of the FA Cup — Blackpool win the Third Round tie." bar; DEFEAT pill; build-up "· tap to skip" pill.
`__kibMatch.setPieceNext = "penalty"` **works** (set at 18', penalty served at 43', then null): `in-setpiece-n.jpg`.

KIB only, no packed pair (not counted): on that forced penalty the 6-yard box and the D are drawn but **no 18-yard line**
between them, and the ball sits ~9.6 m from the goal line by the goal's scale (7.32 m = 127 px), not 11 m. One look against a
packed penalty (`match/drawPitch.ts`).

### Not reached in round 2 (and why)

- **Red card, injury**: not in either app's match. "injur|red card|sent off|booked" occurs 0 times in CanvasMatch.tsx,
  hiddenMatch.ts, matchLog.ts, matchCommentary.ts, driver.ts (injury exists only in the career).
- **Extra time, shootout**: the FA Cup save that goes to extra time with the headless bot (left22) ended 3-2 (packed) and 2-1
  (KIB) in 90' with live presses; no hook forces a score in packed, and pictures are salted (R2-11).
- **Your own GOAL board in packed code**: the dev website (for `__starMatch.setBall`) was killed for memory; packed's board for
  a team-mate goal you assisted was caught (`s-fa-p-goal.jpg`: GOAL · RICE · ASSIST · CHECK at ~70%, wide side-on camera), KIB's was not.
- **Half time, subs (you off), captain orders, corner, free kick, dribble, through pass / lay-back, added-time chip, motion
  flip books, trial, drills, Kickabout, 360×780**: not reached. The bench ran 2-5x slow (load 16-17); one auto run took 10 min for
  30 match minutes; the bench crashed once (fixed). 360×640 checked on the bench feed only.
- **Feed speed**: not comparable here. Run 1 (412): KIB 53'→60' in ~2.4 s, packed ~4.8 s. Run 2 (360×640): packed 53'→60' in 5.0 s
  (0.7 s a minute = MINUTE_TICK_MS), KIB 53'→56' in 9.7 s. KIB's clock is frame-stepped with a 0.25 s cap a frame; re-measure on a quiet machine.
