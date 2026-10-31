---
name: creating-patch-notes
description: The standing workflow for turning a shipped round of work into "Knowitball Patch Notes — Leo vX.Y" — a running, versioned artifact shared with Harry and Mikey to track updates and bugs. Load whenever a round of changes ships and needs writing up for the team — "patch notes", "make the patch notes", "write up this round" — and by default after finishing and shipping any round of work, per the owner's standing instruction to use this every time going forward.
---

> **Every patch note, everyone's (RUL-TEAM-028, Leo 26 Oct 2026).** In
> `lib/patchNotesData.ts`: `"author"` (Harry/Mikey/Leo); `"publishedAt"` = the
> real time it was made; title `"<Name>'s patch notes: <what it is about, 3-8
> words>"` (the menu shows that part); `"updates": [{ "at", "where", "note" }]`
> — every update appends one AND sets `updatedAt` + `updateNote` to the same
> time and line. **Number:** take the next number nobody has used on ANY branch
> (main, Harry, Mikey, Leo); `0.121` and `0.121h` may not both exist; never
> reuse 0.60-0.63, 0.103, 0.107-0.110. **Page:** every note has one, built from
> `artifact-house-style` (tuning-plan-standard.html + clip-card.html, "Check
> these" first, numbers in one closed toggle). `npx tsx tests/star/patchNoteRules.mts`
> checks all of it, and `ship.mjs` refuses a note that breaks a rule.


Standing rules: search the Brain first (grep brain/_index*.md), cite codes.

# Knowitball Patch Notes — Leo

The recurring release-notes track for this contributor's own work, for Harry
and Mikey specifically — the two teammates who don't write code (RUL-ALL-002;
writing style RUL-ALL-003, RUL-ALL-004). This is how they find out what
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


> **Patch-note rules live in the Brain** (cite the code): RUL-TEAM-018 (made
> automatically as each build finishes, live on the site at once, inbox for
> unread), PRO-TEAM-007 (`node scripts/patch-notes/ship.mjs <versions> --pr`
> ships the notes alone), PRO-TEAM-008 (order: stills, ship notes, publish,
> push the feature when Harry says, then film clips), RUL-TEAM-019 and
> RUL-TEAM-020 (feature code reaches main only when Harry says push),
> RUL-TEAM-005 (no test build link; mostly stills; a short clip only for
> gameplay or animation), RUL-TEAM-010 (no "needs Mikey's yes"), RUL-TEAM-006
> (version keys unique). The old before/after-video and filming-phase rules
> are superseded (FACT-ALL-002).

> **Standing rule (Harry, 24 Sep 2026):** readable by someone who wasn't in
> the conversation. The biggest or most confusing change is the headline;
> every item is Problem -> Why -> Fix; confusing ones get a before/after
> picture; answers to questions go low. See `artifact-house-style` -> Every
> item is Problem -> Why -> Fix. (No Brain note yet.)

> **Standing rule (Harry, 24 Sep 2026):** every patch notes page opens with a
> "Check these" list: one plain line per changed feature or fix, with where
> to find it, no explanations. See `artifact-house-style` -> What always goes
> in. The site entry (`lib/patchNotesData.ts`) gets it too, as its first
> section's items. (No Brain note yet.)

## Load `artifact-house-style` first, every time

That skill is the actual page recipe — five rules, the mechanics, what goes
in and what never does, and the full "patch notes carry their own history"
system (`PREVIOUS VERSIONS` condensing every old one; a new link per version).
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

### The claude.ai artifact: a new link per version

Harry, 28 Sep 2026: *"when I say new patch notes why is it going on the same
link - isn't that updating v0.16? Make a NEW one with new changes."* So every
new version number is published as a FRESH artifact (no `url`), with the
older versions condensed into its `PREVIOUS VERSIONS` section as before. The
old version's link is left alone as its own frozen record. Republish in place
(same `url`) only to correct the version you are currently on.

Record each new link here so the next round can find the latest one:

