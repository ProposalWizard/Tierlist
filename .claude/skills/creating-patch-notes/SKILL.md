---
name: creating-patch-notes
description: The standing workflow for turning a shipped round of work into "Knowitball Patch Notes — Leo vX.Y" — a running, versioned artifact shared with Harry and Mikey to track updates and bugs. Load whenever a round of changes ships and needs writing up for the team — "patch notes", "make the patch notes", "write up this round" — and by default after finishing and shipping any round of work, per the owner's standing instruction to use this every time going forward.
---

# Knowitball Patch Notes — Leo

The recurring release-notes track for this contributor's own work, for Harry
and Mikey specifically — the two teammates who don't write code (see
CLAUDE.md's "How to talk to this team"). This is how they find out what
changed and what's still broken, without opening a diff.

**The instruction this exists because of**, given directly right after
seeing the v0.1 patch notes page (built under `artifact-house-style`):
*"Use this link to build a skill called creating patch notes. The patch
notes will be titled knowitball patch notes Leo (Version number). Going
forward whenever I am making changes we will use this skill to build patch
notes to share with Harry and Mikey (my team) and track future
updates/bugs."*

"Leo" names this specific contributor's own track — distinct from anything
Harry or Mikey might run for their own work one day. It's fixed text, not
derived from whatever the git branch happens to be called in a given
session.

## Load `artifact-house-style` first, every time

That skill is the actual page recipe — five rules, the mechanics, what goes
in and what never does, and the full "patch notes carry their own history"
system (one link forever, `PREVIOUS VERSIONS` condensing every old one).
This skill does not repeat any of it. It only adds what's specific to
running this as an ongoing, named, versioned series:

- the exact title
- where "the next version number" comes from
- the one-link-forever URL, and where it's recorded so a future session
  doesn't have to guess
- when to actually run this

## Title, exactly

**`Knowitball Patch Notes — Leo vX.Y`** as the H1. Not "Knowitball vX.Y",
not "Patch Notes" alone. Keep the small version pill above it too (matches
the house style). Drop the redundant `branch <code>Leo</code>` line from
the subtitle since the name's already in the title — use that line for
what's actually useful instead (feature name, PRs, commit count, test
count).

## Versioning

One number, decimal, incrementing by 0.1 — `v0.1`, `v0.2`, `v0.3`... The
source of truth is this folder: `references/patch-notes-v{X.Y}.html`, one
file per shipped version, highest number present = current. To find the
next number, look at what's actually in this folder, not what's remembered.

`v0.1` here is a copy of the same file `artifact-house-style/references/`
keeps — the original page that started all of this, and the one the owner
called "10x better." It stays the design seed over there; it's also version
1 of this series over here, so the history mechanism has something real to
start from.

**No backfilling.** The gap between v0.1 and whenever this skill was built
does not get a patch note of its own — the point is a note per round *going
forward*, not an archaeology project. The next round shipped after this
skill exists is v0.2, whatever it happens to be about — it doesn't have to
be the same feature area as v0.1.

## One link, forever — and where it lives

Per the house style: republish the SAME artifact in place every time, never
a fresh URL each round. That means this file has to carry the real URL
between sessions, or a future round guesses wrong and creates a second page.

**Current link:** https://claude.ai/artifact/YEuw3iut76VY2dZiQVarZd (v0.3,
updated 21 Sep 2026)

When you ship a new version: read the URL above, `Artifact.publish` with
that exact `url` so it updates in place, then edit this line with the
(unchanged) URL and the new version number so the next round stays current.

## When to run this

**"Going forward, whenever I am making changes"** — after a round of work
ships (pushed, PR merged, a feature or fix landed), not mid-round. One
version per round, matching the granularity CLAUDE.md's own session log
already uses — if it was worth its own dated entry there, it's worth its
own patch note here. Skip it for something too small to have earned its own
entry either (a typo, a config tweak).

## Process

1. Load `artifact-house-style` (the SKILL.md and
   `references/patch-notes-v0.1.html`).
2. Pull the real material for the round from what's already known — the
   same facts as the CLAUDE.md entry for it. Don't re-derive numbers, reuse
   the ones already measured.
3. Work out the next version number from this folder.
4. Build the page: title as above, stat strip, FIXED / ADDED / CHANGED /
   KNOWN ISSUES / NEXT, PREVIOUS VERSIONS condensing every prior version —
   all per `artifact-house-style`'s rules, unchanged.
5. **Known issues carry forward.** Anything still genuinely open from the
   last version's KNOWN ISSUES belongs in THIS version's KNOWN ISSUES too,
   not just the history line — but only carry forward what can actually
   still be confirmed open (check CLAUDE.md's Pending Migrations / Pending
   Setup tables for anything DB- or infra-shaped). Don't mechanically
   replay a stale line that can't be verified any more — say what's changed
   since instead of guessing either way.
6. Publish with the Artifact tool — first version ever: no `url`, let it
   create one. Every version after: the `url` from "Current link" above.
7. Save the shipped HTML to `references/patch-notes-v{X.Y}.html`.
8. Edit "Current link" above with the URL and the new version number.
9. Hand the link over. Say plainly it's private by default, and that
   sharing it with Harry and Mikey is the Share menu on the page itself, by
   hand — that part can't be done on their behalf.

## Everything else

Same rules as any Knowitball artifact — see `artifact-house-style`. This
file only exists so each round doesn't have to re-decide the title, the
version number, or which URL to update.
