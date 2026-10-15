---
name: handoff
description: Hand a piece of work to a fresh chat — your own next chat, or Mikey/Leo's. Load when someone says "handoff", "hand this over", "new chat", "start a fresh chat", "context is too big", or at the END OF EVERY BUILD (Harry, 15 Oct 2026: "context bloat is huge now — we need to use a new chat after every build"). Writes one handoff file in the repo and gives a short paste-in starter for the new chat.
---

# Handoff — end every build with one, start the next chat from it

Harry, 15 Oct 2026: *"we definitely need to set up a handoff skill, not only to hand off to
ourselves but to others. Context bloat is huge now — we need to use a chat after every build."*

**Rule: one build per chat.** When a build is done (pushed, or stopped for a decision), write a
handoff and tell the person to open a new chat with the starter below. Don't carry on in a chat
whose context is already long.

## 1. Write the file

`docs/handoffs/YYYY-MM-DD-<short-topic>.md` (date = today). Plain English, the house writing
rules (short sentences, no coder words in the headings). Sections, in this order:

1. **For** — who picks it up: "Harry's next chat", "Mikey", "Leo".
2. **The goal in one line** — what the person actually asked for, with their own words quoted.
3. **Where it stands** — a ✓/✗ table: what is LIVE (on main and Vercel said success), what is
   on the branch only, what is half done, what was not started. Say seen / measured / reasoned.
4. **Decisions already made** — each with the person's quote and date, so nobody re-asks.
5. **Open questions** — each with the recommended answer and one-line reason.
6. **Next steps** — numbered, each small enough for one go, in order.
7. **Where things are** — branch + last commit hash, the key files (repo paths), artifact links,
   test pages (/star-*-dev), plan files. Copy any scratchpad plan or still that matters INTO the
   repo (`docs/handoffs/<same-name>/`) — scratchpads die with the container.
8. **Watch out for** — traps found this build (clashing numbers, failing tests that aren't ours,
   pending migrations, secrets needed, things the other devs are touching).
9. **Still running** — any agent or job not finished, and what to do if its result is lost.

Keep it under ~150 lines. Link, don't paste, long material.

## 2. Commit and push it

Commit to the session's own branch (Harry / Mikey / Leo) and push, so the next chat — or another
person — can read it. Never put secrets in it.

## 3. Give the starter

End the reply with a short block the person pastes as the first message of the new chat:

```
Read docs/handoffs/<file>.md and pick up from "Next steps". Branch: <branch>.
<One line: what to do first.>
```

For another person, add one line saying who it's from and what you need back from them.

## 4. Starting from a handoff

A chat that opens with a handoff: read the file first, `git fetch` and merge the branch it
names, check "Still running" items, confirm the first next step in one line, then go. Don't
re-plan what the file already decided.
