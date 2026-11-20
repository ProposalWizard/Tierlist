# Playing the football: packed app vs KIB Next (20 Nov 2026)

Mikey: *"even the bar, when you drag back on the ball, the line is no longer an
arrow … it's almost there, it's just missing the features that make it a real game."*

This round PLAYED both apps with real touches (CDP touch drags, taps), not stills:
- **Packed app** = `mobile/www` (the reference). **KIB Next** = `phone/` built for the web (`../look/build-web.mjs`).
- Main size **412×915** (Mikey's Galaxy S20+), touch on, dpr 1. Also 360×640 and 360×780 for the trial, strike screen and match.
- Played in BOTH: the whole trial (free kick, through the gate, take him on, find the pass, shootout incl. my winning pen),
  the Community Shield from the bench (aim, strike screen, header, volley, a pass into a run, the turned crossing view,
  full time), Kickabout (3 chances each), Training → Technique level 1 (and level 2 in KIB).
- Media (stills, flip books, videos): `/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/playtest/match/`
  (below: `M/`). Worst 12 pairs: `M/worst.jpg`. Videos: `M/pk-trial.webm`, `M/nx-trial.webm`, `M/m2-next.webm`,
  `M/m5-next.webm`, `M/pk6.webm` (packed match), `M/pk-ka.webm` / `M/nx-ka.webm` (Kickabout).
- **Page errors: none** in either app in any run (every `errors` list empty).
- How I know: **seen** = on a screenshot/frame; **measured** = timed in the page; **code** = read in the source, not seen
  (a browser cannot buzz or play sound to me).

Tools (this folder): `live.mjs` + `pt.mjs` (keep both apps open, drive one command at a time), `autoplay.mjs`
(play a whole match like a player, logs every new line of text), `chance.sh`, `trial-to-strike.sh`, `to-chance.sh`,
`to-fulltime.sh`, `worst.py`.

## HIGH: a player notices at once

| # | Moment | Packed app | KIB Next | Frames |
|---|---|---|---|---|
| H1 | **Aim: dragging back from the ball** (trial, matches, Kickabout, training) | A real **arrow**: tapered orange shaft (gradient), triangular head with a dark edge. Short: ~78 px for a 127 px drag. | A **flat orange line with a round dot** at the end, no head. **About 2.3× longer** for the same drag (~183 px), so it no longer reads as power the same way. Seen in every mode. | `M/aim-zoom-trial.png`, `M/pk-m1-aim-hold.png` vs `M/nx-m1-aim-hold.png` (code: `phone/src/match/drawPitch.ts` 102-110 vs `components/star/CanvasMatch.tsx` drawAimArrow) |
| H2 | **The run-up** (free kicks, penalties) | The aim arrow **stays on screen while you run up**, so you see what you chose. | The line **disappears the moment you let go**; the run-up has no aim on it. | `M/pk-trial-05-runup-00.png` vs `M/nx-trial-05-runup-00.png` |
| H3 | **Volley / header strike screen** | "VOLLEY IT?" with a **HEIGHT meter** on the left, a **hint line** ("Hit its left side to send it right · as it drops through the green"), a **dashed green band** on the dropping ball, a draining bar under the title, the ball falls through the frame. | Only "VOLLEY IT?" and POWER: **no HEIGHT meter, no hint, no green band**; the ball sits still mid-screen; I got "TOO LATE!" with no clue when to tap. | `M/pk6-c4-00.png`, `M/pk6-c4-01.png` vs `M/fr3/v-07.png` |
| H4 | **Strike screen in a match, phone sizes** | Ball sits fully in view above the grass at every size. | **Ball cut off at the bottom of the frame**: a slice missing at 412×915, about **half the ball gone at 360×640**. The low part of the ball (the "lift it" spot) is off-screen. | `M/pk-m1-shot-05.png` vs `M/nx-m1-shot-05.png`; `M/n640-now4.png` |
| H5 | **Where the ball will land / ball in flight** | A **yellow ✕ marks where the ball will come down**, and the ball leaves a **white trail** in flight. | **No landing ✕, no trail**: the ball is a small dot you lose against the grass. Seen on every shot, pass and cross. | `M/pk-gate-05-02.png` vs `M/nx-gate-05-02.png`; `M/pk-trial-07-flight-01.png` |
| H6 | **The result after a shot** | One caption (SAVED / DEFLECTED…) held **~1 s**, then a quiet line under the pitch ("Caught.", "Through."). | **Two captions back to back** (SCUFFED then INTERCEPTED; SCUFFED then SAVED on my penalty), shown **~0.2-0.4 s** before the next screen; the moment is over before you read it. | `M/pk-trial-07-flight-0[1-5].png` vs `M/nx-trial-07-flight-0[0-1].png`, `M/nx-pens-06-0*.png` |
| H7 | **Strike screen title and timer** | "STRIKE IT?" in **brushed-steel italic** with a **yellow bar under it that drains to orange** with the ring. | Plain white italic; the bar under the title is **dark and does not move**. Only the ring counts down. (Both time out at **~3.1 s**: measured 3162 vs 3118 ms.) | `M/pk-trial-06-ring-0[0-3].png` vs `M/nx-trial-06-ring-0[0-3].png` |
| H8 | **Match feel** (code + frames) | The picture **holds for a beat at contact** (wind-up, hit-stop), **screen shake** on big hits, a **slow-motion** last half-second on a goal-bound shot and on a keeper's catch. | No hit-stop (`feelTick` absent), no shake, no keeper slow-mo (`keeperSlowRate` absent). Only the goal-bound slow-mo is there (`bigSlowNow`). Kicks feel weightless next to the packed app. | code: `phone/src/match/driver.ts` vs `CanvasMatch.tsx` 7125-7140 |
| H9 | **Training drill result** | After the kick: caption ("CLIPPED IT"), the tries row updates, you stay on the drill for try 2 / 3; a "?" how-to button. | After the kick: **~0.8 s of a blank navy screen**, then straight back to the Training list; no result, no stars screen, no "?" button, **no how-to card** on the first visit ("HOW IT WORKS … Got it" in packed). | `M/tr-pk-03.png`, `M/tr-pk-c1-c-*.png` vs `M/tr-nx-c1-c-0[1-4].png`, `M/tr-nx-c2-*.png` |

## MED: noticed within a match or two

| # | Moment | Packed app | KIB Next | Frames |
|---|---|---|---|---|
| M1 | Penalties: who is taking it | **Name over the taker** ("Wilson", "Lopez", "Saka"), the other side's takers in **their kit (red)**, a line under the pitch: "Wilson steps up — The Skip." | No names; the **Academy's takers wear our blue**; no "steps up" line (only the top card). | `M/pk-pens-02-0*.png` vs `M/nx-pens-02-0*.png` |
| M2 | Header: the moment before | (not reached in packed this session) | "HEAD IT?" sits **over the live pitch for ~6 s** with a POWER bar before the strike screen; tapping the ball there did nothing; a player does not know what to do. | `M/fr2/a-*.png` |
| M3 | Strike screen tap | A yellow **spark where you hit** stays on the ball. | Spark is in the code (`drawContact.ts` 114) but I did not see it on any frame after a tap. | `M/pk-gate-04-strike.png` vs `M/nx-gate-04-strike.png` |
| M4 | Build-up "skip" | Pill **"Build-up · tap to skip" at the bottom centre** (also "On the break · tap to skip"). | **"Tap to skip ›" small in the top-right corner**; no kind of move named. | `M/pk6-c5-c-2*.png` vs `M/fr2/c-0*.png` |
| M5 | Kickabout first look | A yellow hint card: "Drag back from the ball to aim and control your power, then let go". | **No hint card**; adds a "▶ Goal replays" button the packed app does not have here. | `M/ka-pk-01.png` vs `M/ka-nx-01.png` |
| M6 | 360×640: the bench | Playstyle icons on their own row above GET OUT THERE. | Icons **float over the last commentary lines** and hide them. | `M/p640-feed.png` vs `M/n640-now3.png` |
| M7 | 360 wide: match HUD | GOALS / ASSISTS / PASS / RATING all fit. | "**ASSIS…**" truncated at 360 px. | `M/p780-chance.png` vs `M/n780-chance.png` |
| M8 | Haptics (code only) | A buzz on every strike scaled by how hard you hit it, plus header and woodwork buzzes (`feelHaptic`, 4 call sites). | Two buzzes only: when the kick starts and on a goal (`MatchPitch.tsx` 212, 224). | code |
| M9 | Game music (code only) | Settings → Game music plays the orchestral tracks in the match (`lib/star/gameMusic.ts`). | The setting exists (`prefs.ts`) but **nothing plays it**: no music file or cue in `phone/src`. | code |
| M10 | Celebration after YOUR goal (code; I scored no goal in packed) | Run to the corner, then the shop celebration (`lib/star/celebration.ts`, CanvasMatch 2680+). | Team-mates play a celebrate clip; the GOAL scoreboard pop-up shows ~1.5 s, then it **cuts straight to the feed**. | `M/fr/nx-goal-*.png` (KIB, Rice goal I assisted) |

## LOW: small or only on a close look

| # | Moment | Packed app | KIB Next | Frames |
|---|---|---|---|---|
| L1 | Camera | Straight overhead; turns and zooms during the build-up. | Tipped back ~20° (far end narrower), holds still on a chance; a swipe on the pitch does nothing. | `M/cam-nx-0.png` vs `M/cam-nx-1.png`; `M/pk6-c1.png` |
| L2 | Strike screen ball size in the trial | ~216 px across. | ~206 px; also smaller in the gate drill (~150 px vs ~200 px). | `M/pk-gate-04-strike.png` vs `M/nx-gate-04-strike.png` |
| L3 | Trial result between stages | "Caught." / "Through." line under the pitch, then NEXT UP 3-2-1. | NEXT UP 3-2-1 comes almost at once (see H6); the line under the pitch shows only on the first frame. | `M/pk-trial-07-*.png` vs `M/nx-trial-07-*.png` |
| L4 | Gate drill pitch | Goal line drawn across the top. | No goal line drawn. | `M/pk-gate-01.png` vs `M/nx-gate-01.png` |
| L5 | Trial at 360×640 (KIB better) | **Packed does not adapt**: the top bar (0/1, distance) is gone and the caption under the pitch is cut off. | KIB keeps the top bar, the pitch and the caption all in view. | `M/pk640-aim.png`, `M/pk640-strike.png` vs `M/nx640-aim3.png`, `M/nx640-strike.png` |
| L6 | 360×780 | Both fit (match, trial, strike). Only M7 differs. | | `M/size-*-360x780-*.png`, `M/p780-*.png`, `M/n780-*.png` |
| L7 | Same in both (checked, no difference) | The trial's how-to cards, NEXT UP countdowns, take-him-on 3D runs, find-the-pass rounds, the bench feed, energy badges, FULL TIME button, the turned crossing view, the PASS / SAVED / WIDE captions, the strike countdown length. | | |

## Not reached / not checked
- A goal of my own in the packed app (no packed celebration or goal pop-up seen this round), half-time
  (I came on at 53'), substitutions, captain orders, corners, a dribble chance in a match.
- Sound and buzz: read from the code only (M8, M9); the browser cannot play them to me.
- KIB post-match after a played match: my 360×640 run scored (4-0, GOALS 1) but my bot did not reach full time before
  the time ran out. Packed's after-match chain (seen): animated result card (star bar, match rating, Boss/Team/Fans,
  "Hold to speed up · double-tap to skip") → Post Match Reactions feed → Home (`M/pk6-post-[1-3].png`). KIB's
  simmed post-match is in `../look/DIFFERENCES.md`.
