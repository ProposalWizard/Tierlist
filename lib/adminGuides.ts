/**
 * ADMIN PAGE GUIDES — the words behind the little eye on every admin/dev page.
 *
 * One entry per route. `components/admin/PageGuide.tsx` draws them, always in
 * the same order and the same look, so a guide reads the same everywhere.
 *
 * KEEP THIS CURRENT. Whenever a button, a save path or a commit path on one of
 * these pages changes, change its entry here in the same change — a guide that
 * describes last month's buttons is worse than none. See
 * .claude/skills/admin-page-guide/SKILL.md for how to write an entry.
 *
 * House rules for the words (Harry and Mikey don't write code):
 *  - Button labels EXACTLY as they appear on screen, symbols included.
 *  - Plain English. No code words, no file paths — except in `dev`, the one
 *    small "For developers" line at the bottom.
 *  - Say where things go: this browser only / shared with everyone
 *    (and which Supabase table) / committed into the code.
 *  - If something depends on a migration or a setting that may not be done,
 *    say so in `needs` rather than pretending it works.
 */

export interface GuideButtonGroup {
  /** A sub-heading when a page has several screens or panels. */
  group?: string;
  /** [label exactly as on screen, what it does] */
  items: [string, string][];
}

export interface AdminGuide {
  /** The page's name as it appears in the admin menu. */
  title: string;
  /** One line: what this page is for. */
  what: string;
  buttons: GuideButtonGroup[];
  /** Where anything you do here is kept. */
  saving: string[];
  /** Leave out (or empty) when nothing here commits — the panel then says so. */
  commit?: string[];
  /** Where the work on this page ends up for players, if anywhere. */
  inGame: string[];
  /** Migrations / env settings this page relies on that may not be done yet. */
  needs?: string[];
  /** The one line for developers: files and API routes. */
  dev: string;
}

// ── Shared wording, so the same thing is said the same way on every page ──

const SCENARIO_SAVE_SHARED =
  "Save writes the picture to the team's shared scenario list (Supabase table star_scenarios). Everyone sees it straight away in the Scenario Gallery, Simulate and Infinite Highlights.";
const SCENARIO_NOT_IN_GAME_UNTIL_COMMIT =
  "A saved scenario is NOT in real matches yet. Real matches only use scenarios that have been committed to the code.";
const SCENARIO_TABLE_NEEDED =
  "The star_scenarios table must exist (supabase/migrations/star_scenarios.sql). If it doesn't, the page shows a red dot or red line and saves stay on this device only.";
const COMMIT_HOW = [
  "Commit writes the scenario into the game's scenarios file (authoredScenarios.json) directly on the main branch, through GitHub.",
  "Vercel rebuilds the live site from main every time — it takes a minute or two. Until then the page still shows the old status; don't press Commit again.",
  "A commit also saves the same copy to the shared list, so the two never disagree.",
  "Needs an admin sign-in, and GITHUB_TOKEN set in Vercel. Without the token you get a red \"Commit to repo is off\" message and nothing is committed.",
];
const GITHUB_TOKEN_NEEDED =
  "GITHUB_TOKEN set in Vercel's environment variables — without it every Commit button refuses (and says so).";
/** The Tuning panel (components/star/TuningSessionPanel.tsx) — the same on the
 *  gallery, Infinite Highlights and Infinite Match. */
const TUNING_PANEL_GROUP = {
  group: "Tuning panel",
  items: [
    ["Tuning · what you've seen this session", "Folded to one line. Tap to open: what the chances you've seen this session add up to — the mix of chance types, how many start up the pitch, how many come down your wing, chances a match and the longest wait (the last two from Infinite Match only). The count is shared by the gallery, Infinite Highlights and Infinite Match in this browser tab."],
    ["feels: about right / a lot / a little", "Each line against the DRAFT fun ranges (lib/star/funTargets.ts, first guesses). The green band on the bar is the range, the tick is you. Under 5 chances it says \"too few to tell\"."],
    ["Start the count again", "Empties this session's count. Notes are not touched."],
    ["Say what feels off: chips / your own words / Send", "Tap any chips (too many cutbacks, too many crosses, not enough chances, never on my wing, too easy, too hard) and/or write a line, then Send. It is saved with the page, the chance on screen, the league, the seed and the time."],
  ] as [string, string][],
};
const TUNING_NOTES_SAVING =
  "Tuning panel: the session count stays in this browser tab only. Notes go to the shared table star_tuning_notes; until that table exists they say \"Saved on this device only\" and are sent with the next note that gets through. Read them in the terminal: npx tsx scripts/tuning-notes.mts (also printed by scripts/tuner-proposals.mts). Nothing is committed and nothing in the game changes.";
const TUNING_NOTES_NEEDED =
  "For notes to reach the team: run supabase/migrations/star_tuning_notes.sql (PENDING). The terminal needs SUPABASE_SERVICE_ROLE_KEY to read them (admin-read).";

