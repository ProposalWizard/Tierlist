# PL Draft UI lookover (19 Oct 2026, 390x844, signed out)

Stills are in this folder. Review only, no code changed.
Console errors seen: a 404 on every page (one missing file, not named) and a 500 from /api/objectives on the draft (needs the service key; likely local only).

Bar: the Play Area. The draft setup and pre-season screens are close to it. The season sim, the squad and the side screens are not.

Not reached (said plainly):
- Multiplayer lobby: Create Room and Join are locked behind sign-in (01-draft-start-full.png).
- History and Hall of Fame: only the sign-in wall shows (20, 21).
- Season 2, sell and signing screens, cup finals, the American draft: both of my full runs ended relegated, which ends the game ("Sacked"). Cup rounds only show as a summary after the season.
- A real match is never shown live. The sim is a list of results.

## /draft start (01-draft-start.png, 01-draft-start-full.png, page height 1725)
Verdict: good.
- Hero, era range, mode toggles and Start Draft button are tidy, with big tap targets (52-56px). Matches the Play Area bar.
- The orange "Objectives NEW" pop-up sits on top of the Sign in button and the menu button in the header. QUICK. (01-draft-start.png)
- "History & Achievements" and "Hall of Fame" are greyed with a lock and unreadable text. Looks broken, not locked. QUICK.
- The "How to Play" pill is only 30px tall. QUICK.
- Four settings blocks (era, mode, order, visibility, re-spins) make the page 2 screens long. Fine, but the Start Draft button is below the first screen. DESIGN (optional).
- Site header + tab strip takes 100px above the game on every draft screen. The "Road to Ballon d'Or" tab is cut off at the right edge. QUICK.

## Formation pick (02-after-start.png, 02-after-start-full.png, height 1405)
Verdict: good.
- Mini pitches with coloured dots are clear. 4-3-3 is highlighted with a star.
- 5-3-2 sits alone in the last row, leaving an empty half row. QUICK.
- Start Draft button is below the fold; you scroll past all seven formations. QUICK (sticky button).

## Draft: spin screen (03-draft-first.png, 04-spinning.png, height 1137)
Verdict: tidy-up.
- Big green Spin button is good. Pick progress bar is nice.
- Empty pitch with grey slot circles looks flat and dull next to the Play Area. DESIGN.
- The header (back arrow, PL DRAFT, PICK 1/14) is fine but "0/14" and "1/14" show two counters that say nearly the same thing. QUICK.
- A small edge tab sits on the left at the pitch level on every screen. QUICK to check whether it is meant to be there.

## Draft: club roster list (05-spin-result-full.png, 07-roster-mid-draft-full.png, height 1155-1754)
Verdict: tidy-up.
- The player list is a small box that scrolls inside the page, cut off mid-row (the 7th row is sliced). Two scroll areas in one page is awkward on a phone. DESIGN.
- Older seasons (Stoke 2010/11) show empty grey circles instead of faces. Newer seasons (Wolves 2024/25) show faces. Looks broken in the old ones. DESIGN (silhouette or fake face, as the career game does).
- Rows are 72px, readable. Position tags are small and tightly packed (4 on one row, e.g. Matheus Cunha). QUICK.
- Brief "Loading roster..." spinner leaves a big empty gap and moves the pitch down. QUICK.

## Draft: choose a slot (06-player-picked.png, 08-assign-slot-mid.png)
Verdict: good.
- Natural-fit slots are green and clear. Big targets (54-73px). Bench option is clear.
- The pitch is below the fold on this screen, so you cannot see where the slot sits while choosing. QUICK/DESIGN.
- "Back to roster" is a small centred button and looks different from the other buttons. QUICK.

## Draft: pitch mid-draft (09-draft-pick8.png)
Verdict: tidy-up.
- Real faces and ratings on the pitch look good.
- The pitch is cut by the fold; the GK and bench are off screen. QUICK.
- The tiny yellow tip line above the pitch ("Tap two players to swap...") is hard to read. QUICK.
- Empty slots (LW, RW, ST) are plain grey circles. DESIGN.

