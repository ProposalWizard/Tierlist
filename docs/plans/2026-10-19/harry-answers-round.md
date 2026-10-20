# Harry's answers to the round questions (19 Oct 2026, evening)

Source: patch notes https://claude.ai/artifact/1gVoLFwG57QCn7xiU8Tudk
(question ids are that page's). Harry's words in quotes. Each line ends with
the BUILD it belongs to (list at the bottom).

## Admin
- **A-1:** keep the two headings (Admin tools, Test pages). Harry, 20 Oct.
- **A-2 Bento → redo ALL looks:** "Redo all of the other looks … they need to all look the same … They can't just click Clean light and suddenly I'm on a different admin page with a different layout." Every admin look = the SAME layout (Broadcast's), only a different skin (colours, type, corners). → B4
- **A-3 chat bubble:** fixed bottom left is fine "as long as, if it is covering something, I can still press it" (the thing underneath must stay pressable). Check every page on mobile. → B4
- **A-4 back arrow:** "Always top left … always the same", on every admin/test page. → B4
- **A-5 training levels two taps:** keep. NEW: training levels can't be edited like the scenario gallery. Add editing of the training drills (in the training area or the gallery). "The final training of, say, vision isn't hard enough." → B7
- **A-8 last 6 admin pages:** with the scene editor work. → B6
- **A-9 phone group boxes:** three per row stays. "Looks a lot better with the key button staying on screen."

## Play screens
- **Drift guard (answer 9):** make the engine/drift warning impossible to miss. DONE 19 Oct: `scripts/hooks/engine-warn.mjs` now ASKS with a red "THIS IS A MATCH ENGINE CHANGE / SOMETHING MAY DRIFT" notice in the Allow box, and covers the drift files too (CanvasMatch, EnginePlay, ScenarioPlay, InfiniteMatch, hiddenMatch, engineProfile, playArea, scenePicture, matchView).
- **T-1 touch pass:** fix everything the check found, show stills. → B1
- **A-7 five-a-side:** bring it back as its own TEST AREA with tabs: Scenarios, Data, Full match + match radar. "Give things tabs. I think tabs are the way to go. Even in the scenario gallery, whatever tab is useful for that mode." → B8

## Full highlights rebuild (FHR)
- **The switch (answer 12):** no own admin page and no "ruler" card in the Chances row. It is just a toggle: Settings in game AND the settings before a match. A small "?" next to it with a plain rundown of everything it turns on and what each is trying. Show it to EVERYONE for now (P-2 answer, answer 18). The ruler can live in a test area with tabs if useful. → B2
- **Build-up in the test areas (answer 13):** Infinite Highlights and Infinite Match must play build-ups. Prefer automatic and natural, with some adjusting. Wanted: in a final, a longer build-up in the 90th minute; a 90th-minute winner keeps going — you wheel off, celebrate, a celebration cut scene, then the trophy lift. → B2 (build-ups in test areas), B5 (winner → celebration → trophy cut scene)
- **Scenario gallery (answer 14):** generated build-ups must NOT write over Mikey's hand-checked scenarios. "We need to make sure we do this in the right way." Generated = a separate layer; the gallery's saved scenarios stay the source and untouched. → B2
- **FHR-1 phase 3:** GO (players already moving; engine change behind the switch; the red guard will ask). → B2
- **FHR-2 22-player model:** decide later — re-ask after phase 3.
- **FHR-3 extra defenders:** yes, if it makes sense for one to come in from off screen. → B2
- **FHR-4:** every open-play chance gets a build-up. Some set pieces and penalties can show the foul that won them. → B2

## Free data
- **More matches (answer 19):** there must be more than 2,104. Remove Afriskaut ("no one's heard of them"). Find more tracking data (every player's position) and condense it into more knowledge. → B3
- **DATA-1 credits:** Settings is fine. → B3
- **DATA-2 real moments in the game:** try it. Inside the highlights toggle, another toggle "Real moment highlights". Think through how it works, how we keep track of it, and how we edit it later. → B3
- **A-6 one Play button:** keep. Real shots shot map: "pretty cool".

## 3D
- **Plan:** liked. "Fixing skin and light is very big." Go on phases 1–5. → B5
- **Home player (answer 30):** natural, energetic poses; eyes blink and look around; lips move when talking; holds things properly. → B5
- **Blender:** install whenever needed.
- **3D-3 editor saves:** "I would love it to commit straight into the game" — database now is fine IF it can then be pushed into the repo (a Commit to game step). → B6
- **3D-4:** an Approve button. Approved edits are used in the game; still editable; choose when and where they're used. → B6
- **3D-5:** step 3b first (shop, garden, house). → B6
- **3D-6 Higgsfield:** ON for now. Always say what is being made there, and delete the images/videos after use.

## Generated cut scenes
- **GEN-1:** build the Scene generator as its own admin page, in the **Studio** tab. → B6
- **When they play (answer 31):** "I just don't know when they play and why, but we need to fix that." Decide and show when a generated scene plays in the game. → B6
- **GEN-3:** they can go in the game if they're good, for the moments that suit them. → B6 (after B5's fixes)

## FM ideas (research, answers 33–45)
- Make a **Research area** in the admin (the FM top 10 and the other research pages). → B4
- Liked, to plan as features (not started):
  - Hidden traits that change with how you play — an honour system "like Red Dead Redemption" (gambling, leading on the pitch, captain/dressing-room groups), for NPCs and you.
  - Personalities that change reactions.
  - Position familiarity, and roles inside a position; familiarity changes with the highlights.
  - Agents as people in the game: find one, personalities, some do you wrong or steal money.
  - Mentoring. Weekly training plan. Small steady gains on a focus (maybe an unlock).
  - Full-time summary with shot map and chance quality for you; post-match stats for everyone.
  - "Your match in 20 seconds".
- Not wanted: the manager stuff (maybe a short post-match analysis you can ask for). "Extra stuff": skip. World simulation is Mikey's area.

## Mikey's asks
- **M-1** name: **Lower League Trophy**. → B9
- **M-2** early rounds: a draw goes straight to penalties; from the quarter-finals: extra time, then penalties. → B9
- **M-3** byes: top 8 of last season's League One. → B9
- **M-4** midweek dates. → B9
- **M-5** prize: trophy in the cabinet, money and XP well below the League Cup; doing well can impress scouts in those leagues. → B9
- **M-6** hold to speed up post-match; also a skip (double-tap to skip). → B9
- **M-7/M-8** headers AND volleys back on, with the ball-in-the-air + shadow signal and build-ups lofting it to your head. Idea: bicycle kicks; a "flair" stat that grows with fame; trying them, and hitting the centre of the ball matters more. → B10

## Old bugs
- **B-1:** fix the 3 old failures (keeperPro, keeperBrain, chanceJudge "Chances Old"; Player of the Month photos) AND the failing Wembley test (`tests/star/wembley3d.mts`): fix it or remove it. → B1

## Still to ask
- P-1: PUSH everything (Harry, 20 Oct). Answer "1": ignore. A-1: two headings.

## The builds (same chat, one after another; B1, B9, B11 side by side)
| # | Build | Size |
|---|---|---|
| B1 | Touch fixes (all 27) + the old failing tests + Wembley test | medium |
| B2 | FHR: switch in Settings + pre-match with "?", build-ups in Infinite Highlights/Match, phase 3 (players moving), extra defender, fouls before set pieces, gallery kept safe | large |
| B3 | Free data: more tracking matches, drop Afriskaut, credits in Settings, "Real moment highlights" toggle | large |
| B4 | Admin: every look = one layout, different skin; back arrow top left everywhere; chat bubble bottom left and see-through to taps; Research area | medium |
| B5 | 3D phases 1–5: bench, skin and light, phone cameras, moving faces, home player alive; 90th-minute winner → celebration → trophy | large |
| B6 | Scene editor 3b + Approve + Commit to game; Scene generator page in Studio; when generated scenes play; last 6 admin pages | large |
| B7 | Training drills editable (like the gallery); harder final levels (vision first) | medium |
| B8 | Five-a-side test area with tabs (Scenarios, Data, Full match + radar) | medium |
| B9 | Lower League Trophy + hold/double-tap to speed up post-match | medium |
| B10 | Headers and volleys back with the air-ball signal; flair idea | medium–large |
| B11 | Team room: read receipts and replies in chat, @mentions, linking admin pages into chat, Shift+X to highlight part of a page and @ someone with a note; patch notes with read receipts and notes | large |

### B11, Harry's words (20 Oct)
"read receipts in chat, and reply to current chats - also working @ ing and linking other pages directly into chat with some new feature or to be able to almost point someone towards something on a page through a shortcut (like say shift + x means i CAN highlight part of a page and it @'s them to look at it and they see my note.) … the patch notes system could have like a read receipts and notes so we know when everyone has read and understood patch notes"

## Patch notes for the overnight round (Harry, 20 Oct)
"I need all patch notes split up, named with stills and videos once all is done." → One named patch-notes page per build (B1, B4, B7, B9, B11, B3, B5, B6, B8), each with stills, plus short after-videos for gameplay and animation changes (stills first, videos added after), and one index page linking them all.

## B12 — Vision training rebuilt (Harry, 20 Oct, morning)
"the vision skill is horrendous. It's cluttered, and the skill gap doesn't increase. I don't like the line on the pitch. Instead, what would be an actual good vision skill would be real scenarios: Who should I pass to in this scenario? Have someone offside. Lessen the time. Maybe even make them actually kick the ball. Why are we just tapping? Maybe … early on you tap, then you actually have to kick the ball inside 0.3 seconds. You have to actually aim and kick the ball. We can do better with vision. That doesn't look interesting at all."
Note (not a build yet): "I also don't like how it's in the old 2D style. All of these images in the training." → every training drill should move to the new match look later.

## Harry's answers + feedback on the overnight pages (20 Oct, morning)
Decided: Lower League Trophy cash prize KEEP ("pretty cool"). In-match mute/Touch/Power button sizes: YES (done). Wembley change: KEEP. 3D garden/house/shop/3D training keep their own back button; everything else on the one arrow. The bubble covering 11 px of "Let's go" (admin/test page only): fine. Default admin look = Clean light ("he [Mikey] preferred that") — done. Google Drive / downloaded data: delete raw downloads after use (done for B3's 1.2 GB; rule in data/opendata/README.md).
New builds from the feedback:
- PN: patch notes for the last 2 days, split into tabs (overnight B1/B4/B7/B9/B11/B3 + yesterday's admin round + everything else), a section explaining this patch-notes style, and each one in the admin patch-notes archive so everyone acknowledges every tab ("push this all through into that new admin build").
- B13 Fixes: full pass over ALL fixture dates for clashes (not only the FA Cup Round of 64); admin fixes seen in the stills (XP Rewards "Failed to fetch"; chat bubble over "Next line ›" in the Manager's Office); Team board "Harry's push count looks wrong"; the "GitHub refused the site's key" line.
- B7b Training editor: drag and drop like the gallery (move the ball, cones, men; Save); explain/replace the "your skills" sliders; Pace needs a real skill element.
- B9b Lower League Trophy gets its own screen like Mikey's FA Cup / international ones.
- B14 Running after a chance: WASD + Shift to sprint on PC, a stamina bar on PC and phone, auto run (Harry likes it), and team-mates sometimes pass back to you even before you're captain. (Match/dribble files → red guard asks.)
- B15 Player of the Month and similar cards: headshots shot from our 3D model, not the old 2D drawn heads ("looks unprofessional").
- B16 Keepers in the 3D minigames (Wembley, 3D training) feel overpowered — measure and rebalance. NOTE: B1 raised Wembley's keeper 36 → 70; check against this.
- B17 A PC match layout like the five-a-side test area (pitch + live radar beside it), as a test area first, ideally in 3D ("the way the ball's moving across the pitch is very cool").
- Answers (20 Oct, 09:45): training "your skills" — "surely it should just be auto — playing a level 20 skill would mean you have the 19 levels completed before it" → no slider; a level plays with the skill you'd have after finishing the levels before it (B7b). Keepers in 3D minigames: fair ≈ 1 in 3 shots saved (B16). Engine OK for B2 and B10: YES (run one at a time; B14 after).

## Harry, 20 Oct afternoon
- Allowed B2's match-screen edit and B17's (false alarm) box: "1 and 2 is fine".
- Patch notes regrouped: "outside of all the overnight work have a notes on: team board / all team updates; full admin pages / skins update; anything else that doesn't fit that or overnight work" → index tabs Overnight · Team · Admin & skins · Everything else, one full page per topic (v0.82–v0.84).
- B18 LAG (after everything else is done): "once all of this is done I want a double / triple lag check and research into how and why to make everything lagless. I want zero lag for the same quality, let's revolutionise mobile gaming." Plan: research now (best practice + our code); then on the final merged build, three independent measurements of every screen (static audit, scripted traces at phone size with a phone-like CPU throttle, a separate re-measure); a ranked fix plan with gain/cost/quality risk; then build fixes one at a time, each re-measured. Same quality, no lower settings as the answer.
- B5b (Harry, 20 Oct ~15:15): "I really like the B5 3D changes; however we now need to figure out how to make the bodies not look badly proportioned, natural movement while speaking, moving, holding objects etc." → proportions as 3 options at phone size first (Harry picks), talking/moving body language from the cut-scene timeline, props held properly (trophy, pen first).
- Patch notes: "Vision needs to be shown as rebuilt in B7"; "a full plain pass could be run over everything to simplify and get rid of yap in the artifact"; "how these patch notes work doesn't need to be on every page"; questions to a separate artifact.
- Admin: "the team area should be the default home area and it should open on Team board and have its own tab on the left" → B19.