export const ADMIN_GUIDES = {
  // ════════════════════════════════════════════════════════════════════
  //  ADMIN
  // ════════════════════════════════════════════════════════════════════

  "/admin": {
    title: "Admin Dashboard",
    what: "Run the live site's content: tierlists, categories, vote tierlists, blind rankings, the daily games, objectives, cards and feedback. Since 20 Oct 2026 Admin in the site's top menu opens the Team board (the admin's home), not this page; reach this one from Website games → Tierlists.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["🏅 Ballon d'Or Beta", "Opens the admin-only Ballon d'Or career game."],
          ["⚽ Scrape Data", "Opens Scrape / Import (player data from SoFIFA)."],
          ["👥 Players DB", "Opens the Players database editor."],
          ["Export Backup", "Downloads a JSON copy of all tierlist data to your computer. Changes nothing."],
        ],
      },
      {
        group: "Tabs",
        items: [
          ["Tierlists", "Every published tierlist. Edit or delete them."],
          ["Categories", "Rename, reorder (↑ ↓), delete or Add categories, and choose how each is sorted on the homepage (Most recent / Highest views / Most liked / Manual — pin specific tierlists)."],
          ["Vote Tierlists", "\"+ New Vote Tierlist\", \"Convert from Tierlist\", Manage, Activate / Deactivate (show or hide it on the site), Delete."],
          ["Blind Rankings", "\"Convert Tierlist to Blind Ranking\" — makes a 10-slot blind ranking from a tierlist and links them."],
          ["Tic Tac Toe", "Make and schedule the daily grids (Daily Queue, Live / Hidden, difficulty, Save Puzzle). In the Daily Queue a laptop drags rows to reorder; a phone gets ↑ ↓ buttons on each row instead (dragging doesn't work on a touch screen)."],
          ["Ten-A-Ball", "Make and schedule Ten-A-Ball puzzles (Create Puzzle, Bulk paste names)."],
          ["Objectives", "\"+ Add New Objective\", edit conditions, Published / Draft, \"🔎 Audit Objectives\" to find broken ones."],
          ["Cards", "\"+ Upload Cards\" to the card library, then Save All."],
          ["Feedback", "What players have sent in. \"↻ Refresh\" re-loads it."],
        ],
      },
      {
        group: "Editing a tierlist (Edit)",
        items: [
          ["Title / Category / Additional Categories", "Name and where it's filed on the site."],
          ["Upload new cover / Crop cover / Remove upload", "Change the cover photo, or click any image below to use it as the cover."],
          ["Linked Vote Tierlist / Linked Blind Ranking", "Connect the matching community versions."],
          ["+ Add tier to top / + Add tier to bottom", "Edit the tier rows, their labels and colours."],
          ["+ Add Images", "Add pictures. Drag to reorder — on a phone, press and hold a picture for a moment, then drag (a quick swipe just scrolls). The small buttons on each picture crop it, set it as cover, or remove it; on a phone the red × is always showing, on a laptop it appears when you hover."],
          ["Face detection ON / OFF", "Auto-centre players' faces in their thumbnails."],
          ["Save Changes", "Nothing above is saved until you press this. Cancel throws it all away."],
        ],
      },
    ],
    saving: [
      "Everything is saved straight to the live database (Supabase) and shows on the real site immediately — no deploy needed.",
      "Tierlist and vote-tierlist edits only save when you press Save Changes.",
      "Images go into Supabase Storage (the tierlist-images bucket).",
    ],
    inGame: [
      "This is the real site: homepage, Find a Tierlist, vote pages, blind rankings, the daily Tic Tac Toe and Ten-A-Ball, and players' objectives.",
    ],
    dev: "app/admin/page.tsx · components/AdminPanel.tsx · components/TicTacToeAdmin.tsx, TenableAdmin.tsx, admin/ObjectivesAdmin.tsx, admin/CardLibraryAdmin.tsx · /api/admin/*",
  },

  "/admin/clubs": {
    title: "Club Data",
    what: "Every club in the game, and every piece of information the game uses about it, so you can see what's missing.",
    buttons: [
      { items: [
        ["All divisions", "Shows one division (or the Step 3 clubs waiting, or the European lists) instead of every club."],
        ["All information / Gaps in: …", "Shows one kind of information only, and only the clubs where it's missing or guessed."],
        ["Search a club", "Narrows the list to clubs whose name contains what you type."],
        ["Only clubs with gaps", "Hides clubs that have everything."],
        ["Download spreadsheet", "Downloads what's on screen as a spreadsheet file (opens in Excel or Google Sheets)."],
        ["A coloured box", "Green: you gave it. Blue: researched (hover to see the source page). Amber: the game is making it up. Red: nothing at all. Hover (or long-press) to see why."],
        ["Only researched values", "Shows only clubs with researched (blue) boxes, so you can check them."],
        ["The number under each column", "How many clubs have that piece of information, out of the clubs it applies to."],
        ["Clubs | International", "International shows every nation in the game: its flag, and its real home and away kit (shirt, second colour, pattern, shorts, socks), with the Wikipedia page it came from."],
        ["International → Flag box", "Green: the game draws this flag. Amber: no drawing yet, so it shows two bands in the kit colours."],
      ] },
    ],
    saving: [
      "Nothing to save: this page only reads. To fill a gap, give the information in chat (or a club sheet) and it's added to the game's data in the code.",
      "Blue boxes come from research (2 Oct 2026, mostly Wikipedia club pages). They only ever fill empty boxes: anything you've given wins. League titles and cups count national competitions only.",
      "International kits come from each national team's Wikipedia kit box (13 Oct 2026: the current, mostly 2026 World Cup, kits). Each one was read off the real kit picture and checked by eye. To change one, say so in chat.",
    ],
    inGame: [
      "Everything here is what the game uses: kits on the pitch, stadium names, club size in transfers and prestige, rivalries in the news, managers on the team sheet.",
    ],
    needs: [
      "Badge pictures are read from the shared club badge table. If it can't be read, that column says so for every club rather than guessing.",
    ],
    dev: "lib/star/data/clubAudit.ts (the checks), lib/star/data/clubProfiles.ts (the club sheets, built by scripts/club-data/build_club_profile_data.py from lib/star/data/sources/).",
  },
  "/admin/badges": {
    title: "Club Badges",
    what: "Every club's drawn badge in one grid, with the symbol its own data gave it (a fox for the Foxes) and why. Redo any badge that looks wrong.",
    buttons: [
      { items: [
        ["All divisions", "Shows one division (or the European lists) instead of every club."],
        ["Every badge / With a symbol / Ball or star / Changed here", "Shows only badges that got a symbol, only the plain ones, or only the ones you changed on this device."],
        ["Search a club", "Narrows the grid to clubs whose name contains what you type."],
        ["New | Old", "New shows the drawn badges. Old shows what the Old look shows in the game: the real crest if one is saved, else the club's initials. This only changes this page, not your Settings."],
        ["Copy changes (N)", "Copies your changes as text, to paste in chat so a good one can be put into the game for everyone."],
        ["Undo all", "Takes every change on this device away (asks first)."],
      ] },
      { group: "Each badge", items: [
        ["The blue word", "The symbol it shows (or ball, star, nothing)."],
        ["The grey line", "Why: the nickname or club name the symbol came from, \"no symbol in the data\", or \"changed here\"."],
        ["↻ Pattern", "Moves to the next pattern (stripes, halves, band, chevron, sash, quarters, hoops, plain)."],
        ["Data: … (the drop-down)", "Picks the emblem: what the data says (shown after \"Data:\"), a ball, a star, nothing, or any of the symbols."],
        ["Undo", "Puts that one badge back to what the data gives it."],
        ["Amber border", "This badge has been changed on this device."],
      ] },
    ],
    saving: [
      "Changes save instantly, in this browser only. Nobody else sees them, and they are lost if this browser's data is cleared.",
      "The game on this same device shows your changes too, so you can judge a badge in place. Use Copy changes to send them in chat.",
      "The symbols themselves come from the club data automatically — nobody has to tick them off. A club only gets one when its data clearly names something.",
    ],
    inGame: [
      "Every club badge in the game under Settings → Look → \"Club badges: New\" (team sheets, tables, cup draws, the phone).",
    ],
    dev: "lib/star/badgeSymbols.ts (drawings + the word table + SYMBOL_OVERRIDES), lib/star/clubBadge.ts (the badge), lib/star/badgeOverrides.ts (device changes, key star-badge-overrides), components/star/ClubBadge.tsx.",
  },
  "/star-retirement-dev": {
    title: "Retirement screens",
    what: "The end of a career without playing one: the final-season warning, the final whistle, the career overview, the Hall of Fame and the new All seasons page, on made-up careers or a save from this browser. Pick a career on the left (top on a phone); every screen is a picture card, and its ▶ Play button opens it. A greyed card has nothing to show for that career.",
    buttons: [
      { group: "Pick a career", items: [
        ["Legend / One club / Journeyman / Lower leagues / Quiet one", "A made-up 20-season career of that shape: every season's numbers, who won what, trophies, transfers, money and things bought."],
        ["Version ◀ ▶", "The same shape with different numbers."],
        ["Your saves on this device", "A real save from this browser. It is only read: retiring here retires a copy, never the save."],
      ] },
      { group: "The screens, in order", items: [
        ["1. After season 19: final season", "The warning after the season-19 Ballon d'Or night, before the transfer window. Continue comes back here."],
        ["2. After season 20: the final whistle", "The end after the season-20 Ballon d'Or night. Hang them up opens the career overview."],
        ["3. The career overview", "The end-of-career screen, as in the game. Flip its seven pages with the arrows at the top, or swipe."],
        ["Hall of Fame / New career / Menu", "The bar under the overview, as in the game. Here: Hall of Fame opens the made-up Hall; the other two come back here."],
        ["4. The Hall of Fame", "One made-up career of each shape. Tap one for its overview. Remove here only goes back: nothing is stored."],
        ["The share card (the picture)", "The picture Share picture makes, at the size it is shared. Make the picture opens the real share sheet."],
        ["In the game: All seasons page", "The Stats page's All seasons view (New look) on a career 12 seasons in."],
      ] },
      { group: "The farewell match", items: [
        ["Invite (Play or Skip)", "The farewell after the final whistle: your XI, the Rivals XI and why they are there. Play it opens the team sheets; Skip goes to the overview."],
        ["Team sheets", "The two elevens, as before any match. Kick Off opens the guard of honour."],
        ["Guard of honour · 3D / · drawn", "The walk-out: both teams in two lines clapping. 3D as the game shows it; drawn is what a phone that can't run 3D sees. Kick off › skips it."],
        ["Standing ovation · 3D / · drawn", "Off at 85': the camera circles you, the ground stands, two team-mates and two rivals stop you for a hug, a dap-up or a pat, the substitute hugs you on the line. 3D as the game shows it (Settings → Look → Standing ovation: New); drawn is what a phone that can't run 3D sees. Skip › ends it."],
        ["Full time (made-up 4–3)", "The farewell's last screen, with a made-up score. Hang them up opens the overview with the farewell line on it."],
        ["The match itself", "Not here: it is the real match. In the game, Dev Skip to the end of season 20, then Hang them up."],
      ] },
      { group: "The Ballon d'Or night", items: [
        ["You win · 3D / You come 2nd · 3D", "The ceremony as the game shows it (Settings → Look → Ballon d'Or night: New): the host at his lectern, the final three walk up one by one as he calls each name, \"And the winner is…\", the name, the golden ball over him, confetti, then your place. Skip › goes to the result page."],
        ["Not in the top three (7th) · 3D", "The shorter night: the three walk up together, the winner is named, then \"You finished 7th\"."],
        ["… · drawn", "What a phone that can't run 3D sees: the same night on a drawn stage."],
        ["The result page after it", "Your season, the winner and the top ten, as after the ceremony. Continue comes back here."],
        ["Old (the countdown cards)", "The Ballon d'Or screen as it was (Settings → Look → Ballon d'Or night: Old)."],
      ] },
      { group: "Season awards", items: [
        ["Season awards (last season)", "The awards screen after a season: the trophies, the Golden Boot and the other awards, and the Team of the Season, worked out from the picked career's last season. Each face is a headshot shot from the 3D model (the drawn head shows until it is made). Continue comes back here."],
      ] },
      { group: "Online", items: [
        ["Head to head", "The made-up legend (left, yours) against the career picked above (right): one bar per number."],
        ["Compare with a friend", "Type a friend's code or paste their link, pick one of your careers. Needs the database (the code is looked up)."],
        ["Share link sheet", "The Share link sheet over the overview. Signed out it says to sign in; signed in it makes the code."],
      ] },
    ],
    saving: ["Nothing is saved. A real save is read, never written, and the Hall here is made up. Share link (signed in) does make a real code in the database."],
    inGame: [
      "Every screen here is in the game. The warning shows after season 19, the final whistle after season 20 (a career is 20 seasons).",
      "Hang them up on the final whistle opens the farewell invite (once per career), then the overview.",
      "The Ballon d'Or night is shown at the end of every season (New: the ceremony, then the result page; Old: the countdown cards).",
      "The overview replaced the old end screen. The Hall of Fame is on the title screen. All seasons is Stats → All seasons (Settings → Look → All seasons page: New | Old).",
      "Share link and Compare: on the end screen and in the Hall of Fame. A shared career opens at /legend/CODE, no sign-in.",
    ],
    dev: "app/star-retirement-dev/page.tsx; screens components/star/CareerEnd.tsx, CareerOverview.tsx, HallOfFame.tsx, AllSeasonsNew.tsx, Farewell.tsx, LegendShare.tsx, ShareCard.tsx; the farewell lib/star/farewell.ts, guardOfHonour.ts, farewell3d.ts, the ovation ovation.ts, ovation3d.ts, ovationLook.ts; sharing lib/star/legendShare.ts, app/api/star/legend, app/legend/[code]; numbers lib/star/careerOverview.ts; the made-up careers lib/star/retirementPreview.ts; the Hall lib/star/hallOfFame.ts; the Ballon d'Or night components/star/BallonDorNight.tsx, lib/star/ballonDorNight.ts, ballonDor3d.ts, ballonDorNightLook.ts; the season awards components/star/SeasonAwardsScreen.tsx (lib/star/seasonAwards.ts computeSeasonAwardStats); the faces on the award cards components/star/Headshot3D.tsx, lib/star/headshot3d/.",
  },
  "/star-intl-dev": {
    title: "International world",
    what: "Every national team's competitions played out from August 2026 — Nations Leagues, qualifiers, the Euro, World Cup, Copa América, AFCON, Asian Cup, Gold Cup, OFC Nations Cup, friendlies — without playing a career.",
    buttons: [
      { items: [
        ["Played up to Aug (year) (top of the Nations list)", "Plays the world from August 2026 to 1 August of that year."],
        ["Search nations / a nation in the list", "Picks whose page is shown: flag, FIFA ranking, real home and away kits, last results, tables and matches. The screens below use that nation too. On a phone the list sits above the page."],
        ["A row in FIFA ranking", "Picks that nation, the same as the list."],
      ] },
      { group: "The screens (picture cards, ▶ Play)", items: [
        ["Called up / Left out", "The squad announcement as the game shows it, with that nation's last two matches as the sample. Continue comes back here."],
        ["Country page", "Stats → Country as the game draws it, for a new Arsenal career of the chosen nation with the national manager's bar at 62. Back comes here."],
        ["On duty (League)", "The League tab while you're away with your country (picked for its first break, one international played): its group table, results, fixtures and squad."],
        ["Watched on TV", "Not picked for the first break, Premier League: the screen after watching your nation's first match of it."],
        ["Country page after a season", "Stats → Country after a whole 2026/27 season, always picked, so Tables, Matches, Scorers, Ranking and Who won are full. Takes a few seconds to play."],
        ["On duty at a tournament", "Two seasons on, two group games into the summer 2028 tournament (Euro for England): the League tab at the tournament. Says so if that nation didn't qualify."],
        ["Ballon d'Or after a season", "The Ballon d'Or result after 2027/28, with your international goals counted. The other clubs' players are made up, with big nations' nationalities."],
        ["The card pictures", "Each card draws the real screen for the nation you picked, shrunk. The three slow ones (a season played first) show the flag until you point at the card."],
      ] },
    ],
    saving: ["Nothing is saved. The world here has no career in it (no player results, no real-player strengths)."],
    inGame: [
      "The same world runs inside every career. Your nation's call-ups come at each international window and before each tournament; Stats → Country shows the manager bar, the ranking, your tables, your matches and Who won; Relations shows the national manager.",
    ],
    dev: "app/star-intl-dev/page.tsx; the world lib/star/intl (world.ts, replay.ts, build.ts, engine.ts, uefa.ts, conmebol.ts, concacaf.ts, caf.ts, afc.ts, ofc.ts, worldCup.ts, friendlies.ts, realData.ts, hosts.ts, windows.ts, nations.ts); your career on it lib/star/intl/career.ts; screens components/star/CallUpScreen.tsx, IntlWorldPanel.tsx.",
  },
  "/star-real-moments-dev": {
    title: "Real moments",
    what: "Real match positions in our engine, from free-licensed data (cleared for a paid game, with credit). Fully real: every shot and corner of 7 Bundesliga / 2. Bundesliga 2022/23 matches (DFL tracking), 20 A-League 2024/25 matches (SkillCorner tracking) and 10 university matches in Japan (SoccerTrack v2 tracking), all 22 players where they really stood. Real shot, placed defenders: every World Cup 2018 / Euro 2016 shot (Wyscout): the shot is real, the other players are placed by the game's own rules. Each is drawn as a chance in the game's camera and playable in the real match. It is also where you choose which real moments the game may serve (Settings → Full highlights rebuild → Real moment highlights).",
    buttons: [
      { group: "Filters", items: [
        ["Fully real shots / Fully real corners / Real shots, placed defenders", "Which set to show, with how many there are. Every row says Fully real or Real shot, placed defenders."],
        ["Every kind / One-on-one / In the box / Tight angle / Long range / Free kick / Corner", "Which chance kind the moment was put in. \"In the box\" is a close shot with defenders in the way."],
        ["All / xG under 8% / 8–50% / Over 50%", "How likely the real shot was to go in (DFL's own number for DFL shots; our model fitted on 45,287 Wyscout shots for the rest). Not shown for corners."],
        ["Goals only / Led to a goal", "Only shots that went in for real (corners: only corners whose move ended in a goal)."],
        ["Search players, matches", "Only moments whose player, match or competition has these words."],
        ["In the game: All / In game / Left out", "Fully real shots only: every one, only those the game may serve now, or only those it may not."],
      ] },
      { group: "In the game (left)", items: [
        ["The count", "How many fully real open-play shots the game may serve, by kind (one-on-one, tight angle, long range). With Real moment highlights On, about 1 in 4 open-play chances of those kinds is one of them."],
        ["Commit marks to the game", "Writes every mark not yet in the code into data/realmoments/picks.json on main (a real git commit; needs GITHUB_TOKEN). Greyed out when every mark is already in the code."],
      ] },
      { group: "The list (left; under the picture on a phone)", items: [
        ["A row", "Picks that moment: it shows big on the right. A small picture, the player and minute, the match, the kind and xG, which kind of picture it is, and (fully real shots) In game or Left out, with \"(by hand)\" when someone marked it."],
        ["More", "Shows 24 more."],
      ] },
      { group: "The picked moment", items: [
        ["The picture", "Red = defenders, green = keeper, blue = team-mates, YOU = the real shooter (or corner taker), with the ball at his feet. Only people inside the camera are kept."],
        ["▶ Play / ■ Stop", "Plays the real match on that picture, or goes back to it. Nothing is counted or saved."],
        ["Next to the game's own", "Puts a chance the game made of the same kind beside the real one, with its own Play."],
        ["In the game: yes / no", "Whether the game may serve this moment, and why: in automatically (passes every check), left out automatically (and the check it fails: a header, a set piece, not all 22 on the pitch …), or marked by hand. Corners and placed shots are never served."],
        ["Use in game / Don't use / Automatic", "Marks this moment. Use in game: the game may serve it even if a check left it out. Don't use: never. Automatic: back to the checks. Saves at once, for everyone (or on this device only until the table exists; it says which)."],
      ] },
    ],
    saving: [
      "The moments are read from data/realmoments/ (tracked.json, tracks.json, wyscout_shots.json) each time the page opens.",
      "A mark saves at once to the shared table star_real_moments_picks, which every game reads on top of the committed file, with no deploy. It also keeps a copy on this device. Until the table exists, a mark stays on this device only (and counts in the game on this device), and the page says so.",
      "Commit marks to the game writes them into data/realmoments/picks.json on main (a real commit) and into the table.",
    ],
    inGame: [
      "Settings → Full highlights rebuild: On → Real moment highlights: On. Then about 1 in 4 open-play chances of a kind the real moments have (one-on-one, tight angle, long range) is a real moment marked In game here: the ball and every man where they really stood, with the real 4 seconds before it as the build-up (a tap skips it). Off: the game is exactly as before.",
      "To see one at once while testing: add ?fhr=on&realmoments=every to the career's or Infinite Match's address: every open-play chance of those kinds is then a real one (never stored).",
    ],
    needs: ["The star_real_moments_picks table (supabase/migrations/star_real_moments_picks.sql). Until it is run, marks stay on this device only. Commit needs GITHUB_TOKEN."],
    dev: "app/star-real-moments-dev/page.tsx, GamePicks.tsx; lib/star/realMoments/ (types, shots.ts scenarioForShot / scenarioForCorner, track.ts buildUpOf / trackLeadIn, picks.ts, pickStore.ts); lib/star/fhr/realMomentHighlights.ts (which moments, serving, the build-up), realMomentToggle.ts; lib/star/chanceMaker.ts (step 1b); lib/star/leadInGen.ts careerBuildUp; app/api/star/real-moments/route.ts, app/api/star/real-moment-picks/ (+ /commit); data/realmoments/ (README, picks.json); scripts/realmoments/ (extract_tracking.py, extract_wyscout.py, soccertrack_compact.py, extract_soccertrack.py); credit lines in data/opendata/LICENCES.md and lib/star/dataCredits.ts; tests/star/realMoments.mts, realMomentHighlights.mts.",
  },
  "/star-real-shots-dev": {
    title: "Real shots (test)",
    what: "Real shots on our pitch, playable in the real match, from free-licensed data. Fully real (581): every shot of 7 Bundesliga / 2. Bundesliga matches (DFL tracking) and 20 A-League matches (SkillCorner tracking), every player where he stood. Real shot, placed defenders (2,905): every shot of the 2018 World Cup and Euro 2016 (Wyscout): the spot, who, how and what happened are real; the other players are placed by the game's own rules. Each card says which it is.",
    buttons: [
      { group: "Layout (top right)", items: [
        ["🗺️ Shot map", "Filters on the left, a map of every shot that passes them in the middle (tap a dot), and the picked shot big on the right with its Play button. Every shot is listed below as rows. On a phone the filters fold into a Filters (n) button."],
        ["▦ Cards", "A total of the shots and a goals bar, the filters as a row of drop-downs, then a grid of shot cards. Same shots, same buttons. The page remembers which layout you used last (on this device)."],
      ] },
      { group: "Tabs", items: [
        ["Shots", "The list of real shots, each with its picture and Play button."],
        ["Moving highlight", "Only shots with a real build-up. ▶ Watch the move: the match radar follows the move, then the real match replays it in its own picture (2D or 3D: the 3D | 2D button in the match bar). Fully real: the ball and every player move where they really moved for the 4 seconds before the shot. Placed: the last real passes at the real timing, the others moving from their team's shape. Then the shot is yours, live, from exactly there. ↺ Again replays it; ■ Stop closes it. The replay is recorded positions, not physics."],
        ["Ours vs real", "Four bars per chance kind: shot distance, defenders between ball and goal, nearest defender, keeper off his line. Real = the fully real shots of that kind (tracking); Ours = 200 of the game's own chances of that kind."],
      ] },
      { group: "Filters", items: [
        ["Picture", "Both kinds, Fully real (tracking) or Real shot, placed defenders."],
        ["Competition", "Bundesliga 2022/23, 2. Bundesliga 2022/23, A-League 2024/25, World Cup 2018 or Euro 2016."],
        ["What happened", "Every shot, Goal, Saved, Off target, Blocked or Other (A-League shots only say goal or not: they are Other unless they went in)."],
        ["How it came", "Any way, Open Play, Free Kick, Penalty or Corner."],
        ["Chance of a goal (xG)", "Any xG, under 8%, 8–30% or over 30% (DFL's own number for DFL shots; our model fitted on 45,287 Wyscout shots for the rest)."],
        ["Search", "A player or team name."],
        ["More", "Shows 20 more."],
      ] },
      { group: "Each shot", items: [
        ["The map (Shot map)", "Each dot is a shot, where it was struck, coloured by what happened (green goal, yellow saved, orange blocked, grey off target, white other). Tap one to show it in Shot details."],
        ["The picture", "Our pitch from above, goal at the top. Yellow = the shooter, white = ball, red = opponents, green = keeper, blue = team-mates. Filled = where they really stood; rings = placed by the game's rules. The dashed line is where the shot went."],
        ["Fully real / Placed defenders tag", "Which kind of picture it is."],
        ["▶ Play this shot", "Plays the real match on that picture at the top of the page: the shooter is YOU. Nothing is counted or saved."],
        ["■ Stop", "Closes the match."],
      ] },
    ],
    saving: ["Nothing saves. The shots are read from data/realmoments/ each time the page opens."],
    inGame: ["Nowhere yet. The data is cleared for the game (with the credit lines at the bottom of the page); the Full Highlights Rebuild is meant to use it."],
    dev: "app/star-real-shots-dev/page.tsx, MovingHighlight.tsx (radar + EnginePlay inside components/star/Match3DLayer.tsx); lib/star/realMoments/ (shots.ts kindForShot / scenarioForShot / the measures, leadin.ts leadinTrack for passes, track.ts trackLeadIn for tracking); lib/star/leadIn.ts (the lead-in CanvasMatch replays); app/api/star/real-moments/route.ts; data/realmoments/; scripts/realmoments/; tests/star/realMoments.mts, leadIn.mts, leadInTvCamera.mts.",
  },
  "/star-real-goals-dev": {
    title: "Real Goals (test)",
    what: "A little game of real goals (Leo, 18 Oct 2026). Every non-penalty goal of the 2018 World Cup and Euro 2016 (232) and, since 20 Oct 2026, of the 2017/18 Premier League, La Liga, Serie A, Bundesliga and Ligue 1 (4,393 more), all from Wyscout's free data, played in the real match: the real move is replayed first, then the shot is yours. Score it, and the closer your ball crosses the line to where the real one went, the more stars. Wyscout has nobody's position off the ball, so the defenders and keeper are placed by the game's own rules.",
    buttons: [
      { group: "Top", items: [
        ["★ total (top right)", "Every star you have, out of 150 (50 levels × 3)."],
        ["The big card · PLAY IT", "The next level to play: the first open level without three stars. Its picture shows where the real goal went in (green dot). PLAY IT opens it."],
        ["🗺️ Levels", "The levels as rows, one row per stage (Group stage → The final), 10 goals each, easiest first (difficulty: the chance of a goal from our model, distance, a top corner, a header). ‹ › move a row along (on a phone, swipe it). Each card: level number, where the real goal went in, scorer and minute, who it was against, your stars, ▶ to play. A level opens when the one before it has a star; a stage opens at 6 / 15 / 26 / 38 stars in all."],
        ["🔎 All 4,625 goals", "Every goal, searchable by player, team, match, stage or date. The chips under the search show one competition at a time (All, World Cup 2018, Euro 2016, Premier League, La Liga, Serie A, Bundesliga, Ligue 1), with how many goals each has. The league goals load a moment after the page (the count shows … until then); they are in this list only, not the level map. A league goal shows its match date where a tournament goal shows its round. The famous ones (Pavard v Argentina, Ronaldo's free kick v Spain, Kroos v Sweden, Shaqiri's overhead kick, Bale v Slovakia…) are first. More shows 20 more. The page remembers which of the two you had open."],
      ] },
      { group: "Playing a goal", items: [
        ["The header", "The real score just before the goal, the minute, who you are and the body part."],
        ["👻 Ghost on/off", "The real goal's ball, drawn faint on the pitch: a dashed line along its flight and its shadow, and a pale ball running it on a loop while you aim. Once you strike, it races your ball. Wyscout has where the ball was struck and which part of the goal it went in (low / middle / high × left / centre / right), so the ghost aims at that part's middle and the arc is drawn the shape the strike suggests."],
        ["▶ Build-up on/off", "On: the real move is replayed first (every pass and carry at the real time, up to 14 s), then the shot is yours. Off: straight to the shot."],
        ["🎥 TV / Behind him / Side-on", "The 3D camera (3D | 2D button in the match bar): the TV view, low behind the shooter, or turned side-on. Kept only while this page is open; your own camera lock comes back when you leave."],
        ["The match", "The real match. The real sides' names and kits (nations, and the 98 league clubs in their 2017/18 colours), the scorer's and the conceding keeper's real names: never the test club. You strike as an elite finisher (power 85, technique 95, curl boots), clear weather, nobody closes you down. Strike it along the real goal's line (within 60 cm across, 55 cm up, inside the posts) and nobody blocks it and the keeper does not save it. Off the line it plays as normal."],
        ["The result", "Goal or not, the % like the real goal (100% on the spot, 85% at 45 cm off, 60% at 80 cm), the stars (★ a goal, ★★ 60%+, ★★★ 85%+), and a picture of the goal mouth with the real spot (green) and yours (blue). ↺ Again: the same chance comes back, just shoot. Next level → once you have a star."],
        ["✕", "Closes the goal."],
      ] },
    ],
    saving: ["Your stars and best % per goal are kept in this browser only (localStorage, star-real-goals-progress-v2; the old v1 stars were for the earlier, licensed goals (removed 19 Oct 2026) and are not carried over). Nothing goes to the database or the repo."],
    inGame: ["Nowhere yet. This is a test page."],
    dev: "app/star-real-goals-dev/page.tsx; lib/star/realGoals.ts (levels, stars, accuracy, kits, names, ghost, build-up) and lib/star/realGoalView.ts (what the match is handed); CanvasMatch's `realGoal` prop (drawing only, TEST_ONLY in scripts/one-engine-guard.mjs); canvasEngine.ts Scenario.realLane (the real lane, off by default); data/realmoments/wyscout_shots.json + wyscout_goals.json (scripts/realmoments/extract_wyscout.py); the league goals in data/realmoments/wyscout_league_<england|spain|italy|germany|france>.json (scripts/realmoments/extract_wyscout_leagues.py); tests/star/realGoals.mts and tests/star/realGoals/ (harness, measure, buildup).",
  },
  "/star-goal-clips-dev": {
    title: "Goal videos",
    what: "Score a chance in the real match and watch the goal back as a video from three cameras, then save it. The same recordings the post-match feed plays.",
    buttons: [
      { group: "1 · Score one", items: [
        ["Penalty / One-on-one / Free kick / Cut-back", "Which chance you get. The keeper is weak (25) and the weather clear, so a goal comes quickly."],
        ["New chance", "A fresh chance of the same kind."],
        ["Drag back from the ball, then tap the ball", "The real match's own kick. Every goal is recorded frame by frame, exactly as a career match records it."],
      ] },
      { group: "2 · Recordings on this device", items: [
        ["A goal in the list", "Picks that recording. The newest goal is picked by itself."],
      ] },
      { group: "3 · Watch it", items: [
        ["TV / Behind the goal / Fan in the stand / TikTok edit", "Who posts it. TV is the club's and the league's cut (live, then two replays from other cameras); Behind the goal is pages and papers; Fan in the stand is a fan's or a team-mate's phone video; TikTok edit is meme pages and TikTok accounts (tall, slows right down for the strike, big captions)."],
        ["Cut: 1 / 2 / 3", "Each account cuts its goals one of these ways (which one is fixed by its name), so two accounts rarely post the same video. TV cut 1: behind the goal + spider-cam; 2: pitch-side low + behind the goal; 3: spider-cam + behind the goal."],
        ["▶ (on the picture)", "Plays the video. It is made on this phone in the background as soon as the post comes near the screen, so in the feed it is usually ready (and playing) by the time you reach it."],
        ["Speaker (bottom left of the video)", "Sound on or off for every goal video: the crowd, the kick, the net, the commentator's call and the co-commentator over the replay (not on the fan's phone video, which has only the crowd). Remembered on this device. The sound is inside a saved video too, where the browser can make it."],
        ["Save video", "On a phone: the share menu (Save Video puts it in Photos). On a computer: a download. If the video is not made yet, it is made first; then tap Save video again."],
      ] },
    ],
    saving: [
      "Recordings are kept in this browser only (the browser's own database), never in the career save and never online. The newest 80 are kept, plus any saved as a goal replay.",
      "Saved videos go wherever you save them: Photos, a message, your downloads.",
    ],
    inGame: [
      "After a match, a post that looks like a video now plays the real goal: the club's post with the TV camera, pages with the camera behind the goal, fans with a phone in the stand.",
      "A post with no goal recorded (a meme, a missed penalty, a match you skipped) shows a picture with no play button.",
      "Settings → Goal Replays (admin) plays the recording too, so a replay is always the same goal.",
    ],
    needs: [
      "A browser that can make video (iPhone iOS 16.4 or later, Chrome, Edge, Firefox on a computer). Others show the plain picture with no play button.",
    ],
    dev: "app/star-goal-clips-dev/page.tsx; recorder lib/star/goalClip/recorder.ts (fed by CanvasMatch's onGoalClip); format track.ts; cameras cameras.ts; drawing scene.ts, render.ts; cuts edit.ts; the file encode.ts (WebCodecs + mp4-muxer / webm-muxer); storage store.ts (IndexedDB); the post components/star/media/GoalVideo.tsx.",
  },
  "/star-relgames-dev": {
    title: "Relationship games",
    what: "Every relationship game from the relationships revamp, on a made-up player, so you can try each one without playing a career up to it.",
    buttons: [
      { items: [
        ["Games list (left)", "Each game with a picture of its first screen and the bar it moves. Tap a row to see it in Preview; tap ▶ on the row to play it straight away."],
        ["▶ Start (Preview)", "Opens the picked game. The manager opens a picker of 3: Penalties, Office talk, Extra session. Back or Continue returns here. (Day off is gone: happiness is now the average of boss, team and fans.)"],
        ["Moment: made captain / Moment: dropped to the bench", "Shows what the manager says when he gives you the armband, or drops you to the bench (in his office; the same words on a plain card if Settings → Look → Talk to your manager is Old). Continue returns here. The bench reason follows the bar level and form: 20 = he is not happy with you, Out of form = your form."],
        ["Before the game → 20 / 50 / 75 / 90", "The level of every bar before the game, so you can see what a win pays at each level. The bars on the list show it."],
        ["Before the game → In form / Ordinary / Out of form", "Your last match rating. Office talk uses it: out of form, one question tests how you take a bad game; in form, whether it went to your head."],
        ["Before the game → Starting / On the bench, trusting / demanding / rotational", "Only used by the old manager talk, which is no longer in the game. Office talk reads the manager's playing style off his name instead."],
        ["Fixed in the game", "The games' own numbers (kicks, questions, shots, fans, what a win pays), read from the game's files. Shown only: change them in the code."],
        ["Last game (Preview)", "What the last game returned: won or lost, and the change."],
      ] },
    ],
    saving: ["Nothing is saved. It is a test player that resets when you leave."],
    inGame: ["Relations (boss, team, fans) and the Sponsors screen (the advert, on each deal)."],
    dev: "app/star-relgames-dev/page.tsx; the games are components/star/relgames/, their rules lib/star/relationships.ts, lib/star/bossPenalties.ts, lib/star/bossTalk.ts and lib/star/bossSession.ts.",
  },
  "/admin/star-xp": {
    title: "XP Book",
    what: "Every amount of XP the career gives, on one page. Change a number, tick it off as checked, or leave a note on what should change. New achievements, records, awards and milestones go in New ideas.",
    buttons: [
      { group: "Top bar", items: [
        ["In a match / Multipliers / Trophies / Awards / Achievements / Records / Milestones & status / New ideas", "Shows that part of the book. \"3 to check\" counts the items not yet marked Confirmed or Change it."],
        ["Save", "Saves every amount, check and note for everyone. Lights up once something has changed."],
        ["Reset amounts", "Puts every XP amount back to what the code ships with. Your checks, notes and ideas stay. Nothing is saved until you press Save."],
      ] },
      { group: "Each row", items: [
        ["The number box", "The XP it pays (or the multiplier, or a %). Type a new amount."],
        ["Was … in the code", "Shows when your amount is different from the code's."],
        ["Not checked / Confirmed ✓ / Change it", "Tap to move it on. Change it opens a note box: write what should change and it gets built from that."],
        ["Easy / Medium / Hard / Legendary / Own amount", "Achievements only: which level it pays (Bronze, Silver, Gold, Legend on the player's list), or Own amount to type its own XP."],
      ] },
      { group: "New ideas", items: [
        ["+ Add an idea", "A new achievement, record, award or milestone: its name, how you get it, and the XP it should pay."],
        ["Delete", "Removes an idea."],
      ] },
    ],
    saving: [
      "Save writes everything to the shared XP Book row (Supabase table star_xp_config). Every career uses the amounts the next time it loads.",
      "Saving needs an admin sign-in. Without one, or without the table, it says \"Saved on this device only\" and only this browser's game uses the change.",
      "A level a player already has never goes down when you lower an amount: their best is kept. A raise shows straight away.",
      "Ideas pay nothing until they're built. Achievements and records themselves (what unlocks them) are in the code; this page sets what they pay.",
    ],
    inGame: ["The star bar and every XP number in the career: the after-match XP card, the Star Pass breakdown, and the level you're on."],
    needs: ["supabase/migrations/star_xp_config.sql must be run in the Supabase SQL Editor for Save to reach everyone. Until then the page says \"shared save not set up\"."],
    dev: "lib/star/xpConfig.ts (DEFAULT_XP, xp(), setXpConfig), lib/star/xpStore.ts, app/api/star/xp-config/route.ts. lib/star/starPoints.ts reads every amount through xp(). app/star-dev/page.tsx calls refreshXpConfig() on load.",
  },
  "/admin/star-pass": {
    title: "Star Pass Rewards",
    what: "Every reward in one catalogue, by type, and which reward sits at which Star Pass level. A reward can go on any level from 1 to 100.",
    buttons: [
      { group: "Reward types (left)", items: [
        ["Penalty run-ups / Free-kick run-ups / Celebrations / Wearables / Boots / Balls / Vehicles / Other", "Shows that type of card in the catalogue. The number is how many cards it has. On a phone they sit at the top of the catalogue."],
      ] },
      { group: "Tiers", items: [
        ["Rookie / Pro / Star / Legend / Icon", "The 100 levels in five tiers of 20. Each card shows some of its rewards and how many of its levels have one."],
        ["Edit tier", "Opens that tier's levels below. \"Editing\" marks the open one."],
      ] },
      { group: "The open tier", items: [
        ["Level squares", "Picks a level. Gold squares already have a reward. The next card you tap goes on the picked level."],
        ["On the road", "Every level in this tier that has a reward, plus the one you picked. Tap a row to pick it."],
        ["↑", "Moves this reward up one level (swaps if that level has one)."],
        ["↓", "Moves this reward down one level (swaps if that level has one)."],
        ["✕", "Empties the level."],
      ] },
      { group: "Catalogue", items: [
        ["Tap a card's picture", "Puts it at the picked level (taking it off any level it was on). Tapping another card replaces it."],
        ["👁", "A big preview. 3D ones can be dragged to spin and tapped to zoom."],
        ["Idea / Designed / In game", "The card's status. Tap to move it on: idea, then designed, then in game."],
        ["Lv 10", "Shows which level the card is on."],
        ["+ Idea", "Adds a card for something not built yet: a name and a line about it. It shows as a 💡 until it's built."],
        ["Delete", "Only on idea cards: removes it (and empties its level)."],
      ] },
      { group: "Top bar", items: [
        ["Save", "Saves the layout for everyone. Lights up once something has changed."],
        ["Reset", "Puts back the five test rewards at levels 5 to 25 and empties the rest. Nothing is saved until you press Save."],
      ] },
    ],
    saving: [
      "Save writes the layout (levels, idea cards, statuses) to the shared Star Pass row (Supabase table star_pass_config). Every career's Star Pass reads it the next time it opens.",
      "Saving needs an admin sign-in. Without one, or without the table, it says \"Saved on this device only\" and only this browser sees the change.",
      "The cards themselves (pictures, 3D, what you get) are in the code. Making a new design is a build job; this page only chooses and orders them.",
    ],
    inGame: [
      "The Star Pass (tap the star rating in the top bar): a podium stands at every level that has a reward, and at level 100. Levels with nothing show no podium. Reach the level and a Claim button appears, with a red dot on the star.",
      "Claim plays the reveal, then the reward goes into the Locker (the Locker button on the Star Pass). Run-ups and accessories are used in matches; cars, balls and sunglasses are kept for when the avatar is ready.",
    ],
    needs: [
      "The star_pass_config table (supabase/migrations/star_pass_config.sql). Until it is run, the game uses the five test rewards built into the code and Save stays on this device.",
    ],
    dev: "app/admin/star-pass/page.tsx · lib/star/rewardCatalogue.ts · lib/star/starPassStore.ts · lib/star/starPassClaim.ts · app/api/star/star-pass/route.ts",
  },
  "/admin/xp": {
    title: "XP & Rewards",
    what: "The rewards players unlock as they level up — card frames, manager titles and trophies — plus a read-out of the XP numbers.",
    buttons: [
      {
        items: [
          ["Rewards", "The list of unlockable rewards, grouped into Card Frames, Manager Titles and Trophies."],
          ["+ Add Reward", "Opens a form for a new reward; Create Reward saves it."],
          ["Edit / Delete", "On each reward. Edit opens it; Save Changes saves it."],
          ["XP Curve", "Read-only table of how much XP each level (1–50) needs."],
          ["XP Awards", "Read-only list of how much XP each action gives (winning a draft, creating a tierlist, login streaks…)."],
          ["Admin (top line)", "Opens the Team board, the admin's home."],
        ],
      },
    ],
    saving: [
      "Rewards save straight to the live database (Supabase table rewards) and apply to every player immediately.",
      "On a local test build the list still loads but is read-only: saving needs the site's database key, and an amber note says so. Any other problem (not signed in, not an admin, the table missing) is said in plain words in the red box.",
      "The XP curve and XP awards are set in the code, not here — ask for a code change to alter them.",
    ],
    inGame: ["Players' profiles and level-up unlocks across the whole site."],
    dev: "app/admin/xp/page.tsx · /api/admin/xp/rewards · lib/xp.ts",
  },

  "/admin/custom-clubs": {
    title: "Custom Clubs",
    what: "Invent a whole club from scratch — name, kit, badge, stadium, a squad of made-up players and a lineup.",
    buttons: [
      {
        items: [
          ["Clubs list: New club name… + Add", "Creates a new club."],
          ["Clubs list", "Tap a club to edit it on the right (below on a phone)."],
          ["Delete club", "Top right of the Edit club panel. Deletes the club (and its badge link)."],
          ["Kit & badge", "Stadium name, home and away colours, and Upload badge. Save changes saves it."],
          ["squad", "Its players. \"+ Create a new player\" or tap one to edit: name, rating, positions, age, nationality, face, and potential (Ordinary / High Potential / World Class). Save saves him."],
          ["lineup", "The same squad builder as the Squad Builder page: tap a player, tap where he goes."],
        ],
      },
    ],
    saving: [
      "Everything saves straight to the live database: the club in custom_clubs, its players as real rows in sofifa_players (this season's edition), its badge in club_logos, its lineup in star_lineups.",
      "Badges are uploaded to Supabase Storage.",
    ],
    inGame: [
      "A custom club only enters the career game when it's voted into a competition through the Rule Book (Custom Clubs section) in /star-dev.",
    ],
    needs: [
      "The custom_clubs table (supabase/migrations/custom_clubs.sql) and the star_lineups table (star_lineups.sql). If creating a club fails, a missing table is the likely cause.",
    ],
    dev: "app/admin/custom-clubs/page.tsx · /api/admin/custom-clubs, /api/admin/custom-clubs/players",
  },

  "/admin/football": {
    title: "Football Data",
    what: "The Wikidata football database behind the Tic Tac Toe game — browse clubs and players, build and save grids, and import data.",
    buttons: [
      {
        items: [
          ["Browse", "Search clubs and players; tap a club for its squad (Show All-Time for everyone who ever played there), tap a player for his career. \"Re-fetch from Wikidata\" refreshes one player's career."],
          ["TTT Helper", "Type 3 row and 3 column clubs/countries, then Generate Grid to find the answers. Give it a title and difficulty and press Save Puzzle to add it to the Tic Tac Toe puzzles. Check tests whether one player fits."],
          ["Database", "Refresh Stats, \"Import from Wikidata\" (or Resume from a year), Import one player by his Wikidata id, Fix Missing Careers, and Clear All Data (wipes the whole football database — careful)."],
          ["Admin (top line)", "Opens the Team board, the admin's home."],
        ],
      },
    ],
    saving: [
      "Everything writes straight to the live database: football_players, football_clubs, football_careers, football_countries.",
      "Save Puzzle writes to tictactoe_puzzles — it becomes a real puzzle.",
    ],
    inGame: ["The daily Tic Tac Toe game checks answers against this data."],
    dev: "app/admin/football/page.tsx · /api/admin/football/import, /players, /leagues · /api/tictactoe",
  },

  "/admin/football/players": {
    title: "Players",
    what: "Every player in the SoFIFA database, one row per player with every FIFA edition under it — fix names, ratings, positions and potential.",
    buttons: [
      {
        items: [
          ["Search", "Find players by name, club, position or edition."],
          ["☆ High Potential / ☆ World Class", "Tags the player's FC 27 edition as a wonderkid (★ when on). Tap again to take it off."],
          ["Click a name / positions / OVR", "Edit it in place. Your value is kept even if the data is re-scraped."],
          ["Edit (per edition)", "Club, league, potential, age and attributes. Save Changes saves; Close closes."],
          ["Clone", "Copies the player into another year, optionally with a new rating, club or positions. Move does the same and deletes the old year."],
          ["Delete", "Deletes that one edition."],
          ["Admin / Football Data (top line)", "Admin opens the Team board, the admin's home. Football Data opens the football data page."],
        ],
      },
    ],
    saving: ["Every change writes straight to the live database (sofifa_players) and is used by the games straight away."],
    inGame: [
      "PL Draft, the Star Career squads and team sheets, and anything else that shows real players.",
      "The wonderkid tags drive the Star Career's wonderkid growth, transfer fees and media hype.",
    ],
    needs: [
      "High Potential needs high_potential.sql run; World Class needs world_class_potential.sql. Until then the tag buttons can't save.",
    ],
    dev: "app/admin/football/players/page.tsx · /api/admin/football/player-search, /data-stats",
  },

  "/admin/football/pl-clubs": {
    title: "PL Clubs",
    what: "A read-only list of which clubs the PL Draft has for which season.",
    buttons: [
      {
        items: [
          ["By Season", "Every season, with the clubs in it."],
          ["By Club", "Every club, with the seasons it has."],
        ],
      },
    ],
    saving: ["Nothing — this page only reads."],
    inGame: ["These are the club-seasons the PL Draft spins from."],
    needs: ["It's faster once draft_club_seasons.sql is run (it works without it, just slower)."],
    dev: "app/admin/football/pl-clubs/page.tsx · /api/draft/clubs",
  },

  "/admin/football/scrape": {
    title: "Scrape / Import",
    what: "Get player data from SoFIFA into the database, one FIFA edition at a time, plus club and league logos.",
    buttons: [
      {
        items: [
          ["Test SoFIFA Connection", "Checks the server can reach SoFIFA."],
          ["Load DB Stats", "Shows how many players each edition has (Database Coverage)."],
          ["Normalise Attributes (non-FC26)", "Rewrites every older edition's attributes into the FC 26 format, a year at a time. Asks first."],
          ["Debug: Test 1 Player Update", "Tries that rewrite on one player only."],
          ["Edition buttons (Scrape from SoFIFA)", "Scrapes one edition (2–5 minutes). Yellow = running, green = done, red = failed."],
          ["Import (Import from File)", "Upload a CSV/JSON made by the Python scraper when SoFIFA blocks the server. Tick \"Clean import\" to delete that edition's old rows first."],
          ["Import Logos", "Paste club and league logo lists and save them."],
        ],
      },
    ],
    saving: [
      "Players write straight to the live database (sofifa_players). Your own manual fixes (names, positions, ratings) survive a re-import.",
      "Logos write to club_logos and league_logos.",
      "Player photos are NOT done here — they come from the local Python scripts.",
    ],
    inGame: ["Every game that shows real players and crests: PL Draft, Star Career, Ballon d'Or."],
    dev: "app/admin/football/scrape/page.tsx · /api/admin/football/scrape-sofifa, /import-sofifa, /import-logos, /normalize-attributes",
  },

  "/admin/patch-notes": {
    title: "Patch Notes",
    what: "Every version of the patch notes, readable inside the site.",
    buttons: [
      {
        items: [
          ["Version list", "Tap a version to read it. The small H / M / L faces show who has read it (bright = read; the author counts as read). On a phone a red dot = you haven't read it yet."],
          ["Read by H ✓ read · M wrote it · L not yet", "Who has read this version. Only versions from 18 Oct 2026 on count towards \"to read\"; older ones show faces but never nag."],
          ["Read and understood", "Say you have read and understood this version. Press again (✓ Read and understood) to take it back. Not shown on your own patch notes."],
          ["💬 Notes", "Opens a short notes thread under this version. Add a note; ✕ deletes your own. The author gets a red number on Patch notes in the Team room."],
          ["❝ Pick lines (in Notes)", "Lists every headline of this version. Tap the lines your note is about; they are quoted at the top of the note (✕ takes one out)."],
          ["❝ Quote my selection (in Notes)", "Shows after you select some words on the page or in Text. Adds them as a quote."],
          ["@Mikey / @Leo / @Harry / @all (in Notes)", "Adds an @ to your note. That person gets it in their 🔔 Inbox and, with phone notifications on, a buzz (@all = the other two)."],
          ["🔔 Inbox (top right)", "The patch notes you haven't read yet, from 20 Oct 2026 on (older ones never show), newest first, plus notes under a patch note that @ you (Mentions). The red number is how many. Tap a patch note: it opens and counts as Read and understood. Tap a mention: that version opens with its notes showing. ✓ marks one read without opening it; Mark all read clears the list. Only Harry, Mikey and Leo see it."],
          ["Page", "The version's artifact exactly as it was published, pictures and all. Kept in the code, so it works even if the link changes."],
          ["Text", "The same notes as plain data, in the site's own style."],
          ["Harry's notes", "Only on versions Harry has reviewed: his spoken notes from his recordings (likes, concerns, questions), each with the video and timestamp. Written in by Claude, not typed on this page."],
          ["Open the original artifact ↗", "Opens the shareable page on claude.ai for that version, if it has one."],
        ],
      },
    ],
    saving: [
      "The notes themselves don't save here. New patch notes are added by Claude as part of shipping a change.",
      "Read and understood and the notes under a version save to the shared database at once (team_acks, team_notes), so the other two see them. Until supabase/migrations/team_room_v2.sql runs they stay on this device only, and the page says so (then an @ in a note can't buzz anyone or reach their Inbox).",
      "The Inbox has no table of its own: a patch note leaves it when you say Read and understood (or open it from the Inbox), and a mention leaves it when you open that version's notes. Both are the same saved receipts (team_acks).",
      "A new patch note on the site buzzes everyone but its author once (one buzz per person, however many notes are new; only notes from the last 3 days). The site sends it the first time one of the three opens an admin page after the deploy. Who has been buzzed for which version is kept in each person's sign-in account, so no SQL.",
    ],
    commit: ["New entries live in a file, not the database. Each build ends with its patch notes going to main at once in a patch-notes-only pull request (scripts/patch-notes/ship.mjs), without the feature code; they appear after that deploys. Each version's page and pictures are copied into patch-notes/ in the repo."],
    inGame: ["Admin only. Players never see this page."],
    needs: ["supabase/migrations/team_room_v2.sql (PENDING) for read ticks and notes to be shared. Run after team_room.sql."],
    dev: "app/admin/patch-notes/PatchNotesArchive.tsx · lib/patchNotesData.ts · lib/patchNotePages.ts · lib/patchNoteReviews.ts · patch-notes/ · read ticks: components/teamRoom/PatchReceipts.tsx, lib/teamRoom/extras.ts · Inbox: components/teamRoom/InboxBell.tsx, lib/teamRoom/inbox.ts · quotes: lib/teamRoom/patchQuote.ts · buzz: /api/admin/team/notify {patches:true} and {table:\"team_notes\"}",
  },

  "/admin/sound-board": {
    title: "Sound Board",
    what: "Every game sound in one list: what it is, where the game plays it, and a way to swap in a new one.",
    buttons: [
      {
        items: [
          ["Group pills (top)", "Jump to that group of sounds."],
          ["Sound name / Edit", "Opens the Edit sound panel for that sound: on the right on a computer, under the row on a phone. Replace, ▶ Original and Put the original back are there."],
          ["▶", "Plays the sound as the game plays it now. If you replaced it, this plays your upload. Tap again (■) to stop."],
          ["Replace / Replace again", "Choose a sound file from your phone or computer (mp3, wav, ogg, m4a or webm, under 2 MB). It uploads at once. Players hear it from the next time they load the game."],
          ["▶ Original", "Only on a replaced sound. Plays the sound that came with the game, so you can compare."],
          ["Put the original back", "Only on a replaced sound. Removes your upload. The game goes back to the sound that came with it."],
          ["Replaced (gold tag)", "This sound has an upload on it."],
          ["Not in the game yet (grey tag)", "The sound file exists but the game does not play it. Kick, net, crowd, keeper and whistle: the match still makes its own sounds. A replacement saves, but nobody hears it until the game is changed to play that file."],
        ],
      },
    ],
    saving: [
      "Shared with everyone, at once. An upload goes to the site's public image storage (folder sfx-overrides) and a small list says which sounds have one.",
      "There is no Save button. Each upload or \"Put the original back\" saves as soon as you press it.",
      "If two admins change sounds in the same second, one change can be lost. Check the gold tags afterwards.",
    ],
    inGame: [
      "The nine sounds marked as in the game: button taps, confirm, money in, star bar, star rating up, achievement, phone post, breaking news, energy can.",
      "Sounds play in the New UI only, and only with Settings → Sound effects switched on.",
      "A device that has the game open keeps playing the old sound until it reloads.",
    ],
    needs: [
      "Nothing to run. There is no database table for this. It needs the public storage bucket (tierlist-images) and SUPABASE_SERVICE_ROLE_KEY set in Vercel, like the other admin uploads.",
      "If the list cannot be read, the game plays the sounds that came with it. Nothing breaks.",
    ],
    dev: "app/admin/sound-board/SoundBoard.tsx · app/api/star/sfx-overrides/route.ts · lib/star/sfxCatalog.ts (the list of sounds) · lib/star/sfx.ts (reads the overrides) · public/sfx/",
  },

  "/admin/star": {
    title: "Game home",
    what: "Every admin and test page, split by game: one tab per game across the top (Road to Ballon d'Or, Website games, Studio). Inside a tab you only see that game's groups and pages. The admin itself opens on the Team area (Team, first in the side menu); the games sit under it. Testers have no Team area: this is their home, and they see only the pages they can open.",
    buttons: [
      { group: "Game tabs (across the top of every admin page)", items: [
          ["🔔 Inbox (top right)", "The patch notes you haven't read yet, from 20 Oct 2026 on (older ones never show), newest first, plus notes under a patch note that @ you (Mentions). The red number is how many. Tap a patch note: it opens and counts as Read and understood. Tap a mention: that version opens with its notes showing. ✓ marks one read without opening it; Mark all read clears the list. Only Harry, Mikey and Leo see it."],
        ["Road to Ballon d'Or", "The career game's groups and pages. This is /admin/star."],
        ["Website games", "PL Draft, Tierlists, Site XP + Tic Tac Toe and the old tests. Opens /admin/star/game/web."],
        ["Studio", "The team: Team board, Patch notes, Videos, Research, App plan, Tester access. Opens /admin/star/game/studio."],
        ["The number on a tab", "How many pages that game has (that you can open)."],
      ] },
      { group: "Top", items: [
        ["← (top left)", "The one back arrow, in the same corner on every admin and test page. Here (a game's home) it goes to the Team area, the admin's home; for a tester to the site (Road to Ballon d'Or) or to the Road to Ballon d'Or home (the other games). On a group page it goes to the game's home; on any other admin page to that page's group."],
        ["Search … pages in (game)", "Type part of a name or what a page does. Searches this game only. While you search, the matching pages show as rows under their group."],
        ["All / Harry / Mikey / Leo", "Show everyone's pages, or only one person's, in this game."],
        ["Saves real data", "Only pages whose buttons change things other players see."],
        ["Grid / List", "The game's groups as big tiles or one row each. Kept on this device."],
      ] },
      { group: "Cards", items: [
        ["A group tile", "Opens that group's own page (its admin tools first, then its test pages)."],
        ["A card (on a group page)", "Opens that page. The letter is its owner. \"Saves real data\" / \"Writes the code\" say what its buttons save."],
        ["Old tests", "Website games tab. Old test pages that are kept but not used day to day."],
        ["Clear", "Shows when a search or filter matches nothing; puts everything back."],
      ] },
      { group: "Side menu", items: [
        ["Team (first line)", "The Team area, the admin's home: Team board, Team chat, Ideas, My to-do, Patch notes. Opens on the Team board. Admins only."],
        ["(Game) home", "This game's home page."],
        ["The game's groups", "Every group of the game you are in, the one you are on lit up. Each opens the group's own page. On a phone they are in ☰ Menu (Team first); on a computer « folds them to icons."],
        ["Videos", "How to hand Claude a screen recording. The same in every game."],
        ["Broadcast / Bento / Ops room / Clean light", "The admin look: the same pages and the same layout in all four, only the paint changes (Broadcast dark blue, Bento a soft colour per group, Ops room near-black and green, Clean light white). Every admin and test page follows it. Kept on this device."],
        ["Admin mode", "On: the admin side menu sits on every page of the site, opened on the admin pages for the page you are on. Off: it hides. Kept on this device."],
      ] },
    ],
    saving: ["Nothing here saves anything shared. The look and Admin mode are kept in this browser only."],
    inGame: ["Nowhere. This is the front door to the tools."],
    dev: "app/admin/home/page.tsx (the front door: admin → /admin/team, tester → /admin/star; the KIB Admin app opens there) · lib/adminRegistry.ts TEAM_HOME, adminHomeFor, backFor · app/admin/star/page.tsx (first game) · app/admin/star/game/[game]/page.tsx (other games) · app/admin/star/g/[group] (a group's page) · app/admin/star/AdminHome.tsx · lib/adminRegistry.ts (GAMES = the tabs: a new game is one line there, then its groups say game: \"<key>\"; GROUPS; ADMIN_PAGES) · components/admin/shell/* · components/AdminNavPanel.tsx (the side menu on other pages, also one game at a time) · lib/adminLook.ts",
  },
  "/admin/research": {
    title: "Research",
    what: "Every research write-up we have made (Football Manager, highlights, 3D and so on), one card each, newest first.",
    buttons: [
      { group: "Page", items: [
        ["←", "Back to the Research group page (Studio tab)."],
        ["All / (a topic)", "Show every write-up, or only one topic's. Shows only when there is more than one topic."],
        ["A card / Read ↗", "Opens that write-up in a new tab. The coloured line is its topic; the date is when it was made."],
      ] },
    ],
    saving: ["Nothing. The list is part of the code: a new write-up is one line in the list file, added by Claude."],
    inGame: ["Nowhere. It is for the team."],
    dev: "app/admin/research/page.tsx · lib/research.ts (RESEARCH: one line per write-up; topic, date, by) · registered in lib/adminRegistry.ts (group research, Studio)",
  },
  "/star-tournament-dev": {
    title: "Tournaments",
    what: "Draw and play a whole Euros or World Cup in seconds, on the real tournament code.",
    buttons: [
      { group: "Page", items: [
        ["European Championship / World Cup", "Which tournament to draw."],
        ["Your nation (box, with its flag)", "The nation you play for; it says if they did not qualify."],
        ["New draw", "A fresh draw of the groups."],
        ["Play matchday 1–3", "Plays the next round of group games."],
        ["Play to the final", "Plays every match left, through the knockouts, to a winner."],
        ["Reset", "Back to the draw."],
        ["← (top left)", "Back to the Real data group page."],
      ] },
    ],
    saving: ["Nothing. It reads and writes only this screen."],
    inGame: ["The same tournaments a career plays in international football."],
    dev: "app/star-tournament-dev/page.tsx · lib/star/tournament.ts",
  },
  "/squad-builder": {
    title: "Dream XI builder",
    what: "Build a dream XI in any formation. An old test: no game uses it yet.",
    buttons: [
      { group: "Page", items: [
        ["Formation", "Picks the shape of the team."],
        ["Drag a player", "Puts him in a position."],
      ] },
    ],
    saving: ["This browser only."],
    inGame: ["Nowhere yet. Kept for a possible Dream XI game."],
    dev: "app/squad-builder/page.tsx · components/SquadBuilder.tsx",
  },
  "/admin/videos": {
    title: "Videos",
    what: "Record your screen and voice here, and the recording goes to your Drive with a clear name and a line to paste to Claude. Admins also get Live share (test): Claude sees your screen a picture a second and hears you, and answers in its chat, even unasked.",
    buttons: [
      { group: "Record", items: [
        ["🔔 Inbox (top right)", "The patch notes you haven't read yet, from 20 Oct 2026 on (older ones never show), newest first, plus notes under a patch note that @ you (Mentions). The red number is how many. Tap a patch note: it opens and counts as Read and understood. Tap a mention: that version opens with its notes showing. ✓ marks one read without opening it; Mark all read clears the list. Only Harry, Mikey and Leo see it."],
        ["Harry / Mikey / Leo", "Who is recording. Goes in the file name. Remembered on this device."],
        ["What is it about?", "A few words for the file name, e.g. keeper dive feels slow."],
        ["Record screen", "The browser asks which screen, window or tab to share. Pick the game. Your voice records too if the microphone is on."],
        ["Microphone", "On = your voice is in the recording. The browser asks once."],
        ["Stop", "Ends the recording. The browser's own Stop sharing bar does the same."],
        ["Connect Drive", "Google asks once to let the site add files to your Drive. After that, each recording saves itself."],
        ["Recorded on your phone? Upload the file", "Pick a video from this device; it goes to Drive the same way."],
      ] },
      { group: "After a recording", items: [
        ["Save to Drive", "Sends it to Drive (only shown if it didn't send by itself)."],
        ["Copy for Claude", "Copies \"Watch this recording: <link>\" to paste into a Claude chat."],
        ["Open in Drive ↗", "The video in your Drive."],
        ["Download", "Saves the video to this device instead."],
        ["Open the Breakdowns folder ↗", "Harry's Drive folder where every breakdown is saved."],
      ] },
      { group: "Live share (test) — admins only", items: [
        ["Start live share", "The browser asks which screen, window or tab to share, then (with Voice on) asks for the microphone. It makes a 6-letter code. Use Chrome or Edge on a computer."],
        ["Voice", "On = what you say is written down as you talk (Chrome, Edge, Safari). Off, or a browser with no voice (Firefox) = type notes instead."],
        ["Copy for Claude", "Copies one line to paste into a Claude chat. Claude then runs the watcher and answers you in its chat."],
        ["Copy link / Watch it ↗", "The page that shows the newest picture and what was said, for anyone on the team to watch."],
        ["Type a note for Claude / Send", "Adds a typed line, as if you had said it."],
        ["Stop", "Ends the share. The browser's own Stop sharing bar does the same. It also ends by itself after 30 minutes."],
        ["Delete", "Shown after Stop. Deletes every picture and line of that share."],
      ] },
    ],
    saving: [
      "Your own Google Drive, folder \"Knowitball screen recordings\" → a folder for whoever is picked under Who is recording (the site makes them the first time), named \"date · who · what it is about (length)\". The file is set to \"anyone with the link\" so Claude can fetch it. You can move the main folder anywhere in Drive; the site still finds it.",
      "The video goes from your browser straight to Google. The site keeps only its name and link (dev_recordings table), so that person's Claude chats break it down the next time they are messaged (scripts/hooks/recordings-hook.mjs). Needs dev_recordings.sql run once.",
      "Drive needs NEXT_PUBLIC_GOOGLE_CLIENT_ID on the site. Until it is set, recordings only download.",
      "Live share: once a second, when the screen changed, a small picture (720 px wide) goes to public storage (tierlist-images → live/<code>/), with what was said (transcript.json) and how it is going (state.json, including how much each picture changed). Only the newest 300 pictures (about 5 minutes) are kept. No table. Anyone with the code can open the pictures while they exist; Delete removes them all.",
      "Claude's side: npx tsx scripts/live-watch.mts <code> prints each line said with the picture on screen at that moment, a SCREEN line when the screen changes (new screen / part changed / small change), and keeps the newest picture in a file it can look at. Claude answers in its chat (about 5–20 s behind), and may comment without being asked. Nothing is said back on this page.",
    ],
    inGame: ["Nowhere."],
    needs: ["Live share needs SUPABASE_SERVICE_ROLE_KEY on the site (it is there for the other admin uploads). Without it, Start shows \"the site has no storage key\"."],
    dev: "app/admin/videos/* · lib/recording.ts (recorder, Drive upload, names; tests/star/recording.mts) · /api/dev-recordings + scripts/hooks/recordings-hook.mjs (auto-read) · the breakdown: scripts/screen-video/, .claude/skills/screen-video/SKILL.md · Live share: app/admin/videos/LiveShareCard.tsx, lib/liveShare.ts (pure; tests/star/liveShare.mts), lib/liveShareBrowser.ts, lib/liveShareStore.ts, /api/admin/live-share, scripts/live-watch.mts",
  },
  "/admin/videos/live": {
    title: "Live share",
    what: "Watch a live share from Admin → Videos: the newest picture of the shared screen and what the person said, every 2 seconds.",
    buttons: [
      { group: "On this page", items: [
        ["(nothing to press)", "It reads by itself every 2 seconds and says Ended when the share stops."],
      ] },
    ],
    saving: ["Nothing. This page only reads the pictures and lines the sharer's browser sends to public storage (tierlist-images → live/<code>/)."],
    inGame: ["Nowhere."],
    needs: ["SUPABASE_SERVICE_ROLE_KEY on the site, as for the Videos page's Live share."],
    dev: "app/admin/videos/live/[code]/* · reads <storage>/live/<code>/state.json, transcript.json, f000001.jpg… (lib/liveShare.ts) · a Claude chat uses scripts/live-watch.mts instead",
  },
  "/admin/team": {
    title: "Team board",
    what: "The Team area: the admin's home. Every way into the admin opens here, on the Team board. Board: what Harry, Mikey and Leo are doing (pushes, pull requests, live bars, patch notes). Chat, Ideas and To-do: the team's live chat, idea board and each person's jobs. Patch notes: every version. Testers have no Team area; they go to the game home instead.",
    buttons: [
      { group: "Side menu (Team area)", items: [
        ["Team (first line, lit)", "The Team area, the admin's home. It is the first line of the side menu on every admin page. These all open here, on the Team board: Admin in the site's top menu, Settings → Developer → Admin pages, Admin & Dev · Team in the admin slide-out, the KIB Admin home-screen app, and ← on a game's home."],
        ["Team board / Team chat / Ideas / My to-do / Patch notes", "The Team area's views, under Team. Each switches in place, the one you are on lit. A red number = something new for you there; amber = a new job given to you."],
        ["Games: Ballon d'Or / Website / Studio / Marketing", "Each game's home (its groups and pages). The game tabs across the top do the same; in the Team area none of them is lit. Marketing (our videos) shows for Harry, Mikey and Leo only, never for testers."],
        ["Videos", "How to hand Claude a screen recording."],
        ["← (top left)", "Back to the site. The Team area is the top of the admin: a game's home goes back to here."],
        ["« (top of the side menu)", "Folds the side menu to a strip of icons on a computer. » opens it again. On a phone the menu is ☰ Menu, Team first."],
        ["🔔 Inbox (top right)", "The patch notes you haven't read yet, from 20 Oct 2026 on (older ones never show), newest first, plus notes under a patch note that @ you (Mentions). The red number is how many. Tap a patch note: it opens and counts as Read and understood. Tap a mention: that version opens with its notes showing. ✓ marks one read without opening it; Mark all read clears the list. Only Harry, Mikey and Leo see it."],
      ] },
      { group: "Team room toggle", items: [
        ["Board | Chat | Ideas | To-do", "Switches part, the same as the lines under Team in the side menu. A red number = new chat or new notes on your things; amber = a new job given to you (typed on the board or arrived by push)."],
      ] },
      { group: "Ideas", items: [
        ["By stage | By person", "Idea · Doing · Done columns, or a lane per person. Remembered in this browser."],
        ["+ Add idea", "Adds a one-line idea under your name."],
        ["The three dots", "One per person. Tap to say you want it; tap again to take it back."],
        ["An idea", "Opens it: move it to Idea / Doing / Done, delete it (yours only), and read or add notes."],
      ] },
      { group: "Chat (and the round button on every admin page)", items: [
        ["Message… @ or #", "Enter sends; Shift+Enter is a new line. Paste or 🖼 adds a picture. Type @ to pick Harry, Mikey or Leo (with phone notifications on, they get a buzz; type @all or @everyone to buzz both of the others); type # and a few letters to pick an admin page (it is added as a card)."],
        ["🔗 (link)", "Adds the page you are on as a card. Here in the Team room (the full chat) it opens the list of pages instead, because \"this page\" would be the chat itself: tap one to add it. Tapping a card in the chat opens that page."],
        ["⌖ (point) · 👉 Point · Shift+X", "Point at part of a page. Drag a box over it (on a phone, scroll there first), write a note, pick who, Send. It posts a card; whoever opens it gets the page scrolled to the box, outlined, with your note, until they press Got it. Shift+X works on a computer when you are not typing."],
        ["A message", "Tap: ↩ Reply, 📌 Pin (anyone) or Delete (your own). The green tag is the page it was sent from — tap to go there."],
        ["Reply quote", "The grey line at the top of a reply. Tap it to jump to the message it answers."],
        ["Small H / M / L faces under a message", "Who has seen it: bright = it was on their screen in the open chat; faded = not yet. The sender is never shown."],
        ["Gold edge · @ you", "A message that names you or points something at you."],
        ["@ Waiting on me", "Messages that name you that you haven't seen, and points you haven't pressed Got it on. Left side on a computer, folded above the chat on a phone. The round button shows a gold @ when something is waiting."],
        ["Got it (on a pointed page)", "Marks the point as seen; the sender's card shows your face lit. ✕ closes it without saying Got it."],
        ["Pinned", "Pinned messages, on the right (folded above the chat on a phone)."],
        ["Round chat button", "Bottom-left on every admin and test page: Chat | To-do in a box. 👉 Point starts point mode. Open ↗ goes to the full tab. On a page whose own buttons sit bottom-left (the Manager's office dialogue, the 3D signing) it sits just above them instead."],
      ] },
      { group: "To-do", items: [
        ["Add a job · for me ▾", "Your own job, or pick Mikey or Leo to give them one."],
        ["Tick box", "Done. Ticked jobs fade and leave after a day. ✕ deletes a job typed here."],
        ["from a push · Harry (small green tag)", "A job that arrived by push: a Claude chat added it to the jobs file in the code (team/jobs.json) and pushed its branch. It shows under Given to me for whoever it is for (\"all\" = each of the three) within a minute or two of the push, with no deploy and no SQL. The name is who asked for it. It has no ✕: it lives in the code, so it can't be deleted from the board. Tick it when it's done. To take one off for good, a Claude chat deletes it from the jobs file and pushes."],
        ["Copy prompt", "On a pushed job that has one: copies its prompt, ready to paste into your own Claude chat. Copied ✓ = done. If your browser won't copy, the prompt opens in a box already selected: press Ctrl+C, or hold it and choose Copy."],
      ] },
      { group: "Phone notifications (the 🔔 row at the top of To-do and Chat)", items: [
        ["Turn on phone notifications", "Turns them on for THIS phone or computer: it asks the phone's permission, then sends a test buzz. From then on you get a buzz when someone @'s you (or @all / @everyone), replies to your message, points at something for you, or gives you a job (typed on the To-do or pushed in the jobs file). Never for your own messages. Tapping the buzz opens the Team room on that message, or on the To-do. Each phone and computer is turned on separately (up to 5 per person)."],
        ["On iPhone: Share → Add to Home Screen…", "Shown instead of the button on an iPhone outside the app: iPhones only allow notifications in the KIB Admin app on the Home Screen (iOS 16.4 or newer). Safari → Share → Add to Home Screen → open KIB Admin from the Home Screen → Team → To-do → Turn on phone notifications → Allow."],
        ["Phone notifications: On · Send a test · Turn off", "On for this device. Send a test buzzes your own devices. Turn off stops them on this device only."],
        ["Notifications are blocked for this site", "You (or the phone) said no earlier. Allow notifications for KIB Admin in the phone's settings (on a computer: the browser's site settings), then reload."],
        ["Phone notifications aren't switched on yet (one Vercel setting)", "The site's private key (TEAM_PUSH_PRIVATE_KEY) isn't set in Vercel yet. Nothing breaks: chat and jobs work as before, just with no buzz."],
        ["Several buzzes from one chat", "Grouped: one line per chat thread that counts up (\"+2 more\"), not a pile."],
        ["New patch notes (buzz)", "When a new patch note reaches the site, the other two get one buzz (\"New patch notes from Harry · v0.95h\", or \"3 new patch notes to read\"). Tap it to open the newest. An @ in a patch-note note buzzes that person too."],
      ] },
      { group: "Team tab", items: [
        ["Live on knowitball.co.uk", "Whether the newest version of main finished deploying, how long ago, and what it was."],
        ["N pushes this week (under a name)", "How many times that person pushed to GitHub in the last 7 days, on any branch, from GitHub's own push log (it names who pushed). One push can carry several changes. Other people's work that came in when main was merged is not counted. \"N+ pushes since …\" = GitHub's log (its last 300 events) does not reach back a full week. \"N changes this week\" = the log could not be read, so it counts the changes on their own branch instead. Until 20 Oct it counted only the newest 20 changes on the branch, so it never passed 20 and included work merged in from main."],
        ["Activity · pushes a day", "The same pushes, per day, for two weeks. Days GitHub's log does not reach are left empty and named under the chart (unknown, not zero)."],
        ["A push", "Opens it: the full message, when, which branch, and the patch note it went out in."],
        ["v0.55 (green tag)", "The patch note that push went out in. Grey \"no notes yet\" = not in any patch notes yet."],
        ["View all", "Shows that person's latest changes on their branch (up to 30): their own work only, not work merged in from main."],
        ["A pull request", "Opens it on GitHub."],
      ] },
      { group: "Inside a push", items: [
        ["Open in Patch notes", "Switches to the Patch notes tab on that version."],
        ["Open the full page ↗", "Opens that version's patch notes page on claude.ai."],
        ["See it on GitHub ↗", "The push itself on GitHub."],
        ["The chat that made it ↗", "The Claude chat that made the push. Only its owner can open it."],
        ["Notes", "Leave a note on the push. Its owner gets a red number on Board."],
      ] },
      { group: "Patch notes tab", items: [
        ["Version list", "Every patch note, newest first. Same as /admin/patch-notes, with who has read each one, Read and understood, and notes (which can @ someone and quote lines of the note)."],
        ["N patch notes to read (on a person's card)", "How many patch notes since 18 Oct that person hasn't marked Read and understood (their own don't count). Tap to open the oldest one."],
      ] },
    ],
    saving: [
      "Board: nothing. It only reads from GitHub, through the site, and refreshes every minute.",
      "Ideas, chat, to-dos, notes and pins save to the shared database at once and show for the other two within about a second. Admins only.",
      "Pushed jobs (\"from a push\") are read from the code on GitHub: the jobs file on main and on Harry's, Mikey's and Leo's branches, about once a minute. If two branches have the same job, the newer one wins. If GitHub can't be reached, the To-do shows the jobs built into the site at the last deploy.",
      "Ticking a pushed job saves your tick in the shared database (the same to-do table, as your own row), so it shows on every phone and computer you use and the other two can see it. Each person ticks their own: Harry ticking the lag test does not tick it for Mikey. Unticking takes it back.",
      "First visit asks \"Which one are you?\" once and saves it to your account.",
      "Replies, @names, page cards and points are part of the message itself, so they reach everyone straight away. Seen faces, Got it and Read and understood need supabase/migrations/team_room_v2.sql; until it runs they are kept on the device that pressed them, and the chat says \"saved on this device only\".",
      "Phone notifications: turning them on keeps this device in your own sign-in account (no new table, no SQL), so only the site can ring it. A device the phone's push service says has gone (app removed, permission taken away) is dropped by itself. A message rings only once, only within 10 minutes of being sent, and only when its sender's phone asks. A pushed job rings each person once, only if it was added in the last day; the site notices it the next time any of the three has an admin page open (it checks once a minute), so a job pushed while nobody is on the site rings when someone next opens it.",
      "Without phone notifications switched on, an @ still shows as a gold @ on the round button and in Waiting on me.",
      "How a push is matched to a patch note: if the push names a version (\"v0.55\"), that one; otherwise the same person's next patch note that went live after the push, up to 4 days later.",
    ],
    inGame: ["Nowhere. Admins only."],
    needs: [
      "GITHUB_TOKEN in Vercel (already set for scenario commits). Without it, or if GitHub refuses it, the board asks without a key (the repository is public): that works about 60 times an hour, and one line on the board says which happened. On a local test build the key comes from the computer running it, not from Vercel, and the line says so.",
      "The live progress bars (\"Now working on\") are step 2: one database file for Mikey to run and a shared password. Until then each card says so.",
      "Ideas, Chat and To-do need supabase/migrations/team_room.sql run once in Supabase. Until then they say so. Pushed jobs need nothing more: no SQL, no new table.",
      "Pushed jobs reach the live board only once the change that reads them is on main (deployed). After that, a push to any of the four branches shows on the live board with no deploy. They use GITHUB_TOKEN like the Board; without it GitHub still answers, about 60 times an hour.",
      "Seen faces, Got it, Read and understood and patch-note notes need supabase/migrations/team_room_v2.sql (PENDING), run after team_room.sql.",
      "Phone notifications need TEAM_PUSH_PRIVATE_KEY in Vercel (set once, then redeploy). Until then the 🔔 row says \"aren't switched on yet\" and nothing else changes. No SQL.",
    ],
    dev: "app/admin/team/* · app/api/admin/team/route.ts · lib/teamBoard.ts · tests/star/teamBoard.mts · plan: docs/plans/2026-10-15/teamboard.md · Team room kit: lib/teamRoom/ (config.ts = settings; extras.ts = replies, @, cards, points, receipts), components/teamRoom/ (chat.tsx, PointLayer.tsx, PatchReceipts.tsx), supabase/migrations/team_room.sql + team_room_v2.sql, tests/star/teamRoom.mts · Pushed jobs: team/jobs.json + team/README.md (how a chat adds one), lib/teamRoom/jobs.ts (read GitHub per branch, merge by id, tick rows \"[job:<id>] …\" in team_tasks), app/api/admin/team/jobs/route.ts (cached 60 s), components/teamRoom/PushedJob.tsx, tests/star/teamRoomJobs.mts · Phone notifications (Web Push, web-push 3.6.7): lib/teamRoom/notify.ts (who + what, pure; tests/star/teamRoomNotify.mts), lib/teamRoom/push.ts (this device: permission, subscribe, devices in user_metadata.teamPush; ringAfter / ringNewJobs), lib/teamRoom/notifyServer.ts + app/api/admin/team/notify/route.ts (GET ready; POST rings from the saved row; pushed jobs rung once via app_metadata.teamPushJobs), public/admin/team-sw.js (scope /admin/ only, no fetch handler), components/teamRoom/PushToggle.tsx, keys: TEAM_ROOM.push in lib/teamRoom/config.ts + TEAM_PUSH_PRIVATE_KEY",
  },
  "/admin/testers": {
    title: "Tester Access",
    what: "Make links that turn a signed-in person into a tester, switch links off, and remove testers. A tester gets the Star Career developer tools and the test pages that only play the game.",
    buttons: [
      { group: "Links", items: [
        ["Who it's for (optional)", "A short note so you remember who the link went to. Only admins see it."],
        ["New tester link", "Makes a new link like knowitball.co.uk/tester/K7Q2XM. Send it to your tester."],
        ["Copy link", "Copies that link, ready to paste into a message."],
        ["Switch off / Switch on", "A switched-off link stops working. People who already used it stay testers — use Remove for that."],
        ["On / Off (tag)", "Whether the link works right now. \"Used N times\" is how many people became testers with it."],
      ] },
      { group: "Testers", items: [
        ["Remove", "Takes tester access away from that person. It asks first. An admin who is also a tester stays an admin."],
      ] },
      { group: "What the tester sees", items: [
        ["The link", "Signed out: \"Sign in with Google\", then they come back to the link. Signed in: one button, \"Become a tester\". Opening the link alone changes nothing."],
      ] },
    ],
    saving: [
      "Shared, at once. Links are kept in the Supabase table tester_links; who is a tester is the is_tester mark in user_roles. There is no Save button.",
      "Only admins can make or change links, through the site's server. Nobody can write either table from their own browser.",
    ],
    inGame: [
      "A tester sees Road to Ballon d'Or → Settings → Developer tab (add money and coins, max skills, skip ahead, switch club, captain, reputation, fame, happiness, unlock training). Goal Replays stays admins only.",
      "A tester can open every page marked for testers on the admin home (/admin/star), which shows a tester only those pages. Pages that save or commit shared things stay admins only.",
      "Any career a developer tool is used on is marked \"Tester save\" in its Settings, for good.",
      "Testers never get admin pages or anything that changes what other players see.",
    ],
    needs: [
      "Nothing: tester_access.sql has been run (5 Oct 2026).",
    ],
    dev: "app/admin/testers/ · app/api/admin/testers/route.ts · app/tester/[code]/ · app/api/tester/claim/route.ts · lib/testerLinks.ts · lib/roles.ts · lib/admin.ts (roleOf, isTester) · lib/useIsAdmin.ts (useIsTester) · components/TesterOnly.tsx · lib/star/godMode.ts",
  },

  "/admin/app-plan": {
    title: "App Plan",
    what: "Everything about turning the site into iPhone and Android apps — how it works, saves, the offline app, coins and the casino, the company and testers — with the questions still waiting on Harry at the bottom.",
    buttons: [
      {
        items: [
          ["Toggles (▸)", "Open the detail under a section. Closed by default."],
          ["Open questions tick boxes", "Tick one off as you decide it. The ticks are kept in this browser only — they don't reach anyone else or the database."],
        ],
      },
    ],
    saving: ["Nothing here saves to the site. Answers to the open questions go to Claude (in chat or a recording), and the page is updated in the code."],
    commit: ["The page lives in the repo (patch-notes/pages/app-plan/) — changes appear after the next deploy."],
    inGame: ["Admin only. Players never see this page."],
    dev: "app/admin/app-plan/page.tsx · patch-notes/pages/app-plan/index.html · lib/patchNotePages.ts",
  },

  // ════════════════════════════════════════════════════════════════════
  //  STAR CAREER TOOLS
  // ════════════════════════════════════════════════════════════════════

  "/star-gallery-dev": {
    title: "Scenario Gallery",
    what: "Every chance the game can hand you, as a picture you can drag, judge, save for the team and put into the game.",
    buttons: [
      {
        group: "Home",
        items: [
          ["11-a-side", "The chance types from real matches (one-on-one, corner, free kick…)."],
          ["5-a-side", "The five-a-side shapes. Review only: you can drag and mark them, but not save them."],
          ["Tuning & Commit", "Everything saved but not yet in the game, and any rules proposed from Tune corrections."],
          ["Number on each tile", "11-a-side: how many chance types. 5-a-side: how many shapes. Tuning & Commit: how many things are waiting."],
          ["Red dot (top right)", "Saving or committing is switched off. Tap it to read why."],
          ["\"… saved, not committed\" bar", "A shortcut to Tuning & Commit when something is waiting."],
        ],
      },
      {
        group: "The grid",
        items: [
          ["Type chips (e.g. One-on-one · 3/8)", "Pick a chance type. The numbers are the same for everyone: in the game / saved. 3/8 = 8 saved, 3 of them committed and used by real matches. On 5-a-side they count cards you've marked on this device."],
          ["Scenario Builder", "Mikey's hand-build tool (same as its own page) — see that page's eye."],
          ["A card", "Opens it. Green ✓ / red ✕ = your mark. Red dot = it breaks a rule. Blue border = unsaved drags."],
          ["+ Add version", "Another fixed version of this type (up to 60). The count is remembered on this device."],
        ],
      },
      {
        group: "A card",
        items: [
          ["The picture", "Drawn exactly as Play will show it: same size, same club kits (the real ones Play plays in), the goal standing on the goal line as in the match, and corners and byline crosses turned sideways, goal on the right or left, the way the real game films them. Bigger on a laptop (up to 520 wide), full width on a phone."],
          ["A penalty card", "Harry's penalty rules: the keeper stays dead centre on his line, the ball on the spot, you straight behind it and the camera fixed (the camera button reads \"Camera: fixed for penalties\") — none of them drag. Anyone else only slides along the edge of the box, never into it or the D. A new penalty picture stands a few of them a step back or shoulder to shoulder, so no two look the same."],
          ["Drag", "Move any player or the ball. Tap a player to select him. Swipe the grass for the next card. On a sideways corner the player follows your finger just the same."],
          ["‹ ›  and the dots", "Previous / next version (arrow keys work too)."],
          ["+ Mate", "Adds a team-mate who makes a real supporting run."],
          ["+ Opp", "Adds an opponent."],
          ["Remove", "Takes out the player you tapped (greyed out when he can't be removed)."],
          ["▶ Play / ◼ Stop", "Plays this exact picture as a real chance, your drags included, in place of the picture — at the picture's size, so nothing on screen moves or changes colour until you kick. On a laptop that is bigger than a career match, but a drag still hits exactly as hard as in a career. Real squads and faces, the real weather, and the Play Area's dials."],
          ["Delete", "Saved card: deletes it from the shared list AND the code (asks first). Unsaved card: just removes it from the grid on this device."],
          ["Tune", "Only after a drag. Records what was wrong with the generated picture as a correction — it is not a save. When enough corrections agree, a rule is proposed."],
          ["Camera: pick on the whole pitch / Done — back to editing", "11-a-side only. The picture zooms out to the whole pitch (always shown upright, goal at the top, even for a sideways corner) with the camera as a dashed frame — drag it where you want the chance filmed from, let go, then Done. It only slides, never zooms. Saved with the scenario, and the game frames that chance from there once it is committed."],
          ["✕ No good", "Marks the picture rejected. It stays in the grid. The mark is kept on this device only."],
          ["✓ / Save & Approve", "If there's anything to save (a drag, or a card nobody has saved yet) it saves it for the team AND ticks it. Otherwise it just ticks it."],
          ["⋯", "Opens the menu below."],
          ["▶ / ▶ Sim, then Next →", "Simulates a fresh chance of this type the way a real match rolls one. Next → gives another — on a phone it also sits in the top bar while you simulate, so the whole picture stays on screen. \"Back to version N\" returns."],
          ["Across formations", "Shows the picture against different formations. Off by default and not finished."],
          ["Status pills", "\"Unsaved changes — this browser only\", \"Saved — in the game once committed\", \"Committed — in the game\", or \"Saved — the game still has the older copy\"; plus \"In the game\" / \"Not in the game yet\"."],
          ["Red line / red ring", "The one fault found, and a ring on the player it's about."],
        ],
      },
      {
        group: "The ⋯ menu",
        items: [
          ["Save", "Saves the picture for the team."],
          ["Revert to built-in", "Deletes the saved copy from the shared list so the card goes back to the generated one. It does NOT take a committed copy out of the code — use Delete for that."],
          ["Commit to repo", "Puts this one picture into the game's code right now (one commit, one redeploy)."],
          ["Export JSON", "Copies the picture's data to your clipboard."],
          ["Discard unsaved edits", "Throws away your drags."],
        ],
      },
      {
        group: "Tuning & Commit",
        items: [
          ["Look through all N first", "Step through each waiting picture with ‹ ›. \"Open to edit\" opens its card; \"Leave out\" / \"Put back\" skips it in this commit only."],
          ["Commit all N to the repo", "Commits everything waiting in ONE commit and one deploy. Press it once — the count catches up after the deploy."],
          ["Show me …", "Opens the chance type a proposed rule is about. Nothing is applied from here — ask Claude in the terminal for \"the tuner proposals\"."],
          ["Rules list", "Tap a type to see the hard rules read off its saved drawings."],
        ],
      },
      { ...TUNING_PANEL_GROUP, group: "Tuning panel (under the 11-a-side grid and under a card)" },
    ],
    saving: [
      "Drags, ✓ / ✕ marks, added versions and removed cards are kept in THIS browser only until you Save.",
      SCENARIO_SAVE_SHARED,
      SCENARIO_NOT_IN_GAME_UNTIL_COMMIT,
      "Tune corrections go to the shared table star_scenario_corrections, so the whole team's corrections add up.",
      TUNING_NOTES_SAVING,
    ],
    commit: COMMIT_HOW,
    inGame: [
      "Committed 11-a-side scenarios are used by the real game's chance generator in /star-dev matches, for every player, once the deploy finishes.",
      "5-a-side cards are review only — nothing from them reaches the game yet.",
    ],
    needs: [SCENARIO_TABLE_NEEDED, GITHUB_TOKEN_NEEDED, TUNING_NOTES_NEEDED],
    dev: "app/star-gallery-dev/page.tsx · components/star/{EditableFrame,ScenarioPlay,EnginePlay,TuningPanel,TuningSessionPanel}.tsx · lib/star/{tuningSession,tuningNotes}.ts · /api/star/tuning-notes · lib/star/{scenarioEdit,scenarioStatus,scenarioCorrections}.ts · /api/star/scenarios, /api/star/scenarios/commit, /api/star/corrections",
  },

  "/star-training-dev": {
    title: "Training Levels",
    what: "Play any of the 30 levels of any training game straight away, and change any level (Edit level): drag the ball, cones and men on its picture or set its numbers, the way the Scenario Gallery edits a chance.",
    buttons: [
      {
        group: "The level list",
        items: [
          ["Power / Technique / Free Kick / Pace / Vision / Aerial", "The tabs at the top: which training game's levels to show. Aerial (Head & Volley, 21 Oct 2026) is a cross met in the air: a header on odd levels, a volley on even ones."],
          ["A level tile", "Picks that level; tap it again to play it. The line under the number is what it asks for (distance and blockers, gate size, wall, chasers, options and time). Stars appear on a tile after you've played it here."],
          ["The dot on a tile", "Amber: unsaved changes. Green: a saved edit every career plays. Orange: saved on this device only."],
          ["The level panel (right; pinned to the bottom on a phone)", "The picked level: its game, what it asks for, what it plays with, your stars here, and a real picture of that game (taken at level 15)."],
          ["Plays with", "The skills the level is played with — no choosing: what a player has after finishing every level before it (2 stars on each, the middle of 1-3; the small print gives the 1-star and 3-star numbers), all skills trained as far. Only the skills that game reads are listed: Power and Technique for Power and Technique, plus Free kick for Free kick, plus Aerial for Aerial. Pace plays at the level's own Your speed; Vision reads no skill."],
          ["Edit level", "Opens the editor for the picked level (on a phone it takes the place of the list)."],
          ["Let's go ›", "Plays the picked level (with any unsaved changes)."],
        ],
      },
      {
        group: "Edit level",
        items: [
          ["The picture (Power, Technique, Free kick, Pace)", "The level from above. Drag the ball, a man or a cone with a finger or the mouse: the numbers beside it change as you go, and ▶ Play uses it straight away. Power: the ball (sets Distance and Off centre) and each man in the way. Technique: the ball, either cone (sets the gap and the distance) or the dot between them (moves the whole gate). Free kick: the ball and each man in the wall. Pace: each man, sideways along his wave's line (the gaps you run into). A dashed ring marks what you can grab; it turns yellow while held. Vision (Pick the Pass) has no picture to drag yet; its pictures are real match moments."],
          ["The sliders (and the number boxes)", "Every number the drill is built from. Power: distance, off centre, men in the way, keeper on/off and strength, score to pass (0.5 = any goal, higher = nearer a post). Technique: gate distance, width, how far off your line, max height, score to pass. Free kick: distance, off centre, men in the wall, keeper strength, score to pass. Pace: men to beat, most in one wave, their speed, your speed. Aerial (Head & Volley): volley on/off (off = a header), keeper strength, marker on/off (the one defender), score to pass. Vision (Pick the Pass): kick the pass on/off (off = tap the man), seconds to tap him or to start the kick, seconds to let go of the pull, team-mates (2-6), traps (offside, cut out, marked), how clear the right ball is (small = two good balls), someone offside on/off, real match moments on/off (off = the team's drawn chances). \"was …\" shows the committed number; a • marks a change since the last save."],
          ["Keeper On / Off", "Power only: an open goal or a keeper."],
          ["Layout: Level's own / Shuffle", "Where everyone stands is built from the level's own seed. Shuffle picks a new one (shown as #1234); Level's own goes back. Both also put back anyone you dragged. \"Placed by hand\" shows when something has been dragged."],
          ["▶ Play", "Plays the level as drawn — your dragged picture and these numbers — straight away, on the same drill a career gets, with the skills under Plays with. Power plays exactly as drawn here; in a career a player whose Power is behind the level gets it eased (the small print under Plays with says how far). Nothing is saved by playing."],
          ["Save", "Saves this level's numbers for every career (shared table star_training_levels). Says \"Saved for everyone\" or \"Saved on this device only\" and why."],
          ["Commit", "Writes this level's numbers into the game's levels file in the code (see Committing)."],
          ["↶ Undo", "Steps back one drag or one changed number at a time."],
          ["Undo all", "Back to the saved level (every unsaved drag and number)."],
          ["Back to committed", "Deletes the saved edit: the level plays as the committed file has it, for everyone."],
          ["Done", "Closes the editor. Unsaved changes stay on the tile (amber dot) until you leave the page."],
        ],
      },
      {
        group: "While playing",
        items: [
          ["‹ All levels / ‹ Edit level", "Back to the list (or the editor) at any time."],
          ["◀ L13 ▶", "Previous or next level, starting it fresh."],
          ["The middle of the bar", "The skills this level plays with (e.g. Power 65 · Technique 65), and \"edited\" when it is playing changes you haven't saved."],
          ["Pace: the ring", "Pace has a skill to it now: one man in each wave comes for the ball and wears a ring (white). When he drops his shoulder it closes in, amber; it turns green for a moment — flick the other way then. Too early and he goes with you (\"Too early — he read it\"); too late and he's across you. The other men in the wave hold their lanes: pick the gap."],
          ["Let's go", "Level 1 of each game opens on its how-it-works card first, as in a career."],
          ["Tap to start", "Pace (the dribble run) waits for this before anyone moves, on every try."],
          ["Vision: 3, 2, 1", "Counts down over a cover, then the picture shows and the clock starts. Tap levels: tap the man. Kick levels: drag back from the ball and strike it to him; the clock stops when you start the pull, then you have the let-go time."],
          ["Vision: the result line", "After each try: RIGHT MAN, OFFSIDE, CUT OUT, MARKED, NOT THE BALL, MISPLACED or TOO SLOW, with the right man ringed green (and your wrong pick red) for a moment. A real picture names its match and minute."],
        ],
      },
    ],
    saving: [
      "Playing saves nothing: no career is touched and no stars are banked; the stars on the tiles are forgotten when you leave the page.",
      "Edits are kept on this page only until you press Save.",
      "Save writes the level to the shared table star_training_levels, which every career reads on top of the committed file, with no deploy. It also keeps a copy on this device. Until the table exists, a save stays on this device only (it plays on this device) and the page says so.",
    ],
    commit: [
      "Commit writes the level into the game's levels file (lib/star/data/trainingLevels.json) directly on the main branch, through GitHub.",
      "Vercel rebuilds the live site from main every time — it takes a minute or two.",
      "A commit also saves the same numbers to the shared table, so the two never disagree.",
      "Needs an admin sign-in, and GITHUB_TOKEN set in Vercel. Without the token you get a message saying so and nothing is committed.",
    ],
    inGame: [
      "Each level here is exactly the level a player gets: Training → pick a skill → pick a level. Same three tries, same stars.",
      "A saved level reaches every career the next time its training screen loads; a committed one after the deploy.",
      "Vision (Pick the Pass): each of the three tries is its own picture (fixed per level), so a missed try never shows the answer to the next one. The pictures are real match moments or the team's drawn chances, played on the real match engine in the match's own look; on kick levels the engine judges the pass (reached him, offside, cut out). Each level avoids the pictures the levels below it showed, so a player climbing 1 → 30 meets 45 different pictures in 90 tries (an ordinary one on 3 levels at most; the 5 offside ones come back more).",
    ],
    needs: [
      "The star_training_levels table (supabase/migrations/star_training_levels.sql). Until it is run, Save stays on this device only.",
      GITHUB_TOKEN_NEEDED,
    ],
    dev: "app/star-training-dev/{page,LevelEditor,LevelPicture}.tsx mounts components/star/TrainingMinigame.tsx (levelOverride = the draft, asDrawn, skills from lib/star/trainingAutoSkills.ts). What can be dragged per drill: lib/star/trainingLayout.ts (DRILL_LAYOUTS; Vision plugs in there). Dragged spots are optional row fields (men, ball, lanes) in lib/star/trainingLevelData.ts. Pace's knock-on: lib/star/firstPersonDribble.ts (knockOn), tests/star/paceKnockOn.mts. Level rows: lib/star/trainingLevelData.ts reading lib/star/data/trainingLevels.json (rebuild: scripts/training-levels/build.mts); saved edits: lib/star/trainingLevelStore.ts, /api/star/training-levels, /api/star/training-levels/commit (lib/star/commitScenarios.ts commitDataFile); Vision: lib/star/visionRound.ts picks and judges the pictures from lib/star/data/visionMoments.json (real moments: scripts/vision/build_vision_moments.mts) and lib/star/data/visionChecks.json (each pass tried on the engine: scripts/vision/check_passes.mts); the curve with a modelled player: scripts/vision/curve.mts; tests tests/star/{trainingLevelData,vision,trainingLayout,trainingAutoSkills}.mts, bot tests/star/visionBot.ts.",
  },
  "/star-highlights-dev": {
    title: "Infinite Highlights",
    what: "Real chances straight off the match's own generator, as fast as you can press Next — flag the bad ones and fix them on the spot.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["← (top left)", "Back to the Chances group page."],
          ["Highlights N/11", "Choose which chance types to show: All, None, tap types on or off, then \"Watch these\"."],
          ["▦ Sheet of 24", "Sheet of 24: twenty-four chances of one type served in a row, on one screen, to check by eye. Under each: which drawing it came from, the nearest drawing, and in colour anything wrong (red: added by the serving; amber: already in the drawing, or \"like #n\" — looks like one of the five before it). New sheet serves another 24. It uses the Play Area's Chances dial."],
          ["⚽ Play a penalty shootout", "On the chance-types screen. A whole shootout on the real match, with the Play Area's test sides: every kick live — team-mates at their keeper, their takers at yours (from the same end), yours to take when your turn comes. Nothing is saved; \"Another shootout\" starts again."],
          ["⚑ Flagged N", "Your flagged list. Tap one to jump back to it; Clear empties the list."],
          ["Next →", "A second Next, at the top of the page."],
        ],
      },
      {
        group: "The picture",
        items: [
          ["The picture", "Drawn exactly as Play will show it: same size (bigger on a laptop, full width on a phone), the real club kits Play plays in, the goal standing on the goal line as in the match, and corners and byline crosses turned sideways like the real game. Framed by the match's own camera (Full highlights rebuild, phase 1): the match's zoom, the same canvas shape, tipped back by the camera angle, you not drawn on a shooting chance (the ball is you) and the men at the match's size — so nothing moves when you press Play. Dragging still works on the tipped picture. Add ?still=builder to the address to see the old builder's frame instead."],
          ["A penalty", "Harry's penalty rules: the keeper stays dead centre on his line, the ball on the spot, you straight behind it and the camera fixed — none of them drag. Anyone else only slides along the edge of the box."],
          ["Drag", "Move any player or the ball. Tap a player to select him. Swipe the grass for next / previous."],
          ["Build-ups (panel)", "Full highlights rebuild for this phone: Off / On. On: ▶ Play first plays the build-up before the chance (the moves before it; a foul before some free kicks and penalties), exactly as a career match does, then the chance — the other players still running when it is yours. Tap the match to skip it. The build-up is the last 5 seconds of the move (6.5 at the biggest moments); this page's one picture always gets one, and Length: Long plays the whole move. A layer on top: the picture, your edits and Save are never changed by it. Moment (Auto / Normal / Big: final, 90') · Length (Short / Auto / Long) · Intensity (Calm / Auto / High): this page's and Infinite Match's only, stored on this phone, never in a career."],
          ["Fix this chance", "The panel on the right (under the picture on a phone): the buttons below, Save and Commit."],
          ["+ Mate / + Opp", "Add a team-mate or an opponent."],
          ["Remove", "Takes out the player you tapped."],
          ["▶ Play / ◼ Stop", "Plays this exact chance, your drags included, at the picture's size — a drag still hits exactly as hard as in a career. Real squads and faces, the real weather, and the Play Area's dials."],
          ["Run-up", "A penalty or a direct free kick: you let go of your aim, your player jogs to the ball, then the strike screen gives you 1 second. On a penalty you can drag sideways during the jog to swing your aim, and the keeper may hop."],
          ["PNG", "Downloads the picture (without the fault rings)."],
          ["Delete", "Only for a saved chance: deletes it from the shared list AND the code."],
          ["Tune", "Only after a drag: records what was wrong as a correction. Not a save."],
          ["Caption under the picture", "The chance type and its number. The ⚑ next to it flags / unflags this one (key F)."],
          ["‹  Next →", "Previous, next. Keys: ← →, space. A second Next → sits in the row at the top of the page."],
          ["Previous chances", "The last 24 chances you have seen this visit, as small pictures. Tap one to go back to it."],
          ["Save / Save this fix", "Always there until it's saved. Puts this chance (with your drags, if any) into its type's scenarios in the shared list — no drag needed."],
          ["Commit", "Always there. Saves it AND commits it into the game's code in one go."],
          ["Discard", "After a drag: throws the drags away."],
          ["Saved — revert", "Deletes your saved copy from the shared list (a committed copy stays in the code — use Delete for that)."],
          ["Status pills", "\"Straight from the generator\" (nobody has touched it), \"Unsaved changes — this browser only\", or the saved / committed status the gallery shows; plus \"In the game\" / \"Not in the game yet\"."],
          ["Amber box", "Saved scenarios of this type that break a rule, so the game isn't using them."],
        ],
      },
      {
        group: "Hitboxes & jumping (Leo)",
        items: [
          ["Hitboxes & jumping", "Tap to open. Shows New or Old and whether the hitboxes are being drawn."],
          ["New / Old", "New: players are the shape of a man (widest at the feet, narrow at the head, nothing above the head unless they jump) and really jump for a ball in the air. Old: the hitboxes from before 14 Oct 2026. Stored on this phone, so it also changes a real career on this phone."],
          ["Show / Hide hitboxes", "Draws every body's hitbox on Play: red defenders, blue team-mates (dashed ring: how far he goes for a ball played to him, tick: how high), yellow keeper, bright yellow while in the air, and the ball's height in metres. Test screens only — never in a career match."],
          ["Sliders", "Standing height, jump height, reach at the feet and at the head, header bonus, block bonus, and how much harder a keeper finds a ball above his standing reach. Kept on this phone; used from the next touch."],
          ["Reset to defaults", "Puts every slider back."],
        ],
      },
      { ...TUNING_PANEL_GROUP, group: "Tuning panel (bottom of the page)" },
    ],
    saving: [
      "Chosen types, flags and unsaved drags are kept in THIS browser only.",
      "Save / Save this fix: " + SCENARIO_SAVE_SHARED + " It lands in the gallery as a simulated card of its type.",
      SCENARIO_NOT_IN_GAME_UNTIL_COMMIT,
      "Tune corrections go to the shared table star_scenario_corrections.",
      TUNING_NOTES_SAVING,
    ],
    commit: [
      "Commit puts this one chance straight into the game's code. Saved-but-not-committed ones can also be committed together from Scenario Gallery → Tuning & Commit.",
      "Delete also removes a saved chance from the code. Commit and Delete both need an admin sign-in and GITHUB_TOKEN in Vercel.",
    ],
    inGame: [
      "The chances are made by the same function as in a real /star-dev match (lib/star/chanceMaker.ts): one of your drawings, nudged, mirrored half the time, the drawing's own players and nobody else, never one of the last five pictures of its type. The Play Area's Chances dial can switch this page (and the gallery's Sim) to the generator; a career always plays the drawings.",
      "Your fixes reach real matches only once they're committed — here, or from the gallery.",
    ],
    needs: [SCENARIO_TABLE_NEEDED, TUNING_NOTES_NEEDED],
    dev: "app/star-highlights-dev/page.tsx · components/star/HitboxPanel.tsx, lib/star/hitbox.ts · components/star/TuningSessionPanel.tsx · lib/star/{gallerySim,highlightStore,scenarioEdit,tuningSession,tuningNotes}.ts · /api/star/tuning-notes · /api/star/scenarios, /api/star/scenarios/commit · Shootout: components/star/ShootoutPlay.tsx, lib/star/penaltyTaking.ts",
  },

  "/star-fhr-dev": {
    title: "Full highlights rebuild",
    what: "The rebuild's test area, in two tabs: the Ruler (today's numbers every phase is held to) and Build-ups (a generated build-up played by the real match). Not on the admin list any more (Harry, 20 Oct 2026): the switch lives in Settings; this page is reached from the Play Area.",
    buttons: [
      {
        group: "Tabs",
        items: [
          ["Ruler", "Today's numbers: chances, goals, players reacting, start distance, Off and On side by side. Measured when the tab opens."],
          ["Build-ups", "A generated build-up played by the real match, with the same build-up drawn from above."],
        ],
      },
      {
        group: "The switch",
        items: [
          ["Off / On", "The same switch as Settings → Full highlights rebuild (also in the match's ⚙ and the ⚙ before kick-off, each with a ? that lists every part). Off is the game as it is today. On also turns Chances to New. Stored on this phone only."],
          ["Infinite Highlights → / Play Area →", "Open the two test areas that play build-ups when the switch is On."],
        ],
      },
      {
        group: "Measure",
        items: [
          ["50 / 200 / 500", "How many whole matches to play for the ruler. More is steadier and slower (200 takes a few seconds)."],
          ["Measure again", "Plays that many matches twice — once as today (Off: Chances Old), once as On (Chances New) — and fills the tables. It also runs once by itself when the page opens."],
        ],
      },
      {
        group: "The tables",
        items: [
          ["The ruler", "Chances a match, goals a match, players reacting to each chance (and how many are team-mates, and how many move within 1 second), and how far from goal chances start. The right column is what the plan page quoted from earlier measurements."],
          ["Your chances by kind", "For each kind of chance: how many a match, where it starts (metres from the middle of the goal line), and how many players react, Off and On side by side."],
        ],
      },
      {
        group: "Phase 2: a generated build-up",
        items: [
          ["The match", "The real match plays a chance the real match served, starting with its generated build-up (about 5 seconds, the last part of the move before it, made from real football patterns; long shots get one 6 times in 10 and tight angles 3 times in 4). Tap the match to skip to the chance. It always ends exactly on the chance's own picture."],
          ["Generate another", "The next chance the match serves, with a new build-up. Every chance gets its own; the same chance always gets the same one."],
          ["↺ Watch again", "Plays the same build-up and chance again."],
          ["The three small pitches", "The same build-up from above: the first frame, the middle and the last (= the chance, once the players still running have stopped). White is you, blue the chance's team-mates, pale blue team-mates who are only in the build-up (off the screen when the chance starts), red defenders (a white ring: the extra defender who ran in from off the screen), yellow the keeper; dashed is the chance's frame."],
          ["The list", "Each touch: a pass, a ball in the air or a carry, how long, who plays it, and whether it came from a real route into this kind of chance."],
        ],
      },
    ],
    saving: [
      "The switch is stored in this browser only (localStorage star-fhr). The numbers are worked out on the page and kept nowhere. No career is touched.",
    ],
    inGame: [
      "Off: nothing in the game changes. On: Chances: New is on in every match on this phone (the same as setting Chances: New by hand), Infinite Highlights' still uses the match camera, every open-play chance in a match starts with a generated build-up (about 5 s, 6.5 s at the biggest moments, never under 4 s; long shots get one 6 times in 10 and tight angles 3 times in 4, other open-play chances always), the other players are still running when the chance becomes yours and stop on their places while you aim, a covering defender sometimes sprints in from off the screen and joins the chance when the defence is thin, and about half of free kicks and penalties first show the foul that won them. Infinite Highlights (on Play) and Infinite Match play the same build-ups, with Moment / Length / Intensity dials of their own.",
      "Under the switch in Settings, while it is On: \"Real moment highlights: Off | On\". On: about 1 in 4 open-play chances of a kind the real moments have is a REAL moment (every man where he really stood) with the real 4 s before it as its build-up. Which moments: the Real moments page (/star-real-moments-dev).",
    ],
    dev: "app/star-fhr-dev/{page,BuildUpPanel}.tsx · components/star/{FhrSwitchRow,FhrAdjust}.tsx · lib/star/fhr/{toggle,ruler,stillCamera,buildUp,foulBuildUp,builders,servedChances}.ts · lib/star/fhr/patterns.json (scripts/fhr/make-patterns.mts) · terminal: npx tsx scripts/fhr/ruler.mts 200 · npx tsx scripts/fhr/buildup-measure.mts 500 · sheet: npx tsx scripts/fhr/buildup-sheet.mts 48 · browser check: node scripts/fhr/still-vs-play.mjs 100 on · tests/star/fhr.mts",
  },
  "/star-play-dev": {
    title: "Play Area",
    what: "One door to Infinite Highlights and Infinite Match, with the dials they — and the gallery's Play — run on. Every dial starts on the real game.",
    buttons: [
      {
        group: "Home",
        items: [
          ["← (top left)", "Back to the Chances group page."],
          ["Infinite Highlights → (first picture card)", "Opens Infinite Highlights."],
          ["Infinite Match → (second picture card)", "A real match that runs for the length you set, counting every chance it serves you."],
          ["Full highlights rebuild: Off / On", "The same switch as Settings (this phone). On: both doors play a build-up before each chance, as a career match does."],
          ["Ruler and build-ups →", "The rebuild's test area: the Ruler tab (today's numbers) and the Build-ups tab (one generated build-up at a time, played and drawn from above)."],
          ["Power / Technique / Opposition / Match length", "Sliders for you, the other side, and how long Infinite Match lasts."],
          ["Keeper: Real / Set", "Real (the default) is the opposition's own starting keeper, exactly as in a career. Set shows a Keeper rating slider that decides instead."],
          ["Keeper: long shots & through balls — Hard / Middle / Easier", "The keeper sets himself while you aim, reacts a beat after you strike, steps while he reads it and throws one dive, all by his rating — everywhere in the game. This row is how well he reads a shot from distance. Middle is the game. Hard: fewer long shots and through balls go in; Easier: more. Test screens only."],
          ["Weather: Real / Clear", "Real (the default) is the game's own weather — windy or wet in about 4 matches in 10, named above the pitch when it happens. Clear is still air on a perfect pitch."],
          ["Curve / Extra touch", "Pretend you own curving boots or touch boots."],
          ["Position / Division", "Which position you play and what standard of club you're at."],
          ["Pressure: Real (by division) / Off / Light / Premier League", "How hard the nearest opponent closes you down while you pull the ball back (he tackles you, or fouls you about 1 time in 3 — 2 in 3 if he comes from behind you, and he goes round you, never through you: a free kick, or a penalty inside the box). Real follows the Division above: Premier League full (a through ball is lost after about 2.6 s), Championship light, lower none. Test screens only — a career match always uses its own division."],
          ["Penalty run-up", "How you run up to a penalty: Standard, The Stroll, The Skip, The Sprint, Stutter Step, Two Steps or The Arc — every style, owned or not, so each can be seen on the real pitch (open a penalty card in Infinite Highlights or the gallery and press Play, or play a shootout). Looks only: who scores is the same with every style. Test screens only — a career uses the one it has equipped in Settings → Run-ups."],
          ["Free-kick run-up", "A separate set for direct free kicks, each modelled on an elite taker: Standard, Power Stance (Ronaldo), Stance and Sprint (Bale), The Calm Curl (Messi), Stutter Curl (Neymar), The Whip (Maddison), Long Diagonal (Trent). Looks only — the strike is still yours. Test screens only."],
          ["Back to the defaults", "Resets every dial, the keeper row and the Compare switches."],
          ["Compare old and new: New / Old", "Two switches: Penalty rules and Shot power. Old puts that one change back to how it was, so the two can be played side by side. Test screens only — a real career, its trial and its shootouts always play New."],
        ],
      },
      {
        group: "Hitboxes & jumping (Leo)",
        items: [
          ["Hitboxes & jumping", "Tap to open. Shows New or Old and whether the hitboxes are being drawn."],
          ["New / Old", "New: players are the shape of a man (widest at the feet, narrow at the head, nothing above the head unless they jump) and really jump for a ball in the air. Old: the hitboxes from before 14 Oct 2026. Stored on this phone, so it also changes a real career on this phone."],
          ["Show / Hide hitboxes", "Draws every body's hitbox on Play: red defenders, blue team-mates (dashed ring: how far he goes for a ball played to him, tick: how high), yellow keeper, bright yellow while in the air, and the ball's height in metres. Test screens only — never in a career match."],
          ["Sliders", "Standing height, jump height, reach at the feet and at the head, header bonus, block bonus, and how much harder a keeper finds a ball above his standing reach. Kept on this phone; used from the next touch."],
          ["Reset to defaults", "Puts every slider back."],
        ],
      },
      {
        group: "Infinite Match",
        items: [
          ["← (top left) / ‹ Back", "Back to the Play Area."],
          ["What it served", "Live count of each chance type the match has given you, with shares and a per-90."],
          ["Build-ups: Off / On, Moment, Length, Intensity", "Full highlights rebuild for this phone. On: every chance gets the career's build-up, from this match's own minute and score (Auto), or Normal / Big (a level final, 90th minute); Length and Intensity tune it. The dials are this page's and Infinite Highlights' only. Save / Commit always save the chance as drawn, never the build-up or the extra defender."],
          ["This chance: …", "The bar pinned to the top of the screen for the whole match: which chance you are on and the minute."],
          ["✎ Edit", "Opens the chance on screen in an editor: drag, + Mate, + Opp, Remove. On a penalty only the other players move, along the edge of the box."],
          ["Save", "Saves the chance exactly as it stands into that chance type in the gallery, for the whole team. No editing needed."],
          ["Commit", "Saves it AND commits it into the game's code, as it stands."],
          ["Save as a scenario / Commit to the game", "The same two, inside the editor — they save your edited version."],
          ["Back to the match", "Closes the editor."],
        ],
      },
      { ...TUNING_PANEL_GROUP, group: "Tuning panel (Infinite Match, under What it served)" },
    ],
    saving: [
      "The dials save the moment you change them, on this device only. There's no Save button.",
      "The Compare old and new switches and the keeper dial save the same way, instantly, on this device only, and stay until you set them back (\"Back to the defaults\" resets them too).",
      "Save as a scenario: " + SCENARIO_SAVE_SHARED,
      TUNING_NOTES_SAVING,
    ],
    commit: [
      "Commit (on the pinned bar) and \"Commit to the game\" (in the editor) both commit — one scenario, straight onto main.",
      ...COMMIT_HOW.slice(1),
    ],
    inGame: [
      "Every test screen here (Infinite Match, Infinite Highlights, the gallery's Play) plays the drawn chances, the only chances the game has (12 Oct 2026: the New chance library and the generator were deleted).",
      "The dials, the Compare old and new switches and the keeper dial only affect the test screens (Infinite Highlights, Infinite Match, the gallery and its Play) — never a real career, its trial or its shootouts, which always play the new penalty rules, the new shot power and the Middle keeper.",
      "Everything else is the real game: the same engine, the same size on screen, the real squads (real faces, real finishing), and fresh legs every 90 minutes in a long match.",
      "A chance you commit from the editor is used by real /star-dev matches once the deploy finishes.",
    ],
    needs: [SCENARIO_TABLE_NEEDED, GITHUB_TOKEN_NEEDED, TUNING_NOTES_NEEDED],
    dev: "app/star-play-dev/page.tsx · components/star/{InfiniteMatch,EnginePlay,LiveChanceEditor,TuningSessionPanel}.tsx · lib/star/{tuningSession,tuningNotes}.ts · /api/star/tuning-notes · lib/star/{playArea,engineProfile,liveEdit}.ts · lib/star/{goalFrame,pressure,runupStyles}.ts",
  },

  "/star-wallet-dev": {
    title: "Gems (test)",
    what: "Proves that paid things can't be faked: gems and paid items live on the server, not in the career save. One example paid item (Golden boots) goes through the whole path.",
    buttons: [
      { group: "Your gems", items: [
        ["Your gems (the big number)", "This account's gems, as the server says. Signed out it shows — and \"Sign in to use gems\". Before gems are switched on it says \"Gems aren't switched on yet\"."],
        ["Refresh (top right)", "Asks the server again."],
        ["+100 gems (admin test)", "Admins only. Gives your own account 100 gems. Each press is one line in the gem history. This is the only way to get gems until real payments exist."],
      ] },
      { group: "Paid items (cards)", items: [
        ["Buy (bar under each card)", "Spends gems on that item. The server reads the price itself, checks you have enough, takes the gems and records that you own it, all in one go. Pressing twice never charges twice. Greyed out when you can't afford it."],
        ["Owned", "You own it. Nothing to press."],
      ] },
      { group: "Owned items", items: [
        ["Golden boots (tile)", "The example paid item. Gold when the server says this account owns them; grey with a lock otherwise. Anything else you own shows next to it."],
      ] },
      { group: "Try to cheat", items: [
        ["Try to cheat", "Writes 99,999 gems and the boots into this browser, the way someone with dev tools would, then asks the server again. A small table shows this browser's fake values next to what the server says, and the line under it shows nothing changed."],
        ["Clear it", "Takes those fake values back out of this browser."],
      ] },
    ],
    saving: [
      "Shared, at once, on the server: gems in the Supabase table star_wallet, every gem change in star_wallet_ledger (never edited), and what each account owns in star_entitlements. The items for sale and their prices are in star_paid_items.",
      "Nothing is kept in this browser or in the career save. Nobody can change these tables from a browser — only the server can.",
    ],
    inGame: [
      "Nowhere yet: there are no paid items in the game. This is the base they will be built on.",
      "When there are, the game asks the server whether you own one, never the save. Match money (★) can never buy a paid item.",
    ],
    needs: [
      "supabase/migrations/star_wallet.sql must be run in the Supabase SQL Editor. Until then the page says \"Gems aren't switched on yet\" and nothing can be bought or given.",
      "No payment provider yet (Apple, Google or Stripe). The payments address refuses everything, so the only source of gems is the admin button.",
    ],
    dev: "app/star-wallet-dev/ · lib/star/wallet.ts, lib/star/useWallet.ts · app/api/star/wallet (GET), /buy, /webhook (refuses all) · app/api/admin/wallet/grant · supabase/migrations/star_wallet.sql (spend_gems, grant_gems, grant_item) · tests/star/wallet.mts · PAID_ITEMS.md",
  },
  "/star-store-dev": {
    title: "Store (test)",
    what: "A test version of an in-game store: daily specials, penalty run-ups, accessories, boosts that help you win, and Coins bought with real money. Nothing here reaches a career, and no real money is ever taken.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["← (top left) / ‹ (in the store)", "← goes to the Money + rewards group page. ‹ inside the store goes to the Play Area."],
          ["★ and Coins (top right)", "Your test wallet, shown at a glance."],
          ["★ (wallet, in the store)", "Your test stars — the money you earn by playing."],
          ["Coins +", "Your test Coins — the money you would buy with real money. Tapping it opens the Coins tab."],
          ["⚙ Test controls", "The panel on the left (on top on a phone). Opens and closes it; open on a computer, folded on a phone."],
          ["Your level", "National League … Premier League. Sets which level of boots you see and puts in a typical wage for that league."],
          ["Weekly wage ★", "Type any wage. Every scaled price, and what a Coin is worth, follows it."],
          ["Wallet ★ / Wallet Coins", "Set either balance to anything."],
          ["Skip a day ›", "Shows tomorrow's daily specials (press again for the day after)."],
          ["Back to today", "Returns the specials to today."],
          ["Reset purchases", "Empties the locker and puts the wallet back to ★5,000 and 300 Coins."],
          ["Daily / Animations / Accessories / Boosts / Coins", "The five sections of the store."],
        ],
      },
      {
        group: "Daily",
        items: [
          ["Today's pick", "The headline special — always a Rare-or-better look item (a run-up or an accessory), with its discount."],
          ["⏱ New in …", "Time until the specials change (midnight UK winter time / 1am summer time). Everyone sees the same specials on the same day."],
          ["−N%", "Today's discount. Each special can be bought at that price once a day."],
        ],
      },
      {
        group: "Animations and Accessories",
        items: [
          ["Penalty run-ups / Free-kick run-ups", "Two separate sets. You use one of each: one run-up for penalties, one for free kicks. Standard of each is free."],
          ["A card", "Opens the item: a bigger preview, both prices, and Wear / Use for penalties / Use for free kicks once you own it."],
          ["Your player", "What you are wearing now. Tap a name (✕) to take it off."],
          ["★ price / Coins price", "Buy with stars you earned, or with Coins. Both prices are the same number of weeks of your wages."],
          ["Wear / Take off", "Puts an accessory on (one per slot) or takes it off."],
          ["Use for penalties / Use for free kicks", "Picks that run-up for its own set only — changing your free-kick run-up leaves your penalty one alone."],
        ],
      },
      {
        group: "Boosts",
        items: [
          ["KIB cans", "The real shop's cans at the real shop's prices (a slice of your wage)."],
          ["Training Boost / Stat Can (NEW)", "Ideas that aren't in the game yet — here to price and judge."],
          ["Boots · level N", "The real shop's boots at your level and their real ★ prices; the Coins price is worked out from your wage."],
          ["Use one (test)", "Takes one boost out of your locker, as if the career had used it."],
        ],
      },
      {
        group: "Coins",
        items: [
          ["Test mode — no payment is taken", "There is no payment code on this page. Tapping a pack just adds the Coins."],
          ["100 Coins = about 2 weeks' wages …", "What a Coin is worth to you: 50 Coins are always one week of your wage, at any level."],
          ["A pack (£0.99 … £49.99)", "Adds that many Coins. Bigger packs give a bigger bonus; one is Best value; the £4.99 Bag is doubled if it is the first pack you ever buy."],
          ["Swap Coins for ★", "Turns 100 / 500 / 1,000 Coins into stars at your wage."],
          ["Receipts", "Your last few test purchases."],
        ],
      },
    ],
    saving: [
      "This browser only. The wallet, what you own, what you're wearing and the test controls are kept on this device and survive a refresh.",
      "It never touches a career save, and nobody else sees it.",
    ],
    inGame: [
      "The same store is in the career (28 Sep 2026): the big Store tile on the Shop page and the Store app on the phone. There it spends your real ★ and Coins, a run-up you buy shows in Settings → Run-ups and plays in matches, and cans and boots land where the real shop puts them.",
      "This page's test wallet is separate — buying here never touches a career.",
      "In the career, Training Boost and Stat Can are hidden (not in the game yet), and Coin packs read \"Coming soon\" in the live game.",
    ],
    dev: "app/star-store-dev/page.tsx · components/star/store/{StoreView,CareerStore,RunupPreview,AccessoryFigure}.tsx · lib/star/store/{catalogue,coins,daily,purchase,career,testArea,runupPreview}.ts · tests/star/store{Coins,Daily,Purchase,Career}.mts",
  },

  "/star-scene-editor-dev": {
    title: "3D Scene Editor",
    what: "The one editor for every 3D scene: the Cut-scene Director, 3D Signing, the Manager's Office, the 3D Shop, the 3D Garden and the 3D House. Pick a place, change the camera and the light, and watch the real scene play it. An edit only reaches the game once you APPROVE it, and only where and when you choose. Commit to game writes an approved edit into the game's code.",
    buttons: [
      {
        group: "3D Preview",
        items: [
          ["Place tabs (3D Signing … Cut-scene Director)", "Open that place, live. All six work."],
          ["Shot buttons (3D Signing / Manager's Office: 1. He talks … 5. The handshake)", "Play that fixed shot from its start; the settings then change that shot. The office has only He talks and You reply. A • marks a shot you have edited."],
          ["View buttons (3D Shop / Garden / House: 1. Walking about, 2. Card: …)", "Stand him for that view: walking about, or a card open on the boots, the car, the counter, the homes, the cans (shop) or the wardrobe, the cabinet, the drive (house). The settings then change that view. A • marks an edited view."],
          ["Time of day, Stand (3D Garden)", "Build the garden by day, at sunset or at night, and stand him at the gate, the fountain, the shop, the casino, the pitch gate or the house door to see the walking camera there."],
          ["Home, Room (3D House)", "Build that home (starter … estate) and walk into one of its rooms. A card view only works in the room that has it (a line says so)."],
          ["▶ PLAY SHOT (3D Signing / Manager's Office)", "Play the shot on screen again from its start."],
          ["Scene buttons (Contract signing, Goal celebration …, Kept: …)", "Load that cut scene into the preview. \"Kept: …\" scenes come from the Scene generator's Keep button. The 3D Area's Cut scenes cards show exactly this list (one list for both)."],
          ["The badge top-left", "The shot or view on screen, and its lens."],
          ["Drag on the preview", "Director: a free camera round the look point. Signing / Office: orbit this shot. Shop / Garden / House: turn and rise this view; wheel or pinch changes its distance."],
          ["The map, bottom-right", "The place seen from above. Drag the blue box (camera), the white dot (look point) or the yellow sun (key light, round the ring). Shop, Garden and House: only the sun drags; the camera follows him."],
        ],
      },
      {
        group: "Settings (Camera / Lighting tabs on a phone)",
        items: [
          ["Shot preset buttons and list", "Director: change the framing of the shot under the playhead (18 framings)."],
          ["Lens, Turn, Rise, Move, Move amount, Handheld shake", "Director: change the shot under the playhead. Each shot keeps its own edits."],
          ["Turn, Rise, Distance, Lens (Shop / Garden / House)", "Change the view on screen. The edit sits on top of the camera the scene works out as he walks, so it follows him; the scene still keeps it out of walls and trees. \"As written\" puts the lens back."],
          ["Mood", "Director: time of day and colour of the whole scene."],
          ["Exposure, Key light strength", "Brightness of the scene and of the sun / key light. With the broadcast look on, Shop / Garden / House exposure brightens the lights instead."],
          ["Spotlight on a person", "Director: a spotlight on one person; Spot strength sets how bright."],
          ["Position X/Y/Z, Look at", "Director, Signing, Office: where the camera stands and looks. Type a number to take over."],
          ["Back to the shot / Back to as written", "Drop this shot's or view's edit; it plays as written."],
          ["Key light angle, Key light colour", "Turn the key light round the place and change its colour. \"As written\" puts the colour back."],
          ["Greyed rows with \"coming next\"", "Director dials not built yet."],
        ],
      },
      {
        group: "Timeline and saving",
        items: [
          ["▶ Play / ❚❚ Pause, ↺ Replay, the scrub bar", "Director: play, stop, start again, jump to a moment."],
          ["SAVE FOR EVERYONE", "Copies this scene's edits to the shared table (admin only). If the table isn't switched on, it says so and the edits stay on this device."],
          ["Copy edits", "Copies the edits as text."],
          ["Reset this shot / view, Reset all", "Clear one shot's or view's edits, or the whole place's (an approval stays)."],
        ],
      },
      {
        group: "Use in the game",
        items: [
          ["✓ APPROVE", "The game may now use this edit. It also saves it for everyone. It stays editable: after a change press SAVE FOR EVERYONE (or Commit to game) so the game gets the new copy."],
          ["Withdraw approval", "The game stops using it (the shared copy is updated straight away)."],
          ["Where (ticks)", "In a career: the real game. The test page: that place's own test page (for a cut scene, the 3D bench's cut-scene shots). Untick both and nothing uses it."],
          ["When (list)", "Always, or only at one moment: the signing (first contract / a move), the shop (walking in from the garden / from the Shop page), the garden (day / sunset / night), the house (one home), a cut scene (one event)."],
          ["COMMIT TO GAME", "Writes this approved edit into the game's code (lib/star/data/sceneEdits.json) on main. Without GITHUB_TOKEN it says so in red and nothing is committed. A withdrawn approval sent this way is taken out of the code."],
        ],
      },
    ],
    saving: [
      "This device: every change saves at once (localStorage), per place and per shot or view, and comes back when you reopen it.",
      "Save ids: \"signing\", \"office\", \"shop\", \"garden\", \"house\"; each director scene under its own name (Contract signing as \"director:signing\"); a kept generated scene under its recipe id.",
      "Shared: SAVE FOR EVERYONE and APPROVE write to the star_cutscene_edits table through /api/star/cutscene-edits (admins only). Needs supabase/migrations/star_cutscene_edits.sql (run).",
    ],
    commit: [
      "COMMIT TO GAME writes approved edits into lib/star/data/sceneEdits.json on the main branch, through GitHub (the gallery's commit machinery). Vercel rebuilds the live site from main: a minute or two.",
      "Needs an admin sign-in and GITHUB_TOKEN in Vercel. Without the token you get a plain red message and nothing is committed.",
    ],
    inGame: [
      "Only APPROVED edits, only where and when the approval says. The career's 3D signing, the manager's office, the 3D shop, the garden and the house read them as they open (the committed file at once, the shared table a moment later; the newer approval wins).",
      "No approved edit: every scene plays exactly as before.",
      "Cut scenes (the Director) don't play in a career yet: an approved director edit is used on the 3D bench's cut-scene shots for now.",
    ],
    dev: "app/star-scene-editor-dev/page.tsx (+ editor.css, parts.tsx, PlaceEditor.tsx for Signing/Office, WalkPlaceEditor.tsx for Shop/Garden/House, UsePanel.tsx for Approve/Commit, sampleCareer.ts, store.ts) · lib/star/sceneEdits/ (approval.ts where/when + newest wins, walkEdit.ts view edits, useApproved.ts the game's read hook, kept.ts) · optional edit hooks: lib/star/signing3dScene.ts, lib/star/shop3d/scene.ts, lib/star/garden3d/scene.ts, lib/star/home3d/scene.ts, lib/star/cutscene/director.ts (no edit = as before) · app/api/star/cutscene-edits/route.ts (?approved=1) and commit/route.ts · tests/star/sceneEdits.mts.",
  },
  "/admin/scene-generator": {
    title: "Scene generator",
    what: "A game moment in, a whole cut scene out. Pick the event, the feeling, how big the moment is and a seed, then Generate: the real cut-scene director plays it, with its recipe beside it. Mark it Good or Bad, keep it for the 3D Scene Editor, and see when a generated scene would play in the game.",
    buttons: [
      {
        group: "The moment",
        items: [
          ["Event buttons (Signed … Mentor advice)", "The game moment: 18 kinds."],
          ["Feeling buttons (Joy … Inspired)", "How you feel about it: 12 feelings."],
          ["How big the moment is", "Small (a friendly) to big (a cup-final winner). Bigger moments get longer scenes and closer shots."],
          ["How intense", "Calm to wild."],
          ["Seed − / + and the box", "Pick the seed. The same event, feeling, size, intensity and seed always make the same scene."],
          ["🎲 Re-roll", "The next seed, made at once."],
          ["GENERATE", "Make the scene from the dials."],
        ],
      },
      {
        group: "The picture",
        items: [
          ["▶ PLAY / ❚❚ PAUSE, ↺ Replay, the scrub bar", "Play the scene, stop it, start again, jump to a moment."],
          ["👍 Good / 👎 Bad", "Mark this recipe. The marks add up per event in the table below."],
          ["Keep as a hand-made scene", "Save this scene exactly as it is (later changes to the generator never change it). The 3D Scene Editor shows it as \"Kept: …\"."],
          ["Open in the editor ›", "Open the kept scene in the 3D Scene Editor (keep it first)."],
          ["3D Scene Editor › (top right)", "Open the editor."],
        ],
      },
      {
        group: "The recipe and When does this play?",
        items: [
          ["The recipe", "Where it happens, the mood, how long, who is in it, the film-rules score (and what broke), the beats in order, and the shot list."],
          ["The table", "Each event, the game moment that would play it, what the game shows there today, and its status. Tap a row to pick that event."],
        ],
      },
    ],
    saving: [
      "Marks and kept scenes: this device at once, then the shared table star_cutscene_edits (rows \"mark:…\" and \"kept:…\", never approved, so the game never reads them). If the shared table can't be written, the line under the buttons says \"saved on this device only\".",
    ],
    inGame: [
      "Nowhere. Today a generated scene plays only on test pages (here and the 3D Scene Editor). The table is the proposal for which game moment would play each one; nothing is wired until Harry says so.",
    ],
    dev: "app/admin/scene-generator/page.tsx (+ generator.css) · lib/star/cutscene/generate.ts (generateScript, scoreScript) · lib/star/sceneEdits/kept.ts (recipes, marks, kept scenes) · lib/star/sceneEdits/whenPlays.ts (the When table; tests/star/sceneEdits.mts keeps it honest) · /api/star/cutscene-edits.",
  },
  "/star-3d-bench-dev": {
    title: "3D bench",
    what: "The same ten 3D shots, every time, at the size of a phone: the Home player, the signing close-up, the manager's office, the press conference, the trophy lift, the walk-out, the garden, a training drill and two made-up cut scenes. Each shows its frame numbers. Every 3D change is judged here, before and after, on the same pictures.",
    buttons: [
      { items: [
        ["Home player … Made-up scene: a trophy", "Picks the shot. A cut scene stops at the same second every time; a 3D place (garden, office, drill) keeps moving."],
        ["Now / Before (19 Oct)", "Before shows the shot as it was on 19 Oct 2026: the old skin and light (yellow in cut scenes, orange in the garden and shop), the old cut-scene cameras (a face or body filling the phone) and faces that never move. Now is the game today. The Home player's new life has no Before here: its before is a still in the patch notes."],
        ["Show the skin it measures", "Paints every bit of bare skin bright pink in the shot: what the skin numbers are measured from."],
      ] },
    ],
    saving: ["Nothing here is saved. The page only shows other test pages at fixed moments."],
    inGame: ["Nothing changes in the game from this page. It is a measuring tool for the 3D changes."],
    dev: "app/star-3d-bench-dev/page.tsx (the page), app/star-3d-bench-dev/scene/page.tsx (the cut-scene and Free Roam shots: a bare StyleTest3D, ?scene=director&fixture=…&clean=1; it took over from the deleted Art styles page /star-style-dev, 21 Oct 2026; also the Lag test's cut-scene step), app/star-3d-bench-dev/home/page.tsx (the Home shot; window.__homeT holds a moment), app/star-3d-bench-dev/face/page.tsx (one head close up, its moving face on an 8 s loop), app/star-3d-bench-dev/faces/page.tsx (measures the eight Style A faces: scripts/bench3d/faces.mjs --write), app/star-3d-bench-dev/headshots/page.tsx (twelve made-up players and you as card headshots shot from the 3D model, beside the drawn heads they replace, with the time each picture took; Make again forgets this device's kept pictures; ?only=3d|drawn; components/star/Headshot3D.tsx, lib/star/headshot3d/; stills and timings: node scripts/bench3d/headshots.mjs DIR), lib/star/bench3d.ts (the ten shots). Stills + skin numbers + frame numbers: npx tsx scripts/bench3d/shots.mts --out=DIR --tag=after (add --old for the before). Home stills: node scripts/bench3d/home.mjs PREFIX 3 8.6 20. Cut-scene framing at phone size: node scripts/bench3d/framing.mjs. The skin probe and mark: lib/star/style3d/toon/shader.ts TOON_SKIN; on any 3D test page ?skinfix=0 shows the old skin, ?framing=old the old cut-scene cameras, ?face=old still faces.",
  },
  "/star-3d-area-dev": {
    title: "3D Area",
    what: "Every 3D place, every cut scene (the same list the 3D Scene Editor shows) and the other 3D areas being built, plus a store of every 3D and Blender file the site has. Nothing here touches a career.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["← (top left)", "Back to the 3D places group page."],
          ["Places / Cut scenes / Other scenes / 3D files (left, or along the top on a phone)", "Switch between the 3D places, every cut scene, the other 3D scenes and the 3D file store. The page remembers which one you had open."],
        ],
      },
      {
        group: "Places",
        items: [
          ["A place card (Signing, Manager's office, Shop, Garden, House, Training, 3D scene editor)", "Opens that 3D place's own test page. The picture is a real still of that place in today's look (re-made 21 Oct 2026, after the new skin, cameras and arms)."],
        ],
      },
      {
        group: "Cut scenes",
        items: [
          ["A cut-scene card (Contract signing, Goal celebration, Trophy lift, Walk-out, Press conference, The Icon, Farewell, then any KEPT ones)", "Opens that cut scene in the 3D Scene Editor, ready to edit. This is the SAME list the editor's scene buttons show: the hand-made scenes, then every scene kept from the Scene generator (shared ones and this device's). The picture is a real still of the scene as it plays on a phone; a kept scene has no still yet (it says KEPT)."],
          ["EDIT", "Same as tapping the card."],
        ],
      },
      {
        group: "Other scenes",
        items: [
          ["A scene card", "Opens that scene's own test page. A card with no › (Planned) has nothing to open yet."],
          ["The coloured tag", "Prototype: being built here. Test page: its own dev page. Pictures: renders only. Planned: written up, not started. Proposal: one picture to judge."],
          ["The grey line under a card", "Where that scene's files live, for whoever builds it next."],
        ],
      },
      {
        group: "Assets",
        items: [
          ["📁 folder chips", "One folder per kind: top-bar icons, the signing scene, backdrops, each shop group, the store, the Blender footballer, its clips, the match-view proposal and the 3D models. The number is how many files."],
          ["A picture", "Opens it big, with its file path and size."],
          ["Copy path", "Copies the file path (public/…) so it can be pasted into a message."],
          ["Open file", "Opens the file on its own in a new tab."],
          ["✕ / tap outside", "Closes the big picture."],
        ],
      },
    ],
    saving: [
      "Nothing is saved.",
      "The asset list is written into the code. After a new render is added, someone re-runs scripts/assets3d-manifest.mjs; a test fails if the list and the files no longer match.",
    ],
    inGame: [
      "Nowhere — a sandbox. Each scene says on its own page whether any of it is in the game.",
    ],
    dev: "app/star-3d-area-dev/page.tsx · lib/star/cutscene/sceneList.ts (the one cut-scene list, shared with the Scene Editor; stills public/admin/3d-area/cut-<id>.webp) · place and cut-scene stills: node scripts/admin3d/stills.mjs (dev server running) · lib/star/area3d.ts (the other scenes) · lib/star/assets3dManifest.ts (generated) · scripts/assets3d-manifest.mjs · tests/star/assets3d.mts",
  },

  "/star-3d-area-dev/signing": {
    title: "Signing scene (live 3D)",
    what: "The signing as a live 3D cutscene: you sit across the desk from the manager, a few lines of talk, the contract slides over and turns to you, then tap to sign. You reach for the pen, pick it up, write your name, SIGNED lands, and you both stand and shake hands while the camera pulls back. Your skin tone, face picture, hair and accessories are on your player.",
    buttons: [
      {
        items: [
          ["← (top left)", "Back to the 3D places group page."],
          ["↺ Replay (above the scene)", "Starts the scene again from the first line."],
          ["Your player (above the scene)", "Opens the picker under the scene: skin tone, face picture, hair, every store accessory and the Star Pass Gold Aviators. A change rebuilds your player straight away."],
          ["Scene editor ›", "Opens the 3D Scene Editor on the signing: camera, lens and light per shot, Approve, Commit to game."],
          ["?bare=1 on the address", "The scene full screen, as before the admin frame (↺ and Your player at its top right)."],
          ["Skip", "Leaves the scene. In a career this goes straight on to the next screen."],
          ["Tap the scene", "Shows the rest of a line at once, or moves to the next line. While you sign, a tap jumps to the handshake."],
          ["TAP TO SIGN", "Appears with the contract. The camera pulls back, you pick up the pen and sign, SIGNED stamps on, then the handshake."],
          ["Continue (replays here)", "In the game this carries on to the next screen; here it starts again."],
          ["👁 (bottom left)", "This guide."],
        ],
      },
      {
        group: "The picker (Your player)",
        items: [
          ["Skin tone", "The 8 tones a player can pick in the game."],
          ["Face picture", "Model's own: the 3D head's own face. Or one of the 7 fake faces, put on the front of the head the way the home avatar fits a photo."],
          ["Hair", "Short, Long, Buzz or None, and 4 colours."],
          ["Head / Neck / Sleeves / Wrists / Hands / Boots / Armband", "Every store accessory you can wear. Celebrations are moves, so they are not in this list."],
          ["Gold Aviators", "The Star Pass reward, on your face."],
        ],
      },
    ],
    saving: ["Nothing is saved. The picker only changes this page."],
    inGame: [
      "In a career when Settings → Look → \"Signing scene\" is 3D (the default, per phone): the first contract and every club move play this scene with your own player (skin, face picture, hair, accessories, aviators), the club's kit, your shirt number, seasons and wage. Drawn keeps the picture signing as it was.",
      "If the phone cannot run the 3D, the career falls back to the drawn signing by itself.",
      "Later transfers (signing for a new club at the end of a season) still use the paper signature page.",
      "An edit APPROVED in the 3D Scene Editor plays here when it is ticked for \"the test page\", and in a career when ticked for \"in a career\" (and its When holds). None: the scene exactly as written.",
    ],
    dev: "app/star-3d-area-dev/signing/page.tsx · components/star/SigningScene3D.tsx (the screen) · components/star/SigningScene3DCareer.tsx (career → scene) · lib/star/signing3dScene.ts (room, camera, timeline) · lib/star/people3d.ts (the approved player and manager: kit, skin, hair, face picture, accessories, outline) · lib/star/signing3dRig.ts (arm IK) · lib/star/signing3dTextures.ts (contract and other canvas pictures) · lib/star/signing3d.ts (lines, terms, the Settings switch) · public/star/people3d/*.glb (scripts/people3d/build_people3d.py) · public/star/signing3d/aviators.glb · stills: scripts/signing3d-shot.mjs · tests/star/signing3d.mts",
  },

  "/star-3d-area-dev/office": {
    title: "Manager's office (3D stage)",
    what: "The signing's office, rebuilt as a stage for \"Talk to your manager\": the manager behind his desk, you across it, a rug, a bookcase, a trophy cabinet, a plant, a laptop and a mug. The camera goes to whoever is talking. Sample lines here; the real ones come from the boss game.",
    buttons: [
      {
        items: [
          ["← (top left)", "Back to the 3D places group page."],
          ["He talks / You talk (above the scene)", "Moves the camera: over your shoulder at him, or over his at you."],
          ["Next line ›", "Steps through four sample lines, switching who talks."],
          ["Scene editor ›", "Opens the 3D Scene Editor on the office: camera, lens and light per shot, Approve, Commit to game."],
          ["?bare=1 on the address", "The office full screen, as before the admin frame."],
          ["👁 (bottom left)", "This guide."],
        ],
      },
    ],
    saving: ["Nothing is saved."],
    inGame: [
      "The manager's Office talk (Relations → Boss → Office talk) shows this office above the chat when Settings → Look → \"Talk to your manager\" is \"3D office\" (the default, per phone). \"Old\" is the chat alone.",
      "The same switch puts three manager moments in the office: a club's contract offer (before the talks), manager news on Home (Continue dismisses it), and being left out of the squad (above the card on the match screen).",
      "If the phone cannot run the 3D, the chat carries on without the office.",
      "The people are the one body (Settings → Look → \"3D people\").",
      "An edit APPROVED in the 3D Scene Editor plays here when ticked for \"the test page\", and in every career office talk when ticked for \"in a career\". None: the office exactly as written.",
    ],
    dev: "app/star-3d-area-dev/office/page.tsx · components/star/Office3D.tsx (stage + career look) · lib/star/signing3dScene.ts (stage: \"office\" dresses the room) · components/star/relgames/BossChat.tsx, components/star/ManagerMoments.tsx, components/star/LineupIntro.tsx (mount it) · lib/star/look3d.ts (the Settings switches)",
  },

  "/star-anim3d-dev": {
    title: "3D animations",
    what: "Every move the 3D match plays (outfield and keeper), each looping on its own tile, seen through the real 3D match camera at the real match size: a man is 6% of a phone screen, the men 1.35 × life, the realistic players.",
    buttons: [
      { group: "Top", items: [
        ["← (top left)", "Back to the Players + animation group page."],
        ["Outfield / Keeper (left list)", "Jumps to that group of tiles."],
        ["2D animations (left list)", "Opens the 2D animation page."],
        ["❚❚ / ▶ (player bar)", "Stops or starts every tile. Play also lets go of any tile you held with its slider."],
        ["1× / ½× / ¼×", "Playback speed."],
        ["Match size / 3× closer", "Match size is exactly how big a man is in a real 3D match. 3× closer brings the camera in to judge hands and feet."],
        ["As you shoot / Side on", "Which way the men face: away from the camera (as you face the goal when you shoot), or side on."],
      ] },
      { group: "Each tile", items: [
        ["The slider", "Holds that tile on one frame and steps through it. The line under it names the clip and the second."],
        ["The white ball", "On a kick, pass, header, volley or tackle tile: where the kicking foot is at the moment it meets the ball, as the match plays it."],
      ] },
    ],
    saving: ["Nothing is saved."],
    inGame: [
      "These are the clips a real 3D match plays (Settings → Look → Match view 3D: On). Changing a clip changes it here and in the match.",
      "A pass, shot, tackle or celebration plays on the man's own spot, as in the match: the clip never walks him off where the 2D game put him.",
    ],
    dev: "app/star-anim3d-dev/page.tsx · lib/star/style3d/animGrid3d.ts (the tiles: one WebGL canvas, one tile each via scissor) · the clips: public/star/anims3d/{football,mocap}.glb through lib/star/three3d/footballAnims.ts · the camera numbers: lib/star/style3d/broadcastCam.ts (BROADCAST) · the match drawing: lib/star/style3d/engineView.ts. Filming: window.__frameStep.",
  },
  "/admin/motion-refs": {
    title: "Motion references",
    what: "Short clips of real-looking people doing our cut-scene moments (a handshake, a trophy lift, a goal celebration and so on), to compare with the movement we build. They are Higgsfield references for the movement rebuild. Each card has the real clip, a still of our game and an empty Ours slot.",
    buttons: [
      { group: "The top", items: [
        ["← (top left)", "Back to the Players + animation group page."],
        ["HQ (base standard)", "The best round: 18 clips. The five base-standard scenes (handshake, trophy lift, goal celebration, walk-out, press answer) come first and carry an amber \"Base standard\" tag."],
        ["First round", "The first, lower-quality round: 9 clips. The handshake is left out because it shows a small dark mark on the shirt that looks like a brand logo."],
        ["All", "Every clip: base standard first, then the rest of the HQ round, then the first round."],
      ] },
      { group: "Each card", items: [
        ["Real person (the clip)", "Plays by itself while you can see it. Muted, loops, no sound. Tap it to pause; tap again to play."],
        ["❚❚ Pause / ▶ Play", "Same as tapping the clip."],
        ["½× speed", "Half speed, to watch hands, feet and weight. Press again for normal speed."],
        ["Our game", "A still of our game that the clip was made from. Where no game still was saved, it shows the clip's own start picture and says so."],
        ["Ours", "Empty until our own clip of the same scene is added. Then it plays here, beside the real one, with the same Pause and ½× speed buttons."],
      ] },
    ],
    saving: [
      "Nothing is saved. The page only remembers which of the three buttons you last pressed, on this device.",
      "The clips and stills are part of the code (about 21 MB). A new clip of ours shows after the next deploy.",
    ],
    inGame: ["Nowhere. It is for the team: this is the real movement our cut scenes and animations are being rebuilt to match."],
    dev: "app/admin/motion-refs/page.tsx · lib/motionRefs.ts (MOTION_REFS: one line per clip; shared with later tools) · files in public/admin/motion-refs/: hq/<scene>.mp4 + .jpg (Nano Banana Pro 4K picture, then Seedance 2.5 video, 480p), r1/<scene>.mp4 (GPT Image 2.5 picture, then Kling 3.0 video), game/ (stills of our game), ours/<scene>.mp4 (OUR clip: drop a file with the scene's name here, e.g. ours/handshake.mp4, and the Ours slot plays it) · registered in lib/adminRegistry.ts (group players, admins only).",
  },
  "/star-update-dev": {
    title: "Oct 13 update",
    what: "The whole Oct 13 gameplay update behind one Old | New switch: shot power, the contact field (strike the side of the ball to curl it low), keepers, team-mates shooting, and match feel. Each part also has its own row.",
    buttons: [
      { group: "Top", items: [
        ["← (top left)", "Back to the Match tests group page."],
      ] },
      { group: "The whole update", items: [
        ["New / Old", "Flips every part at once, on this phone. New also plays in your real career matches on this phone. Starts on Old."],
        ["Play your career → / Play Area →", "Opens the real game or the Play Area to try it."],
      ] },
      { group: "Each part", items: [
        ["New / Old on each row", "One part on its own. If they don't all match, the big switch shows Mixed. The last three rows are v0.15 parts the update was measured with; they also sit in Settings → Match (New in v0.15)."],
      ] },
      { group: "Match feel", items: [
        ["The feel card", "The Match feel pictures, sounds and sliders, the same as on the Animations page."],
      ] },
    ],
    saving: [
      "This phone only, instantly. Nobody else's game changes.",
    ],
    inGame: [
      "Every real match on this phone plays the parts set to New.",
      "There is no row for this in Settings: the switch lives here until the update is decided (Harry, 12 Oct 2026).",
    ],
    dev: "app/star-update-dev/page.tsx · lib/star/oct13Update.ts (the switch) · rows in lib/star/lookRows.ts · physics in lib/star/shotFeel.ts, keeperBrain.ts, canvasEngine.ts (KEEPER_FEEL, MATE_CARRY) · feel in lib/star/matchFeel.ts · tests/star/gameplay13.mts, matchFeel.mts.",
  },
  "/star-animations-dev": {
    title: "2D Animations",
    what: "Every New player animation (keeper saves, touches, shots, passes, headers, blocks, clearances) looping next to how the Old game drew that moment, with the dials and switches that size them.",
    buttons: [
      { group: "Top", items: [
        ["← (top left)", "Back to the Players + animation group page."],
      ] },
      { group: "The list on the left (a row of tabs on a phone)", items: [
        ["Keeper / Touches / Shots / Passes & headers / Defenders / All", "Which animations to show. All shows every group under its own title; it is heavy on an older phone."],
        ["Match feel / 3D figures / Which are on / Dials / Real chance", "Jumps down the page to that part."],
      ] },
      { group: "The gallery", items: [
        ["❚❚ / ▶", "Pauses or plays every animation."],
        ["The yellow slider", "Steps through the frames. Moving it pauses the animations."],
        ["1× / ½× / ¼×", "Playback speed (and plays again if paused)."],
        ["Look: Flat / Shaded", "The two drawn player looks. The 3D players have their own New clips: see 3D figures below."],
        ["Foot: Right foot / Left foot", "Mirrors every animation: a left-footer, a keeper diving the other way."],
        ["Left picture: vs Old game / vs First version", "What the left picture of each card shows: the Old game, or the first New version from before the strikes were made bigger."],
      ] },
      { group: "Match feel", items: [
        ["New / Old", "The same switch as Match feel on the Oct 13 update page (/star-update-dev), on this phone. New: every hit is felt (wind-up, a short freeze at the contact, flash and turf, camera punch, ball squash and streak, deeper kick sound, phone buzz), plus landing thuds, the net bulging, post clangs, glove sparks and a keeper who hops and arcs his dive. Old: the game as before. Default Old."],
        ["The six picture rows", "Your strike, a glove save, a landing, the net bulge, a ball off the post and the keeper's hop and dive, each at soft · medium · full power, painted with the match's own drawing at 0.6× speed."],
        ["▶ Soft kick / Full kick + buzz / Scuff / Thud / Glove / Clang", "Plays that sound once (and the buzz, on a phone that has one)."],
        ["The sliders", "How big each effect is: freeze ms, wind-up ms, camera punch px, flash, streak length, squash, sound loudness, buzz ms, landing, net bulge, keeper motion, glove spark, team-mate moves. Saved on this phone at once; the match reads them every frame."],
        ["Reset feel to defaults", "Every feel slider back to the shipped value."],
      ] },
      { group: "3D figures", items: [
        ["→ ↘ ↓ ↙ ← ↖ ↑ ↗", "Which way the men face. Every frame of each New 3D clip (touch, pass, shot, volley, chip, header, block, clearance; the keeper's one-hand stretch, low dive, parry, catch, fumble, getting up) next to the old clip the match showed for that moment. Keepers have 4 facings and use the nearest."],
      ] },
      { group: "Which animations are on", items: [
        ["The switches", "Turn one family off and it is drawn the Old way, here and in the real match, while the rest stay New. Contact flashes turns off every flash."],
      ] },
      { group: "Dials", items: [
        ["The sliders", "How big each movement is. Exaggeration scales all of them at once. Each slider shows its default and the first version's value."],
        ["Reset to defaults", "Every dial and switch back to the shipped look."],
        ["First version sizes", "The sizes from before \"make the strikes bigger\" (strikes smaller, no lean, no flash)."],
        ["Copy settings", "Copies the dials and switches as text (and shows it) so you can send them to someone."],
        ["Paste settings here + Apply", "Takes that text and applies it on this phone."],
      ] },
      { group: "See it in a real chance", items: [
        ["Infinite Highlights → / Play Area (Infinite Match) →", "Opens the real match, which reads these same dials and switches."],
      ] },
    ],
    saving: [
      "This phone only, instantly. Dials and switches are kept in this browser; nobody else sees them.",
      "Nothing changes the ball, the saves, the results or any timing. These are looks only.",
    ],
    inGame: [
      "Every real match on this phone (and every test screen that plays the real match) draws team-mates, defenders and the keeper with these sizes when Settings → Look → Animations is New.",
      "With Settings → Look → Players: 3D, the same moments play the New 3D clips (a second picture file, fetched only when Animations is New). Old plays the old 3D clips exactly as before.",
      "To take the whole feature out of a phone: set Animations to Old.",
    ],
    dev: "app/star-animations-dev/page.tsx · lib/star/animGallery.ts (draws one frame) · lib/star/actionAnim.ts (the poses) · lib/star/animDials.ts (dials + switches, key star-anim-dials) · Match feel: lib/star/matchFeel.ts (switch key star-match-feel, dials key star-feel-dials), lib/star/matchFeelDraw.ts (the drawing), components/star/FeelPreview.tsx (the Feel card), sounds in lib/star/matchSound.ts · lib/star/animLook.ts (always New since 12 Oct 2026) · lib/star/actionAnimDraw.ts (the flash) · lib/star/keeperSaveKinds.ts · components/star/Sprite3dSheet.tsx + lib/star/sprite3dAnim.ts (the 3D clips: public/star/sprites/atlas-1.webp, baked by tools/sprites/new/). Strips are painted once and stepped with CSS: no animation loop, so the one-engine guard has nothing to flag.",
  },
  "/star-people-dev": {
    title: "Cut-scene people",
    what: "The people every cut scene is made of, on their own: faces and expressions, blinking eyes that look at things, hand poses, things held in the hands, a handshake. Each button runs one short proof so it can be judged before a scene uses it.",
    buttons: [
      { items: [
        ["Face / Hands / Pen signing / Handshake / Shirt / Trophy / Knee slide / Line-up / Builds / Heads / Rest", "Picks the proof. Line-up: eight managers, chairmen and fans made from the same body. Builds: one player at eight heights and builds. Heads: the hair styles. Rest: the body standing still, for checking its shape. Face: a close-up. Hands: a hand held up in each pose. Pen signing: sat at a desk, writes his name on the contract and looks up. Handshake: you and the manager shake and pump, then both look at the camera. Shirt: holds the club shirt up by its shoulders. Trophy: lifts the cup over his head. Knee slide: down on his knees, arms wide."],
        ["Studio / Contact sheet (top right)", "Two layouts of the same controls. Studio: the picture on the left, every control on the right. Contact sheet: drop-down picks on top (Proof, Head, Hair, Reset) and the expressions as cards. The page remembers which one you used last."],
        ["Reset (Contact sheet)", "Puts every pick back to the start: Face, Short, the middle skin, brown hair, neutral."],
        ["↺ Play again (under the picture)", "Plays the current proof again from the start."],
        ["Short / Buzz / Long / Manager", "Which head: the three player hair styles (each a different man, as in the game) or the manager."],
        ["The coloured dots", "The 8 skin tones a player can pick."],
        ["Black hair / Brown hair / Fair hair", "Hair colour."],
        ["neutral, smile, joy, roar, determined, effort, proud, emotional, disappointed, surprised, talk", "Changes his face to that expression (it fades over a third of a second)."],
        ["relaxed, open, flat, wave, fist, point, thumbsUp, pen, cup, mic, phone, shake, pinch, applause, ball, pump", "Hands proof only: the hand pose."],
        ["Turn", "Face proof only: turns him left or right so the face can be judged from the side."],
        ["Cut-scene people: New / Old", "For this page only. New: the painted face with real eyes. Old: the 3D people's own face, as in the 3D scenes before. Settings → Look has the real switch."],
        ["↺ Play again", "Runs the proof from the start."],
      ] },
    ],
    saving: ["Nothing here is saved. The page always shows the new human body and new faces; add ?body=before or ?look=old to the address to compare. Your phone's Settings are not changed."],
    needs: ["Both looks are being tested: they are on in Settings → Version → Preview only (rows \"3D body\" and \"Cut-scene people\" in 3D world)."],
    inGame: ["Every cut scene built on the people layer: the people here are the ones the scenes use. The game's own 3D people (match, shop, garden) are not changed."],
    dev: "lib/star/cutscene/people.ts (the API: Cast, Actor), face.ts (the face, eyes, expressions), hands.ts (hand poses), props.ts (props and grips), look.ts (the switch), peopleBench.ts (this page's proofs). The body: lib/star/human3d/human.ts (makeHuman, HumanSpec), npc.ts (seeded people), public/star/human3d/human.glb built by tools/human3d/build_human.py. Stills: window.__people.hold(t).",
  },
  "/star-garden3d-dev": {
    title: "3D Garden",
    what: "The walk-around 3D garden, on a made-up career, so every part can be seen without playing to it. It is the same screen a career opens from Home's Garden.",
    buttons: [
      { items: [
        ["‹ Home", "Back to the 3D places group page."],
        ["Day / Sunset / Night (above the scene)", "Changes the time of day. In a career it follows the time of your next kick-off."],
        ["Full career / New career (above the scene)", "Full: trophies, a horse, three cars and a mansion. New: nothing owned or won yet."],
        ["↻ Restart (above the scene)", "Builds the garden again from the start."],
        ["Scene editor › (above the scene)", "Opens the 3D Scene Editor on the garden: the walking camera (turn, rise, distance, lens) and the sun, Approve, Commit to game."],
        ["?bare=1 (in the address)", "The garden full screen, as before the admin frame (its switches float top left). ?film=1 does the same for the film tools."],
        ["?outfit=coat (in the address)", "He walks the garden in that casual set, as if picked at your house's wardrobe: hoodie, tee, shirt, tracksuit or coat. Without it: the club kit."],
        ["The stick (bottom left)", "Drag it to walk. A little way is a walk, all the way is a jog. On a computer, WASD or the arrow keys work too (hold Shift to jog)."],
        ["Drag the view", "Swings the camera round him."],
        ["Tap the ground", "He walks there, round anything in the way. A gold ring marks the spot and fades when he arrives. Touching the stick stops the walk. A mouse click works the same."],
        ["Tap something", "The shop, the trophy cabinet, the bench, the paddock, the cars or the teqball table: he walks up to it and its card shows. (Garden look Old: the card opens where you stand, as before.)"],
        ["Walk up to something", "The trophy cabinet, the bench, the paddock, the cars or the teqball table: its little card shows."],
        ["Walk into the shop's doors", "Opens the 3D Shop test page. In a career it opens the 3D shop, and its front doors bring you back out."],
        ["Walk into the casino's doors (back right)", "Opens the 3D casino on this page. Its doors bring you back out at the casino."],
        ["Walk through the training pitch's gate (back left)", "Opens the training pitch's placeholder screen. Back returns you to the gate."],
      ] },
      { group: "The 3D casino", items: [
        ["Walk up to a station", "Its card shows: tap it to open that game over the room."],
        ["Tap a station", "He walks up to it and its game opens as he arrives."],
        ["Roulette, Blackjack, Slots", "The tables on the left and right, and the four machines down the left wall: the casino's own games."],
        ["The big screen at the back", "Horse racing."],
        ["The counter on the right wall", "Competition bets."],
        ["The blue arcade cabinet (back right)", "Goalie Mode."],
        ["Leave a game", "Back to the room where you stood. Winnings and losses stay in the made-up money shown top right."],
      ] },
    ],
    saving: ["Nothing is saved. The career here is made up each time, and so is its money."],
    inGame: ["Home → Garden in a career opens this 3D garden. The shop where the house used to be is the 3D shop; the casino and the training pitch are at the back.", "Home → Casino opens the 3D casino when Settings → Look → Casino is 3D (the default), else the classic casino menu.", "A 3D Scene Editor edit APPROVED for the garden plays here when ticked for \"the test page\", and in a career when ticked for \"in a career\" (and its time of day matches). None: the garden as built."],
    dev: "components/star/Garden3D.tsx, lib/star/garden3d/scene.ts (Old look: sceneOld.ts); the casino components/star/Casino3D.tsx + lib/star/casino3d/scene.ts; the pitch's placeholder components/star/TrainingPitchScreen.tsx; tap to move lib/star/tapWalk.ts; the walk lib/star/walkClip.ts; draw-call merging lib/star/freezeStatic.ts; models packed by tools/garden3d/export_models.py and build_anims.py.",
  },
  "/star-training3d-dev": {
    title: "3D Training",
    what: "The 3D training pitch, on a made-up career: the drill picker a career opens from the garden's training-pitch gate, and every drill on it. Crossbar Challenge plays your shot on the real match; Two Touch, Free Roam, Headers & Volleys, Wembley and Pace Sprint are fully 3D, on the shared 3D engine.",
    buttons: [
      { items: [
        ["Drill switcher: Picker / Crossbar / Two Touch / Free Roam / Head/Volley / Wembley / Pace (picture cards under the pitch; ‹ › scroll them on a computer)", "Open the picker, or one drill straight away. ?drill=two-touch (or free-roam, crossbar, headers-volleys, wembley, pace) in the address does the same; add &mode=doubles for Wembley Doubles, and &pace=85 to give the test player that pace."],
        ["Pace Sprint", "3, 2, 1, GO: 30 m flat out to the yellow line with a defender just behind you. Your time and top speed (km/h) show as you run; 3, 2 or 1 stars by time against your next pace level, none if he catches you. In a career the stars go on the pace ladder like a 2D pace drill. Your speed comes from your pace: sprint 20 km/h at pace 0 up to 30 km/h at 100."],
        ["🎲 Random drill", "On the picker: one of the ready drills, picked for you (Wembley picked this way is Normal)."],
        ["A drill row", "Opens that drill."],
        ["Wembley: Normal / Doubles", "On the Wembley row. Then a pre-screen: how many players (3, 4, 5 or 6) or pairs (2 or 3), and Start."],
        ["Wembley: Watch to the end / Leave", "Once you're out. Watch plays the rest three times as fast; Leave ends it now. Either way your place stands."],
        ["Headers & Volleys: the yellow ring", "Where the cross comes down (head height, volley height, or along the grass for a low one). Faint while he lines it up, bright once it's struck. Get there and drag (or tap) as it arrives."],
        ["Crossbar: drag the ball", "Your shot, on the real match: aim, then the strike screen, exactly as in a match. As you strike it the 3D pitch fades in and shows the same ball flying."],
        ["3D drills: the camera", "Two Touch, Free Roam and Headers & Volleys: behind and above your right shoulder, turning on its own (60° a second at most) to keep you and the goal (or your team-mate) in shot. The stick never turns it. Headers & Volleys: it rises and follows the cross, then settles behind you for the strike. Wembley keeps the old chase camera."],
        ["3D drills: controls (phone)", "Left half: a stick appears under your thumb; push further to run faster. Right half: tap to touch or pass, swipe to kick (direction aims, length is power). Two fingers on the right: look round, springs back."],
        ["3D drills: controls (PC)", "WASD or arrows move, Shift sprints. Click: touch or pass. Hold the mouse where you want it and let go: kick (hold longer or drag further = harder). Q/E: look round. Space: touch. Settings → 3D world → 3D drill controls (Auto / Touch / Keys) overrides the device; ?controls=touch|pc on this page too."],
        ["Two Touch: the grade pop", "Every touch is graded by timing: Perfect touch, Good touch, Heavy, Scuffed it. A better first touch sits up higher and closer. Your return goes where you swipe or point, as hard as the swipe or hold: Too wide / Too hard / Too soft and he has to run for it. You step under the ball yourself; the stick only nudges."],
        ["3D drills: left thumb", "A stick: how far you push it sets the speed (walk, jog, run); all the way sprints. With a mouse: WASD or arrows run, hold Shift to sprint. The hint at the bottom follows your pointer (finger or mouse), not the screen size."],
        ["3D drills: tap on the right", "Free Roam: pass to the team-mate you face if you have the ball, take a touch if it's at your feet, tackle, or call for it. Two Touch: your keepy-up touch (1st controls it up, 2nd sends it back). Space bar does the same."],
        ["‹ Back (top left)", "On the picker, the pre-screen, Crossbar and every 3D drill, at any moment: back to the picker (or, opened straight from the top row, the 3D places group page). The drill ends there: no reward, nothing asked."],
        ["↻ Restart (top right)", "Starts again with a different team-mate."],
        ["Last (top right)", "The last result: score, won or lost, and the Team bar change, with the drill under it. A dash until you finish one."],
        ["Continue →", "On the result card. Here it just starts again and shows the result in the \"Last\" box at the top."],
      ] },
    ],
    saving: ["Nothing is saved. The career is made up, and the result (and the Team bar change it shows) goes nowhere."],
    inGame: ["Home → Garden → the training-pitch gate opens the same picker. Winning a drill (or a level crossbar finish) moves the Team bar the way the Woodwork challenge does, and costs the usual training energy. Pace Sprint leaves the Team bar alone and adds its stars to your pace instead."],
    dev: "app/star-training3d-dev/page.tsx; the gate and picker components/star/Training3D.tsx (the crossbar is CrossbarChallenge there, on EngineFeature); the 3D drills components/star/Play3D.tsx on the shared 3D engine lib/star/play3d (drill list drills.ts, rules twoTouch.ts / freeRoam.ts / wembley.ts / headersVolleys.ts / paceDrill.ts, speeds and stamina by stat lib/star/three3d/gait.ts (tests/star/play3dGait.mts), World world.ts, picture scene.ts; tests tests/star/play3d.mts, wembley3d.mts, headersVolleys3d.mts, practiceCam.mts); the practice camera lib/star/three3d/practiceCam.ts; the device controls lib/star/play3d/controlScheme.ts; crossbar rules lib/star/training3d/crossbar.ts (tests/star/crossbar3d.mts). Loaders through withMeshopt.",
  },
  "/star-shop3d-dev": {
    title: "3D Shop",
    what: "The walk-around 3D shop, with test controls. It is the same screen a career opens from the Shop page's \"Walk the 3D shop (beta)\" button. Here nothing reaches a career.",
    buttons: [
      {
        items: [
          ["‹ 3D places", "Back to the 3D places group page."],
          ["Start at the doors / Start in the middle (above the scene)", "Open the shop just inside its front doors (as when you walk in from the garden), or in the middle."],
          ["Edit in the scene editor › (above the scene)", "Opens the 3D Scene Editor on the shop: walking and card views (turn, rise, distance, lens), the light, Approve, Commit to game."],
          ["?bare=1 (in the address)", "The shop full screen, as before the admin frame. ?film=1 does the same for the film tools."],
          ["The club button (top right)", "Changes the kit he's wearing. Tap again for the next club."],
          ["The stick (bottom left)", "Drag it to walk. A little way is a walk, all the way is a jog. On a computer, WASD or the arrow keys work too (hold Shift to jog)."],
          ["Drag the view", "Swings the camera round him."],
          ["Tap the floor", "He walks there, round the displays. A gold ring marks the spot and fades when he arrives. Touching the stick stops the walk. A mouse click works the same."],
          ["Tap something", "A boot, the car, a light box or the fridge: he walks up to it and its card opens as he arrives. Already at that display: the card opens straight away and the camera moves in."],
          ["Walk up to a display", "Boots, the car on the turntable, the KIB can fridge or the counter. Its card opens on its own."],
          ["Walk out through the front doors", "Opens the 3D Garden test page, standing at the shop's doors. In a career it opens your 3D garden."],
        ],
      },
      {
        group: "The card",
        items: [
          ["‹ / ›", "The other items on that display: the next boot lights up, the next car rolls onto the turntable."],
          ["L1 … L5", "The five levels and their prices, from the real shop's numbers. KIB cans show the shop's three cans. On the counter, the light box changes to that level's picture."],
          ["Buy … (test)", "Pretend. He reaches out and the card says \"Bought (test only)\". No money is taken and nothing is kept."],
          ["✕", "Closes the card. It opens again the next time you walk up."],
        ],
      },
    ],
    saving: [
      "Nothing is saved. What you \"bought\" is forgotten when you leave.",
    ],
    inGame: [
      "Yes, as a beta: the Shop page (swipe right from Home) has a \"Walk the 3D shop (beta)\" button under Store and Casino. The normal shop is unchanged.",
      "In a career the card shows the career's own prices and an \"Owned\" or \"Wearing\" tag, and its button is \"See it in the shop\": it opens that item in the normal shop to buy it. Nothing is bought in 3D.",
      "The boots and the cars are real 3D models, made from the same Blender models as the shop pictures. Boots are shown at level 3; each car at one level (the card says which). The watches and jewellery are the shop pictures in light boxes, not 3D. The cans are simple 3D cans.",
      "A 3D Scene Editor edit APPROVED for the shop plays here when ticked for \"the test page\", and in a career when ticked for \"in a career\" (and its When matches: walking in from the garden, or from the Shop page). None: the shop as built.",
    ],
    needs: [
      "A phone or browser that runs 3D (WebGL). If it can't, the page says so and the normal shop still works. A slow phone drops to fewer pixels and no shadows on its own. Standing still it draws 30 times a second; walking, every frame at fewer pixels.",
    ],
    dev: "components/star/Shop3D.tsx (the screen, shared with the game's phase \"shop-3d\") · app/star-shop3d-dev/page.tsx · lib/star/shop3d/{scene,catalogue,kit,textures}.ts · public/star/shop3d/items/*.glb (boots + cars, Draco) made by tools/shop3d/export_items.py from tools/blender-shop/scripts/{boot,car,cars}.py · public/star/shop3d/draco/ (three's decoder) · the footballer: the new player (lib/star/people3d.ts, public/star/people3d/) by default, or the old character.glb + anims.glb (tools/shop3d/build_assets.py) when Settings → Look → \"3D shop player\" is Old (?player=old here) · three.js is the site's own package, loaded only when the shop opens",
  },

  "/star-home3d-dev": {
    title: "3D Home",
    what: "Your house in 3D, where you change clothes. A bigger home has more rooms (House look New): a house has a hallway, a lounge, a dressing room and a trophy room; walk through a doorway to go to the next room. The starter flat and the flat are one room. Here it runs on a made-up career, so every home and an empty or full trophy cabinet can be seen.",
    buttons: [
      {
        items: [
          ["‹ 3D places", "Back to the 3D places group page."],
          ["Scene editor › (above the scene)", "Opens the 3D Scene Editor on the house: walking and card views (turn, rise, distance, lens), the sun, Approve, Commit to game."],
          ["?bare=1 (in the address)", "The house full screen, as before the admin frame. ?film=1 does the same for the film tools."],
          ["starter … estate (above the scene)", "Which home you are in. In a career it is the best home you own: Studio Flat or City Apartment = flat, Penthouse, Suburban House = house, Beach Villa or Mansion = villa, Country Estate or Private Island = estate."],
          ["Full cabinet / Empty cabinet", "The made-up career with trophies, awards, cars, watches, jewellery and cans, or with none."],
          ["House: New / Old", "New: the home's rooms. Old: the one room, as it was. The same as Settings → Look → \"House\" (this button does not change that setting)."],
          ["Room name and dots (top middle)", "Which room you are in. Tap a dot to jump to that room."],
          ["Walk through a doorway", "The screen fades for a moment and you arrive in that room. Each doorway has the room's name over it."],
          ["The stick (bottom left)", "Drag it to walk. WASD or the arrow keys on a computer."],
          ["Drag the view", "Swings the camera round you."],
          ["Tap something", "The wardrobe, the trophy cabinet or the drive window: you walk up to it and its card opens. Tap the floor to walk there."],
          ["Walk out of the front door", "Opens the 3D Garden test page. In a career it opens your 3D garden."],
        ],
      },
      {
        group: "The wardrobe card",
        items: [
          ["Clothes", "Five casual sets: hoodie and joggers, tee and jeans, shirt and chinos, the club tracksuit, a smart coat. Tap one: you change into it and see it in the mirror."],
          ["Kits", "Your club's home and away kit."],
          ["Boots", "Plain black, or the boots you own now. Boots show with a kit."],
          ["✕", "Closes the card. It opens again the next time you stop at the wardrobe."],
        ],
      },
      {
        group: "The other cards",
        items: [
          ["Trophy cabinet", "Everything you have won and how many times. Faint spots are the big ones still to win (\"Win it to fill this\" on the plate)."],
          ["Your cars", "The cars you own, parked on the drive outside the window."],
        ],
      },
    ],
    saving: [
      "Nothing is saved here: the wardrobe's choice stays on this page.",
      "In a career the wardrobe's choice is saved on your career (it syncs with the rest of the save).",
      "The address can hold a set-up: ?tier=villa, ?trophies=0, ?house=old (the one room), ?look=h or ?look=old (Look H on or off), ?q=low|medium|high, ?fps=1 for the frame meter.",
    ],
    inGame: [
      "Yes: Home's phone has a \"Your house\" app, the Shop page has a \"Your house\" button, and the 3D garden has a house door on its east side.",
      "The casual set you pick is what you wear in the 3D garden and the 3D shop. The training pitch and matches are always in kit.",
      "A 3D Scene Editor edit APPROVED for the house plays here when ticked for \"the test page\", and in a career when ticked for \"in a career\" (and its When matches the home). None: the house as built.",
    ],
    needs: [
      "A phone or browser that runs 3D (WebGL). The casual clothes use the human body file (about 5.6 MB, downloaded once).",
    ],
    dev: "components/star/Home3D.tsx (the screen, shared with the game's phase \"home-3d\") · app/star-home3d-dev/page.tsx · lib/star/home3d/{homes,rooms,roomBuild,look,trophies,outfits,wear,textures,scene}.ts · the cars and boots: public/star/home3d/*-lod.glb (light copies of the shop's generated models, tools/home3d/make_lods.mjs) · the body: lib/star/home3d/wear.ts (the Style A hook: setWearerBody)",
  },

  "/star-sprites-dev": {
    title: "3D match figures",
    what: "The new small 3D players and keepers on their own, at the real match size: two clubs in their real kits running, standing, striking, celebrating, and a keeper diving. A 4x zoom underneath shows one of each.",
    buttons: [
      {
        items: [
          ["❚❚ / ▶ (top bar)", "Stops and starts the men moving, so one frame can be looked at closely."],
          ["On the pitch / 4× zoom (left list, top row on a phone)", "Jumps to that part of the page. Pages: 3D animations, 2D animations."],
        ],
      },
    ],
    saving: ["Nothing is saved. No career is touched."],
    inGame: ["The same figures are drawn in the match's New view (Settings: Players in the match → 3D)."],
    dev: "app/star-sprites-dev/page.tsx · lib/star/sprites.ts · public/star/sprites/ (made by tools/sprites/bake.mjs from the rigged models, which are not in the repo)",
  },

  "/star-sound-lab-dev": {
    title: "Sound Lab",
    what: "Hear, edit and rate different sounds for each thing that happens in a match (a pass, a shot, a save, the net, the whistle, the crowd), then send us your favourites.",
    buttons: [
      {
        items: [
          ["Layout: One sound | All sounds", "Two ways to see the same sounds. One sound: the events down the left (a drop-down on a phone), one sound open at a time with a big picture. All sounds: every sound as a short row; tap its name or Edit to open it in the Edit sound panel (under the row on a phone). This device remembers your choice."],
          ["Events (left list, drop-down or top pills)", "Pick what you are listening to: pass, shot, first touch, keeper save, keeper catch, post/bar, net, block, header, whistle, goal roar, near miss. A ✓ means you have picked one for it. In All sounds the pills jump to that event."],
          ["Sound tabs (One sound)", "The sounds for that event. Tap one to open it. ✓ marks your pick, ★ your stars."],
          ["▶", "Plays that sound. The first tap also switches sound on (phones keep it off until you tap)."],
          ["Pick circle (All sounds rows)", "Same as Pick this: your favourite for that event."],
          ["IN GAME NOW / FILE", "\"Current (match)\" is the sound the live match makes today. \"Current file\" is the recorded file the game has (goal videos use it), including any replacement uploaded on the Sound Board."],
          ["Green picture / blue bars", "The shape of the sound (loud parts tall) and how much low (left) and high (right) it has. The number is its length in seconds."],
          ["★ ★ ★ ★ ★ (Rate this effect)", "Rate it. Tap the same star again to clear it."],
          ["Pick this / ✓ My pick", "Your favourite for this event (one per event). Tap again to un-pick."],
          ["Note", "Write what you like or don't. It goes into the export."],
          ["Edit ▾ (or Edit on a row)", "Opens the sliders: Volume, Pitch, Length, Brightness, Punch, Body (low end), Room (echo). Let go of a slider to hear the change."],
          ["Reset", "Puts that sound's sliders back to how it was made."],
          ["Copy recipe", "Copies how that sound is built plus your slider settings, for us."],
          ["Save WAV", "Downloads that sound, with your sliders, as a .wav file."],
          ["▶ Pass → shot → GOAL (and the other blue buttons)", "Plays a short run of sounds together, using your pick for each event (or your best rated, or the first one), so you can judge them side by side."],
          ["Export my picks", "Copies a short plain-text list (each event → your pick, its stars, sliders and note, plus any other sounds you rated) and shows it in a box. Paste it to us."],
          ["Clear everything", "Wipes your ratings, notes, slider edits and picks on this device."],
        ],
      },
    ],
    saving: ["This browser only, instantly. Ratings, notes, slider edits and picks stay on this device; nobody else sees them until you send the export."],
    inGame: ["Nowhere yet. It is for choosing. Once Leo picks, the chosen recipes can be built into the match's sounds."],
    dev: "app/star-sound-lab-dev/page.tsx · lib/star/sfxLab.ts (recipes, the pure renderer, export) · tests/star/sfxLab.mts · files via lib/star/sfx.ts sfxUrl() · the live match's sounds: lib/star/matchSound.ts",
  },

  "/star-vfx-lab-dev": {
    title: "Visual Effects Lab",
    what: "See, edit and rate different pictures for each big moment in a match (a hard shot, a soft pass, the ball's trail, a save, a catch, a dive, the post, the net, a block, a header, a near miss, the goal moment), try your picks in a real match on the same page, then send us your favourites.",
    buttons: [
      {
        items: [
          ["Moments (left list; a row along the top on a phone)", "Pick which moment you are looking at. A ✓ means you have picked one for it."],
          ["Version tiles (under the big picture)", "Every version of this moment. Tap one to show it big and to rate, pick, note or edit it on the right. A tile shows ✓ pick, its stars, and LIVE while it is open in Edit."],
          ["Big picture (4 small pictures)", "The effect at four moments of its life, start to end, left to right. Drawn once each time you change something; nothing animates here."],
          ["IN GAME NOW", "\"Current (match feel)\" is what Settings → Match → Match feel: New draws today. Some moments draw nothing today; the card says so."],
          ["★ ★ ★ ★ ★", "Rate it. Tap the same star again to clear it."],
          ["Pick this / ✓ My pick", "Your favourite for this moment (one per moment). Tap again to un-pick."],
          ["Note", "Write what you like or don't. It goes into the export."],
          ["Edit ▾ (Edit panel, right)", "Opens the dials that style uses: size, length, strength, colours, how many, spread, camera shake, freeze at the hit, camera punch-in, and the word on comic bursts."],
          ["Reset", "Puts that variant's dials back to how it was made."],
          ["Copy recipe", "Copies how that variant is built plus your dials, for us."],
          ["Use my picks in the live match below", "On: the real match at the bottom draws your picks (and the variant you have open in Edit) on real kicks, saves and goals. Off: the match draws what this phone's game draws."],
          ["Live match", "The real engine (the same one a career plays) with the Play Area's settings. Play chances to see your picks in motion."],
          ["Export my picks", "Copies a short plain-text list (each moment → your pick, its stars, changed dials, the full recipe and your note, plus anything else you rated) and shows it in a box. Paste it to us."],
          ["Clear everything", "Wipes your ratings, notes, edits and picks on this device."],
        ],
      },
    ],
    saving: ["This browser only, instantly. Nobody else sees your picks until you send the export."],
    inGame: ["Nowhere yet. It is for choosing. The live match on this page is the only place the picks are drawn; the career match never uses them. Once Leo picks, the chosen recipes can be built into the match."],
    dev: "app/star-vfx-lab-dev/page.tsx · lib/star/vfxLab.ts (variants, the pure drawing, export) · CanvasMatch `vfxOverride` (TEST_ONLY in scripts/one-engine-guard.mjs) via EnginePlay · tests/star/vfxLab.mts · today's feel: lib/star/matchFeel.ts + matchFeelDraw.ts",
  },

  "/star-radar-dev": {
    title: "Match Radar",
    what: "Watch the match that runs behind your highlights — all ninety minutes, minute by minute: who has the ball, where it is, the momentum, and the moments that would be yours. It is the real unseen match, not a copy.",
    buttons: [
      {
        items: [
          ["Layout: Three columns | Big pitch", "Two layouts of the same page. Three columns: live radar and momentum on the left, the pitch in the middle, the match settings and minute-by-minute on the right. Big pitch: a big pitch with the radar and minute-by-minute beside it, the momentum (Events) under it. This device remembers your choice."],
          ["▶ / ❚❚", "Starts and pauses the clock. At full time it becomes ↻ and plays the same match again."],
          ["1× 2× 5× 10× 20×", "Match minutes per second. 20× plays a whole match in about 4½ seconds."],
          ["↻ (right of the speeds)", "A new match — a different roll of the same fixture."],
          ["The pitch", "Your goal on the left, theirs on the right. The dot is the ball, ringed in the colour of whoever has it; the arrow is the way they're attacking; the lit box is the area of the pitch it's in."],
          ["⭐", "A chance the match would hand to YOU — in a career, the highlight you play."],
          ["⚽ You score / ✕ You miss / Bench odds", "Only with \"Stop and ask me\" on: decides how your highlight went. Bench odds is the rate the game uses when you're not on the pitch."],
          ["Momentum strip", "A bar a minute: up is you on top, down is them. ⚽ marks goals, ⭐ your highlights, 🚑 an injury."],
          ["🚑 Injury", "The unseen match doesn't injure anyone minute by minute. A career checks once, at full time, from the energy you finish on — the radar does the same check and shows it at 90' and on the full-time card."],
          ["Change (The match panel)", "Opens the settings: both clubs and how strong they are, home or away, your position, your energy at kick-off (for the injury check), and whether your highlights stop the clock."],
          ["Real world (the Real world · many matches panel) · 100 / 200 / 500 · Measure", "Plays the real unseen match that many times with The match panel's settings, Match flow Old (what live players get today) and New, and puts shots, goals, shots that score, corners and possession beside real football (free Wyscout data, 1,941 matches: lib/star/sim/realTargets.json). Rows the match does not model yet (shots on target, blocks, saves, cards, offsides, headers) show the real number only. It reads; it changes nothing."],
          ["Fun targets (DRAFT, the Real world · many matches panel) · Run it", "Plays the real unseen match 200 times for each position (striker, winger, attacking mid, central mid) at an even game, +20 and −20. Each row shows ours against Harry's target, ✓ in range, ✗ out. The radar has no league input yet, so ours is checked against the National League and the Premier League side by side. A broken guardrail (shots a match 21–28, nobody over 36 season goals) is shown in red. Season goals are not judged: they show what share of chances your shooting would need to score."],
        ],
      },
    ],
    saving: ["Nothing is saved. Changing a setting starts the match again; leaving the page forgets it. Fun targets only reads the table in lib/star/funTargets.ts; edit that file to change a number. Real world only reads lib/star/sim/realTargets.json, made by scripts/opendata/reduce_resource.py from the free data (never edited by hand)."],
    inGame: [
      "Nowhere — it's a window onto the match the career already runs. Every minute is the real match's own function; your highlights are the moments a career would stop and let you play.",
    ],
    dev: "app/star-radar-dev/page.tsx · components/star/MatchRadar.tsx · lib/star/matchRadar.ts (calls tick/resolveScenario in lib/star/hiddenMatch.ts) · Fun targets: components/star/FunTargetsReport.tsx, lib/star/funTargets.ts (the table), lib/star/funTargetsMeasure.ts, tests/star/funTargets.mts · Real world: components/star/RealWorldTable.tsx, lib/star/sim/realTargets.json (scripts/opendata/reduce_resource.py; credits in lib/star/dataCredits.ts)",
  },

  "/star-fiveaside-dev": {
    title: "Five-a-side",
    what: "The five-a-side game on its own, in three tabs: play its chances one at a time, play a whole match with a radar beside it, and see what 500 simulated matches add up to. Every kick is the five-a-side screen the trial uses.",
    buttons: [
      {
        items: [
          ["Scenarios | Full match | Data", "The three tabs. This device remembers the last one you were on."],
          ["Settings: Opposition Easy | Even | Hard", "How good the other side is (Scenarios and Full match; beside the pitch, under it on a phone). Changing it starts the chance or the match again."],
          ["Settings: Your skill 40 | 70 | 100", "Your power and technique for every kick you take. Changing it starts again."],
        ],
      },
      {
        group: "Scenarios",
        items: [
          ["Yours | Team-mate's | Theirs", "Which way to play the picture. Yours: the ball is at your feet. Team-mate's: the same picture with a team-mate on the ball; you watch him. Theirs: the same picture turned round; they shoot at your goal and you get one tap."],
          ["◀ Prev / Next ▶ (◀ / ▶ on a phone)", "The ten five-a-side chance pictures (the same ten as the Scenario gallery's Five-a-side tab). This bar stays pinned at the top while you scroll, and shows how the last roll ended."],
          ["The pitch", "Your ball: tap a team-mate to pass, or drag back from the ball to shoot. Their ball: tap a man to throw a body at the shot, or tap the goal to send your keeper. The chance stops once it is over."],
          ["↻ Again (↻ on a phone)", "The same picture with the next roll of the dice (Roll 2, 3…). Turns yellow once a roll has ended."],
          ["This chance", "What to do, how the last roll ended, and your own goals here since you opened the page."],
          ["The bot, 200 tries", "How often this picture goes in when the bot plays it, from the Data tab's numbers (at Even, skill 70). Roll 1 on screen uses the same dice as the bot's try 1, but the screen's timing can still make it end differently."],
        ],
      },
      {
        group: "Full match",
        items: [
          ["Kick off", "Starts the match (45 minutes). Between your touches the match plays itself; your touches, your team-mates' chances near goal and theirs are played through the real kicks."],
          ["↻ New match / ↻ Play another", "A different match (a new roll), from kick-off."],
          ["Match radar", "The match from above: your goal on the left, theirs on the right. Blue dots are your side (you are ringed in yellow), orange are theirs, the white dot is the ball. The lit area is where the ball is, in the colour of whoever has it."],
          ["This match", "Chances so far for you, your team-mates and them, and how each ended, newest first. Team-mates' goals the match rolls between chances show on the score only."],
          ["Time on the ball (screen time)", "Who had the ball for how long on screen. Not the match's own count: the flow between chances is played fast."],
          ["Full time", "The score, your goals and touches, and the trial score this match would have earned."],
        ],
      },
      {
        group: "Data",
        items: [
          ["What looks broken", "Checks on the 500 matches: every match finishes, no kick freezes, nobody leaves the pitch, both sides score, the goals add up, a pass in the last third can become a shot, every chance picture can be scored. A ✗ is something to look at."],
          ["The numbers tiles", "Goals a match, results, shots, your side's share of the ball, and your touches a match."],
          ["Goals in a match / Who scores / Chance kinds / How chances end", "What the 500 matches add up to. Hover a bar for its number."],
          ["Each scenario, 200 tries", "Every chance picture played 200 times each way. Tap a cell to open that scenario in the Scenarios tab."],
          ["The ball / Harder opposition", "Each side's share of the ball and its longest spell on it; and the same bot against Easy and Hard sides."],
          ["How the bot plays", "The bot's rules: it stands in for your thumb in every number on this tab."],
        ],
      },
    ],
    saving: [
      "Nothing is saved. Playing here touches no career and no shared data. Leaving the page forgets your scenario tries; only the tab you were on is remembered, in this browser.",
      "The Data tab's numbers are a file in the code, made by a script and committed like any other change. They only change when someone re-makes them.",
    ],
    inGame: [
      "The trial's five-a-side stage plays this same screen. Nothing here changes it: the test area only starts it, stops it after one chance, and reads what happened.",
    ],
    dev: "app/star-fiveaside-dev/{page,FiveRadar}.tsx · components/star/FiveASide.tsx (test-only props autoStart, stopAfterChance, onChance, onFrame) · lib/star/fiveASide/scenarios.ts (shared with the gallery) · numbers: npx tsx scripts/fiveaside-data/run.mts → lib/star/fiveASide/simData.json (lib/star/fiveASide/simSummary.ts) · tests/star/fiveASideData.mts",
  },

  "/star-pc-match-dev": {
    title: "PC match + radar",
    what: "The real eleven-a-side match on the left and the whole pitch from above on the right, the five-a-side test area's layout tried on the real game. On a phone the radar folds under the match.",
    buttons: [
      {
        items: [
          ["↻ New match / ↻ Play another", "A different match (the next seed), from kick-off."],
          ["View: 2D | 3D", "The match screen's picture. 3D is the career's Match view 3D picture, switched on this page only: it does not change your Settings. On a slow computer 3D can take a while to build; the 2D match plays until it is ready."],
          ["Club and dials: Play Area ›", "Who you play for, your position and the other dials come from the Play Area's settings on this device, read when the match starts. Only its match length is not used: here it is always ninety minutes."],
          ["The match", "The real match, exactly as in a career: commentary between your chances, then you play each chance. Ninety minutes, then Full time with ↻ Play another."],
        ],
      },
      {
        group: "Radar",
        items: [
          ["Between chances", "The match nobody sees, minute by minute: the lit area is where the ball is, in the colour of whoever has it (blue your side, orange them). It moves as the commentary clock moves. GOAL!, SHOT, CORNER and YOUR CHANCE flash on the minute they happen. There are no players here: the unseen match has none."],
          ["During a chance", "Every man on the match screen and the ball, where the match has just drawn them, with the ball's trail. You are ringed in yellow, keepers have a white edge. The dashed box is the part of the pitch the match screen shows."],
          ["The bar under the radar", "Momentum, one bar a minute (up for your side, down for them), with each side's share of the ball at the ends."],
          ["This match", "Goals, shots and corners from the unseen match, and every chance you were handed with how it ended, newest first."],
        ],
      },
    ],
    saving: ["Nothing is saved. Playing here touches no career and no shared data."],
    inGame: [
      "Nowhere yet: a test area. The career match is unchanged. Its own small radar at the top of the commentary (Settings → Match radar) is left out on this page, so there is only one radar here.",
    ],
    dev: "app/star-pc-match-dev/{page,ElevenRadar}.tsx · reads only: EnginePlay's onChanceServed / onChanceResolved / onComplete, EngineFrameContext (lib/star/engineFrame.ts) during chances, and the live radar's minutes through LiveRadarTap (components/star/MatchRadar.tsx) between chances; MatchRadarLookOverride (lib/star/matchRadarLook.ts) turns the live radar on for this mount only · 3D: lib/star/style3d/engineView.ts, as components/star/Match3DLayer.tsx builds it",
  },

  "/star-sim90-dev": {
    title: "Full match",
    what: "A whole simulated ninety minutes you can watch: 22 men and the ball. It is played live: the unseen match the career runs plays only up to your next chance, you play that chance, and the rest of the match plays on from how it went (score, momentum, who has the ball). This page stages it in each club's formation.",
    buttons: [
      {
        items: [
          ["Match + events | TV broadcast", "Two layouts of the same page (top right; its own row on a phone). Match + events: the match with the events list beside it. TV broadcast: the match full width, then a momentum graph, the controls, and the events and teams under it. This device remembers your choice."],
          ["Momentum (TV broadcast only)", "How the match has swung so far, minute by minute: above the line the home side is on top, below it the away side. ⚽ marks each goal (tap one to watch it). Tap the graph to jump back to that moment."],
          ["▶ / ❚❚", "Starts and pauses the match. At full time it becomes ↻ and plays it again from kick-off."],
          ["1× 4× 16× 60×", "How fast the match plays. 60× plays all ninety minutes in about a minute and a half."],
          ["↻ (right of the speeds)", "A new match: a different roll of the same fixture."],
          ["2D | 3D | Radar", "One view, three ways to show it: the TV picture, the 3D picture, or the radar (who has the ball each minute, and where). Only the one you pick is drawn. This device remembers your choice. Default 2D."],
          ["The slider", "Drag back to any moment already played. You can't jump ahead: the rest hasn't happened yet."],
          ["Match events", "Goals, saves and misses so far, newest first (Show all adds corners and every shot). Nothing shows before it happens. Tap one to watch it again."],
          ["Change", "Pick both clubs and how strong they are. The match starts again."],
          ["Your chance (no button)", "You watch until the ball reaches you. At each of YOUR chances (home is your side) the real match takes over (2D or 3D, as Settings says), with no question. Score it and it's a goal in this match; miss it and it isn't. The rest of the match is played from that score."],
          ["Back to the match", "Once the chance is over the match carries on by itself after 3 seconds (the button counts down). Tap it to go at once. Leaving a chance early counts as a miss."],
          ["Watch only (don't play my chances)", "Off by default. On: your chances are settled at the bench rate (how often a chance goes in for whoever plays instead) and the match plays straight on."],
        ],
      },
    ],
    saving: ["Nothing is saved. Changing a setting starts a new match; leaving the page forgets it (the 2D | 3D | Radar choice is the one thing this device keeps). The same match and the same results always play out the same way. Real squad names come from the league-squads data route; made-up names when it does not answer. The teams swap ends at half-time; keepers dive on saves. The side on the ball looks forward first, runs with it into space and switches play only when its side is shut."],
    inGame: [
      "Nowhere — a test page. The score and the chances are the real unseen match's, with your results fed in the career's way; the men's positions and passes are made up to show it.",
    ],
    dev: "app/star-sim90-dev/page.tsx · components/star/Sim90View.tsx, Sim90View3D.tsx · lib/star/sim90.ts (startSim90 / resolveSim90Chance; runs lib/star/matchRadar.ts live, places men with formationShape.ts) · drawn by lib/star/goalClip/render.ts (camera \"match\") · test tests/star/sim90.mts",
  },

  "/lineups": {
    title: "Squad Builder",
    what: "Every club's formation, starting XI, bench and manager — the team sheets the career game uses.",
    buttons: [
      {
        items: [
          ["Division tabs", "Premier League, Championship, League One, League Two, National League, Champions League, Europa League, Other."],
          ["Club / Formation dropdowns", "Pick a club, and the shape it plays."],
          ["Best XI", "Auto-picks the strongest eleven and a bench."],
          ["Backup", "Copy every saved lineup to your clipboard, or paste one back in and Restore it."],
          ["Who manages …?", "Type the manager's name."],
          ["Tap a player, tap where he goes", "Moves or swaps him — pitch, bench (up to 9) or reserves. Tap him again to put him down."],
          ["Saved ✓ / ⚠", "Shown bottom-right after each change: saved for everyone, or why it wasn't."],
        ],
      },
    ],
    saving: [
      "Saves on its own a moment after every change — no Save button.",
      "Saved to the shared table star_lineups, for every player's career. Only an admin sign-in can save there; otherwise you get a ⚠ and it stays in this browser.",
    ],
    inGame: [
      "Every Star Career team sheet, the club's strength in the league, and the manager name shown in the game.",
    ],
    needs: ["The star_lineups table (supabase/migrations/star_lineups.sql). Without it saves fail and every club uses an auto-picked side."],
    dev: "app/lineups/page.tsx · components/star/LineupBuilder.tsx · lib/star/lineupStore.ts · /api/star/lineups",
  },

  "/star-tuning-dev": {
    title: "Balance numbers",
    what: "Every game-balance number in the Star Career game — energy, training, ratings, sponsors, contracts, transfers — plus shop prices.",
    buttons: [
      {
        items: [
          ["Groups (left; along the top on a phone)", "Pick a group of numbers. Shop prices holds the shop; Everything shows all of them at once. A yellow count shows how many you've edited."],
          ["Number boxes and sliders", "Type a new value or drag the slider. An \"edited\" tag shows it's changed from the default."],
          ["Reset (on a row)", "Puts that one number back to its default."],
          ["Shop prices", "KIB cans (price and energy), boots and lifestyle items."],
          ["Reset everything to default (bottom bar)", "Puts every number and price back. Asks first."],
        ],
      },
    ],
    saving: [
      "Saved instantly — but in THIS browser only. Nobody else's game changes.",
      "Most numbers only take effect the next time the game loads: refresh to see an edit.",
    ],
    inGame: [
      "Only your own /star-dev game, on this device. To change the real game for everyone, ask for the number to be changed in the code.",
    ],
    dev: "app/star-tuning-dev/page.tsx · lib/star/{tuning,tuningStore}.ts",
  },

  "/star-dev/media-lab": {
    title: "Media Lab",
    what: "A test bench for the media-feed graphics, laid out as a post wall: drop in a pose and a face and see every template in every club's colours, plus every screen it can open.",
    buttons: [
      {
        items: [
          ["Pills along the top (All, Transfer graphic, Player of the Month, Screens, Shop, Training)", "Show only that part of the wall. This device remembers the last one."],
          ["Preview team sheets (top right)", "Opens the team sheets with sample data, with the play-as picker above them."],
          ["Pose, face and sliders (left; on a phone, tap the bar to open it)", "The tools for the transfer graphic. Only there when All or Transfer graphic is picked."],
          ["Pose image / Face image — Choose file (or drop)", "Load a picture. \"remove\" clears it."],
          ["Club colours", "Re-colour the templates in that club's kit."],
          ["Treatment / Face X / Face Y / Face size / Neck line / Face brightness / Figure size / Figure up / down", "Line the face up on the pose."],
          ["Anchor", "The numbers to copy into the template once it looks right."],
          ["Player of the Month tiles", "The post cards (shortlist, someone else wins, you win with and without a photo) and the photo picker (try only, nothing saved)."],
          ["Screens: Preview on \"You won it\" / Team sheets / Match commentary", "Opens that screen with sample data."],
          ["Screens, Shop and Training tiles with Open / New / Old / Play / still-float-bounce-bobble", "Open the same views as the addresses below (the page loads again). Training: pick the level with ◀ ▶ first."],
        ],
      },
      {
        group: "The same views by address (add to the address)",
        items: [
          ["/star-dev/media-lab?trophies", "Shows the Trophy Cabinet filled with every trophy that has a picture, for judging the trophy art."],
          ["/star-dev/media-lab?contact=float (or bounce, bobble, still)", "Shows the strike screen with the ball moving that way (float = header, bounce = volley, bobble = a ball at your feet). Tap the ball to try it; it starts again a moment later."],
          ["/star-dev/media-lab?shopmock=A (or =B, =C, =D)", "Shop layout ideas, not the real shop: A swipe through one big item, B a dense grid, C the shop wall with shelves, D one item per screen like a video feed. Same items and prices, a sample ★1,000,000, and a pretend buy sheet. Nothing is bought or saved."],
          ["/star-dev/media-lab?shop=kib (or =boots, =lifestyle, =landing; add &look=old for the old shop)", "Shows the shop (new look unless &look=old) with a sample National League career and ★1,000,000. Buying works on the sample only — nothing is saved. Add &bar=B or &bar=C to see the other two places for the categories (A, a word strip under the header, is the game's). Add &democlips to put two made-up goals on this device, so the For You feed shows a highlights ad. Add &locks to keep the star-rating locks (most style items locked, as for a new player). &mark=none hides the trophy level badge; The Buy pill is white on Homes and red everywhere else (to compare); &buy=A or &buy=B shows one everywhere."],
          ["/star-dev/media-lab?training=vision&level=1", "Plays one training level with every skill at 40 (skill = pace, power, technique, vision or freeKick; level 1-30). Level 1 opens on its how-it-works card. Nothing is saved to a career."],
          ["/star-dev/media-lab?feed", "Shows seven fixed sample posts at phone width, drawn exactly the way the phone feed draws them — for judging how a post looks. Nothing to press; scroll to read."],
        ],
      },
    ],
    saving: ["Nothing is uploaded or saved — your pictures stay in this browser tab and vanish on refresh."],
    inGame: ["Nothing here reaches the game on its own. The Anchor numbers go into the code by hand. The feed preview uses the same post design players see in the phone feed, so a change to how posts look shows up here first."],
    dev: "app/star-dev/media-lab/page.tsx · components/star/media/* · feed preview: components/star/media/FeedPreview.tsx",
  },

  // ════════════════════════════════════════════════════════════════════
  //  SANDBOXES
  // ════════════════════════════════════════════════════════════════════

  "/star-dribble-dev": {
    title: "Dribble (sandbox)",
    what: "The first-person dribbling modes, with dials for feel.",
    buttons: [
      {
        items: [
          ["One-on-one duels / Open run (classic dribble)", "Switch mode. Duels is the one real matches use."],
          ["Pace / Opponent strength", "Your speed and how good the defenders are."],
          ["1 2 3 4", "Waves of defenders (duels) or chasers (open run)."],
          ["Open-side assist glow", "Shows which side is open — gives the answer away, so off by default."],
          ["Height / Tilt down / Distance behind", "The chase-cam."],
          ["Camera follow speed / Ball touch reach", "How the dribble feels."],
          ["Fixed seed", "Replay the same run every time."],
          ["Tap to start / Go Again", "A run waits for your tap before anyone moves; Go Again starts the next one straight away."],
        ],
      },
    ],
    saving: ["Nothing is saved. Any change starts a fresh run."],
    inGame: ["Nothing here changes the game. Values that feel right have to be put into the code by hand."],
    dev: "app/star-dribble-dev/page.tsx · components/star/{FirstPersonDribble,FirstPersonRoam}.tsx",
  },

  "/star-dribble-stick-dev": {
    title: "Dribble on the stick (test)",
    what: "The real match, where every chance you get is a dribble run. Try moving with a stick, as in the 3D games, against the game's own swipe.",
    buttons: [
      {
        items: [
          ["Stick / Swipe", "How you move on the run. Stick: a stick under your left thumb sets your speed and direction. Swipe: the game's own controls. Each press starts a new match."],
          ["The stick (left half)", "Put your thumb down anywhere on the left. A small push walks, a full push sprints. Let go and you stop. A fast flick sideways knocks the ball past a man."],
          ["Right half", "Tap a team-mate to pass to him. A fast sideways swipe knocks the ball past a man."],
        ],
      },
    ],
    saving: ["Nothing is saved. It is a test match: no career, nothing counted."],
    inGame: ["Nothing here is in the game yet. The game still uses the swipe."],
    dev: "app/star-dribble-stick-dev/page.tsx · lib/star/firstPersonDribble.ts (THE STICK) · components/star/CanvasMatch.tsx (dribbleControl, dribbleOnly) · tests/star/dribbleStick.mts",
  },

  "/draft-dev": {
    title: "Draft (dev)",
    what: "A copy of the PL Draft game with the V2 setup screen, for trying a new look.",
    buttons: [
      {
        items: [
          ["Setup screen", "Formation, era, mode, respins — then start, or create / join a multiplayer room."],
          ["[test] skip draft → auto-fill squad", "Admins only: skips the draft with an auto-picked squad."],
          ["The rest", "Plays exactly like the real PL Draft."],
        ],
      },
    ],
    saving: [
      "It uses the SAME browser save as the real PL Draft, so a run here replaces (or resumes) your real Draft run on this device.",
      "Multiplayer rooms are real rooms in the live database, and finished seasons are sent to your real Draft history, XP and records.",
    ],
    inGame: ["The results count on your real profile. The setup screen itself isn't live."],
    dev: "app/draft-dev/page.tsx · components/draft/DraftSetupHero.tsx",
  },

  "/draft-challenge-dev": {
    title: "Challenge Draft",
    what: "A draft where every round is a random brief (a rating band, a nationality, a club, an era…) instead of a position.",
    buttons: [
      {
        items: [
          ["Era", "All time, Modern or Classic."],
          ["Start solo draft", "Fourteen rounds, then pick a formation from who you ended up with."],
          ["Play with friends", "Create or join a room; everyone must be signed in."],
        ],
      },
    ],
    saving: [
      "Solo runs are not saved.",
      "Rooms are real rows in the live multiplayer tables (the same ones the PL Draft uses).",
    ],
    inGame: ["Not on the site yet — a dev sandbox."],
    dev: "app/draft-challenge-dev/ · /api/draft-challenge/*",
  },

  "/draft/preview": {
    title: "Draft Design Preview",
    what: "Redesigns of the Draft's league table and team screen, on sample data, to decide whether to make them official.",
    buttons: [
      {
        items: [["League Table / Starting XI", "Switch between the two redesigns."]],
      },
    ],
    saving: ["Nothing — sample data only."],
    inGame: ["Not used by the real game until someone decides to make it official."],
    dev: "app/draft/preview/page.tsx · components/draft/preview/*",
  },

  "/admin/marketing": {
    title: "Production board",
    what: "The Marketing tab's home: every Knowitball video as a card, in the column for the step it is at (Idea → Script → Script OK → Making → In edit → Final check → Posted). Admins only.",
    buttons: [
      { group: "Top of the page", items: [
        ["Marketing (game tab across the top)", "This area. Only Harry, Mikey and Leo see the tab; testers never do."],
        ["Board | Client | Suite | Uploads", "Switch between this board, the Knowitball client page, the editing suite and the uploads page."],
        ["Soon: Calendar · Scripts", "Not built yet: a line of text, not buttons. They come in later slices of the plan."],
        ["↻ Check now", "Reads the board again straight away. It also reads by itself about once a minute."],
      ] },
      { group: "The board", items: [
        ["All · Idea · Script · Script OK · Making · In edit · Final check · Posted", "Show every column, or one. The number is how many videos are in it. On a phone the row slides sideways, and All shows only the columns with videos in, with the empty ones named on one line (\"Nothing in …\"). A computer shows all seven columns side by side."],
        ["A card", "One video: its cover, title, step, who is making it, the day it goes (or went) out, its length and one line about it."],
        ["Script ↗ / Cover ↗ / Video ↗", "Open that file on GitHub, on the branch the card came from."],
        ["What happened (N)", "Opens the card's short log: one line per step, newest last."],
      ] },
    ],
    saving: [
      "Nothing is saved from this page. You cannot move a card here yet.",
      "The cards live in the code, in one file (marketing/board.json). A Claude chat moves a card by changing that file and pushing its own branch (the video-board skill). The board reads main and Harry's, Mikey's and Leo's branches from GitHub about once a minute, so a pushed change shows within a minute or two, with no deploy and no database. Two branches with the same card: the newest change wins.",
      "If GitHub can't be reached, the board shows the copy built into the site and says so at the top.",
    ],
    inGame: ["Nowhere. This is for making our own videos."],
    dev: "app/admin/marketing/page.tsx · components/admin/marketing/{ProductionBoard,MarketingTabs}.tsx · lib/marketing/board.ts (pure; tests/star/adminMarketing.mts) · /api/admin/marketing/board · marketing/board.json · .claude/skills/video-board/SKILL.md · leak guard: scripts/marketing/private-names-guard.mjs",
  },
  "/admin/marketing/client": {
    title: "Knowitball client",
    what: "Knowitball set up as a client, the way a video studio keeps a client: who we are, our voice, audience, rules, brand, what each video taught us, and our best scripts. Admins only.",
    buttons: [
      { group: "On this page", items: [
        ["Board | Client | Suite | Uploads", "Switch between the parts of the Marketing tab."],
        ["The record file ↗", "Opens the client record on GitHub."],
        ["A grey code (e.g. RUL-KIB-001)", "The Brain note each line comes from. Quote it when you want something changed."],
        ["To confirm (amber)", "A note still waiting for Harry's yes (for now: the audience)."],
      ] },
    ],
    saving: [
      "Nothing is saved from this page. It only reads.",
      "The words come from Brain notes with the tag client-kib, listed in one short file (marketing/clients/knowitball/client.md). To change a line, a Claude chat writes a new Brain note, marks the old one superseded, rebuilds the Brain index and swaps the code in the file. It shows here after the next deploy.",
    ],
    inGame: ["Nowhere. It guides how our videos are written and made."],
    dev: "app/admin/marketing/client/page.tsx · lib/marketing/clientRecord.ts (pure parts tested in tests/star/adminMarketing.mts) · marketing/clients/knowitball/client.md · brain/*/{FACT,RUL,REF}-KIB-*.md · next.config.mjs traces those files for Vercel",
  },
  "/admin/marketing/suite": {
    title: "Editing suite",
    what: "Watch one of our cuts on a timeline and leave notes on it. Review notes say what to fix, keep or check at a moment. Edit notes are instructions for Claude: cut a bit out, change something at a moment, or a change for the whole video. Admins only.",
    buttons: [
      { group: "The list", items: [
        ["A video (Open ›)", "Opens that cut in the suite. The list is every video in storage, newest first."],
        ["○ Storage not connected here", "Shown when this copy of the site has no storage settings. On a computer running the game for development, the list shows the videos already in the code instead (docs/marketing/videos)."],
      ] },
      { group: "The video and the timeline", items: [
        ["‹ All videos", "Back to the list."],
        ["▶ / ❚❚ (or Space)", "Play and pause. Tapping the video does the same."],
        ["‹1s ‹1f 1f› 1s› (or ← →, Shift for a second)", "Step back or on by one frame or one second. On a narrow phone only the frame steps show."],
        ["− / +", "Zoom the timeline out and in. Zoomed in, swipe the timeline sideways; it follows the playhead while playing."],
        ["Tap the timeline", "Moves the playhead there. Top to bottom: times, a filmstrip, the sound wave (only for files under 80 MB), then the Review and Edit lanes."],
        ["A coloured block", "One note: teal Fix, green Keep, yellow Check, blue Change, striped red Cut out. Tap it to jump there and light up its card."],
      ] },
      { group: "The notes", items: [
        ["Review | Edit for Claude", "Switch between the two kinds of note. They are kept apart and never mixed."],
        ["+ Add at 0:07.4 (or M)", "Pauses and opens a new note at the playhead."],
        ["✂ Cut from here", "Edit only: starts a Cut out note from the playhead. Play on or step, then Set To."],
        ["Fix · Keep · Check / Cut out · Change here · Whole video", "The kind of note."],
        ["From / To · Set to 0:07.4", "The stretch the note is about. Set to puts the playhead's time in."],
        ["Save / Cancel", "Save stores the note for everyone at once. Cancel throws the draft away."],
        ["For the whole video · Save for Claude", "Edit only: a change that is not tied to a moment."],
        ["A card's time", "Jumps the video there."],
        ["Edit / Delete", "Change a note, or remove it at once (no undo)."],
        ["Copy for Claude", "Copies every note and edit as text, ready to paste into a Claude chat."],
        ["Done by Claude / Skipped", "Shown on an edit once Claude has dealt with it."],
      ] },
    ],
    saving: [
      "Shared with Harry, Mikey and Leo, the moment you press Save: each video's notes are one small file beside the video in our private video storage (Cloudflare R2). No database, nothing in the code, no deploy.",
      "Two people saving at once both keep their notes (each save is one change, added to what is already there).",
      "Claude reads the notes with a script when its chat has the storage settings, or from the Copy for Claude text you paste. It then marks each edit Done or Skipped.",
      "On a computer running the game for development, notes go to a scratch folder on that computer only.",
    ],
    inGame: ["Nowhere. This is for making our own videos."],
    needs: ["The four storage settings in Vercel: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET. Without them the page says \"Storage not connected here\" and lists nothing."],
    dev: "app/admin/marketing/suite/page.tsx · components/admin/marketing/{SuiteBrowser,CutEditor}.tsx · lib/marketing/suite.ts (notes, pure) · lib/marketing/{r2,mediaApi,storage}.ts · /api/admin/marketing/{media,media/play,notes} · scripts/marketing/suite-notes.mjs · skills review-timeline, suite-inbox · tests/star/marketingStorage.mts",
  },
  "/admin/marketing/uploads": {
    title: "Uploads",
    what: "Put a video or a picture into our private video storage, straight from this device, and link it to a video card on the board. Admins only.",
    buttons: [
      { group: "On this page", items: [
        ["● Storage connected / ○ Storage not connected here", "Whether this copy of the site can reach the storage. Connected also shows what you have used today against the daily limit."],
        ["Video card", "Pick the board card this file belongs to, or leave it as Not linked to a card."],
        ["Choose a file (or drop files on the box)", "Uploads it. A bar shows how far it has got. The file goes straight from your device to storage, never through the site."],
        ["Open in Suite", "Opens that video in the editing suite."],
        ["↻ Check now", "Reads the list from storage again."],
      ] },
    ],
    saving: [
      "Shared with Harry, Mikey and Leo: files go into our private video storage (Cloudflare R2, bucket kib-marketing). Nobody outside the admin can open them; a play link lasts one hour.",
      "The list is read from the storage itself, so there is nothing else to keep in step.",
      "Limits (to keep the bill at zero): one file up to 500 MB; videos (mp4, mov, webm) and pictures (jpg, png, webp, gif) only; 30 files and 5 GB per person per day, reset at midnight UK time. A link handed out counts even if the upload then fails.",
      "A dropped connection means starting that file again (no resume yet). Use Wi-Fi for big files.",
    ],
    inGame: ["Nowhere. This is for making our own videos."],
    needs: ["The four storage settings in Vercel: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET. The bucket's sharing rule (CORS) must allow PUT from knowitball.co.uk, or uploads stop at 0%."],
    dev: "app/admin/marketing/uploads/page.tsx · components/admin/marketing/UploadsPanel.tsx · lib/marketing/uploadClient.ts · lib/marketing/{r2,mediaApi,storage,caller}.ts · /api/admin/marketing/{upload,upload/done,media} · tests/star/marketingStorage.mts",
  },

} satisfies Record<string, AdminGuide>;

export type GuidePage = keyof typeof ADMIN_GUIDES;
