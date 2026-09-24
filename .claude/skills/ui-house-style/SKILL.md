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

### 24 Sep 2026 — energy-mode icons
- **Low / Medium / High are icons, not words.** From Mikey's three concept
  images: a split ring with a lightning bolt breaking through it — red Low,
  amber Medium, green High. "Instead of saying what it is, it should just use
  these icons… design new icons based upon these concept images." Drawn as
  vector (`components/star/EnergyModeIcon.tsx`); 2 · 4 · 6 sparks show the
  level without colour. The chosen one glows; the others dim.
- First pass at 34px was too small and the thin bolt read as a black line —
  46px and a chunky two-tone bolt fixed it. A thin shape under a thick
  outline disappears at phone size.

### 23 Sep 2026 — the social feed posts
- **Posts look like real social media, not cards.** Verbatim: the posts "are
  all boxed with curved things… what I want is how it is in the concept image
  where it actually looks like social media, where they just integrate nicely."
  No box: posts run edge to edge with a hairline between them, picture in a
  left column, name + tick + handle + time on ONE line, a full action row
  (replies, reposts, likes, views, share). Measured on 7 sample posts: 1,413 px
  → 1,239 px at 390 wide.
- **No category labels on posts.** "Some of them currently are labeled as back
  page or stats or club, which is unnecessary." Who posted it is enough.
- **A stat box or award card is an attached picture.** "If you want wording,
  then it will be at the top. And then below, it will be kind of like that same
  type of image thing." Words first, the graphic under them like a photo.
- Judge posts at `/star-dev/media-lab?feed` — the real post component with
  fixed sample posts.

### 23 Sep 2026 — the page guide (the eye)
- **"There should be an information panel on every single page in the admin
  sections: just a little eye on how to use whatever's currently on the page…
  the same UI across everything."** Every admin/dev page carries the same eye
  button (bottom-right unless it would cover a control) opening one panel:
  what the page is, every button by its on-screen label, where saving goes,
  whether it commits to the repo, where it shows up in the game. One look,
  one data file — see the `admin-page-guide` skill. This is where explanation
  lives on a dev tool, so the tool itself can stay picture-first.

### 21 Sep 2026 — Infinite Highlights, second pass
- **"The actual infinite highlights page should also have the editor tools in
  there."** Seeing a broken chance and being able to fix it are one job, not
  two screens. If a review tool can show you a fault it should let you correct
  it on the spot — flagging and then hunting for the same chance in another
  tool is the gap. Drag, + Team-mate, + Opponent, Remove and Save are now on
  the highlights screen, the SAME code the gallery runs
  (`components/star/EditableFrame.tsx`, `lib/star/scenarioEdit.ts`).
- **One editor, not two.** Same ruling as "one generator, one renderer",
  extended to editing. The drag/hit-test/add/remove/save code was lifted out
  of the gallery page rather than copied into the second one — a second copy
  drifts, and this build has been burned by exactly that before. Proved by
  rendering the pre-refactor gallery beside the new one: the version screen
  and a real add+drag came out **byte-identical** (same PNG sha256, same
  localStorage record).
- **A control only appears when there is something to do with it.** Save and
  Discard show up the moment a picture is edited and not before; "revert to
  the generated chance" only on one that has been saved.

### 21 Sep 2026 — Infinite Highlights
- **"A test that measures the wrong path passes; a person flicking through a
  hundred real chances catches it in a minute."** Said after a camera change
  shipped broken, signed off on a measurement of the wrong code path and only
  caught when he played it. The ruling this sets for any review tool: optimise
  for how fast someone can SEE a hundred of the thing, not for features. One
  big Next, arrow keys, swipe, one tap to flag.
- **A review screen must run the real generator, not a copy of it.** Extended
  from "render the real thing, never a mock-up" (20 Sep) to cover how the
  thing is MADE, not only how it is drawn. Infinite Highlights and the
  gallery's Simulate both go through `nextHighlight`/`nextSim`
  (lib/star/gallerySim.ts) and both draw through `paintMarked`
  (lib/star/scenarioFrame.ts) — one generator, one renderer, or the tool can
  agree with itself while disagreeing with the game.
- **A ring goes on the body the fault names.** Measured: 4 of the fault
  strings ("defender standing on you", "defender piled on the ball", "you are
  off screen", "the pass target is off screen") were falling through to a ring
  on the BALL, which points at the wrong thing on screen. Each rings its own
  culprit now.

### 21 Sep 2026 — the admin nav panel
- **"Have that somewhere on the screen on PC, more so than mobile."** The one
  stated exception to phone-first below. Admin/dev tooling is judged on a
  desktop, so the edge tab is desktop-only and absent on a phone rather than
  shrunk — a floating element on a phone collides with the games' own corner
  buttons. This does NOT loosen phone-first for anything players see.
- **"If I'm on the scenario page, I can easily get back to the homepage, and if
  I'm on the homepage, then I can easily get back to the scenario page."** Every
  admin/dev destination in one list, reachable from every page including the
  immersive ones that hide the normal nav. Getting out has to be as easy as
  getting in.

### 21 Sep 2026 — the gallery, second pass
- **"Across formations… is kind of irrelevant."** Verbatim: *"it should be a
  toggle to even show it right now because it's taking up 60% of the screen
  and it doesn't actually even work. You can only see 3 formations. It doesn't
  change anything… for now it would make more sense to have that space be the
  simulate random option or just nothing there."* Measured: on a 1280-wide
  screen the strip owned the whole right column — 60% of the width — by
  default. It is now behind a toggle, OFF, and the space is the Simulate
  button. NOT deleted: he wants it back later.
- **"I should be able to add more than 10."** A fixed grid size is a cage. Any
  grid of seeded versions gets a "+ Add version" tile and remembers the count.
- **A dev tool that only lets you MOVE things is half a tool.** Verbatim:
  *"you can't add teammates, you can't remove opposition, add opposition.
  There are a few bits of the editing tool missing."* If a screen lets you drag
  a thing, it should also let you add one and take one away.
- **"I just need an output."** On Simulate, verbatim: *"all the simulate should
  do is simulate one screenshot or one scenario, as if a player was playing the
  game… Right now, unless that is what you're saying, which doesn't sound like
  it is, I don't need a bunch of data. I just need an output."* A run counter,
  a fault tally, a hit rate — none of it goes on screen. Measurements belong in
  the hand-back report. The screen shows the picture.

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
