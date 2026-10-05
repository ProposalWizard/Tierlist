---
name: progress-update
description: Give Harry or Mikey a quick progress update as text progress bars — one bar per piece of work, how far along it is, and what it is waiting on. Load WHENEVER someone asks "update?", "how's it going", "where are we", "progress", "what are we waiting on", "status", or "how are these changes doing", and at the end of any long build or playtest round. Rebuilt 3 Oct 2026 after the first version (saved outside the repo) was lost with its cloud container; it now lives in the repo so it survives.
---

# Progress update — bars, not paragraphs

Harry, 3 Oct 2026: "the skill where you would give me progress bars". They
read updates on a phone in a few seconds. The update is a set of bars, one per
piece of work, then at most one line of what is next or blocked.

## Shape

```
UPDATE · 14:20

Camera tilt 20°        ██████████  done · pushed
Keeper dive fix        ████████░░  built · filming to check
Even highlight mix     ██████████  done · pushed
Patch notes v0.28      ███░░░░░░░  writing

Waiting on: you, to merge Harry → main
```

## Rules

- **One bar per piece of work the person asked for**, named the way they said
  it ("the keeper", "the tilt"), not by file. Up to 8 bars; group small fixes.
- **10 blocks wide**: `█` done, `░` to go. Round to the nearest 10%.
- **The words after the bar say where it is**, from this fixed list so they
  mean the same thing every time:
  `planned` · `building` · `built` · `testing` · `filming to check` ·
  `pushed` (on branch, not live) · `live` · `blocked: <who/what>`.
- **How the % is worked out** (no guessing): planned 10, building 30–60,
  built 70, testing / filming 80–90, pushed 100 for our part (say "not live").
  If it is waiting on a person, the bar stops where it is and says who.
- **Say whether it was seen**: `pushed · seen on phone`, or
  `pushed · not seen yet`. Never call something done that has only passed tests
  if they asked about how it looks or feels.
- **Then one line**: what happens next, or what is waiting on whom. No prose
  paragraph, no file names, no recap of the request.
- **A background agent still running** is a bar at its current stage, with
  "running" — never guessed results.
- Follow the house writing rules (CLAUDE.md "How to talk to this team"): short,
  plain English, numbers where there are numbers.

## When to send one

- **As you go, without being asked (Harry, 5 Oct 2026: "run the progress
  skills as you go").** Each time a piece of work changes stage (built,
  pushed, checked on screen, blocked), send a fresh set of bars.
- Whenever asked (any of the trigger phrases).
- After a long round finishes, as the first thing in the reply, before detail.
- Mid-round, if more than about 20 minutes have passed with no word.
