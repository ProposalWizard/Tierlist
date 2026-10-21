---
name: video-to-build
description: Harry's playtest-to-build loop (/video-to-build). Load when Harry types /video-to-build, or hands over a playtest recording and says to analyse, plan and build without waiting ("analyse, plan, patch notes, then build with no confirmation"). Video → breakdown → plan → my own answers → final plan → build → Harry reviews.
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes.

# Video → build, no waiting

Harry, 13 Oct 2026: *"analyse, plan and then make a patch notes with the plan, then with no
confirmation needed from me begin building and build out the answers to ur own questions in the
patch notes … Video - breakdown - plan - response to plan/solutions - plan - execute - Harry
reviews (let's test this and if it works we will make it a skill.)"* First run was v0.49 (13 Oct).
Confirmed the same day: *"I like the video to build skill make it a / skill."* Type `/video-to-build`
(optionally with the Drive link or file name) to start it.

## The six steps

1. **Video.** Find the newest file in the Drive folder (playtest-video skill), `fetch.py`, then
   `breakdown.py` (about 1–2 min for 7 min of video). Read the whole transcript and open every sheet.
2. **Breakdown.** One table: time · what he said · what the picture shows. Say "seen in your video
   at mm:ss" for each. Note anything he says to leave alone.
3. **Plan.** One card per item, each a job a builder can finish alone. Group by file area so two
   builders never edit the same file (shared files: CanvasMatch.tsx, app/star-dev/page.tsx).
4. **My questions, my answers.** Every open question gets my own answer with a one-line reason,
   from his words or the house rules. He can overrule any. Never stop to ask.
5. **Build (no confirmation).** In parallel: builders (model split RUL-TEAM-014 to RUL-TEAM-016, worktrees, reset to
   origin/Harry first), research on the everyday model, and the plan page (make-artifact, everyday
   model) published at the same time. Builders save stills as they go and the lead sends each to Harry with a caption (PRO-TEAM-003; keep a sent list). Progress bars every 5 minutes (RUL-TEAM-003, progress-update skill). Look at every still before sending; send fixes back to the builder.
6. **Harry reviews.** Merge every builder locally, merge origin/main, run tsc, the one-engine
   guard, the full star tests and `npm run build`. ONE push to Harry. Update the same plan page to
   "built" with after pictures and known issues. Patch notes ship at once with `ship.mjs` (PRO-TEAM-007); the feature goes live only when Harry says push (RUL-TEAM-019).

## Rules learned on the first run
- Don't push per builder: one push at the end (each push queues a Vercel build).
- A builder's "before" may need a real wait for pictures to load; check blurry stills before believing them.
- A camera fix that cuts scenery can leave black void: show the real stadium instead.
