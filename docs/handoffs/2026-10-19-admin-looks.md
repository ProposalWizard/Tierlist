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
| 8 admin looks (Higgsfield pictures) | ✓ page: https://claude.ai/artifact/7LvXjQSW86NvYDnw1mJr3k — waiting on Harry's pick |
| Team room build page (stills) | https://claude.ai/artifact/RJL112bPGqt2EK85mKdPeG |
| Plan pages (round 1+2) | https://claude.ai/artifact/8ArnWgyMWCnuEnaoUdE8v2 |

## Decisions already made
- Chat look A (bubble) + full Chat tab; Team room parts are a top toggle AND side-menu lines (Harry, 19 Oct).
- Ideas: A+C (By stage | By person switch). To-do: own tab + inside the pop-up. Jobs can be given to others.
- Portable kit: yes — lib/teamRoom/ (config.ts = settings), components/teamRoom/, team_room.sql.
- Pictures in chat: built in (shrunk WebP in tierlist-images/team-chat/).
- Higgsfield: the account is NOT Harry's — delete what you make (Harry, 19 Oct).
- Check every UI on phone AND computer (Harry, 19 Oct).

## Open questions
1. Which admin looks (A–H, can be several, toggled)? Recommended: A Launchpad everyday + E Tactics board.
2. Push Team room to main now, or after the look pass? Recommended: now (it's independent); run team_room.sql first.

## Next steps
1. Get Harry's look picks (copy-paste from the looks page).
2. Build the picked looks as extra choices on the admin Look switch (lib/adminLook.ts, components/admin/shell/).
   Same layout idea for all: every group visible at once (see the pictures in docs/handoffs/2026-10-19-admin-looks/).
3. Then go screen by screen through every admin page (lib/adminRegistry.ts list), phone + computer stills each.
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
