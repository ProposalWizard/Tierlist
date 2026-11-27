# Explainer videos: Mikey's notes (17 Nov 2026)

Only ex01 (Pochettino) is close to good; ex02 (Messi v Chitalu) has a nice flow but isn't perfect.
Everything else (ex03-ex14, the other styles and formats) is NOT good enough. Redo all of them, ex01 too,
after studying ~10 more reference videos from the same account Mikey is sending.

The rules:
1. Never hold a bland or basic picture on screen. Change something every 1-2 seconds: a new element, a
   pop-in, a stat, a move. Example of what is wrong: Leicester's 5000/1 slip stayed up 7 seconds; the
   "20th at Christmas" table 3-4 seconds.
2. What you see must explain what you hear. When the voice says "Vardy scored in 11 games in a row",
   show the 11 goals popping up one by one with who they were against, him scoring, etc. Kanté = a crazy
   heat map / him winning the ball. Mahrez = his stats, him holding the PFA trophy. A face alone is not enough.
3. Fill the screen. No small boxes in the middle with empty space around them (the "Chelsea 2-2 Spurs"
   card was tiny and badly placed for 2+ seconds).
4. A good image must stay long enough to see (the Leicester fans picture was on for ~0.4 s).
5. Use as many Higgsfield images as needed: scenes of the actual moments, not only portraits.
   (Free trial: unlimited until 20 Nov 2026.)
6. Not too short: detail matters. Voice, text and pictures go hand in hand so people understand and stay.
7. Stick to the reference account's style and flow; drop the extra styles/formats (dark, paper, pastel,
   quiz, myth cards) unless Mikey asks for one back.

## Named people must look like themselves (Mikey, 17 Nov 2026)
"some of the images... are just generic things... Ranieri doesn't even look like Ranieri... a group of random people."
- If the voice names a person or team, the picture shows THEM: name them in the prompt and attach their portrait
  (work/ex-people/<name>.png) as a reference image.
- If a likeness can't be had, frame it so no face is readable (from behind, wide, hands, the object) rather than a wrong face.
- Generic faces are fine only when nobody is named (punters in a betting shop, a crowd).

## Explain HOW, not just WHAT (Mikey, 17 Nov 2026)
"it explains the story... but it doesn't give so much about how it actually happened."
For any "how did X happen" story, spend real time on the mechanics: the signings and what each one added
(fee, where from, what changed), the tactical idea and which player it unlocked (who moved where, why it
worked, a pitch diagram), the turning-point decisions, and the numbers that prove it. The pizza / deep-line
level of detail is the minimum, not the target. Every "how" beat still gets its own picture.

## Real moments, lively screens, no reading the screen (Mikey, 24 Nov 2026, on ex15)
"I don't want things that are just AI. I want things to look exactly how they were, but in AI."
- **Research the real moment first** (how each goal went in, who was there, what they wore, the famous reaction shot), then
  write the picture prompt from that. Named people get a real reference photo (Guardiola is bald: the first try gave him hair).
- **A list of goals is a picture of each goal** popping on at its minute, not ball icons while the voice reads the minutes.
- **Never say what the screen already shows** (the bars name Ronaldo and Lewandowski: the voice says only "nobody has got past 69").
- **No flat-colour "PowerPoint" screens.** Every graphic sits over a picture or a moving clip (`bgImage` / `bgMotion` on any step).
  Scores use `scorebug` (the game's scoreboard look), never the old `score` cards. Nothing on screen with nothing happening.
- **An ending that lists options is four quarters** (`quad`): each option its own picture or clip filling a corner.
- Higgsfield now runs from Claude Code: pictures GPT Image 2.6 (medium, 2K), clips Kling 3.0 (5 s, silent, start_image = the picture),
  played by `"motion": key` on a picture step. Say "Immediately ..." in a clip prompt when the step is short. Check every clip by eye.
