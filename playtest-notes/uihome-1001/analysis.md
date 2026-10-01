# Full UI / home flow review (Harry, 1 Oct 2026) — analysis

Source: playtest-notes/uihome-1001/points.md (46 points, 24 keyframes in keyframes/). Point numbers below (P#) refer to that file.
Video 15:16. No gameplay points (he says so at 15:07). Two images of his friend's phone were mentioned but are NOT in the video — still needed.

## Headline
The friend's verdict drives everything: "a lot of information, a lot going on" (P13). Harry's answer is two things:
1. **Home fits one phone screen, no scrolling** (P4–P11, P15, P16) — and the same for the team sheet / Kick Off (P44).
2. **Start almost everything locked and unlock it step by step** with a first-time tutorial and achievements (P18–P25, P33, P35, P38–P40).

## Checked against the code (measured / read, not guessed)
- **Boss meeting reward (P34) — confirmed and worse than he saw.** components/star/RelationshipMinigame.tsx: lose = +4 always; win = 12 + 2×lives left → +12 to +18 in one meeting. Harry: lose ≈ −8, win +1, max +2, harder the higher it is. Before → after he wants: win up to +18 → +2 max; lose +4 → about −8.
- **Starting relationship values (P26).** lib/star/careerFlow.ts makeIdentity: boss 60, team-mates 60, fans 40, sponsors 0. Harry wants about 50 / 50 / 50, you ≈45, reputation 0, fame 1. (His screen showed 80/72/77 because his save has played games.)
- **Achievements exist but have no home (P23, P25).** lib/star/achievements.ts has a list (First Appearance, Score a Goal, … First Contract) checked automatically; there is no Achievements screen/slot in the bottom bar and no pop-up. Harry wants an Achievements slot, a pop-up animation, and achievements that UNLOCK parts of the game.
- **Phone has no way out (P14).** He got stuck on the Phone screen and left by tapping Relations. Seen in his video at 04:36 (keyframe 08).

## Clashes with the v0.20 test copies (decide before merging)
- **3D/2D button (P16): he now wants it OFF Home.** The signing test copy just made that button flip your player too. → Either drop the button from Home, or keep it only in Settings.
- **Sponsors pill (sponsors copy) adds another chip to Home**, the opposite direction to "less on Home". → Probably moves into the locked/unlock chain or the Shop tab.
- **Shop order (P17) is ALREADY what the shop test copy does** (KIB Cans/Boots/Style/Sponsors on top, Store/Casino under). But he wants "Your shop items" DELETED — the shop copy replaced it with a "My stuff" strip. → Keep My stuff as its own screen, drop the strip from the Shop page.
- **Energy (P31) "every single day you should get 5–6 energy".** The energy system was built on Harry's own earlier rule (31 Aug): regen ONLY from a deliberate choice (Rest / Skip to Match Day), never automatic. → Ask: has the rule changed?
- **Stats tab (P22) "Premier League block moves to the bottom".** The sponsors copy already put your season first and the table under it — matches.

## Workstreams (proposed order)
1. **Home on one screen** (P4–P11, P15, P16, P7): player card holds age, star rating + bar, energy bar + a small can with Use; name removed from under him (name on the shirt back when spun); next match one thin line with form letters "D D W"; money is a small chip always visible top of every page; 3D/2D off Home. Measure: Home height today vs 844 px phone (his screens needed 2+ scrolls). Show 2–3 layouts at phone size first (judged by eye).
2. **Same screen on every phone (P3).** Needs the friend's two screenshots. Likely causes to check: short phones (e.g. 667 px tall), browser bars, an old save. Test at 360×640, 375×667, 390×844, 430×932.
3. **Team sheet / Kick Off (P44, P42, P45):** Kick Off always visible (sticky bottom, maybe top-right too); hide cans on the pre-match screen at 100% energy; the 2-second empty black "KICK OFF" panel when the match opens (seen in his video at 14:59, he didn't mention it).
4. **Relations (P26–P31, P34):** remove This Week + Energy block and the Lifestyle block; clearer, less bubbly; starting values; one line per relationship explaining what it does (manager = selection & set pieces; team-mates = highlights, pass-backs, chemistry; fans = booing, social media — fans "not decided"; sponsors = posts/press events that cost energy); boss meeting rewards fixed.
5. **Unlock chain + tutorial + achievements (P18–P25, P33, P35, P37–P40):** Home tutorial → forced 2 training drills → "your star rating went up X" → League unlocks → Shop explained → Achievements slot appears with pop-up → "Have a meeting with your boss" unlocks Relations → Lifestyle found by the player; buying a phone → back to Home, "Buy phone" achievement → Phone unlocks with only League + Settings + an App Store (other apps bought there, paid backgrounds). Lifestyle items locked by level (his numbers 4, 6, 8, 10, 15, 30 — almost certainly star rating levels on the new 1–100 scale).
6. **Phone (P39–P41):** back button; start state; App Store; Messages "needs a big revamp, no impact on the game"; "this notification thing has got to go".
7. **Smaller ideas:** premium/elite cans also give energy (P5); celebrations for the player on Home (P12); skill-rating points per training level (P19); spin system on the title screen (P2).

## Questions for Harry (one word each)
1. Daily passive energy (5–6 a day) — does it replace the "only by Rest/Skip" rule? (yes / no)
2. 3D/2D on Home — remove completely, or move to Settings? (remove / settings)
3. Lifestyle unlock levels 4, 6, 8, 10, 15, 30 — star rating levels? (yes / no)
4. "This notification thing has got to go" — the red badge on Messages, or the red dot on the Phone tab, or both?
5. Send the friend's two screenshots (needed for the "every phone the same" fix).
6. Unlock chain: does an existing career get everything unlocked straight away (recommended), or go through it too?

## Not clear from the recording (listed so nothing is invented)
P2 what "here" is (title screen or trial) for the spin; P9 which can; P11 "three pockets"; P21/P24 "stats moved here", "sponsors is too good in a way", "instead of League here" (the bottom-bar League slot may become Achievements); P32 where reputation/fame go ("top right, for now"); P36 "one-shot button" (probably "one shop button": merge Store into Shop).
