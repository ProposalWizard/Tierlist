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
          ["Tic Tac Toe", "Make and schedule the daily grids (Daily Queue, Live / Hidden, difficulty, Save Puzzle)."],
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
          ["+ Add Images", "Add pictures. Drag to reorder; the small buttons on each picture crop it, set it as cover, or remove it."],
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
          ["Artifact link (bottom)", "Opens the full shareable patch-notes page for that version, if it has one."],
        ],
      },
    ],
    saving: ["Nothing here saves. New patch notes are added by Claude as part of shipping a change."],
    commit: ["New entries arrive through a normal code change (they live in a file, not the database) — they appear after the next deploy."],
    inGame: ["Admin only. Players never see this page."],
    dev: "app/admin/patch-notes/PatchNotesArchive.tsx · lib/patchNotesData.ts",
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
          ["The picture", "Drawn exactly as Play will show it: same size, same club kits (the real ones Play plays in), and corners and byline crosses turned sideways, goal on the right or left, the way the real game films them. Bigger on a laptop (up to 520 wide), full width on a phone."],
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
          ["▶ / ▶ Sim, then Next →", "Simulates a fresh chance of this type the way a real match rolls one. Next → gives another. \"Back to version N\" returns."],
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

  "/star-highlights-dev": {
    title: "Infinite Highlights",
    what: "Real chances straight off the match's own generator, as fast as you can press Next — flag the bad ones and fix them on the spot.",
    buttons: [
      {
        group: "Top bar",
        items: [
          ["‹", "Back to the Scenario Gallery."],
          ["N/13", "Choose which chance types to show: All, None, tap types on or off, then \"Watch these\"."],
          ["⚑ N", "Your flagged list. Tap one to jump back to it; Clear empties the list."],
        ],
      },
      {
        group: "The picture",
        items: [
          ["The picture", "Drawn exactly as Play will show it: same size (bigger on a laptop, full width on a phone), the real club kits Play plays in, and corners and byline crosses turned sideways like the real game."],
          ["Drag", "Move any player or the ball. Tap a player to select him. Swipe the grass for next / previous."],
          ["+ Mate / + Opp", "Add a team-mate or an opponent."],
          ["Remove", "Takes out the player you tapped."],
          ["▶ Play / ◼ Stop", "Plays this exact chance, your drags included, at the picture's size — a drag still hits exactly as hard as in a career. Real squads and faces, the real weather, and the Play Area's dials."],
          ["PNG", "Downloads the picture (without the fault rings)."],
          ["Delete", "Only for a saved chance: deletes it from the shared list AND the code."],
          ["Tune", "Only after a drag: records what was wrong as a correction. Not a save."],
          ["‹  ⚑  Next →", "Previous, flag / unflag this one, next. Keys: ← →, space, F to flag."],
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
      "The chances are generated exactly as in a real /star-dev match, so what you see here is what players get.",
      "Your fixes reach real matches only once they're committed — here, or from the gallery.",
    ],
    needs: [SCENARIO_TABLE_NEEDED],
    dev: "app/star-highlights-dev/page.tsx · lib/star/{gallerySim,highlightStore,scenarioEdit}.ts · /api/star/scenarios, /api/star/scenarios/commit",
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
          ["Power / Technique / Opposition / Match length", "Sliders for you, the other side, and how long Infinite Match lasts."],
          ["Keeper: Real / Set", "Real (the default) is the opposition's own starting keeper, exactly as in a career. Set shows a Keeper rating slider that decides instead."],
          ["Weather: Real / Clear", "Real (the default) is the game's own weather — windy or wet in about 4 matches in 10, named above the pitch when it happens. Clear is still air on a perfect pitch."],
          ["Curve / Extra touch", "Pretend you own curving boots or touch boots."],
          ["Position / Division", "Which position you play and what standard of club you're at."],
          ["Back to the defaults", "Resets every dial."],
          ["Scenario Gallery →", "Opens the gallery."],
        ],
      },
      {
        group: "Infinite Match",
        items: [
          ["‹ Back", "Back to the Play Area."],
          ["What it served", "Live count of each chance type the match has given you, with shares and a per-90."],
          ["This chance: …", "The bar pinned to the top of the screen for the whole match: which chance you are on and the minute."],
          ["✎ Edit", "Opens the chance on screen in an editor: drag, + Mate, + Opp, Remove."],
          ["Save", "Saves the chance exactly as it stands into that chance type in the gallery, for the whole team. No editing needed."],
          ["Commit", "Saves it AND commits it into the game's code, as it stands."],
          ["Save as a scenario / Commit to the game", "The same two, inside the editor — they save your edited version."],
          ["Back to the match", "Closes the editor."],
        ],
      },
    ],
    saving: [
      "The dials save the moment you change them, on this device only. There's no Save button.",
      "Save as a scenario: " + SCENARIO_SAVE_SHARED,
    ],
    commit: [
      "Commit (on the pinned bar) and \"Commit to the game\" (in the editor) both commit — one scenario, straight onto main.",
      ...COMMIT_HOW.slice(1),
    ],
    inGame: [
      "The dials only affect the test screens (Infinite Highlights, Infinite Match, the gallery's Play) — never a real career.",
      "Everything else is the real game: the same engine, the same size on screen, the real squads (real faces, real finishing), and fresh legs every 90 minutes in a long match.",
      "A chance you commit from the editor is used by real /star-dev matches once the deploy finishes.",
    ],
    needs: [SCENARIO_TABLE_NEEDED, GITHUB_TOKEN_NEEDED],
    dev: "app/star-play-dev/page.tsx · components/star/{InfiniteMatch,EnginePlay,LiveChanceEditor}.tsx · lib/star/{playArea,engineProfile,liveEdit}.ts",
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
          ["Saved list", "Tap a name to load it; ✕ deletes it everywhere."],
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
