---
name: artifact-house-style
description: How Knowitball artifacts are built — start from references/tuning-plan-standard.html (Harry, 14 Oct 2026: "this should be standard"): numbered points, a drawn diagram for each idea, numbers hidden in a toggle. Load BEFORE writing ANY artifact for this project: patch notes, a build write-up, a review, a decision page, a handover. Triggers on "make artifact", "make an artifact", "patch notes", "write this up", "give me a page", "something I can send the team".
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes.

# The Knowitball artifact recipe

Two people read these and neither writes code. They judge by scanning, on a
phone, in about thirty seconds — then open the one or two things they care
about. Build for that.

**The instruction this exists because of**, said after a first attempt that was
a wall of prose: *"the artifact is way too yappy and still looks a bit hard to
read — use visuals, toggles and speak in the plainest quickest english — it
should read like a game dev patch updates."* And then, of the rewrite:
*"this artifact is 10x better… everytime I say 'make artifact' I want you to
remember how you made this one and build from there."*

**Start from `references/patch-notes-v0.1.html`.** It is the real page that got
that reaction. Read it before writing anything — copy its structure, its CSS and
its density, then change the content.

## THE STANDARD: `references/tuning-plan-standard.html` (Harry, 14 Oct 2026)
*"I love the diagrams, this is a much better patch notes and unless stated
that more is needed this should be standard."* Every page — patch notes,
plans, reviews — starts from this file now, not from v0.1. Copy its shape:
numbered points, each a plain idea in two or three sentences, then a drawn
diagram (flow boxes, pitches with dots and arrows); numbers in one closed
toggle at the bottom; YOUR CALLS as short yes/no items. Add more (stills,
bars, clips) only when someone asks for more. Check the diagrams at 390px:
never force an SVG wider than the phone.

## Pictures, not numbers (Harry, 14 Oct 2026, overrides the rules below where they differ)

*"Over the course of the building cycle, patch notes have decreased in quality
… writing a bunch of numbers and percentages doesn't do anything. The headline
and the idea are written so poorly. Diagrams, images, and pictures are better
for us."*

- **Lead with the idea in one plain sentence**, then a picture of it. The
  headline says what changes for the player, not a measurement.
- **Every idea gets a diagram, a still or a drawn pitch** before any words.
  Draw football things as football: a pitch, men as dots, arrows for runs.
- **Numbers only where one number tells the story** — at most one or two per
  section, never tables of percentages. Anything detailed goes in a closed
  toggle ("The numbers, if you want them").
- **No stat strip of percentages at the top.** If there is a strip, it is
  plain-word changes ("chances follow the match"), not figures.
- **Explain from the player's side** ("you get the ball on your own wing"),
  never from the code's side ("lane weighting").
- Plans are explained as **point 1, point 2, point 3**, each a short idea +
  a picture, not as a specification.

## The five rules that made it work

### 1. Game patch notes, not a report
Sections are **FIXED / ADDED / CHANGED / KNOWN ISSUES / NEXT**, each with a
coloured dot. Not "Overview", not "Background", not "Summary". Somebody should
be able to tell what kind of thing every item is from its section alone.

### 2. One bold line, one thin line
Every item is a **bold headline you could read out loud** plus at most one line
of detail underneath. If it needs more, it goes in a toggle. No paragraphs
anywhere in the main flow.

Good: **"Scoring was halved. Now it isn't."**
Bad: "This section describes changes to the conversion pipeline…"

### 3. Numbers become bars
A before/after number is a **bar**, not a table row: grey fill for the old
value, coloured for the new, the figures on the right with the old one struck
through. Green = fixed. Amber = half fixed. Red = still wrong, and say so.
A number with no visual is a number nobody reads.

### 4. Screenshots carry the weight
**Embed real screenshots.** This is the single biggest difference between the
version that landed and the one that didn't. A picture of the thing removes
three sentences describing it. Ship them as artifact `files` (an `img/` folder
alongside the page) and reference them relatively.

Every screenshot gets a one-line caption saying what to look at — not what it
is.

> **Patch-note rules live in the Brain:** RUL-TEAM-005 (no test build link;
> mostly stills; a short "after" clip only for gameplay or animation),
> RUL-TEAM-010 (no "needs Mikey's yes"), PRO-TEAM-008 (order: stills, ship
> notes, publish, push when Harry says, then film clips), PRO-TEAM-003
> (builders save each still at once; the lead sends it to Harry with a
> caption). The older before/after-clip-for-everything, "builders don't
> film" and "one combined copy" rules are superseded (FACT-ALL-002).

### 4b. How to show a clip (only when RUL-TEAM-005 allows one)
- **Film with `scripts/film/rec.mjs`** (read `scripts/film/README.md`): real
  MP4, the whole 390x844 phone screen at 2x, a dot for every tap. Never GIFs,
  never crops, never a 300-px strip.
- **Show it with `references/clip-card.html`**: `<video controls
  playsinline muted preload="none">` with the still as `poster`, 1/2x and 1/4x
  speed buttons, and a "Look for" line saying what to watch. Never two phone
  shots squeezed side by side on a phone.
