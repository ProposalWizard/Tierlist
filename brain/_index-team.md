# Brain index team
ID | summary | tags
FACT-TEAM-001 | next build needs about 6.5 GB; package.json gives it 6 GB of heap (node --max-old-space-size=6144). A Vercel deploy that fails with no other clue may be out of memory again: build locally with no NODE_OPTIONS to check. | deploy,team
FACT-TEAM-002 | The Patch bot posts each new patch note once in #general naming the two who did not write it; comments ride "[pn:version]" in one thread; the post moves to #patch-notes when all three have read it. No new table. | data,process,style,team
FACT-TEAM-003 | The Team room has two looks: Dark = Midnight slate, Light = Light C. It follows the device until you tap the sun/moon beside your name (per device). Faces are club-style crests. | ui,team
FACT-TEAM-004 | Every Team room channel has its own tabs and opens on its first one (CHANNEL_TABS). #today is a channel: a check-in is a "[#today]" message, /today words writes one. Me and Team board are views inside the room. | team,style
FACT-TEAM-005 | Five Team room bots (Patch, Bug, Health, Today, Jobs). Each posts once however often it is asked, has its own page with Run now, and only bots that do their job are listed. Health and Today can be switched off. | team
PRO-TEAM-001 | Push means merge Harry into main after tsc, both guards, the tests and npm run build pass, once the team reviewed the patch notes. | team,process,deploy
PRO-TEAM-002 | [SUPERSEDED] Patch notes order: stills on the page, push, publish; then film the gameplay clips; never hold the push for a video. | process,rule,deploy
PRO-TEAM-003 | Pictures as they come in: builders save each still at once, and the lead sends each new still to Harry with a caption. | process
PRO-TEAM-004 | Build approved changes straight onto the Harry branch; prototype first only for things Harry has to judge by eye. | team,process
PRO-TEAM-005 | Clear disk space before every new build: remove old agent worktrees, git worktree prune, delete old folders, check df -h. | process
PRO-TEAM-006 | Builders check light: ONE quick check per change (loads, no console errors, one still); Harry judges 3D on his phone. | three-d,process
PRO-TEAM-007 | Ship patch notes alone: node scripts/patch-notes/ship.mjs <versions> --pr makes a patch-notes-only PR to main; feature code waits for Harry's push. | process,deploy
PRO-TEAM-008 | Patch notes order: stills on the page, ship the notes with ship.mjs, publish; push the feature when Harry says; then film clips. | process,deploy
PRO-TEAM-009 | Before shipping a patch note, run scripts/patch-notes/squeeze-media.sh <version> (clips CRF 30, stills JPEG ~80%); the patch-notes folder must stay under Vercel's 250 MB route cap. | process,rule
RUL-TEAM-001 | [SUPERSEDED] Deploy only when told: commit and push to the Harry branch freely, merge to main only when Harry says push. | team,rule,deploy
RUL-TEAM-002 | [SUPERSEDED] Every deploy comes with patch notes; Harry decides each time whether to push now or see patch notes first. | process,deploy,team
RUL-TEAM-003 | Progress updates every 5 minutes on every task, with % and time left on every bar and the token/weekly usage block. | process,team
RUL-TEAM-004 | No forced new chats: after about 3 hours of chat, add one line that it could be a good time to restart. | process,team
RUL-TEAM-005 | Patch notes never link the Vercel test build; mostly stills, a short after clip only for gameplay and animation. | process,rule,team
RUL-TEAM-006 | [SUPERSEDED] Patch-note version keys must be unique: search the data file for the number on BOTH branches first. | team,rule
RUL-TEAM-007 | Jobs for the team go in team/jobs.json and arrive by push, never SQL. | team,rule,deploy
RUL-TEAM-008 | Branches are per-person: this session develops on Harry; never push to another person's branch. | team,rule,deploy
RUL-TEAM-009 | Build slowly and correctly: deep plan first, then build one piece at a time, each checked and signed off. | team
RUL-TEAM-010 | Don't write "needs Mikey's yes" on patch notes. | team,process,style
RUL-TEAM-011 | Perfection with efficiency: cut effort where it doesn't change the outcome; never cut the page layout. | rule,team
RUL-TEAM-012 | The change list goes out before the push, every time, naming shared files (page.tsx, types.ts, tailwind config). | deploy,team
RUL-TEAM-013 | Mikey's STAR_ROADMAP.md is his own list; in Harry's sessions Harry sets the order. | team
RUL-TEAM-014 | The everyday model, at medium or high effort, for common tasks; the top model for making things (features, hard problems, UI). | team
RUL-TEAM-015 | Subagents follow the same split: pass the model; the everyday model for star-playtest, video breakdowns, reviews. | process,team
RUL-TEAM-016 | Update 1 Oct: the everyday model at medium effort for recordings and building artifacts; the top model for logic tasks. | team
RUL-TEAM-017 | Playtest videos: the everyday model does the breakdown; the top model does the analysis and the answers. | process,style,team
RUL-TEAM-018 | Patch notes are made automatically as each build finishes and go onto the site straight away; the inbox notifies everyone of unread ones. | process,team
RUL-TEAM-019 | Deploy only when told: merge feature code to main only when Harry says push; patch-notes-only PRs made by ship.mjs go to main at once. | rule,deploy,team
RUL-TEAM-020 | Every deploy's patch notes are already live, shipped on their own first; Harry still decides when the feature itself is pushed. | process,deploy,team
RUL-TEAM-021 | In Mikey's chats, write or update patch notes only when Mikey says "create patch notes"; never on your own, not even at a deploy. | team,process,rule,deploy,style
RUL-TEAM-022 | In Mikey's chats, never run a playtest unless Mikey asks; when one would really help, recommend it in one line and stop. | team,process,rule
RUL-TEAM-023 | Everything goes on the admin page, always: every patch note and every update to one is shipped to the site and checked live; an update is marked (updatedAt + updateNote) so it shows UPDATED, moves to the front and is unread again. | admin,process,team
RUL-TEAM-024 | "Only give people todos if it is actually needed; if someone needs to do something, tell Leo first (no team/jobs.json from a Leo chat without his OK)." | team,process
RUL-TEAM-025 | Feedback on a patch note is answered on that same patch note page (a follow-up section with before/after), never a new artifact. | process,rule,style,team
RUL-TEAM-026 | Big tasks: do every step that needs no approval first; leave anything that may ask Mikey to tap Allow (artifact publish, connector call) until the end. | team
RUL-TEAM-027 | When Mikey asks to measure, report or discuss something, report back and do not change the game; build only what he asks to be built. | team
RUL-TEAM-028 | "Every patch note: author, real date and time, every update with time and where, its own number (no base shared with anyone's, search all branches), a menu name saying what it is about, and the one standard page; checked by rules.mjs." | team,process
RUL-TEAM-029 | Leo's chats: start with a plan as progress bars (steps, time each, % done), update them and the admin board often; end every task with yes/no lines (works? patch notes made/updated? live on admin page? merged into the game?), then at most 5 lines; ask for every approval together at the start or end. | admin,team,process,deploy
