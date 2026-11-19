# What looks different: packed app vs KIB Next (19 Nov 2026)

Seen on the sheets from `compare.mjs` (390×844, same Arsenal career in both).
Per screen, most visible first. "Packed" = the reference (the website's screens).
Not counted as differences: random content (a free kick's distance, which chance
comes), and the harness limits in README.md (no 3D on KIB Next's web build; emoji
are the browser's).

**Round 2 (19 Nov 2026, the match):** the trial, the strike screen, the match pitch,
the feed, the goal pop-up and the drills' boards are in the packed app's look; see
their sections. Frame cost: `npx tsx tools/match-frame.ts` and `tools/look/ground-bench.ts`.

**Round 1 (19 Nov 2026, later):** the look kit is built (`phone/src/ui/look`, read
its README): fonts, backgrounds, top bar, bottom bar, glass cards, buttons. Title,
new career (with the photo step) and Home use it; their sections below say what
still differs. Every other screen still has the differences listed.

**Round 2 (19 Nov 2026, world screens):** League, Phone and its apps, Shop, Star
Pass, Transfers, Sponsors, Store, Owner, Investments, cup draw and negotiation use
the kit; their sections below say what still differs.

## Across every screen (fix these once, every screen moves closer)

1. **Backgrounds.** Packed screens sit on pictures: a stadium at sunset (title,
   Home), a blurred stadium/pitch photo behind Stats, League, Phone, Post-match,
   a green gradient (new career), a dark purple stage (Star Pass), black-and-yellow
   slashes (Transfers), a green pitch texture (match). KIB Next is one flat
   near-black (#0b100e) everywhere.
2. **Fonts.** Packed headings use **Anton** (tall condensed, all caps: "LOOK CHECK",
   "Who are you?", "TRANSFER WINDOW", big numbers like 58, 7.0, the 0/1 score),
   **Cinzel** (serif gold "STAR PASS"), and a heavy italic for TRANSFER WINDOW and
   "STRIKE IT?". KIB Next uses one plain sans (Roboto) in bold for everything.
3. **The top bar (HUD).** Packed has a glossy blue top bar on Home, Stats, League,
   Phone: name in Anton, AGE 18 pill, ★0 pill, ? and ⚙ buttons, then a big star
   badge with the level and a yellow lightning bolt with a 3D green energy bar.
   KIB Next: name, ★0, ⚙, and two thin flat bars (ENERGY 100 / STAR RATING 1).
   Stats, League and Phone in KIB Next have no HUD at all.
4. **The bottom bar.** Packed: 5 slots with 3D icons (League, Training with a
   badge "2", Home in a raised box, Phone with a red badge "3") and a round
   glowing green PLAY button that sticks up out of the bar. KIB Next: 2 tabs
   (League, Home) and a flat pill "▶ PLAY". No Training or Phone in the bar; on
   Stats, Phone, Shop, Star Pass KIB Next has no bottom bar (a ‹ back instead).
5. **Cards and buttons.** Packed cards are glassy (see-through, coloured border
   glow, gradients, shadows), buttons are 3D (gradient, shine, chunky). KIB Next
   cards are flat dark-green rounded boxes with a thin border, buttons flat.
6. **Pictures.** Packed shows real pictures where KIB Next shows emoji or simple
   drawings: KIB cans (photos vs a drawn tin), the shop items, Star Pass rewards
   (3D renders on podiums vs emoji in a list), the 3D player on Home/title/Stats.

## Title (main menu) — round 1: close
- Same now: the stadium at sunset, KNOWITBALL in grey Anton with the tagline and
  "EVERY LEGEND STARTS WITH A TRIAL", you on the left with the ball, slanted tabs
  on the right (NEW GAME green, LOAD GAME, HALL OF FAME gold, TUTORIAL), CREDITS.
- Still different: the logo's letters are taller and narrower (Anton; the website's
  are a wider heavy italic with a metallic sheen); no SETTINGS with no save (KIB
  Next has no settings to open without a career; with a save it shows); the
  player is the drawn figure in the web build (3D on the phone).

## New career: your details / your style — round 1: close
- Same now: green page, "‹ Main menu" bar, ROAD TO THE GOLDEN BALL tag, Anton
  title, "Step 1 of 2 · your details/style", one green card, white centred boxes,
  green England bar with ✓ and CHANGE, square skin/hair tiles, LEFT/RIGHT tiles,
  the number in a white box, "← Back" (navy) and "Continue →" (green).
- Still different: a few px of spacing; the nationality list opens inside the card
  as on the website (flags are emoji in KIB Next, pictures on the website).

## New career: your photo — round 1: added, close
- Same now: "Step 2 of 2", YOUR PHOTO / Optional, the shirt tile with your number,
  the note, "✓ Using your shirt", OR PICK A FACE with the seven faces, "✓ Start Career".
- Still different: "Add a photo" and "Take a photo" are greyed with a note (the
  phone app has no photo picker installed yet; expo-image-picker would add it).

## Trial (how to play, ready to aim) — round 2: close
- Same now: the dark-green page, "✕ EXIT" with the stage pips and "1/5", the dark
  board (YOU and the attempt rings, FREE KICKS, the score in Anton, "16 M OUT · 2 IN
  THE WALL" in caps), the pitch in its rounded green frame down to the two caption
  lines, the website's grass (big diamonds, worn goalmouth, thin crisp lines), the
  goal with posts, bar and net (lib/star/matchGoal.ts itself), the drawn match ball
  (lib/star/matchBall.ts), the pale see-through how-to card with its little drag picture.
- Still different: KIB Next's camera is tipped back 20° (the driver's own camera, not
  changed here), so the far end is narrower; a free kick's distance and so the
  framing are random in both.

## Strike screen (where do you strike it?) — round 2: close
- Same now: the blue sky and green strip, the club's own ball photo (KNOWITBALL) at the
  website's size resting on the grass with its shadows, the countdown ring round it,
  the bar under the title, POWER with the red-yellow-green bar and "100%", "WHERE DO
  YOU / STRIKE IT?" in heavy italic, all inside the framed pitch.
- Still different: the title is one flat light grey (the website's is a metallic
  gradient clipped to the letters); the spark where you hit it is a drawn bolt (the
  website's is the ⚡ emoji).

## Home — round 1: close
- Same now: one fixed screen. The glass top bar (name, AGE, ★, ?, ⚙; the star badge
  on a gold bar, the lightning on the energy bar), the stadium scene behind
  everything, the faint next-match panel, REP/FAME/GOALS/ASSISTS glass tiles with
  their pictures, "🏆 PREMIER LEAGUE 1st ▾" (opens five rows and FULL TABLE ›),
  you in the middle with the ball, the boots line, the three cans with their
  photos and USE/FULL and ★price, ‹ STATS / SHOP › (a swipe does the same), and
  the bottom bar League · Training (⚡2) · Home · Phone (3) · round glowing PLAY.
- Still different: the player is the drawn figure in the web build (3D on the
  phone; the drawn one has a red glow); the top bar is a solid blue band (the
  website's is frosted); small spacing.
- Moved off Home, as on the website: Training and Phone are in the bottom bar,
  the Star Pass opens from the star, Sponsors and Relations from the Phone, the
  main menu from Settings.

## Stats
- Packed: a FIFA-style bronze player card (58 ST, flag, badge, your figure,
  6 skills in Anton) with four big menu buttons beside it (STATS yellow, RECORDS,
  ACHIEVEMENTS, CONTRACT navy); stadium background, HUD and bottom bar.
- KIB Next: a plain card with a small figure and name, the four menu items as a
  small tab row; no player card, no skill numbers on this screen.
- Packed season table shows G / A / AVG columns and an empty cabinet of 4 glass
  slots and a GOALS & ASSISTS chart; KIB Next shows "Nothing on the shelf yet",
  no chart.

## League table — round 2: close
- Same now: the top bar, LEAGUE in Anton with ?, the Premier League chooser lit in
  your club's colour with the gold YOURS, TABLE · RESULTS · GOALS · ASSISTS · HISTORY
  as glass caps tabs, see-through rows over the blurred stadium with the coloured
  place edges, your row in red, the bottom bar.
- Still different: no 🔔 (the website's live-score bell has nothing to do here);
  rows a little taller, so 17 rows show instead of 18.

## Phone — round 2: close
- Same now: a drawn phone (graphite bezel lit in your club's colour, side buttons,
  the dynamic island, status bar with the date, signal, wifi, battery), the club
  wallpaper, the next-match widget, glossy two-colour squircle icons with their
  shine and red badges, "Your house" (as the website shows it; taps say the 3D
  house is coming), the dock, ⌂ HOME / BACK ‹, the top bar and bottom bar around it.
- Apps: Social (Matchday header, ALL/ENGLAND/CLUB pills, the empty feed's ghost
  rows and mailbox, FEED/TRANSFERS), Squad (one glass table, OVR chips by level),
  Fixtures (the next game glowing blue), Messages (gradient avatars and bubbles): close.
- Still different: the Social bar's icons are text glyphs (the website's are SVG
  line icons); Squad shows no headshots (no photos on the phone yet).

## Shop — round 2: close
- Same now: the dark room, ◂ BACK, the 1 | 3 | 5 picker (all three work), ★money
  and 👑fame, the Anton category words with the bar under the chosen one, item
  cards with the website's own product stills (cans, boots, cars, homes…), "NOT
  ENOUGH ★12k", the chosen card lit in the category colour; 3 on screen: the item
  big with its neighbours peeking, ×0 OWNED, CANS · 1/3, ⌃ next category, Use one
  and the red Buy pill; the shop's own bar (Shop · For You · 3D · Boots · Sponsors)
  over the game's bar. For You works (every item, one a screen).
- Still different: the shop bar's icons are emoji (website: line icons); 3D is
  greyed (no 3D shop in this app); the item sheet is one layout for every item
  (the website gives cans their own three-box sheet); no "⋯ More" menu.

## Star Pass — round 2: close
- Same now: the gold star badge with your level, STAR PASS in gold Cinzel, your
  title, LOCKER and PTS (PTS opens the points table), the gold rule; the road with
  the website's own backgrounds per 20 levels, the rail filling gold, diamond marks
  with the level numbers, the reward renders standing on their purple podiums
  (2, 4, 6…), your face on the rail, CLAIM / SOON / ✓, the bottom bar.
- Still different: the road's background crop differs a little (a bright band at
  the left edge); the two moving run-up rewards are their first frame (nothing
  moves at rest); Locker says it is coming; tapping a reward shows the still, not
  the website's 3D spin; the title is solid gold, not the website's gradient.

## Transfer window — round 2: close
- Same now: the night lit in your club's colour, floodlights, the diagonal gold
  slab with its slashes, the TRANSFERS tab down the left edge, the kicker pill,
  TRANSFER WINDOW in heavy italic gold with a black outline, the season letter,
  LEAGUE / CLUB tiles in Anton, the ticker, full-width STAY / NEGOTIATE.
- Still different: the ticker does not scroll and the slab does not shine (nothing
  moves at rest); no dot texture at the top.

## Before the match (Play pressed)
- Packed opens a line-up: both badges, formations (4-3-3 HOLDING / 4-2-3-1),
  managers, the date, both XIs as round head chips with flags on a pitch, SUBSTITUTES
  +9, "NO BOOTS" sign, PLAY AS ST, ⏩ and ⚙ buttons, and KICK OFF (it kicks off by itself).
- KIB Next shows a different screen: a card with both badges, a "SUBSTITUTE"
  card ("Form has dipped…"), energy, and two buttons "▶ Play" / "⏩ Sim this match".
  No line-up, no players, no formations.

## Match: the feed (on the bench) — round 2: close
- Same now: the green mown page, the scoreboard as two kit-coloured bars with the
  score in white boxes (Anton), the plate (SHIELD, GOALS, ASSISTS, PASS, RATING, 2D,
  ⚙, the speaker), every line a glossy bar in its team's kit with the minute in a
  black chip, assists indented, the minute and speed plate top-right, the three
  playstyle pictures, the amber "YOU ARE GOING ON" bar with the yellow GET OUT THERE,
  the energy bar, and the three lightning badges LOW / MEDIUM / HIGH
  (EnergyModeIcon.tsx redrawn once in Skia).
- Still different: "2D" is a label and ⚙ opens nothing (KIB Next has no in-match
  settings and draws only the 2D players); the website's goal-line flash is left out
  (nothing moves at rest); KIB Next shows the KICK OFF row the website hides.

## Match: the pitch (your chance) — round 2: close
- Same now: the scoreboard and plate on top, the framed pitch with the website's
  grass, lines, goal and net and ball, the STAMINA box bottom-left, the "Tap to skip"
  pill, the goal as Mikey's scoreboard pop-up (GOAL tag, kit blocks, score, scorer and
  assist) and every other word as a TV caption.
- Gone, as on the website: the commentary written on the pitch over your chance (the
  website shows it only in its sandbox).
- Still different: KIB Next's camera is tipped back 20° and holds still (the packed
  shot caught the website's camera mid-turn); the pop-ups' roll and shine are left
  out (nothing moves at rest); random content (which chance comes) differs.

## Post-match (match simmed)
- Same parts. Packed: glassy cards over the stadium/pitch picture, team names in
  coloured bars (red/blue) under the badges, scores in white boxes, star rating as
  a gradient bar 3→4, big Anton 7.0, a glowing green CONTINUE right under the card.
- KIB Next: flat cards on black, "Full time" title, adds lines packed does not
  show here (1 → 3 ⬆ with "+ Community Shield + Achievements ×3", BOSS/TEAM/FANS
  bars, "+28 energy back", the first achievement card under the result; packed shows
  achievements as a pop-up after).

## Sponsors — round 2: close
- Same now: the stadium, glass BACK, the YOUR DEALS / SPONSORS plaque, the fame
  chip, the SPONSOR MONEY card (★ in Anton, deal slots, next-slot bar), DEALS ·
  OFFERS · BRANDS tabs, the glass "No deals yet" card, the bottom bar.

## Owner, Investments — round 2: close
- Same: plaque header, glass cards, the green BROWSE CLUBS button; Investments'
  MARKET · PORTFOLIO · BOARDROOM tabs and the club list.
- Still different: Investments shows BALANCE inside the plaque (the website puts
  it in its own wide box); KIB Next shows club badges in the list (the website
  does not); the green button's words are not in caps.

## Store — round 2: partly
- Same: stadium, glass cards, gold/green buttons, the tabs as pills.
- Still different: no top bar; KIB Next is a list of cards with no pictures (the
  website shows a TODAY'S PICK card with the run-up/item render and a 2-wide grid
  of item cards with rarity and % off tags). Needs the store's pictures copied.

## Cup draw, negotiation
- Restyled (stadium, glass card lit blue, Anton round name, the pot's shiny balls)
  but not on the sheets: the packed app is hard to walk to a draw.
