# Builder brief: move one admin page onto the Broadcast look

For builder agents (Harry, 19 Oct 2026, overnight). One page per builder.

## The job
Rebuild ONE Road to Ballon d'Or admin/test page in the picked layout, on the shared frame.
- Frame: `components/admin/broadcast/BroadcastPage.tsx` (`BroadcastPage`, `Panel`, `PanelGrid`, `Btn`, `Pill`, `Label`, `Note`).
  Read it and `broadcast.css` first.
- The finished example to copy: `app/star-retirement-dev/page.tsx` + `retirement.css`
  (Harry: "in general retirement screens looked the best"). Page-only CSS goes in a `<page>.css` next to page.tsx,
  using the `--bc-*` tokens.
- The picked picture: `docs/handoffs/2026-10-19-ui-lookover/higgs/<name>.jpg` (left = computer 1440×900,
  right = phone 390×844). Copy its LAYOUT and feel, not its made-up text or numbers.
- Real stills of each page now: `docs/handoffs/2026-10-19-ui-lookover/rbd-admin/` (if there).

## Hard rules
1. **Every function stays** (Harry: "every page needs to keep the key functionalities"). Every button, dial,
   toggle, save, commit, link and data-* attribute that exists before still exists and works after. List them
   before you start, tick them off at the end.
2. Change only the page's own shell/layout/styling. Never change game code (`lib/star/**`, `components/star/**`,
   the match engine) or what a button does. If a page renders a game screen (canvas, 3D, a real career screen)
   full-screen, leave that screen alone and restyle only the menu, panels and controls around it.
3. "Toggle" picks (e.g. options 1 and 2 as a toggle) = a `Pill` pair at the top that switches between two layouts
   of the same functions. Remember the choice in localStorage (try/catch).
4. Fits a computer (1440×900) and a phone (390×844); no sideways scroll; text ≥ 12px on a phone.
5. No Higgsfield or any image generation. A picture must show the exact thing it is labelled with (a fixed still of one
   match on a card that changes is wrong). Pictures on cards come from real screenshots you take, as small
   webp files in `public/admin/<page-key>/`.
6. Keep `PageGuide` (the ⓘ). Update that page's entry in `lib/adminGuides.ts` if a button's name or place changed.
7. Delete the page's url from `NOT_YET` in `scripts/admin-look-guard.mjs`.
8. Writing on screen: short, plain English, no coder words.

## Checks before you commit
- `npx tsc --noEmit -p .` clean; `node scripts/admin-look-guard.mjs` passes.
- Dev server on YOUR port (given in your prompt): `setsid npx next dev -p <port> > /tmp/dev-<port>.log 2>&1 &`.
  Playwright Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (add
  `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` for 3D).
- Before stills (from the committed version) and after stills at 1440×900 and 390×844, full page, to
  `docs/handoffs/2026-10-19-ui-lookover/built-pages/<page-key>-{before,after}-{pc,phone}.jpg` (JPEG q80, crop
  to ≤ 1700 px tall). Look at them yourself. No page errors in the console.
- Click at least three of the page's main buttons in the browser and confirm each still does its job.
- Commit in your worktree with a plain message. Do not push, do not merge. Never commit `.env.local`.

## Report back (short)
Page, pick, the function checklist (all ✓, or what isn't and why), what you saw, still paths, commit hash,
tokens used if you know them.
