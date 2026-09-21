---
name: ui-house-style
description: The house UI rules for Knowitball, kept as a living record of what Harry and Mikey have actually said about screens. Load BEFORE building or changing any screen, panel, card, gallery or dev tool — and after they give visual feedback, WRITE THE RULING INTO THIS FILE so it never has to be said twice. Triggers on any work touching components/star/**, app/star-*/**, app/admin/**, or any request phrased as "make it nicer", "too much text", "that looks wrong", "Appleified", "simplify the page".
---

# House UI style

Neither Harry nor Mikey writes code. Every screen is judged **by looking at it on a
phone**. This file is the accumulated record of what they have ruled, so the same
correction is never needed twice.

## How this file updates itself

**This is the point of the skill.** Whenever they give feedback on a screen:

1. Make the change they asked for.
2. **Immediately add a line to "The rulings" below**, in their own words where
   possible, with the date and — if there is one — the number that proves it.
3. If the new ruling contradicts an older one, do not delete the old line.
   Strike it and say what replaced it. The history is why a rule exists.
4. If a ruling was inferred rather than stated outright, mark it `(inferred)` so
   a future session knows it is weaker than a direct quote.

A ruling with no number is still a ruling. A ruling with a number is stronger.

## Before you build

- **Screenshot the current state first**, at 390x844, and get the full-page pixel
  height. That number is the before. You will need it.
- **Show work in progress, not just the finished thing.** Stated directly,
  21 Sep 2026: *"Show me screenshots also while you're going, of changes. Don't
  just give me the final output with screenshots, because I'm not going to be
  able to do anything about it then."* Send a screenshot at the halfway point,
  even when it is ugly.
- The dev server is usually already running on :3000. Check before starting one.
  Do not kill it — another agent may be using it.

## The rulings

Newest first. Each is something that was actually said.

### 21 Sep 2026 — the gallery rebuild
- **"It's literally just a scenario gallery."** The front page is three things and
  nothing else: 11-a-side, 5-a-side, Scenario Builder. No preamble, no
  explanation, no note about what the page is for.
- **Text is the enemy.** The page measured **25,836 px at 390 px wide** — about
  31 phone screens, most of it prose. Before/after pixel height is the metric
  for "is this simpler", and it must go in the report.
- **"Appleified."** The reference is the App Store *Today* tab: one full-bleed
  picture per card, one short title on the card, the content IS the card rather
  than a caption about it.
- **Drag-to-edit stays.** Asked whether it was part of the clutter: *"No, I think
  the drag-to-edit is not the problem on that page."* It is a feature, keep it.
- **A fault is a ring on the thing that is wrong**, not a paragraph under the
  picture. At most one line of red text.

### 20 Sep 2026 — judging shapes
- **Render the real thing, never a mock-up.** A card showing a scenario must run
  the same drawing code the game runs. A second, approximate renderer will
  quietly disagree with the game and the disagreement will be invisible.
- **Seed everything.** A picture must be identical on every refresh. Never
  `Math.random()` in anything a person is asked to judge, or they cannot point
  at what they saw.

### Standing, from CLAUDE.md — do not re-derive these
- **Show, do not describe, anything with a size or a shape in it.** Goal width,
  figure proportions, prices, framing, difficulty. Render the options at real
  phone size and let them point. Use the `show-options` agent.
- **Phone first.** Desktop is the afterthought, not the other way round.
- **Name things the way they appear on screen.** File paths go in brackets
  afterwards, once, only if someone needs to find it.
- **No fluff.** *"There's sometimes too much fluff in how you speak… I'm having
  to skim through too much yap."* No preamble, no restating the request, no
  praise for the idea, no tour of the code.

## Before you hand back

- Screenshot at **390x844** and report the full-page pixel height of every screen,
  before and after.
- Zero console and page errors. Say so explicitly, or say what they are.
- Say plainly what you could NOT do and why. A gap stated is fine; a gap hidden
  is the thing that gets caught later.
- **Then update "The rulings" above** with anything new they said.
