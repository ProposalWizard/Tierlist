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

## Two destinations, not one — and they don't compete

Given directly, after v0.3 shipped and the owner had actually gone and
looked at the site: *"make sure you keep patch notes about the same task
in the same patch notes artifact, like this and the last one and the one
before are all just goalie mode stuff, should be one patch notes artifact
getting updated, also make sure to put it on
https://knowitball.co.uk/admin/patch-notes."* Two separate instructions in
one sentence, easy to conflate, genuinely not the same thing:

1. **The claude.ai artifact stays ONE link, forever** — see below,
   unchanged from how this has always worked.
2. **The live site's own archive** (`lib/patchNotesData.ts`, rendered at
   `/admin/patch-notes` by `app/admin/patch-notes/PatchNotesArchive.tsx`)
   is a SEPARATE, pre-existing system — built by Harry's own session,
   discovered rather than invented here — that this contributor's rounds
   were simply never writing to yet. It works the opposite way from the
   claude.ai artifact on purpose: ONE ENTRY PER SHIPPED VERSION, appended
   to a growing array, never overwritten. Harry's own v0.1 entry documents
   this directly: "From v0.2 onwards every older version sits in this
   archive as its own entry, newest first." That is not a contradiction of
   "one artifact getting updated" — it is how the SITE'S OWN archive was
   already designed to work before this skill ever touched it, and the
   fix for "make sure you keep patch notes about the same task in the same
   [claude.ai] artifact" was about the external link never fragmenting
   into a second URL, not about the site's own archive never growing.

Both destinations carry the same real material every round — the site
archive is not a lesser copy, and the claude.ai artifact is not the
"real" one. Ship both, every time, from Process below.

### The claude.ai artifact: one link, forever

Per the house style: republish the SAME artifact in place every time, never
a fresh URL each round. That means this file has to carry the real URL
between sessions, or a future round guesses wrong and creates a second page.

**Current link:** https://claude.ai/artifact/YEuw3iut76VY2dZiQVarZd (v0.5,
updated 23 Sep 2026)

When you ship a new version: read the URL above, `Artifact.publish` with
that exact `url` so it updates in place, then edit this line with the
(unchanged) URL and the new version number so the next round stays current.

### The site archive: `lib/patchNotesData.ts`

This is real, shipped, PRODUCTION code — it goes in the same commit and PR
as everything else in the round, not a side channel. `BUILT_IN_PATCH_NOTES`
is a plain array of `PatchNote` objects (typed in `lib/patchNotes.ts`); the
page renders straight from it, no database, no migration, nothing to run
before it's live (see that file's own header for why — it was a Supabase
table once, and got asked directly "why is this needed" the first time it
showed a stale MIGRATION NOT RUN banner instead of the actual notes).

- **Prepend, don't overwrite.** Newest first, per the file's own comment —
  a new version is a NEW object at the front of the array, every older one
  (yours and Harry's/Mikey's alike) stays exactly as it was.
- **`title` is always `"Leo's patch notes"`** — the fixed per-contributor
  name this whole skill exists to track, same reasoning as the claude.ai
  page's own title convention. `version` uses the SAME number as the
  matching claude.ai artifact version, so a reader can find "the same
  round" in either place without the numbers drifting apart.
