# KIB Next vs the packed app — PART 2: THE CAREER (screen-by-screen inventory)

21 Nov 2026, branch `claude/eloquent-bohr-6veqfh` at `aec937eb`. The packed app (`mobile/www`, built from
`app/star-dev/page.tsx` + `components/star/**`) is the reference. KIB Next is `phone/`. No app code was changed.

Other parts: MATCH (pre-match → post-match, trial stages, drills, Kickabout) and WORLD (League, Phone and its
apps, Shop, Store, Sponsors, Star Pass, Owner, Settings, help, achievements, Hall of Fame browsing). Rows that
sit on a border are marked **[border: MATCH]** or **[border: WORLD]** and kept short.

## Summary

Counted over every row below (`python3 phone/tools/playtest/inventory/count.py phone/tools/playtest/inventory/CAREER.md`).

| Status | HIGH | MED | LOW | — | Total |
|---|---|---|---|---|---|
| SAME | – | – | – | 74 | 74 |
| DIFFERENT | 3 | 29 | 40 | – | 72 |
| MISSING | 9 | 18 | 9 | – | 36 |
| LEFT OUT (Mikey) | – | – | – | 7 | 7 |
| **All rows** | **12** | **47** | **49** | **81** | **189** |

Border rows (MATCH / WORLD) are listed but not counted.

ANDROID RISK flagged on 24 rows (see the column; the common ones are listed under "Android risks" below).


> **Fix round 2 (21 Nov 2026, career builder).** Every row below carries its state in the Status column:
> `FIXED (seen)` = looked at in the web build at 412×915 (some also at 360×780) beside the packed still;
> `FIXED (reasoned)` = built from the packed code, type-checked, not opened by hand; `PARTLY` and `OPEN` say what is left and why.
> The counts table above is the first inventory's and is kept as it was.

### The 20 most important gaps (biggest first)

