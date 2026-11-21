# KIB Next career: the playtest-and-fix loop (21 Nov 2026)

One round was started and stopped part-way (Mikey moved playtesting to separate playtesters). Both apps were side by
side at 412×915 in one Chromium, the packed app drawn with Roboto (see README-situations.md, "The bench").
Every row below was MEASURED (the position, size, line height and font of each word, read from both pages),
not judged by eye. "px" = how far KIB Next's word sat from the packed app's.

## The one cause behind most rows

The packed app gives every word a line box (Tailwind: `text-[10px]` = 15 px line, `text-xs` 16, `text-sm` 20,
`text-base` 24, `text-lg`/`xl` 28, `text-2xl` 32, `text-3xl` 36, unless a `leading-*` says otherwise). KIB Next's
`<Text>` had no `lineHeight` on most words, so each line was 3 to 5 px shorter and a screen drifted 5 to 30 px
by its foot. The fix is always the same: give the word the packed line height (and its letter spacing). Also:
any bold word of 16 px or more is **Anton** in the packed app (`components/star/ui/flat.css` rule 1), not bold Roboto.
**Still to do on every career screen not listed as fixed here.**

## Round 1

| Screen | What | Sev | Status |
|---|---|---|---|
| New career: Who are you? | page side padding 12 (packed 14); header 4 px low; labels, boxes and the nationality row 9 to 21 px high (label line 11 not 15, box 43 not 44, row 43 not 48.5); title 21 px (packed 20); tag letter spacing 1.6 (packed 1); Back/Continue 45 tall (packed 48) and 3 px low | MED | FIXED (measured after: every word within 4 px) |
| New career: Who are you? | the ✓ is bold Roboto (packed: Anton 18) | LOW | FIXED (reasoned: changed after the last build) |
| New career: Your style | every row 9 to 31 px high (same cause); ✓ − + bold Roboto (packed: Anton); tiles #1f2a40 (packed #1c2a42); label gaps 6/16 | MED | FIXED (measured after: no difference left) |
| New career: Your photo | "Add a photo"/"Take a photo" 11 px words, 31 tall, radius 8 (packed 12 px, 34 tall, radius 12, three-stop green); an extra line "Your photo stays on this phone…" the packed app does not have; rows 9 to 12 px high | MED | FIXED (measured after; "Or pick a face" still 5 px high). The extra line now shows only when the picker reports a problem |
| New career: step line | "Step 1 of 2" 3 px higher than packed (103 v 106) | LOW | OPEN (inside tolerance) |
| New career: Continue / Start Career colour | packed: flat #10b981; KIB: gradient #34d399→#10b981 with a glow. Back: packed `bg-gray-700` as the look re-colours it; not measured | LOW | OPEN: not verified (the packed button was read while hovered) |
| Scout's talk | pill, club name, league line, card words 5 to 16 px high (line heights); league line letter spacing 1.6 (packed 1.1); "'S SCOUT"/"TAP TO HEAR" spacing 1.5 (packed 1) | MED | FIXED (measured after: no position difference) |
| Scout's talk: club name colour | packed: white→70 % white gradient in the letters; KIB: flat #b4b9c1 | LOW | OPEN (React Native has no gradient text; looks close) |
| Scout's talk: ⚙ | packed glyph 20 wide, KIB 14 (emoji font) | LOW | OPEN: needs the phone (Android's own glyph) |
| The offer card | ★35 bold Roboto (packed: Anton 30, " a week" Anton 14); words 5 to 10 px low; button words spacing 1.5 (packed 1.2), button 38 tall (packed 42) | MED | FIXED: button and paragraph measured after; the price line was 7 px tall in the browser, held to 32 (reasoned, after the last build) |
| Signing | packed: the 3D office scene with the manager's lines; KIB: the drawn paper | — | LEFT OUT (Mikey: no 3D office). Header "SIGNING FOR…" sits at 16,27 in #fcd34d; packed 12,20 in #fbbf24 | 
| Signing header | as above: 4 px right, 7 px low, lighter amber | LOW | OPEN |
| Trial stage scoreboard [border: MATCH, `MatchStages.tsx`] | top strip 35 tall (packed 31 + 8 gap = 39), card 67 (packed 70.3): everything 4 to 7 px high; "0/1" 26 px (packed 24/24 Anton); title line 10 (packed 13.5); EXIT line 11 (packed 15), spacing 0.4 (packed 0.25); "1/5" spacing 1.5 (packed 1) | LOW | OPEN: match loop's file |

## Not reached this round (still to playtest)

Signing after the paper, Breaking News (stripes, TAP TO CONTINUE), first Home and every tour and story beat,
Training, Stats tabs, energy/rest, injuries, every prepared save in README-situations.md, the "reasoned only"
states of CAREER.md, long names and big numbers, 360×780 and 360×640, title parallax, share picture.