- **`version` is a real, if imperfect, shared namespace — and it already
  collided once.** Harry's own track uses this exact same array and field.
  At one point Harry's session RENUMBERED this whole archive: my three old
  entries (which had been "0.2"/"0.3"/"0.4" on THIS page — a different
  numbering from my own claude.ai artifact's v0.2/v0.3/v0.4, which were
  never touched) got merged into one entry and renumbered to "0.2" here,
  freeing "0.3"/"0.4" for Harry's own next rounds, with a note left
  directly for me inside that merged entry's own Known Issues saying my
  next number on this page should be "0.4". By the time I next shipped,
  Harry had already used 0.3, 0.3.5 AND 0.4 for his own rounds in between —
  so that note was stale, and blindly following it would have collided
  with Harry's own already-published 0.4 entry. **The fix, and the
  standing rule going forward: always determine the next number from
  what's ACTUALLY in the array right now (highest version string present,
  +0.1), never from a remembered or previously-left instruction, however
  directly it was addressed to you** — the array itself is the only source
  of truth, exactly as this file already says for the claude.ai side's
  `references/` folder. My next entry after this correction used "0.5",
  matching both the array's real next-free slot and my own claude.ai
  track's own natural next number — a happy coincidence this time, not
  guaranteed next time. Not worth building an automated collision guard
  for unprompted; just don't invent a prefixing scheme either.
- **Only the NEWEST entry IN YOUR OWN TRACK gets a real `artifactUrl`** —
  not literally whichever entry sits first in the array. Harry's own
  entries each publish their own fresh claude.ai page per round rather
  than republishing one link in place, so his entries keep a real,
  distinct `artifactUrl` every time, unaffected by anything on this side.
  The "null out the old one" rule below is specifically about YOUR OWN
  one-link artifact: the claude.ai link always shows whatever is CURRENTLY
  live there — pointing an older archived entry of yours at that same URL
  would send a reader to the wrong version's content. Older entries of
  yours get `artifactUrl: null` and instead
  get a short, real summary folded into the newest entry's own `history`
  section (see Process below) — the same "PREVIOUS VERSIONS condensing
  every old one" idea the claude.ai page already uses, mirrored here.
- **Sections are the same five kinds the claude.ai page uses** (`fixed`,
  `added`, `changed`, `known`, `next` — plus `history` on the newest entry
  only). Pull real material, not fluff — same discipline as the claude.ai
  build in Process below, because it's the same underlying facts either
  way.
- **Verify it, same as any other code change**: `npx tsc --noEmit` (the
  object literals are type-checked against `PatchNote` for real — a typo
  in a field name or an invalid `tone`/`kind` string is a real compile
  error, not something that only shows up on the page) and `npm run build`
  (confirms the route itself still renders/compiles) before shipping.

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
9. **Write the same round into `lib/patchNotesData.ts`** (see "The site
   archive" above): a new `PatchNote` object, prepended (newest first),
   `title: "Leo's patch notes"`, the same version number as the artifact
   just published, `artifactUrl` set to that link. Fold the OUTGOING
   newest entry's own detail down into a short real summary inside THIS
   entry's `history` section (mirroring what the claude.ai page's own
   PREVIOUS VERSIONS already condenses it to) — don't leave the previous
   entry's `artifactUrl` pointing at a link that no longer shows its
   content; set it to `null` once it's no longer the newest.
10. Verify the data change like any other code change: `npx tsc --noEmit`
    and `npm run build`. A malformed field here is a real compile error,
    not a silent gap on the page.
11. Hand the link over. Say plainly it's private by default, and that
    sharing it with Harry and Mikey is the Share menu on the page itself,
    by hand — that part can't be done on their behalf. Mention the site
    archive too (`/admin/patch-notes`) — that one's already public to
    anyone with admin access, no separate sharing step needed.

## Everything else

Same rules as any Knowitball artifact — see `artifact-house-style`. This
file only exists so each round doesn't have to re-decide the title, the
version number, or which URL to update.

## The site shows the page itself (standing, 26 Sep 2026)

Harry: the admin archive must look EXACTLY like the artifact. After publishing a
version, copy the published page into `patch-notes/pages/<site version>/index.html`
with every image it references (keep the relative paths, e.g. `img/x.jpg`), and add
the version to `PATCH_NOTE_PAGES` in `lib/patchNotePages.ts`. Mikey's pages already
live in `patch-notes/mikey/`, so point at those instead of copying. The data entry
in `lib/patchNotesData.ts` stays too; it is the archive's Text tab.
