# Navigation research: the best flow and place for everything

Date: 21 Oct 2026. Branch: Harry. Research only. No code changed, nothing committed.
Asked by Harry: "research the best navigation for our ui system, what's the optimal idea for the flow and place of everything".
Scope: the New UI (`app/star-dev/page.tsx` and `components/star/`). The Old UI (`components/star/legacy`) was not touched.

How each claim is marked:
- **[code]** I read it in the code.
- **[seen]** I saw it on a 390x844 phone screenshot from the real game (dev server, signed out, Hednesford, season 1, every unlock opened). Pictures are in `docs/research/2026-10-21-navigation/`.
- **[source]** I read it on a web page this session (link given).
- **[memory]** From my own knowledge of the game. Not checked this session. Treat as a hint, not a fact.
- **[reasoned]** My own conclusion.

---

## 1. Summary (plain English)

**The short answer.** Our bar at the bottom is already good. Do not rebuild it. The trouble is what sits behind it.

**What is right today**
- Five buttons: League, Training, Play, Relations, Phone. Play is big and in the middle. [seen, code]
- 13 of the 15 places on Harry's list are one or two taps from Home. [code, counted below]
- Taps open at once, with no slide. That matches Harry's 14 Oct rule. [code]

**What is wrong today (the real problems)**
1. **"Back" does not go back.** Open Ownership from the Phone, press Back, and you land on Home, not the Phone. The same happens with Sponsors, Casino, Trophies and Achievements. [code]
2. **Eight different Back buttons.** "← Back", "← Home", "‹ Back", a round "‹", a bottom-bar "Back", "Menu", "Close phone", and the house icon. [code]
3. **The house icon lies.** It goes Home from every screen. On Home it opens the main menu instead. [code]
4. **Most screens lose the bottom bar.** Only Home, Training, Relations and Phone keep it. About 40 other screens take over the whole phone, and some have only a Back button and no energy bar (Ownership). [code, seen]
5. **The Phone is a dumping ground.** 14 apps. Three of them are copies of things that already have a home (League, Fixtures, Settings). [code, seen]
6. **Two places have no door.**
   - Transfers: there is no way to open it. It only appears by itself at the end of a season. [code]
   - Career overview: while you play, it takes 4 taps through Stats. It is only a real screen after you retire. [code]
7. **Nothing says "this needs you".** One red dot on the Phone. A small count on Sponsors. Nothing on Training, Relations or League. [code]
8. **Stats and Shop hide behind swipes.** They are pages beside Home with tiny arrows. [code, seen]

**What I recommend (my pick): "Same bar, clear rooms"**
- Keep the five buttons and the big Play.
- Make four rules, and apply them everywhere:
  1. Back always returns to where you came from.
  2. A place you visit keeps the bottom bar. A scene (match, 3D world, ceremony, signing) takes over the phone.
  3. The house icon always means Home. It does nothing on Home.
  4. Anything that needs you shows a dot or a number on the right button, and as a chip on Home.
- Clean the Phone: comms and places only.
- Show the Stats views as one row of chips, not hidden behind two arrows.
- Cost: medium. About 9 steps, none of them large. Each one can ship alone.

**Two other ways**
- **B, "Life tab":** swap Relations for a Life button (Shop, Casino, Garden, House, Sponsors). Fold Relations into Training. Cleaner Phone, but tap counts do not drop, and it breaks 6 tutorial pointers.
- **C, "The board" (New Star Soccer style):** no bottom bar. Home is a board of picture tiles. One tap to everything, but every switch costs two taps (Back, then the next tile) and nothing can carry a badge all the time.

**Why not B or C?** Most places are already one or two taps. A bigger rebuild does not save taps. It changes things Harry set on 28 Sep and 1 Oct. [reasoned]

**Taps, before and after (15 places).** Full table in section 5. Short version: 14 of 15 stay the same. One gets shorter (Career overview 4 to 2). Two extras get shorter (Trophy cabinet 3 to 2, the return trip from a Phone place 4 to 3). Transfers has no door, on purpose. One thing gets longer: the main menu and Hall of Fame go from 2 taps to 3 if the house icon goes inert on Home (Decision 2).

**One thing needs Harry's call.** His 1 Oct rule says list pages have "Back / switch / Home" as a fixed bottom bar, as in New Star Soccer. My rule 2 says a place keeps the tab bar. They clash on list pages such as Sponsors and Ownership. See Decision 1 in section 3.

**How to build it (his rules).** Test the layout first on a test page, not behind a Settings switch ("Decide, don't toggle"). Show before and after at phone size. Build one step at a time. Run `star-playtest` after each step. `app/star-dev/page.tsx` is the shared file, so every change there must be additive.

---

## 2. Today's navigation, mapped

### 2.1 The frame [code, seen]

