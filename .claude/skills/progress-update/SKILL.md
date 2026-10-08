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

## Expected token use (Harry, 8 Oct 2026)

*"add an expected token usage to the progress skill … based on previous
builds the expected percent of weekly usage … or at least token usage."*

**Every progress update carries this block — no exceptions (Harry, 8 Oct
2026: "dont leave out the expected tokens and percentage in the progress,
make it a rule").** Even a short bars-only update, even when nothing changed.
An update without it is incomplete.

Under the bars, add one usage block:

```
Tokens so far   ~1.2M  (builders finished: 2 of 4)
Expected total  ~5–7M for this round
Weekly usage    started at 11% → expected ~18–20% at the end (rough)
```

- **Count real numbers where you have them.** Every finished agent reports
  its tokens (`subagent_tokens` in its completion notice). Add those up.
  Running agents have no count yet: use the guide below for them.
- **Guide from past builds** (update this table when a round finishes):

  | Kind of job | Typical tokens |
  |---|---|
  | Research / audit (everyday model) | 0.2–0.5M |
  | Option pictures (show-options) | 0.5–1.5M |
  | Logic or server build (top model) | 1.5–3M |
  | 3D scene build (top model) | 2–4M |
  | Playtest / filming pass | 0.5–2M |
  | Patch notes page | 0.3–0.8M |

- **Weekly %.** We can't read the usage meter. Ask for the % at the start
  and end of a round, then write the tokens-per-1% figure here so the next
  estimate is better. Until then say "rough".
  Calibrate only when nothing else is running on the account (Harry, 8 Oct:
  other projects share the same weekly meter). Harry says when his other
  tasks are done; then note the %, run one task here, note the % again.
  Calibration log (start % → end %, tokens): *(none yet)*
- Always say it's an estimate. Never present a guess as measured.

## Timed updates

If asked for updates every N minutes during a build, schedule them with
`send_later` (claude-code-remote) and re-arm after each one. Stop when the
round is done or when asked. If nothing changed since the last one, send the
bars anyway but keep it to the bars.
