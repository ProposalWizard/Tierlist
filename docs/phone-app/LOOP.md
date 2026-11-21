# KIB Next: the finish loop (Mikey, 21 Nov 2026)

Mikey's instruction: keep working without his input until nothing more can be done.

1. Finish running builders (match round 3, career missing pieces, world missing pieces). Merge each, run
   `scratchpad/checks-main.sh` + `npx tsx phone/tools/match-popin.ts 10`, push.
2. Build a test APK after each merged batch (prebuild + gradle, see PLAN.md) and send it to Mikey with a
   short "check on your phone" list. Never merge while a build runs in the main checkout.
3. Re-check the three lists (`phone/tools/playtest/inventory/{MATCH,CAREER,WORLD}.md`): every row SAME,
   FIXED or LEFT OUT (Mikey). Open rows go to the next builders.
4. Full playtest of both apps side by side (packed vs KIB Next), every screen and a whole season, with
   dense frames for motion. Fix everything found straight away, then playtest again. Repeat until a
   playtest finds nothing that can be fixed here.
5. Limits: if the model hits a limit, switch builders to Opus 5.5 (`model: "opus"`). On a 5-hour limit,
   resume paused builders with SendMessage as soon as usage is back (a send_later check-in is armed).
6. Only Mikey's phone can confirm: font size, camera hole, hidden bars, buzz, music, photo, 3D, speed.
Rules: edit only `phone/**`; website match file untouched; no casino; no patch notes or merge to main
unless Mikey asks; branch `claude/eloquent-bohr-6veqfh` only.
