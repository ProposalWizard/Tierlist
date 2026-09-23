---
name: admin-page-guide
description: Every admin and dev page on Knowitball carries the same little "eye" button (PageGuide) that explains, in plain English, every button on the screen, where saving goes, whether anything commits to the repo, and where it shows up in the game. Load WHENEVER an admin or dev page is created or edited — anything under app/admin/**, app/star-*-dev/**, app/star-dev/media-lab, app/lineups, app/draft-dev*, app/draft-challenge-dev, app/draft/preview, app/profile-new, app/ballon-dor — or any component or API route those pages use changes a button label, a save path or a commit path. Also load when someone asks "what does this button do", "where does this save", or to add a page to the admin menu.
---

# The admin page guide (the eye)

Asked for directly by Harry: *"there should be an information panel on every
single page in the admin sections: just a little eye on how to use whatever's
currently on the page, so that they can understand what we're doing. That goes
for Mikey stuff and for Leo stuff. It should just be an auto skill that has the
same UI across everything and just summarises how to use every button on the
screen, how it works in terms of the website, saving stuff, committing to the
repo, where stuff goes."*

Neither Harry nor Mikey writes code. The eye is how they find out what a tool
does without asking. A guide that is out of date is worse than none — it tells
them something false with confidence.

## The two pieces

| What | Where |
|------|-------|
| The eye + panel (same look everywhere — never restyle it per page) | `components/admin/PageGuide.tsx` |
| The words, one entry per route | `lib/adminGuides.ts` (`ADMIN_GUIDES`) |

Every page renders it once:

```tsx
import PageGuide from "@/components/admin/PageGuide";
…
<PageGuide page="/star-gallery-dev" />
```

`page` is the route and is type-checked against `ADMIN_GUIDES`, so a `page`
value with no entry will not compile. It portals to `<body>`, so it works on immersive
pages that hide the site nav. Put it inside the page's main return (for a
client page gated behind an admin check, the "allowed" branch). For a page with
several early returns, wrap it: rename the body function and export a wrapper
that renders `<Body /><PageGuide … />` (see `app/admin/cl-draft/page.tsx`).

`corner` moves the eye when bottom-right would cover one of the page's own
controls (`app/lineups/page.tsx` uses `bottom-left` because its save status sits
bottom-right). Check at 390px wide before choosing.

## The rules

1. **Every admin/dev page renders `PageGuide`.** A new page gets its entry in
   `lib/adminGuides.ts` and the component in the same change. If it is also an
   admin destination, add it to `components/AdminNavPanel.tsx`'s list.
2. **Change a button, a save path or a commit path → change the guide in the
   same commit.** Renamed label, new button, removed button, a new table, a
   save that used to be local and is now shared, a new commit route — all of
   these update the entry. When reviewing a diff to such a page, check its
   guide entry too.
3. **Read before you write.** Every claim comes from the code: open the page,
   its components and the API routes it calls. Never guess what Save does.

## How to write an entry

The panel always shows, in this order: **What this page is → Buttons → Saving →
Committing to the repo → Where this shows up in the game → Needs setting up →
For developers.** Fill the fields; don't invent new sections.

- **`what`** — one line. What the page is FOR, not how it's built.
- **`buttons`** — every visible control, `[label, what it does]`. The label is
  **exactly** what is on screen, symbols included (`✓`, `⋯`, `▶ Sim`, `+ Opp`).
  Group by screen or panel (`group: "The ⋯ menu"`) when a page has several.
  Gestures count as controls ("Drag", "Swipe the grass").
- **`saving`** — say where it goes, one of: *this browser only* / *shared with
  everyone (Supabase table X)* / *committed into the code*. Say when it saves
  (instantly, only on Save, only after a deploy).
- **`commit`** — leave it out when nothing commits; the panel then says
  "Nothing on this page commits to the repo." When something does: which file
  it writes, that it goes straight onto `main`, that Vercel redeploys main in a
  minute or two, and that it needs `GITHUB_TOKEN` in Vercel and an admin
  sign-in. Reuse `COMMIT_HOW`.
- **`inGame`** — where a player would ever see the result. "Nowhere — a
  sandbox" is a real answer.
- **`needs`** — any migration or env var the page depends on that may not be
  done. Check CLAUDE.md's Pending Migrations table. Say what the page does
  without it.
- **`dev`** — the one place file paths and API routes are allowed.

Plain English. No code words ("localStorage", "upsert", "component") outside
`dev`. Short sentences. Name things the way they appear on screen. If a label
is surprising or a behaviour is a trap (e.g. "Revert to built-in does NOT take
a committed copy out of the code"), say it plainly — that is what the guide is
for.

## Before you hand back

- `npx tsc --noEmit -p .` — a missing or misspelt `page` key fails here.
- Open the page at 390px wide, tap the eye, and check the eye isn't covering a
  control and the panel reads cleanly top to bottom.
