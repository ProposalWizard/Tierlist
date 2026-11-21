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
