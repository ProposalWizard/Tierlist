# Pilot notes (21 Oct 2026): the notes the 10 pilot questions need.
C = "CLAUDE.md"
A = "docs/plans/2026-10-19/harry-answers-round.md"
NOTES = [
    # Q1 when can we push live
    dict(id="RUL-TEAM-001", type="ruling", client="team", file=C, anchor="**Deploy only when told", n=11,
         summary="Deploy only when told: commit and push to the Harry branch freely, merge to main only when Harry says push."),
    dict(id="RUL-TEAM-002", type="ruling", client="team", file=C, anchor="**Deploy only when told", n=11,
         summary="Every deploy comes with patch notes; Harry decides each time whether to push now or see patch notes first."),
    dict(id="PRO-TEAM-001", type="process", client="team", file=A, anchor="we can push everything once the team reviews", n=1,
         summary="Push means merge Harry into main after tsc, both guards, the tests and npm run build pass, once the team reviewed the patch notes."),
    # Q2 toggles
    dict(id="RUL-UI-001", type="ruling", client="ui", file=C, anchor="**Decide, don't toggle", n=9,
         summary="Decide, don't toggle: a new look or gameplay change is built as THE game, with no new New/Old row in Settings."),
    dict(id="FACT-UI-001", type="fact", client="ui", file=C, anchor="**Decide, don't toggle", n=9,
         summary="Settings keeps only real player preferences (sound, full screen, 3D quality, faces, names) and the Settings UI Old/New row."),
    dict(id="RUL-UI-002", type="ruling", client="ui", file=C, anchor="**No more version toggles for new work", n=13,
         summary="Unfinished work lives on a test page (a /star-*-dev page), not behind a switch in the real game."),
    dict(id="RUL-UI-003", type="ruling", client="ui", file=C, anchor="- Existing switches stay until someone decides", n=1,
         summary="Existing switches stay until someone decides each one; never delete one unasked."),
    # Q3 migrations
    dict(id="FACT-DAT-001", type="fact", client="dat", file=C, anchor="| `star_tuning_notes.sql`", n=1,
         summary="star_tuning_notes.sql is PENDING: the table still does not exist live, so run this one again."),
    dict(id="FACT-DAT-002", type="fact", client="dat", file=C, anchor="| `star_xp_config.sql`", n=1,
         summary="star_xp_config.sql is PENDING, seen missing in the live database on 20 Oct 2026."),
    dict(id="FACT-DAT-003", type="fact", client="dat", file=C, anchor="| `star_casino.sql`", n=1,
         summary="star_casino.sql: DO NOT RUN; the casino stays on the phone with CASINO_ON_SERVER false."),
    dict(id="FACT-DAT-004", type="fact", client="dat", file=C, anchor="**RUN** (no action)", n=1,
         summary="Every other listed migration (draft, sofifa, security, star tables) is RUN, no action needed; full rows are in SESSION_LOG.md."),
    # Q4 engine changes
    dict(id="RUL-ENG-001", type="ruling", client="eng", file=C, anchor="**The match engine may change, with a warning", n=9,
         summary="The match engine may change, with a warning: the engine-warn hook asks every time with a red notice."),
    dict(id="PRO-ENG-001", type="process", client="eng", file=C, anchor="**The match engine may change, with a warning", n=9,
         summary="After a match engine change: say so in the reply and patch notes, run the match tests and playtest before pushing."),
    # Q5 own copy of the match
    dict(id="RUL-ENG-002", type="ruling", client="eng", file=C, anchor="- **Everything else mounts `EnginePlay`**", n=4,
         summary="Every screen except the real match mounts EnginePlay; a feature never gets its own loop."),
    dict(id="RUL-ENG-003", type="ruling", client="eng", file=C, anchor="- **`scripts/one-engine-guard.mjs` runs inside", n=8,
         summary="The one-engine guard runs inside npm run build and blocks every Vercel deploy on a new copy of the loop."),
    dict(id="RUL-ENG-004", type="ruling", client="eng", file=C, anchor="- **Never** add to `KNOWN_COPIES`", n=3,
         summary="Never add to KNOWN_COPIES, raise CEILING, touch the canary or remove the guard unless asked in those words."),
    dict(id="RUL-3D-001", type="ruling", client="3d", file=C, anchor="**3D games are the exception", n=10,
         summary="Fully 3D games are the exception: own physics and rules in lib/star/play3d/, never importing canvasEngine.ts."),
    # Q6 Higgsfield
    dict(id="RUL-3D-004", type="ruling", client="3d", file=A, anchor="- **3D-6 Higgsfield:**", n=1, status="superseded",
         superseded_by="RUL-3D-002",
         summary="Higgsfield is ON for now; always say what is being made there."),
    dict(id="RUL-3D-002", type="ruling", client="3d", file=A, anchor='- 18:25: "jesus that was alot of credits', n=1,
         supersedes="RUL-3D-004",
         summary="No Higgsfield use by any builder until Harry says otherwise (about 730 credits used on 20 Oct)."),
    dict(id="RUL-3D-003", type="ruling", client="3d", file=A, anchor='- 17:44: "Delete all higgsfield', n=1,
         summary="Delete every Higgsfield image, video and 3D model there once a round is done, keeping copies in the repo first."),
    # Q7 progress and chat length
    dict(id="RUL-TEAM-003", type="ruling", client="team", file=C, anchor="**Progress updates follow", n=5,
         summary="Progress updates every 5 minutes on every task, with % and time left on every bar and the token/weekly usage block."),
    dict(id="RUL-TEAM-004", type="ruling", client="team", file=C, anchor="**No forced new chats", n=6,
         summary="No forced new chats: after about 3 hours of chat, add one line that it could be a good time to restart."),
    # Q8 patch notes
    dict(id="RUL-TEAM-005", type="ruling", client="team", file=C, anchor="**No test build link on patch notes", n=5,
         summary="Patch notes never link the Vercel test build; mostly stills, a short after clip only for gameplay and animation."),
    dict(id="PRO-TEAM-002", type="process", client="team", file=C, anchor="**Stills for looks, videos only for gameplay", n=7,
         summary="Patch notes order: stills on the page, push, publish; then film the gameplay clips; never hold the push for a video."),
    dict(id="RUL-TEAM-006", type="ruling", client="team", file=C, anchor="## Patch-note version keys must be unique", n=7,
         summary="Patch-note version keys must be unique: search the data file for the number on BOTH branches first."),
    # Q9 jobs for Mikey/Leo
    dict(id="RUL-TEAM-007", type="ruling", client="team", file=C, anchor="**Jobs for the team go in team/jobs.json", n=1,
         summary="Jobs for the team go in team/jobs.json and arrive by push, never SQL."),
    dict(id="RUL-TEAM-008", type="ruling", client="team", file=C, anchor="- **Branches are per-person", n=2,
         summary="Branches are per-person: this session develops on Harry; never push to another person's branch."),
    # Q10 3D bodies
    dict(id="RUL-3D-005", type="ruling", client="3d", file=C, anchor="**No body part inside another", n=1,
         summary="No body part may pass into another in any 3D clip or pose; measure it with the self-overlap check."),
    dict(id="RUL-3D-006", type="ruling", client="3d", file=C, anchor="**3D sizes never change", n=4,
         summary="3D sizes never change: every man, the keeper and the goal keep ONE fixed scale in every chance and frame."),
    dict(id="RUL-3D-007", type="ruling", client="3d", file=C, anchor="**Every GLTFLoader must call", n=1,
         summary="Every GLTFLoader must call withMeshopt(loader) or it fails on the packed GLB files."),
    dict(id="FACT-3D-001", type="fact", client="3d", file=A, anchor='- 15:40: "less frames is okay"', n=1,
         summary="Low tier (old Android, low PC) may run 3D at a steady 30 fps with the same picture."),
]
