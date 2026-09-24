---
name: artifact-house-style
description: How Knowitball artifacts are built — the recipe from the v0.1 patch notes, which the owner called "10x better" and asked to be the starting point every time. Load BEFORE writing ANY artifact for this project: patch notes, a build write-up, a review, a decision page, a handover. Triggers on "make artifact", "make an artifact", "patch notes", "write this up", "give me a page", "something I can send the team".
---

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

### 5. Everything long is behind a toggle
`<details>` / `<summary>`, closed by default, labelled with what is inside
("What the four bugs were", "Where it still misses", "The two options"). The
page must be skimmable end to end without opening a single one, and reward
opening any of them.

## What always goes in

- **"Check these" at the very top — every time.** Asked for directly (24 Sep
  2026): *"at the top have a very simple list no yap of all bug fixes to
  check — all patch notes going forward should have a list of every changed
  feature at the top."* Straight after the stat strip: one line per changed
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

## What never goes in

- A tour of the codebase, or file paths in the main flow. A filename belongs in
  a toggle, if at all.
- "We", "I", or any narration of the process. The reader wants the outcome.
- A conclusion built up to. Lead with it.
- Emoji as section markers — coloured dots, not decorations.

## Patch notes carry their own history

Asked for directly: *"specifically for patch notes, if it could toggle to see
the previous version — i.e. v0.2 has a drop down for 0.1, that would be great."*

So a patch notes page is **one link, forever**. v0.2 contains v0.1, v0.3
contains both. Nobody hunts for an old link and nobody has a version go missing.

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

## Mechanics

- Author as `.html`, phone-first, 16px side gutter, no horizontal scroll.
- Colour tokens on `:root`, redefined for dark mode under
  `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`
  and again under `:root[data-theme="dark"]`. Explicit `background` on `body`.
- Title is two to four words, a name not a sentence ("Knowitball v0.1").
- Screenshots go in `files` as `img/<name>.png`, referenced as `img/<name>.png`.
- **Artifacts are private.** Say so when handing over the link, and say who
  cannot open it yet.
- **You cannot change sharing.** That is the Share menu on the page, by hand.
  Don't offer to do it.

## Before you hand it over

Ask yourself, honestly: **could someone scroll this in thirty seconds and know
what changed, what is broken, and what happens next?** If not, it is still too
long — cut prose, add a bar, or push it into a toggle.
