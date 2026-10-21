# Brain index (built by scripts/brain/build_index.py, do not hand-edit)
ID | summary | tags
FACT-3D-001 | Low tier (old Android, low PC) may run 3D at a steady 30 fps with the same picture. | three-d
FACT-ALL-001 | Claude searches cheapest first: code, then the index, then 1 to 3 notes, then the source. | brain
FACT-DAT-001 | star_tuning_notes.sql is PENDING: the table still does not exist live, so run this one again. | data
FACT-DAT-002 | star_xp_config.sql is PENDING, seen missing in the live database on 20 Oct 2026. | data
FACT-DAT-003 | star_casino.sql: DO NOT RUN; the casino stays on the phone with CASINO_ON_SERVER false. | economy,data
FACT-DAT-004 | Every other listed migration (draft, sofifa, security, star tables) is RUN, no action needed; full rows are in SESSION_LOG.md. | data
FACT-UI-001 | Settings keeps only real player preferences (sound, full screen, 3D quality, faces, names) and the Settings UI Old/New row. | three-d,ui
PRO-ENG-001 | After a match engine change: say so in the reply and patch notes, run the match tests and playtest before pushing. | engine,process,deploy,style
PRO-TEAM-001 | Push means merge Harry into main after tsc, both guards, the tests and npm run build pass, once the team reviewed the patch notes. | team,process,deploy
PRO-TEAM-002 | Patch notes order: stills on the page, push, publish; then film the gameplay clips; never hold the push for a video. | process,rule,deploy
REF-ALL-001 | Big documents and skills stay whole; each gets one reference note that links to the source. | brain
RUL-3D-001 | Fully 3D games are the exception: own physics and rules in lib/star/play3d/, never importing canvasEngine.ts. | engine,three-d,rule
RUL-3D-002 | No Higgsfield use by any builder until Harry says otherwise (about 730 credits used on 20 Oct). | three-d
RUL-3D-003 | Delete every Higgsfield image, video and 3D model there once a round is done, keeping copies in the repo first. | three-d
RUL-3D-004 | [SUPERSEDED] Higgsfield is ON for now; always say what is being made there. | three-d
RUL-3D-005 | No body part may pass into another in any 3D clip or pose; measure it with the self-overlap check. | three-d,process
RUL-3D-006 | 3D sizes never change: every man, the keeper and the goal keep ONE fixed scale in every chance and frame. | three-d,rule
RUL-3D-007 | Every GLTFLoader must call withMeshopt(loader) or it fails on the packed GLB files. | three-d,rule
RUL-ALL-001 | One idea per note; every note has a permanent code that is never reused. | rule
RUL-ENG-001 | The match engine may change, with a warning: the engine-warn hook asks every time with a red notice. | engine
RUL-ENG-002 | Every screen except the real match mounts EnginePlay; a feature never gets its own loop. | engine,rule
RUL-ENG-003 | The one-engine guard runs inside npm run build and blocks every Vercel deploy on a new copy of the loop. | engine,deploy
RUL-ENG-004 | Never add to KNOWN_COPIES, raise CEILING, touch the canary or remove the guard unless asked in those words. | engine,rule
RUL-TEAM-001 | Deploy only when told: commit and push to the Harry branch freely, merge to main only when Harry says push. | team,rule,deploy
RUL-TEAM-002 | Every deploy comes with patch notes; Harry decides each time whether to push now or see patch notes first. | process,deploy,team
RUL-TEAM-003 | Progress updates every 5 minutes on every task, with % and time left on every bar and the token/weekly usage block. | process,team
RUL-TEAM-004 | No forced new chats: after about 3 hours of chat, add one line that it could be a good time to restart. | process,team
RUL-TEAM-005 | Patch notes never link the Vercel test build; mostly stills, a short after clip only for gameplay and animation. | process,rule,team
RUL-TEAM-006 | Patch-note version keys must be unique: search the data file for the number on BOTH branches first. | team,rule
RUL-TEAM-007 | Jobs for the team go in team/jobs.json and arrive by push, never SQL. | team,rule,deploy
RUL-TEAM-008 | Branches are per-person: this session develops on Harry; never push to another person's branch. | team,rule,deploy
RUL-UI-001 | Decide, don't toggle: a new look or gameplay change is built as THE game, with no new New/Old row in Settings. | ui
RUL-UI-002 | Unfinished work lives on a test page (a /star-*-dev page), not behind a switch in the real game. | ui,admin
RUL-UI-003 | Existing switches stay until someone decides each one; never delete one unasked. | rule,ui
