# Admin audit after B20 (21 Oct 2026)

Question (Harry): "have ALL admin pages been updated with any updates needed also?"
Method: read each page's imports (does it reach `matchView` / `EnginePlay` / `fhr` builders?) and every `lib/adminGuides.ts` entry for stale text. Seen = looked at a 390x844 still. Not every page was opened.

Why the match pages follow on their own: player size (`NEW_FIGURE_SCALE`, `NEW_OUTFIELD_SHRINK` in `matchView.ts`) and the short build-ups (`fhr/builders.ts`) have one set of numbers. Every page that plays a chance goes through `EnginePlay` or `fhr/stillCamera.ts`, so none needed code changes.

| Page | Up to date? | Fixed / still needs work |
|---|---|---|
| /star-highlights-dev (Infinite Highlights) | Yes. SEEN: men about 40 px tall at 390 wide (`highlights-390.png`) | Guide said "4-8 s build-up": fixed (about 5 s, 6.5 at big moments, Length: Long = whole move) |
| /star-gallery-dev (gallery) | Yes. SEEN: bigger men in the card grid (`gallery-card-390.png`; thumbnails are half-size copies of the same picture) | Guide has no size or build-up numbers: nothing to change |
| /star-play-dev (Play Area), /star-pc-match-dev | Yes (EnginePlay / CanvasMatch) | Guide text checked: fine |
| /star-fhr-dev (FHR test page, off the admin list) | Yes (reads fhr builders and stillCamera) | Guide said "generated 4-8 second build-up": fixed |
| /star-sim90-dev, /star-radar-dev | Yes. Radar is a top-down map (no man size). Corner rule is only in the career sim, not here | "Match flow Old/New" wording is still right (the Match flow test option still exists, `gameplayVersion.ts`). "Real world" panel text current. Nothing changed |
| /star-real-moments-dev, -real-shots-dev, -real-goals-dev | Yes (EnginePlay paths) | Real-goals "up to 14 s" build-up is its own replay of a real move, not the generated one: left. Credits line (Settings > Data credits) still current |
| /star-fiveaside-dev | Not affected: FiveASide.tsx is one of the known copies (FACT-ENG-003), uses no matchView sizes | Still needs work: port to EnginePlay (already on the Brain list) |
| /star-3d-bench-dev | Yes. B20 changed X-Frame-Options to SAMEORIGIN so its preview frame draws | Guide checked; "deleted Art styles page" is accurate history, kept |
| /star-3d-area-dev (+ signing, office), /star-scene-editor-dev, /admin/scene-generator | Yes. Cut scenes read `lib/star/cutscene/sceneList.ts` (7 hand-made + kept); guide names the same list | No "Art styles" text left in any guide, registry or menu |
| /star-garden3d-dev, -shop3d-dev, -home3d-dev, -training3d-dev, -anim3d-dev, -animations-dev, -people-dev | Not touched by B20 | Not opened |
| /admin/patch-notes + bell (Inbox) | Yes. Guide already covers the Inbox, @, quotes | Fixed one line: new notes now go to main by `ship.mjs` pull request, not "after the next deploy". 0.103h shipped (PR 749) |
| /admin/team, /admin (home) | Yes. Inbox lines present | Not changed |
| /admin/clubs, badges, custom-clubs, star-xp, star-pass, xp, football/*, sound-board, research, videos, testers, app-plan, motion-refs, star (home) | Not touched by B20 | Not opened; their guides have no size/build-up/DENY text (searched) |
| /star-retirement-dev, -intl-dev, -goal-clips-dev, -relgames-dev, -tournament-dev, -training-dev, -wallet-dev, -store-dev, -update-dev, -sprites-dev, -sound-lab-dev, -vfx-lab-dev, -dribble*-dev, -tuning-dev, /lineups, /squad-builder, /draft*, /star-dev/media-lab | Not touched by B20 | Not opened |
| Brain / skills changes | No admin page shows the Brain | Nothing to update |

Searches over `lib/adminGuides.ts` for "Art styles", "DENY", "X-Frame", old size numbers, "4-8 s": only the two build-up lines above and one patch-notes line were stale; all three fixed.

## Still needs work
- One dev-only `SyntaxError: Invalid or unexpected token` page error showed on /star-gallery-dev on the dev server (page still worked). Not investigated.
- Pages marked "Not opened" were judged by their imports and guide text only, not by eye.
- The gallery's card grid shows thumbnails at half size, so men look smaller there than in Infinite Highlights; same picture, scaled.

Checks: `tsc --noEmit` clean; one-engine guard clean; admin-look guard 45/45; `run-star-tests.mjs -j 2 admin` 1/1 pass.
Stills: `highlights-390.png`, `highlights-0-390.png`, `gallery-390.png`, `gallery-types-390.png`, `gallery-card-390.png`.