- Clips go in `files` as `clips/<name>.mp4`. The admin patch-notes archive
  plays them too (it serves `.mp4` with byte ranges).
- Watch every clip's cover and open every still before publishing.
- **Confirmed by Harry on the v0.20/v0.21 pages (1 Oct 2026):** *"these
  artifacts are amazing, speed tabs, the more pictures settings — this is
  GREAT."* So keep: the speed buttons under every clip, extra stills behind a
  "More pictures (n)" toggle, the detail behind a "The detail" toggle, and one
  short line + "Look for" above the clip. Pattern to copy:
  `references/generators/review-page-build.py` and `v021-page-build.py`; the
  reusable card is `references/clip-card.html`.

### 5. Everything long is behind a toggle
`<details>` / `<summary>`, closed by default, labelled with what is inside
("What the four bugs were", "Where it still misses", "The two options"). The
page must be skimmable end to end without opening a single one, and reward
opening any of them.

## Every item is Problem → Why → Fix (patch notes)

Asked for directly (24 Sep 2026): *"the patch notes has to be readable for
people who didn't work through the whole problem — it should be list of
problems — explain — solution found. Anything super confusing needs that extra
help with before/afters illustrations, and sometimes stuff like the guard is
the main headline."*

- **Write for someone who wasn't in the conversation.** Never assume the
  reader knows what "the guard", "a copy", "drawn chances" or "question 6"
  mean. Say it in the item itself.
- **Every fixed/added item is a card with three labelled rows:**
  **Problem** (what a player would have noticed, in their words and with the
  number), **Why** (the cause, in plain English), **Fix** (what changed, and
  whose answer it came from). Known issues use Problem / Why / Status.
- **The biggest or most confusing change is the headline**, above the
  checklist: its own bordered section with the same Problem / Why / Fix, a
  before/after, and "what this means for you".
- **Pictures for anything confusing** (clips only per RUL-TEAM-005). A real screenshot pair when one exists; otherwise a small drawn diagram (inline SVG or HTML boxes)
  labelled as a drawing, with anything exaggerated for visibility saying so.
- **Answers to their questions go low**, after the changes, never at the top.
  A reply only makes sense once the reader knows what changed.
- Page order: header → stat strip → headline → Check these → Problems fixed →
  Seen in a browser → Your questions, answered → Known issues → New questions
  → Next → Previous versions. Reference: v0.10 (`pn10` build, published at the
  same patch notes URL).

## What always goes in

- **"Check these" near the top — every time** (straight after the headline). Asked for directly (24 Sep
  2026): *"at the top have a very simple list no yap of all bug fixes to
  check — all patch notes going forward should have a list of every changed
  feature at the top."* Straight after the headline section: one line per changed
  feature or fix, a tick box each, and a grey line under it saying exactly
  where to go to see it (screen → tab). No explanations, no numbers — those
  live in the sections below. Every item in FIXED / ADDED / CHANGED gets a
  line here; nothing is left off because it's small. Ticks are remembered
  per viewer in localStorage (wrapped in try/catch), never shared.
- **A stat strip at the top** — four big numbers, the ones that would make
  someone say "oh, good". Not four numbers you happen to have.
- **Known issues, honestly.** Including things nobody asked about, and
  including things you broke. A red bar saying "untouched" is worth more than
  silence. If something is half fixed, the bar is amber and the item says so.
- **What is blocked on whom.** Use a pill: `blocked on Harry`, `half fixed`.
- **Anything unverified says it is.** "Not seen in a live match" belongs on the
  page, not in your head.

## Write it plain, and draw the hard parts

Standing rules, in the Brain: RUL-ALL-004 (about 80% of ASD-STE100: short
sentences, active voice, no coder words), RUL-ALL-005 (a stat or rule with
conditions gets a picture, but only where a picture beats one plain line;
"don't get crazy on the diagrams"), RUL-ALL-006 (every claim has a number
or says it has none; before beside after), RUL-ALL-007 (seen, measured or
reasoned). The page layout stays the same; these set how each sentence is
written and how numbers are shown.

How to draw them on a page (the how-to, not the rule):
- A number with a before and after is a bar or a dial, never only a sentence.
- A rate is "7 in 10" or "70 of 100 kicks", not "0.7".
- A rule with conditions is a small flow diagram or a table with ticks and
  crosses, not a paragraph.
- A size, position or timing is shown on a phone-sized picture with a marked
  line.
- Every diagram has a one-line caption: what to look at, in plain words.

## What never goes in

- A tour of the codebase, or file paths in the main flow. A filename belongs in
  a toggle, if at all.
- "We", "I", or any narration of the process. The reader wants the outcome.
- A conclusion built up to. Lead with it.
- Emoji as section markers — coloured dots, not decorations.

## V1 (the all-versions page) reads newest first

