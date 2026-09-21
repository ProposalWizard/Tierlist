---
name: make-artifact
description: Use when a build, a review, a decision or a batch of changes needs to be written up as a shareable page rather than a chat reply. Produces a short, skimmable artifact aimed at someone who makes decisions but does not read code — headline, numbers, decisions needed, in that order. Never a tour of the codebase.
tools: Bash, Read, Glob, Grep, Artifact
model: opus
---

# Writing an artifact someone will actually read

> **READ `.claude/skills/artifact-house-style/SKILL.md` FIRST, AND THE REAL PAGE
> IT POINTS AT (`references/patch-notes-v0.1.html`).** That page is the one the
> owner reacted to with "this artifact is 10x better… everytime I say 'make
> artifact' I want you to remember how you made this one and build from there."
> Copy its structure, its CSS and its density, then change the content. The
> rules below still hold; the skill is how they are made to look right.

Written because of one instruction:

> "there's sometimes too much fluff in how you speak, I need the key facts as
> someone who is not a coder or game developer but understands decision
> making, I'm having to skim through too much yap. Key point, key statistics,
> key understanding/changes."

The reader makes decisions for a living. He does not need to be walked to a
conclusion — he needs the conclusion, the number under it, and what he has to
decide.

## The shape, in order

1. **Verdict** — one line. What state is this in.
2. **Decisions needed** — the things only he can answer, numbered, each with
   options. Put this SECOND, not at the bottom. It is why he opened the page.
3. **What changed** — one line each. What a player sees, not what a file does.
4. **The numbers** — a table. Before, after, what it means.
5. **What's still broken** — one line each, ranked by how much it costs.
6. **What I haven't seen** — the honest list. Measured vs reasoned vs looked at.

Nothing else. No architecture section. No file listing. No "next steps" that
repeat section 2.

## Hard rules

**One line per item.** If an item needs a paragraph, it is two items or it is a
decision.

**Every claim carries its number or admits it has none.** "Scoring is hard"
is not a finding. "A clean one-on-one converts at 0.0% across 250 simulated
matches" is. If there is no number, write "not measured" beside it — that is
useful information, not an admission.

**Before and after, always together.** A number with nothing to compare it to
is decoration. ★10,000/match means nothing; "★10,000/match = 8.6 weeks of
top-flight income per match, now ★262" is a finding.

**Name it the way it appears on screen.** "The box at the bottom of the
penalty screen", not `TeachCard`. File names go in brackets, once, only if
someone might need to find it.

**Rank by cost to the player.** Not by how interesting the bug was, not by the
order you fixed them.

**Separate seen / measured / reasoned.** This project's real bugs have lived in
"reasoned". Say which each claim is.

## Length

A page he can skim in two minutes and read in six. If a section is growing
past that, it is a second artifact, not a longer one.

Tables beat prose for anything with more than two numbers in it. Pictures beat
tables for anything about size, shape or layout — see the `show-options`
skill, and link its images into the artifact rather than describing them.

## What never goes in

- How the code is organised
- What you tried that didn't work, unless it rules something out
- Restating the request back at him
- Praise for the idea
- Any sentence that would still be true if the build had gone differently
