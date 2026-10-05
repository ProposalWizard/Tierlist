# Old UI — frozen backup. Do not restyle.

Settings → **UI: Old | New** (`lib/star/uiLook.ts`, saved per device, new
players get New). Harry, 1 Oct 2026: *"keep the old ui exactly how it is as a
backup … old ui is current and new ui is whatever we eventually land on"*.

- **Old UI** = the star career screens exactly as they were on branch `Harry`
  at commit `4f2e839` (1 Oct 2026). `LegacyStarDevPage.tsx` is that day's
  `app/star-dev/page.tsx`; every other file here is that day's copy of a
  screen that the New UI has since changed (or that imports one).
- **New UI** = `app/star-dev/page.tsx` + `components/star/` (v0.23, pitch look).
- **Shared by both**: the save, every rule in `lib/star`, the match
  (`CanvasMatch` / `EnginePlay` — `app/star-dev/page.tsx` hands the old page
  the real match as `Match`, so the one-engine guard still sees one mount),
  training drills (`TrainingMinigame`) and the trial (`TrialSequence`, stages).

What was changed in these copies, and only this (each marked in the code):
1. Imports point at the copies here (or the unchanged originals).
2. `Match` is passed in instead of mounting `<CanvasMatch>` here.
3. `oldStarScale.ts`: the rating is now 1-100 in lib/star; the old screens
   show it ÷10 (and Star Points ÷120), the exact conversion starPoints.ts uses
   for old saves, so they still read "★ 2.9".
4. `LeagueScreen.tsx` LADDER gains the two National League North/South rows
   (compile fix for the new divisions).
5. `SettingsScreen.tsx` gains the UI: Old | New switch — the way back.
6. `SettingsScreen.tsx`: Developer tools shown to admins only (security,
   5 Oct 2026 — every player could open the cheat menus).

Inside the shared match, `MatchCommentary` / `EnergyModeIcon` read the UI
setting to keep their pre-v0.23 colours and no kick-off card in Old UI, and
`GameFullScreen` keeps the site menu in Old UI.
