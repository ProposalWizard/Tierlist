# v0.23.1: plan from the v0.23 review with Mikey (1 Oct 2026, 58 min)

Source: `points.md` (P#). This is a fix-up of v0.23, so it is numbered **v0.23.1**. The gameplay look and 3D work stay **v0.24**.

## Out of scope for now
Harry: "for now don't touch anything to do with Star Pass [or] non-league/National League organising".
- **Star Pass:** P43, P44, P47, P85, P87, P88, P89, P94. This includes the play-style unlocks at level 30 and tap-to-pass as an unlock.
- **Non-league:** P19, P30 (league part), P71, P74, P76, P80. This includes the scouting odds, relegation, wages and club lists. "Mikey will sort this out."
- **Later projects:**
  - The gameplay look like NSS (P84, P17) and the 3D head from a photo (P57): v0.24.
  - Different home screens as unlocks (P66).
  - The manager-relationship system rethink (P41, beyond the numbers below).

## Already done in v0.23 (no work)
- New UI is the default and Old UI is the toggle (P83).
- Scout is on the League page (P63), and there is a "?" on League (P62).
- The low-energy prompt is at 65 (P77).
- The phone is ★150, locked until bought, with repair (P39, P40).
- The Shop opens after the first game (P38).
- Each trial drill is one attempt, and your player shows only on penalties and free kicks (P93).
- The star rating can drop (P73).

## Builds, in three parallel parts plus sounds

**U1, look and navigation** (`components/star/ui/*`, `DashboardShell`, `SwipePages`, `SettingsScreen`, match-opening chrome):
1. Star rating and energy each become one smooth, glowing, liquid-looking bar. No segment ticks, rounded rather than boxy, and they animate on change (P8, P15, P96). The money and age stay in the top bar (P6).
2. Each screen shows the bars that matter there (P13): Relations swaps star rating for happiness, and Style swaps it for reputation. Energy is always shown.
3. The bottom arrows stay at the bottom but are more discreet: smaller, lower opacity, not bold (P9, P81).
4. **Font** (P14, P58, P78): the heavy font goes back to headings and big numbers only. Body, lists, the league, fixtures and tables return to the normal font.
5. **A way home** (P26, P60): the bottom-left Achievements slot becomes **Home**. Achievements are reached from Home ("it could just be on the homepage").
6. A "?" on every main page that lacks one (P62).
7. **Settings tidy** (P61): small on/off toggles for things like full screen. Live scores now live on the League page.
8. **Line-up animation:** tap to skip, and a setting to skip it altogether (P30, P75). KICK OFF must never fall off screen (P18).
9. **Match opening:** no grass behind the pitch card (P69).
10. **Bolt colours:** yellow → orange → red, see "Claude's view" below (P31).

**U2, flow and screens** (PostMatch, achievements, RelationshipMinigame, setPieceTalk, TrainingLevelSelect, SigningScene, TitleScreen):
1. **After the match** (P35): no numbers in the star part. It says just "Star rating" and shows the bar.
2. **Achievements and records** pop up automatically when earned, including in-match records broken (P36).
3. **Boss meeting** (P41): a win gives +3, a loss −2.
4. **Two set-piece chats** (P86): penalty taker and free-kick taker are separate chats at their own moments.
5. **Training level list** (P68): smaller numbers and bigger stars, with the stars the main part of each square, in the page's style.
6. **Signing:**
   - A contract paper on the desk that shows the full terms (P56).
   - Manager faces become varied fake faces, loosely matched to the real manager (skin tone, hair), never a real photo (P72, P90).
7. **Title screen** (P64, P65):
   - The net becomes much smaller and the logo much bigger.
   - The menu buttons stay on the right.
   - Floodlights shine down.
   - A "Tutorial" button is added.

**U3, Blender shop** (`tools/blender-shop`, `public/shop`, StylePicture/BootPicture, Store):
1. The starter house becomes smaller (P52).
2. The boots on the shelf are scaled down (P55).
3. Redo the weak pictures: the suit, the silver/gold chains and necklaces, and proper horses (P91, call 33/34).
4. "Redo the whole store with all the new Blender stuff" (P91): the Store's items (boots, accessories, coins packs) get rendered pictures in the same studio.

**U4, sounds** (a cloud session with the ElevenLabs key):
1. Remake coin-in so it sounds like money, not a single coin. Make star-tick and achievement-pop bigger (P97).
2. Wire the non-match sounds into the New UI with a mute setting: taps, confirm, coins, level-up, achievement, breaking news, phone, can. Match sounds wait for Mikey.

## Claude's view on the bolt colours (P31, asked directly)
Recommend **yellow → orange → red**, the way NSS does it (they mention it at 16:30). One voice reads green as "best" and red as "worst", and the other reads red as "most intense". A heat scale avoids that clash: no green means no "good/bad" signal, and red still means "hardest, most energy". It is a one-line change if they prefer otherwise.

## Rules for this batch
- Build first, stills only. Film once at the end on the combined copy, and keep the patch notes simple.
- **One branch on GitHub:** builders work in local copies and push nothing. The combined result goes straight onto Harry. (GitHub refuses branch deletion from here, so don't create remote branches.)
- Never touch `lib/star/canvasEngine.ts`, the one-engine guard, or `components/star/legacy/**` (Old UI).
