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
      ] },
    ],
    saving: [
      "Nothing to save: this page only reads. To fill a gap, give the information in chat (or a club sheet) and it's added to the game's data in the code.",
      "Blue boxes come from research (2 Oct 2026, mostly Wikipedia club pages). They only ever fill empty boxes: anything you've given wins. League titles and cups count national competitions only.",
    ],
    inGame: [
      "Everything here is what the game uses: kits on the pitch, stadium names, club size in transfers and prestige, rivalries in the news, managers on the team sheet.",
    ],
    needs: [
      "Badge pictures are read from the shared club badge table. If it can't be read, that column says so for every club rather than guessing.",
    ],
    dev: "lib/star/data/clubAudit.ts (the checks), lib/star/data/clubProfiles.ts (the club sheets, built by scripts/club-data/build_club_profile_data.py from lib/star/data/sources/).",
  },
  "/star-relgames-dev": {
    title: "Relationship games",
    what: "Every relationship game from the relationships revamp, on a made-up player, so you can try each one without playing a career up to it.",
    buttons: [
      { items: [
        ["▶ Talk to your manager / Woodwork challenge / Signing session / Day off / Shoot an advert", "Opens that game. Back or Continue returns here."],
        ["20 / 50 / 75 / 90", "The level of every bar before the game, so you can see what a win pays at each level."],
        ["In form / Ordinary / Out of form, Starting / On the bench, trusting / demanding / rotational", "Change what the manager talks about and which replies land."],
        ["Last game", "What the last game returned: won or lost, and the change."],
      ] },
    ],
    saving: ["Nothing is saved. It is a test player that resets when you leave."],
    inGame: ["Relations (boss, team, fans, you) and the Sponsors screen (the advert, on each deal)."],
    dev: "app/star-relgames-dev/page.tsx; the games are components/star/relgames/, their rules lib/star/relationships.ts and lib/star/bossChat.ts.",
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
        ["Easy / Medium / Hard / Own amount", "Achievements only: which level it pays, or Own amount to type its own XP."],
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
    what: "Every reward in one catalogue, by type, and which reward sits at each Star Pass level (5 to 100).",
    buttons: [
      { group: "Levels (left)", items: [
        ["A level row", "Selects that level. The next card you tap goes there."],
        ["↑", "Swaps this level's reward with the level above."],
        ["↓", "Swaps this level's reward with the level below."],
        ["✕", "Empties the level."],
      ] },
      { group: "Catalogue (right)", items: [
        ["Penalty run-ups / Free-kick run-ups / Celebrations / Wearables / Boots / Balls / Vehicles / Other", "Shows that type of card. The number is how many cards it has."],
        ["Tap a card's picture", "Puts it at the selected level (taking it off any level it was on), then moves to the next level."],
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
      "The Star Pass (tap the star rating in the top bar): each level shows its reward. Reach the level and a Claim button appears, with a red dot on the star.",
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
          ["New club name… + Add", "Creates a new club."],
          ["Club list", "Tap a club to edit it."],
          ["Delete club", "Deletes the club (and its badge link)."],
          ["Kit & badge", "Home and away colours, stadium name, and upload a badge. Save saves it."],
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

  "/admin/cl-draft": {
    title: "CL Draft",
    what: "An admin-only test version of a Champions League draft game: draft a squad, then play up to five seasons.",
    buttons: [
      {
        items: [
          ["Setup screen", "Pick the settings and start."],
          ["Draft screen", "Pick your players."],
          ["Next Match → / Into Knockout Stage → / See Season Results →", "Plays the season one match at a time."],
          ["Play Again", "Back to the start after the final season."],
        ],
      },
    ],
    saving: ["Nothing is saved. Refreshing the page loses the run."],
    inGame: ["Nowhere yet — this is a test mode, not linked from the site."],
    dev: "app/admin/cl-draft/page.tsx · components/draft/cl/*",
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
          ["Version list", "Tap a version to read it."],
          ["Page", "The version's artifact exactly as it was published, pictures and all. Kept in the code, so it works even if the link changes."],
          ["Text", "The same notes as plain data, in the site's own style."],
          ["Harry's notes", "Only on versions Harry has reviewed: his spoken notes from his recordings (likes, concerns, questions), each with the video and timestamp. Written in by Claude, not typed on this page."],
          ["Open the original artifact ↗", "Opens the shareable page on claude.ai for that version, if it has one."],
        ],
      },
    ],
    saving: ["Nothing here saves. New patch notes are added by Claude as part of shipping a change."],
    commit: ["New entries arrive through a normal code change (they live in a file, not the database) — they appear after the next deploy. Each version's page and pictures are copied into patch-notes/ in the repo."],
    inGame: ["Admin only. Players never see this page."],
    dev: "app/admin/patch-notes/PatchNotesArchive.tsx · lib/patchNotesData.ts · lib/patchNotePages.ts · lib/patchNoteReviews.ts · patch-notes/",
  },

  "/admin/sound-board": {
    title: "Sound Board",
    what: "Every game sound in one list: what it is, where the game plays it, and a way to swap in a new one.",
    buttons: [
      {
        items: [
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
    ],
    saving: [
      "Drags, ✓ / ✕ marks, added versions and removed cards are kept in THIS browser only until you Save.",
      SCENARIO_SAVE_SHARED,
      SCENARIO_NOT_IN_GAME_UNTIL_COMMIT,
      "Tune corrections go to the shared table star_scenario_corrections, so the whole team's corrections add up.",
    ],
    commit: COMMIT_HOW,
    inGame: [
      "Committed 11-a-side scenarios are used by the real game's chance generator in /star-dev matches, for every player, once the deploy finishes.",
      "5-a-side cards are review only — nothing from them reaches the game yet.",
    ],
    needs: [SCENARIO_TABLE_NEEDED, GITHUB_TOKEN_NEEDED],
    dev: "app/star-gallery-dev/page.tsx · components/star/{EditableFrame,ScenarioPlay,EnginePlay,TuningPanel}.tsx · lib/star/{scenarioEdit,scenarioStatus,scenarioCorrections}.ts · /api/star/scenarios, /api/star/scenarios/commit, /api/star/corrections",
  },

  "/star-training-dev": {
    title: "Training Levels",
    what: "Play any of the 30 levels of any training game straight away, to see and test what each one is.",
    buttons: [
      {
        group: "The level list",
        items: [
          ["Power / Technique / Free Kick / Pace / Vision", "Which training game's levels to show."],
          ["Your skills 40 / 70 / 100", "The player's skills while you play. They change how hard you can hit the ball and how much it bends, so a level plays differently at 40 and at 100."],
          ["A level tile", "Plays that level. The line under the number is what it asks for (distance and blockers, gate size, wall, chasers, options and time). Stars appear on a tile after you've played it here."],
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
        group: "Top bar",
        items: [
          ["‹", "Back to the Scenario Gallery."],
          ["N/13", "Choose which chance types to show: All, None, tap types on or off, then \"Watch these\"."],
          ["▦ 24", "Sheet of 24: twenty-four chances of one type served in a row, on one screen, to check by eye. Under each: which drawing it came from, the nearest drawing, and in colour anything wrong (red: added by the serving; amber: already in the drawing, or \"like #n\" — looks like one of the five before it). New sheet serves another 24. It uses the Play Area's Chances dial."],
          ["⚽ Play a penalty shootout", "On the chance-types screen. A whole shootout on the real match, with the Play Area's test sides: every kick live — team-mates at their keeper, their takers at yours (from the same end), yours to take when your turn comes. Nothing is saved; \"Another shootout\" starts again."],
          ["⚑ N", "Your flagged list. Tap one to jump back to it; Clear empties the list."],
        ],
      },
      {
        group: "The picture",
        items: [
          ["The picture", "Drawn exactly as Play will show it: same size (bigger on a laptop, full width on a phone), the real club kits Play plays in, the goal standing on the goal line as in the match, and corners and byline crosses turned sideways like the real game."],
          ["A penalty", "Harry's penalty rules: the keeper stays dead centre on his line, the ball on the spot, you straight behind it and the camera fixed — none of them drag. Anyone else only slides along the edge of the box."],
          ["Drag", "Move any player or the ball. Tap a player to select him. Swipe the grass for next / previous."],
          ["+ Mate / + Opp", "Add a team-mate or an opponent."],
          ["Remove", "Takes out the player you tapped."],
          ["▶ Play / ◼ Stop", "Plays this exact chance, your drags included, at the picture's size — a drag still hits exactly as hard as in a career. Real squads and faces, the real weather, and the Play Area's dials."],
          ["Run-up", "A penalty or a direct free kick: you let go of your aim, your player jogs to the ball, then the strike screen gives you 1 second. On a penalty you can drag sideways during the jog to swing your aim, and the keeper may hop."],
          ["PNG", "Downloads the picture (without the fault rings)."],
          ["Delete", "Only for a saved chance: deletes it from the shared list AND the code."],
          ["Tune", "Only after a drag: records what was wrong as a correction. Not a save."],
          ["‹  ⚑  Next →", "Previous, flag / unflag this one, next. Keys: ← →, space, F to flag. A second Next → sits in the top bar, so it is always on screen on a phone."],
          ["Save / Save this fix", "Always there until it's saved. Puts this chance (with your drags, if any) into its type's scenarios in the shared list — no drag needed."],
          ["Commit", "Always there. Saves it AND commits it into the game's code in one go."],
          ["Discard", "After a drag: throws the drags away."],
          ["Saved — revert", "Deletes your saved copy from the shared list (a committed copy stays in the code — use Delete for that)."],
          ["Status pills", "\"Straight from the generator\" (nobody has touched it), \"Unsaved changes — this browser only\", or the saved / committed status the gallery shows; plus \"In the game\" / \"Not in the game yet\"."],
          ["Amber box", "Saved scenarios of this type that break a rule, so the game isn't using them."],
        ],
      },
    ],
    saving: [
      "Chosen types, flags and unsaved drags are kept in THIS browser only.",
      "Save / Save this fix: " + SCENARIO_SAVE_SHARED + " It lands in the gallery as a simulated card of its type.",
      SCENARIO_NOT_IN_GAME_UNTIL_COMMIT,
      "Tune corrections go to the shared table star_scenario_corrections.",
    ],
    commit: [
      "Commit puts this one chance straight into the game's code. Saved-but-not-committed ones can also be committed together from Scenario Gallery → Tuning & Commit.",
      "Delete also removes a saved chance from the code. Commit and Delete both need an admin sign-in and GITHUB_TOKEN in Vercel.",
    ],
    inGame: [
      "The chances are made by the same function as in a real /star-dev match (lib/star/chanceMaker.ts): one of your drawings, nudged, mirrored half the time, the drawing's own players and nobody else, never one of the last five pictures of its type. The Play Area's Chances dial can switch this page (and the gallery's Sim) to the generator; a career always plays the drawings.",
      "Your fixes reach real matches only once they're committed — here, or from the gallery.",
    ],
    needs: [SCENARIO_TABLE_NEEDED],
    dev: "app/star-highlights-dev/page.tsx · lib/star/{gallerySim,highlightStore,scenarioEdit}.ts · /api/star/scenarios, /api/star/scenarios/commit · Shootout: components/star/ShootoutPlay.tsx, lib/star/penaltyTaking.ts",
  },

  "/star-play-dev": {
    title: "Play Area",
    what: "One door to Infinite Highlights and Infinite Match, with the dials they — and the gallery's Play — run on. Every dial starts on the real game.",
    buttons: [
      {
        group: "Home",
        items: [
          ["Infinite Highlights →", "Opens Infinite Highlights."],
          ["Infinite Match →", "A real match that runs for the length you set, counting every chance it serves you."],
          ["Match Radar →", "Watch the unseen match behind your highlights, all ninety minutes, up to 20× speed."],
          ["Store (test) →", "Opens the test store: daily specials, run-ups, accessories, boosts and Coins, with its own wallet."],
          ["Blender 3D →", "Opens the Blender 3D footballer test page: any club's kit on the 3D player, stills, hair, animations and the home-screen mock-up."],
          ["Power / Technique / Opposition / Match length", "Sliders for you, the other side, and how long Infinite Match lasts."],
          ["Keeper: Real / Set", "Real (the default) is the opposition's own starting keeper, exactly as in a career. Set shows a Keeper rating slider that decides instead."],
          ["Keeper: long shots & through balls — Hard / Middle / Easier", "The keeper sets himself while you aim, reacts a beat after you strike, steps while he reads it and throws one dive, all by his rating — everywhere in the game. This row is how well he reads a shot from distance. Middle is the game. Hard: fewer long shots and through balls go in; Easier: more. Test screens only."],
          ["Weather: Real / Clear", "Real (the default) is the game's own weather — windy or wet in about 4 matches in 10, named above the pitch when it happens. Clear is still air on a perfect pitch."],
          ["Chances: Drawings / Generator", "Drawings (the default, and the game): each chance is one of your drawings, nudged and mirrored. Generator: every player is built from the spread of all the drawings of that type, so no drawing is ever replayed. Reaches Infinite Match, Infinite Highlights and the gallery's Sim — never a career."],
          ["Curve / Extra touch", "Pretend you own curving boots or touch boots."],
          ["Position / Division", "Which position you play and what standard of club you're at."],
          ["Pressure: Real (by division) / Off / Light / Premier League", "How hard the nearest opponent closes you down while you pull the ball back (he tackles you, or fouls you about 1 time in 3 — 2 in 3 if he comes from behind you, and he goes round you, never through you: a free kick, or a penalty inside the box). Real follows the Division above: Premier League full (a through ball is lost after about 2.6 s), Championship light, lower none. Test screens only — a career match always uses its own division."],
          ["Penalty run-up", "How you run up to a penalty: Standard, The Stroll, The Skip, The Sprint, Stutter Step, Two Steps or The Arc — every style, owned or not, so each can be seen on the real pitch (open a penalty card in Infinite Highlights or the gallery and press Play, or play a shootout). Looks only: who scores is the same with every style. Test screens only — a career uses the one it has equipped in Settings → Run-ups."],
          ["Free-kick run-up", "A separate set for direct free kicks, each modelled on an elite taker: Standard, Power Stance (Ronaldo), Stance and Sprint (Bale), The Calm Curl (Messi), Stutter Curl (Neymar), The Whip (Maddison), Long Diagonal (Trent). Looks only — the strike is still yours. Test screens only."],
          ["Back to the defaults", "Resets every dial, the keeper row and the Compare switches."],
          ["Compare old and new: New / Old", "Two switches: Penalty rules and Shot power. Old puts that one change back to how it was, so the two can be played side by side. Test screens only — a real career, its trial and its shootouts always play New."],
          ["Scenario Gallery →", "Opens the gallery."],
        ],
      },
      {
        group: "Infinite Match",
        items: [
          ["‹ Back", "Back to the Play Area."],
          ["What it served", "Live count of each chance type the match has given you, with shares and a per-90."],
          ["This chance: …", "The bar pinned to the top of the screen for the whole match: which chance you are on and the minute."],
          ["✎ Edit", "Opens the chance on screen in an editor: drag, + Mate, + Opp, Remove. On a penalty only the other players move, along the edge of the box."],
          ["Save", "Saves the chance exactly as it stands into that chance type in the gallery, for the whole team. No editing needed."],
          ["Commit", "Saves it AND commits it into the game's code, as it stands."],
          ["Save as a scenario / Commit to the game", "The same two, inside the editor — they save your edited version."],
          ["Back to the match", "Closes the editor."],
        ],
      },
    ],
    saving: [
      "The dials save the moment you change them, on this device only. There's no Save button.",
      "The Compare old and new switches and the keeper dial save the same way, instantly, on this device only, and stay until you set them back (\"Back to the defaults\" resets them too).",
      "Save as a scenario: " + SCENARIO_SAVE_SHARED,
    ],
    commit: [
      "Commit (on the pinned bar) and \"Commit to the game\" (in the editor) both commit — one scenario, straight onto main.",
      ...COMMIT_HOW.slice(1),
    ],
    inGame: [
      "Every test screen here (Infinite Match, Infinite Highlights, the gallery's Play) plays the Classic chances, whatever Settings → Chances says, so a New-library chance can never be saved or committed into the gallery. The New ones are on their own page: New Chances (/star-chances-dev).",
      "The dials, the Compare old and new switches and the keeper dial only affect the test screens (Infinite Highlights, Infinite Match, the gallery and its Play) — never a real career, its trial or its shootouts, which always play the new penalty rules, the new shot power and the Middle keeper.",
      "Everything else is the real game: the same engine, the same size on screen, the real squads (real faces, real finishing), and fresh legs every 90 minutes in a long match.",
      "A chance you commit from the editor is used by real /star-dev matches once the deploy finishes.",
    ],
    needs: [SCENARIO_TABLE_NEEDED, GITHUB_TOKEN_NEEDED],
    dev: "app/star-play-dev/page.tsx · components/star/{InfiniteMatch,EnginePlay,LiveChanceEditor}.tsx · lib/star/{playArea,engineProfile,liveEdit}.ts · lib/star/{goalFrame,pressure,runupStyles}.ts",
  },

  "/star-store-dev": {
    title: "Store (test)",
    what: "A test version of an in-game store: daily specials, penalty run-ups, accessories, boosts that help you win, and Coins bought with real money. Nothing here reaches a career, and no real money is ever taken.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["‹", "Back to the Play Area."],
          ["★ (wallet)", "Your test stars — the money you earn by playing."],
          ["Coins +", "Your test Coins — the money you would buy with real money. Tapping it opens the Coins tab."],
          ["⚙ Test controls", "Opens and closes the test panel below."],
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

  "/star-spin-dev": {
    title: "Spin your player",
    what: "A test of spinning your player round 360° by dragging, before it goes on the Home screen and in the store. Nothing here reaches a career.",
    buttons: [
      {
        items: [
          ["‹ Play Area", "Back to the Play Area."],
          ["Drag on the player", "Turns him. About 300px of drag is one full turn."],
          ["Flick and let go", "He keeps turning, slows down, then turns back to face you."],
          ["Club", "Every club with kit colours. Changes the kit, front and back."],
          ["Number", "The number on his back."],
        ],
      },
    ],
    saving: ["Nothing is saved."],
    inGame: [
      "Not in the game yet. If it is kept, it goes on the Home screen and in the store when trying on accessories.",
      "Front and back are both the real home-screen player (the back: surname and number on the shirt, the back of his head in his photo's hair colour). Side-on he narrows (body to 42%, head to 80%) and fades from front to back, so he never collapses to a line. A true side view still needs the Blender player rendered from about 24 angles.",
    ],
    dev: "app/star-spin-dev/page.tsx · components/star/PlayerAvatar.tsx · lib/star/heroBack.ts · tools/blender-footballer/",
  },

  "/star-blender-dev": {
    title: "Blender 3D",
    what: "The 3D footballer built in Blender, to judge by eye. He was rendered once with a grey kit; this page recolours that render into any club's kit, in your browser, when you pick the club. Nothing here reaches a career.",
    buttons: [
      {
        items: [
          ["‹", "Back to the Play Area."],
          ["Club", "Every club the game has kit colours for. Pick one and the hero and all five stills are recoloured into its kit, with its crest on the chest and 19 on the shorts."],
          ["Home / Away", "Switches to that club's change strip."],
          ["The coloured square", "The two kit colours the game uses: shirt, and trim (the trim is also the shorts)."],
          ["Home screen: A2 vs 3D", "Left is the real A2 avatar from the home screen; right is the 3D player, both in the kit you picked."],
          ["Stills", "Idle, arms up, knee slide, pointing at the badge, hands on hips."],
          ["Hair: style and colour chips", "Show that hair render. Only the crop was rendered in every colour; the other styles are brown only, and the box says so."],
          ["Animations", "Three short loops (idle, jump, knee slide). These are videos, so they stay in Chelsea's kit."],
          ["In the home screen", "The 3D hero pasted into the home screen (Chelsea, made offline) next to the live A2."],
        ],
      },
    ],
    saving: [
      "Nothing is saved. The club you pick is forgotten when you leave.",
    ],
    commit: [
      "Nothing commits from this page. The renders are files in public/star/blender/, and the Blender scripts that made them are in tools/blender-footballer/.",
    ],
    inGame: [
      "Not in the game yet. This page is here so the look can be judged; the notes at the bottom list what is left and the two ways it could go in.",
      "The crest is the club's real badge when it loads here, otherwise the same initials disc the game uses; the line under the hero says which.",
    ],
    dev: "app/star-blender-dev/page.tsx · lib/star/blenderRecolour.ts · tests/star/blenderRecolour.mts · public/star/blender/ · tools/blender-footballer/ (NOTES.md, scripts, footballer.blend)",
  },

  "/star-3d-area-dev": {
    title: "3D Test Area",
    what: "Every cutscene and 3D area being built, in one list, plus a store of every 3D and Blender file the site has. Nothing here touches a career.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["‹", "Back to the Play Area."],
          ["Scenes / Assets", "Switch between the list of scenes and the asset store."],
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

  "/star-garden3d-dev": {
    title: "3D Garden",
    what: "The walk-around 3D garden, on a made-up career, so every part can be seen without playing to it. It is the same screen a career opens from Home's Garden.",
    buttons: [
      { items: [
        ["‹ Home", "Back to the 3D Test Area."],
        ["day / sunset / night", "Changes the time of day. In a career it follows the time of your next kick-off."],
        ["Full career / New career", "Full: trophies, a horse, three cars and a mansion. New: nothing owned or won yet."],
        ["Restart", "Builds the garden again from the start."],
        ["The stick (bottom left)", "Drag it to walk. A little way is a walk, all the way is a jog. On a computer, WASD or the arrow keys work too (hold Shift to jog)."],
        ["Drag the view", "Swings the camera round him."],
        ["Walk up to something", "The trophy cabinet, the bench, the paddock, the cars or the teqball table: its little card shows."],
        ["Walk into the shop's doors", "Opens the 3D Shop test page. In a career it opens the 3D shop, and its front doors bring you back out."],
      ] },
    ],
    saving: ["Nothing is saved. The career here is made up each time."],
    inGame: ["Home → Garden in a career opens this 3D garden. The shop where the house used to be is the 3D shop."],
    dev: "components/star/Garden3D.tsx, lib/star/garden3d/scene.ts; models packed by tools/garden3d/export_models.py and build_anims.py.",
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
          ["Tap something", "A boot, the car, a light box or the fridge: its card opens and the camera moves in on it, wherever you are standing."],
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
      "A phone or browser that runs 3D (WebGL). If it can't, the page says so and the normal shop still works. A slow phone drops to fewer pixels and no shadows on its own.",
    ],
    dev: "components/star/Shop3D.tsx (the screen, shared with the game's phase \"shop-3d\") · app/star-shop3d-dev/page.tsx · lib/star/shop3d/{scene,catalogue,kit,textures}.ts · public/star/shop3d/items/*.glb (boots + cars, Draco) made by tools/shop3d/export_items.py from tools/blender-shop/scripts/{boot,car,cars}.py · public/star/shop3d/draco/ (three's decoder) · the footballer: the new player (lib/star/people3d.ts, public/star/people3d/) by default, or the old character.glb + anims.glb (tools/shop3d/build_assets.py) when Settings → Look → \"3D shop player\" is Old (?player=old here) · three.js is the site's own package, loaded only when the shop opens",
  },

  "/star-chances-dev": {
    title: "New Chances",
    what: "The new chance library on its own: every picture the New chances can serve, per chance type. It is kept apart from the Scenario Gallery on purpose until the new set is proven.",
    buttons: [
      {
        group: "The list",
        items: [
          ["One on one 110, Cutback 74 … (the type buttons)", "Pick a chance type. The number is how many pictures the library has of it."],
          ["A picture", "Opens it big at the top, with which library picture it is and the drawing it came from."],
          ["Show 24 more", "The list shows 24 at a time."],
        ],
      },
      {
        group: "The open picture",
        items: [
          ["▶ Play this one", "Plays that picture in the real match engine, with the New chances on for this page only. Press again (■ Stop) to go back to the picture."],
          ["‹ Prev / Next ›", "The picture before or after it."],
          ["Close", "Closes it."],
        ],
      },
    ],
    saving: [
      "Nothing is saved. There is no Save and no Commit on this page.",
      "A New chance can never go into the gallery: every Save and Commit elsewhere refuses one with \"This chance is from the new library — it can't go into the gallery.\"",
    ],
    inGame: [
      "Real career matches serve these pictures only when Settings → Chances is New. Classic is the default.",
      "Every test screen — the Play Area, Infinite Match, Infinite Highlights and the gallery's Play — plays the Classic chances whatever Settings says. This page is the only test screen that plays the New ones.",
      "The pictures show the other side in a formation and block that change picture by picture (named under the open picture). In a match it is the real opponent's.",
    ],
    dev: "app/star-chances-dev/page.tsx · lib/star/{chanceLibrary,chanceLibrary.json,chanceSet,libraryMark,matchView,scenarioFrame}.ts · components/star/EnginePlay.tsx (newChances) · built by scripts/chance-library.mts",
  },

  "/star-sprites-dev": {
    title: "3D match figures",
    what: "The new small 3D players and keepers on their own, at the real match size: two clubs in their real kits running, standing, striking, celebrating, and a keeper diving. A 4x zoom underneath shows one of each.",
    buttons: [
      {
        items: [
          ["Pause / Play", "Stops and starts the men moving, so one frame can be looked at closely."],
        ],
      },
    ],
    saving: ["Nothing is saved. No career is touched."],
    inGame: ["The same figures are drawn in the match's New view (Settings: Players in the match → 3D)."],
    dev: "app/star-sprites-dev/page.tsx · lib/star/sprites.ts · public/star/sprites/ (made by tools/sprites/bake.mjs from the rigged models, which are not in the repo)",
  },

  "/star-3d-dev": {
    title: "3D",
    what: "One of every mode in the game, with the players drawn in the new \"3D\" look (shaded kit, folds, socks and boots, a soft shadow, the fitted face) — and a switch to see the same moment in today's look.",
    buttons: [
      {
        group: "Top of the page",
        items: [
          ["‹", "Back to the Play Area."],
          ["Classic / 3D", "Which look the players are drawn in, on this page only. The mode below restarts in that look."],
          ["Match chance … Home avatar", "The ten modes: a real match chance, a penalty shootout, trial penalties, trial free kicks, a training strike drill, the training gauntlet, five-a-side, the first-person dribble, Goalie Mode and the home-screen avatar."],
        ],
      },
      {
        group: "Match chance",
        items: [
          ["Cutback / One-on-one / Corner", "Which kind of chance to play. It is the real match, at the real size."],
          ["Next chance ›", "A different chance of the same kind."],
        ],
      },
      {
        group: "Everything else",
        items: [
          ["(the mode itself)", "Plays exactly as it does in the game — same controls, same rules. Finishing one starts it again."],
          ["Home avatar", "3D shows the home screen's avatar (A2). Classic shows the game's own figure, lit (A1)."],
          ["Today / C1 Skill cam / C2 Broadcast / C3 Dynamic (Dribble)", "Which camera the dribble is seen through. Today is the game's camera. C1 is low over the shoulder, C2 is high behind, C3 closes in when a defender is near. The run itself — defenders, timing, controls — is identical in all four; switching takes effect straight away."],
          ["Defenders: real / easy (Dribble)", "Real is the game's defenders. Easy makes them slow so a run lasts long enough to watch the camera — this page only."],
        ],
      },
    ],
    saving: [
      "Nothing is saved. No career is touched, Goalie Mode's bank here is pretend, and the Classic / 3D switch is forgotten when you leave.",
    ],
    inGame: [
      "Nowhere yet — the real game still draws everyone in the Classic look.",
      "To try 3D in a real career on one phone: Settings → Look → Drawn-player style → Shaded (that phone only). Harry decides when it becomes everyone's look.",
    ],
    dev: "app/star-3d-dev/page.tsx · lib/star/{figureSkin,figure3d,heroFigure,faceFit}.ts · lib/star/fiveASide/render.ts (drawFigureAt picks the look) · lib/star/firstPersonRender.ts",
  },

  "/star-radar-dev": {
    title: "Match Radar",
    what: "Watch the match that runs behind your highlights — all ninety minutes, minute by minute: who has the ball, where it is, the momentum, and the moments that would be yours. It is the real unseen match, not a copy.",
    buttons: [
      {
        items: [
          ["▶ / ❚❚", "Starts and pauses the clock. At full time it becomes ↻ and plays the same match again."],
          ["1× 2× 5× 10× 20×", "Match minutes per second. 20× plays a whole match in about 4½ seconds."],
          ["↻ (right of the speeds)", "A new match — a different roll of the same fixture."],
          ["The pitch", "Your goal on the left, theirs on the right. The dot is the ball, ringed in the colour of whoever has it; the arrow is the way they're attacking; the lit box is the area of the pitch it's in."],
          ["⭐", "A chance the match would hand to YOU — in a career, the highlight you play."],
          ["⚽ You score / ✕ You miss / Bench odds", "Only with \"Stop and ask me\" on: decides how your highlight went. Bench odds is the rate the game uses when you're not on the pitch."],
          ["Momentum strip", "A bar a minute: up is you on top, down is them. ⚽ marks goals, ⭐ your highlights, 🚑 an injury."],
          ["🚑 Injury", "The unseen match doesn't injure anyone minute by minute. A career checks once, at full time, from the energy you finish on — the radar does the same check and shows it at 90' and on the full-time card."],
          ["Change", "Opens the settings: both clubs and how strong they are, home or away, your position, your energy at kick-off (for the injury check), and whether your highlights stop the clock."],
        ],
      },
    ],
    saving: ["Nothing is saved. Changing a setting starts the match again; leaving the page forgets it."],
    inGame: [
      "Nowhere — it's a window onto the match the career already runs. Every minute is the real match's own function; your highlights are the moments a career would stop and let you play.",
    ],
    dev: "app/star-radar-dev/page.tsx · components/star/MatchRadar.tsx · lib/star/matchRadar.ts (calls tick/resolveScenario in lib/star/hiddenMatch.ts)",
  },

  "/star-scenario-dev": {
    title: "Scenario Builder",
    what: "Build a match moment by hand: place team-mates, opponents and the ball, and frame the camera.",
    buttons: [
      {
        items: [
          ["+ Teammate / + Opponent", "Adds a player where the camera can see him."],
          ["Remove / ✕ over a player", "Tap a player, then Remove (or the red ✕, or Delete key) to take him off."],
          ["Drag", "Move any player or the ball."],
          ["Name", "What the scenario is called."],
          ["Moment", "Corner, Free Kick, Throw-In, Kickoff or Open Play."],
          ["Pick on the whole pitch", "Zooms out to the whole pitch; drag the dashed frame to where the camera should be. \"Done — back to editing\" returns."],
          ["Centre X / Centre Y", "Slide the camera across and up the pitch."],
          ["Angle", "Straight on / From the left / From the right — the only three the real match films from."],
          ["Save scenario", "Saves it for the team."],
          ["New", "Starts a blank one."],
          ["Saved list", "Tap a name to load it; ✕ deletes it everywhere — it asks you to confirm first."],
        ],
      },
    ],
    saving: [
      "Save scenario writes to the team's shared scenario list (Supabase table star_scenarios) — every device sees it. The note at the top of the page saying \"saved locally in this browser\" is out of date.",
      "If the table is missing, a red box says so and saves stay on this device only (\"Saved on this device ONLY\").",
    ],
    inGame: [
      "Nothing built here plays in a real match — there's no commit from this tool. It's for trying out how a scenario gets built.",
    ],
    needs: [SCENARIO_TABLE_NEEDED],
    dev: "app/star-scenario-dev/page.tsx · components/star/ScenarioEditor.tsx · lib/star/{scenarios,scenarioStore}.ts · /api/star/scenarios",
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
    title: "Tuning",
    what: "Every game-balance number in the Star Career game — energy, training, ratings, sponsors, contracts, transfers — plus shop prices.",
    buttons: [
      {
        items: [
          ["Number boxes", "Type a new value. An \"edited\" tag shows it's changed from the default."],
          ["Reset (on a row)", "Puts that one number back to its default."],
          ["Shop prices", "KIB cans (price and energy), boots and lifestyle items."],
          ["Reset everything to default", "Puts every number and price back. Asks first."],
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
    dev: "app/star-tuning-dev/page.tsx · components/star/TuningEditor.tsx · lib/star/{tuning,tuningStore}.ts",
  },

  "/star-dev/media-lab": {
    title: "Media Lab",
    what: "A test bench for the media-feed graphics: drop in a pose and a face and see every template in every club's colours.",
    buttons: [
      {
        items: [
          ["Pose image / Face image — Choose file (or drop)", "Load a picture. \"remove\" clears it."],
          ["Club colours", "Re-colour the templates in that club's kit."],
          ["Treatment / Face X / Face Y / Face size / Neck line / Face brightness / Figure size / Figure up / down", "Line the face up on the pose."],
          ["Anchor", "The numbers to copy into the template once it looks right."],
          ["Preview the \"you won it\" modal / team sheets / match commentary", "Opens that screen with sample data."],
        ],
      },
      {
        group: "Feed preview (add ?feed to the address)",
        items: [
          ["/star-dev/media-lab?trophies", "Shows the Trophy Cabinet filled with every trophy that has a picture, for judging the trophy art."],
          ["/star-dev/media-lab?contact=float (or bounce, bobble, still)", "Shows the strike screen with the ball moving that way (float = header, bounce = volley, bobble = a ball at your feet). Tap the ball to try it; it starts again a moment later."],
          ["/star-dev/media-lab?shop=boots (or =lifestyle)", "Shows the shop with a sample National League career and ★1,000,000, for judging the 5 levels. Buying does nothing here."],
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

  "/star-match-dev": {
    title: "Match Engine (sandbox)",
    what: "A separate copy of the match engine for trying shooting physics without touching the real game.",
    buttons: [
      {
        items: [
          ["Scenario — Random / a type", "Forces every chance to be that type."],
          ["Curve boots", "Tick to pretend you own curving boots."],
          ["Knuckleball (two fingers up, in flight)", "With curve boots on, swipe two fingers up the screen while your shot flies. It wobbles late and the keeper guesses wrong more often than right."],
          ["Knuckle every shot (for mouse)", "Makes every shot at goal a knuckleball, so it can be tried without a touch screen."],
          ["⚡ Power shot / Power shot button", "Tap ⚡ before aiming. After the drag the pitch keeps moving for a short wind-up, then tap the green circle fast: up to 1.5x pace; slow or missed taps drift off your aim."],
          ["Power / Technique / Keeper Strength", "Your skills and their keeper."],
          ["Position / Team Relationship", "Start from your career's own values if one is saved in this browser."],
          ["Height at 0% power / Extra height from full power / Overall lift", "How high shots fly — this copy only."],
        ],
      },
    ],
    saving: ["Nothing is saved. It reads your career in this browser (if any) but never changes it."],
    inGame: ["Nothing reaches the real game. A physics change found here has to be copied into the real engine by hand."],
    dev: "app/star-match-dev/page.tsx · components/star/CanvasMatchTest.tsx · lib/star/{canvasEngineTest,hiddenMatchTest}.ts",
  },

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

  "/star-attack-dev": {
    title: "Live Attack (sandbox)",
    what: "A prototype of a moving attack: the ball is delivered, you have to get there in time and aim the finish.",
    buttons: [
      {
        items: [
          ["Delivery — Random / a type", "Which kind of ball comes in."],
          ["Power / Technique / Keeper strength / Team relationship", "Your skills, their keeper, and how well your team plays for you."],
          ["Fixed seed", "Replay the same situation."],
          ["Go Again", "After a result, try another."],
        ],
      },
    ],
    saving: ["Nothing is saved. Any change starts a fresh situation."],
    inGame: ["Not in the game — a mechanic prototype."],
    dev: "app/star-attack-dev/page.tsx · components/star/LiveAttack.tsx · lib/star/liveAttack.ts",
  },

  "/star-bicycle-dev": {
    title: "Bicycle Kick (sandbox)",
    what: "A throwaway test of an overhead-kick mechanic from the edge of the box.",
    buttons: [
      {
        items: [
          ["Press and hold on the pitch", "Winds up the kick; drag left / right while holding to lean it; let go to strike."],
          ["Power / Technique / Keeper Strength", "Sandbox dials."],
        ],
      },
    ],
    saving: ["Nothing is saved or read — no sign-in needed."],
    inGame: ["Not in the game."],
    dev: "app/star-bicycle-dev/page.tsx · components/star/BicycleKickTrial.tsx",
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
    dev: "app/draft-dev/page.tsx · components/draft/DraftSetupV2.tsx",
  },

  "/draft-dev2": {
    title: "Draft (dev 2)",
    what: "A copy of the PL Draft game with the \"Hero\" setup screen, for trying a new look.",
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
    dev: "app/draft-dev2/page.tsx · components/draft/DraftSetupHero.tsx",
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

  "/profile-new": {
    title: "Profile (new)",
    what: "A trial redesign of the profile page, showing your real level, XP, trophies, streak and objectives.",
    buttons: [
      {
        items: [
          ["Objective tabs", "Objectives, Foundation, GOAT Manager, Record Breakers."],
          ["An objective", "Shows its details on the right."],
          ["Claim", "Claims a finished objective's reward — this is real and counts on your account."],
        ],
      },
    ],
    saving: ["Reads your real profile. Claiming writes to your real account."],
    inGame: ["Not linked from the site yet — the live profile is /profile."],
    dev: "app/profile-new/ProfileNewClient.tsx · /api/profile/progression, /api/objectives",
  },

  "/ballon-dor": {
    title: "Ballon d'Or (beta)",
    what: "An admin-only career game: create a player, play seasons, and chase the Ballon d'Or.",
    buttons: [
      {
        items: [
          ["Setup", "Pick an archetype and position, or a real player to start from."],
          ["Continue Season N → / Start Season N →", "Plays on."],
          ["Review offers →", "Transfer offers waiting in the summer."],
        ],
      },
    ],
    saving: [
      "Your career is saved in THIS browser only — another device starts fresh.",
      "XP you earn is sent to your real account.",
    ],
    inGame: ["Admin only for now — not linked for players."],
    dev: "app/ballon-dor/page.tsx · components/ballon-dor/*",
  },
} satisfies Record<string, AdminGuide>;

export type GuidePage = keyof typeof ADMIN_GUIDES;
