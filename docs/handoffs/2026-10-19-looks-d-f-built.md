# Handoff — admin looks D and F built; next, the inside of every game area (19 Oct 2026)

## For
Harry's next chat. Branch `Harry`.

## The goal in one line
Looks D + F are done. The next big job is "the actual UI of every game, like how the play
area looks good — the inside of every area needs work" (Harry, 19 Oct). Not the admin pages.

## Where it stands
| Item | State |
|---|---|
| Look D Broadcast + F Bento on the admin Look switch | ✓ on `Harry`, NOT on main. Seen at 1440×900 and 390×844, 0 page errors |
| All 12 groups on one computer screen (Broadcast: page 934 px tall at 900 px window) | ✓ seen |
| Broadcast is the default for anyone who never picked a look | ✓ (`lib/adminLook.ts`) |
| Team board + chat bubble in both looks | ✓ seen on the board (colours follow the look) |
| Team room + side-menu fold (earlier build) | ✓ on `Harry`, NOT on main |
| `supabase/migrations/team_room.sql` | ✗ PENDING: run before Team room works live |

Stills: `docs/handoffs/2026-10-19-admin-looks/built/` (broadcast-/bento- pc, phone, team-pc).

## Decisions already made
- Push: wait until D and F are done, then push everything together (Harry, 19 Oct: "Wait for D and F").
  D and F are now done → ask Harry: push now, or patch notes first?
- "Full admin passover" is NOT a restyle of every admin page. Harry: "it's not every screen
  in D and F (that is just for the admin page). I meant the actual UI of every game".
- Old handoff's step 2 (every admin page in D/F) is dropped. Step 3 (Team room extras) still queued.

## Open questions
1. Push Team room + looks D/F to main now? Recommended: yes, with patch notes; run team_room.sql first.
2. Which game area first for the inside-UI pass? Recommended: ask Harry with a short list of areas
   (career Home, match screens, training, shop, phone/media, Draft, tierlists) and one still each.

## Next steps (one build per chat)
1. Ask Harry Q1; if yes: patch notes (stills above), merge `Harry` → main, check Vercel.
2. Inside-UI pass, one game area per build: screenshot it at 390×844 now, Higgsfield mock-ups,
   Harry picks, build. Load `ui-house-style` first. Start with the area Harry names.
3. Team room extras (from the old handoff in `done/`): @mentions, chat search + threads,
   phone alerts, "Waiting on me" inbox — Higgsfield mock-ups first.

## Where things are
- Looks: `lib/adminLook.ts` (ADMIN_LOOKS, isBoardLook), `components/admin/shell/` (tokens per look),
  `app/admin/star/AdminHome.tsx` (`Board`, `Row`), `app/admin/star/adminHome.css` (`.ahb-*`),
  `components/teamRoom/teamRoom.css` (bubble colours per look), guide text in `lib/adminGuides.ts`.
- Pictures Harry picked: `docs/handoffs/2026-10-19-admin-looks/sheet-D.jpg`, `sheet-F.jpg`.

## Watch out for
- Dev stills need a `.env.local` with the Supabase URL + any anon key; delete it before committing.
- Without GITHUB_TOKEN the team board shows six "GitHub refused the site's key" bars (sandbox only).
- Phone: the chat bubble and the eye sit over the group cards (older, not from this build).
- Playwright: executablePath /opt/pw-browsers/chromium-1194/chrome-linux/chrome.

## Still running
Nothing.
