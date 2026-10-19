# Handoff — Team room built; pick an admin look, then restyle every admin page (19 Oct 2026)

## For
Harry's next chat. Branch `Harry`.

## The goal in one line
Team room done; next, a new admin look because "even the groups on the side, it's a bit hard
to see everything" — 8 options to pick from, then "the UI of every single admin screen" (Harry, 19 Oct).

## Where it stands
| Item | State |
|---|---|
| Team room: chat bubble on admin/test pages, Board/Ideas/Chat/To-do toggle, notes on ideas + pushes, "which one are you?" | ✓ on `Harry` (4565d0f + merge), NOT on main. Seen with sample rows at 1440×900 and 390×844 |
| `supabase/migrations/team_room.sql` | ✗ PENDING: must run before it works live. Until then the tabs say so |
| Side menu folds (« button), dark scrollbar block gone | ✓ on `Harry`, seen |
| 8 admin looks (Higgsfield pictures) | ✓ picked: **D Broadcast + F Bento** (Harry, 19 Oct). Page: https://claude.ai/artifact/7LvXjQSW86NvYDnw1mJr3k |
| Team room build page (stills) | https://claude.ai/artifact/RJL112bPGqt2EK85mKdPeG |
| Plan pages (round 1+2) | https://claude.ai/artifact/8ArnWgyMWCnuEnaoUdE8v2 |

## Decisions already made
- Chat look A (bubble) + full Chat tab; Team room parts are a top toggle AND side-menu lines (Harry, 19 Oct).
- Ideas: A+C (By stage | By person switch). To-do: own tab + inside the pop-up. Jobs can be given to others.
- Portable kit: yes — lib/teamRoom/ (config.ts = settings), components/teamRoom/, team_room.sql.
- Pictures in chat: built in (shrunk WebP in tierlist-images/team-chat/).
- Higgsfield: the account is NOT Harry's — delete what you make (Harry, 19 Oct).
- Check every UI on phone AND computer (Harry, 19 Oct).

- Admin looks: D (Broadcast) and F (Bento), both on the Look switch (Harry, 19 Oct: "D and F are my picks").
- Yes to: phone alerts for chat, chat search + threads, a "Waiting on me" inbox (Harry, 19 Oct: "1/2 and waiting on you is cool").
- New ask: "@ certain elements of the game/admin pages or aspects of patch notes" in chat (Harry, 19 Oct).

## Open questions
1. Push Team room to main now, or after the look pass? Recommended: now (it's independent); run team_room.sql first.
2. What can be @'d? Recommended: @page (any admin/test page, from lib/adminRegistry.ts), @patch (a patch-notes
   version, from lib/patchNotesData.ts), @push (a commit), @idea, @person. Each turns into a tap-able chip. Show looks first.

## Next steps (one build per chat — do 1, hand off, then the rest)
1. Build looks D and F on the admin Look switch (lib/adminLook.ts, components/admin/shell/), every group visible
   at once. Pictures: docs/handoffs/2026-10-19-admin-looks/sheet-D.jpg, sheet-F.jpg. Stills phone + computer.
2. Screen-by-screen pass of every admin page in D and F (lib/adminRegistry.ts list), stills each.
3. Team room extras, Higgsfield mock-ups first: @mentions (chips), chat search + threads, phone alerts
   (web push; needs a service worker + keys), "Waiting on me" inbox (jobs, notes, pending SQL, handoff questions).
4. Patch notes, then push to main only when Harry says.

## Where things are
- Team room: lib/teamRoom/{config,logic,store,demo}.ts, components/teamRoom/*, app/admin/team/TeamBoard.tsx,
  components/GlobalNav.tsx (mounts ChatBubble), tests/star/teamRoom.mts, page guide in lib/adminGuides.ts.
- Look pictures (contact sheets per look): docs/handoffs/2026-10-19-admin-looks/sheet-A..H.jpg.
- Dev build with no database shows sample rows (lib/teamRoom/demo.ts); `?teamroom=new` shows the name picker.

## Watch out for
- Higgsfield: 27 pictures (19 Oct) still in that account's History; projects deleted, single pictures
  can't be deleted by tool — someone with the login removes them by hand.
- Playwright here: launch with executablePath /opt/pw-browsers/chromium-1194/chrome-linux/chrome.
- Never commit .env.local (the dummy one used for stills was removed).
- On the scenario gallery the chat bubble can sit on a card title (whole left edge is cards).

## Still running
Nothing.
