# Mikey playtest review, 2 Oct 2026 (video 23:09)

What it is: Harry and Mikey read the **v0.24 patch notes page** together and watch its before/after clips. Two voices, so each point says "they" unless it is clear. It is a review of clips, not a live play session.
How it was made: Transcript from the `small.en` model (`transcript.txt`). Pictures are in `sheets/` (see `index.md`). Only the keyframe pass was run (`--fast`), not the dense pass.
Confidence: everything below is **seen in the video, or heard**. Nothing was checked in the real game. Where the words were unclear, the line says so.

Tags: BUG, CHANGE, IDEA, PRAISE.

## Top bars and home screen look (00:17 – 04:24)

1. 00:17 – Top bars on Home and Shop are now square, white edge, no can, no full badge (patch notes page, before/after clip) → read out as the change. Context for points 2 to 6. CHANGE (context)
2. 00:42 – "I don't really like that because it will never really be full." The star on the bar never reaches full (home bar) → wants the bar to fill per level, or over 10 levels. CHANGE
3. 01:13 – The new bar is a different style from the rest. One of them says it looks better, but "personal preference" (home screen clip) → undecided. Needs a ruling. CHANGE
4. 01:41 – The white outline on the bar looks like a "PowerPoint presentation" (home screen clip, 02:38) → remove the white outline. CHANGE
5. 01:54 – "Doesn't need the hundred in there" (number "100" on the bar) → remove the 100. CHANGE
6. 01:58 – It looks like something "code designed", not designed by a person (home bars) → less generated look. CHANGE
7. 02:12 – The green bar is the same green as the rest of the page, so nothing stands out (home bars) → make the whole always-there top part a light grey that blends in, no outline (02:47 to 03:04). CHANGE
8. 03:08 – "Have a look at NSS's home screen and base your Higgsfield image on that and adapt it a bit" (home top bar) → use New Star Soccer's home screen as the reference for the generated image. IDEA
9. 03:19 – Idea of a 3D bar "like a battery shape". Other voice: "hesitant with the 3D, it overcomplicates the look". Wants a 2D home screen (03:36). Agreed to test the 3D version in game (03:54) → keep bars 2D, test one 3D version. IDEA
10. 03:46 – Star, belt, Earth and smiley as 3D icons over the bars. "That is better." Globe is "probably the best one" (04:08 to 04:14). Other pages (Fame = globe, happiness) get the same icons (01:04 to 01:13) → keep the 3D icons. PRAISE

## Match result and highlights (04:24 – 06:00)

11. 04:24 – Level-up bar after a simulated match now fills to the end, empties, then climbs again (post-match clip). At 04:44 one voice is confused ("swear that's not what I just did", "why is that full?"), then says "that was way better" at 05:00. The "after" clip at 04:58 also shows a rating of 0.0 → praise, but check the 0.0 is only mid-animation. PRAISE
12. 05:07 – Highlights no longer start with a defender standing on the ball (drawings clip, 05:11). "Before, there was no possible way you could kick the ball" → good, keep. PRAISE
13. 05:25 – The thumbnail showed the right highlight, but when Play was pressed it showed a different one (highlights clip, around 05:25 to 05:50) → highlight that plays must match its thumbnail. BUG (could also be a recording fault, they said "the recording kind of broke this time")
14. 05:45 – The patch notes page showed "claude.ai refused to connect" for a clip, and the "after" clips at 05:28 and 05:36 are black → clips on the notes page did not load. BUG (notes page, not the game)

## Trial and "Take Him On" (06:12 – 09:47)

