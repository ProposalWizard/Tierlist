# Brain index (built by scripts/brain/build_index.py, do not hand-edit)
ID | summary | tags
FACT-3D-001 | Low tier (old Android, low PC) may run 3D at a steady 30 fps with the same picture. | three-d
FACT-3D-002 | scripts/perf3d/shrink-models.mjs packs the GLBs in place (meshopt, WebP, Draco); a new file needs a POLICY line. | three-d
FACT-ALL-001 | Claude searches cheapest first: code, then the index, then 1 to 3 notes, then the source. | brain
FACT-ALL-002 | The superseded filming rules (before/after videos, a filming pass, the test build link) are kept in SESSION_LOG.md. | process,brain
FACT-ALL-003 | star-playtest agent: use after any change to lib/star, components/star or app/star-dev; it boots a real browser. | process,brain
FACT-ALL-004 | show-options agent: renders candidates at phone size for a number, size, colour or layout a non-coder has to judge. | brain
FACT-ALL-005 | explain-and-prompt agent: writing up a build so it can be judged without opening a file. | brain
FACT-ALL-006 | playtest-video skill: a screen recording becomes timestamped pictures and a transcript. | process,brain
FACT-ALL-007 | make-artifact agent: a shareable page for a build, review or batch of changes. | brain
FACT-DAT-001 | [SUPERSEDED] star_tuning_notes.sql is PENDING: the table still does not exist live, so run this one again. | data
FACT-DAT-002 | [SUPERSEDED] star_xp_config.sql is PENDING, seen missing in the live database on 20 Oct 2026. | data
FACT-DAT-003 | star_casino.sql: DO NOT RUN; the casino stays on the phone with CASINO_ON_SERVER false. | economy,data
FACT-DAT-004 | Every other listed migration (draft, sofifa, security, star tables) is RUN, no action needed; full rows are in SESSION_LOG.md. | data
FACT-DAT-005 | star_xp_config and star_tuning_notes were run live on 23 Oct 2026 (Claude via the Supabase connector, Harry's yes); update_login_streak now only updates the signed-in player. | data
FACT-DAT-006 | The Supabase connector works in cloud Claude chats since 23 Oct 2026 (project cagkgfketucousksgtbk); CLAUDE.md's "Pending Setup" line saying cloud connectors fail is out of date for Supabase. | process,data
FACT-ENG-001 | The guard also fails on a direct CanvasMatch mount, a grown KNOWN_COPIES list, a new canvas animation loop or a blind canary. | engine
FACT-ENG-002 | Trial penalties, free kicks, training strike drills and the gauntlet mount EngineFeature; a difference is a named dial. | engine
FACT-ENG-003 | Still copies, to port next: five-a-side only; the /star-match-dev fork was deleted (18 Oct 2026). | admin,engine
FACT-ENG-004 | [SUPERSEDED] The engine-warn hook also asks, as SOMETHING MAY DRIFT, on CanvasMatch, EnginePlay, hiddenMatch and the other play-screen files. | engine
FACT-ENG-005 | The engine-warn hook warns (no Allow prompt) on canvasEngine and on the play-screen drift files; its old ask() is kept to switch back. | engine
FACT-ENG-006 | Men, keeper and ball are one size in metres on every camera (a man 1.63 m, 22% of the goal's width, Mikey's 4-0 build-up picture); cameras unchanged. Locked by tests/star/figureScale.mts. | team,engine
FACT-KIB-001 | Knowitball as a client: three mates building the best football game ever; client code KIB. | client-kib
FACT-KIB-002 | Audience: football fans 16 to 30 on TikTok, Reels and Shorts (Harry to confirm). | client-kib
FACT-KIB-003 | Video format: 1080×1920 (9:16), 30 fps, H.264, AAC stereo; v01 ran 44.7 s at -13.4 LUFS. | client-kib
FACT-KIB-004 | Safe area: captions and cards stay inside x 64–950 and y 150–1536. | client-kib
FACT-KIB-005 | End card: KNOWITBALL, the versions so far, a green knowitball.co.uk pill and "FOLLOW FOR v0.4". | client-kib
FACT-KIB-006 | Voice-over: Kokoro v1.0 offline, voice bm_george, speed 1.2, en-gb; the same setup as the game's commentary. | media,client-kib
FACT-KIB-007 | Learning from v01: v0.2 and v0.3 had no screenshots in the repo, so their beats had to be drawn diagrams. | client-kib
FACT-KIB-008 | Learning from v01: render frames in chunks of 250, one page per chunk; one long session crashed the page. | client-kib
FACT-TEAM-001 | next build needs about 6.5 GB; package.json gives it 6 GB of heap (node --max-old-space-size=6144). A Vercel deploy that fails with no other clue may be out of memory again: build locally with no NODE_OPTIONS to check. | deploy,team
FACT-UI-001 | Settings keeps only real player preferences (sound, full screen, 3D quality, faces, names) and the Settings UI Old/New row. | three-d,ui
FACT-UI-002 | Decided, no toggle: to see or bring back an old option, read the files at ebe02ad; old stored values are ignored. | ui
FACT-UI-003 | Chances: the team's drawn chances only, everywhere; the New chance library and the Generator were DELETED. | team,ui
FACT-UI-004 | Chance mix: the basic even mix; the Kane drawings were deleted with the StatsBomb data (19 Oct 2026). | ui
FACT-UI-005 | Animations: New; Clearances: always on; Keepers New/Old row kept, default New. | ui
FACT-UI-006 | Dribble: top-down in every match with team-mates to pass to; the first-person duel is on /star-dribble-dev only. | admin,team,ui
FACT-UI-007 | Match camera (action fit): Old until the rebuilt camera lands. | ui
FACT-UI-008 | 2D match: match view New, chance framing Zoom, wide chances Old, camera angle 20 degrees, 2D players Style A, ball New. | ui
FACT-UI-009 | Your player is shown on EVERY chance (Mikey, 20 Oct), moved clear of the ball; still to be re-agreed with Harry. | team,ui
FACT-UI-010 | Shot spread cone: drawn in the test area only (lib/star/testArea.ts). | ui
FACT-UI-011 | 3D world decided: garden New, house New, 3D look H, shop player New, motion Mocap, signing 3D, drill controls Auto. | three-d,ui,economy
FACT-UI-012 | Screens decided: badges, all seasons, Ballon d'Or night, home, shop and ovation New; drawn players Shaded. | career,economy,ui
FACT-UI-013 | Rows that stay: full screen, sound, 3D quality, skip the line-up, Keepers, Match view 3D, player names, UI Old/New, v0.15 test box. | three-d,ui
FACT-UI-014 | Cut scenes: people and camera New, no row; the Version picker went; the rows left live in lib/star/lookRows.ts. | ui
FACT-UI-015 | Faces: photo faces OFF for everyone, every head is the drawn one (PHOTO_FACES); face editors hidden until the photo revamp. | ui
FACT-UI-016 | A new career opens its match moves one at a time (headers and volleys after game 3, steer at Pace 60, sprint at Pace 65, dribble after game 4); power shot, knuckleball, skill moves and one-twos wait for an update. | career,ui
PRO-3D-001 | Any 3D, animation, mocap, model or cut-scene work: merge main first, then read docs/3D_HANDBOOK.md. | three-d,deploy
PRO-DAT-001 | Run a pending migration in the Supabase SQL Editor before touching the related features. | data
PRO-DAT-002 | Bug report? Use the supabase-bug-hunt skill: read the report and the player's save, compare normal saves, reproduce, fix the code. | data
PRO-ENG-001 | After a match engine change: say so in the reply and patch notes, run the match tests and playtest before pushing. | engine,process,deploy,style
PRO-TEAM-001 | Push means merge Harry into main after tsc, both guards, the tests and npm run build pass, once the team reviewed the patch notes. | team,process,deploy
PRO-TEAM-002 | [SUPERSEDED] Patch notes order: stills on the page, push, publish; then film the gameplay clips; never hold the push for a video. | process,rule,deploy
PRO-TEAM-003 | Pictures as they come in: builders save each still at once, and the lead sends each new still to Harry with a caption. | process
PRO-TEAM-004 | Build approved changes straight onto the Harry branch; prototype first only for things Harry has to judge by eye. | team,process
PRO-TEAM-005 | Clear disk space before every new build: remove old agent worktrees, git worktree prune, delete old folders, check df -h. | process
PRO-TEAM-006 | Builders check light: ONE quick check per change (loads, no console errors, one still); Harry judges 3D on his phone. | three-d,process
PRO-TEAM-007 | Ship patch notes alone: node scripts/patch-notes/ship.mjs <versions> --pr makes a patch-notes-only PR to main; feature code waits for Harry's push. | process,deploy
PRO-TEAM-008 | Patch notes order: stills on the page, ship the notes with ship.mjs, publish; push the feature when Harry says; then film clips. | process,deploy
PRO-TEAM-009 | Before shipping a patch note, run scripts/patch-notes/squeeze-media.sh <version> (clips CRF 30, stills JPEG ~80%); the patch-notes folder must stay under Vercel's 250 MB route cap. | process,rule
REF-ALL-001 | Big documents and skills stay whole; each gets one reference note that links to the source. | brain
REF-KIB-001 | Script v01, patch notes 0.1 to 0.3: the first Knowitball short, word for word with its sources. | process,client-kib
RUL-3D-001 | Fully 3D games are the exception: own physics and rules in lib/star/play3d/, never importing canvasEngine.ts. | engine,three-d,rule
RUL-3D-002 | No Higgsfield use by any builder until Harry says otherwise (about 730 credits used on 20 Oct). | three-d
RUL-3D-003 | Delete every Higgsfield image, video and 3D model there once a round is done, keeping copies in the repo first. | three-d
RUL-3D-004 | [SUPERSEDED] Higgsfield is ON for now; always say what is being made there. | three-d
RUL-3D-005 | No body part may pass into another in any 3D clip or pose; measure it with the self-overlap check. | three-d,process
RUL-3D-006 | 3D sizes never change: every man, the keeper and the goal keep ONE fixed scale in every chance and frame. | three-d,rule
RUL-3D-007 | Every GLTFLoader must call withMeshopt(loader) or it fails on the packed GLB files. | three-d,rule
RUL-3D-008 | 3D games take shared basics (ball size, gravity, how skills scale a kick) from one shared file. | three-d
RUL-ALL-001 | One idea per note; every note has a permanent code that is never reused. | rule
RUL-ALL-002 | Neither Harry nor Mikey writes code: english only, no coder words. | team,style,rule
RUL-ALL-003 | Answer shape: key point, key number, key change; no preamble, no restating the request, no praise. | style,rule
RUL-ALL-004 | Write about 80% of the way to ASD-STE100: short sentences (20-25 words at most), active voice, no coder words. | style,rule
RUL-ALL-005 | Any stat, rate or rule with conditions gets a picture, but only where a picture is clearer than one plain line. | rule
RUL-ALL-006 | Every claim carries a number, or admits it has none; always give the before alongside the after. | style,rule
RUL-ALL-007 | Say whether you saw it, measured it, or reasoned it. | rule
RUL-ALL-008 | Show, don't describe, anything with a size or a shape: render the options at real phone size (show-options agent). | rule
RUL-ALL-009 | Play it before claiming it works: a type-check and a green suite cannot see a frozen figure; use star-playtest. | process,style,rule
RUL-ALL-010 | Ask about the one ambiguous word; build the rest, then ask one question that can be answered in a word. | style,rule
RUL-ALL-011 | When Harry points at a picture, name it back in one line (which picture you are copying) before building. | rule
RUL-ALL-012 | Do not agree to be agreeable: before agreeing with a design call, find what argues against it. | rule
RUL-DAT-001 | SQL for a person to run goes out as an artifact page (each file's name, one line on what it does, a Copy all button and the full text), never as links; build it with scripts/supabase/sql-page.py. | rule,data
RUL-DAT-002 | Every Supabase request Claude makes starts with a plain-English header in the SQL (READ ONLY or CHANGES THE DATABASE, What, Why) and the same lines in chat before the Allow box; changes wait for a yes. | process,data
RUL-ENG-001 | [SUPERSEDED] The match engine may change, with a warning: the engine-warn hook asks every time with a red notice. | engine
RUL-ENG-002 | Every screen except the real match mounts EnginePlay; a feature never gets its own loop. | engine,rule
RUL-ENG-003 | The one-engine guard runs inside npm run build and blocks every Vercel deploy on a new copy of the loop. | engine,deploy
RUL-ENG-004 | Never add to KNOWN_COPIES, raise CEILING, touch the canary or remove the guard unless asked in those words. | engine,rule
RUL-ENG-005 | The real match (app/star-dev/page.tsx) is the only screen that mounts CanvasMatch directly. | engine
RUL-ENG-006 | Shared mechanics, not a shared picture: a mode keeps the real ball and picks what is on the pitch with scene. | engine
RUL-ENG-007 | The match engine may change; the engine-warn hook warns Claude and never stops to ask the person (Mikey, 25 Oct 2026). | engine,team,rule
RUL-KIB-001 | Voice: short, cheeky, football-mad, numbers first ("9.8% to 47.6%"). | client-kib
RUL-KIB-002 | Real game footage only, or marked "ILLUSTRATION" on screen. | client-kib
RUL-KIB-003 | No real club badges or player photos in ads unless we have the right to use them. | client-kib
RUL-KIB-004 | Never claim a feature that is not live; every number comes from a patch note. | process,rule,style,client-kib
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
RUL-UI-001 | Decide, don't toggle: a new look or gameplay change is built as THE game, with no new New/Old row in Settings. | ui
RUL-UI-002 | Unfinished work lives on a test page (a /star-*-dev page), not behind a switch in the real game. | ui,admin
RUL-UI-003 | Existing switches stay until someone decides each one; never delete one unasked. | rule,ui
RUL-UI-004 | "Preview" (game version) is used only when someone asks for it in those words; otherwise a change goes straight into the game. | rule,ui
RUL-UI-005 | Harry's changes go straight into the game when he says push: no new New/Old row, no Preview entry. | deploy,ui
RUL-UI-006 | "No scroll wheel inside a screen: just show it and you scroll down; never add a scroll wheel unless Mikey specifically says." | team,rule,ui
