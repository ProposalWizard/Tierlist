# Handoff — the admin room, team board and screen recorder (18 Oct 2026)

## For
Harry's next chat.

## The goal in one line
One admin room for everything: admin home, team board, patch notes tab, admin mode, one lock,
and "add the recording to the admin as in a screen recorded" (Harry, 18 Oct).

## Where it stands
| Item | State |
|---|---|
| Admin home, side menu, admin mode, one lock (DevGate) | ✓ on main (seen in a headless browser) |
| Team board, design B "Ops room" | ✓ on main (seen at phone and desktop size) |
| Patch notes tab + v0.57 notes | ✓ on main; artifact https://claude.ai/artifact/SdmpakSaerhCuwYrUT2PCV |
| Screen recorder (Admin → Videos) | ✓ on main; records and downloads (seen with fake camera) |
| Recorder → Google Drive upload | ½ Harry made a Google project in his personal account and added `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Config, Production) on 19 Oct; redeploy + test not confirmed |
| Live bars, no password | ✓ live on main 19 Oct (live site answers "person must be Harry, Mikey or Leo") |
| Live bars showing | ✗ Mikey: run `dev_status.sql`; each of us: `DEV_NAME=<name>` in the cloud environment; Mikey/Leo merge main |
| Harry's 17 old pages deleted | ✓ on main |

## Decisions already made
- No password for live bars (Harry, 19 Oct: "id rather no passwords"). Guards: 3 names, 1/min, 6,000 chars, 50 rows each.
- Recorder's Google project is in Harry's personal account; videos go to his personal Drive.
- Team board look = design B, the Ops room picture (Harry, 18 Oct).
- Recordings save to the recorder's own Drive, folder "Knowitball screen recordings" (Harry, 18 Oct: "Your Drive").
- Deploy to main only when Harry says. He said "push all to main" (18 Oct).

## Open questions
1. Google Drive id — Harry: "I'll come back to the google drive link". Recommended: make a
   Google Cloud OAuth web client (Drive API on, origin https://knowitball.co.uk), put its id in
   Vercel as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, redeploy. Steps are on the v0.57 page, Known issues.
2. Match Dev controls — port them into Infinite Highlights? Recommended yes (the page was deleted).
3. Draft Hero setup — on the v0.57 "Your calls" list, not decided.

## Next steps
1. Recorder: check the redeploy is Ready, then Admin → Videos → Connect Drive (personal account, "unverified app" → Continue), record 10 s, check "Knowitball screen recordings" in Drive. Steps with drawings: https://claude.ai/artifact/TipLShS2XFsd1STAMNF3uY
2. Ask Mikey to run `dev_status.sql`; each of us adds `DEV_NAME`; check the bars move. Steps: https://claude.ai/artifact/53rj1cUZ1aKsu4uaEVbQcC
3. Trim CLAUDE.md (it is long and loads every chat).

## Where things are
- Branches: `Harry`, `claude/admin-overview-patchnotes-1m8svc`, `main` (all at 1411a23 + this handoff).
- Recorder: `lib/recording.ts`, `app/admin/videos/VideosTab.tsx`, test `tests/star/recording.mts`.
- Team board: `app/admin/team/TeamBoard.tsx`, `teamBoard.css`. Menu list: `lib/adminRegistry.ts`.
- Patch notes: `patch-notes/pages/0.57/`, `lib/patchNotesData.ts`, `lib/patchNotePages.ts`.
- Microphone/screen allowed in `next.config.mjs` (Permissions-Policy).

## Watch out for
- Vercel trap: pushing ONE commit to a branch and main at the same time made only a Preview
  build. Push to main on its own first, then the branches.
- 7 test suites fail on main before this build too (chanceJudge, chanceMaker, keeperBrain,
  keeperPro, longRangeRules, match2dCam, wembley3d). Not ours.
- New page under /star-*-dev: add it to `lib/adminRegistry.ts` and use `<DevGate>` in its layout.

## Still running
Nothing.
