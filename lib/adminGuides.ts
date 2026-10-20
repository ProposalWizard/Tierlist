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
    what: "Run the live site's content: tierlists, categories, vote tierlists, blind rankings, the daily games, objectives, cards and feedback.",
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
    dev: "app/star-retirement-dev/page.tsx; screens components/star/CareerEnd.tsx, CareerOverview.tsx, HallOfFame.tsx, AllSeasonsNew.tsx, Farewell.tsx, LegendShare.tsx, ShareCard.tsx; the farewell lib/star/farewell.ts, guardOfHonour.ts, farewell3d.ts, the ovation ovation.ts, ovation3d.ts, ovationLook.ts; sharing lib/star/legendShare.ts, app/api/star/legend, app/legend/[code]; numbers lib/star/careerOverview.ts; the made-up careers lib/star/retirementPreview.ts; the Hall lib/star/hallOfFame.ts; the Ballon d'Or night components/star/BallonDorNight.tsx, lib/star/ballonDorNight.ts, ballonDor3d.ts, ballonDorNightLook.ts.",
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
    what: "Real match positions in our engine, from free-licensed data (cleared for a paid game, with credit). Fully real: every shot and corner of 7 Bundesliga / 2. Bundesliga 2022/23 matches (DFL tracking) and 20 A-League 2024/25 matches (SkillCorner tracking), all 22 players where they really stood. Real shot, placed defenders: every World Cup 2018 / Euro 2016 shot (Wyscout): the shot is real, the other players are placed by the game's own rules. Each is drawn as a chance in the game's camera and playable in the real match. Testing only.",
    buttons: [
      { group: "Filters", items: [
        ["Fully real shots / Fully real corners / Real shots, placed defenders", "Which set to show, with how many there are. Every row says Fully real or Real shot, placed defenders."],
        ["Every kind / One-on-one / In the box / Tight angle / Long range / Free kick / Corner", "Which chance kind the moment was put in. \"In the box\" is a close shot with defenders in the way."],
        ["All / xG under 8% / 8–50% / Over 50%", "How likely the real shot was to go in (DFL's own number for DFL shots; our model fitted on 45,287 Wyscout shots for the rest). Not shown for corners."],
        ["Goals only / Led to a goal", "Only shots that went in for real (corners: only corners whose move ended in a goal)."],
        ["Search players, matches", "Only moments whose player, match or competition has these words."],
      ] },
      { group: "The list (left; under the picture on a phone)", items: [
        ["A row", "Picks that moment: it shows big on the right. A small picture, the player and minute, the match, the kind and xG, and which kind of picture it is."],
        ["More", "Shows 24 more."],
      ] },
      { group: "The picked moment", items: [
        ["The picture", "Red = defenders, green = keeper, blue = team-mates, YOU = the real shooter (or corner taker), with the ball at his feet. Only people inside the camera are kept."],
        ["▶ Play / ■ Stop", "Plays the real match on that picture, or goes back to it. Nothing is counted or saved."],
        ["Next to the game's own", "Puts a chance the game made of the same kind beside the real one, with its own Play."],
      ] },
    ],
    saving: ["Nothing saves. The moments are read from data/realmoments/ (tracked.json, wyscout_shots.json) each time the page opens."],
    inGame: ["Nowhere yet. The moments (with where everyone was over the seconds before, lib/star/realMoments buildUpOf) are ready for the Full Highlights Rebuild's build-ups."],
    dev: "app/star-real-moments-dev/page.tsx; lib/star/realMoments/ (types, shots.ts scenarioForShot / scenarioForCorner, track.ts buildUpOf / trackLeadIn); app/api/star/real-moments/route.ts; data/realmoments/ (README); scripts/realmoments/ (extract_tracking.py, extract_wyscout.py); credit lines in data/opendata/LICENCES.md; tests/star/realMoments.mts.",
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
    what: "A little game of real goals (Leo, 18 Oct 2026). Every non-penalty goal of the 2018 World Cup and Euro 2016 (232, Wyscout's free data), played in the real match: the real move is replayed first, then the shot is yours. Score it, and the closer your ball crosses the line to where the real one went, the more stars. Wyscout has nobody's position off the ball, so the defenders and keeper are placed by the game's own rules.",
    buttons: [
      { group: "Top", items: [
        ["★ total (top right)", "Every star you have, out of 150 (50 levels × 3)."],
        ["The big card · PLAY IT", "The next level to play: the first open level without three stars. Its picture shows where the real goal went in (green dot). PLAY IT opens it."],
        ["🗺️ Levels", "The levels as rows, one row per stage (Group stage → The final), 10 goals each, easiest first (difficulty: the chance of a goal from our model, distance, a top corner, a header). ‹ › move a row along (on a phone, swipe it). Each card: level number, where the real goal went in, scorer and minute, who it was against, your stars, ▶ to play. A level opens when the one before it has a star; a stage opens at 6 / 15 / 26 / 38 stars in all."],
        ["🔎 All 232 goals", "Every goal, searchable by player, team, match or stage. The famous ones (Pavard v Argentina, Ronaldo's free kick v Spain, Kroos v Sweden, Shaqiri's overhead kick, Bale v Slovakia…) are first. More shows 20 more. The page remembers which of the two you had open."],
      ] },
      { group: "Playing a goal", items: [
        ["The header", "The real score just before the goal, the minute, who you are and the body part."],
        ["👻 Ghost on/off", "The real goal's ball, drawn faint on the pitch: a dashed line along its flight and its shadow, and a pale ball running it on a loop while you aim. Once you strike, it races your ball. Wyscout has where the ball was struck and which part of the goal it went in (low / middle / high × left / centre / right), so the ghost aims at that part's middle and the arc is drawn the shape the strike suggests."],
        ["▶ Build-up on/off", "On: the real move is replayed first (every pass and carry at the real time, up to 14 s), then the shot is yours. Off: straight to the shot."],
        ["🎥 TV / Behind him / Side-on", "The 3D camera (3D | 2D button in the match bar): the TV view, low behind the shooter, or turned side-on. Kept only while this page is open; your own camera lock comes back when you leave."],
        ["The match", "The real match. The real nations' names and kits, the scorer's and the conceding keeper's real names: never the test club. You strike as an elite finisher (power 85, technique 95, curl boots), clear weather, nobody closes you down. Strike it along the real goal's line (within 60 cm across, 55 cm up, inside the posts) and nobody blocks it and the keeper does not save it. Off the line it plays as normal."],
        ["The result", "Goal or not, the % like the real goal (100% on the spot, 85% at 45 cm off, 60% at 80 cm), the stars (★ a goal, ★★ 60%+, ★★★ 85%+), and a picture of the goal mouth with the real spot (green) and yours (blue). ↺ Again: the same chance comes back, just shoot. Next level → once you have a star."],
        ["✕", "Closes the goal."],
      ] },
    ],
    saving: ["Your stars and best % per goal are kept in this browser only (localStorage, star-real-goals-progress-v2; the old v1 stars were for the StatsBomb goals and are not carried over). Nothing goes to the database or the repo."],
    inGame: ["Nowhere yet. This is a test page."],
    dev: "app/star-real-goals-dev/page.tsx; lib/star/realGoals.ts (levels, stars, accuracy, kits, names, ghost, build-up) and lib/star/realGoalView.ts (what the match is handed); CanvasMatch's `realGoal` prop (drawing only, TEST_ONLY in scripts/one-engine-guard.mjs); canvasEngine.ts Scenario.realLane (the real lane, off by default); data/realmoments/wyscout_shots.json + wyscout_goals.json (scripts/realmoments/extract_wyscout.py); tests/star/realGoals.mts and tests/star/realGoals/ (harness, measure, buildup).",
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
        ],
      },
    ],
    saving: [
      "Rewards save straight to the live database (Supabase table rewards) and apply to every player immediately.",
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
          ["Page", "The version's artifact exactly as it was published, pictures and all. Kept in the code, so it works even if the link changes."],
          ["Text", "The same notes as plain data, in the site's own style."],
          ["Harry's notes", "Only on versions Harry has reviewed: his spoken notes from his recordings (likes, concerns, questions), each with the video and timestamp. Written in by Claude, not typed on this page."],
          ["Open the original artifact ↗", "Opens the shareable page on claude.ai for that version, if it has one."],
        ],
      },
    ],
    saving: [
      "The notes themselves don't save here. New patch notes are added by Claude as part of shipping a change.",
      "Read and understood and the notes under a version save to the shared database at once (team_acks, team_notes), so the other two see them. Until supabase/migrations/team_room_v2.sql runs they stay on this device only, and the page says so.",
    ],
    commit: ["New entries arrive through a normal code change (they live in a file, not the database) — they appear after the next deploy. Each version's page and pictures are copied into patch-notes/ in the repo."],
    inGame: ["Admin only. Players never see this page."],
    needs: ["supabase/migrations/team_room_v2.sql (PENDING) for read ticks and notes to be shared. Run after team_room.sql."],
    dev: "app/admin/patch-notes/PatchNotesArchive.tsx · lib/patchNotesData.ts · lib/patchNotePages.ts · lib/patchNoteReviews.ts · patch-notes/ · read ticks: components/teamRoom/PatchReceipts.tsx, lib/teamRoom/extras.ts",
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
    title: "Admin home",
    what: "Every admin and test page, split by game: one tab per game across the top (Road to Ballon d'Or, Website games, Studio). Inside a tab you only see that game's groups and pages. Testers see only the pages they can open.",
    buttons: [
      { group: "Game tabs (across the top of every admin page)", items: [
        ["Road to Ballon d'Or", "The career game's groups and pages. This is /admin/star."],
        ["Website games", "PL Draft, Tierlists, Site XP + Tic Tac Toe and the old tests. Opens /admin/star/game/web."],
        ["Studio", "The team: Team board, Patch notes, Videos, App plan, Tester access. Opens /admin/star/game/studio."],
        ["The number on a tab", "How many pages that game has (that you can open)."],
      ] },
      { group: "Top", items: [
        ["Search … pages in (game)", "Type part of a name or what a page does. Searches this game only."],
        ["All / Harry / Mikey / Leo", "Show everyone's pages, or only one person's, in this game."],
        ["Saves real data", "Only pages whose buttons change things other players see."],
        ["Grid / List", "Broadcast and Bento: the game's groups as big tiles or one row each. Kept on this device."],
        ["Play the game", "Ops room and Clean light: opens the game as players see it."],
      ] },
      { group: "Cards", items: [
        ["A group tile", "Broadcast and Bento: opens that group's own page (its admin tools first, then its test pages)."],
        ["A card", "Opens that page. The letter is its owner. \"Saves real data\" / \"This browser\" / \"Writes the code\" say what its buttons save."],
        ["Old tests (n)", "Website games tab. Old test pages that are kept but not used day to day."],
        ["Clear", "Shows when a search or filter matches nothing; puts everything back."],
      ] },
      { group: "Side menu", items: [
        ["(Game) home", "This game's home page."],
        ["The game's groups (slanted bars on Broadcast)", "Every group of the game you are in, the one you are on lit up. Broadcast and Bento open the group's own page; Ops room and Clean light jump to it on the home. On a phone they are in ☰ Menu; on a computer « folds them to icons."],
        ["Team board / Ideas / Team chat / My to-do / Patch notes / Videos", "The team's own pages, the same in every game (Team room and Patch notes are admins only)."],
        ["Broadcast / Bento / Ops room / Clean light", "The admin look. Broadcast (dark blue) and Bento (a colour per group) show every group on one board. Kept on this device."],
        ["Admin mode", "On: the admin side menu sits on every page of the site, opened on the admin pages for the page you are on. Off: it hides. Kept on this device."],
      ] },
    ],
    saving: ["Nothing here saves anything shared. The look and Admin mode are kept in this browser only."],
    inGame: ["Nowhere. This is the front door to the tools."],
    dev: "app/admin/star/page.tsx (first game) · app/admin/star/game/[game]/page.tsx (other games) · app/admin/star/g/[group] (a group's page) · app/admin/star/AdminHome.tsx · lib/adminRegistry.ts (GAMES = the tabs: a new game is one line there, then its groups say game: \"<key>\"; GROUPS; ADMIN_PAGES) · components/admin/shell/* · components/AdminNavPanel.tsx (the side menu on other pages, also one game at a time) · lib/adminLook.ts",
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
        ["← (top left)", "Back to the Play Area."],
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
    what: "Record your screen and voice here, and the recording goes to your Drive with a clear name and a line to paste to Claude.",
    buttons: [
      { group: "Record", items: [
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
    ],
    saving: [
      "Your own Google Drive, folder \"Knowitball screen recordings\" → a folder for whoever is picked under Who is recording (the site makes them the first time), named \"date · who · what it is about (length)\". The file is set to \"anyone with the link\" so Claude can fetch it. You can move the main folder anywhere in Drive; the site still finds it.",
      "The video goes from your browser straight to Google. The site keeps only its name and link (dev_recordings table), so that person's Claude chats break it down the next time they are messaged (scripts/hooks/recordings-hook.mjs). Needs dev_recordings.sql run once.",
      "Drive needs NEXT_PUBLIC_GOOGLE_CLIENT_ID on the site. Until it is set, recordings only download.",
    ],
    inGame: ["Nowhere."],
    dev: "app/admin/videos/* · lib/recording.ts (recorder, Drive upload, names; tests/star/recording.mts) · /api/dev-recordings + scripts/hooks/recordings-hook.mjs (auto-read) · the breakdown: scripts/screen-video/, .claude/skills/screen-video/SKILL.md",
  },
  "/admin/team": {
    title: "Team board",
    what: "The Team room. Board: what Harry, Mikey and Leo are doing (pushes, pull requests, live bars, patch notes). Ideas, Chat and To-do: the team's idea board, live chat and each person's jobs. The toggle along the top switches between them.",
    buttons: [
      { group: "Team room toggle", items: [
        ["Board | Ideas | Chat | To-do", "Switches part. A red number = new chat or new notes on your things; amber = a new job given to you. The same four are in the side menu."],
        ["« (top of the side menu)", "Folds the side menu to a strip of icons on a computer. » opens it again."],
      ] },
      { group: "Ideas", items: [
        ["By stage | By person", "Idea · Doing · Done columns, or a lane per person. Remembered in this browser."],
        ["+ Add idea", "Adds a one-line idea under your name."],
        ["The three dots", "One per person. Tap to say you want it; tap again to take it back."],
        ["An idea", "Opens it: move it to Idea / Doing / Done, delete it (yours only), and read or add notes."],
      ] },
      { group: "Chat (and the round button on every admin page)", items: [
        ["Message… @ or #", "Enter sends; Shift+Enter is a new line. Paste or 🖼 adds a picture. Type @ to pick Harry, Mikey or Leo; type # and a few letters to pick an admin page (it is added as a card)."],
        ["🔗 (link)", "Adds the page you are on as a card. Tapping a card in the chat opens that page."],
        ["⌖ (point) · 👉 Point · Shift+X", "Point at part of a page. Drag a box over it (on a phone, scroll there first), write a note, pick who, Send. It posts a card; whoever opens it gets the page scrolled to the box, outlined, with your note, until they press Got it. Shift+X works on a computer when you are not typing."],
        ["A message", "Tap: ↩ Reply, 📌 Pin (anyone) or Delete (your own). The green tag is the page it was sent from — tap to go there."],
        ["Reply quote", "The grey line at the top of a reply. Tap it to jump to the message it answers."],
        ["Small H / M / L faces under a message", "Who has seen it: bright = it was on their screen in the open chat; faded = not yet. The sender is never shown."],
        ["Gold edge · @ you", "A message that names you or points something at you."],
        ["@ Waiting on me", "Messages that name you that you haven't seen, and points you haven't pressed Got it on. Left side on a computer, folded above the chat on a phone. The round button shows a gold @ when something is waiting."],
        ["Got it (on a pointed page)", "Marks the point as seen; the sender's card shows your face lit. ✕ closes it without saying Got it."],
        ["Pinned", "Pinned messages, on the right (folded above the chat on a phone)."],
        ["Round chat button", "Bottom-left on every admin and test page: Chat | To-do in a box. 👉 Point starts point mode. Open ↗ goes to the full tab."],
      ] },
      { group: "To-do", items: [
        ["Add a job · for me ▾", "Your own job, or pick Mikey or Leo to give them one."],
        ["Tick box", "Done. Ticked jobs fade and leave after a day. ✕ deletes."],
      ] },
      { group: "Team tab", items: [
        ["Live on knowitball.co.uk", "Whether the newest version of main finished deploying, how long ago, and what it was."],
        ["A push", "Opens it: the full message, when, which branch, and the patch note it went out in."],
        ["v0.55 (green tag)", "The patch note that push went out in. Grey \"no notes yet\" = not in any patch notes yet."],
        ["Show all", "Shows every push on that branch (up to 20)."],
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
        ["Version list", "Every patch note, newest first. Same as /admin/patch-notes, with who has read each one, Read and understood, and notes."],
        ["N patch notes to read (on a person's card)", "How many patch notes since 18 Oct that person hasn't marked Read and understood (their own don't count). Tap to open the oldest one."],
      ] },
    ],
    saving: [
      "Board: nothing. It only reads from GitHub, through the site, and refreshes every minute.",
      "Ideas, chat, to-dos, notes and pins save to the shared database at once and show for the other two within about a second. Admins only.",
      "First visit asks \"Which one are you?\" once and saves it to your account.",
      "Replies, @names, page cards and points are part of the message itself, so they reach everyone straight away. Seen faces, Got it and Read and understood need supabase/migrations/team_room_v2.sql; until it runs they are kept on the device that pressed them, and the chat says \"saved on this device only\".",
      "No phone alerts: the site has no push notifications yet, so an @ shows as a gold @ on the round button and in Waiting on me, not as a phone buzz.",
      "How a push is matched to a patch note: if the push names a version (\"v0.55\"), that one; otherwise the same person's next patch note that went live after the push, up to 4 days later.",
    ],
    inGame: ["Nowhere. Admins only."],
    needs: [
      "GITHUB_TOKEN in Vercel (already set for scenario commits). Without it GitHub only answers a few times an hour and the board says so.",
      "The live progress bars (\"Now working on\") are step 2: one database file for Mikey to run and a shared password. Until then each card says so.",
      "Ideas, Chat and To-do need supabase/migrations/team_room.sql run once in Supabase. Until then they say so.",
      "Seen faces, Got it, Read and understood and patch-note notes need supabase/migrations/team_room_v2.sql (PENDING), run after team_room.sql.",
    ],
    dev: "app/admin/team/* · app/api/admin/team/route.ts · lib/teamBoard.ts · tests/star/teamBoard.mts · plan: docs/plans/2026-10-15/teamboard.md · Team room kit: lib/teamRoom/ (config.ts = settings; extras.ts = replies, @, cards, points, receipts), components/teamRoom/ (chat.tsx, PointLayer.tsx, PatchReceipts.tsx), supabase/migrations/team_room.sql + team_room_v2.sql, tests/star/teamRoom.mts",
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
    what: "Play any of the 30 levels of any training game straight away, to see and test what each one is.",
    buttons: [
      {
        group: "The level list",
        items: [
          ["Power / Technique / Free Kick / Pace / Vision", "The tabs at the top: which training game's levels to show."],
          ["Your skills 40 / 70 / 100", "The player's skills while you play. They change how hard you can hit the ball and how much it bends, so a level plays differently at 40 and at 100."],
          ["A level tile", "Picks that level; tap it again to play it. The line under the number is what it asks for (distance and blockers, gate size, wall, chasers, options and time). Stars appear on a tile after you've played it here."],
          ["The level panel (right; pinned to the bottom on a phone)", "The picked level: its game, what it asks for, your stars here, and a real picture of that game (taken at level 15)."],
          ["Let's go ›", "Plays the picked level."],
        ],
      },
      {
        group: "While playing",
        items: [
          ["‹ All levels", "Back to the list at any time."],
          ["◀ L13 ▶", "Previous or next level, starting it fresh."],
          ["Let's go", "Level 1 of each game opens on its how-it-works card first, as in a career."],
          ["Tap to start", "Pace (the dribble run) waits for this before anyone moves, on every try."],
        ],
      },
    ],
    saving: [
      "Nothing is saved. No career is touched and no stars are banked; the stars on the tiles are forgotten when you leave the page.",
    ],
    inGame: [
      "Each level here is exactly the level a player gets: Training → pick a skill → pick a level. Same picture, same three tries, same stars.",
    ],
    dev: "app/star-training-dev/page.tsx mounts components/star/TrainingMinigame.tsx with trainingLevel = the tile. Levels: lib/star/trainingLevels.ts; drill numbers: lib/star/trainingDrills.ts.",
  },
  "/star-highlights-dev": {
    title: "Infinite Highlights",
    what: "Real chances straight off the match's own generator, as fast as you can press Next — flag the bad ones and fix them on the spot.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["←", "Back to the Scenario Gallery."],
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
    what: "The Full Highlights Rebuild's switch, and the ruler: today's numbers (chances, goals, players reacting, start distance) that every phase of the rebuild is held to.",
    buttons: [
      {
        group: "The switch",
        items: [
          ["Off / On (test)", "The same switch as Settings → Harry changes → Full highlights rebuild. Off is the game as it is today. On also turns Chances to New. (Infinite Highlights draws its still with the real match's camera either way: that test page's default since phase 1.) Stored on this phone only."],
          ["Infinite Highlights →", "Opens Infinite Highlights, to see the still with the switch On."],
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
          ["The match", "The real match plays a chance the real match served, starting with its generated 4–8 second build-up (the moves before it, made from real football patterns). Tap the match to skip to the chance. It always ends exactly on the chance's own picture."],
          ["Generate another", "The next chance the match serves, with a new build-up. Every chance gets its own; the same chance always gets the same one."],
          ["↺ Watch again", "Plays the same build-up and chance again."],
          ["The three small pitches", "The same build-up from above: the first frame, the middle and the last (= the chance). White is you, blue the chance's team-mates, pale blue team-mates who are only in the build-up (off the screen when the chance starts), red defenders, yellow the keeper; dashed is the chance's frame."],
          ["The list", "Each touch: a pass, a ball in the air or a carry, how long, who plays it, and whether it came from a real route into this kind of chance."],
        ],
      },
    ],
    saving: [
      "The switch is stored in this browser only (localStorage star-fhr). The numbers are worked out on the page and kept nowhere. No career is touched.",
    ],
    inGame: [
      "Off: nothing in the game changes. On: Chances: New is on in every match on this phone (the same as setting Chances: New by hand), Infinite Highlights' still uses the match camera, and every open-play chance in a match starts with a generated 4–8 s build-up (never penalties, free kicks or corners). Later phases of the rebuild arrive here first.",
    ],
    dev: "app/star-fhr-dev/{page,BuildUpPanel}.tsx · lib/star/fhr/{toggle,ruler,stillCamera,buildUp,servedChances}.ts · lib/star/fhr/patterns.json (scripts/fhr/make-patterns.mts) · terminal: npx tsx scripts/fhr/ruler.mts 200 · npx tsx scripts/fhr/buildup-measure.mts 500 · sheet: npx tsx scripts/fhr/buildup-sheet.mts 48 · browser check: node scripts/fhr/still-vs-play.mjs 100 on · tests/star/fhr.mts",
  },
  "/star-play-dev": {
    title: "Play Area",
    what: "One door to Infinite Highlights and Infinite Match, with the dials they — and the gallery's Play — run on. Every dial starts on the real game.",
    buttons: [
      {
        group: "Home",
        items: [
          ["← (top left)", "Back to the admin home."],
          ["Infinite Highlights → (first picture card)", "Opens Infinite Highlights."],
          ["Infinite Match → (second picture card)", "A real match that runs for the length you set, counting every chance it serves you."],
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
          ["← (blue, top left) / ‹ (in the store)", "Back to the Play Area."],
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
    what: "The one editor for every 3D scene. Three places work: the Cut-scene Director, 3D Signing and the Manager's Office. Pick a scene or a shot, change the camera (or fly a free camera) and the lighting, and watch the real scene play it. Edits save per scene and per shot. Nothing touches a career, and the game does not read these edits yet: the real signing, office and cut scenes play exactly as before.",
    buttons: [
      {
        group: "3D Preview",
        items: [
          ["Place tabs (3D Signing … Cut-scene Director)", "3D Signing, Manager's Office and Cut-scene Director work. Shop, Garden and House say \"coming next\" (hidden on a phone)."],
          ["Shot buttons (3D Signing / Manager's Office: 1. He talks … 5. The handshake)", "Play that fixed shot from its start; the settings then change that shot. The office has only He talks and You reply. A • marks a shot you have edited."],
          ["▶ PLAY SHOT (3D Signing / Manager's Office)", "Play the shot on screen again from its start."],
          ["Scene buttons (Contract signing, Goal celebration …)", "Load that hand-made cut scene into the preview. Your edits are cleared."],
          ["The badge top-left", "The shot under the playhead, its name and its lens."],
          ["Drag on the preview", "Free camera: orbit and tilt round the look point. Wheel or pinch moves in and out. Only the shot under the playhead changes."],
          ["The map, bottom-right", "The set seen from above. Drag the blue box (camera), the white dot (look point) or the yellow sun (key light, round the ring)."],
        ],
      },
      {
        group: "Settings (Camera / Lighting / Cast / Scene tabs on a phone)",
        items: [
          ["Shot preset buttons and list", "Change the framing of the shot under the playhead (18 framings)."],
          ["Lens, Turn, Rise, Move, Move amount, Handheld shake", "Change the shot under the playhead. Each shot keeps its own edits."],
          ["Mood", "Time of day and colour of the whole scene."],
          ["Exposure, Key light strength", "Brightness of the scene and of the sun / key light."],
          ["Spotlight on a person", "Puts a spotlight on one person; Spot strength sets how bright."],
          ["Position X/Y/Z, Look at", "Show where the camera stands and looks now. Type a number to take over with a free camera."],
          ["Back to the shot", "Drops the free camera for this shot; the shot plays as written."],
          ["Key light angle, Key light colour", "Turn the sun round the set and change its colour. \"As written\" puts the colour back."],
          ["Greyed rows with \"coming next\"", "PART and NEW dials from the drawing. Not built yet."],
          ["3D Signing / Manager's Office settings", "Only what those scenes have: Position, Look at, Lens per shot (drag the preview to orbit; Back to the shot undoes it), Exposure, Key light strength, angle and colour (the low sun through the window). No mood, spotlight, presets, cast or timeline there."],
        ],
      },
      {
        group: "Timeline",
        items: [
          ["▶ Play / ❚❚ Pause, ↺ Replay", "Play the scene, stop it, start again."],
          ["The scrub bar, or a click on a lane", "Jump to that moment (director.seek)."],
          ["Lanes", "The scene's real tracks, read-only: camera shots, light and effects, each person's moves, speech and captions."],
          ["SAVE FOR EVERYONE", "Copies this scene's edits to the shared table (admin only). If the table isn't switched on yet, it says so and the edits stay on this device."],
          ["Copy edits", "Copies this scene's edits as JSON."],
          ["Reset this shot / Reset all", "Clears the edits of the shot under the playhead / of the whole scene."],
        ],
      },
    ],
    saving: [
      "This device: every change saves at once (localStorage), per scene and per shot, and comes back when you reopen it.",
      "Save ids: 3D Signing saves as \"signing\", the Manager's Office as \"office\", each director scene under its own name, except Contract signing, which now saves as \"director:signing\" (an older save of it is still read back).",
      "Shared: SAVE FOR EVERYONE writes to the star_cutscene_edits table through /api/star/cutscene-edits (admins only). Needs supabase/migrations/star_cutscene_edits.sql run; until then it says \"Saved on this device only\".",
      "Nothing commits to the repo.",
    ],
    inGame: ["Nowhere yet. It plays the same director and the same signing/office scene the game uses, but the game does not read these edits (Harry wants to see them first)."],
    dev: "app/star-scene-editor-dev/page.tsx (+ editor.css, parts.tsx, PlaceEditor.tsx for Signing/Office) · lib/star/signing3dScene.ts (optional edit / setEdit / playShot / shotDefaults / cameraPose / layout; no edit = today's scene, the career never passes one) · lib/star/cutscene/director.ts (optional setEdit / cameras / cameraPose / layout hooks; no edit = the game's behaviour) · store.ts (saves) · app/api/star/cutscene-edits/route.ts · fixtures from lib/star/cutscene/fixtures.ts · drawing: docs/handoffs/2026-10-19-ui-lookover/scene-editor/.",
  },
  "/star-3d-area-dev": {
    title: "3D Area",
    what: "Every 3D place, cutscene and 3D area being built, in one list, plus a store of every 3D and Blender file the site has. Nothing here touches a career.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["←", "Back to the Play Area."],
          ["Places / All scenes / 3D files (left, or along the top on a phone)", "Switch between the 3D places, the full list of scenes and the 3D file store. The page remembers which one you had open."],
        ],
      },
      {
        group: "Places",
        items: [
          ["A place card (Signing, Manager's office, Shop, Garden, House, Training, 3D scene editor)", "Opens that 3D place's own test page. The picture is a real still of that page."],
        ],
      },
      {
        group: "Scenes",
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
    dev: "app/star-3d-area-dev/page.tsx · lib/star/area3d.ts (the scene list) · lib/star/assets3dManifest.ts (generated) · scripts/assets3d-manifest.mjs · tests/star/assets3d.mts",
  },

  "/star-3d-area-dev/signing": {
    title: "Signing scene (live 3D)",
    what: "The signing as a live 3D cutscene: you sit across the desk from the manager, a few lines of talk, the contract slides over and turns to you, then tap to sign. You reach for the pen, pick it up, write your name, SIGNED lands, and you both stand and shake hands while the camera pulls back. Your skin tone, face picture, hair and accessories are on your player.",
    buttons: [
      {
        items: [
          ["‹", "Back to the 3D Test Area."],
          ["↺", "Starts the scene again from the first line."],
          ["Your player", "Opens the picker: skin tone, face picture, hair, every store accessory and the Star Pass Gold Aviators. A change rebuilds your player straight away."],
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
    ],
    dev: "app/star-3d-area-dev/signing/page.tsx · components/star/SigningScene3D.tsx (the screen) · components/star/SigningScene3DCareer.tsx (career → scene) · lib/star/signing3dScene.ts (room, camera, timeline) · lib/star/people3d.ts (the approved player and manager: kit, skin, hair, face picture, accessories, outline) · lib/star/signing3dRig.ts (arm IK) · lib/star/signing3dTextures.ts (contract and other canvas pictures) · lib/star/signing3d.ts (lines, terms, the Settings switch) · public/star/people3d/*.glb (scripts/people3d/build_people3d.py) · public/star/signing3d/aviators.glb · stills: scripts/signing3d-shot.mjs · tests/star/signing3d.mts",
  },

  "/star-3d-area-dev/office": {
    title: "Manager's office (3D stage)",
    what: "The signing's office, rebuilt as a stage for \"Talk to your manager\": the manager behind his desk, you across it, a rug, a bookcase, a trophy cabinet, a plant, a laptop and a mug. The camera goes to whoever is talking. Sample lines here; the real ones come from the boss game.",
    buttons: [
      {
        items: [
          ["‹", "Back to the 3D Test Area."],
          ["He talks / You talk", "Moves the camera: over your shoulder at him, or over his at you."],
          ["Next line", "Steps through four sample lines, switching who talks."],
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
    ],
    dev: "app/star-3d-area-dev/office/page.tsx · components/star/Office3D.tsx (stage + career look) · lib/star/signing3dScene.ts (stage: \"office\" dresses the room) · components/star/relgames/BossChat.tsx, components/star/ManagerMoments.tsx, components/star/LineupIntro.tsx (mount it) · lib/star/look3d.ts (the Settings switches)",
  },

  "/star-anim3d-dev": {
    title: "3D animations",
    what: "Every move the 3D match plays (outfield and keeper), each looping on its own tile, seen through the real 3D match camera at the real match size: a man is 6% of a phone screen, the men 1.35 × life, the realistic players.",
    buttons: [
      { group: "Top", items: [
        ["← and 3D test area (left list)", "Back to the list of 3D test pages."],
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
  "/star-update-dev": {
    title: "Oct 13 update",
    what: "The whole Oct 13 gameplay update behind one Old | New switch: shot power, the contact field (strike the side of the ball to curl it low), keepers, team-mates shooting, and match feel. Each part also has its own row.",
    buttons: [
      { group: "Top", items: [
        ["‹ Play Area", "Back to the Play Area."],
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
        ["←", "Back to the Play Area."],
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
        ["‹ Home", "Back to the 3D Test Area."],
        ["day / sunset / night", "Changes the time of day. In a career it follows the time of your next kick-off."],
        ["Full career / New career", "Full: trophies, a horse, three cars and a mansion. New: nothing owned or won yet."],
        ["Restart", "Builds the garden again from the start."],
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
    inGame: ["Home → Garden in a career opens this 3D garden. The shop where the house used to be is the 3D shop; the casino and the training pitch are at the back.", "Home → Casino opens the 3D casino when Settings → Look → Casino is 3D (the default), else the classic casino menu."],
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
        ["‹ Back (top left)", "On the picker, the pre-screen, Crossbar and every 3D drill, at any moment: back to the picker (or, opened straight from the top row, the 3D Test Area). The drill ends there: no reward, nothing asked."],
        ["↻ Restart (top right)", "Starts again with a different team-mate."],
        ["Last (top right)", "The last result: score, won or lost, and the Team bar change, with the drill under it. A dash until you finish one."],
        ["Continue →", "On the result card. Here it just starts again and shows the result in the \"Last\" box at the top."],
      ] },
    ],
    saving: ["Nothing is saved. The career is made up, and the result (and the Team bar change it shows) goes nowhere."],
    inGame: ["Home → Garden → the training-pitch gate opens the same picker. Winning a drill (or a level crossbar finish) moves the Team bar the way the Woodwork challenge does, and costs the usual training energy. Pace Sprint leaves the Team bar alone and adds its stars to your pace instead."],
    dev: "app/star-training3d-dev/page.tsx; the gate and picker components/star/Training3D.tsx (the crossbar is CrossbarChallenge there, on EngineFeature); the 3D drills components/star/Play3D.tsx on the shared 3D engine lib/star/play3d (drill list drills.ts, rules twoTouch.ts / freeRoam.ts / wembley.ts / headersVolleys.ts / paceDrill.ts, speeds and stamina by stat lib/star/three3d/gait.ts (tests/star/play3dGait.mts), World world.ts, picture scene.ts; tests tests/star/play3d.mts, wembley3d.mts, headersVolleys3d.mts, practiceCam.mts); the practice camera lib/star/three3d/practiceCam.ts; the device controls lib/star/play3d/controlScheme.ts; crossbar rules lib/star/training3d/crossbar.ts (tests/star/crossbar3d.mts). Loaders through withMeshopt.",
  },
  "/star-style-dev": {
    title: "Style Testing",
    what: "Try the shortlisted art styles (and Mix) on the REAL game (the match engine's own chances, drawn in 3D), the 3D free roam and cut scenes, switching live. A test area: nothing here changes the game.",
    buttons: [
      { group: "Style (top row)", items: [
        ["A", "Golden Hour: painted, warm sunset, soft cel bands, thin brown lines, haze, paper grain."],
        ["B", "Floodlight Ink: night under floodlights, bold black lines, comic dots in the shadows, rain."],
        ["D", "Pixel: drawn small and blown up with square pixels, a limited palette with dither."],
        ["S", "Strikers: toy-like glossy chunky men, a rusted steel arena with an electric cage, smoky orange-and-teal light, lightning, glowing goal frames. Our own take: no game's characters, names or logos."],
        ["Anime", "A normal daytime match; only the players are anime: cel-shaded with clean outlines. In cut scenes: poses on twos, a close-up of the eyes before the strike, an impact frame, speed lines and an aura."],
        ["H", "Console Real: realistic lighting, mown stripes, a glow on bright things."],
        ["Mix", "H for gameplay, A for cut scenes, the same warm evening sky and colour grade on both."],
      ] },
      { group: "Scene (second row)", items: [
        ["Real game (opens first)", "The real match: Infinite Highlights' chances one after another on the one engine, with its scoreboard and commentary. Drag back from the ball, pick where to strike, and the real keeper and scoring decide it. The 3D picture only draws what the match does."],
        ["View: 2D | 3D view", "Real game: the 2D game itself, or the same game drawn in 3D in the chosen style. In 3D a touch is handed to the 2D game at the same spot of grass; a shot's drag keeps your finger's own length, so it kicks as hard as in 2D."],
        ["Free Roam (3D)", "Free Roam, playable: you, two team-mates and a keeper, four opponents standing goal-side (scenery: they never tackle). The camera is fixed and follows the ball."],
        ["Free Roam (2D)", "The same free roam with every man drawn flat on a card: plain heads, no faces, the number on the back."],
        ["Cut: Goal", "Now a script on the cut-scene system: on the ball, behind the shooter, the top corner, wheels away, a low knee slide, the roar, team-mates pile on. ?cut=old plays the first hand-coded version."],
        ["Cut: Signing", "Now a script on the cut-scene system: sat across the desk, the contract slides over, he picks up the pen and signs his own signature, looks up and smiles, both stand and shake hands, then he holds his shirt up for the cameras. ?cut=old plays the first version."],
        ["Cut-scene Director", "Watch any cut scene. Hand-made: the seven written scenes (signing, goal, trophy, walk-out, press, The Icon, Farewell). Generate from event: pick a game event, its feeling, stakes, intensity, rival there, home, night, then Make it; 🎲 Reroll tries another seed. ▶/❚❚ play and pause, ↺ replay, Skip jumps to the end, the slider scrubs (the beats are marked under it). \"Shot rules\" scores the shots against the film rules (opens on the place, pace of cuts, one side of the line, no jump cuts, a close-up). The style chips above change the look live. Settings → Look → Cut-scene camera: New adds the camera pass (a wide first, stiff moves hidden behind faces and props, every shot moving) and the scene's music (when Sound effects is on); Old plays the shots as written."],
        ["Walk-out", "The farewell guard of honour as it is in the game. The styles don't reach it yet."],
        ["Camera … from straight down", "Real game and free roam: the camera's tilt (real game 20 to 70, free roam 10 to 70). 40 is the starting angle; 0 would be straight down. Real game: the camera frames everyone in the chance, the goal at the top. The men lean back towards the camera a little so they read at full height."],
        ["↺ Replay", "Cut scenes: play it again from the start."],
        ["Left thumb / tap / drag back", "Gameplay: move (push to the edge to sprint), pass or call for it, shoot. WASD or the arrows, Shift and Space on a keyboard."],
      ] },
    ],
    saving: ["Nothing is saved. The address can hold a set-up: ?style=ink&scene=goal&tilt=30 (and &t=6 holds a cut scene still at 6 seconds). Director: ?scene=director&fixture=signing, or ?scene=director&event=scored&stakes=0.8&emotion=joy&seed=3; &clean=1 hides the controls for filming; &cam=old or &cam=new overrides the Cut-scene camera setting on this page. Real game: &seed=7 picks the chance stream, &kinds=one_on_one,penalty only those chances, &view=2d starts on 2D, &clock=virtual freezes the clock for frame-by-frame filming (scripts/film/frames3d.mjs)."],
    inGame: ["Nowhere yet: a sandbox for choosing the look. The 2D match is not touched."],
    dev: "app/star-style-dev/page.tsx · components/star/StyleTest3D.tsx · Real game: components/star/RealGame3D.tsx (EnginePlay in an EngineFrameContext, lib/star/engineFrame.ts) + lib/star/style3d/engineView.ts (the 3D picture and touch hand-over), lib/star/virtualClock.ts (filming) · lib/star/style3d/ (styles.ts the five looks as data, kit.ts sky + lights + rain + materials, post.ts the one-pass post shader, stadium.ts, gameplay.ts on lib/star/play3d's World + picture via its optional bare/rig/draw/onBuilt hooks, flatFigure.ts the 2D cards, cutscenes.ts → the cut-scene system). The cut-scene system: lib/star/cutscene/ (README.md there); components/star/CutsceneDirector.tsx. Loaders through withMeshopt. Post is off on Low quality except the pixel style.",
  },
  "/star-shop3d-dev": {
    title: "3D Shop",
    what: "The walk-around 3D shop, with test controls. It is the same screen a career opens from the Shop page's \"Walk the 3D shop (beta)\" button. Here nothing reaches a career.",
    buttons: [
      {
        items: [
          ["‹ 3D area", "Back to the 3D Test Area."],
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
          ["‹ 3D area", "Back to the 3D Test Area."],
          ["starter … estate", "Which home you are in. In a career it is the best home you own: Studio Flat or City Apartment = flat, Penthouse, Suburban House = house, Beach Villa or Mansion = villa, Country Estate or Private Island = estate."],
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
          ["Fun targets (DRAFT, the 200 matches panel) · Run it", "Plays the real unseen match 200 times for each position (striker, winger, attacking mid, central mid) at an even game, +20 and −20. Each row shows ours against Harry's target, ✓ in range, ✗ out. The radar has no league input yet, so ours is checked against the National League and the Premier League side by side. A broken guardrail (shots a match 21–28, nobody over 36 season goals) is shown in red. Season goals are not judged: they show what share of chances your shooting would need to score."],
        ],
      },
    ],
    saving: ["Nothing is saved. Changing a setting starts the match again; leaving the page forgets it. Fun targets only reads the table in lib/star/funTargets.ts; edit that file to change a number."],
    inGame: [
      "Nowhere — it's a window onto the match the career already runs. Every minute is the real match's own function; your highlights are the moments a career would stop and let you play.",
    ],
    dev: "app/star-radar-dev/page.tsx · components/star/MatchRadar.tsx · lib/star/matchRadar.ts (calls tick/resolveScenario in lib/star/hiddenMatch.ts) · Fun targets: components/star/FunTargetsReport.tsx, lib/star/funTargets.ts (the table), lib/star/funTargetsMeasure.ts, tests/star/funTargets.mts",
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

} satisfies Record<string, AdminGuide>;

export type GuidePage = keyof typeof ADMIN_GUIDES;