| # | Screen | Gap | Sev |
|---|---|---|---|
| 1 | Farewell walk-out | KIB Next crashes into "Something went wrong · Requiring unknown module 7084" the moment the guard of honour starts (Farewell3D's `import("./farewellScenes")`); no drawn fallback, the career's last minutes are lost. Seen in the web build; the same lazy `import()` on Android must be checked. | HIGH |
| 2 | Career overview (legacy) | Packed: tab strip (Life · Career · Seasons · Who won · Clubs · Trophies · Records), the LEGACY score ring, "A CAREER IN THE GAME" in gold, SHARE PICTURE / SHARE LINK, the journey and the chart, bottom bar HALL OF FAME · NEW CAREER · MENU. KIB Next: one plain scrolling list, no tabs, no legacy score, no sharing. | HIGH |
| 3 | Farewell invite + team sheets | Packed shows all 22 players as face circles (invite) and a full drawn team-sheet pitch with faces, flags and SUBSTITUTES (sheets). KIB Next shows comma-separated names in cards. | HIGH |
| 4 | Tours after the first Home | Only the welcome tour and the "?" tour exist. Missing: Training tour, the story's training-day pointer (Power then Technique), "one more drill", League-opens tour, first-game tour, boss tour + boss-meeting tour, Relations tour, Shop tour (with "you need ★N more for the phone"), Phone tour, first-visit tours of Stats/Shop/Phone. | HIGH |
| 5 | Story beat "boss" | Packed's beat button opens the manager's relationship game; KIB Next's `goBeat("boss")` returns nothing, so the button only closes the pop-up. Also "sponsor" (packed: Phone + 2-step pointer to Messages → the offer) and "stats" (packed: a swipe pointer) are simplified. | HIGH |
| 6 | Unlock chain pop-ups | Missing: UnlockPop ("Unlocked · Coming up", See all achievements), SlotQuestion ("Switch this button to League?"), AchievementPop for a record broken / the phone, the "New in your game" mechanic guides ("Try a header now"), the 🔒 lock note toast. | MED |
| 7 | Home locks | Packed locks Stats ("Stats is locked · Score your first goal") and Shop ("After your third game") on a new career; KIB Next's ◀ STATS / SHOP ▶ always open. | HIGH |
| 8 | Training level select | Packed: green page, header card (icon, "Power", "Long shots and stronger crosses", RATING 40, ★0/90 bar, "Level 1 is next"), tiles with three empty stars and a lock. KIB Next: blue blur, "TRAINING / POWER" and a back arrow only; tiles show a lock only. | HIGH |
| 9 | International call-up | Packed: spotlit dark page, the nation's big flag, CALLED UP, a match card with competition line and flags ("1 MATCH"), England-manager card with flag, a big number (6 · NOT PICKED) and a bar with SQUAD 34 / STARTER 55 marks, yellow REPORT FOR DUTY. KIB Next: blue blur, no flag, plain rows, a thin bar, green button. Also "picked at about 87" (packed) vs "about 81" (KIB) on the same save. | HIGH |
| 10 | Manager moments on Home | No "In the dugout" banner for a new manager (career.managerNews), no "made captain" moment (CaptainInOffice / its plain card), no set-piece talk (ManagerChat), no "Boss wants a word" chip. | HIGH |
| 11 | New career: your photo | "Add a photo" / "Take a photo" are greyed out with "Your own photo comes to the phone app later". | HIGH |
| 12 | Away on duty (Home) | Packed swaps the league row for "ON DUTY · JUNE 2027 ›" (NationDropdown, nation colours); KIB Next keeps the league row. | MED |
| 13 | Breaking News | Ticker does not scroll (packed scrolls the line); your face is the drawn head (packed: the 3D headshot render, allowed by Mikey); the band sits ~20 px lower. | MED |
| 14 | The final whistle (retirement) | Packed: dark page, red glow, gold "20 SEASONS" pill, rays, "THE FINAL / WHISTLE" (WHISTLE gold), dark cards, full-width yellow HANG THEM UP. KIB Next: blue blur, one-line white title, green button. | MED |
| 15 | Achievement / star toasts | Packed AchievementToasts: "ACHIEVEMENT 2 OF 3 · GOLD", tier medal, timer bar. KIB Next: a plain list card with 🏅. | MED |
| 16 | Scout talk / offer page | The stadium behind is much darker in KIB Next (packed shows lit stands and a green pitch); the club name is plain white (packed: the steel-grey Title style). No rise/halo/kick animations. | MED |
| 17 | Contract talks (transfer) | 😐 emoji instead of the drawn negotiator; no SETTINGS; card pinned to the top; Walk away is a red full-width button (packed: dark brown). | MED |
| 18 | Stats → Achievements / Contract | Achievements is a plain list (packed: ring, tier bars, filter chips, medal grid). Contract is a plain card + "ASK FOR A NEW DEAL" (packed: paper "PROFESSIONAL CONTRACT" with signatures and clauses + "PROPOSE RENEWAL"). | MED |
| 19 | Title "Tutorial" | Packed closes the title and replays the coach tour on the live Home; KIB Next opens a "How it works" list page. Other screens' "?" also open that page instead of the screen's own tour. | MED |
| 20 | Every pop-up on Android | 10 `<Modal>`s (story beats, PotM, Breaking News, title sheets, tour…) have no `navigationBarTranslucent`; an Android Modal is its own window and can bring the hidden navigation bar back. `repeating-linear-gradient` / `repeating-conic-gradient` (news scanlines, PotM rays) are not in RN's `backgroundImage`. | ANDROID RISK |

### Android risks that repeat

- **Modals and the hidden bars** — `Immersive` (src/immersive.tsx) hides the bars for the main window only. Every `<Modal>`
  (TitleMenu sheets, StoryBeatPop, PotmWinPage, BreakingNewsPage, Pops milestone, PointerTour, …) is a separate Android
  window: without `navigationBarTranslucent` (RN ≥0.78) the navigation bar can show while it is open and stay until the
  next `hideBars()` timer. Check on the S20+.
- **CSS-only backgrounds** — `backgroundImage` with `linear-gradient`/`radial-gradient` works on the new architecture
  (RN 0.88); `repeating-linear-gradient` (NewsMoments.tsx:43) and `repeating-conic-gradient` (NewsMoments.tsx PotM rays)
  are not supported and will draw nothing. `boxShadow` inset rings are supported on 0.88 but untested on device.
- **Lazy 3D imports** — `three/Farewell3D.tsx:126,204`, `three/HomePlayer3D.tsx:112-114`, `three/Headshot3D.tsx:68` use
  `await import()`. The web build fails on one of them (row FW-3). Native Metro normally inlines these; verify the
  farewell on the device, and give it the drawn fallback the packed app has.
- **3D crash guard** — `safety.ts` turns the drawn/3D player and badges off for good after one unsettled run
  (CAREER-FINDINGS #1). On a phone that is slow to start 3D, the title and Home can lose the player permanently.
- **Text that can overflow** — 0 uses of `adjustsFontSizeToFit` in screens/career and Home; long club names in
  Signing ("SIGNING FOR BRIGHTON & HOVE ALBION"), the Continue hint and the scout's club title rely on `numberOfLines`
  only, and several big Anton titles (`FONT.display`, fontSize 28–34) have none. Anton has one weight; RN falls back to
  Roboto if the font load (1.5 s cap) misses, which changes every heading width.
- **Fixed heights** — Home tiles 66, next match 92, arrows 34, chips 30, cans fixed; Trial `Dimensions.get("window")`
  once (Trial.tsx:28, does not follow a rotation or a split screen); SigningMoment scales a 360×430 stage to the window.

### How the stills were made

Both apps in Chromium (SwiftShader) side by side with touch on, through `phone/tools/playtest/drive.mjs` (port 7791,
`PT_SHOTS` = the stills folder) and `phone/tools/look/out/web` (KIB Next's web build, `build-web.mjs`). Saves:
`phone/tools/look/make-save.mts` (Arsenal, every screen open), `phone/tools/playtest/make-season-end.mts --left 0`, and the
new `phone/tools/playtest/make-career-states.mts <trial-last|trial-done|season-over|retire-due|final-next|youth|free-agent>`.
`star-title-force=1` in the packed app's storage shows its title screen under a test browser (it skips it when
`navigator.webdriver`). Main size 412×915, spot checks at 360×780.

Stills: `/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/inventory/career/` — `<name>-pair.jpg`
(packed left, KIB Next right), plus `<name>-packed.png` / `<name>-next.png`.

**Caveats.** The web build has no 3D: KIB Next's player on Home is blank after ~2.5 s in the stills (the web stub), on the
phone it is the 3D player. Fonts are Roboto/Anton from files in the web build. Random parts differ on purpose (scout
lines, negotiation opening offers: `startNegotiation(..., Math.random)` on both sides). The packed app's free-agent
state could not be loaded (its own save on unload overwrote the injected one), so that row is from the code.

---

## 0. Phase map — every packed phase in the career frame, and where it lands in KIB Next

| Packed phase (`StarPhase`, lib/star/types.ts:1765) | Packed screen | KIB Next screen (areas/*.tsx) | Status |
|---|---|---|---|
| (title, `titleOpen`) | TitleScreen | `title` → TitleMenu | SAME (see §1) |
| (hallOpen) | HallOfFame | `hall-of-fame` | [border: WORLD] |
| (global settings) | GlobalSettingsScreen | `career-settings` | [border: WORLD] |
| (save clash) | SaveClashPrompt | — (no cloud saves on the phone) | n/a |
| (not signed in) | "Start your career / Sign in" | — (no accounts on the phone) | n/a |
| profile-setup | ProfileSetup | `career-new` | SAME flow (§2) |
| trial-stages | TrialSequence wrapper | `career-trial` | §3 (stages: MATCH) |
| manager-talk | ManagerTalk | `career-manager-talk` | §4 |
| wage-talk | NegotiationScreen | `career-wage-talk` | §4 |
| scout-offers | ScoutOffers | `career-offers` | §4 |
| trial-reward | TrialReward → 3D signing | `career-signed` → SigningMoment (drawn) | §5 |
| loan-brief | LoanBrief (intro) | `career-loan-brief` | §15 |
| free-agent | FreeAgentShell | `career-free-agent` | §15 |
| youth | YouthTeam | `career-youth` | §15 |
| dashboard | DashboardShell + HomeHub | `tabs` → Home | §6–8 |
| skills (training / life) | SkillsScreen / RelationsPage | `career-training` / `relations` | §10 (Relations: WORLD) |
| training | TrainingMinigame | `career-drill` | [border: MATCH] |
| pre-match / match / post-match / media | … | … | [border: MATCH / WORLD] |
| intl-callup | CallUpScreen | `career-callup` | §11 |
| intl-watched | WatchedScreen | `career-watched` | §11 |
| intl-tournament | TournamentScreen | — | n/a: `tournDue = false` in page.tsx:1058 |
| intl-tournament-table | TournamentScreen progress | `intl-tournament-table` | §11 |
| contract-renewal | ContractInOffice → ContractRenewal | `career-contract-renewal` | §12 |
| draw / knockout-roundup / playoff-roundup / deadline-day | CupDrawReveal / KnockoutRoundup / PlayOffRoundup / DeadlineDayRoundup | `cup-draw` / `knockout-roundup` / `playoff-roundup` / `deadline-day` | §13 (border WORLD for the draw) |
| season-reel | SeasonReel | `career-season-reel` | off on both (Leo update off by default) |
| ballon-dor | BallonDorNight → BallonDor | `career-golden-ball` | §14 |
| season-transfer / transfer-request-talk | TransferHub / NegotiationScreen | `season-transfer` (world TransferHub) | §14 |
| transfer-signing | TransferSigning → 3D signing | `transfer-signing` → SigningMoment | §14 |
| relegation-move | RelegationMove | `relegation-move` | §14 |
| season-awards | SeasonAwardsScreen (Night when Leo's update is on) | `career-season-awards` | §14 |
| ladder | LadderScreen | — | n/a: skipped in packed (page.tsx:2165) |
| final-season | FinalSeasonNotice | `career-final-season` | §16 |
| retirement | FinalWhistle | `career-retirement` | §16 |
| farewell-invite / -sheets / -walkout / -match / -result | Farewell / LineupIntro / GuardOfHonour / CanvasMatch / FarewellResult + StandingOvation | `career-farewell-*`, `farewell-match` | §16 |
| legacy | CareerOverview | `career-legacy` | §16 |
| dilemma / press | DilemmaModal / PressConference | `career-dilemma` / `career-press` | off on both (page.tsx:1834; flow.ts:936-937) |
| relationship-game / advert-shoot | RelationshipGame / AdvertShoot | `career-relationship-game` / `advert-shoot` | [border: WORLD] |
| garden / home-3d / shop-3d / training-3d / casino-* | 3D rooms | — | LEFT OUT (Mikey) / no casino |

---

## 1. Title screen, Load game, Credits

Stills: c06-title-trialist, c20-title-save, c21-load, c22-credits, s360-title.
Packed: components/star/TitleScreen.tsx. KIB: phone/src/screens/career/TitleMenu.tsx, areas/glue.tsx:116.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| T-1 First launch | no save → straight to "Who are you?" | same (glue.tsx:120 `firstLaunchSeen`) | SAME | — | | page.tsx:748; glue.tsx:116 | c01-first-launch |
| T-2 Backdrop | stadium photo by kick-off sky (day/sunset/night), vignette | same pictures (Backdrop kind="title") | SAME | — | | TitleScreen.tsx:153-167; TitleMenu.tsx:103 | c20-title-save |
| T-3 Parallax | stadium and player drift with the finger (tilt) | none | OPEN: LOW: the parallax needs the tilt sensor; not built (was MISSING) | LOW | | TitleScreen.tsx:74-79 | — |
| T-4 Wordmark | KNOWITBALL, dark steel gradient fill, tight tracking (-0.04em), club-glow drop shadow | paler grey (#8d949e) Anton, letter-spaced to 94 % width, no glow | FIXED (earlier, measured): the fit builder set the word from the font's own width; colour stays #8d949e (was DIFFERENT) | LOW | Anton missing → Roboto, width jumps | TitleScreen.tsx:269-300; TitleMenu.tsx:55-75 | c20-title-save |
| T-5 Tagline | "ROAD TO THE GOLDEN BALL" amber with two fading rules | same | SAME | — | | TitleScreen.tsx:295-298; TitleMenu.tsx:66-70 | c20 |
| T-6 "Every legend starts with a trial" | no save only, rises in at 900 ms | shown, no rise | OPEN: LOW: no rise-in on the line (was DIFFERENT) | LOW | | TitleScreen.tsx:171-175; TitleMenu.tsx:72 | — |
| T-7 Your player | 3D player (HomePlayer where="title"), club glow under him, kit-rise in at 520 ms | HomePlayer (3D on phone, drawn on web); a square brown "pool" patch under him in the web build; no rise | OPEN: LOW: the 3D player is the phone's; no kit-rise (was DIFFERENT) | LOW | 3D start-up + crash guard | TitleScreen.tsx:181-197; TitleMenu.tsx:109-112 | c20, s360-title |
| T-8 Ball | the 3D player brings his own (no drawn ball) | drawn ball beside him when drawn | SAME | — | | TitleScreen.tsx:199 | c20 |
| T-9 Menu tabs | slanted tabs 16 px from right, 50 % wide; Continue 54 px (green, ★ badge, club crest + "ARSENAL / SEASON 1"), others 42 px; Hall of Fame gold | same sizes, colours and hint | SAME | — | | TitleScreen.tsx:203-245, 336-360; ui/look/Buttons.tsx:55 | c20, s360-title |
| T-10 Menu entry animation | each row rises in (RiseIn, 760 ms start, staggered); Continue has a looping Shine | none | OPEN: LOW: menu rows do not rise in (was MISSING) | LOW | | TitleScreen.tsx:205-245 | — |
| T-11 Settings before any save | shown | shown (fixed since the last findings) | SAME | — | | glue.tsx:131 | — |
| T-12 Tutorial | with a save: closes the title, replays the coach tour on Home; no save: new game | with a save: opens "How it works · Home" list page; no save: new game | FIXED (reasoned): Tutorial with a save opens Home and the coach replays HELP_TOURS.home on it (askTour); areas/glue.tsx (was DIFFERENT) | MED | | page.tsx:2996-3000; glue.tsx:130 | — |
| T-13 Credits link | small CREDITS, right, 12 px, tracking .16em | same | SAME | — | | TitleScreen.tsx:240-244; TitleMenu.tsx:132 | c20 |
| T-14 Load sheet | translucent dark sheet over the title, grab handle, rows rise in; "LAST PLAYED" / "RETIRED" pills; PLAY / NEW GAME buttons in caps; DELETE → "Sure? / No" pills | opaque sheet, no handle, "· LAST PLAYED" as text, "Play" / "New game" sentence case, "SURE? / NO" plain text | FIXED (earlier): earlier (fit builder) (was DIFFERENT) | LOW | Modal: nav bar | TitleScreen.tsx:420-480; TitleMenu.tsx:137-165 | c21-load |
| T-15 "All 3 saves are in use" | amber note card | plain amber text | FIXED (earlier): earlier (fit builder) (was DIFFERENT) | LOW | | TitleScreen.tsx:428-432; TitleMenu.tsx:139 | — |
| T-16 Credits sheet | translucent; KNOWITBALL silver gradient italic 26 px; "Made by Harry, Mikey and Leo"; knowitball.co.uk; Back | opaque; white KNOWITBALL 30 px; same words | FIXED (earlier): earlier (fit builder) (was DIFFERENT) | LOW | Modal: nav bar | TitleScreen.tsx:486-497; TitleMenu.tsx:167-176 | c22-credits |
| T-17 Play Area link | dev builds only | — | SAME | — | | TitleScreen.tsx:241 | — |

## 2. New career: details, style, photo

Stills: c01-first-launch, c02-nation-open, c03-style, c04-photo. Packed: ProfileSetup.tsx, PortraitPicker.tsx. KIB: screens/career/NewCareer.tsx.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| NC-1 Page | green gradient, "‹ Main menu" bar, pill "ROAD TO THE GOLDEN BALL", title, "Step 1 of 2 · your details" | same | SAME | — | | ProfileSetup.tsx:242-268; NewCareer.tsx:76-90 | c01 |
| NC-2 Names | First / Last side by side, white boxes, max 20 | same | SAME | — | keyboard covers fields (no KeyboardAvoidingView) | ProfileSetup.tsx:275-294; NewCareer.tsx:93-97 | c02 |
| NC-3 Nickname | optional, note line | same | SAME | — | | :297-311; :98-102 | c01 |
| NC-4 Nationality row | flag picture, name, ✓, CHANGE | flag emoji, name, ✓, CHANGE | FIXED (earlier): drawn flags (9d44a0f4) (was DIFFERENT) | LOW | flag emoji font | :313-332; :103-112 | c01 |
| NC-5 Nationality list | opens scrolled to your nation (highlighted) | opens at Afghanistan | FIXED (reasoned): the list opens scrolled to your nation (contentOffset, 35 px a row); not in the web build checked (was DIFFERENT) | LOW | | :146-153, 335-370; :113-128 | c02-nation-open |
| NC-6 Style pane | skin ×8, hair ×4 + colour ×4, foot (Permanent note), squad number −/+ with note | same | SAME | — | | :378-472; :133-160 | c03-style |
| NC-7 Step counter | "Step 1 of 2" for details and style, "Step 2 of 2" photo (Leo fixes off) | same | SAME | — | | :264; NewCareer.tsx:64 | c03 |
| NC-8 Photo: Add / Take a photo | work (file picker, live camera with oval guide, face scan, crop) | greyed out + "Your own photo comes to the phone app later: pick a face below for now." | FIXED (earlier): expo-image-picker (02e4b0d2) (was MISSING) | HIGH | needs expo-image-picker / camera | PortraitPicker.tsx:56-230; NewCareer.tsx:191-194 | c04-photo |
| NC-9 Photo: shirt tile, "Using your shirt", 7 faces | yes | yes | SAME | — | | PortraitPicker.tsx; NewCareer.tsx:176-214 | c04 |
| NC-10 Back / Continue | bottom of the screen on every step | pinned at the bottom (ScrollView above) | SAME | — | | ProfileSetup.tsx:514-549; NewCareer.tsx:166-169 | c03 |
| NC-11 Start Career | into the trial, clears match speed + coach flags | into the trial | SAME | — | | page.tsx:1120-1147; flow.ts:116 | c05-after-start |

## 3. The trial's wrapper (stages themselves: MATCH)

Stills: c05-after-start, c07-fk, c09-strikescreen, c10-scout-spotted-next. Packed: TrialSequence.tsx. KIB: screens/career/Trial.tsx:41-147.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| TR-1 Progress row | ✕ EXIT pill, five pips (green done / white now / grey), "2/5" | same | SAME | — | | TrialSequence.tsx:303-353; Trial.tsx:75-83 | c05 |
| TR-2 ✕ Exit | reloads → title | goes to title | SAME | — | | :317-335; Trial.tsx:77 | — |
| TR-3 Event banner | "TRIAL DAY · …" / "HEADS UP · …" + blurb, on the stage only | same | SAME | — | | :272-289; Trial.tsx:87-92 | c06 |
| TR-4 Between stages | "NEXT UP", stage name, 3-2-1 big green count with a pop-in (trialCount) animation | same words, no pop-in animation | FIXED (reasoned): the count pops in (PopIn) (was DIFFERENT) | LOW | | :389-400; Trial.tsx:115-121 | — |
| TR-5 "A scout has spotted you" | full screen, night stadium, drawn scout 224×192, 34 px title, line, pulsing "TAP TO CARRY ON"; card rises in (scoutIn) | same picture and words; no rise, no pulse | FIXED (reasoned): the card rises in, TAP TO CARRY ON pulses (was DIFFERENT) | LOW | | :373-388; Trial.tsx:100-112 | c10-scout-spotted-next |
| TR-6 Stand-in stage | — | a "Stand-in" note for the retired fiveASide stage (never reached) | SAME | — | | Trial.tsx:138-145 | — |
| TR-7 Page bg | radial green TrialPage | same gradient | SAME | — | | stages/TrialFrame.tsx; Trial.tsx:37 | c05 |
| TR-8 Pitch height | [border: MATCH] Trial.tsx:28 uses `Dimensions.get("window")` once | | DIFFERENT | LOW | does not follow window changes | Trial.tsx:28 | — |

## 4. Scout's talk, the offer, negotiate, other clubs

Stills: c11-scout-talk, c12-offer. Packed: ManagerTalk.tsx, ScoutOffers.tsx, NegotiationScreen.tsx. KIB: Trial.tsx:149-266, Moves.tsx:21.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| ST-1 Backdrop | night stadium photo; in the stills the stands and a green pitch are bright (the overlay looks unapplied) | same photo with the darkening overlay applied: stands dim, bottom near black | FIXED (reasoned): the dark wash now fades out by 62% of the height, as the packed still shows (bright stand and pitch below) (was DIFFERENT) | MED | | ScoutArt.tsx:17-32 (both) | c11-scout-talk |
| ST-2 "A SCOUT HAS SPOTTED YOU" pill | amber, kicks in (scoutKick) | same, no animation | FIXED (reasoned): the pill pops in (was DIFFERENT) | LOW | | ManagerTalk.tsx:89-93; Trial.tsx:167-171 | c11 |
| ST-3 Club badge + halo | 92 px badge, pulsing halo (scoutHalo 2.6 s) | 92 px badge, still halo | FIXED (reasoned): the halo pulses (was DIFFERENT) | LOW | | :96-100; Trial.tsx:172-176 | c11 |
| ST-4 Club name | Title component (steel-grey metallic, 28 px) | white Anton 28 px | FIXED (reasoned): club name in steel grey #cfd3d8 (React Native has no gradient text) (was DIFFERENT) | LOW | | :101; Trial.tsx:177 | c11 |
| ST-5 Scout card, lines one per tap, "TAP TO HEAR HIM OUT →" | yes | yes | SAME | — | | :108-135; Trial.tsx:180-195 | c12-offer |
| ST-6 THE OFFER card | ★35 a week, badge, line, ACCEPT & SIGN (+ NEGOTIATE / SEE OTHER CLUBS when not the story's first contract) | same | SAME | — | | :140-185; Trial.tsx:197-226 | c12 |
| ST-7 ⚙ settings | yes | yes | SAME | — | | :80-87; Trial.tsx:162 | c11 |
| ST-8 Rise-in animations | header, scout card and offer card rise in | none | PARTLY: pill and halo move; the scout and offer cards do not rise in (was MISSING) | LOW | | :191-200 | — |
| ST-9 Wage talk | NegotiationScreen (drawn negotiator face) | KIB Negotiation (😐 emoji) — see §14 TH-9 | FIXED (reasoned): drawn negotiator (draw/NegotiatorFace.tsx), card centred, dark Walk Away; world/Negotiation.tsx touched in 3 places (was DIFFERENT) | MED | | page.tsx:3955; Moves.tsx:21 | c41-negotiation |
| ST-10 Other clubs (ScoutOffers) | "The back page" cards per club, pitch quote, wage/bonuses/length, sign | plain Frame + Cards with the same rows | OPEN: MED: same rows, plain cards; not restyled (was DIFFERENT) | MED | | ScoutOffers.tsx; Trial.tsx:233-258 | — |

## 5. The signing, then the news

Stills: c13-signing, c14-signing-welcome-next, c15-news. Packed: TrialReward.tsx → SigningScene3DCareer (default) / SigningScene.tsx (drawn). KIB: Signing.tsx, Trial.tsx:261-288, NewsMoments.tsx:32.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| SG-1 Signing scene | 3D manager's office, 5 spoken lines ("Sit down, son. I watched every kick of that trial.") tap ›, SKIP | the packed app's drawn signing (two chairs, desk, contract, TAP TO SIGN) | LEFT OUT (Mikey) | — | | TrialReward.tsx:49-61; Signing.tsx | c13-signing |
| SG-2 Manager's name | from `career.manager.name` ("Henrik Ashcroft") | `loadLineup(club)?.manager` only → "The manager" for clubs with no lineup | FIXED (reasoned): career.manager.name first (was DIFFERENT) | MED | | page.tsx:4180; Trial.tsx:268 | c13 |
| SG-3 Drawn scene layout | top-aligned (pt-4) | centred vertically | OPEN: LOW: still centred (was DIFFERENT) | LOW | | SigningScene.tsx:291; Signing.tsx:197 | c14 |
| SG-4 Contract paper | tilted (rotateX 12°), SVG pen, pulsing "✕ sign here" | flat, 🖊️ emoji pen, still "✕ SIGN HERE" | PARTLY: the pen is drawn (no emoji); the paper is still flat (was DIFFERENT) | LOW | emoji pen | :335-400; Signing.tsx:213-240 | c14 |
| SG-5 Handshake cheer | confetti Burst (30) + "WELCOME TO / club" pops in | words only, no confetti, no pop | FIXED (reasoned): confetti burst and the words pop in (was MISSING) | MED | | :407-420; Signing.tsx:244-249 | c14-signing-welcome-next |
| SG-6 Continue / Signing… / Tap to sign | gold button 52 px | same | SAME | — | | :424-430; Signing.tsx:251-254 | c14 |
| SG-7 Loan signing | straight to LoanBrief (intro) | an extra "Signed" Frame with the contract table, then the loan brief | OPEN: LOW: the extra Signed frame on a loan stays (was DIFFERENT) | LOW | | page.tsx:4176-4199; Trial.tsx:270-287 | — |
| SG-8 Breaking News | full screen: red skewed band "• BREAKING NEWS", LIVE · KNOWITBALL NEWS 24, your face in a ring + badge, torn headline card, line, TAP TO CONTINUE, scrolling ticker (club tag + blurb) | same layout; ticker does not move; band ~20 px lower; face is the drawn head | FIXED (seen): the ticker runs (14 s a lap), the band sits at the top, your 3D headshot with the drawn head as fallback (was DIFFERENT) | MED | repeating-linear-gradient scanlines; Modal | BreakingNews.tsx:51-130; NewsMoments.tsx:32-95 | c15-news, c45-season2 |

## 6. Home — the frame (top bar, next match, tiles, league, player, boots, cans, arrows, bottom bar)

Stills: c23-home, c33-season-over-home, c46-after-news, s360-home, c31-after-duty. Packed: HomeHub.tsx (New), DashboardShell.tsx, ui/TopHud.tsx, MainBar.tsx. KIB: screens/Home.tsx, ui/look/TopBar.tsx, ui/look/BottomBar.tsx.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| H-1 Top bar | name, AGE, ★money, ?, ⚙; star badge with level; XP bar; ⚡ energy bar | same | SAME | — | | TopHud.tsx; TopBar.tsx | c23-home |
| H-2 Star Pass "!" | round "!" on the star when a reward waits | none | FIXED (reasoned): round ! on the star while a reward waits (ui/look/TopBar.tsx) (was MISSING) | MED | | TopHud.tsx; TopBar.tsx | c31, c33, c46 |
| H-3 Stadium | sky by kick-off, hoardings behind his knees | same | SAME | — | | HomeHub.tsx:350; Home.tsx:119 | c23 |
| H-4 Next match | NEXT MATCH, competition, crests + short names (you glow green), date, ⏱ days pill, last five | same | SAME | — | fixed 92 px | HomeHub.tsx:273-325; Home.tsx:187-236 | c23 |
| H-5 Season over line | "Season complete — the awards are next" + form | same | SAME | — | | Home.tsx:201-206 | c33 |
| H-6 Rep / Fame / Goals / Assists tiles | glass tiles with pictures, bars on Rep/Fame | same | SAME | — | fixed 66 px | HomeHub.tsx:562-602; Home.tsx:248-280 | c23 |
| H-7 League row | 🏆 PREMIER LEAGUE · 1st ▾, opens 5 rows + FULL TABLE › | same | SAME | — | | MiniLeague.tsx:83; Home.tsx:282-319 | c23 |
| H-8 On international duty | the row becomes "🏴 ON DUTY · JUNE 2027 ›" (NationDropdown) and Home is lit in the nation's colours | league row stays; club colours | PARTLY: the league row becomes ON DUTY · <window> › in the nation's colours with the drawn flag; Home is not relit in the nation's colours and the row does not open a group table (was MISSING) | MED | | HomeHub.tsx:179-196; IntlKit.tsx | c31-after-duty |
| H-9 Needs-you chip | "🏆 End of Season ›" (amber, chevron); "🗣️ Boss wants a word" | End of Season (no chevron), "📞 Your country's manager has named his squad", "🎓 Youth team: this week"; no Boss chip | FIXED (seen for End of Season; Boss chip reasoned): amber chip with the drawn chevron; Boss wants a word opens the manager's talk (was DIFFERENT) | MED | | HomeHub.tsx:228-271; Home.tsx:112-115 | c33-season-over-home |
| H-10 Your player | 3D player, celebrates (arms up) after a win once per match | 3D player on the phone (blank in the web build); no win celebration | OPEN: MED: no win celebration (needs a 3D clip on the Home player) (was MISSING) | MED | 3D crash guard | HomeHub.tsx:624-650; Home.tsx:128-131 | c23 |
| H-11 Hall chase line | 🏛️ chasing a Hall record (off in New: hallChase null) | — | SAME | — | | HomeHub.tsx:653 | — |
| H-12 Boots line | 👟 name, Pow/Tec, matches left / "No boots: buy a pair in the Shop" | same | SAME | — | | HomeHub.tsx:604-622; Home.tsx:321-337 | c16, c23 |
| H-13 KIB cans | three tiles, ×count, name, effect, USE / FULL / ✓, ★price | same | SAME | — | fixed widths; "Curve shots +30" wraps at 360 | HomeHub.tsx:672; Home.tsx:340-381 | s360-home |
| H-14 Can USE pop | "+65 ⚡" float + energy bar fill animation | bar jumps, no float | OPEN: LOW: no +65 float (was MISSING) | LOW | | HomeHub.tsx CanTile | — |
| H-15 ‹ STATS / SHOP › | swipe pages with arrows; Stats and Shop locked on a new career ("Stats is locked · Score your first goal", "Shop is locked · After your third game") | arrows + swipe, never locked | FIXED (seen): Stats and Shop open a locked page: lock, 'Stats is locked', 'Score your first goal' (was DIFFERENT) | HIGH | | page.tsx SwipePages; Home.tsx:101-110, 147-150 | c15-news (packed text), c16 |
| H-16 "HOME 🏠 ›" hint on Stats | swipe hint at the bottom of the Stats page | none | FIXED (seen): HOME 🏠 ▶ under the Stats page (was MISSING) | LOW | | StatsTabs.tsx | c24-stats |
| H-17 Bottom bar | League · Training (⚡n) · Home · Phone (n) · round PLAY | same | SAME | — | | MainBar.tsx; BottomBar.tsx | c23 |
| H-18 Bar locks | 🔒 small on locked tabs; tapping shows a 🔒 note toast above the bar | 🔒 on the tab; no note toast | FIXED (seen): the bar's lock is the drawn padlock; the lock note was already there (was DIFFERENT) | MED | | page.tsx:5596-5600; BottomBar.tsx:70-73 | c17-tour1 |
| H-19 PLAY "today" glow | glows on match day (`matchInDays <= 0`) | never (`matchInDays: null`) | OPEN: LOW: PLAY does not glow on match day (was MISSING) | LOW | | needsYou.ts:78; BottomBar.tsx:61 | — |
| H-20 Phone unread count | phoneUnreadCount | own count from Messages (equal in these saves) | SAME | — | | BottomBar.tsx:48-58 | c23 |
| H-21 Entry animation | NextMatch and tiles rise in each time Home becomes the page | none | FIXED (reasoned): the next match and the four numbers rise in (was MISSING) | LOW | | HomeHub.tsx:195-197 | — |
| H-22 After a match lands on | Home page (Mikey 17 Nov) | Home | SAME | — | | page.tsx:1985 | — |
| H-23 Fit at 360×780 | fits | fits | SAME | — | | | s360-home |

## 7. Home — pop-ups, story beats, tours

Stills: c15-news, c16-home-first, c17-tour1, c18-tour-play. Packed: page.tsx:5384-5620, UnlockChain.tsx, PointerTour.tsx, lib/star/story.ts, lib/star/tours.ts. KIB: Home.tsx:76-161, StoryBeat.tsx, ui/tour.tsx, Moments.tsx:134.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| P-1 Team-mate's boots beat | "WILSON, YOUR TEAM-MATE · Have my old boots", NS-Pure card, Thanks! | same (fixed since the findings) | SAME | — | Modal | UnlockChain.tsx:190; StoryBeat.tsx:24 | c16-home-first |
| P-2 Welcome tour | energy bar, then "Your first game is next… Tap Play" pointing at PLAY | same two steps | SAME | — | Modal | page.tsx:5391; Home.tsx:84 | c17, c18 |
| P-3 Pointer hand | white drawn hand | yellow 👆 emoji | FIXED (seen): the white glove, drawn with views, bobbing (was DIFFERENT) | LOW | emoji | PointerTour.tsx; ui/tour.tsx | c17-tour1 |
| P-4 Other beats (gaffer "Time to train", club shop half-price can, physio free can, team-mate's phone, chairman wages, first goal, Star Pass, agent's sponsor) | in story.ts, shown on Home | same beats from story.ts | SAME | — | | story.ts; StoryBeat.tsx | — |
| P-5 Beat "boss" | opens the manager's relationship game | button does nothing beyond closing (goBeat returns {}) | FIXED (earlier): goBeat('boss') opens the manager's game (was MISSING) | HIGH | | page.tsx:5458; StoryBeat.tsx:67-80 | — |
| P-6 Beat "sponsor" | opens the Phone + 2-step pointer: Messages → the offer | opens the Phone only | FIXED (earlier): Phone → Messages → the offer (was DIFFERENT) | MED | | page.tsx:5470-5476; StoryBeat.tsx:79 | — |
| P-7 Beat "stats" | wordless pointer with a swipe-right gesture to your card | opens Stats directly | FIXED (reasoned): the glove swipes right; a swipe or a tap opens your card (was DIFFERENT) | LOW | | page.tsx:5469; StoryBeat.tsx:78 | — |
| P-8 Beat "shop" | shop-kib | `shop` | SAME | — | | page.tsx:5466; StoryBeat.tsx:77 | — |
| P-9 Mechanic guides | "New in your game" beat (e.g. headers, "Try a header now" / Later) | none | FIXED (reasoned): 'New in your game' with 'Try a header now' / Later (was MISSING) | MED | | page.tsx:5566-5578 | — |
| P-10 Training tour / training-day pointer / one-more-drill | yes | none | FIXED (seen): training-day pointer (Power, then Technique, then the glove on Home), the Training tour, one more drill, 'tap level 1' (was MISSING) | HIGH | | page.tsx:5393-5401; tours.ts | — |
| P-11 League-opens tour, first-game tour | yes | none | FIXED (reasoned): league-opens and first-game tours (the old order's saves) (was MISSING) | MED | | page.tsx:5402-5406 | — |
| P-12 Boss tour, boss-meeting tour, Relations tour | yes | none | FIXED (reasoned): boss tour, relations tour, boss-meeting pointer (was MISSING) | MED | | page.tsx:5409-5421 | — |
| P-13 Shop tour (phone price / "★N more") and Phone tour | yes | none | FIXED (reasoned): the phone step: swipe left to the Shop, or the price and how much more; 'Your phone is open' (was MISSING) | MED | | page.tsx:5426-5438 | — |
| P-14 First visit tours (Stats, Shop, Phone) | open by themselves the first time | none | FIXED (reasoned): first-visit tours of Stats, Shop and Phone (one host over every screen) (was MISSING) | MED | | page.tsx:5441-5443 | — |
| P-15 "?" on Home | replays HELP_TOURS.home on the live Home | same | SAME | — | | page.tsx; Home.tsx:121 | — |
| P-16 "?" on other screens | that screen's own tour | opens the Help list page | FIXED (seen on Home and Training): ? replays the screen's tour on the live screen; the help list page is gone (was DIFFERENT) | MED | | page.tsx:4781-4787; kit.tsx:80 | — |
| P-17 Achievement pop (chain / earned / record broken) | big card "ACHIEVEMENT UNLOCKED" / "RECORD BROKEN", star, "See all achievements", Close | none (only the toast list below) | PARTLY: the small banner (ACHIEVEMENT UNLOCKED / RECORD BROKEN) for the first-step pops; Hall of Fame record-broken pops are not raised (the phone has no hall records feed); the phone's 'New phone' moment is the world Shop's (was MISSING) | MED | | UnlockChain.tsx:72-128 | — |
| P-18 Achievement toasts | "ACHIEVEMENT 2 OF 3 · GOLD", tier medal, timer bar, slides up, then the star bar | plain card: 🏅 label + description list, optional star bar | FIXED (seen): 'ACHIEVEMENT 2 OF 2 · GOLD', medal, star bar, timer line, low on the screen (was DIFFERENT) | MED | | UnlockChain.tsx:241-294; Moments.tsx:155-175 | c45-season2 (packed text) |
| P-19 UnlockPop | "Unlocked · Coming up · See all achievements" | none | FIXED (reasoned): Unlocked · <feature> · See all achievements · Close (was MISSING) | MED | | UnlockChain.tsx:158-189 | — |
| P-20 SlotQuestion | "First steps done · Switch this button to League? · Yes, League / Keep it" | none | SAME: retired in the game itself: slotQuestionDue() always returns false, so the packed app never shows it (was MISSING) | LOW | | UnlockChain.tsx:296-321 | — |
| P-21 Star rating milestone | "STAR RATING ★n · title · Continue" | same | SAME | — | Modal | page.tsx:5601-5610; Moments.tsx:142-152 | — |
| P-22 "▲ Star rating up" strip | green pulsing strip | green strip, 3 s | SAME | — | | page.tsx:5615; Moments.tsx:157-160 | — |
| P-23 EnergyBackToast | "+n energy back" after the rest days | none (energyBack kept in the report, not shown) | FIXED (seen): ⚡ +12 energy (rest days), 3.2 s, under the league row (was MISSING) | MED | | EnergyBackToast.tsx; session.ts:31 | — |
| P-24 Set-piece talk | ManagerChat: the manager says which set pieces are yours | none | FIXED (reasoned): the manager's set-piece word, one line a tap (was MISSING) | MED | | page.tsx:5548-5555 | — |
| P-25 Manager news | "In the dugout" banner (or office moment) with ✕ | none on Home (only a feed post) | FIXED (seen): In the dugout banner with ✕ (was MISSING) | HIGH | | page.tsx:5621-5645; flow.ts:763 | — |
| P-26 Made captain | CaptainInOffice (plain card when no 3D office) | none | FIXED (seen): THE ARMBAND: the manager's line, CONTINUE → (was MISSING) | MED | | page.tsx:5646-5648; ManagerMoments.tsx | — |
| P-27 Player of the Month | full screen: rays, confetti, "YOU WON IT" with a shine, the month's card (face, club, month, goals · assists), gold OK with Shine | full screen with the same card and words; no confetti, no shine; rays use repeating-conic-gradient | FIXED (reasoned): confetti added; the gold shine on the words is not (was DIFFERENT) | MED | conic gradient not drawn; Modal | PotmWinModal.tsx:64-120; NewsMoments.tsx:97-141 | — |
| P-28 Order of pop-ups | tour → news → set-piece → unlock → beat → mechanic → slot → achievements → energy | PotM → news → tour → beat | FIXED (reasoned): unlock pop → energy toast → tour → beat → set-piece word → new-in-your-game (was DIFFERENT) | LOW | | page.tsx:5539-5616; Home.tsx:153-161 | — |

## 8. Energy / fitness

Stills: c32-low-energy. Packed: page.tsx low-energy gate, TopHud. KIB: PreMatch.tsx (low energy box), Training.tsx (Rest).

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| E-1 Low energy gate | "⚡ LOW ENERGY", red bar with the number inside, PLAY ANYWAY, ‹ BACK; card in the upper third | same words; number right of the bar; card centred | OPEN: the pre-match screen is the match builder's (was DIFFERENT) | LOW | | page.tsx (pre-match); PreMatch.tsx | c32-low-energy |
| E-2 Can offer at low energy (story) | physio beat "One on the house" | in story.ts beats | SAME | — | | story.ts | — |
| E-3 Rest | in Relations (Phone) "Rest" | a REST card under the Training list too | OPEN: kept on purpose: it is the phone's only Rest (was DIFFERENT) | LOW | | RelationsPage.tsx; Training.tsx | c26-training |
| E-4 Energy back after rest days | toast | none (see P-23) | FIXED (seen): see P-23 (was MISSING) | MED | | | — |

## 9. Stats (card + tabs: Stats, Records, Achievements, Contract)

Stills: c24-stats, c25-stats-records, c25-stats-achievements, c25-stats-contract. Packed: StatsTabs.tsx, DashboardStats.tsx, SecondaryScreens.tsx. KIB: screens/career/Stats.tsx, PlayerCard.tsx.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| S-1 Player card | bronze card, 58 ST, flag, badge, full figure (shirt + body), six stats | same card; head-and-shoulders drawing | OPEN: LOW (was DIFFERENT) | LOW | | StatsTabs.tsx; PlayerCard.tsx | c24-stats |
| S-2 Tab buttons | 📊 STATS · 🏅 RECORDS · ⭐ ACHIEVEMENTS · 📝 CONTRACT, yellow when on | same | SAME | — | | | c24 |
| S-3 Stats tab | THIS SEASON tiles (career below), SEASON BY SEASON table, THE CABINET, GOALS & ASSISTS chart, PER CLUB, INTERNATIONAL | same blocks | SAME | — | | DashboardStats.tsx; Stats.tsx | c24 |
| S-4 How Stats opens | swipe right from Home (page 0 of the swipe pages) | a pushed screen (◀ STATS or swipe) | OPEN: LOW: Stats is still a pushed screen (was DIFFERENT) | LOW | | page.tsx SwipePages; Home.tsx:101 | — |
| S-5 Records | collapsible "▾ YOUR BESTS" + "Furthest goal/assist and match bests start counting from now on this save." | no chevron, no line; also lists Caps and "REAL-WORLD RECORDS · 0 BEATEN" | OPEN: LOW: records list not folded (was DIFFERENT) | LOW | | StatsTabs.tsx; Stats.tsx | c25-stats-records |
| S-6 Achievements | ring "1/67 · 1% DONE", Bronze/Silver/Gold/Legend bars, chips All/Completed/Not completed/Nearly there, medal grid by group ("GETTING STARTED 1/5") | "1 OF 67 UNLOCKED" and a plain list with locks | FIXED (seen): ring, four tier bars, Nearly there, chips, medals by group, detail sheet (was DIFFERENT) | MED | | SecondaryScreens.tsx AchievementsScreen; Stats.tsx | c25-stats-achievements |
| S-7 Contract | paper "PROFESSIONAL CONTRACT", "between the club and Look Check", rows, CLAUSES, two handwritten signatures, "PROPOSE RENEWAL" yellow | white card, rows, "Clauses: None.", italic name, "ASK FOR A NEW DEAL" green | FIXED (seen): PROFESSIONAL CONTRACT paper, both signatures, PROPOSE RENEWAL (green, as the packed still) (was DIFFERENT) | MED | | StatsTabs.tsx; Stats.tsx | c25-stats-contract |
| S-8 Wage format | ★6k / week | ★6,336 / week | FIXED (seen): ★6k / week (was DIFFERENT) | LOW | | | c25-stats-contract |
| S-9 History / trophies (all seasons) | in the Stats tab (season table, cabinet) and TrophiesScreen | in the Stats tab | SAME | — | | page.tsx:5118 | c24 |

## 10. Training list and locks (the drills: MATCH)

Stills: c26-training, c27-levels. Packed: SkillsScreen.tsx, TrainingLevelSelect.tsx, TrainingIntro.tsx. KIB: Training.tsx.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| TN-1 Page | the pitch-green page (PitchScope) under the HUD | blue blurred stadium | FIXED (earlier): pitch-green page (was DIFFERENT) | MED | | page.tsx:5496; Training.tsx | c26-training |
| TN-2 Header | "TRAINING" + ⚡ pips for sessions left | same | SAME | — | | SkillsScreen.tsx; Training.tsx | c26 |
| TN-3 Six skill rows | icon, name, rating, ★0/90, coloured bar | same | SAME | — | | | c26 |
| TN-4 Locked skill | dimmed + "Opens after your third game" | dimmed; lock words missing on some (findings #38) | FIXED (earlier): 'Opens after your third game' (was DIFFERENT) | LOW | | | — |
| TN-5 REST card | not here | here | OPEN: see E-3 (was DIFFERENT) | LOW | | Training.tsx | c26 |
| TN-6 Training locked (story) | 🔒 tab + LockedPage "Training is locked · After your first game" | 🔒 tab | OPEN: LOW: the bar's lock note says it; no locked page for Training (was DIFFERENT) | LOW | | UnlockChain.tsx:50 | — |
| TN-7 Level select | green page; header card: icon, name, description, RATING, ★ bar, "Level 1 is next"; 30 tiles 5×6 each with three stars; BACK pill | blue blur; "TRAINING / POWER" + round back; tiles with a lock only (first: "1 ☆☆☆") | FIXED (seen): BACK pill, TRAINING, the lit card (icon, name, line, RATING, ★ n/90, Level n is next, bar), 5×6 tiles with three stars (was MISSING) | HIGH | | TrainingLevelSelect.tsx; Training.tsx | c27-levels |
| TN-8 Drill how-it-works card | "HOW IT WORKS · Power", 3 steps, "3 tries: 1st ★★★ …", Got it | [border: MATCH] see CAREER-FINDINGS #40 | MISSING | MED | | TrainingIntro.tsx | — |
| TN-9 After a drill | "+2 POWER" pop on the row; XP bar fills | none (findings #73) | OPEN: LOW (was MISSING) | LOW | | | — |

## 11. International call-ups

Stills: c30-season-over, c31-after-duty. Packed: CallUpScreen.tsx, IntlKit.tsx, TournamentScreen.tsx. KIB: Misc.tsx:39-75, Roundups.tsx:241.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| I-1 Opens by itself | Home effect opens it while periodDue (also after the last league match) | same (Home.tsx:66-72) | SAME | — | | page.tsx:1051; Home.tsx:66 | c30 |
| I-2 Page | dark page with two spotlights, the nation's big flag, "CALLED UP" (huge), lines | blue blur, small kicker + title, no flag | FIXED (seen): night stadium, big flag, CALLED UP in the heavy font (was DIFFERENT) | HIGH | | CallUpScreen.tsx; Misc.tsx:49-75 | c30-season-over |
| I-3 Matches card | "ENGLAND'S MATCHES · 1 MATCH", date · competition · round, flags each side | plain rows "Netherlands v England · 10 Jun" | FIXED (seen): date · competition · round, a flag each side, 1 MATCH (was DIFFERENT) | MED | | IntlKit.tsx; Misc.tsx:67-71 | c30 |
| I-4 Manager card | England flag, "England manager", line, big number "6 · NOT PICKED", bar with SQUAD 34 / STARTER 55 marks | "THE MANAGER'S VIEW 6 / 100" + a plain bar | FIXED (seen): flag, line, 6 · NOT PICKED, bar with SQUAD 34 / STARTER 55 (was DIFFERENT) | MED | | IntlKit.tsx; Misc.tsx:62-66 | c30 |
| I-5 Threshold number | "picked at about 87" | "picked at about 81" (same save) | FIXED (seen): 'about 87': the decision is worked out again when the real squads land (it was frozen before they had loaded) (was DIFFERENT) | MED | | lib/star/intl/career.ts decide() | c30 |
| I-6 REPORT FOR DUTY → | yellow, under the cards | green, pinned at the bottom | FIXED (seen): gold, under the cards (was DIFFERENT) | LOW | | | c30 |
| I-7 Not selected | "Not picked", "Left out of the England squad." | same words | SAME | — | | | — |
| I-8 Watched on TV | WatchedScreen (IntlKit): crests, score, scorers | "On TV · England v X", score only | FIXED (reasoned): flags, score, WIN/DRAW/DEFEAT, manager card; no scorers, group table or results board (was DIFFERENT) | MED | | IntlKit.tsx WatchedScreen; Misc.tsx:39-47 | — |
| I-9 Tournament table | TournamentScreen progress: group table / road | TournamentTableScreen | OPEN: LOW (was DIFFERENT) | LOW | | TournamentScreen.tsx; Roundups.tsx:241 | — |

## 12. Contract renewal

Stills: c47-renewal. Packed: ManagerMoments.tsx ContractInOffice → SecondaryScreens.tsx ContractRenewal (:300-500). KIB: Misc.tsx:77-167.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| CR-1 Office moment first | 3D office: the boss says the reason line | — | LEFT OUT (Mikey) | — | | ManagerMoments.tsx:63-72 | — |
| CR-2 Layout | centred card on the club-glow page | top-aligned Frame | FIXED (reasoned): centred (was DIFFERENT) | MED | | SecondaryScreens.tsx:373; Misc.tsx:110 | c47-renewal |
| CR-3 Not willing | 📝 big, "Not interested…", BACK | same words, 📝 inline | FIXED (reasoned): big 📝, centred (was DIFFERENT) | LOW | | :388-398; Misc.tsx:111-117 | c47 |
| CR-4 Willing intro | reason chip (📈 form / ⭐ star), rules line, current terms, Decline offer / Not now + pulsing Start negotiation | same words, no pulse | SAME | — | | :400-437; Misc.tsx:118-133 | — |
| CR-5 Higher-or-lower | big cards flip in, +12% / −% float text, confetti on a win, shake on a loss | cards, no flip, no float text, no confetti, no shake | PARTLY: the next card pops in; no float text or shake (was DIFFERENT) | MED | | :440-480; Misc.tsx:135-160 | — |
| CR-6 Signed | "SIGNED" stamp + confetti before leaving | leaves straight away | FIXED (reasoned): SIGNED stamp and confetti, 0.9 s (was MISSING) | MED | | :375-381 | — |
| CR-7 Season-end renewal (seasonsRemaining 0) | opens after the rollover | same (flow.ts:779-782) | SAME | — | | page.tsx:2167 | — |
| CR-8 Early offer after a match | checkForContractOffer | same | SAME | — | | page.tsx:1972; flow.ts:631 | — |

## 13. Between matches: round-ups [partly border: WORLD]

Packed: DeadlineDayRoundup.tsx, KnockoutRoundup.tsx, PlayOffRoundup.tsx, CupDrawReveal.tsx. KIB: Roundups.tsx, world CupDrawReveal. Not reached in the stills this round (from code).

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| R-1 Order after a match | deadline day → knockout round-up → tournament table → cup draw → play-off round-up → Home / call-up / contract | same order | SAME | — | | page.tsx:1834-1985; flow.ts:571-640 | — |
| R-2 Deadline Day | outlined gold title, club-by-club incomings/outgoings with crests | Frame list | OPEN: MED: not restyled (was DIFFERENT) | MED | | DeadlineDayRoundup.tsx; Roundups.tsx:68 | — |
| R-3 Knockout round-up | results board, bracket from the last 16, league-phase table | Board + BracketList + StageCard | OPEN: LOW (was DIFFERENT) | LOW | | KnockoutRoundup.tsx; Roundups.tsx:188 | — |
| R-4 Play-off round-up | drawn bracket | list | OPEN: MED: list, no drawn bracket (was DIFFERENT) | MED | | PlayOffRoundup.tsx; Roundups.tsx:201 | — |
| R-5 Cup draw | [border: WORLD] | | | | | | — |

## 14. End of season: Golden Ball, transfer window, signing, awards

Stills: c33-season-over-home, c34-golden-ball-1, c35-gb-5s, c37-after-gb, c38-club-list, c40-negotiate, c41-negotiation, c43-after-deal, c44-awards, c45-season2. Packed: BallonDorNight.tsx, BallonDor.tsx, TransferHub.tsx, NegotiationScreen.tsx, TransferSigning.tsx, SeasonAwardsScreen.tsx. KIB: Ceremonies.tsx, world TransferHub.tsx, Negotiation.tsx, glue.tsx:62, SeasonEnd.tsx.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| GB-1 "End of Season" → | Golden Ball night (reel off) | same | SAME | — | | page.tsx:1799; flow.ts:683 | c34 |
| GB-2 The ceremony | 3D stage: nominees walk up, crowd heads, captions "FROM ARSENAL… LOOK CHECK!", SKIP › | the packed app's drawn stage (podiums, host, trophy), CONTINUE › | LEFT OUT (Mikey) | — | | BallonDorNight.tsx; Ceremonies.tsx:178-395 | c34-golden-ball-1 |
| GB-3 Result page | YOUR FINISH medal, YOUR SEASON, trophies, WINNER, FINAL TOP 10 with faces, Continue → | same | SAME | — | | BallonDor.tsx; Ceremonies.tsx:397 | c35-gb-5s |
| GB-4 "Includes 1 goals…" | "1 goals" grammar | same | SAME | — | | | c35 |
| GB-5 Golden Ball music / confetti on a win | gameMusic + gold light + confetti | confetti Burst in Ceremonies | SAME | — | | | — |
| TH-1 Transfer window | yellow/black page, B grade card, season stats, LEAGUE / CLUB rows, ticker, ✕ STAY / ✓ NEGOTIATE | same | SAME | — | | TransferHub.tsx; world/TransferHub.tsx | c37-after-gb |
| TH-2 Stacked copies | — | the entry animation leaves 5 copies of the title, count, grade and hint in the page (seen in text) | OPEN: world file (was DIFFERENT) | LOW | screen readers; extra renders | world/TransferHub.tsx | c37 |
| TH-3 Club list | rows ~88 px, Anton club names, keenness bars, "Finished 2nd" | rows ~78 px, Roboto bold names | OPEN: world file (was DIFFERENT) | LOW | | | c38-club-list |
| TH-4 Picked club card | quote, contract, club gets, wage now, finished | same | SAME | — | | | c40-negotiate |
| TH-5 Talks | drawn negotiator face, SETTINGS, card centred, Walk Away dark brown | 😐, no settings, card at top, Walk away red full width | FIXED (reasoned): see ST-9; no SETTINGS button (was DIFFERENT) | MED | emoji | NegotiationScreen.tsx; world/Negotiation.tsx | c41-negotiation |
| TH-6 Deal agreed → signing | 3D office signing with the new manager ("UNAI EMERY · MANAGER", 5 lines) | drawn signing, "U. Emery" plate | LEFT OUT (Mikey) | — | | TransferSigning.tsx; glue.tsx:62 | c43-after-deal |
| TH-7 Relegation move | RelegationMove offers | RelegationMoveScreen | OPEN: LOW (was DIFFERENT) | LOW | | RelegationMove.tsx; Moves.tsx:45 | — |
| SA-1 Season awards | gold "SEASON AWARDS" with light rays | white Anton title | OPEN: LOW (was DIFFERENT) | LOW | | SeasonAwardsScreen.tsx; SeasonEnd.tsx:24 | c44-awards |
| SA-2 Trophy tiles | 2 columns, cup picture, winner badge (initials when the logo is missing) | 2 columns, cup picture, real crest; 🏆 for the shields (packed 🛡️) | OPEN: LOW (was DIFFERENT) | LOW | | | c44 |
| SA-3 Award cards | Golden Boot, Assist King, Golden Glove, PotS, YPotS with face, badge, number | same | SAME | — | | | c44 |
| SA-4 Team of the season | 4-3-3 drawn with crests | list "GK · David Raya" | FIXED (reasoned): 4-3-3 on a pitch with heads and crests (was DIFFERENT) | MED | | | c44 (text) |
| SA-5 "🌍 Every league and cup" | button | button | SAME | — | | | c44 |
| SA-6 CONTINUE | at the end of the scroll | pinned at the bottom over the cards | OPEN: LOW (was DIFFERENT) | LOW | | | c44 |
| SA-7 Season 2 Home | news "YOUNGSTER SIGNS FOR VILLA", achievement toasts | news on Home | SAME | — | | | c45-season2, c46-after-news |
| SA-8 Player of the Month | see P-27 | | | | | | — |

## 15. Not in the first team: youth, loan, free agent

Stills: c56-youth. Packed: YouthTeam.tsx, LoanBrief.tsx, FreeAgentShell.tsx. KIB: Youth.tsx.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| Y-1 Way in | Home stays the normal Home (story beats, tour); PLAY → the youth week | resume lands on the youth screen; Home has "🎓 Youth team: this week" | OPEN: MED: the flow lands on the youth screen (was DIFFERENT) | MED | | page.tsx:4051-4084; flow.ts:262 | c56-youth |
| Y-2 Youth page | dark charcoal; "Look Check / YOUTH TEAM · AFC TOTTON / NATIONAL LEAGUE SOUTH" left + SETTINGS button | blue blur; centred kicker + big name; "Settings" link at the bottom | FIXED (reasoned): navy page, name / YOUTH TEAM · CLUB / league on the left, SETTINGS on the right (was DIFFERENT) | MED | | YouthTeam.tsx; Youth.tsx:48-135 | c56 |
| Y-3 Youth content | bank / wage / this week, where you ended up, progress 0/100, you vs level bars, this spell, THE WEEK (6 buttons), PLAY THE YOUTH MATCH → | same words and blocks | SAME | — | | | c56 |
| Y-4 Loan brief (intro + weekly) | LoanBrief | LoanBriefScreen (same words) | SAME | — | | LoanBrief.tsx; Youth.tsx:233 | — |
| Y-5 Free-agent life | FreeAgentShell (home, gym, video games, mates) | FreeAgentScreen (same words, from code) | SAME | — | | FreeAgentShell.tsx; Youth.tsx:137 | — |
| Y-6 Injuries | no separate injury screen in the frame (injury lines inside call-up / match) | same | SAME | — | | | — |

## 16. The end: final season, final whistle, farewell, overview, Hall of Fame

Stills: c50-retirement, c51-farewell-invite, c52-farewell-sheets, c53-walkout-3s, c54-walkout-8s, c55-after-skip. Packed: CareerEnd.tsx, Farewell.tsx, LineupIntro.tsx, CareerOverview.tsx, LegendShare.tsx, hallOfFame.ts. KIB: SeasonEnd.tsx:124-169, Farewell.tsx, three/Farewell3D.tsx.

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| FW-1 Final season notice | FinalSeasonNotice (season before the last) | FinalSeasonScreen (from code) | FIXED (reasoned): FINAL / SEASON in the same shell as the final whistle (was DIFFERENT) | LOW | | CareerEnd.tsx; SeasonEnd.tsx:124 | — |
| FW-2 The final whistle | dark page, red top glow, gold "20 SEASONS" pill, rays, "THE FINAL" white / "WHISTLE" gold (2 lines), season track, dark "A CAREER IN THE GAME" card, yellow full-width HANG THEM UP | blue blur, "THE FINAL WHISTLE" one white line, glass cards, green button | FIXED (seen): pill, rays, THE FINAL / WHISTLE, season track, A CAREER IN THE GAME, yellow HANG THEM UP bar (was DIFFERENT) | MED | | CareerEnd.tsx FinalWhistle; SeasonEnd.tsx:141 | c50-retirement |
| FW-3 Farewell invite | "ONE LAST GAME" pill, "YOUR FAREWELL / MATCH" (gold MATCH), club line, CHECK XI and RIVALS XI as 22 face circles with names, three rule tiles, bottom bar SKIP / PLAY IT | title one line, the XIs as comma lists in cards, tiles, SKIP / PLAY IT buttons | FIXED (seen): 22 face circles (drawn heads), why-lines, three rule tiles, SKIP / PLAY IT bar (was MISSING) | HIGH | | Farewell.tsx FarewellInvite; Farewell.tsx:47-76 | c51-farewell-invite |
| FW-4 Farewell team sheets | the match's line-up screen: both XIs on a drawn pitch with faces and flags, formation, SUBSTITUTES +7, KICK OFF | three text cards (XI, Bench, Rivals), KICK OFF | FIXED (seen): the match's own line-up screen with both XIs, flags, SUBSTITUTES +7, KICK OFF (no countdown) (was MISSING) | HIGH | | page.tsx:4600; Farewell.tsx:94-105 | c52-farewell-sheets |
| FW-5 Guard of honour | 3D: you walk out of the tunnel between both teams clapping, "THE FAREWELL · GUARD OF HONOUR", KICK OFF › | crash: "Something went wrong · Requiring unknown module 7084" (web build); no fallback | FIXED (earlier): 606a37e5: one bundle, drawn version on any fault (was MISSING) | HIGH | lazy import(); verify on device | Farewell.tsx GuardOfHonour; three/Farewell3D.tsx:126 | c54-walkout-8s |
| FW-6 Farewell match | [border: MATCH] | | | | | | — |
| FW-7 Standing ovation | 3D greetings/claps at 85' | three/Farewell3D.tsx:204 startOvation (same lazy import) | FIXED (earlier): as FW-5 (was DIFFERENT) | HIGH | same as FW-5 | Farewell.tsx StandingOvation | — |
| FW-8 Farewell full time | FarewellResult | FarewellResultScreen: score, scorers, goals/assists/rating, "Off at 85'", testimonial, 🥾 Hang them up (from code) | FIXED (reasoned): same shell: score, scorers, three numbers, ovation line, testimonial (was DIFFERENT) | MED | | Farewell.tsx FarewellResult; Farewell.tsx:114-146 | — |
| FW-9 Career overview | tab strip Life · Career · Seasons · Who won · Clubs · Trophies · Records; "CAREER OVER · 20 SEASONS"; steel name; LEGACY ring (9); gold "A CAREER IN THE GAME"; SHARE PICTURE / SHARE LINK; tiles; THE JOURNEY; chart with 👑; best season; THE CABINET; bottom bar HALL OF FAME · NEW CAREER · MENU | one list: kicker, title, tiles, CLUBS, SEASON BY SEASON, RECORDS; bottom Hall of Fame · + New career · ☰ Menu; achievement card over the top | FIXED (seen): tab strip, pill, steel name, LEGACY ring, gold verdict, six numbers, journey, chart with 👑, best season, cabinet; HALL OF FAME · NEW CAREER · MENU (was MISSING) | HIGH | | CareerOverview.tsx; Farewell.tsx:148-214 | c55-after-skip |
| FW-10 Share picture / link | LegendShare.tsx | none | PARTLY: SHARE sends the career's words through the phone's share sheet; the picture needs react-native-view-shot (not installed) and the link needs the website's share API (was MISSING) | MED | needs a share sheet | LegendShare.tsx | c55 |
| FW-11 Hall of Fame entry | addToHall on retirement; the overview links to it | world/hall.ts entry, link | SAME | — | | page.tsx; world/hall.ts | — |
| FW-12 Hall of Fame browsing | [border: WORLD] | | | | | | — |

## 17. Dilemmas, press, life events

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| D-1 Dilemmas | turned off (page.tsx:1980) | turned off (flow.ts:937) | SAME | — | | | — |
| D-2 Press conference | turned off (page.tsx:1836) | turned off (flow.ts:936) | SAME | — | | | — |
| D-3 Relationship games, advert shoot | [border: WORLD] | | | | | | — |

## 18. 3D and other left-out rooms

| Element | Packed | KIB Next | Status | Sev | Android risk | Files | Stills |
|---|---|---|---|---|---|---|---|
| L-1 3D garden, house, 3D shop, 3D training | yes | none | LEFT OUT (Mikey) | — | | page.tsx:5119-5145, 4861, 4981 | — |
| L-2 3D manager's office (signing, contract, news, captain) | yes | drawn signing / plain cards (where present) | LEFT OUT (Mikey) | — | | ManagerMoments.tsx; TrialReward.tsx | c13 |
| L-3 3D Golden Ball stage | yes | drawn stage | LEFT OUT (Mikey) | — | | | c34 |
| L-4 Casino | none in the packed app | none | SAME | — | | page.tsx:3606 | — |
