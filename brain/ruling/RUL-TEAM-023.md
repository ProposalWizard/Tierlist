---
id: RUL-TEAM-023
type: ruling
client: team
tags: [admin, process, team]
status: live
date: 2026-10-24
source: "Leo, 24 Oct 2026, in chat"
summary: Everything goes on the admin page, always: every patch note and every update to one is shipped to the site and checked live; an update is marked (updatedAt + updateNote) so it shows UPDATED, moves to the front and is unread again.
---
Leo, 24 Oct 2026: *"i never want patch notes kept to me and you on this chat!
EVERYTHING ON THE ADMIN PAGE ALWAYS! with progress updates and patch note
updates. also if u update an old patch notes then make sure its clear."*

- Every new patch note, and every change to one, goes to main with
  `node scripts/patch-notes/ship.mjs <v>` (`--update` for a change) the same
  turn it is made (PRO-TEAM-007). Progress bars go to the board
  (`scripts/post-status.mjs`) as the work moves.
- An update sets `updatedAt` (now) and a one-line `updateNote` saying what
  changed. The archive then tags it UPDATED, puts it first, and counts it
  unread again for everyone (read receipts are per update); the phone buzz
  says "Updated patch notes". `ship.mjs --update` refuses an update without them.
- "Live" is said only after checking it: Vercel's status for the merge
  commit, then the live site's own code carrying that commit (search the
  /star-dev chunks for the SHA). If it can't be checked, say so.
