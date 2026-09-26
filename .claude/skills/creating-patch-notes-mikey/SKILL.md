---
name: creating-patch-notes-mikey
description: Build "Knowitball Patch Notes Mikey (version)" — a shareable artifact page for Harry and Leo listing what changed in the game since the last patch notes (fixed, added, changed, known issues, next), with before→after numbers. Use whenever Mikey asks for patch notes, a changelog, an update summary for the team, or "what changed"; also offer it after a batch of game changes is pushed.
---

# Creating patch notes — Mikey

(Leo has his own track in `creating-patch-notes`; Harry may have one too. This one is only for Mikey's work.)

Patch notes are how Mikey tells **Harry and Leo** what changed in Knowitball, and how the team tracks updates and bugs over time. Neither of them writes code. Write for someone who plays the game, not someone who reads it.


> **Standing rule (Harry, 24 Sep 2026):** readable by someone who wasn't in
> the conversation. The biggest or most confusing change is the headline;
> every item is Problem → Why → Fix; confusing ones get a before/after
> picture; answers to questions go low. See `artifact-house-style` → Every
> item is Problem → Why → Fix.

> **Standing rule (Harry, 24 Sep 2026):** every patch notes page opens with a
> "Check these" list — one plain line per changed feature or fix, with where
> to find it, no explanations. See `artifact-house-style` → What always goes
> in. The site entry (`lib/patchNotesData.ts`) gets it too, as its first
> section's items.

## Naming and versions

- Title, exactly: **`Knowitball Patch Notes Mikey vX.Y`** — used for the page `<title>`, the `<h1>`, and the artifact name.
- The version history lives in `patch-notes/mikey/versions.json` (create it on first use with `[]`). Each entry:
  `{ "version": "0.1", "date": "YYYY-MM-DD", "fromCommit": "<sha>", "toCommit": "<sha>", "url": "<artifact url>", "headline": "<one line>" }`
- **Next version:** bump the minor number (0.1 → 0.2 → … → 0.9 → 0.10). Bump the major (1.0) only if Mikey says so (e.g. a public launch).
- **First ever run:** version `0.1`, covering whatever Mikey says it covers (ask in one line only if genuinely unclear).
- Save the finished HTML to `patch-notes/mikey/vX.Y.html` too, so the history sits in the repo.

## Step 1 — Find what changed

1. Read `patch-notes/mikey/versions.json`. The last entry's `toCommit` is where this version starts.
2. `git log --oneline <lastToCommit>..HEAD` and `git diff --stat <lastToCommit>..HEAD` on Mikey's branch. Include uncommitted work only if Mikey says it's part of this release.
3. Read the actual changes, plus the conversation, to understand **what a player will notice**. Commit messages are a starting point, not the source of truth.
4. Pull the real numbers. Every item should carry a number where one exists (a price, a percentage, a count) and the **before** alongside the **after**. Measure through the code (a small `npx tsx` script against `lib/star/**`) rather than guessing. Delete any scratch script afterwards.

## Step 2 — Sort every change into one section

In this order, skipping empty ones:

| Section | Dot colour | What goes in it |
|---|---|---|
| **Fixed** | green | Bugs that are gone. Say what the player saw before, and what happens now. |
| **Added** | blue | New features, screens, items, mechanics. |
| **Changed** | violet | Existing things that now work or cost differently: balance, prices, rules. |
| **Known issues** | amber | Bugs still open, reported but unreproduced, or not yet seen on a screen. Tag each `HIGH` (red pill) or `LOW` (amber pill). **Never leave this out when something is open.** It is how the team tracks bugs. |
| **Next** | grey | What's planned or waiting on a decision. |

Then a **Previous versions** list at the bottom, read from `versions.json` (newest first, each linking to its artifact URL).

## Step 3 — Write each item

Each item is one line with an optional fold-out:

- **Headline** (bold): what changed, in player words. "KIB cans now cost a slice of your wage", not "refactored kibCanPrice".
- **Detail line**: the key number, before → after. "Basic can ★16 → half a week's wage (★12 in the National League, ★3,168 in the Premier League)".
- **Optional before/after bars** when a number moved and the size of the move matters.
- **Optional fold-out ("Why / how")**: the reason or cause, for anyone who wants it. Keep it short. File names in `<code>` only here, never in the headline.

Rules (these are the team's standing rules — see CLAUDE.md "How to talk to this team"):
- No fluff, no praise, no "we're excited to". Key point, key number.
- Say whether each thing was **seen** (playtested on a screen), **measured** (tests/scripts), or **reasoned** (read the code only). Use a small tag at the end of the detail line: `seen`, `measured`, or `not yet seen`.
- Name things the way they appear on screen.
- Group many small changes to one area into one item rather than ten.

## Step 4 — Build the page

Start from `template.html` in this folder. It has the full style (dark green theme, light mode, phone-width layout) and one example of every block. Replace the example content; keep the class names.

- Header: version pill (`vX.Y`), title, a sub-line with the date, branch, and "tests: all passing" or the honest count.
- **Stat strip**: 3–5 tiles with the biggest headline numbers of the release (e.g. "★100,000 · top Premier League wage").
- Keep text high-contrast. The project has a standing rule against faint grey text; the template's secondary text is already bright enough, so don't dim it further.
- Publish with the Artifact tool: `file_path` = `patch-notes/mikey/vX.Y.html`, `icon: "notes"`, `description` = the one-line headline. Remember the Artifact tool's page contract (no `<html>/<head>/<body>` tags; `<title>` first).

## Step 5 — Record and hand off

1. Append the new entry to `patch-notes/mikey/versions.json` (with the artifact URL and `toCommit` = current `HEAD`).
2. Tell Mikey: the link, the version number, and a 3–5 bullet summary. Remind him the artifact is private until he shares it with Harry and Leo from the page's Share menu.
3. Don't commit or push unless Mikey asks. If he does, the patch-notes files go in the same commit.

## The site shows the page itself (standing, 26 Sep 2026)

Harry: the admin archive must look EXACTLY like the artifact. After publishing a
version, copy the published page into `patch-notes/pages/<site version>/index.html`
with every image it references (keep the relative paths, e.g. `img/x.jpg`), and add
the version to `PATCH_NOTE_PAGES` in `lib/patchNotePages.ts`. Mikey's pages already
live in `patch-notes/mikey/`, so point at those instead of copying. The data entry
in `lib/patchNotesData.ts` stays too; it is the archive's Text tab.
