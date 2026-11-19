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