15. 06:12 – Help card in the middle of the pitch, one tap closes it. "I wasn't too fond of this." Prefers it out of the way so you can just play. Also mentions "tap anywhere" (06:26), but this part of the audio is unclear → move help out of the pitch centre, keep tap-anywhere. CHANGE
16. 06:33 – Free kick and penalty trial were not explained, "a bit confusing" (06:41). The new "no way through the wall" tutorial card fixes it: "that's good" (06:55) → praise for the free kick tutorial. PRAISE
17. 06:59 – "Scuffed. I cannot score a goal." Free-kick trial at 06:48 shows INTERCEPTED. Words are short, screen not fully clear → a free kick the player cannot score from. BUG (unclear, needs a re-check)
18. 07:17 – "The game's getting butchered but it's looking better and better. The gameplay is so good right now. The look is great. That could be a Roblox game" (Find the Pass minigame clip, 07:09 to 07:26) → praise for the look. PRAISE
19. 07:29 – Find the Pass is back to five goes (was one go). "That's a quick mode you could just do." The faster rounds feel like "Subway Surfers" (07:39). Time per go drops 2.5, 2, 1.5, 1, 0.5 s → keep five goes. Keep as a possible quick mode. IDEA
20. 07:49 – "What do you think of this white?" "I don't know where it came from." It is a white card ("Who's free?", clip 07:55) → a white screen they did not expect; unclear if it was meant. BUG (unclear)
21. 07:59 – In the trial, "the numbers all gone, it just says next up", and "I've been wanting to fix it" (08:00 to 08:06) → trial screen has no numbers. Unclear which screen. BUG (unclear)
22. 08:09 – Penalty shootout screen: on the phone "it doesn't look that bad", but it should be almost a full pitch, with a scorecard instead of a background panel. "Yeah, I think that's better. Let's make that change" (08:19 to 08:22) → make the shootout pitch near full-screen, with a scorecard. CHANGE
23. 08:25 – Penalty shootout: team-mates take the first two kicks, you take the last. "Before it made you take every pen. I like the idea of a penalty shootout." Rigged so you always take the final one (08:37 to 08:47) → praise, better than the five-a-side version. PRAISE
24. 08:56 – Training Power drill, "level one is an open goal". One voice says "that's not level one" (09:03) → the clip may not show the real level 1. BUG (unclear, check against the real game)
25. 09:09 – "You're seeing spoilers", "see-through card, no button" (09:22 to 09:24). The see-through card with no button and tap-anywhere → fine, already seen. PRAISE
26. 09:26 – "Take Him On" new look (stadium, mown pitch, boots). "It looks 10 times better, it looks amazing, but we'll see" (09:35 to 09:39) → praise. PRAISE

## Home screen (09:43 – 11:30)

27. 09:55 – Home screen, "Reputation", the title under the star (for example "Trusted", "Rising Star"). "I don't like this stuff where it adds a title." Reply: it has always had its own title (10:02 to 10:11). Wants: goals, assists, age; reputation with a bar and number is fine; "the names are just meaningless" (10:12 to 10:26) → remove the reputation title words; keep bar plus number. CHANGE
28. 10:30 – New Home "looks better" (10:30). But "the goal is still a little bit weird". It needs the grass texture in a box, and "needs to be a full-size goal" (10:35 to 10:44) → fix the goal behind the player on Home (full size, grass texture). CHANGE
29. 10:51 – Kick-off page: teams walk out of the tunnel, with both crests. "That's way better" (11:01) → praise. PRAISE
30. 11:06 – "I don't know why it's like this. The game is playing and that should go and become the highlight screen as soon as you press Play" (pre-match page, 11:07 to 11:15) → the kick-off screen should disappear and become the highlight screen the moment Play is pressed. CHANGE
31. 11:14 – Star Pass is now a round glossy badge. A voice says "you had some notification thing that's not an actual notification" (11:18 to 11:28). Unclear → the badge reads like a notification dot but is not one. CHANGE (unclear)
32. 11:32 – First-time tour on Home: "This is you, star rating, your energy, money. Nice. A little bell" (11:32 to 11:41) → praise. PRAISE

## First steps and achievements (11:44 – 14:20)

33. 11:44 – First-time flow forces the Power drill, no skip, with help inside the drill; then one more drill. "I was basically saying that if it's going to tell you to do a drill, I should start with this one." Two drills per session (11:44 to 12:15) → fine as built. PRAISE
34. 12:18 – Level stars are three in a row, fill left to right (one, two, three). "I think that was better. I like that one more... go back to that" (12:18 to 12:33) → keep the three-in-a-row stars. PRAISE
35. 12:35 – "First steps" list in Achievements, with a bottom-right button that follows your progress. Wanted: a story-style first-steps list that pushes you on what to do first, "an intro of achievements", more basic ones (12:39 to 13:00) → good, build more basic ones. IDEA
36. 13:02 – Relations and Shop unlock after 1 game, Sponsors after 10 games. "Again, I told it not to do that" (13:05 to 13:16). Wants a meeting with the boss after the first game, and after about 3 games most things open (13:18 to 13:32). Later (20:57): sponsors should open when your first sponsor appears, based on form and reputation, not a game count → drop the 10-game lock. CHANGE
37. 13:39 – Energy explained at full time. "This should probably just be the start of the game" (13:47) → explain energy earlier, not at the first full time. CHANGE
38. 13:58 – The clip "didn't actually show what it said it was showing" and "why is it showing nothing there?" (14:02 to 14:14) → a notes-page clip does not show the feature in its caption (Post Match Reactions tutorial). BUG (notes page)

