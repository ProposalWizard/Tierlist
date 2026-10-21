# Patch notes go live as soon as they are built (Harry, 21 Oct 2026)

Harry, word for word: "from now on also as soon as patch notes are built put them onto the site, we should also have notifications in an inbox for everyone on patch notes they haven't read yet (not backlogged starting from yesterday's) - automatically make patch notes as you go".

## The rule
Patch notes are made automatically as each build finishes and go onto the site straight away; the inbox notifies everyone of unread ones.
No one has to ask for patch notes: every build that finishes gets its notes (creating-patch-notes skill: Problem, Why, Fix, stills, numbers) in the same session.

## How the notes reach the site without the feature
Ship patch notes alone: node scripts/patch-notes/ship.mjs <versions> --pr makes a patch-notes-only PR to main; feature code waits for Harry's push.
ship.mjs starts a branch from origin/main in a throwaway worktree and copies ONLY the named versions' entries in lib/patchNotesData.ts, their lines in lib/patchNotePages.ts and their folders under patch-notes/pages/.
It refuses if any other file changed, if either data file imports anything but the PatchNote type (an import would drag unreleased code onto main), or if a version key is used twice.
Checked 21 Oct 2026: both data files import only `type { PatchNote } from "./patchNotes"`, and main's copies match Harry's, so a patch-notes-only branch type-checks on main (ship.mjs --tsc).
Merging that PR deploys main; the first admin page opened after it makes the site buzz everyone but the author once (lib/teamRoom/inbox.ts), and the notes sit in each person's Inbox bell until read.

## What this changes
Deploy only when told: merge feature code to main only when Harry says push; patch-notes-only PRs made by ship.mjs go to main at once.
Every deploy's patch notes are already live, shipped on their own first; Harry still decides each time when the feature itself is pushed.
Patch notes order: stills on the page, ship the notes to main with ship.mjs, publish the artifact; push the feature when Harry says push; then film the gameplay clips; never hold the notes for a video.
