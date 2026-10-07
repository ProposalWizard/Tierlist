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
| 2 | Symbols from the data: 43 flat drawings (lion, eagle, magpie, fox, hammers, cannon…) in `lib/star/badgeSymbols.ts`, picked by a word table on each club's nickname (then its name). **118 of 248** clubs get one; the rest keep the ball/star | DONE 7 Oct |
| 3 | `/admin/badges`: all 248 in a grid with the symbol and why, filter, search, New \| Old, ↻ Pattern and an emblem pick per club, PageGuide eye | DONE 7 Oct |
| 5 | Higgsfield: each draft as the reference for one consistent-style image | LATER |

Decided (Harry, 6 Oct): every club uses the drawn badge under New, even one
with a real crest in `club_logos`. Old keeps the real crest, else initials.

Decided (Harry, 7 Oct): "Not every single badge needs a symbol, and use the
data, not Mikey." No checking step. A symbol only when the data clearly names
one ("The Foxes" → fox, "Aslanlar (The Lions)" → lion, "Forest" → tree). The
first nickname that matches wins ("The Villans; The Lions" → lion). Hand fixes
go in `SYMBOL_OVERRIDES` (one so far: Sparta Praha's "Iron Sparta" is not
ironworks). All drawings are generic shapes, never a copy of a real crest.

Redos on /admin/badges are kept on that device only (no shared badge table;
the page says so) and show in that device's game too. "Copy changes" gives
them as text, to put into the code for everyone.

Known: the football emblem reads a bit like a wheel at small sizes (now only
on the 130 clubs without a symbol). Busy patterns (hoops) under a symbol are
readable at 56 px but tight at 24 px — the symbol has an outline in the
badge's main colour to hold it. Test: `tests/star/clubBadgeSymbols.mts`.
