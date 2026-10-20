# Handoff: Harry's answers → ten builds (19 Oct 2026)

## For
Harry's next chats, one build each (B1, B2, …).

## The goal in one line
Build what Harry answered on the round patch notes, one build per chat. The full answers
(with his words) and the build list are in `docs/plans/2026-10-19/harry-answers-round.md`.
Read the part for your build before starting.

## Where it stands
| | What | State |
|---|---|---|
| ✓ | Admin split by game, side tabs, scene editor 3a, drift fixes, buttons on screen, FHR phases 0–2, free data, Real moments/shots/Goals rebuilt | on `Harry`, NOT live (P-1 unanswered) |
| ✓ | Phone admin tidy (first box 430 → 223 px) | on `Harry`, seen at phone size in a browser |
| ✓ | Engine/drift warning now ASKS in red, covers drift files | on `Harry` (`scripts/hooks/engine-warn.mjs`) |
| ✓ | Touch check of every screen: 27 found, 0 stop a finger in the game | report in the patch notes, section 7 |
| ✗ | B1–B10 | not started |

## Decisions already made
All in `docs/plans/2026-10-19/harry-answers-round.md`, with quotes. The big ones:
- FHR phase 3: GO. The switch goes in Settings and the pre-match settings, with a "?" rundown, visible to everyone.
- Mikey's hand-checked scenario gallery must never be overwritten by generated build-ups.
- Every admin look = the same layout, only a different skin.
- 3D phases 1–5: go. Skin and light are "very big". Higgsfield is ON: say what you make, then delete it after.
- Lower League Trophy: penalties in early rounds, extra time from the quarter-finals; top 8 of League One get byes; midweeks.
- Headers and volleys come back, with the air-ball shadow signal.

## Open questions
- **P-1 push to live?** Unanswered. Recommended: yes. It's all behind switches, test pages or admin.
- **Harry's answer "1. 3D scene editor."** Unclear which question it answers. Ask in one line.
- **A-1** (two headings or one list on group pages): pictures are now in the patch notes. Recommended: keep two.
- **FHR-2** (22-player model): re-ask after phase 3.

## Next steps (one chat each, in this order)
1. **B1** Touch fixes (all 27, list in patch notes §7) + old failing tests (keeperPro, keeperBrain, chanceJudge) + Player of the Month photos + `tests/star/wembley3d.mts` (fix or remove). Stills of each.
2. **B2** FHR: the switch in Settings and pre-match with "?"; build-ups in Infinite Highlights/Match; phase 3; extra defender from off screen; the foul before some set pieces. The gallery stays untouched.
3. **B3** Free data: more tracking matches, drop Afriskaut, credits in Settings, a "Real moment highlights" toggle (plan how it's tracked and edited).
4. **B4** Admin: one layout for every look; back arrow top left everywhere; chat bubble bottom left that lets taps through to what's under it; a Research area.
5. **B5** 3D phases 1–5 + home player alive (blinks, looks around, lips, holds things) + the 90th-minute winner → celebration → trophy cut scene.
6. **B6** Scene editor 3b + Approve + Commit to game; Scene generator page in the Studio tab; decide when generated scenes play; the last 6 admin pages.
7. **B7** Training drills editable like the gallery; harder final levels (vision first).
8. **B8** Five-a-side test area with tabs: Scenarios, Data, Full match + radar.
9. **B9** Lower League Trophy + hold to speed up / double-tap to skip post-match.
10. **B10** Headers and volleys back + the air-ball signal; the flair/bicycle-kick idea as a plan first.

B1, B4 and B9 touch different files and can run side by side. B2, B5 and B10 all touch the match, so run them one at a time.

## Where things are
- Branch `Harry`. Patch notes (all questions and stills): https://claude.ai/artifact/1gVoLFwG57QCn7xiU8Tudk
- 3D audit + plan: https://claude.ai/artifact/Gx6YJ9jdDbs7j9cfEfjS5S · FM research: https://claude.ai/artifact/Ry521jLp2vKoSLnkJfZrgS
- Drift audit: `docs/handoffs/2026-10-19-ui-lookover/drift-audit.md` · cut scenes: `lib/star/cutscene/README.md`
- FHR: `lib/star/fhr/`, test page `/star-fhr-dev` · free data: `data/opendata/`, `data/realmoments/`

## Watch out for
- The red engine/drift warning now asks on every engine or drift file. Only allow it when the build needs it (B2, B10), and re-measure the drift table after.
- Header/volley chances are switched off in `lib/star/switchedOffKinds.ts`. B10 turns them back on.
- The scene editor saves to the device and `star_cutscene_edits`, NOT the repo. B6 adds "Commit to game".
- `star_tuning_notes.sql`, `star_wallet.sql`, `star_save_guard.sql` are still PENDING (see CLAUDE.md).

## Still running
Nothing.