Harry, 3 Oct 2026: "redo it so from now on the newest updates are at the TOP
and go backwards." V1 (https://claude.ai/artifact/YEK3ykwCQjUpH4S6bQbqKR) is
newest first everywhere: the At-a-glance index, the days, the versions inside
a day, Still open, the decision groups and Original pages. A new version goes
at the TOP of its day, and a new day above the last one. The script that last
rebuilt it is `references/generators/v1-newest-first.py`.

## Patch notes carry their own history

Asked for directly: *"specifically for patch notes, if it could toggle to see
the previous version — i.e. v0.2 has a drop down for 0.1, that would be great."*

So each patch notes page carries its own history: v0.2 contains v0.1, v0.3
contains both. Nobody hunts for an old link and nobody has a version go missing.

**Every new version number is a NEW link** (Harry, 28 Sep 2026: *"when I say
new patch notes why is it going on the same link - isn't that updating v0.16?
Make a NEW one with new changes"*). Publish v0.17 as a fresh artifact; never
republish over the previous version's page, which stays as that version's
frozen record. Republishing the same link is only for fixing or adding to the
SAME version number before it's superseded.

**Where:** a final section, `PREVIOUS VERSIONS`, below NEXT. Same dot-heading
style, using the muted colour.

**Shape:** one `<details>` per old version, newest first, summary reading
`v0.1 — 21 Sep 2026` plus a four-or-five word note of what it was
("the chance formula and the camera").

**What goes inside — condensed, not the whole old page:**
- The old version's FIXED / ADDED / CHANGED headlines only, as a plain list.
- Its stat strip numbers, as a single line of text.
- **No nested toggles**, no bars, no screenshots. A toggle inside a toggle is
  where a page stops being skimmable, and old screenshots are what make it
  heavy.
- One line at the end of each: which known issues from that version are still
  open, by name. That is the bit people actually go back for.

**What carries forward whole:** a known issue stays in the CURRENT version's
KNOWN ISSUES until it is fixed — it does not get demoted into history just
because it is old. History is for what changed, not for what is still wrong.

**Keep every shipped version** as its own file in this skill's `references/`
folder, named `patch-notes-v0.1.html` and so on. The next version is built by
copying the newest one and condensing the version it replaces.

**The first version** still gets the section, with the empty state — see
`references/patch-notes-v0.1.html`. It shows the next build exactly where the
history goes.

## Stack, don't squeeze

Asked for directly (Harry, 27 Sep 2026), about a plan page whose five-step
flow and "You said / Why / Plan" rows were laid out side by side: *"I don't
like the way that you're formatting this. The way the text is so squeezed, it
doesn't look good. Just put stuff clearly, one above each other, and let you
read the full thing."*

- **One column of text, full width.** Every paragraph gets the whole width of
  the page, on a phone and on a laptop.
- **Labels go above their text, never beside it.** "You said", "Why", "Plan"
  are small headings on their own line, with the paragraph underneath. No
  label column squeezing the text into the right-hand two thirds.
- **A sequence is a vertical list**, one step per row, top to bottom. Never a
  row of boxes with arrows between them.
- **No grids of text cards.** Cards side by side are for pictures (a
  before/after pair) or big numbers, never for sentences.
- **Tables only for numbers**, three columns at most. Anything with a sentence
  in it is stacked instead.
- Check it on a laptop width too: if any sentence wraps after a few words
  because its box is narrow, it's squeezed. Stack it.

## Naming the match files

Harry, 27 Sep 2026: *"let's also just stop calling the match file 'mikey's
area' and start calling it sensitive."* On any page: `components/star/CanvasMatch.tsx`
is **the match file (sensitive)** and `lib/star/canvasEngine.ts` is **the core
engine file (sensitive)**. Never "Mikey's area" or "Mikey's lane". Where a
change needs Mikey's go-ahead, say that as a fact on the item ("Mikey said
yes"), not as a file's name.

## Mechanics

- Author as `.html`, phone-first, 16px side gutter, no horizontal scroll.
  Give every grid or flex child `min-width: 0` (a long no-wrap line or a wide
  table otherwise widens the whole page: the live-bars page was 564px wide on a
  390px phone, Harry 18 Oct 2026: "how comes artifacts like these don't scale to
  phone"). Before publishing, load the page at 390px and check the page width is
  390, not just that it looks fine on a laptop.
- Colour tokens on `:root`, redefined for dark mode under
  `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`
  and again under `:root[data-theme="dark"]`. Explicit `background` on `body`.
- Title is two to four words, a name not a sentence ("Knowitball v0.1").
- Screenshots go in `files` as `img/<name>.png`, referenced as `img/<name>.png`;
  clips as `clips/<name>.mp4` (4b).
- **Artifacts are private.** Say so when handing over the link, and say who
  cannot open it yet.
- **You cannot change sharing.** That is the Share menu on the page, by hand.
  Don't offer to do it.

## Before you hand it over

Ask yourself, honestly: **could someone scroll this in thirty seconds and know
what changed, what is broken, and what happens next?** If not, it is still too
long — cut prose, add a bar, or push it into a toggle.