## Title screen, Shop and boots (14:20 – 17:02)

39. 14:20 – Title screen: stadium behind the logo looks better, "the stadium is full" (14:44 to 14:47). But the ball needs changing, the goal needs to be further back, and the player is on the halfway line so the goal makes no sense. Option: "maybe just get rid of the goal on the start screen" (14:26 to 14:43) → remove or move back the goal, change the ball. CHANGE
40. 14:47 – Idea: look left and right around the stadium (14:48) → IDEA
41. 14:51 – Shop: boots on a wooden plank, no card outline. Wanted special boots in glass cases "like in a shop" (14:56). "They're not looking good enough" (15:07) → boot pictures need to look better. CHANGE
42. 15:12 – Buying a boot opens a box, the lid flies off, the boot rises. "It was good" (15:23). But "they don't come out of the box at the right angle", maybe facing the camera (15:24 to 15:29). At level 5 there should be "a cool animation" (15:31) → fix the boot angle. Add a special buy animation at level 5. CHANGE
43. 15:37 – Basket in the Shop. "Not necessary", "easier to just buy with one tap" (15:50 to 16:01). "If there was a reason for it, it would be worth it." Mikey: "the basket is cool but you should still be able to press Buy Now" (16:40). The box animation should be the basket (16:43 to 16:57) → drop the basket for now. Decision at 20:30: basket for Style items only, "put on hold for now". CHANGE
44. 16:17 – "I think we should get rid of the green on some pages, that's probably what's making stuff look weird." The shop "should be more like a shop", it does not need to be that light (16:22 to 16:31) → less green on some pages. CHANGE
45. 17:02 – Soundboard admin page (play each sound, replace one) → shown, no complaint. At 20:46 asks to put all sounds in the game with Mikey's own sounds (answer: next version with Mikey's yes). IDEA
46. 17:06 – 3D icons made in Blender → "See that is great." PRAISE

## Signing scene (17:13 – 18:58)

47. 17:13 – Signing scene, manager and player at a desk, contract and SIGNED stamp. "That is pretty good", "just amazing" (17:35 to 17:37) → praise. PRAISE
48. 17:52 – "If that could be the face of your avatar as well." Harry: need to look into if it can make a 3D model of your face from an uploaded photo (17:52 to 18:04). Then: only one model, so everyone looks the same (18:13). The skin and accessory change between three presets (18:21 to 18:38). Fine to not use your own face. Idea: let the player pick the closest look, the game could recommend one (18:43 to 18:58) → avatar choice of a few looks. IDEA

## "Your calls" section (19:02 – 23:09)

49. 19:02 – Call 1, give-and-go: a pass in a chance with no goal came back to you 73 times in 100. "Put that back to how it was" (19:09). The ambitious forward pass should almost always give the ball back. "At least 90, 95 out of 100". A backward safe pass should be less likely (19:28 to 20:19) → raise the ambitious return rate to at least 90 to 95 in 100, keep a smaller chance for the safe pass. CHANGE
50. 20:30 – Call 2, basket for Style items: "put on hold for now". (Decision, see point 43) → hold. CHANGE
51. 20:39 – Call 3, training Power levels: "probably about right", and "keep moving further and further back" (20:39 to 20:43) → keep the Power level shape, keep moving the goal back. PRAISE
52. 20:46 – Call 4, 10 of 19 sounds not in game: put them in with Mikey's (20:46 to 20:54) → yes, in the next version. CHANGE
53. 20:57 – Call 5, sponsors: should open on your first sponsor, from form and reputation, with a minimum (nothing if you play badly). Bad sponsors easy to get. Pay is tied to your level, "a sponsor in National League South will be like two pounds" (20:57 to 21:56) → build this instead of "10 games". CHANGE
54. 22:01 – Call 6, signing scene stays in the test area. Asks how the cutscene was made ("completely generated", 22:18 to 22:40). Then: "so it's not avatars", "you should have options" (22:44 to 22:56). One version had a headband and a different skin colour (23:04) → leave it in the test area for now. Wants player options. IDEA
