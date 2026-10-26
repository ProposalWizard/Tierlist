---
id: RUL-TEAM-028
type: ruling
client: team
tags: [team, process]
status: live
date: 2026-10-26
source: "docs/brain-sources/leo-patch-notes-rules-2026-10-26.md:3"
summary: "Every patch note: author, real date and time, every update with time and where, its own number (no base shared with anyone's, search all branches), a menu name saying what it is about, and the one standard page; checked by rules.mjs."
---
Applies to Harry's, Mikey's and Leo's notes alike. In lib/patchNotesData.ts a
note has "author", "publishedAt" (the real time, never a midnight guess), a
title "<Name>'s patch notes: <what it is about>", and "updates" (each { at,
where, note }); an update also sets updatedAt + updateNote and appends the
same line to "updates". A number is used once: "0.121" and "0.121h" may not
both exist; retired numbers (0.60-0.63, 0.103, 0.107-0.110) are never reused.
Every note has a page built from the standard (artifact-house-style:
tuning-plan-standard.html, clip-card.html, a "Check these" list). The checks
live in scripts/patch-notes/rules.mjs: tests/star/patchNoteRules.mts runs them
on every note and ship.mjs refuses a note that breaks one. Supersedes
RUL-TEAM-006.
