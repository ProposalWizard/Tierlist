# Club badges — plan and where it stands (Harry, 6 Oct 2026)

Ask: "making new badges in game for all teams using their suggested colour in
mikeys data hub. because the current ones with letters suck. For now we won't
use higgs but can use it once we have a draft of every one."

Data: all 248 clubs have badge colours (badge1-3) and a badge shape
(badgeStyle: Shield 126, Round 72, Crest 37, Monogram 5, Oval 3, one each of
Hexagon/Cross/Pentagon/Star/Heart) in lib/star/data/clubProfileData.ts.

| Step | What | State |
|------|------|-------|
| 1 | Badge maker: shape + colours + pattern + emblem, no letters (`lib/star/clubBadge.ts`) | DONE 6 Oct |
| 4 | In the game: `ClubBadge.tsx` draws it in place of the letters; Settings → Look → "Club badges: New \| Old" (`lib/star/badgeLook.ts`) | DONE 6 Oct |
| 2 | "Badge symbol" column in the data hub (lion, tree, ship…), guessed for all 248 from real crests, marked amber for Mikey; ~30 shared symbol drawings replace the ball/star emblem | NOT STARTED (the big one) |
| 3 | /admin/badges: all 248 in a grid, ✓/✗ and redo per club, PageGuide eye | NOT STARTED |
| 5 | Higgsfield: each draft as the reference for one consistent-style image | LATER |

Open question for Harry: a club with a real crest in `club_logos` still
shows that crest first (unchanged). Should every club use the drawn badge
instead, so they all match? Recommended: yes.

Known: the football emblem reads a bit like a wheel at small sizes; step 2's
symbols replace it.