```
 ┌ top bar: [house] NAME  Age  ★money  [?]  [gear] ┐   GameBar.tsx
 ├ HUD: star rating bar | energy bar               ┤   TopHud.tsx
 ├ page (Stats ‹  HOME  › Shop swipe pages)        ┤   SwipePages.tsx
 │   bottom strip: ⭐ Achievements · 🏠 My home · Sponsors ›
 │   edge arrows:  ‹ STATS            SHOP ›
 ├ bar: [League] [Training] (PLAY) [Relations] [Phone]  DashboardShell.tsx
 └─────────────────────────────────────────────────┘
```

- Home is the middle swipe page. Stats is on its left. Shop is on its right. [code]
- The bottom bar's first slot can swap to **Achievements** while the first steps run (unlock chain). A later question can switch it back to League. [code: `homeSlot`, `bottomLeft`]
- A locked button answers a tap with a lock note. [code]
- Relations and Training are one screen (`phase "skills"`) with two tabs. They only look separate. [code: `trainingTab`]
- The game has **74 screens** (the `StarPhase` list in `lib/star/types.ts`) and **176** places that switch screens in `page.tsx`. [code, counted]

### 2.2 Every screen and how you reach it

Taps are counted from Home (middle page), club career, every feature unlocked, no pop-up showing. "Back" is what the screen's own back does today.

**Rooms with the bottom bar (4)**

