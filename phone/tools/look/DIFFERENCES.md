# What looks different: packed app vs KIB Next (19 Nov 2026)

Seen on the sheets from `compare.mjs` (390×844, same Arsenal career in both).
Per screen, most visible first. "Packed" = the reference (the website's screens).
Not counted as differences: random content (a free kick's distance, which chance
comes), and the harness limits in README.md (no 3D on KIB Next's web build; emoji
are the browser's).

**Round 1 (19 Nov 2026, later):** the look kit is built (`phone/src/ui/look`, read
its README): fonts, backgrounds, top bar, bottom bar, glass cards, buttons. Title,
new career (with the photo step) and Home use it; their sections below say what
still differs. Every other screen still has the differences listed.

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

## Trial (how to play, ready to aim)
- Pitch: packed has a textured diamond-pattern grass, a goal with a drawn net and
  posts, thick white lines, the pitch inside a rounded frame with a green glow;
  KIB Next has flat stripes, a pale rectangle for the goal (no net), thin lines,
  no frame, edge to edge.
- Packed has "✕ EXIT" top-left; KIB Next has none.
- Packed heading text is Anton caps ("16 M OUT · 2 IN THE WALL"); KIB Next plain
  ("16 m out · 2 in the wall").
- The how-to card: packed is a pale see-through green card with a little picture;
  KIB Next a near-white card, no picture.
- Players: both have sprites; packed's are bigger and sharper.

## Strike screen (where do you strike it?)
- The ball: packed is a real photo-like football with KNOWITBALL on it, inside a
  glowing ring with a red marker; KIB Next is a flat white circle with spokes and
  a dark centre, an orange arc for the timer.
- Power: packed has a gradient POWER bar (red→green) with "100%"; KIB Next a plain
  red bar, no label, no %.
- Title "STRIKE IT?": packed grey metallic Anton with a bar under; KIB Next white italic.
- Packed's screen sits inside the framed pitch; KIB Next fills the width.

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

## League table
- Closest screen. Same layout (Premier League card with YOURS + Change ▾, tabs,
  the table with coloured edges for places).
- Packed: HUD on top, "LEAGUE 🔔 ?" title, glassy rows over a blurred stadium,
  Arsenal row in red; tabs in caps. KIB Next: big "LEAGUE" title, flat rows,
  tabs in sentence case ("Table", "Results").

## Phone
- Packed draws an actual phone: rounded frame, a notch, status icons, a red
  wallpaper glow, HOME and BACK at its bottom, and the game's HUD + bar around it.
  KIB Next is the phone's contents full screen on black, with Android-like
  ‹ ○ ✕ buttons at the bottom.
- Packed app icons are glossy 3D squircles; KIB Next flat rounded squares.
- Missing in KIB Next: "Your house" icon.

## Shop
- Packed: Anton category tabs (Cans, Drip, Gadgets, Cars, Homes…) as text with an
  underline; each item a dark glass card with a big product photo; top: BACK pill,
  a 1/3/5 level picker, ★0 and 👑1; its own bottom shop bar (Shop, For You, a
  TikTok-style "3D" button, Boots, Sponsors) above the game's bar.
- KIB Next: emoji pills for categories, a drawn tin per can, more text per card
  (owned, energy, effect) and two buttons ("Not enough · ★12k", "Use one"),
  a Sponsors button top-right; no level picker, no 3D button, no bottom bars.

## Star Pass
- Packed: a big gold star with "1", "STAR PASS" in gold Cinzel, a vertical timeline
  with numbers 2/4/6 and 3D rewards standing on purple glowing podiums (a figure
  celebrating, tape, a ball), LOCKER and PTS buttons, your face at the bottom.
- KIB Next: a summary card (★1, 0 Star Points, 12,000 to ★2, five counters) and a
  plain list of rewards from ★100 down with emoji and padlocks.

## Transfer window
- Same content and order. Packed: black-and-yellow diagonal slash background,
  heavy italic "TRANSFER WINDOW", a "TRANSFERS" strip down the left edge, a
  scrolling yellow ticker ("21 CLUBS WANT YOU · SEASON GRADE D …") above full-width
  STAY / NEGOTIATE buttons. KIB Next: plain black, normal title, two rounded buttons.

## Before the match (Play pressed)
- Packed opens a line-up: both badges, formations (4-3-3 HOLDING / 4-2-3-1),
  managers, the date, both XIs as round head chips with flags on a pitch, SUBSTITUTES
  +9, "NO BOOTS" sign, PLAY AS ST, ⏩ and ⚙ buttons, and KICK OFF (it kicks off by itself).
- KIB Next shows a different screen: a card with both badges, a "SUBSTITUTE"
  card ("Form has dipped…"), energy, and two buttons "▶ Play" / "⏩ Sim this match".
  No line-up, no players, no formations.

## Match: the feed (on the bench)
- Packed: scoreboard as two coloured team bars (red Arsenal, sky-blue Man City)
  with white score boxes, a stats strip (SHIELD, GOALS, ASSISTS, PASS, RATING, 2D,
  ⚙, sound); every feed line is a solid red or blue bar by team; the minute in a
  dark box; a yellow "GET OUT THERE" bar in the panel; three 3D lightning badges
  for LOW / MEDIUM / HIGH.
- KIB Next: plain "Arsenal 2-0 Man City" header; feed lines as plain text on black
  (goals in yellow); "You are going on / Get out there →" floats over the middle
  of the feed; Low / Medium / High as pills, plus a "1x" speed pill.

## Match: the pitch (your chance)
- Packed keeps the team-colour scoreboard and stats strip on top and frames the
  pitch; diamond-pattern grass, STAMINA box bottom-left. (Packed was caught while
  its camera turns: the pitch looks slanted.)
- KIB Next: stripes, pale goal with no net, thinner lines, the commentary
  ("You drop in and demand the ball…") written on the pitch, no STAMINA box,
  no 2D / ⚙ / sound buttons.

## Post-match (match simmed)
- Same parts. Packed: glassy cards over the stadium/pitch picture, team names in
  coloured bars (red/blue) under the badges, scores in white boxes, star rating as
  a gradient bar 3→4, big Anton 7.0, a glowing green CONTINUE right under the card.
- KIB Next: flat cards on black, "Full time" title, adds lines packed does not
  show here (1 → 3 ⬆ with "+ Community Shield + Achievements ×3", BOSS/TEAM/FANS
  bars, "+28 energy back", the first achievement card under the result; packed shows
  achievements as a pop-up after).