## Arrange your squad / pre-season (10-after-draft-full.png, 301/401-season-step0, height 1787)
Verdict: good.
- Closest to the Play Area bar: clear pitch with faces, orange dots on players, bench cards, a "1000 reporters predicted" card with big numbers.
- Orange dots on players have no explanation. QUICK (hover/legend).
- "0.5x / 1x / 1.5x" sim speed buttons are only 24px tall. QUICK.
- Pitch card, bench and prediction card are three separate boxes with different edge glows. QUICK.
- Prediction card is a wall of numbers (4 big tiles + 6 rows + 3 bars). DESIGN (hide most behind a toggle, per the house style).

## Season sim: matchweek (402-season-step1.png and -full, height 2137)
Verdict: needs redesign.
- It is a plain list of text results and a table. No match is shown, only scores. It feels like a spreadsheet next to the Play Area. DESIGN.
- No club crests anywhere in the table or results. Names only. DESIGN (use the badges the career game has).
- "Skip all →" is 32px tall and plain text, the main control on the page. QUICK.
- The squad stats block (14 rows) sits under the table and makes the page 2.5 screens long. QUICK/DESIGN.
- Cup ties show inside the results list with no heading, so FA Cup and League Cup rounds are easy to miss. DESIGN.

## Season end: final table and results (303-season-step2-full.png, 422-season-step21-full.png, height 3771)
Verdict: tidy-up.
- The RELEGATED banner, awards and competition winners are clear and readable. Good colour use.
- Page is about 4.5 screens long. Table, form, cups, squad stats, awards, winners all stacked. DESIGN (tabs or steps).
- Club names are cut off in the table: "Bournemo...", "Crystal Pal...", "KNOWITB...". QUICK.
- "Final league table", "Match results" are collapsed bars (50px) that look like buttons but behave as folds; the arrows are tiny. QUICK.
- Form row is rows of tiny L/W/D squares (about 14px). Hard to read. QUICK.
- Share and New Draft buttons are at the very bottom, after all the content. QUICK (sticky bar).
- Relegation ends the game ("Sacked") with no way to continue. Dead end after a bad draft. DESIGN (flagged for Harry; not a layout bug).

## /draft/history (20-history.png, height 844)
Verdict: tidy-up (signed out only).
- Only a lock card with a Sign in button. Fine, but about half the screen is empty. QUICK.
- "Back to Draft" is a 38px bordered button here, but a plain 20px link on /draft/records. Inconsistent. QUICK.
- Could not see the real history or achievements without sign-in.

## /draft/records (21-records.png, height 1137)
Verdict: tidy-up (signed out only).
- Same lock card. A different title style and a different back link from History. QUICK.
- Over half the screen is empty. QUICK.
- Could not see the Hall of Fame leaderboard.

## /draft/preview (22-preview.png, 23-preview-xi.png, heights 1711 and 1275)
Verdict: needs redesign (it is a design preview with sample data).
- League table: club names are cut to one or two letters ("M.", "Ma...", "Liv...", "Kn..."). The columns leave no room for names. DESIGN/QUICK.
- A floating chat bubble covers the rank-8 row, and a floating eye button covers the table edge. QUICK.
- Starting XI: the pitch is cut off at the bottom (the GK is sliced). Player labels overlap (Gerrard over Cavalieri, Mee/Rice). QUICK.
- Players show a letter in a circle instead of a face. DESIGN.
- The orange "Design Preview" banner is fine. Tab buttons are 36px. QUICK.

## Multiplayer lobby
Blocked by sign-in. Only the locked "Create Room" and "Join" panel is visible (01-draft-start-full.png): the lock text is green on dark and small. QUICK.

## Cross-screen
- A floating chat button and the left edge tab appear on every page and overlap content (see /draft/preview). QUICK.
- Fonts and colours are consistent across the draft (dark navy, green and cyan accents). Good.
- Several bottom-of-page blocks (feedback form, footer) repeat on every screen and add 160px before the end. QUICK.