| Screen | How you get there | Back |
|---|---|---|
| Home | house icon from anywhere; start of every flow | on Home the house opens the main menu |
| Training (5 skill cards) | bottom bar "Training" | any bar button |
| Relations (boss, team, fans, sponsors row, reputation row) | bottom bar "Relations" (goes to the manager's talk first when one is due) | any bar button |
| Phone (home screen of apps) | bottom bar "Phone" | phone's own Back and Home |

**Inside the Phone (opens inside the phone)**: Social, Kickabout, League, Fixtures, Messages, App Store. [code: `INSIDE` set]
**Phone doors (leave the phone)**: Shop, Store, Casino, Sponsors, Owner, Garden, Your house, Awards, Settings. [seen]

**Takeover screens (no bottom bar)**

| Screen | How you get there | What Back does today |
|---|---|---|
| League (Results, Fixtures, Table, Scout, Awards, Squad; cup screens inside) | bottom "League"; the mini-table on Home; Stats' left arrow | own bar: Back, Alerts, Play. Back goes Home |
| Stats (6 views: Season, Contract, Status, All seasons, Country, Records) | Home arrow / swipe | swipe or house |
| Shop Showroom (cans, boots, style) | Home "SHOP" arrow / swipe | Back goes Home |
| Store | Phone, or the end of the Showroom rail | Back goes Home |
| 3D shop | Showroom rail door; Garden door | Back goes to the Showroom |
| Casino (menu, blackjack, roulette, slots) | Phone; Showroom rail; Garden doors | "Menu", then Home. From the 3D garden it returns to the garden |
| Sponsors, Sponsor negotiation | Home strip; Relations row; Phone; Showroom rail | Back goes Home |
| Ownership hub | Phone "Owner" | Back goes Home |
| Reputation, Rule Book, Investments (boardroom) | from Ownership | Back goes to Ownership |
| Achievements | Home strip; Phone "Awards"; Stats Records | Back goes Home |
| Trophy cabinet | Stats, Records view, then button | Back goes Home |
| Garden (3D) | Phone "Garden" | Back goes Home |
| Your house (3D) | Home strip "My home"; Phone; Garden door | Home, or the Garden if you came from it |
| 3D training (garden gate) | Garden | Back goes to the Garden |
| Settings | gear in the top bar; Phone | "← Home" |
| Face editors | Settings | Back to Settings |
| Main menu (title) | house icon **on Home**; Settings, "⌂ Main menu" | Settings or Continue |
| Hall of Fame | Main menu | Back |

**Flows that open by themselves (no door)**: line-up and match; post-match; Phone reactions; cup draw; knockout round-up; play-off round-up; deadline day; Ballon d'Or; season awards; league ladder; contract renewal; summer transfer window and talks; signing; international call-up and tournament; farewell and retirement; manager talk; dilemma and press (switched off). [code]

### 2.3 The weekly loop today [code, partly seen]

```
HOME (next match, days left)
  → Training: pick a skill → level → drill → back to Training   (sessions per week, energy cost)
  → Relations: boss / team / fans mini-games                    (once a week each, energy cost)
  → PLAY → line-up animation (skips on tap) → MATCH
  → POST-MATCH (star bar, rating, relationships, pay, achievements; Continue shut until seen)
  → PHONE REACTIONS ("moment" feed; can be switched off in Settings)
  → [cup draw | knockout round-up | play-off bracket | deadline day | international call-up | contract offer] only when due
  → HOME
End of season: HOME shows "End of Season 🏆"
  → Ballon d'Or → (final-season notice) → transfer window (or forced move) → season awards → ladder → contract renewal if forced → HOME
```

- There is no "Rest" or "skip the week" button in the New UI for a club career. `handleRest` is wired but the Relations page ignores it. Energy comes back from cans and the rest days after a match. [code]
- The week moves only when a match is played. That is simple and fine. [reasoned]

### 2.4 Tap counts today (15 places)

| # | Place | Taps | Route [code unless marked] |
|---|---|---|---|
| 1 | Play next match | 1 | PLAY. The line-up then runs by itself |
| 2 | Training | 1 | Training |
| 3 | Shop | 1 | "SHOP" arrow on Home (opens the Showroom straight away) |
| 4 | League table | 1 | League (also the Home mini-table, also Stats' left arrow) |
| 5 | Stats | 1 | "STATS" arrow on Home |
| 6 | Media (Social feed) | 2 | Phone, then Social |
| 7 | Garden / 3D | 2 (Garden), 1 (My home) | Phone, Garden. Home strip, My home |
| 8 | Casino | 2 | Phone, Casino (or Shop, then the rail end) |
| 9 | Ownership | 2 | Phone, Owner. A club's boardroom is 4 |
| 10 | Transfers | none | No door. Only the summer window opens it |
| 11 | Settings | 1 | Gear |
| 12 | Saves | 2 | Gear, "Career & saves". Or house, Load game, slot = 3 |
| 13 | Contract | 2 | Stats, then › once |
| 14 | Awards | 1 (Achievements) / 3 (season awards) | Home "⭐". Season awards: League, then 2 arrows |
| 15 | Career overview | 4 | Stats, then 3 arrows to "All seasons". The real overview only exists after retiring or in the Hall of Fame (house, Hall of Fame = 2) |

Also: Relations 1, Sponsors 1, Messages 2, Trophy cabinet 3 (Stats, ‹ to Records, button).

### 2.5 Duplicates, buried items, and mismatches

**Duplicates** [code, seen]
- League: bottom bar, Home mini-table, Stats' left arrow, Phone "League" app, Phone "Fixtures". The Phone's League is the same `LeagueScreen` squeezed small. On the Stats screen I saw League twice at once (edge arrow and bar).
- Shop: Home arrow, Phone "Shop", Phone "Store", Showroom rail.
- Settings: gear, Phone "Settings", main menu.
- Sponsors: Home strip, Relations row, Phone, Showroom rail.
- Achievements: Home strip, bottom-left slot, Phone "Awards", Stats Records.
- Casino: Phone, Showroom rail, Garden doors.
- Name clash: Phone "Awards" is Achievements. League "Awards" is the season awards (Golden Boot etc.). Two different things with one name.

**Buried** [code]
- Trophy cabinet: 3 taps, inside a button at the bottom of the Records view.
- Career overview (current career): 4 taps.
- Boardroom of a club you own: 4 taps.
- 3D training: only through the Garden, and you must walk to the gate.
- Showroom doors (Casino, Sponsors, Store, 3D shop): "at the end of the category rail", so you must scroll to find them. NN/g found hidden navigation was used less (see 3.1).

**Dead ends** [code]
- Transfers: `transfer-request` has no opener. The summer window is the only way in (by design since 18 Oct, per CLAUDE.md).
- Rest / skip week: no button.
- Ownership, Sponsors, Trophies, Achievements: only a Back. No bottom bar, no way to hop to Training or Play without going Home first. [seen for Ownership]
- Ownership has no energy bar. That breaks the 1 Oct rule "Energy never leaves". [seen]

**Inconsistent Back** [code]
- Eight styles (listed in the summary). Positions differ too: top-left, bottom-left, bottom bar, centre.
- Back target is "Home" for screens opened from the Phone, from Relations, from Stats and from the Shop rail.
- Settings is labelled "← Home" even when it was opened from the main menu (it goes to the menu then).

**Tutorials depend on the bar** [code]. Pointers use `data-tour` names: `nav-league`, `nav-training`, `nav-play`, `nav-life`, `nav-phone`, `home`, `money`, `rating`, `energy`. Any bar change must keep them or update `lib/star/tours.ts`.

---

## 3. What the best games do

### 3.1 General guidance

| Guidance | What it says | Mark |
|---|---|---|
| Apple tab bars | "Use the minimum number of tabs… in general, use three to five tabs in iOS." More tabs add complexity. Avoid overflow. | [source] https://developer-rno.apple.com/design/human-interface-guidelines/components/navigation-and-search/tab-bars (mirror of Apple's page; I did not reach developer.apple.com) |
| Material bottom navigation | Three to five destinations. Under three, use tabs. Over five, use tabs or a drawer. With 4–5 items, labels on the active one are recommended; space may not allow labels on all five. | [source] search result summary of Material 3 / Compose docs; the Material page itself did not load |
| Hidden vs visible nav | NN/g, 179 users, six sites. Combined (visible) navigation was used by 89% and found in 24 s. A low-salience hidden menu: 44% used it, 33 s. Prefer visible or combined; make hidden menus large and labelled. Small sample, "directional". | [source] https://www.nngroup.com/articles/find-navigation-mobile-even-hamburger/ |
| Thumb reach | Hoober's 2013 street study (about 1,300 people): 49% one-handed, 36% cradle and tap, 15% two thumbs. Bottom-centre is easiest. Top corners are hardest. Figures vary between secondary sources. | [source] https://alistapart.com/1-2-phone-grips-jpg/ and https://shop.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users (secondary coverage; not Hoober's own page) |
| Badges | I could not find an authoritative page on badge rules. I rely on common practice: a dot or a count on the one place that needs you, cleared when seen. | [memory] |

### 3.2 The games

I could confirm only a little of this on the web. Most layout detail below is from my memory and is marked.

| Game | What I found | Mark |
|---|---|---|
| EA FC career (FC 26) | The FC 26 Hub groups content in tabs: For You, Continue, Featured, Social. A Task List sits in the "Central" tab. The Season Pass is reached from the Hub, bottom-right. | [source] https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-career-mode-deep-dive and https://help.ea.com/en/articles/ea-sports-fc/career-mode/ |
| EA FC career (the loop) | A calendar with one "Continue" that moves time on, and events that interrupt it. Tabs along the top (Central, Squad, Transfers…). | [memory] |
| EA FC Mobile | Bottom tab bar, a big Play on Home, many red badges, events front and centre. I could not confirm the exact tabs. | [memory]. Web search gave only generic pages |
| Football Manager (FM27 notes) | Goal: fewer clicks, more full-screen cards, "less closing of windows to move forward". Messages can be acted on inside the message ("can be actioned immediately within the item instead of clicking away"). Tiles are for information, not navigation. A second row switches screens inside an area. | [source] https://www.footballmanager.com/node/1099 (development build; says layout is "largely unchanged" at launch) |
| Football Manager Mobile | A persistent "Continue" and a short bottom or side menu with an inbox first. | [memory]. Not confirmed |
| Top Eleven | Nordeus redesigned the pre-match home screen to show the stadium of the next fixture "to build anticipation". Bottom row of big icons, a giant play and next-match button, red badges everywhere. | [source] for the stadium (https://nordeus.com/?p=36761); rest [memory] |
| New Star Soccer | The 2016 update made the menus smoother. The sibling New Star Manager has a top bar (help, stats, money) and a bottom bar of five (home, league, squad, staff, club). Harry's own rulings quote NSS screens often (transfer window, Back/Switch/Buy bar). | [source] https://toucharcade.com/2016/09/27/new-star-soccer-update/ and https://miketendo64.com/2019/04/11/switch-review-new-star-manager/ ; NSS home layout [memory] |
| Score! Match / Score! Hero | Hero is a level map with very few menus. Match uses a short bottom bar. | [memory]. Nothing found |
| Retro Bowl | One home hub. Icons along the bottom. Play is started from the schedule. | [source] weak (fan guide sites). Treat as [memory] |
| NBA 2K MyCareer | "The City" is an open-world hub that connects modes and shops. 2K also uses an in-game phone as the menu. | [source] The City: https://www.nba-live.com/details-on-the-city-in-nba-2k25/ ; the phone [memory] |

### 3.3 What they agree on (reasoned from the above)

1. **One big action.** Continue, Play, or Next match. It is always in the same place. We have it (the raised Play). Keep it.
2. **Four to six sections, always visible.** We have five. Keep.
3. **Something needing you marks its own section.** FM puts it in the inbox. Top Eleven puts red badges on the icons. We only do this for the Phone.
4. **Do it where you read it.** FM27 lets you act inside a message. Ours: a contract offer, a sponsor offer or a manager's talk should open from where it is announced. [reasoned]
5. **A hub that feels like a place.** Top Eleven's stadium, 2K's City. We have this: the 3D garden joins shop, casino, training and house. It is a good idea and already built.
6. **Fewer clicks to move forward.** FM27's main goal. Our flows are short; the loose ends are the Back rules.

### 3.4 What argues against changing the bar

- Apple and Material both say three to five. We have five.
- Harry has already moved the bar twice (28 Sep, 1 Oct). More change means more re-learning and more broken pointers. [code: `tours.ts`]
- Most places are already one to two taps, so the gain from a rebuild is small. [code, counted]

---

## 4. Recommended structure

### 4.1 The picture

```
 BAR (always the same five)

  [ League ] [ Training ] ( PLAY ) [ Relations ] [ Phone ]
     dot:      sessions      pulse     games /      unread /
     cup draw  left          when      boss         offers
     result                  match     meeting
                             today

 HOME   one next-action chip, badges as chips, then the player
 TOP    [house = Home, inert on Home]  name  age  ★  [?]  [gear]
```

### 4.2 What lives where

| Place | Holds |
|---|---|
| **Home** | Next match. One "Needs you" chip row (most urgent first). The player. Cans. Strip: Achievements, My home, Sponsors. Arrows to Stats and Shop stay. |
| **League** (a room, keeps the bar) | Results, Fixtures, Table, Scout, Awards, Squad, cups. As today. |
| **Training** | The five skills. |
| **PLAY** | Straight to the line-up. Never changes place. |
| **Relations** | Boss, team, fans mini-games. Sponsors row. Reputation row. Contract nudge when an offer is due. |
| **Phone** | Comms: Social, Messages, Kickabout. Places: Casino, Garden, Your house, Store. Money: Owner. No League, no Fixtures, no Settings, no Shop. |
| **Stats** (swipe page and chips) | Season · Career (All seasons plus Country) · Records · Trophies · Contract. Status (injury, fitness) folds into Season. |
| **3D world** | The Garden stays the door hub (shop, casino, training gate, house). Every scene gets the same two exits: ‹ Back (where you came from) and its doors. Not a tab. |
| **Settings** | Gear only. Saves and Load stay in Settings, "Career & saves". Dev tools stay in the Dev tab (testers). |
| **Main menu / Hall of Fame** | Through Settings, "⌂ Main menu". |

### 4.3 The weekly loop (recommended)

```
HOME  ──(chip: "Train 2 left" / "Boss wants a word" / "Offer waiting")──┐
  Training  Relations  (bar dots count down as you use them)           │
  PLAY → line-up → MATCH → POST-MATCH → reactions → [event screens] → HOME
HOME now shows what changed (chips): new offer, messages, result, cup draw.
End of season: one chip "End of season 🏆" (today a card in the page).
```

- The loop does not change. The change is that Home and the bar say what is waiting. [reasoned]

### 4.4 "Needs you" (badges)

Order of the one Home chip, most urgent first. Every source below already exists in the game. [code]

| Priority | Source (existing) | Shows on |
|---|---|---|
| 1 | Season complete (every fixture played) | Home chip "End of season" |
| 2 | Contract offer / forced renewal (`checkForContractOffer`) | Home chip; Relations dot |
| 3 | Manager talk due (`managerTalkDue`) | Relations dot; Home chip |
| 4 | Sponsor offers (`brandsOf().offers`) | Sponsors count (exists); Phone dot |
| 5 | Star Pass reward waiting (`claimableLevels`) | The round "!" on the star bar (exists) |
| 6 | Training sessions left (`trainingLeft`) | Training: number of ⚡ left |
| 7 | Unread messages / social (`phoneUnread`) | Phone: count (today a bare dot) |
| 8 | Match today or tomorrow | PLAY pulse (exists as a slow breath) |

Rules: a dot clears when you open the thing. Counts, not words. No exact amounts (30 Sep ruling).

### 4.5 Rules to build to (also the check list)

1. **Back returns to where you came from.** One small return stack, not "go Home".
2. **Rooms keep the bar. Scenes take over.**
   - Rooms: League, Stats, Shop, Store, Ownership, Reputation, Rule Book, Investments, Sponsors, Achievements, Trophies, Settings.
   - Scenes: match, line-up, 3D worlds, ceremonies, signing, round-ups, Ballon d'Or, farewell.
3. **House icon = Home.** Dimmed on Home, like the Phone's Home.
4. **One Back look.** "‹ Back", same words everywhere.
5. **Energy bar on every room** (the 1 Oct rule). Ownership, Sponsors, Achievements and Trophies lose it today. [seen for Ownership]
6. **Nothing animates** between a tap and the next screen (14 Oct rule).

### 4.6 Alternatives

**B. "Life tab"**
- Bar: League · Training (with Relations inside) · PLAY · **Life** · Phone.
- Life is a page of picture cards: Shop, Store, Casino, Garden, House, Sponsors.
- Good: one clear place for spending and for the 3D world. The Phone becomes pure comms.
- Bad:
  - Tap counts do not fall. Shop goes 1 to 2 (unless Home keeps a link). Casino and Garden stay at 2.
  - Relations becomes 2 taps. Harry asked for its own button on 28 Sep.
  - 6 tutorial pointers (`nav-life`, locks on `life`) need rewriting.
- Cost: large.

**C. "The board" (NSS style)**
- No persistent bar. Home is a board of picture tiles plus a giant Play. Every screen has a bottom "Back / switch / Home" bar.
- Good: matches Harry's NSS rulings. One tap from Home to anything. Looks simple.
- Bad:
  - Switching rooms costs two taps (Back, then the next tile).
  - Nothing can wear a badge while you are away from Home.
  - The board must hold about 12 tiles plus Play. That clashes with "Home fits one screen, no scrolling" (1 Oct).
  - It also undoes the 28 Sep bar.
- Cost: large.

**My pick: the one in 4.1 to 4.5 ("Same bar, clear rooms").** I looked for what argues against it:
- It does not cut tap counts much (14 of 15 stay the same). That is honest: the counts were already low. Its value is trust: Back goes back, the bar stays, you can see what needs you.
- Where the pick and Harry's rulings clash, it is Decision 1 below.

**Decisions for Harry** (one word each)
1. List pages (Sponsors, Ownership…): **keep the tab bar** (my pick) or **Back / switch / Home bottom bar** (his 1 Oct NSS ruling)? Picture both at phone size first.
2. House icon on Home: **inert** (my pick) or keep opening the main menu?
3. Stats: **one row of five chips** (my pick) or keep the two arrows?
4. Transfers: keep "no door" (by design) or add a read-only "window opens in N weeks" line on Home?

---

## 5. Tap counts, before and after

| # | Place | Before | After (pick) | Note |
|---|---|---|---|---|
| 1 | Play next match | 1 | 1 | unchanged |
| 2 | Training | 1 | 1 | unchanged |
| 3 | Shop | 1 | 1 | unchanged (arrow stays) |
| 4 | League table | 1 | 1 | unchanged |
| 5 | Stats | 1 | 1 | unchanged |
| 6 | Media (Social) | 2 | 2 | Phone, Social |
| 7 | Garden / 3D | 2 (My home 1) | 2 (My home 1) | unchanged; Back now returns to the Phone |
| 8 | Casino | 2 | 2 | unchanged |
| 9 | Ownership | 2 | 2 | unchanged; keeps the bar and energy |
| 10 | Transfers | none | none (Decision 4) | by design |
| 11 | Settings | 1 | 1 | gear only (the Phone copy goes) |
| 12 | Saves | 2 | 2 | Gear, "Career & saves" |
| 13 | Contract | 2 | 2 (1 from the Home / Relations chip when an offer waits) | chip |
| 14 | Awards | 1 (3 for season awards) | 1 (3) | unchanged |
| 15 | Career overview | 4 | **2** | Stats, "Career" chip |
| – | Trophy cabinet | 3 | **2** | Stats, "Trophies" chip |
| – | Phone place and back to the Phone (Phone, Owner, Back, then Phone again) | 4 | **3** | Back returns to the Phone |

Score: 13 of 15 places are at 1–2 taps before. After: 14 of 15 (Career overview joins them). Transfers has no door. Cost of Decision 2: the main menu and Hall of Fame go from 2 taps (house, item) to 3 (gear, Main menu, item).

---

## 6. Move list

Cost: S = small (one file, under a day), M = medium, L = large. `page.tsx` = `app/star-dev/page.tsx`: the shared collision point. Every change there must be additive (a new field, a new handler, a wrapper), never a rewrite.

| # | Today | → New place / change | Cost | Files |
|---|---|---|---|---|
| 1 | Back goes Home from Phone-opened and Shop-opened screens | Return stack: remember where a screen was opened from; Back goes there | M | `page.tsx` (additive: a `returnTo` ref and an `openFrom` wrapper; the existing `onBack` props stay); `lib/star/navReturn.ts` (new, pure; with `tests/star/navReturn.mts`) |
| 2 | Eight Back looks | One Back look and label. Rooms: top-left ‹. Scenes: bottom bar | S–M | `components/star/ui/Screen.tsx` (`ScreenHeader`), `ui/Nav.tsx` (`BarButton`), `Investments.tsx`, `StoreShop.tsx`, `TrainingLevelSelect.tsx`, `LineupIntro.tsx`, `Casino.tsx` |
| 3 | House icon: Home everywhere, main menu on Home | Dim on Home; main menu stays under Settings | S | `ui/GameBar.tsx`, `page.tsx` (one line in `onHome`) |
| 4 | Info and management screens lose the bar and the energy bar | Keep the bar and HUD on rooms (rule 2) | M–L | `page.tsx` (a `inRoom()` wrapper around ownership, sponsors, achievements, trophies, store, settings returns; additive), `DashboardShell.tsx` (an "active tab = none" mode) |
| 5 | Bar has only a Phone dot | Counts on the right buttons (4.4) | M | `lib/star/needsYou.ts` (new, pure; with `tests/star/needsYou.mts`), `DashboardShell.tsx` (badge on `NavBtn`), `page.tsx` (one call, one prop) |
| 6 | Home has no next-action | One "Needs you" chip row | M | `HomeHub.tsx` (new chip row; must keep Home on one screen: measure at 390×844 and 360×640), `needsYou.ts` |
| 7 | Phone: 14 apps, 3 copies | Remove League, Fixtures, Settings, Shop, Awards from the grid. Keep comms, Casino, Garden, House, Store, Owner. Optional two small group labels | S | `PhoneHome.tsx` (`APPS` list, `INSIDE` set) |
| 8 | Stats: two arrows over six views | One row of five chips: Season, Career, Records, Trophies, Contract | M | `StatsTabs.tsx` (the `VIEWS` list and the row), `AllSeasonsNew.tsx` (becomes "Career") |
| 9 | Trophies: a button inside Records | A "Trophies" chip (`TrophiesScreen` content shown inside Stats, or the chip opens it as a room) | S–M | `StatsTabs.tsx`, `page.tsx` (route unchanged) |
| 10 | Home stat tiles are not buttons | Tap Goals/Assists to Season, Fame/Rep to Records (quick door) | S | `HomeHub.tsx` (`StatTiles`), `page.tsx` (additive: Stats view hint passed through) |
| 11 | Showroom doors hidden at the rail end | Show Casino, Sponsors, Store, 3D shop as a visible row | M | `components/star/shop2d/ShowroomShop.tsx` (not read in full; flag for the build) |
| 12 | Garden / house / 3D training: mixed exits | Every 3D scene: ‹ Back to where you came from, plus its doors | S–M | `Garden3D.tsx`, `Home3D.tsx`, `Shop3D.tsx`, `Casino3D.tsx`, `page.tsx` (`gardenArrive`, `homeFromGarden` fold into the return stack) |
| 13 | Season-over card sits in the page | A top-priority chip (same action) | S | `page.tsx` (existing card moves into the chip), `HomeHub.tsx` |
| 14 | Name clash: "Awards" twice | Phone "Awards" → "Achievements"; League "Awards" stays | S | `PhoneHome.tsx`, `MatchWeek.tsx` |
| 15 | Transfers: no door | **Decision 4.** No change by default | – | – |

**Shared files touched:** `app/star-dev/page.tsx` (items 1, 3, 4, 5, 9, 10, 12, 13), `lib/star/types.ts` (none needed; `StarPhase` does not change), `tailwind.config` (none). No new phase is needed.

**Order I suggest (each step ships alone, each is playtested)**
1. Items 1, 2, 3, 14: Back and the house. Smallest, and fixes the loudest problem.
2. Items 5, 6, 13: badges and the Home chip. This is the new idea.
3. Items 7, 8, 9, 10: Phone and Stats clean-up.
4. Item 4: rooms keep the bar. The largest. Do it last, after Decision 1.
5. Items 11, 12: the shop doors and the 3D exits.

**Risks to check at each step**
- **Tutorials.** Pointers use `data-tour` names (`nav-*`, `home`, `money`, `rating`, `energy`). Keep every one or update `lib/star/tours.ts`. [code]
- **Unlock chain.** The `locked` map and the Achievements/League slot swap must still work (`unlocks.ts`). [code]
- **One-engine guard.** None of this plays football, so it should not touch it. [reasoned]
- **Old UI.** Changes go in `components/star/` only. Nothing in `legacy/`. [CLAUDE.md]
- **Home must still fit one screen** with no scrolling at 360×640 (1 Oct rule). The chip row costs about 30 px. Measure first. [reasoned]
- **Rule: no new Settings switch.** Build the layout as the game. Try it first on a test page such as `/star-nav-dev`, with before/after at phone size. [CLAUDE.md "Decide, don't toggle", "show options"]

---

## 7. Check against Harry's standing rulings (`ui-house-style`)

| Ruling | Does the pick obey? |
|---|---|
| Phone first | Yes. Everything is judged at 390×844. |
| No stacked tab rows (1 Oct) | Yes. Stats stays one row. The bar is one row. |
| List pages: no title, no Back; fixed bottom bar | **Clashes with rule 2 on list pages. Decision 1.** |
| Energy never leaves | The pick fixes the screens that lose it. |
| Tap goes straight in, no animation (14 Oct) | Yes. Nothing new animates. |
| A feature people can't find is broken (30 Sep) | The pick adds doors (chips, Career, Trophies). Transfers stays a decision. |
| Findable = first screen | The chip row is on the first screen. Needs a measure (item 6). |
| Never show exact unlock amounts | Yes. Dots and counts only. |
| Pitch look for training and match | Not touched. |
| Phone is a phone (1 Oct) | Yes. The Phone stays, with fewer copies. |
| Decide, don't toggle | Yes. No new Settings row. |
| Old UI frozen | Yes. Not touched. |

---

## 8. What I did not do, and what I could not check

- **Screenshots (partly done).** I took 8 phone-size screenshots of the real game (390×844): `home.png`, `training.png`, `relations.png`, `phone.png`, `ownership.png`, `league.png`, `settings.png`, `stats.png`. The Shop and Play shots did not come out (my script landed on the main menu). So the Showroom, Garden, House, Casino and Store were **read in code, not seen**.
- **Test state.** The career was a new one (Hednesford, season 1, 16 years old). I opened every feature by removing the `unlocks` field from the saved career in the browser. So a locked first run, pop-ups and tours were not inspected. The screenshots show the unlocked look.
- **Tap counts are from code and the screens above.** I did not count taps on a phone with a finger. Counts assume Stats opens on "Season" (it remembers the last view) and League on its last tab.
- **Competitor detail is thin.** Web search found little about FC Mobile, FM Mobile, Score!, Retro Bowl and Top Eleven menus. I marked those rows [memory]. Please do not quote them as fact. The sources that are solid: Apple (via a mirror), NN/g, the FC 26 pitch notes, the FM27 article.
- **Material and badge rules** were not read on the source pages (the Material page did not load; no authoritative badge page found).
- **Not read in full:** `ShowroomShop.tsx`, `Garden3D.tsx`, `Home3D.tsx`, `Casino.tsx` internals, `TransferHub.tsx` internals. I used `page.tsx` for how they connect.
- **No `star-playtest` was run** (no code changed).
- The dev server I started on port 3097 is stopped. A second server on port 3071 belongs to something else and was left alone.

---

## Appendix A. Files read

`CLAUDE.md`, `.claude/skills/ui-house-style/SKILL.md`, `app/star-dev/page.tsx` (phase render section 3440–5294; `handleNavigate`, back handlers, `continueAfterMatch`, the season-end chain), `lib/star/types.ts` (`StarPhase`), `lib/star/unlocks.ts` (`LOCK_HINT`, `bottomLeft`, `nextStep`), `components/star/DashboardShell.tsx`, `HomeHub.tsx`, `ui/GameBar.tsx`, `ui/TopHud.tsx`, `SwipePages.tsx`, `StatsTabs.tsx`, `PhoneHome.tsx`, `MatchWeek.tsx`, `RelationsPage.tsx`, `SkillsScreen.tsx`, `SettingsScreen.tsx`, `shop2d/StoreLanding.tsx`, `TitleScreen.tsx` (menu items), `OwnershipScreen.tsx` (via screenshot), `MiniLeague.tsx`.

## Appendix B. The 74 screens (`StarPhase`), grouped

- **Rooms with the bar (3 phases):** dashboard, skills (Training/Relations), media (Phone).
- **Takeover rooms:** league, settings, face-editor, fake-face-editor, store, shop-kib, shop-boots, shop-lifestyle, shop-3d, casino-menu, casino-3d, casino-blackjack, casino-roulette, casino-slots, investments, sponsors, sponsor-negotiation, achievements, trophies, reputation, rule-book, ownership, garden, home-3d, training-3d.
- **Match flow:** pre-match, match, post-match, goal-replay, draw, knockout-roundup, playoff-roundup, deadline-day.
- **Season and career moments:** ballon-dor, season-awards, ladder, relegation-move, season-transfer, transfer-request (no opener), transfer-request-talk, transfer-signing, contract-renewal, vote-ceremony, intl-callup, intl-tournament, intl-tournament-table, intl-watched, final-season, retirement, farewell-invite, farewell-sheets, farewell-walkout, farewell-match, farewell-result, legacy.
- **Start of a career:** profile-setup, trial, trial-stages, scout-offers, manager-talk, wage-talk, trial-reward, loan-brief, free-agent, youth.
- **Small interrupts:** press (off), dilemma (off), relationship-game, advert-shoot.

(Counts: 74 members in the union, 176 `setPhase(` calls in `page.tsx`. [code])

## Appendix C. Where the numbers came from

- Taps: counted by following `onClick` handlers in `HomeHub.tsx`, `DashboardShell.tsx`, `PhoneHome.tsx`, `StatsTabs.tsx`, `MatchWeek.tsx` and `page.tsx` return branches. Checked on screen for Home, Training, Relations, Phone, Ownership, League, Stats, Settings.
- Back styles: `grep` for back labels in `components/star` (excluding `legacy`): "← Back" (`ScreenHeader`, `Investments`, `ProfileSetup`, `VersusScreen`), "← Home" (`SettingsScreen`), "‹ Back" (`BackPill3D`, `LineupIntro`, `TrainingLevelSelect`, `StoreShop`), bottom-bar "Back" (`MatchWeek`), "Menu" (`Casino`), "Close phone" (`PhoneHome`), round "‹" (`StoreView`).
- Phone apps (14): Social, Kickabout, League, Fixtures, Messages, Shop, Store, Casino, Sponsors, Owner, Garden, Your house, Awards, Settings (plus the App Store icon). [seen: the grid shows 10 big icons and 4 in the dock]