- v0.16: https://claude.ai/artifact/A9gwVhtt8dAVBwddYgrh7A
- v0.17: https://claude.ai/artifact/45LCtddFQZAvSQsc2JWk6S
- v0.18: https://claude.ai/artifact/HvagWBceebfaR9KmxRKhgh
- v0.19: (next, new link)
- Leo site 0.129 (feed, voice, studio, smooth goals): https://claude.ai/artifact/Fdzu2CSuNewdamVJckvuby
- Leo v0.6 (site 0.28): https://claude.ai/artifact/PQCcbHkmPEQ3NrzA88nVZS
- Leo v0.7 (site 0.31): https://claude.ai/artifact/MmprHgEH6epYpooT4Cze7r
- Leo v0.8 (site 0.32): https://claude.ai/artifact/PhH1T34JAzEoWReV6NxWH6
- Leo v0.9 (site 0.33): https://claude.ai/artifact/39iLwb8KpLGQmK9R7nbLgr
- Leo v0.11 (site 0.36): https://claude.ai/artifact/2Uodrmk5Uj9Fm6ZBpUijAY
- Leo v0.12 (site 0.38): https://claude.ai/artifact/EGUKS4qyVUU6KoA1qkJAKn
- Leo v0.13 (site 0.39): https://claude.ai/artifact/M9DmuMCkXzeMW9EJ6mJFtZ
- Leo v0.14 (site 0.44): https://claude.ai/artifact/9wg6tn2XxSyT8mUBRhrbgy
- Leo v0.15 (site 0.45): https://claude.ai/artifact/3x6BjhftYfYtYCYJRkKDbg
- Leo v0.16 (site 0.53): https://claude.ai/artifact/SqbYRDsV64zyZbAoe43i99
- Leo v0.10 (site 0.35): https://claude.ai/artifact/Uq2eXdooybw4HrxqC6999X
- Site 0.22 (UI & Home): https://claude.ai/artifact/AHUmDmsxzNfG1UhEkn3N7n
- Site 0.23: https://claude.ai/artifact/HBE3svQRyVBbVcUMWjMW1g
- Site 0.23.1: https://claude.ai/artifact/8wzaQV41ZmrhtBXZV46Rav
- Site 0.24: https://claude.ai/artifact/CQ5gkXrcPk2gptL1EjX3au
- Site 0.25: https://claude.ai/artifact/7LXrEgwm72sUVZH5Kcmeyz
- (These five pages are kept in the admin archive with every video swapped for its still and a "Watch the clip on the artifact page" link: never commit .mp4 files. Site 0.22 also exists as a files-less duplicate at https://claude.ai/artifact/1nqUW1kkiuUsPmFXERm678; use the first link.)

### The site archive: `lib/patchNotesData.ts`

This is real, shipped, PRODUCTION code. Since 21 Oct 2026 the notes go live
on their own first: `node scripts/patch-notes/ship.mjs <versions> --pr`
(PRO-TEAM-007, RUL-TEAM-018); the feature code waits for Harry's push
(RUL-TEAM-019). **After a ship PR merges, merge main back into Harry at once,
before the next Harry → main PR.** Otherwise both branches carry the same
version line, git keeps both, and the duplicate key (TS1117) fails every live
build while previews and local builds pass (21 Oct 2026: four live builds
failed this way). `BUILT_IN_PATCH_NOTES`
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
- **`version` is a shared namespace** with Harry's and Mikey's entries
  (RUL-TEAM-006: search the data file for the number on BOTH branches before
  using it; Harry's colliding numbers got an `h` suffix). Always work the
  next number out from what is ACTUALLY in the array right now (highest
  version string present, +0.1), never from a remembered or left-behind
  instruction.
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
version per round, matching the granularity `SESSION_LOG.md`
already uses — if it was worth its own dated entry there, it's worth its
own patch note here. Skip it for something too small to have earned its own
entry either (a typo, a config tweak).

## Process

1. Load `artifact-house-style` (the SKILL.md and
   `references/patch-notes-v0.1.html`).
2. Pull the real material for the round from what's already known — the
   same facts as the `SESSION_LOG.md` entry for it. Don't re-derive numbers, reuse
   the ones already measured.
3. Work out the next version number from this folder.
4. Build the page: title as above, stat strip, FIXED / ADDED / CHANGED /
   KNOWN ISSUES / NEXT, PREVIOUS VERSIONS condensing every prior version —
   all per `artifact-house-style`'s rules, unchanged.
5. **Known issues carry forward.** Anything still genuinely open from the
   last version's KNOWN ISSUES belongs in THIS version's KNOWN ISSUES too,
   not just the history line — but only carry forward what can actually
   still be confirmed open (check the Brain's migration notes FACT-DAT-001 to FACT-DAT-004 and
   CLAUDE.md's Pending Setup table for anything DB- or infra-shaped). Don't mechanically
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
11. **Ship the notes alone, at once** (PRO-TEAM-007, RUL-TEAM-018):
    `node scripts/patch-notes/ship.mjs <versions> --pr`. Do not hold them
    for the feature push (RUL-TEAM-020) or for a video (PRO-TEAM-008).
12. Hand the link over. Say plainly it's private by default, and that
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
