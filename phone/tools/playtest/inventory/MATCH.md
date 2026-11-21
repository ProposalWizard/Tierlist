# Inventory, part 1: THE MATCH (packed app vs KIB Next), 21 Nov 2026

Every screen, overlay, caption, button and drawn piece of the match area, packed app
(the reference: `mobile/www`, built from `app/star-dev/page.tsx` + `components/star/**`)
against KIB Next (`phone/`). Built on `claude/eloquent-bohr-6veqfh` at `aec937eb`.

**How I know** (each row says which):
- **seen**: on a still, both apps at the same size, same career (the look-check save, Arsenal, PL, Community Shield first).
- **code**: read in the source, not on a still (rare kinds of chance, first-career coaching, haptics, sound).
- Sizes: **412×915** (Mikey's Galaxy S20+, bars hidden) and **360×780**. dpr 1, touch on.
- KIB stills come from its **web build** (react-native-web, Chromium). Android draws text, shadows and
  insets differently, so each row also carries an **ANDROID RISK** note where one applies.

**Defaults that decide the packed look** (so the comparison is against what a player really gets):
- `lib/star/uiLook.ts`: UI = **New** (the pitch look). Old UI never shown.
- `lib/star/leoUpdate.ts`: Leo's update **OFF** by default. So in the packed app: no goal celebration run
  (`celebrations`), no weather line or rain (`weather`), no slow-mo big moments (`bigMoments`), and
  `bugFixes` off, which means the line-up's ⏩ and ⚙ **float on the right edge** (not in the header) and
  no manager names are passed from the career (the line-up still shows them from `lineupStore`).
- `lib/star/matchRadarLook.ts`: radar **Old** (no mini-pitch radar in the feed).
- Brain FACT-UI-007/008: match camera Old, chance framing **Zoom**, match view New.
- FACT-UI-015: photo faces OFF, drawn heads everywhere. FACT-UI-017: Mikey's pop-ups are the only pop-ups.

Stills: `/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/inventory/match/` (below: `S/`).
Pairs are named `pair-*.png` (packed left). The look check's own sheets at both sizes are in
`S/look412/` and `S/look360/` (`compare.mjs` now takes `--w/--h`).

## Status after round 4 (21 Nov 2026): the leftovers

How I know: **seen** = on stills of both apps side by side at 412×915 (360×780 where said), the same save, driven by the live bench;
**reasoned** = read in the packed code, built, type-checked, not on a still. Sheet: `scratchpad/fix3/leftovers.jpg`.

| # | row (section) | status | how |
|---|---|---|---|
| 1 | "Team news" card when dropped to the bench (1) | FIXED: the manager's words on the plain card, once a fixture (packed shows its 3D office above the same words; the plain card is its own fallback) | seen beside packed, same words |
| 1 | Low-energy gate (1) | FIXED: blurred ground, number inside the bar, card in the upper part | seen 412 and 360 beside packed |
| 1 | Tap anywhere to kick off (1) | FIXED | reasoned |
| 1 | Date icon (1) | FIXED: drawn calendar | reasoned |
| 1 | First match tour (1) | FIXED: energy, play style, speed, on the same three targets; the match waits while it is up, as packed's does | seen step by step beside packed |
| 2 | Standing ovation banner (2) | FIXED: gold strip above the scoreboard, pops in | reasoned |
| 3 | Goal line flash in the feed (3) | FIXED | seen (caught mid-flash) |
| 3 | Half time: can picture, no extra energy line (3) | FIXED | seen beside packed |
| 3 | **Scoreboard ran ahead of the commentary** (new) | FIXED: the board shows the goals the feed has read out (packed's displayScore). Seen before the fix: 2-1 on KIB's board over "HALF TIME 1 - 1"; packed's board matched its line | seen (the bug); the fix reasoned + parity checks |
| 6 | HOW TO PLAY card icon (6) | FIXED: tap / strike / run / flick drawings as packed's TeachGlyph | reasoned |
| 7 | Pop-up fades when the feed opens (7) | open (LOW): 0.16 s, under the feed on KIB | not built |
| 7 | Packed's own GOAL board on a still | NOT CAPTURED: the bot took 16 chances over two packed matches and scored none; packed has no test hook in the packed build (`__starMatch` is compiled out). KIB's board stays as checked against MikeyPopup's code in round 3 | not seen |
| 8 | Shootout winner line pops (8) | FIXED | reasoned |
| 4 | ⚡ Power shot tap on the green circle | CONFIRMED on KIB's web build: armed, wind-up, a touch on the circle gave GOOD, then ⚡ X1.43 | seen |
| 4 | First-chance coach card | square corners as packed | seen (before), reasoned (after) |
| 11 | Vision "Heads up · Who's free?" (11) | SAME: already in MatchVision.tsx (count, then HEADS UP / Who's free?); its how-to card now draws the tap | reasoned |
| 13 | Kickabout rows (13) | open: the score pill's place and the replays button are the Phone shell's (world file); the six-chance summary is still the small card, not the post-match screen | not built |
| - | Half time, full time in a real first match | SAME layout | seen beside packed |
| - | Substitutions, captain orders, corners, an in-match dribble, red cards, injuries | NOT COMPARED on stills: none came up in the two matches played side by side (no way to force them in the packed build) | not seen |
| - | `JUMP you 1.6 m` after a lay-off back | SAME as packed by its code: `resetForTouchOn` puts you on the ball at the catch, and the catch radius is 1.6 m (`STICK_CATCH_R`); CanvasMatch has no easing there | reasoned (no frames) |
| - | `tools/match-parity.ts` website side (lay-off back / Touch Mode re-touch) | CORRECT: it now mirrors CanvasMatch `loadScenario` (touch continuation → `resetForTouchOn`, no new chance, the deal kept, no re-cast); before, the tool's website side was wrong, not the website | read against CanvasMatch 9776-9853 |

## Status after round 3 (21 Nov 2026): every row, FIXED or open

How I know: **seen** = on a still of KIB Next's web build at 412×915 (and 360×780 where said), time stepped by
hand for motion (`live.mjs` `open {clock:true}`, `clock pause`, `steps`); **reasoned** = read in the code, not on a still.
Sheet: `scratchpad/fix2/match3.jpg`. The tables below are the round-0 inventory, kept as written.

| # | row (section) | status | how |
|---|---|---|---|
| 1 | Low-energy bar number beside the bar (1) | open (LOW) | not touched |
| 1 | "Team news" card when dropped to the bench (1) | open (MED) | not built |
| 1 | Tap anywhere to kick off (1) | open (LOW) | pitch only |
| 1 | Competition chip one line at 360 (1) | FIXED (round 2) | seen 360 |
| 1 | ⏩ and ⚙ place (1) | kept in the header corner (round 2: packed's float cannot be pressed at 360) | seen |
| 1 | ⚙ opens a small sheet (1) | FIXED (round 2) | seen in the match; line-up reasoned |
| 1 | VS slam (1) | FIXED (round 2) | seen |
| 1 | Date icon is an emoji (1) | open (LOW) | |
| 1 | Pitch width (1) | FIXED: full width at 412, 309 of 360 (packed 308) | seen 412; 360 measured before the fix (292), the fix reasoned |
| 1 | Men walk out one by one (1) | SAME: the packed app's `kit-rise` no longer moves anything (ui/motion.tsx, 14 Oct) | seen: packed shows all men at 0.3 s |
| 1 | Faces before kick-off (1) | every circle has its drawn head by ~0.5 s; three away heads are blank on the very first frame in the web build | seen 412 and 360 |
| 1 | Play as picker (1) | FIXED (round 2) | seen |
| 1 | Substitutes tab (1) | FIXED: tab on top, both benches under it, flags | seen 412 |
| 1 | Bench reason line (1) | kept (extra, LOW) | |
| 1 | KICK OFF motion (1) | pulse (round 2); the opening tap can no longer kick off | seen |
| 1 | First match tour (1) | open (MED) | not built |
| 2 | 2D / 3D switch (2) | button REMOVED. Packed's "2D" opens the 3D match view (Match3DLayer); it hides the button when the phone cannot draw that view. KIB Next has no 3D match view: **not built** (lib/star/style3d/engineView.ts, 2,200 lines of three.js; not in the 3D list chosen for the phone) | seen (button gone) |
| 2 | ⚙ in the match (2) | FIXED (round 2) | seen: sheet over a held match, Back to the match |
| 2 | Standing ovation banner (2) | open (LOW) | |
| 3 | Kick-off card (3) | FIXED (round 2) | seen from kick-off at 412 and 360, beside packed |
| 3 | Goal line flash in the feed (3) | open (LOW) | |
| 3 | Speed 1/2/4/8 kept (3) | FIXED (round 2) | reasoned |
| 3 | Scores button, score card, scores panel (3) | FIXED | button and panel seen (league match, a goal coming in at 10', bell on); the score card over the feed reasoned |
| 3 | Tap the feed to skip (3) | FIXED (round 2) | reasoned |
| 3 | Half time: can picture; extra "Energy NN%" (3) | open (LOW) | |
| 4 | Set-piece camera (4) | SAME now: trial free kick goal 147 px (KIB, 24 m) against 134 px (packed, 26 m) at 412 | seen |
| 4 | STAMINA "Auto run" word (4) | FIXED | reasoned |
| 4 | Added-time chip (4) | FIXED (round 2) | seen |
| 4 | TOUCH toggle and the second touch (4) | FIXED: toggle, chase, TOUCH ON, one re-touch in the same picture | toggle seen on and off; the chase reasoned (same lib calls as CanvasMatch) |
| 4 | ⚡ Power shot, WINDING UP…, green circle (4, 6) | FIXED (shown only with "Knuckleball & power shot" New, Old by default, as packed) | seen: armed, wind-up with the defence closing, circle, MISSED, ⚡ x1.00. A tap on the circle did not register in the web build; changed to finger-down, not seen again |
| 4 | Call for it (4) | FIXED | reasoned (button not caught on a still) |
| 4 | Captain line (4) | FIXED (round 2) | seen |
| 4 | Run-up line (4) | FIXED (round 2) | reasoned |
| 4 | First-header coach; first volley / steer / sprint (4) | FIXED | reasoned |
| 4 | Live hint "Drag back = aim · Quick flick" (4) | SAME: only with Live chances on, off by default | reasoned |
| 5 | Dribble words (5) | FIXED (round 2) | seen: TAP TO START pill, how-to line, moves strip |
| 6 | Strike title steel (6) | FIXED: colours measured off the packed screen | seen on HEAD IT? |
| 6 | HOW TO PLAY card icon (6) | open (LOW) | |
| 6 | HEAD IT? before a header (6) | SAME: opens 1.0 to 1.2 s after the cross (0.8 s + the jump), the tap strikes | seen stepped; tap seen |
| 7 | GOAL board motion (7) | FIXED (round 2); shadow now on the board | seen frame by frame (50 ms): slide, tag, shine, strip, roll, gold flash, close |
| 7 | Captions (7) | FIXED: place (round 2) and now the packed cut: slanted tab, drawn mark, slanted end, wipe | seen (SAVED at the foot with the ball at the top; ⚡ X1.00 in the new cut) |
| 7 | Pop-up fades when the feed opens (7) | open (LOW) | |
| 8 | Shootout winner line pops (8) | open (LOW) | |
| 10 | Post-match motion (10) | FIXED: beats, slam, count-ups, burst, shake, star bar rise / empty / refill, bars slide, pay reveal + float + shine, CONTINUE pulse + shine, double tap = skip | seen stepped after a sim; the played-match pay card reasoned |
| 10 | Achievements as toasts, CONTINUE never shut (10) | FIXED (round 2) | seen |
| 10 | Boss/Team/Fans and energy line after a sim (10) | kept (extra, LOW) | |
| 11 | Trial pitch height (11) | FIXED: to 846 of 915 (packed ~855), hint on screen; the banner's room kept only on its stage | seen 412 and 360 |
| 11 | Vision "Heads up · Who's free?" card (11) | open (MED) | |
| 12 | Drill ✕ EXIT, header band, green below (12) | FIXED (round 2) | seen at 360 |
| 12 | Tries rings size (12) | open (LOW) | |
| 13 | Kickabout rows (13) | open (2 MED, 2 LOW) | |
| 16 | Keeper slow-mo on a catch (16) | open (LOW) | |

Also in round 3:
- **A lay-off back into your run keeps the same picture** (`resetForTouchOn`, CanvasMatch loadScenario): the phone
  remade the chance there. `tools/match-parity.ts` had the same mistake in its website side; both now follow CanvasMatch.
  `tools/match-popin.ts 10` now lists one `JUMP you 1.6 m` on that hand-over (you are put on the ball, as the website does).
- Goal celebration: packed shows none by default (Leo's update off); KIB shows none. Not caught on a packed still this round.
- The web build's false "Last time KIB Next closed…" card (src/safety.ts, not a match file) covers the line-up header after a reload and switches badges off: stills above show empty crest circles for that reason only.

## Summary (round 0, as first counted)

| | HIGH | MED | LOW | total |
|---|---|---|---|---|
| MISSING | 7 | 11 | 5 | 23 |
| DIFFERENT | 7 | 17 | 24 | 48 |
| SAME | - | - | - | 54 |
| N/A or not checked | | | | 4 |

(Counted from the tables below; SAME rows have no severity.)

**The 20 gaps that matter most** (detail in the sections):
1. **Post-match at 360×780: the achievement card's Next button sits under the fixed CONTINUE bar** and cannot be pressed; CONTINUE is shut until Next is pressed. A player is stuck unless he scrolls. (PostMatch, seen)
2. **No kick-off card** at the start of the feed ("THE TEAMS WALK OUT / KICK OFF", the tunnel picture, both badges in kit plates). KIB starts straight on the bare line list. (Feed, code+seen)
3. **No "Play as" position picker** on the line-up. (Line-up, seen)
4. **No live other scores**: the "Scores" button under the clock, the score pop-ups over the feed, the division's live table. (Feed, code)
5. **Tapping the commentary does not skip** the queued lines (packed: one tap empties the queue). (Feed, code)
6. **Match speed tops out at ×4** (packed: 1 → 2 → 4 → 8, four arrows); the speed is not kept between matches. (Feed, code)
7. **Pop-ups never move**: the GOAL scoreboard has no slide-down, no score roll, no gold flash; captions (SAVED, OFFSIDE...) do not wipe in or out. (Pop-ups, code: `MatchLook.tsx` 117 "still: no roll, no shine")
8. **Captions always at 14% from the top**; packed puts them in the half the ball is NOT in (top 14% or 74%), so in KIB a caption can sit on the ball. (Pop-ups, code)
9. **In-match ⚙ and 2D do nothing** (packed: 2D/3D figure toggle; ⚙ opens settings). (Scoreboard plate, seen+code)
10. **Line-up ⚙ opens the whole Settings screen** and leaves the line-up; packed opens a small sheet over it (Sound effects, Full highlights rebuild, "Back to the line-up"). (Line-up, code)
11. **No captain armband line** under the pitch ("© CAPTAIN · tap a team-mate to have it laid off to him…"), and no **"Call for it"** button in flight. (Chance overlays, code)
12. **No ⚡ Power shot button**, **no TOUCH (Touch Mode) button**, **no "WINDING UP…"** card. (Chance overlays, code)
13. **No added-time chip** (⏱ 90+3') on the pitch during a chance in added time. (Chance overlays, code)
14. **Top-down dribble words missing**: "Tap to start" big green pill + the two-line how-to and the duel notes ("He backs off…", "Drop a shoulder…") are one plain gold card in KIB. (Dribble, code)
15. **No run-up line** "↔ Drag sideways to change your aim" while running up to a penalty/free kick. (Run-up, code)
16. **Post-match does not animate**: no count-ups, no burst, no score digits dropping in, no shine on CONTINUE, no pulse; and achievements are an inline card instead of the packed toasts that pop after the star bar. (PostMatch, seen+code)
17. **Line-up nothing animates**: men do not walk out one by one (`kit-rise`), VS does not slam, KICK OFF has no shine/pulse; VS is flat white, not the faded steel. (Line-up, seen+code)
18. **Drill screen: no ✕ EXIT**, header says "LONG RANGE" not "💥 POWER · LONG RANGE", no club-colour band behind the header, navy below the pitch instead of green. (Drills, seen)
19. **Pitch frame shorter, camera further out on set pieces** (trial free kick: goal ~120 px wide in KIB vs ~200 px in packed at 412; empty band under the pitch). (Trial / chances, seen)
20. **360 wide line-up**: the competition chip breaks onto two lines ("COMMUNITY SHIELD / · FINAL") and the pitch narrows to ~250 px with dead space under it; packed keeps one line and a 300 px pitch. (Line-up, seen)

Fixed since the 20 Nov findings (`MATCH-FINDINGS.md`), re-checked here: the aim **arrow** (now a real arrow, kept through the run-up), the **landing ✕ and ball trail** (drawn, `drawPitch.ts` 151-200), the strike screen's **brushed-steel title, draining bar, HEIGHT meter, air hint** (`drawContact.ts`), **hit-stop/shake** (`match/feel.ts`), **game music** (`match/music.ts`), the drill **how-to card, "?" and result card** (`DrillShell.tsx`), the **Kickabout first hint** (coachFirst), playstyle icons on their own strip. Those MATCH-FINDINGS rows are stale.

---

## 1. Before the match: Play pressed (LineupIntro + VersusScreen)

Packed: `components/star/LineupIntro.tsx`, `components/star/VersusScreen.tsx`. KIB: `phone/src/screens/career/PreMatch.tsx`.
Stills: `S/pair-pre-412.png`, `S/pair-pre-subs.png`, `S/pair-pre-360.png`, `S/pair-360.png` (first two panes).

| element | packed | KIB Next | status | sev | android risk | files (packed / KIB) | stills |
|---|---|---|---|---|---|---|---|
| Low-energy prompt | ⚡ LOW ENERGY, square bar with number inside, Use a can ×n + Play anyway, ‹ Back | same words; bar with the number beside it, not inside | DIFFERENT (number outside the bar) | LOW | | LineupIntro 395-415 / PreMatch 150-170 | code |
| Not in squad / injured / away card | 📋/🩹/✈️, title, "🏟️ Watch from the stands", can row when out on energy only; 3D office over it when the office look is 3D | same; adds "On TV / 📺 WATCH ON TV" for watched fixtures; no 3D office | DIFFERENT (no office) | LOW | | LineupIntro 365-394 / PreMatch 120-148 | code |
| "Team news" when dropped to the bench | ManagerSays card (or 3D office) before the line-up, Continue | missing (file note says so) | MISSING | MED | | LineupIntro 258-266 / PreMatch 17 | code |
| Timer bar along the top | 4 px emerald bar fills in 3.8 s, then kicks off | same 4 px, 3.8 s | SAME | | | LineupIntro 57, 279 / PreMatch 336 | seen |
| Tap anywhere to kick off | any tap off a button | only a tap on the pitch | DIFFERENT | LOW | | LineupIntro 271 / PreMatch 287 | code |
| ← Back | top-left of header, secondary button | same place, navy pill | SAME | | | VersusScreen 233 / PreMatch 258 | seen |
| Competition chip | ⚽ + "COMMUNITY SHIELD · FINAL", 10 px, one line at 412 and 360 | same words, 9.5 px; **wraps to two lines at 360** | DIFFERENT | MED | text with letterSpacing 1.6 and no numberOfLines: wraps earlier on Android Roboto | VersusScreen 247-252 / PreMatch 262-266 | pair-360 |
| ⏩ Sim and ⚙ | float on the right edge at top 116/160 px over the header's right side (bugFixes off) | in the header's top-right corner | DIFFERENT | MED | | LineupIntro 285-305 / PreMatch 270-273 | pair-pre-412 |
| ⚙ opens | a sheet over the line-up: Sound effects, Full highlights rebuild (+?), "Back to the line-up" | the whole Settings screen (leaves the line-up) | DIFFERENT | HIGH | | LineupIntro 425-450 / PreMatch 272 | code |
| Crests, names, last five, formation, manager | 44 px crest, name, W/D/L squares, formation in kit ink, manager 8 px | same pieces and sizes | SAME | | | VersusScreen 436-470 / PreMatch 345-360 | seen |
| VS | 28 px italic, white→half-white gradient, slams in (`kit-slam`) | 28 px italic flat light grey, no animation | DIFFERENT | LOW | | VersusScreen 259-265 / PreMatch 277 | pair-pre-412 |
| Date | calendar icon + "Sat 8 Aug" | 📅 emoji + date | DIFFERENT | LOW | emoji renders as Android's own calendar glyph | VersusScreen 267 / PreMatch 278 | seen |
| Weather on the date line | only with Leo's weather on (off by default) | none | SAME (default) | | | LineupIntro 345 | code |
| Pitch | full width (386 px at 412), see-through over the stadium, green from the backdrop, mown stripes, vignette | 364 px wide at 412, ~250 px at 360, same see-through; first ~1 s shows dark navy until the backdrop loads | DIFFERENT (narrower) | MED | fit uses onLayout height: Android with a cut-out inset may shrink it more | VersusScreen 319-340 / PreMatch 225-235, 289 | pair-pre-412, pair-360 |
| Men on the pitch | 34 px drawn heads, name + image flag, walk out one by one (300 ms + 45 ms each) | 34 px heads, name + emoji flag, all at once; away heads blank for the first ~1 s | DIFFERENT | MED | emoji flags: fine on Android, but England 🏴󠁧󠁢󠁥󠁮󠁧󠁿 tag-flag shows as a black flag on some Samsung builds | VersusScreen 588-650 / PreMatch 377-392 | pair-pre-412 (first KIB pane) |
| Gold star over you | SVG star 12 px with dark edge | ★ text 12 px | SAME (looks the same) | | font glyph size differs on Android | VersusScreen 566 / PreMatch 384 | seen |
| "Unable to scout opponent's team" | half-pitch card, bench card | same | SAME | | | VersusScreen 655-683 / PreMatch 394-403 | code |
| Play as ▾ picker | pill top-right of the pitch "PLAY AS ST ▾", opens a row of positions; stops the timer. At 360 it overlaps the floating ⚙ (packed's own bug) | missing | MISSING | HIGH | | LineupIntro 141-176 / - | pair-pre-412 |
| Boots warning | 🥾 "NO BOOTS / BUY IN THE SHOP" top-left of the pitch | same | SAME | | two-line Text with fixed lineHeight 11: may clip on Android | LineupIntro 181-191 / PreMatch 298-303 | seen |
| Substitutes tab | under the pitch; open: the tab stays on top, both benches below it with flags, grows to 60vh | open: benches above, tab at the bottom, no flags | DIFFERENT | MED | | VersusScreen 356-375 / PreMatch 306-321 | pair-pre-subs |
| Bench reason line | none | "🪑 Form has dipped (6.5 avg). You start on the bench." above KICK OFF | DIFFERENT (extra) | LOW | numberOfLines 1: long reasons cut | - / PreMatch 326 | pair-pre-412 |
| KICK OFF | fixed to the bottom, gradient fade behind, pulse + Shine every 3.5 s | same place, still | DIFFERENT (no motion) | LOW | | VersusScreen 397-415 / PreMatch 327-330 | seen |
| First match tour | pointer tour over the match: energy, playstyle, speed (story career) | none | MISSING | MED | | page.tsx 4335-4342 / - | code |
| Skip the line-up setting | straight in | straight in | SAME | | | LineupIntro 113 / PreMatch 95 | code |

## 2. The scoreboard and plate (every match screen)

Packed: `CanvasMatch.tsx` 11043-11126. KIB: `phone/src/screens/MatchHud.tsx`. Stills: `S/pair-feed-412.png`, `S/pair-chance-412.png`, `S/feed-360-n-early.png`.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Two kit bars + white score boxes | xs names with black outline, score text-lg | same, Anton digits | SAME | | lineHeight 30 fixed on the score box; Anton has no fallback until fonts.ts loads | CM 11043-11060 / MatchHud 30-45 | seen |
| Top of the page | packed's bar is cut at the top at 412 (packed bug: the page scrolls under the status area) | full bar, 6 px top pad | DIFFERENT (KIB better) | LOW | SafeAreaView top: on the S20+ the punch-hole can still give a ~30 dp inset with bars hidden → a band above | CM 11030 / Match.tsx 118 | pair-chance-412 |
| Plate: SHIELD · GOALS · ASSISTS · PASS · RATING | 11 px labels, 9 px under 390 wide | same rule (9 px < 390) | SAME | | labels numberOfLines 1 without adjustsFontSizeToFit: "ASSISTS" at 360 on Android Roboto is ~1 px from cut | CM 10969 / MatchHud 52 | feed-360-n-early |
| 2D / 3D toggle | FigureSkinToggle flips the players' look mid-match | "2D" label, no press | DIFFERENT (dead) | MED | | CM 11101 / MatchHud 68 | seen |
| ⚙ | opens settings (frameObs chrome) | gear icon, no press | DIFFERENT (dead) | HIGH | | CM 11106 / MatchHud 69 | seen |
| Sound | mute toggle | mute toggle | SAME | | | CM 11107 / MatchHud 70 | seen |
| Standing ovation banner (farewell) | "👏 Standing ovation 👏" + "NN' — you come off…" gold strip | none in the HUD (the 3D ovation plays instead) | MISSING | LOW | | CM 11063-11072 / - | code |

## 3. The commentary feed (on the bench, between chances)

Packed: `components/star/MatchCommentary.tsx`, `KickOffCard.tsx`. KIB: `phone/src/screens/MatchFeed.tsx`. Stills: `S/pair-feed-412.png`, `S/pair-360.png`.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Kick-off card | while the feed has ≤1 line: tunnel picture, breathing floodlights, "THE TEAMS WALK OUT", "KICK OFF" with a glint, both badges in kit plates | missing; the KICK OFF period row shows instead | MISSING | HIGH | | MatchCommentary 183-191, KickOffCard.tsx / - | code |
| Lines | glossy bar per line in the kit colour, black minute chip, assists indented 32 px, goal line flashes white then settles | same bars and chips; **no goal flash** | DIFFERENT | LOW | lineHeight 16 on 12 px text fixed: Android Roboto may clip descenders | MatchCommentary 374-460 / MatchFeed 36-80 | pair-feed-412 |
| Period rows | "KICK OFF" centred, 0.18em | same | SAME | | | / | seen |
| Minute + speed plate | 56 px plate top-right, text-sm bold digits, ▶ ×1-4 | same plate, Anton digits 17 px | DIFFERENT (font) | LOW | fixed width 56: "90+10'" in Anton 14 px may overflow | MatchCommentary 207-216 / MatchFeed 95-98 | pair-feed-412 |
| Speed steps | 1, 2, 4, **8** (four ▶), kept in localStorage | 1, 2, 4 (three ▶), not kept | DIFFERENT | HIGH | | CM 1360-1366 / MatchFeed 95 | code |
| Scores button + live score pop + all scores panel | "Scores" under the clock; LiveScorePop over the feed when another game scores; LiveScoresPanel with follow stars | missing | MISSING | HIGH | | MatchCommentary 217-226, CM 11165-11175 / - | code |
| Tap the feed to skip | empties the queue in one tap | nothing | MISSING | HIGH | | MatchCommentary 161, CM 11502 / - | code |
| Radar | only with radar look New (default Old) | none | SAME (default) | | | CM 11471 | code |
| Playstyle icons | float over the feed's bottom-right (absolute), chosen 42 px with glow, others 32 px dim+desaturated | own strip under the feed, same sizes, no desaturate | DIFFERENT (layout) | LOW | | MatchCommentary 230-270 / MatchFeed 100-112 | pair-feed-412 |
| "YOU ARE GOING ON" + GET OUT THERE | amber bar, yellow button with glow | same | SAME | | letterSpacing 2.2 on 14 px: fine | MatchCommentary 272-300 / MatchFeed 114-136 | pair-feed-412 |
| Half time bar | "Second half" + Use can ×n (can picture) | same, **no can picture**, adds "Energy NN%" line | DIFFERENT | LOW | | MatchCommentary 280-296 / MatchFeed 118-128 | code |
| Energy panel + LOW / MEDIUM / HIGH | bar, three lightning badges with rings | same (Skia badges) | SAME | | | MatchCommentary 304-345 / MatchFeed 140-165 | pair-feed-412 |
| Full time / Extra time / Penalties CTAs | same five CTAs | same | SAME | | | CM setPause / driver 657-1062 | code |

## 4. The pitch during a chance (aim, run-up, flight, result)

Packed: `CanvasMatch.tsx` 11128-11560. KIB: `phone/src/screens/MatchPitch.tsx`, `Match.tsx`, `match/drawPitch.ts`. Stills: `S/pair-chance-412.png`, `S/pair-aim-412.png`, `S/pair-trial-strike-412.png`.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Pitch frame | border-2 emerald, rounded-xl, shadow | same frame, 2 px radius | SAME | | | CM 11128 / Match.tsx 120 | seen |
| Camera framing (Zoom) | chance framed close; trial free kick goal ~200 px wide | further out on set pieces (~120 px goal); open-play similar size | DIFFERENT | MED | | CM framing / drawPitch camFor | pair-trial-strike-412, pair-chance-412 |
| Aim arrow | tapered orange shaft, triangle head, kept through run-up | same now | SAME | | | CM drawAimArrow / drawPitch 120-145 | pair-trial-strike-412 |
| Ball trail + landing ✕ | white trail, yellow ✕ | drawn | SAME (code; not caught on a still) | | | / drawPitch 151-200 | code |
| STAMINA box | 124 px, corner clear of the ball (barSpot), Run/Sprint/Auto run, "W A S D move · Shift sprint" on a computer | same box and labels; no "Auto run" word, no keys line | DIFFERENT | LOW | | CM 11208-11231 / MatchLook 188-205 | pair-chance-412 |
| Added-time chip ⏱ 90+n' | amber chip top-left on a chance in added time | missing | MISSING | MED | | CM 11158-11163 / - | code |
| TOUCH (Touch Mode) button | top-right when boots/KIB give extra touch | missing (only a "TOUCH ON" caption) | MISSING | MED | | CM 11187-11201 / driver 2424 | code |
| ⚡ Power shot | bottom-left toggle when the mechanic is open | missing | MISSING | MED | | CM 11271-11281 / - | code |
| WINDING UP… | big italic amber card while winding up | missing | MISSING | LOW | | CM 11282-11288 / - | code |
| Call for it (captain, in flight) | amber pill bottom-right + message | missing | MISSING | HIGH | | CM 11232-11247 / - | code |
| Captain armband line | under the pitch: "© CAPTAIN · tap a team-mate…/ lay-off to X / n runs called" | missing (orders work, no line) | MISSING | HIGH | | CM 11539-11558 / - | code |
| Build-up "· tap to skip" pill | bottom centre, names the move ("On the break · tap to skip") | same | SAME | | | CM 11262 / MatchPitch 278 | code |
| Goal celebration "Tap to skip" | only with Leo's celebrations (off) | none | SAME (default) | | | CM 11250 | code |
| Run-up line "↔ Drag sideways to change your aim" | pill at 64% while running up | missing | MISSING | MED | | CM 11431-11437 / - | code |
| First-chance coach (story career) | yellow-ringed card low on the pitch / mid-left on strike | same card, same words | SAME | | | CM 11370-11380 / MatchPitch 70-85 | code |
| First-header coach | own two lines on the first header | missing | MISSING | LOW | | CM 11364-11369 / - | code |
| First-use coach (volley, steer, sprint) | card once each | missing | MISSING | MED | | CM 2151, 11387 / - | code |
| Live hint "Drag back = aim · Quick flick = take a touch" | pill at 18% on the first few chances | missing | MISSING | MED | | CM 1540, 11381 / - | code |
| Weather layer | only with Leo weather (off) | none | SAME (default) | | | CM 11154 | code |

## 5. Top-down dribble

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Ready state | green pill "Tap to start"/"Push to start" at 10% + black how-to line (three versions: stick, duels with/without skill moves, plain) | one gold-ringed card at 40%: "Tap to start the run. Drag to steer, tap a team-mate to pass." | DIFFERENT | HIGH | | CM 11301-11313 / Match.tsx 96-100 | code |
| During the run | bottom strip with the moves ("Tap a side: drop the shoulder…") | none | MISSING | MED | | CM 11314-11322 / - | code |
| Duel notes | coloured note at 16% (green good / red bad) | none | MISSING | MED | | CM 11294-11299 / - | code |

## 6. The strike screen (STRIKE / HEAD / VOLLEY IT?)

Packed: `components/star/ContactBall.tsx` via CM 11401. KIB: `match/drawContact.ts`, `MatchPitch.tsx` StrikeWords. Stills: `S/pair-strike-412.png`, `S/pair-aim-412.png`.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Title + "WHERE DO YOU" + draining bar | brushed steel, yellow bar | same | SAME | | Skia text: needs the bundled font, else system | / drawContact 110-160 | pair-strike-412 |
| Ball | ~216 px, gold ring countdown | ~216 px, gold ring | SAME | | | / | pair-strike-412 |
| POWER meter + % | right side | same | SAME | | | / MatchPitch 108-117 | pair-strike-412 |
| HOW TO PLAY card (trial) | ball-tap icon, three lines | same words, **drag icon** instead of the tap icon | DIFFERENT | LOW | | stages/TrialPenalties TeachCard / MatchStages | pair-strike-412 |
| TOO LATE / TOO SLOW | big italic red | same | SAME | | | / MatchPitch 118-124 | code |
| Volley HEIGHT meter, green band, hint | yes | yes (drawContact 184-200) | SAME (code) | | | / | code |
| Power-shot contact screen | PowerShotContact when armed | not reachable (no Power shot button) | MISSING | MED | | CM 11393 / - | code |

## 7. Pop-ups (Mikey's: GOAL scoreboard and captions)

Packed: `components/star/MikeyPopup.tsx`. KIB: `MatchLook.tsx` 117-185, `MatchPitch.tsx` caption, `Match.tsx` GoalBoard.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| GOAL scoreboard | at 70%, slides down, scoring digit rolls old → new with gold flash, scorer/assist strip wipes open, 1.5 s | at 70%, same pieces, **still** (no slide, no roll, no flash) | DIFFERENT | HIGH | | MikeyPopup 170-235, 283 / MatchLook 128-170 | S/pc1-b-05.png (packed ghost mid-fade) |
| Captions (SAVED, FOUL, OFFSIDE…) | tab + word, wipes in/holds/wipes out 0.8-1 s; top 14% or 74% (the half the ball is not in) | same tab + word, **fixed at 14%**, no wipe | DIFFERENT | HIGH | Anton 24 px with letterSpacing 1.9, no numberOfLines: a long word can wrap on Android | MikeyPopup 240-295 / MatchPitch ~310, MatchLook 172-185 | pair-aim-412 (KIB FOUL) |
| Cut when the feed opens | pop-up fades in 160 ms | removed at once | DIFFERENT | LOW | | MikeyPopup / | code |

## 8. Live shootout

Packed `LiveShootout.tsx` (ShootoutStrip). KIB `MatchShootout.tsx`.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Strip at the bottom: title, Next: name, two rows of ✓/✗, score | yes | yes, same words and colours; circles 15 px vs 14 px | SAME | | | LiveShootout 109-150 / MatchShootout 10-50 | code |
| Winner line pops (kib-pop) | pops | still | DIFFERENT | LOW | | / | code |

## 9. Half time, subs, injuries, cards, full time

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Half time pause + can | in the feed bar | same | SAME | | | / MatchFeed 114 | code |
| Off the feed (pause over the pitch) | n/a (always cut to the feed) | dark cover + label + button | DIFFERENT (extra path) | LOW | | / MatchFeed 170-180 | code |
| Coming on (sub), planned off, red card, injury | commentary lines + pauses from the same lib calls | same driver port | SAME (code) | | | CM / driver.ts | code |
| Full time → post-match | button "Full time" | same | SAME | | | / | code |

## 10. Post-match

Packed `components/star/PostMatch.tsx` + `AchievementToasts` (page.tsx 4453-4476). KIB `phone/src/screens/career/PostMatch.tsx`. Stills: `S/pair-post-412.png`, `S/pair-360.png` (last two panes).

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Kicker (competition or Full Time) | chip | same | SAME | | | PM 129 / | pair-post-412 |
| Scoreboard card | crests, kit plates, YOU, 4 - 0 digits drop in, WIN pill, burst on a win | same pieces, still | DIFFERENT (no motion) | MED | | PM 134-170 / | pair-post-412 |
| Knockout line | red bar "Arsenal win the Community Shield." | same | SAME | | | / | pair-post-412 |
| Simulated card: star bar, match rating 7.0, goals/assists | count-ups, star fill | same pieces still; adds "1→3 ⬆" and "+ Community Shield + Achievements ×3" | DIFFERENT | MED | | PM 185-200 / PostMatch 63-70 | pair-post-412 |
| Boss / Team / Fans after a sim | not shown | shown | DIFFERENT (extra) | LOW | | / PostMatch 70-72 | pair-post-412 |
| "⚡ +28 energy back from the rest days" | not on this screen (Home toast later) | shown | DIFFERENT (extra) | LOW | | / | pair-post-412 |
| Achievements | toasts pop one by one after the star bar; CONTINUE never blocked | inline card "ACHIEVEMENT 1 OF 3 · Next"; CONTINUE shut until all seen | DIFFERENT | MED | | page.tsx 4471 / PostMatch 178-187 | pair-post-412 |
| **360×780: Next under CONTINUE** | n/a | the fixed CONTINUE bar covers the achievement's Next button | DIFFERENT (does not fit) | HIGH | worse on Android if a cut-out inset adds bottom padding | / PostMatch 79, 185 | pair-360 |
| CONTINUE | right under the card, pulse + shine, waits for the animations | fixed at the bottom, still | DIFFERENT | MED | | PM 256 / PostMatch 79 | pair-post-412 |
| Played match: rating hero tap → every chance, chances/goals/assists/passes, Boss/Team/Fans bars, Pay (Wage, Goal Bonus, Sponsors, total with +★ float) | count-ups and floats | same blocks still | DIFFERENT (no motion) | MED | | PM 203-245 / PostMatch 136-170 | code |
| Boots worn out line | yes | yes | SAME | | | / PostMatch 112 | code |

## 11. Trial stages (free kicks, through the gate, take him on, find the pass, shootout)

Packed `components/star/TrialSequence.tsx` + `stages/*`. KIB `screens/career/Trial.tsx` (wrapper: CAREER agent), `MatchStages.tsx`, `MatchVision.tsx`. Stills: `S/pair-trial-412.png`, `S/pair-trial-strike-412.png`, `S/pair-strike-412.png`.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Top: ✕ EXIT, 5 progress bars, 1/5 | yes | same | SAME | | | TrialFrame / | pair-trial-412 |
| Board: YOU ring, FREE KICKS 0/1, "17 M OUT · 2 IN THE WALL" | yes | same | SAME | | | / | pair-trial-412 |
| Event banner "HEADS UP · PUSHED FURTHER OUT" | shown when the trial rolls that event | shown (rolled on the KIB run) | SAME (code) | | pushes the board and pitch down ~60 px | / | pair-trial-strike-412 |
| Pitch box height | to ~850 px at 412 | to ~790 px; caption sits lower, band of empty green above it | DIFFERENT | MED | `usePitchHeight` reads window height: Android with the bars hidden can report a different height | / MatchStages usePitchHeight | pair-trial-412 |
| HOW TO PLAY cards (aim, run-up, strike) | three cards, same words | same words | SAME | | | TrialFreeKicks 165-200 / MatchStages | pair-trial-strike-412 |
| Caption under the pitch ("Bend it round the wall…") | bold white two lines | same | SAME | | | / | seen |
| Penalty ramp line "Kick n: A fair keeper — he's guessing." | TrialPenalties rampLine | missing | MISSING | LOW (penalty stage not in the 5-stage trial now; only if reused) | | TrialPenalties 731 / - | code |
| Gate: "Threaded it! / Through. / Clipped it. / Missed the gate." | yes | yes | SAME | | | TrialTechnique 93 / MatchStages | code |
| Vision: "Heads up · Who's free?" big card + countdown digits | yes | words differ: no "Heads up / Who's free?" card | DIFFERENT | MED | | TrialVision 600-615 / MatchVision | code |
| Shootout: "Three kicks each. Yours is the last one.", "The winning penalty — it's all on you." | yes | yes | SAME | | | TrialShootout 264-274 / MatchStages | code |
| Next up 3-2-1 between stages | yes | yes (Trial.tsx) | SAME | | | TrialSequence 396 / Trial.tsx | code |

## 12. Training drills

Packed `page.tsx` 4223-4282, `TrainingMinigame.tsx`, `DrillTutorial`, `DrillHelpButton`. KIB `screens/career/DrillShell.tsx`, `Training.tsx` DrillScreen. Level select is on the CAREER/training border (listed here only for the drill). Stills: `S/pair-drill-412.png`.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| ✕ EXIT | top-left (hidden only on the story's training day) | missing | MISSING | HIGH | Android back button may be the only way out | TrainingMinigame / DrillShell | pair-drill-412 |
| Tries 1 2 3 | small rings under EXIT | bigger rings top-left | DIFFERENT | LOW | | / | pair-drill-412 |
| Header | "💥 POWER · LONG RANGE" + LEVEL 1 ★★★ over a club-colour band | "LONG RANGE" + LEVEL 1 ★★★, no band | DIFFERENT | MED | | / | pair-drill-412 |
| HOW IT WORKS card | yes, gold edge | same | SAME | | | / DrillShell 40-80 | pair-drill-412 |
| "?" help | bottom-right | same | SAME | | | / DrillShell 87 | pair-drill-412 |
| "12M · OPEN GOAL" tag | bottom-left of the pitch | same | SAME | | | / | pair-drill-412 |
| Below the pitch | green | navy | DIFFERENT | LOW | | / | pair-drill-412 |
| Result card (stars, First time!, LEVEL n UNLOCKED) | yes | yes (DrillShell CompleteScreen) | SAME (code) | | | / DrillShell 100-140 | code |

## 13. Kickabout (phone app; border with WORLD: the phone shell is theirs)

Packed `PhoneHome.tsx` 375-410 (EnginePlay bare). KIB `screens/MatchKickabout.tsx`.

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Score pill "⚽ g / c" | in the app bar, right | in its own row under the bar | DIFFERENT | LOW | | PhoneHome 395 / MatchKickabout 58 | code |
| "▶ Goal replays" button | not here (packed's replays are admin-only in Settings) | shown | DIFFERENT (extra) | LOW | | GoalReplaysPanel / MatchKickabout 53 | code |
| After 6 chances | sandbox postmatch: the real PostMatch "Training Session" screen | small dark card "TRAINING SESSION 2 / 6 goals from 6 chances · Continue" | DIFFERENT | MED | | CM 11563-11572 / MatchKickabout 70-79 | code |
| Real squads (names/faces) | yes | stand-in men (file note) | DIFFERENT | MED | | / MatchKickabout 10 | code |
| First-chance hint | yes | yes (coachFirst) | SAME | | | / | code |

## 14. Goal videos and replays

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Goal recorded every goal | `onGoalClip` | `clipSink` → keepGoalClip | SAME (code) | | IndexedDB vs phone storage | page.tsx / Match.tsx 50 | code |
| Goal clip viewer: 3 cameras, Save video | GoalClipViewer | MatchGoalVideo (save via clipMix) | SAME (code, not seen) | | video encode on Android untested here | / MatchGoalVideo.tsx | code |
| Goal replays page | Settings → Goal Replays (Admin · Test) | from Kickabout | DIFFERENT (where) | LOW | | page.tsx 4356 / MatchReplays | code |

## 15. Internationals, five-a-side, farewell (borders)

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| International match | same CanvasMatch on the national swap; line-up shows both nations | same (setup.ts, PreMatch intlCareer) | SAME (code) | | | / | code |
| Call-up, tournament table, watched screen | CAREER/WORLD border | not checked here | N/A | | | | |
| Five-a-side | dev page only (`/star-fiveaside-dev`), not in the career | none | N/A | | | | |
| Farewell match | CanvasMatch with farewell offAt + ovation | FarewellMatchScreen + Farewell3D ovation | SAME (code) | | | / areas/match.tsx 40-100 | code |
| Watch from the stands (hidden match) | CAREER border | not checked | N/A | | | | |

## 16. Feel: sound, buzz, music (code only)

| element | packed | KIB Next | status | sev | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Hit-stop, shake | yes | `match/feel.ts` | SAME (code) | | | / | code |
| Keeper slow-mo on a catch | `keeperSlowRate` | not found in feel.ts/driver | MISSING | LOW | | CM / - | code |
| Game music | gameMusic cues | `match/music.ts` + Match.tsx 60-75 | SAME (code) | | | / | code |
| Haptics on strike scaled by power | 4 call sites | via feel.ts (not checked per site) | not checked | | | | |

## Not reached / not checked (say so, do not guess)

- KIB's **new-career form** in the look check: `compare.mjs`'s `fill()` does not reach react-native-web inputs, so its trial scenes fail for KIB; the `trial-to-strike.sh` way (setting the value and firing `input`) works. Left for the CAREER agent's area.
- The **match-pitch** look-check scene fails for KIB (its "tap to skip" never shows within 15 s); chance stills here come from `to-chance.sh` + `chance.sh` on the live bench instead.
- Corners, cutbacks, crosses, volleys, headers, tight angle, through pass, run after pass: not each caught on a still this round (chance kind is random per run); covered by code rows above (the overlays are the same for every kind; the strike screen motions are in drawContact).

## Tools changed / added

- `phone/tools/look/compare.mjs`: `--w/--h` (phone size; sheets follow).
- `phone/tools/playtest/inventory/side.py`: any number of stills side by side, labelled.
