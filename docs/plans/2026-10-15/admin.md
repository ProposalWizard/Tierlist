# Admin revamp: plan, second pass

15 Oct 2026. Planning only; no code. Read from the code at `Harry` 36b3601 unless marked **seen** (in a browser) or **guess**.

## 0. Numbers

| Fact | Number |
|---|---|
| Admin/dev pages | 69 (+ /star-dev, the game) |
| Pages with no lock | 28 |
| Lock today | none 28 · TesterOnly 22 · server redirect 6 · browser admin check 7 · browser admin-or-tester 2 · AdminOnly 4 |
| Lock proposed | admins 26 · admins + testers 43 |
| Testers can open today / proposed | 52 / 43 |
| Fate | keep 53 · old tests 15 · merge 1 · delete 0 pages (2 dead files) |
| Pages in today's pop-up / missing | 56 / 13 (pop-up has 59 links incl. /, /profile, /star-dev) |
| Pages with no guide | 6 |
| Admin API routes | 49, all check admin on every write |
| Questions | 153 (Q1–Q9 first pass, Q10–Q153 new: 144) |

Keys. **Lock:** none · T = TesterOnly (admins + testers) · A = AdminOnly / admins · S = server redirect in page (admins) · C = browser admin check · Ct = browser admin-or-tester check · open = everyone. **Owner evidence:** hdr = page header quotes them · PN = patch notes · PW = git author 'Proposal Wizard' (Mikey's work in every case checked) · CM = CLAUDE.md · pre-Sep = this clone's history stops 3 Sep, no evidence.

## 1. Every page

| # | Route | What it does | Owner (evidence) | Writes | Lock now | Testers now | Lock new | Testers new | Home | Fate | Q |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | /admin/patch-notes | Every patch-notes version | Shared (PN) | — | S | N | A | N | Site | Keep, link only | Q43 |
| 2 | /admin/app-plan | App plan + open questions | Harry (hdr) | — | S | N | A | N | Site | Keep | — |
| 3 | /admin/testers | Tester links, remove testers | Harry (hdr) | shared | S | N | A | N | Site | Keep | Q89, Q90 |
| 4 | /admin/xp | Site level-up rewards | ? (pre-Sep) | shared | none | Y | A | N | Site | Keep, rename 'Site XP rewards' | Q10, Q62, Q76 |
| 5 | /admin/football | Wikidata data behind Tic Tac Toe | ? (pre-Sep) | shared | none | Y | A | N | Site | Keep, rename 'Tic Tac Toe data' | Q11, Q87 |
| 6 | /profile-new | Trial profile redesign | ? (pre-Sep) | own | none | Y | T | Y | Old tests | Old | Q24, Q85 |
| 7 | /squad-builder | Dream XI builder | ? (pre-Sep) | — | T | Y | T | Y | Old tests | Old, rename 'Dream XI builder' | Q72, Q73 |
| 8 | /admin | Tierlists, votes, blind rankings, daily games, objectives, cards, feedback | ? (pre-Sep) | shared | S | N | A | N | Tierlists | Keep, rename 'Site content' | Q40, Q41 |
| 9 | /admin/football/players | Edit SoFIFA players | ? (pre-Sep) | shared | none | Y | A | N | PL Draft (+RBD Real data) | Keep, rename 'SoFIFA players' | Q12, Q8, Q87 |
| 10 | /admin/football/pl-clubs | Draft clubs per season (read) | ? (pre-Sep) | — | none | Y | A | N | PL Draft | Keep | Q13 |
| 11 | /admin/football/scrape | SoFIFA + logo import | ? (pre-Sep) | shared | none | Y | A | N | PL Draft (+RBD Real data) | Keep | Q14, Q8 |
| 12 | /draft-dev | PL Draft with V2 setup | ? (pre-Sep); Harry v0.8 (PN) | shared | none | Y | A | N | PL Draft | Keep + V2 \| Hero switch | Q20, Q68, Q69, Q70 |
| 13 | /draft-dev2 | PL Draft with Hero setup | ? (pre-Sep) | shared | none | Y | A | N | — | Merge → /draft-dev (redirect) | Q21, Q68 |
| 14 | /draft-challenge-dev | Draft with random briefs | ? (pre-Sep) | shared | A | N | A | N | PL Draft | Keep | Q66 |
| 15 | /admin/cl-draft | Champions League draft test | ? (pre-Sep) | — | C | N | A | N | PL Draft | Keep (ask) | Q42, Q95 |
| 16 | /draft/preview | Draft screen redesigns, sample data | ? (pre-Sep) | — | none | Y | T | Y | Old tests | Old | Q22 |
| 17 | /draft/american | Standalone American draft | ? (pre-Sep) | shared | none | Y | A | N | Old tests | Old | Q23, Q86 |
| 18 | /star-dev | The game | All | own | open | Y | open | Y | RBD › Career screens | Keep (first card) | Q38, Q39 |
| 19 | /star-retirement-dev | End-of-career screens | Leo (hdr) | own | none | Y | T | Y | RBD › Career screens | Keep | Q26 |
| 20 | /star-relgames-dev | Relationship games | Mikey (hdr, PW) | — | T | Y | T | Y | RBD › Career screens | Keep | — |
| 21 | /star-goal-clips-dev | Goal videos | Leo (hdr) | this browser | none | Y | T | Y | RBD › Career screens | Keep | Q27 |
| 22 | /star-dev/media-lab | Media-feed graphics bench | ? (pre-Sep) | — | none | Y | T | Y | RBD › Career screens | Keep | Q25 |
| 23 | /star-training-dev | Any training level | Mikey (hdr) | — | T | Y | T | Y | RBD › Career screens | Keep | Q60 |
| 24 | /star-gallery-dev | Every chance as a picture; save, commit | Harry (PN v0.7–0.10) | shared+repo | A | N | A | N | RBD › Chances | Keep | — |
| 25 | /star-highlights-dev | Infinite Highlights; fix on the spot | Harry (CM) | shared+repo | A | N | A | N | RBD › Chances | Keep, add to nav | Q64 |
| 26 | /star-play-dev | Infinite Highlights + Infinite Match + dials | Harry (PN v0.10) | shared+repo (admin only) | T | Y | T | Y | RBD › Chances | Keep, trim link cards | Q56, Q75 |
| 27 | /star-scenario-dev | Scenario builder page | Mikey (CM) | shared | C | N | A | N | Old tests | Old (gallery tab survives) | Q74 |
| 28 | /star-update-dev | Leo's Oct 13 update, Old \| New | Leo (PN v0.53) | this browser | T | Y | T | Y | RBD › Match tests | Keep | Q58 |
| 29 | /star-sim90-dev | Full simulated 90 minutes | Harry (hdr) | — | none | Y | T | Y | RBD › Match tests | Keep | Q28 |
| 30 | /star-radar-dev | Unseen match, minute by minute | Harry (hdr) | — | T | Y | T | Y | RBD › Match tests | Keep | — |
| 31 | /star-dribble-dev | First-person dribble duel | Leo? (guess) | — | C | N | T | Y | RBD › Match tests | Keep | Q47, Q81, Q3 |
| 32 | /star-dribble-stick-dev | Dribble steered by a stick | Harry (hdr) | — | none | Y | T | Y | RBD › Match tests | Keep | Q29, Q81 |
| 33 | /star-bigger-dev | Style A players 30% bigger | Harry (hdr) | — | none | Y | T | Y | RBD › Match tests | Keep | Q30, Q82 |
| 34 | /star-match-dev | Mikey's engine copy ('Shooting Test') | Mikey (CM) | — | C | N | T | Y | RBD › Match tests | Keep, rename | Q44, Q84 |
| 35 | /star-sound-lab-dev | Hear, edit, rate match sounds | Leo (hdr) | this browser | T | Y | T | Y | RBD › Sound | Keep | Q77 |
| 36 | /star-real-moments-dev | StatsBomb positions, playable | Mikey (hdr) | — | none | Y | A | N | RBD › Real data | Keep | Q31, Q79 |
| 37 | /star-statsbomb-dev | WC/Euro shots, playable | Harry (hdr) | — | none | Y | A | N | RBD › Real data | Keep | Q32, Q79 |
| 38 | /star-intl-dev | International world | Mikey (hdr) | — | none | Y | T | Y | RBD › Real data | Keep, add to nav | Q33, Q80 |
| 39 | /star-tournament-dev | Draw and play a tournament | Leo (hdr) | — | T | Y | T | Y | RBD › Real data | Keep, add to nav, add guide | Q80 |
| 40 | /lineups | Every club's XI, bench, manager | ? (pre-Sep) | shared | A | N | A | N | RBD › Real data | Keep, rename 'Team sheets' | Q65, Q72 |
| 41 | /admin/clubs | Club data gaps | Mikey (hdr) | — | none | Y | A | N | RBD › Real data | Keep | Q18 |
| 42 | /admin/badges | Club badges, redo on device | Harry (hdr) | this browser | none | Y | A | N | RBD › Real data | Keep | Q19 |
| 43 | /admin/custom-clubs | Invent a club | Mikey (PW) | shared | none | Y | A | N | RBD › Real data | Keep | Q17, Q92 |
| 44 | /star-3d-area-dev | 3D scenes list + 3D file store | Harry (hdr) | — | T | Y | T | Y | RBD › 3D places | Keep (group front page) | Q75 |
| 45 | /star-3d-area-dev/signing | Live 3D signing | Harry (CM) | — | T | Y | T | Y | RBD › 3D places | Keep, own rail row | Q57 |
| 46 | /star-3d-area-dev/office | Manager's office stage | Harry (CM) | — | T | Y | T | Y | RBD › 3D places | Keep, own rail row | Q57 |
| 47 | /star-shop3d-dev | Walk-around 3D shop | Harry (hdr) | — | T | Y | T | Y | RBD › 3D places | Keep | — |
| 48 | /star-garden3d-dev | 3D garden | Mikey (hdr) | — | T | Y | T | Y | RBD › 3D places | Keep | — |
| 49 | /star-home3d-dev | 3D house | Harry (hdr) | — | T | Y | T | Y | RBD › 3D places | Keep | — |
| 50 | /star-training3d-dev | 3D training pitch | Harry (hdr) | — | Ct | Y | T | Y | RBD › 3D places | Keep | Q67 |
| 51 | /star-style-dev | Art styles + Cut-scene Director | Harry (hdr) | — | Ct | Y | T | Y | RBD › 3D places | Keep, rename | Q59, Q67 |
| 52 | /star-animations-dev | 2D New vs Old animations | Leo (hdr) | this browser | T | Y | T | Y | RBD › Players + animation | Keep, rename '2D animations' | — |
| 53 | /star-anim3d-dev | Every 3D match move | Harry (hdr) | — | none | Y | T | Y | RBD › Players + animation | Keep | Q34, Q83 |
| 54 | /star-people-dev | Cut-scene faces, hands | Harry? (guess) | — | none | Y | T | Y | RBD › Players + animation | Keep | Q35 |
| 55 | /star-look-dev | Style A on three bodies | Harry? (guess) | — | none | Y | T | Y | Old tests | Old | Q36, Q82 |
| 56 | /star-sprites-dev | Baked 3D match figures | Leo? (CM) | — | C | N | T | Y | Old tests | Old | Q49, Q82, Q83 |
| 57 | /admin/star-pass | Star Pass layout | Mikey (hdr) | shared | none | Y | A | N | RBD › Money + rewards | Keep | Q15 |
| 58 | /admin/star-xp | Career XP book | Mikey (hdr) | shared | none | Y | A | N | RBD › Money + rewards | Keep, rename 'Career XP book' | Q16, Q76 |
| 59 | /star-store-dev | Store test | Harry (hdr) | this browser | T | Y | T | Y | RBD › Money + rewards | Keep | Q55 |
| 60 | /star-wallet-dev | Gems on the server | Harry (hdr) | own (server) | T | Y | T | Y | RBD › Money + rewards | Keep | Q63 |
| 61 | /star-tuning-dev | Balance numbers, this browser | ? (Mikey or Leo) | this browser | C | N | T | Y | RBD › Money + rewards | Keep, rename 'Balance numbers' | Q48, Q3 |
| 62 | /admin/sound-board | Swap any game sound | Harry (PN v0.24) | shared | S | N | A | N | RBD › Sound | Keep | Q61, Q77 |
| 63 | /star-attack-dev | Moving-attack prototype | Leo? (guess) | — | C | N | T | Y | Old tests | Old | Q45, Q3 |
| 64 | /star-bicycle-dev | Overhead-kick throwaway | Mikey (PW) | — | T | Y | T | Y | Old tests | Old | Q46 |
| 65 | /star-zoomgrass-dev | Zoom-to-play camera | Harry (CM) | — | none | Y | T | Y | Old tests | Old | Q37, Q82 |
| 66 | /star-3d-dev | Old 3D skin in every mode | Harry (hdr) | — | T | Y | T | Y | Old tests | Old | Q50, Q83 |
| 67 | /star-spin-dev | Spin your player | Mikey + Harry (hdr) | — | T | Y | T | Y | Old tests | Old | Q51 |
| 68 | /star-blender-dev | Blender footballer | Harry (hdr) | — | T | Y | T | Y | Old tests | Old | Q52 |
| 69 | /sfx-dev | Audition the sound manifest | Harry? (CM 1 Oct) | — | T | Y | T | Y | Old tests | Old | Q53, Q77 |
| 70 | /ballon-dor | Older Ballon d'Or career game | ? (pre-Sep) | own (XP) | S | N | T | Y | Old tests | Old, rename | Q54, Q78 |

## 2. First-pass questions (kept)

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q1 | Testers on pages that save shared data, sit under /admin, or show unlicensed StatsBomb data? | No: admins only on those 26; testers on the other 43. | Every shared write is refused for non-admins by the server (section 6), so letting testers in only shows buttons that fail. |
| Q2 | Should testers get the pop-up, showing only their pages? | Yes. | Today a tester has no list anywhere: the pop-up is admin-only (GlobalNav `{userIsAdmin && …}`); the title screen's Play Area link shows only in a local dev build. |
| Q3 | Owners I could not prove (pre-3 Sep pages): who? | Harry for site/Draft pages; ask Mikey and Leo for Tuning, First-person dribble, Live attack. | This copy's git history stops at 3 Sep; every pre-Sep page has no owner evidence. |
| Q4 | Is the Old tests list right (bulk answer; per-page questions below)? | Yes, all 15. | Section 1 'Fate' column; each old page also has its own question. |
| Q5 | Delete the dead file `app/draft-dev/DraftDevClient.tsx`? | Yes (section 5 also covers a second dead file). | 594 lines, imported by nothing (grep). |
| Q6 | Dock the rail on tool pages? | Overlay on tool pages; docked only on /admin/star and simple list pages. | Gallery sizes its picture from the window width (`vp.w - 28`); a docked column would shrink it. |
| Q7 | Add a 'Sound' group in Road to Ballon d'Or? | Yes. | Sound Board and Sound Lab fit no other group; /sfx-dev was lost from the menu. |
| Q8 | Players and Scrape: PL Draft or RBD? | PL Draft, also shown in RBD Real data. | Both games read sofifa_players. |
| Q9 | Keep a Tierlists section with one link? | Yes. | Harry named four sections; the dashboard covers tierlists today. |

## 3. The 28 unlocked pages — one question each

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q10 | /admin/xp (Site XP rewards): lock admins only? | Yes, admins only. | Edits the live `rewards` table; API is admin-only (`/api/admin/xp/rewards`), page has no check. |
| Q11 | /admin/football (Tic Tac Toe data): lock admins only? | Yes. | Writes football_* and tictactoe_puzzles; all its API routes check isAdmin; page has no check. |
| Q12 | /admin/football/players: lock admins only? | Yes. | Writes sofifa_players (both games read it); page open. |
| Q13 | /admin/football/pl-clubs (read only): admins only, or testers too? | Admins only. | Under /admin; read-only, but its data route `/api/admin/football/teams` is admin-only, so a tester would see an empty page. |
| Q14 | /admin/football/scrape: lock admins only? | Yes. | Imports into sofifa_players, club_logos, league_logos. |
| Q15 | /admin/star-pass: lock admins only? | Yes. | Saves star_pass_config (every career reads it); POST is admin-only, page open. |
| Q16 | /admin/star-xp (XP Book): lock admins only? | Yes. | Saves star_xp_config; POST admin-only; page open. |
| Q17 | /admin/custom-clubs: lock admins only? | Yes. | Writes custom_clubs, sofifa_players, club_logos, star_lineups; GET routes are public by design (custom_clubs RLS public-read). |
| Q18 | /admin/clubs (Club Data, read only): admins only or testers too? | Admins only. | Under /admin; nothing to save, but it lists every gap in the data; testers have no use for it. |
| Q19 | /admin/badges: admins only or testers too? | Admins only. | Under /admin; saves this browser only, but 'Copy changes' feeds a data change. |
| Q20 | /draft-dev: lock admins only? | Yes. | Uses the SAME browser save as the real PL Draft and sends finished seasons to real history, XP and rooms (guide). |
| Q21 | /draft-dev2: lock, or make it a redirect to /draft-dev? | Redirect (after the merge in section 5); admins only until then. | 4 lines differ from /draft-dev; writes the same real data. |
| Q22 | /draft/preview: lock (testers) and move to Old tests? | Yes. | Sample data only, 'decide whether to make them official' (header); last change 23 Sep. |
| Q23 | /draft/american: lock admins only and move to Old tests? | Yes. | Writes real american_draft_rooms; real American mode now lives in /draft rooms (CLAUDE.md). |
| Q24 | /profile-new: lock (testers) and move to Old tests? | Yes. | Trial redesign; 'Claiming writes to your real account' (guide); last change 23 Sep. |
| Q25 | /star-dev/media-lab: lock admins+testers? | Yes, testers too. | Nothing uploaded or saved (guide); only page under /star-dev that is a tool. |
| Q26 | /star-retirement-dev: lock admins+testers? | Yes. | Reads saves, never writes; Share link makes a real code for your own account only. |
| Q27 | /star-goal-clips-dev: lock admins+testers? | Yes. | Recordings stay in this browser (IndexedDB). |
| Q28 | /star-sim90-dev (Full match): lock admins+testers? | Yes. | Nothing saved (guide). |
| Q29 | /star-dribble-stick-dev: lock admins+testers? | Yes. | Test match, nothing counted (guide). |
| Q30 | /star-bigger-dev: lock admins+testers? | Yes. | Sets a size on this page only (`setFigureGrowOverride`); no guide yet. |
| Q31 | /star-real-moments-dev: lock admins+testers, or admins only? | Admins only. | Loads a StatsBomb file from your device; licence for a paid game not cleared (guide). |
| Q32 | /star-statsbomb-dev (Real shots): lock admins+testers, or admins only? | Admins only. | Shows StatsBomb data whose licence for a paid game is not cleared (guide). |
| Q33 | /star-intl-dev: lock admins+testers? | Yes. | Nothing saved (guide). |
| Q34 | /star-anim3d-dev: lock admins+testers? | Yes. | Nothing saved (guide). |
| Q35 | /star-people-dev: lock admins+testers? | Yes. | Nothing saved, Settings untouched (guide). |
| Q36 | /star-look-dev: lock admins+testers, and Old tests? | Lock testers; Old tests (Player style New decided 12 Oct). | CLAUDE.md 'Decided, no toggle': player style New. |
| Q37 | /star-zoomgrass-dev: lock admins+testers, and Old tests? | Yes to both. | Header: 'Not linked anywhere'; 'Match camera: Old until the rebuilt camera lands' (12 Oct). |

## 4. Other per-page choices

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q38 | List /star-dev (the game) as the first card on /admin/star? | Yes, 'Play the game'. | It is in today's pop-up as 'Road to Ballon d'Or'. |
| Q39 | Keep /star-dev itself open to everyone? | Yes, never gated. | It is the live game; CLAUDE.md: no server auth gate, by design. |
| Q40 | /admin dashboard: put under Tierlists and rename 'Site content'? | Yes. | It runs tierlists, votes, blind rankings, Tic Tac Toe, Ten-A-Ball, objectives, cards, feedback (guide). |
| Q41 | /admin dashboard top buttons (Ballon d'Or Beta, Scrape Data, Players DB): keep? | Drop 'Ballon d'Or Beta'; keep the other two. | app/admin/page.tsx line 58 links /ballon-dor, which this plan moves to Old tests. |
| Q42 | /admin/cl-draft: keep under PL Draft or Old tests? | Keep (ask its owner). | Saves nothing; no evidence of who uses it; last change 23 Sep was the page guide. |
| Q43 | /admin/patch-notes: Site section, link only, not touched by this build? | Yes. | Another builder owns patch notes (brief). |
| Q44 | /star-match-dev: let testers in, and rename 'Match engine copy (Mikey)'? | Testers yes; rename yes. | Writes nothing (guide); page title says 'Shooting Test' (line 112). |
| Q45 | /star-attack-dev: Old tests? | Yes. | Prototype from 6 Sep; no change since 26 Sep. |
| Q46 | /star-bicycle-dev: Old tests? | Yes. | Guide: 'A throwaway test'. |
| Q47 | /star-dribble-dev: let testers in? | Yes. | Nothing saved (guide); the only home of the first-person duel (CLAUDE.md). |
| Q48 | /star-tuning-dev: let testers in? | Yes. | Saves this browser only; testers already have god mode. |
| Q49 | /star-sprites-dev: Old tests? | Yes. | 'players 3D-made sprites' decided 12 Oct (CLAUDE.md). |
| Q50 | /star-3d-dev: Old tests? | Yes. | Shows the old 3D skin; 2D players are now 3D-made sprites (12 Oct). |
| Q51 | /star-spin-dev: Old tests? | Yes. | Spin test from 28–30 Sep; the 3D player replaced it. |
| Q52 | /star-blender-dev: Old tests? | Yes. | Blender footballer superseded by people3d (CLAUDE.md 3D world: '3D people New'). |
| Q53 | /sfx-dev: Old tests? | Yes. | Sound Board and Sound Lab cover it; not in the pop-up. |
| Q54 | /ballon-dor: Old tests, renamed 'Ballon d'Or career (old beta)'? | Yes. | Separate older game; same name as Road to Ballon d'Or; last change 23 Sep. |
| Q55 | /star-store-dev: keep or Old tests? | Keep. | Paid items are coming (PAID_ITEMS.md); the 3D Test Area lists it. |
| Q56 | /star-play-dev: drop its link cards to other pages? | Yes; keep Infinite Highlights / Infinite Match and the dials. | Seen: 3,999 px tall at 390 wide, mostly link cards the rail will replace. |
| Q57 | 3D Test Area's signing and office: own rows in the rail? | Yes, under 3D places. | Not in today's pop-up; reachable only from the 3D Test Area. |
| Q58 | /star-update-dev: mark Old when Leo's update ships? | Yes, the owner flips status in the registry. | It holds Leo's unfinished Oct 13 work (CLAUDE.md test-page rule). |
| Q59 | Cut-scene Director: own row (a link into /star-style-dev?scene=director)? | Yes. | Today hidden inside 'Style Testing'; CLAUDE.md names it as the way to watch any scene. |
| Q60 | /star-training-dev: Career screens or Match tests? | Career screens. | It plays training levels, a career screen. |
| Q61 | /admin/sound-board: RBD Sound or Site? | RBD Sound. | Every sound listed is a game sound (guide). |
| Q62 | /admin/xp: Site or PL Draft? | Site. | Account-level rewards (frames, titles) across games. |
| Q63 | /star-wallet-dev: keep testers in? | Yes. | Its '+100 gems' calls an admin-only route; Buy uses your own gems. |
| Q64 | /star-highlights-dev: admins only (as today)? | Yes. | Save and Commit write star_scenarios and the repo. |
| Q65 | /lineups: admins only (as today)? | Yes. | Saves star_lineups for every career. |
| Q66 | /draft-challenge-dev: admins only (as today)? | Yes. | Rooms are real rows in the live multiplayer tables. |
| Q67 | /star-style-dev and /star-training3d-dev: move their browser-side check into the layout gate? | Yes. | Both check admin-or-tester in the browser after the code ships. |

## 5. Duplicates and overlaps

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q68 | /draft-dev vs /draft-dev2: which survives? | /draft-dev, with a V2 \| Hero switch; /draft-dev2 redirects. | 4 lines differ: setup import (DraftSetupV2 vs DraftSetupHero), function name, room link, guide key. |
| Q69 | /draft-dev sends rooms to the real /draft; fix to stay on /draft-dev? | Yes. | draft-dev line 365 `/draft?room=`; draft-dev2 uses `/draft-dev2?room=`. |
| Q70 | Delete `app/draft-dev/DraftDevClient.tsx` (the file the brief calls DevDraftClient.tsx)? | Yes. | 594 lines; no import anywhere (grep). |
| Q71 | Delete `components/draft/SquadManager.tsx` and rename SquadManagerDev → SquadManager? | Delete yes; rename later (touches the live /draft). | SquadManager.tsx (372 lines) is imported by nothing; the live /draft imports SquadManagerDev (line 7). |
| Q72 | Two pages called 'Squad Builder' (/lineups and /squad-builder): names? | /lineups → 'Team sheets'; /squad-builder → 'Dream XI builder'. | AdminNavPanel names /lineups 'Squad Builder'; /squad-builder metadata title 'Squad Builder \| Knowitball'. |
| Q73 | /squad-builder: keep (a future site game?) or Old tests? | Old tests until a site game is planned. | Not linked anywhere (grep); CLAUDE.md lists 'Combined XI builder' as future work. |
| Q74 | /star-scenario-dev vs gallery 'Scenario Builder' tab: which survives? | Gallery tab; page stays in Old tests. | Same ScenarioEditor; guide says its 'saved locally' note is out of date. |
| Q75 | Play Area and 3D Test Area are hubs; the new home is a hub too. Keep three? | Keep 3D Test Area (it also holds the 3D file store); trim Play Area's links (Q above). | area3d.ts lists 11 scenes; Play Area links 9 pages. |
| Q76 | 'XP & Rewards' vs 'XP Book': names? | 'Site XP rewards' and 'Career XP book'. | Different tables: rewards vs star_xp_config. |
| Q77 | Sound Board vs Sound Lab vs /sfx-dev: which survive? | Board and Lab; /sfx-dev Old. | Board swaps live sounds; Lab rates match sounds; sfx-dev only plays the manifest. |
| Q78 | 'Ballon d'Or' (/ballon-dor) vs 'Road to Ballon d'Or' (/star-dev): rename the old one? | Yes: 'Ballon d'Or career (old beta)'. | Two games, one name. |
| Q79 | Real moments vs Real shots (both StatsBomb): merge? | No; group together in Real data. | Different data (moments file from your device vs shots.json) and different owners (Mikey vs Harry). |
| Q80 | International world vs Tournaments: merge? | No; group together. | Different owners (Mikey, Leo) and code (intl world vs tournament.ts). |
| Q81 | First-person dribble vs Dribble on a stick: merge? | No. | Different modes; both live as tests. |
| Q82 | Bigger players, Zoom-to-play, 3D match figures, Player style: merge into one page? | No; group, and two go Old. | Each sets a different override; merging changes their scenes. |
| Q83 | 3D look in every mode vs 3D match figures vs 3D animations: overlap? | Keep 3D animations; the other two Old. | Decided 12 Oct: sprites + Style A. |
| Q84 | /star-match-dev copy of the engine: keep while it's on the guard's copies list? | Yes; Mikey's call to retire it. | CLAUDE.md 'Still copies, to port next: … Mikey's /star-match-dev fork'. |
| Q85 | /profile vs /profile-new: which survives? | /profile; /profile-new Old. | Trial redesign, no change since 23 Sep. |
| Q86 | /draft/american vs American mode inside /draft rooms? | Rooms; sandbox Old. | CLAUDE.md: real American mode needs draft_american_mode.sql (RUN); sandbox is standalone. |
| Q87 | 'Players' (SoFIFA, /admin/football/players) vs players inside 'Football Data' (Wikidata): names? | 'SoFIFA players' and 'Tic Tac Toe data'. | Two different player tables. |
| Q88 | Five lock mechanisms (TesterOnly, AdminOnly, server redirect, two browser checks): replace with one? | Yes, DevGate (section 8). | Section 0 lock counts. |
| Q89 | Tester Access guide lists 14 tester pages and says Play Area is admin-only; fix from the registry? | Yes, generate that list from the registry. | adminGuides.ts line 669 vs real: 24 pages on tester locks; Play Area is TesterOnly. |
| Q90 | Tester Access guide says tester_access.sql must be run; it is RUN. Remove that line? | Yes. | CLAUDE.md: RUN by Mikey, 5 Oct. |
| Q91 | Guide titles, pop-up names and page headings disagree (e.g. Match Engine / Match Engine (sandbox) / Shooting Test). One name from the registry? | Yes; guide title reads the registry. | AdminNavPanel vs adminGuides vs page h1. |

## 6. API routes

Checked per method by reading each route (script, then by eye for helpers). **Gap** = a missing check or a choice.

| Route (/api/…) | Methods | Server check | Gap |
|---|---|---|---|
| admin/blind-rankings | GET POST | requireAdmin | — |
| admin/blind-rankings/[id] | PATCH DELETE | requireAdmin | — |
| admin/blind-rankings/[id]/images | GET POST | requireAdmin | — |
| admin/blind-rankings/[id]/images/[imageId] | PATCH DELETE | requireAdmin | — |
| admin/blind-rankings/[id]/import | POST | isAdmin | — |
| admin/card-library | GET POST PATCH DELETE | checkAdmin | — |
| admin/categories/[id] | PATCH POST DELETE | isAdmin | — |
| admin/category-settings | GET POST | requireAdmin | — |
| admin/custom-clubs | GET POST PATCH DELETE | isAdmin on writes; GET public | GET public by design (Q92) |
| admin/custom-clubs/players | GET POST PATCH DELETE | isAdmin on writes; GET public | GET public by design (Q92) |
| admin/export | GET | isAdmin | — |
| admin/feedback | GET DELETE | isAdmin | — |
| admin/football/crossclub | GET | isAdmin | — |
| admin/football/data-stats | GET | isAdmin | — |
| admin/football/import | GET POST | adminGuard | — |
| admin/football/import-logos | POST | isAdmin | — |
| admin/football/import-sofifa | POST | isAdmin | — |
| admin/football/leagues | GET | isAdmin | — |
| admin/football/normalize-attributes | POST | isAdmin | — |
| admin/football/player-search | GET POST PATCH DELETE | isAdmin | — |
| admin/football/players | GET | isAdmin | — |
| admin/football/scrape-sofifa | GET POST | checkAdmin | — |
| admin/football/scrape-sofifa/stats | GET | isAdmin | — |
| admin/football/teams | GET | isAdmin | — |
| admin/football/ttt-grid | GET | isAdmin | — |
| admin/objectives | GET POST PATCH DELETE | checkAdmin | — |
| admin/objectives/vocab | GET | isAdmin | — |
| admin/patch-notes/file/[...path] | GET | requireAdmin (lib/patchNotePageServe) | — |
| admin/patch-notes/page | GET | requireAdmin (lib/patchNotePageServe) | — |
| admin/season-rewards | GET POST PATCH DELETE | checkAdmin | — |
| admin/tenable | GET POST | requireAdmin | — |
| admin/tenable/[id] | GET PATCH DELETE | requireAdmin | — |
| admin/testers | GET POST | adminId | — |
| admin/tictactoe | GET POST | requireAdmin | — |
| admin/tictactoe/[id] | GET PATCH DELETE | requireAdmin | — |
| admin/tierlists | GET | isAdmin | — |
| admin/tierlists/[id] | PATCH DELETE | isAdmin | — |
| admin/tierlists/[id]/images | POST | isAdmin | — |
| admin/tierlists/[id]/images/[imageId] | PATCH DELETE | isAdmin | — |
| admin/tierlists/[id]/images/reorder | PATCH | isAdmin | — |
| admin/upload-image | POST | isAdmin | — |
| admin/vote-tierlists | GET POST | requireAdmin | — |
| admin/vote-tierlists/[id] | PATCH DELETE | requireAdmin | — |
| admin/vote-tierlists/[id]/images | GET POST | isAdmin | — |
| admin/vote-tierlists/[id]/images/[imageId] | PATCH DELETE | isAdmin | — |
| admin/vote-tierlists/[id]/images/reorder | PATCH | isAdmin | — |
| admin/vote-tierlists/[id]/import | POST | isAdmin | — |
| admin/wallet/grant | POST | isAdmin | — |
| admin/xp/rewards | GET POST PATCH DELETE | requireAdmin | — |
| star/scenarios | GET POST DELETE | GET public; writes requireAdmin | — |
| star/scenarios/commit | POST DELETE | isAdmin | Needs GITHUB_TOKEN |
| star/lineups | GET POST | GET public; POST isAdmin | — |
| star/xp-config | GET POST | GET public; POST isAdmin | — |
| star/star-pass | GET POST | GET public; POST isAdmin | — |
| star/corrections | GET POST DELETE | GET public; writes requireAdmin | — |
| star/sfx-overrides | GET POST DELETE | GET public; writes requireAdmin | — |
| star/tuning-notes | POST GET | POST anyone; GET isAdmin | POST open by design (Q93) |
| star/career | GET POST DELETE | own account; isTester exempts save guard | — |
| profile/admin-check | GET | returns isAdmin, isTester | — |
| draft/debug | GET | isAdmin | — |
| draft/rooms/[code]/dev-skip | POST | isAdmin + room host | — |
| draft/rooms/[code]/dev-skip-career | POST | isAdmin + room host | — |
| ballon-dor/player-search | GET | isAdmin | Blocks testers if /ballon-dor opens to them (Q54) |
| cl-draft/clubs | GET | isAdmin | — |

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q92 | /api/admin/custom-clubs GET and /players GET are public. Keep? | Keep. | custom_clubs is public-read by RLS (custom_clubs.sql line 37); players come from public sofifa_players. |
| Q93 | /api/star/tuning-notes POST accepts anyone. Keep? | Keep; add a size cap if not there. | By design 'Anyone inserts, admins read' (CLAUDE.md); I did not check for a size cap. |
| Q94 | Public GETs (scenarios, lineups, xp-config, star-pass, corrections, sfx-overrides) — keep public? | Yes. | The game reads them for every player. |
| Q95 | /admin/cl-draft reads user_roles from the browser to decide access. Replace with DevGate? | Yes. | Line 141–144; depends on RLS letting users read their own role. |
| Q96 | Admin routes use 6 helper names (requireAdmin, checkAdmin, adminGuard, adminId, inline isAdmin…). Standardise? | Not in this build; note only. | All 49 already check; renaming is risk with no gain now. |

## 7. Testers

| Fact | Detail |
|---|---|
| Pages testers can open today | 52: 24 on tester locks + 28 unlocked. Columns 'Testers now/new' in section 1. |
| How testers find them today | Typed address only. Pop-up is admin-only; title screen Play Area link is local-dev only (`showPlayArea={offlineDevPlayEnabled()}`). |
| Proposed | 43 pages, listed in a tester pop-up and a tester view of /admin/star. |
| Tester Access guide | Stale: lists 14 tester pages and calls Play Area admin-only; says tester_access.sql is pending (it is RUN). |

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q97 | How do testers find their pages? | The same pop-up, filtered to tester pages, plus /admin/star filtered. | Today: by typed address only. |
| Q98 | On a phone, where is the tester's way in? | NavMenu 'Test tools' row (the admin row is 'Admin & Dev tools'). | NavMenu shows the admin row only with isAdmin. |
| Q99 | Also a 'Test pages' button in the game's Settings → Developer tab? | Yes. | Testers already live in that tab (guide: god mode). |
| Q100 | Should testers see admin-only pages greyed out with a lock? | No; hide them. | Less clutter; nothing they can do there. |
| Q101 | Show testers the 'writes real data' badge? | No; it only shows on admin-only pages. | Testers never reach shared-write pages under Q1. |
| Q102 | Tester link flow (/tester/[code]) unchanged? | Yes. | Not under any gated folder; uses roleOf/isTester. |
| Q103 | After 'Become a tester', where do they land? | /admin/star (tester view). | Today the message says 'Road to Ballon d'Or → Settings'. |

## 8. Design: registry, home, DevGate, rail

### Registry

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q104 | Registry file: `lib/adminRegistry.ts`, plain data? | Yes. | Same pattern as lib/adminGuides.ts and lib/patchNotesData.ts. |
| Q105 | Fields: url, name, purpose, section, group, owner, ownerWhy, status, writes, access, alsoIn, railDocked. Add or drop any? | As listed; add 'added' date. | A date lets the home sort 'new this week'. |
| Q106 | Owner values: Harry \| Mikey \| Leo \| Shared \| Unknown? | Yes. | Patch notes and admin dashboard are shared. |
| Q107 | Status values: in use \| old test (two only)? | Two only. | Harry's words: 'still used?'. |
| Q108 | Writes values: none \| this browser \| own account \| shared \| repo? | Yes, five. | Matches the guides' 'Saving' wording. |
| Q109 | Merge guides into the registry file? | No; keep adminGuides.ts, test that keys match. | adminGuides.ts is 1,982 lines. |
| Q110 | Run the registry test inside `npm run build` (blocks deploys) or only in the test suite? | Inside the build. | Same as the one-engine guard; a page with no lock must never reach the live site. |
| Q111 | Which folders must have a registry row? | app/admin/**, app/star-*-dev/**, app/star-dev/media-lab, /lineups, /draft-dev*, /draft-challenge-dev, /draft/preview, /draft/american, /sfx-dev, /ballon-dor, /profile-new, /squad-builder. | The 69 pages in section 1. |
| Q112 | Who edits the registry when a page is added? | Whoever adds the page; the test fails otherwise. | admin-page-guide skill already asks this for guides. |

### /admin/star home

Sketches (phone 390 / desktop):

```
 phone 390                       desktop
 +------------------------+      +------------+-----------------------------+
 | = Groups  RBD admin  o |      | rail       | [search...]                 |
 | [search...]            |      | v Career   | 41 in use - 11 old - 9 write|
 | 41 in use-11 old-9 wr. |      | v Chances  | H 26 - M 13 - L 9 - ? 4     |
 | H 26-M 13-L 9-? 4      |      | > Match    | CAREER SCREENS              |
 | CAREER SCREENS      6 >|      | > Real data| [card] [card] [card]        |
 | [card: name, one line, |      | > 3D       | CHANCES                     |
 |  H - in use - WRITES]  |      | ...        | [card] [card] [card]        |
 | > OLD TESTS (11)       |      | Team board | > OLD TESTS (11)            |
 +------------------------+      +------------+-----------------------------+
```

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q113 | Home URL /admin/star? | Yes. | Brief. |
| Q114 | Pop-up section order? | Road to Ballon d'Or, Site, PL Draft, Tierlists. | RBD has 52 of 69 pages. |
| Q115 | RBD group order? | Career screens, Chances, Match tests, Real data, 3D places, Players + animation, Money + rewards, Sound, Old tests. | Game first, then most-used (gallery 43 commits, highlights 26). |
| Q116 | Group names as listed? | Yes. | Harry's suggested groups, plus Sound. |
| Q117 | Card shows: name, one line, owner letter, status, 'writes' badge. Anything else? | Add last-changed date. | Helps 'what is anyone else doing'. |
| Q118 | Cards: one per row on a phone, 3 per row on desktop? | Yes. | 390 px leaves ~358 px per card. |
| Q119 | Search box on the home? | Yes, top, filters cards by name/purpose. | 52 cards. |
| Q120 | Filter chips (owner, status, writes)? | Yes, the what's-what numbers are the chips. | Same counts, one row. |
| Q121 | What's-what strip: counts per group, per owner, old? | Yes, one row each. | Brief. |
| Q122 | Old tests folded by default? | Yes. | 11 RBD old pages. |
| Q123 | Empty state when a filter matches nothing? | 'No pages match' + a 'Clear' button. | — |
| Q124 | Team board slot: top card, or rail link? | Rail link at the bottom + one small card at the top. | /admin/team is another builder's page. |
| Q125 | Patch notes link on the home? | Rail link only. | Site section owns it. |
| Q126 | Phone: rail as a drawer behind '☰ Groups'? | Yes. | Brief. |
| Q127 | PageGuide eye on /admin/star? | Yes, its own entry. | Rule: every admin page has one. |
| Q128 | Signed-out visitor to /admin/star? | Same 'Sign in' screen as other locks. | — |
| Q129 | Look: same dark/amber as the pop-up? | Yes. | 'The pop-up is fine' (Harry). |
| Q130 | 'Recently opened' row (this browser)? | No. | More text; search covers it. |

### DevGate (the one lock)

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q131 | DevGate in one layout per folder (≈60 small files) or in middleware? | Per folder. | A middleware throw is a 500 on every page (Critical Gotcha 5). |
| Q132 | app/admin/layout.tsx: keep only the touch CSS, gate per sub-folder? | Yes. | Lets /admin/star admit testers while /admin/* stays admin. |
| Q133 | Locked-out screen: message (today) or redirect to sign-in? | Signed out → sign-in with return; signed in → message. | Server pages already redirect to /auth?next=. |
| Q134 | Locked message wording? | 'Team only' + 'Back to Knowitball'. | Today two wordings: 'Admins only' / 'Testers only'. |
| Q135 | Keep the local-dev bypass (offlineDevPlayEnabled)? | Yes. | Playtest and filming agents rely on it. |
| Q136 | Remove the 9 browser-side checks? | Yes, keep feature flags inside pages. | They block testers the layout lets in. |
| Q137 | Keep the 6 server redirects inside pages? | Yes, harmless; don't touch patch-notes. | — |
| Q138 | Any API change in this build? | No. | All 49 admin routes already check (section 6). |

### Tool-page rail

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q139 | Rail opens on the current page's group? | Yes. | — |
| Q140 | Breadcrumb ('RBD › Chances › Gallery') in the rail header? | Yes, not on the page. | No new element over page controls. |
| Q141 | Phone edge tab: keep today's placement logic? | Yes. | placeTab avoids the pitch (26 Sep fix). |
| Q142 | Search in the rail? | Yes, same as home. | — |
| Q143 | Which pages get a docked rail on desktop? | Club data, XP book, Star Pass, Testers, Site XP rewards, Sound board. | List pages; no full-width canvas. |
| Q144 | Keyboard shortcut to open the rail? | No. | — |
| Q145 | Owner letter in rail rows? | No; only on home cards. | Keep rows short. |

## 9. Build steps — what Harry sees before each

| # | Step | Size | Harry sees / approves first | Q |
|---|---|---|---|---|
| 1 | Registry file, 70 rows | ≈1 h | Section 1 table answered (names, homes, fates, owners) | Q146 |
| 2 | Registry test inside the build | 30 min | One deliberate failing run | Q147 |
| 3 | 6 missing guides + names from registry | 1 h | The 6 guide texts | Q148 |
| 4 | DevGate + per-folder layouts; drop 9 browser checks | 1–1.5 h | List of pages whose access changes | Q149 |
| 5 | Pop-up reads registry; tester pop-up | 1 h | Stills at 390 and 1280 | Q150 |
| 6 | /admin/star home + rail | 1.5–2 h | Higgsfield design, then stills | Q151 |
| 7 | Draft V2 \| Hero switch; redirect; dead files | 30 min | Switch working on /draft-dev | Q152 |
| 8 | Checks: tsc, one-engine guard, registry test, stills | 45 min | Stills: pop-up, home phone + desktop, one tool page | Q153 |

| Q | Question | Recommended | Evidence |
|---|---|---|---|
| Q146 | Step 1 (registry): approve the section 1 table first? | Yes. | Names, homes and fates come straight from it. |
| Q147 | Step 2 (test): see one failing run first? | Yes, with one page left out on purpose. | Proves the test bites. |
| Q148 | Step 3 (guides): review the 6 new guides as text? | Yes. | — |
| Q149 | Step 4 (locks): see the list of pages whose access changes? | Yes, before merging. | Some open pages will close. |
| Q150 | Step 5 (pop-up): stills at 390 and 1280 before building step 6? | Yes. | Harry judges layout by eye. |
| Q151 | Step 6 (home): a Higgsfield design pass first? | Yes. | CLAUDE.md: 'Deep plan first, iterate, design (Higgsfield), then build'. |
| Q152 | Step 7 (draft merge): try the switch on /draft-dev before deleting /draft-dev2? | Yes. | — |
| Q153 | Step 8 (checks): stills of pop-up, home phone+desktop, one tool page? | Yes. | Brief. |

## 10. Risks

| Risk | Guard |
|---|---|
| 28 open pages close; someone used one signed out | List them in the patch notes |
| A per-folder layout is missed | Registry test (build-blocking) |
| Docked rail squeezes a pitch | Overlay by default; dock list (Q143) |
| Draft merge touches the real Draft save | Switch picks the setup screen only; save keys unchanged |
| Removing browser checks also hides features | Remove only the page gate; keep feature flags |
| Pop-up rewrite breaks the phone menu event | Keep OPEN_ADMIN_NAV_EVENT and the portal |
| Middleware gate | Not used (Critical Gotcha 5) |
| Other builders edit AdminNavPanel / adminGuides | Registry is a new file; small diffs elsewhere |

## 11. Not checked

| Item | Why |
|---|---|
| The admin pop-up on screen | Drawn only for a signed-in admin; this sandbox can't sign in |
| Owners of pre-3 Sep pages | Shallow clone (history from 3 Sep) |
| Who actually still uses each page | No visit logs; 'last change' dates include lock-only commits (5 Oct) |
| Size cap on tuning-notes POST | Not read |
| Admin pages that read Supabase from the browser (beyond cl-draft) | Not audited table by table |
| Tester view on a real tester account | No tester account here |

Stills (current, 390×844, signed out, local dev): `img/current-admin-clubs.png`, `img/current-admin-clubs-eye.png`, `img/current-star-play-dev.png`, `img/current-star-gallery-dev.png`, `img/current-admin-signed-out.png` in the session scratchpad `plan/img/`.
