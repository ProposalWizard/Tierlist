# "App and company.mp4" breakdown

## Basics
- Length 13:35, 1280x720 screen recording, speech present (Harry, thinking aloud while scrolling and reading).
- 118 pictures on 10 sheets; all 10 sheets opened, plus about 15 full-size frames to read on-screen text.
- The audio is very quiet (mean -49.7 dB). The stock transcript was run again on volume-boosted audio (medium.en), and this report merges both. Files are in `/home/user/Tierlist/.playtests/app-company-0930/` (index.md, transcript.txt, sheets/, frames/). The scratchpad has `t2.txt` and `t3.txt`, the extra transcripts. video.mp4 is still on disk (disk was fine).
- Screen throughout: the "App Launch Guide" artifact in a browser (dark page), scrolled top to bottom. Some other screens are shown at the start and the end.
  - 00:00-00:08: a Futbin player page.
  - 00:10: the Mac desktop and a Claude window.
  - 00:13-00:14: a Claude chat ("Meeting transcript", space "Zocial-gen-operations") showing an old message from Harry: "...I don't see it becoming a product... I can't just go in the app now and talk to you in there...". He is not speaking about it.
  - 00:15 onwards: App Launch Guide (label "Guide - 30 Sep 2026: answers to your phone questions").
  - 12:52: another Claude chat, "Website and Balondor game review", scrolled to "4. Company setup for three people" and "Refresh Player Photos: fixed".
  - 12:58-13:25: the knowitball.co.uk admin Patch notes archive.
  - 13:31: the Claude chat again, then the desktop.
- Words the transcription got wrong, read from the page or from context: "Code magic" = Codemagic; "Noble" / "Norwood" / "Knowable" = Knowitball; "Monza" = Monzo; "DUNS" = D-U-N-S number; "Harry at Knowable.co.uk" = harry@knowitball.co.uk (the page's example address).

## Timestamped points (in order)

**[00:11] REQUEST/INFO.** "Okay, so this is a review of the app launch guide and then any other thoughts, so let's go through this from the top. I'm going to give you any of my questions and we'll go from there."
- Screen: top of App Launch Guide.

**[00:23-00:28] INFO.** Reading the guide aloud: "The app is a frame. The game inside it is a website loaded live. There's still only one game."
- Screen: "HOW THE APP WORKS" diagram (app frame / knowitball.co.uk / PC browser).

**[00:28-00:40] QUESTION.** "So the app frame is literally just the logo and the sign-in, so the sign-in section wouldn't be part of the actual game. But we still have that on the website. So how does that work?"
- He is asking how sign-in works, given the website also has sign-in.
- Screen: the "The app frame: icon - sign-in - saves" box in the diagram.

**[00:40-00:52] INFO.** He reads the diagram labels: "And saves. Okay. Then the game is real... offline and back button... the back button, portrait lock."
- Screen: the diagram, with "offline - back button" highlighted at about 00:53.
- This is him reading, with no clear point of his own.

**[00:52-01:12] QUESTION.** "Yeah, we're not going to build a second game. Okay, so what you're saying is we wouldn't have like a start screen on the website because it's still going to be a web game as well as a phone game. So how does that work?"
- Screen: "What we build once: the frame / What we don't build: a second game" text.
- Unclear at 00:52-01:05: the transcript has only fragments. Words such as "what you're saying is we wouldn't have a start screen on the website" are clear in the second pass, but the exact logic he is testing is not.

**[01:12] CONCERN.** "We don't want to nerf the web game." This appears only in the second transcript. The first transcript has "We don't know if the web game" (cut off).

**[01:14-01:17] QUESTION.** "Codemagic, is this free?" ("Is this free?" said twice.)
- Screen: the "Built in the cloud" paragraph (Codemagic turns the frame into the iPhone and Android apps, free for the first 500 build-minutes a month).

**[01:19-01:28] INFO.** Reading the guide: "Game change: built here, website... frame change: so if we want to change the logo, if we want to change the name of the app."
- Screen: "A GAME CHANGE - almost everything / A FRAME CHANGE - a few times a year" diagram.

**[01:29-01:41] INFO/CONCERN.** "New phone permission. Ah, interesting. So we should have all permissions kind of set up [in the first version]."
- Screen: "NEEDS A NEW STORE VERSION" box, with "The face scan uses the camera, so the camera permission goes in the first version" highlighted.
- It reads as a suggestion to set up all permissions up front. Phrasing is uncertain.

**[01:38-01:41] INFO.** "Vibration, in-app purchases, interesting."
- Screen: the "Vibration, in-app purchases, anything else that talks to the phone directly" bullet.

**[01:43-02:05] QUESTION.** "Yeah, how does selling coins and adding things to the shop work? Because we were thinking a daily shop, but surely a shop would somewhat work?"
- Screen: "THE CATCHES" box, with "Apple's rules still apply to what the website adds. The app can't turn into a different kind of app, and it can't sell coins around Apple's payment system" highlighted (01:57-02:05).
- The second half ("but surely a shop would somewhat work") is a bit muddled.

**[02:05-02:13] CONCERN/QUESTION.** "And if the website is down, the app is down. There has to be a way for it to just work completely offline, surely. That's surely not how everyone does it."
- Screen: "If the website is down, the app is down. The offline screen covers it." highlighted.
- He does not seem satisfied by the "offline screen covers it" answer.

**[02:18-02:47] QUESTION (UNCLEAR).** "Could we make more decisions on like a different ... [iPhone app]?" The rest of the sentence is lost.
- Screen: 02:21 heading "AN APPLE VERSION, AN ANDROID VERSION AND A PC VERSION? - Yes, from the one game" and the diagram "One game - it knows where it's running".
- There is about 30 seconds with no usable speech (02:18-02:47). Second pass: "Could we make more decisions on like a difference in iPhone app...". Not reliable.

**[02:47-03:11] QUESTION.** "What if on the web certain features didn't feel so good in the game? Let's say for example the ball bouncing to have to take a shot on goal doesn't feel so good on the web, or vice versa, doesn't look so good on the phone. Is there a way to have that feature only on one? Would we then place some gameplay mechanics into the frame, or is that just not possible?"
- Screen: the one-game / iPhone / Android / PC diagram ("example differences, not decisions").

**[03:11-03:20] QUESTION.** "What if on Android we wanted the UI to look slightly different because that market is a bit different? Maybe they don't like the 3D flashy kind of UI. What would we do then?"
- Screen: same diagram; "Where it's needed / The cost" text below.

**[03:25-03:33] INFO.** Reading "The cost": "Every difference is one more thing to test on three platforms, so we keep them to the few the stores force on us. The game itself stays identical everywhere. I see."
- The "I see" reads as acceptance.

**[03:35-04:06] QUESTION/DECISION.** "Hmm. Let's discuss that. The phone copy makes saving instant and works with no signal. The cloud copy is the backup and it's what your PC reads. So would it be that if they went underground, they played, as soon as they get connection, even if they're not in the app... we should just upload it to the cloud, because surely that would stop this ever being a problem. Save the moment you leave the app. Yeah. Let's try and close that gap."
- "Let's discuss that" is aimed at the guide's "Saves" section.
- Screen: the "SAVES - If the app keeps saves on the phone, is it still cloud? Yes, both" panel and the Phone copy / Cloud / PC diagram.
- DECISION: he wants to close the gap where a save is lost if the player leaves the app before the 3-second cloud save. This matches the guide's "Save the moment you leave the app" item.
- The middle sentence is broken. He seems to be saying that if a player goes into a tunnel, plays offline, then regains signal, the game should upload even if the app isn't open.

**[04:13] QUESTION.** "What does a full phone mean?"
- Screen: "Say so if a save fails: Today a full phone silently drops the save" highlighted at 04:21.

**[04:16-04:24] REQUEST.** "Also, you can just answer this in the chat. You don't have to redo it into here [the guide], because I want just answers to my specific questions."
- He wants his questions answered in the chat, not by rewriting the guide artifact.

**[04:24-04:41] QUESTION/CONCERN.** "Smaller saves. What does this 'not storing other club squads' actually mean? Does that literally mean that we're not using real names and stuff? Because that is not good."
- Screen: "Smaller saves: 1.4 MB -> about 300 KB, by not storing other clubs' squads (they're downloaded again)..."
- "Yeah, I hear that" appears at 04:39-04:44 (see the unclear note below).

**[04:44-05:07] INFO/DECISION (UNCLEAR).** "I think this is more simple than we think with the phone and PC. Wouldn't we just keep both saves..."
- Screen: "Phone and PC disagree: your options" (A Ask which to keep - MY PICK; B Newest always wins; C One device at a time; D Keep both automatically).
- There are about 20 seconds (04:44-05:06) where he is mostly reading silently. The transcript picks up mid-sentence at 05:06.

**[05:06-05:39] DECISION/REQUEST.** "Wouldn't we just keep both saves and then... but keep both saves. But see, that's a confusing thing. I feel like it should literally just ask you. You haven't saved your cloud session [when you want]. Because we're mainly focused on the phone, right? When you go back to your PC, it should say like 'We noticed you didn't save your cloud session. Log in and save on the phone,' or just give the option to take the phone save, I guess."
- Screen: options A-D and the "Two different saves: This phone / Your PC" mock-up.
- Reading: he considers D (keep both automatically) but finds it confusing, and prefers an ask-you prompt, which is close to option A. His wording is that the game should prompt on the PC when the phone save was never uploaded, offering to log in and save from the phone or take the phone save. He says the phone is the main platform.
- Words are jumbled at 05:19-05:34 ("you haven't saved your cloud session when you want").

**[05:44-05:53] INFO (UNCLEAR).** "So that looks okay, but if you go... I mean there... ah, there we go. Okay."
- He is scrolling to the next section, "FINDING 12 TESTERS".

**[05:54-06:19] INFO.** Reading the guide: "Some company accounts on Google forums say they hit it anyway, so it isn't certain. The Play Console dashboard shows whether it applies on the day the account exists. The count drops below 12, the clock restarts. Google also checks that testers actually opened the app. Only Android counts. iPhone testing through TestFlight has no minimum. Okay, cool."
- Screen: "Good news first: As a company, the 12-tester rule probably doesn't apply" box.

**[06:20-06:28] INFO.** "Yeah, I'm sure we can get this done through Discord and content [the community/content]."
- Screen: "Finding the other 5 or 6": "Your own players", "Your 6 or 7 each bring one" (highlighted at 06:37).
- He is referring to the Discord for finding testers. "and content" is unclear; the second pass has "through Discord and content".

**[06:28-06:43] QUESTION.** "Yeah, do we need to test on Android phone and PC or what? Okay, interesting."
- Screen: the tester list, then "How we know testing worked".
- The full question is unclear. It seems to ask whether testing is needed on Android, iPhone and PC.

**[06:46-07:10] DECISION/INFO.** "I mean, it'd be good to do some testing anyway, to be honest, and just get feedback from a bit of a wider group. We could just do a whole TikTok run and be like, 'oh okay, 100 people get to beta test it and we're just going to take your feedback. So you get two weeks of access, you have to log in every single day.' Yeah, that's a good little thing."
- Screen: "How we know testing worked" and the checklist (install and sign in, airplane mode, Android back button etc.).
- He wants a wider public beta anyway (about 100 people via TikTok, two weeks, daily login) and calls it a good idea. It is a proposal in his words, not stated as a final decision.

**[07:10-07:25] (no clear speech).** He scrolls to the company-setup section.

**[07:25-07:39] INFO.** Reading "SETTING UP THE COMPANY": "So we need to verify our identity, gov.uk, passport, register the company, Companies House, Knowitball [Ltd], need a registered address, an email, the business [type] and the three of you as directors. So that's £100."
- Screen: "DO WE NEED A COMPANY BANK ACCOUNT, THEN APPLE AND GOOGLE COMPANY ACCOUNTS? Yes. In this order", steps 1-8.
- Facts on the page: £100 company fee, about £200 on day one. He mentions a passport for ID and does not give any numbers.

**[07:39-10:55] (no speech).** About 3 minutes 15 seconds where the screen barely moves.
- Screen: the same "Setting up the company" view. The cursor drifts around step 2, "Register the company" (the Companies House text and the "Decide first: the company name, how the shares split, a written agreement, whose home address goes on the public register (or pay for a business address instead)..." paragraph).
- The transcript shows only "Okay" and one uncertain "I'm going to put it on the side" (09:25) in this window. The boosted audio was checked and shows nothing reliable. He was most likely reading silently or thinking. The page shows a cursor highlight on the Companies House register text (11:17-11:41) but nothing at 08:00-10:30.

**[10:55-11:16] INFO/DECISION.** "Okay, cool. Company... Knowitball Ltd... that'll be my address, business type: game software. But it will be YouTube, it will be social media, games, and potentially physical media as well."
- Screen: step 2 "Register the company", with "code 62011, games software) and the three of you as directors" highlighted from 11:17.
- The business address: he says something like "that'll be my address" and [gave, or referred to, an address; no address is stated in the transcript]. He notes the company's activity will include YouTube, social media, games and possibly physical media, not just game software. Exact wording of the name/address part is unclear.

**[11:23-11:30] INFO.** "So I can just open a business bank account through Monzo or Starling. Okay."
- Screen: step 3 "Open a business bank account (Starling, Tide, Monzo Business or Mettle)".

**[11:31-11:50] QUESTION.** "Company email on your own domain. Harry at [knowitball.co.uk]. So would harry@knowitball.co.uk be the company email for everyone, or just me, or would everyone need one?"
- Screen: step 4 "A company email on your own domain" (e.g. harry@knowitball.co.uk, through Hostinger, Apple rejects a Gmail address for a company).

**[11:50-11:58] INFO.** Reading step 5: "Free business ID that Apple and Google both require... up to seven working days. Okay."
- Screen: "Get a D-U-N-S number".

**[11:58-12:08] INFO.** "Enroll the D-U-N-S number and the company email, then invite the other two as admins and apply for the small business program. Apple's cut drops from 30 to 15 percent. Okay."
- Screen: steps 6-7 (Apple Developer account, Google Play account).

**[12:08-12:22] QUESTION.** "Yeah, tax is going to be a whole other issue. So let's say for example we made £10,000 in our first year, what would that look like?"
- Screen: the "Tax" step and "Every year" section (Apple membership $99 plus VAT, confirmation statement, annual accounts, Corporation Tax return). The currency is unclear: the transcript says "10,000" with no unit (UK context, so probably pounds).

**[12:22-12:45] (no usable speech).** He scrolls to the "Sources, and what isn't confirmed" panel. Transcript has nothing reliable.

**[12:45] QUESTION.** "How can we find out more about the 'not confirmed'?"
- Screen: the "Sources and what isn't confirmed" list. The "Not confirmed" bullet says: whether company accounts truly skip the 12 testers; the online confirmation statement fee after Feb 2026; the exact price of Apple's $99...
- The transcript ends the sentence without saying which item he means ("the not confirmed").

**[12:48-12:53] INFO.** "Okay, I think that's a good session on that." Then: "What else is there?"
- At 12:52 he switches to the Claude chat "Website and Balondor game review" (showing "4. Company setup for three people" and "The guide (same link, private) now says three of you instead of two").

**[12:58-13:07] REQUEST.** "Oh yeah, all of the patch notes need fixing up."
- Screen: knowitball.co.uk Patch notes archive page (Admin), loading at 13:04-13:08.

**[13:10-13:34] CORRECTION + REQUEST.** "This version 1.1 is not version 1.1. That should be like version v0.20, and I definitely have like 15, 16, 17, I've done those since then, so we need to update that and we need to put all of them into v1.0, and update. Like, this hasn't been updated in ages, etc. I think there's more that I'm forgetting but for now, yeah, just go ahead."
- Screen: the Patch notes archive, with "v1.1 - Mikey's patch notes - 27 Sep 2026" at the top of the versions list, below it "v1.0 - 26 Sep 2026: Every problem, and its fix" and older entries v0.13 down. He is hovering over the v1.1 entry (13:15-13:25).
- CORRECTION: the top entry labelled v1.1 (Mikey's patch notes, 27 Sep) should not be numbered v1.1; he says it should be something like "v0.20".
- REQUEST: add his own versions 15, 16, 17 [presumably v0.15, v0.16, v0.17, and possibly v0.18] to the archive, folded into "v1.0", and update the archive since it is out of date. He says there may be more he is forgetting.
- Unclear: "should be like version... VO... 20" (13:12-13:16). The second pass gives "should be like version vo 20", which he may mean as "v0.20" or "v0 point 20". The "15 16 17" may be v0.15/0.16/0.17 (the transcript lost "point"). Whether "put all of them into v1.0" means merge them all into the existing v1.0 entry, or make the numbering start at v1.0, is not clear.
- "Just go ahead" (13:29-13:34) is addressed to Claude (he is about to send this to a Claude chat, as the 13:31 frame shows the Claude chat with its input box).
- The video ends at 13:35 on the Mac desktop.

## Grouped summary

### Questions
1. [00:28] How does sign-in work if the app frame has sign-in but the website also has sign-in?
2. [00:52] If there is no start screen on the website, how does that work, given it stays a web game as well as a phone game? (And [01:12] concern about not nerfing the web game.)
3. [01:14] Is Codemagic free?
4. [01:43] How does selling coins and adding things to the shop work (they were thinking a daily shop)?
5. [02:05] If the website is down the app is down. Is there a way for it to work completely offline? "Surely that's not how everyone does it."
6. [02:18] "Could we make more decisions on like a different ... iPhone app?" (garbled)
7. [02:47] If a feature (e.g. the ball bouncing on a shot) feels bad on web or on phone, can it be on one only? Would that mean putting gameplay mechanics into the frame?
8. [03:11] What if Android needed a different-looking UI (less flashy 3D)? What would we do?
9. [03:49] If a player plays offline (underground) and regains signal, can it upload to the cloud even when they're not in the app?
10. [04:13] What does "a full phone" mean (Say so if a save fails: today a full phone silently drops the save)?
11. [04:26] What does "not storing other club squads" mean? Does it mean we are not using real names?
12. [06:28] Do we need to test on Android phone and PC? (unclear)
13. [11:38] Would harry@knowitball.co.uk be the company email for everyone, or just Harry, or would everyone need one?
14. [12:16] If we made about £10,000 in the first year, what would the tax look like?
15. [12:45] How can we find out more about the "not confirmed" items?

### Decisions / opinions stated
- [03:35-04:07] Save to the cloud the moment the player leaves the app; close that gap.
- [05:06-05:39] On phone/PC save conflicts: it should just ask the player, not silently keep both. He wants a prompt on the PC ("we noticed you didn't save your cloud session; log in and save on the phone, or take the phone save"). The phone is the main platform.
- [06:46-07:10] He wants a wider beta anyway (about 100 people, TikTok call-out, two weeks of access, daily login).
- [11:09] Company activity will include YouTube, social media, games and possibly physical media.
- [11:23] Business bank account through Monzo or Starling.

### Requests
- [04:16] Answer his specific questions in the chat, not by rewriting the guide.
- [13:00-13:34] Fix the patch notes archive: renumber the "v1.1" entry, add v0.15, v0.16, v0.17 (and any others he has forgotten), fold into "v1.0", update the archive. "Just go ahead."

### Corrections
- [13:10] The patch notes archive entry labelled v1.1 (Mikey's patch notes) is not really v1.1 (should be like v0.20?). Also [13:27] the archive "hasn't been updated in ages".

### Concerns
- [01:12] Not nerfing the web game.
- [02:05] The app being down whenever the website is down.
- [02:47-03:20] Web and phone (and Android) feeling different or bad for some features or UI.
- [04:26] Not storing other clubs' squads might mean not using real names, "which is not good".
- [05:14] Keeping both saves automatically is confusing.

### Unclear or unreliable stretches
- 00:52-01:05: what he is testing about the website start screen.
- 02:18-02:47: sentence cut off after "could we make more decisions on like a different ... iPhone app", then about 30 seconds of no usable speech.
- 04:44-05:06: about 20 seconds mostly silent, then mid-sentence "keep both saves".
- 05:19-05:34: garbled ("you haven't saved your cloud session when you want").
- 06:28-06:43: question about testing on Android/PC is only partly heard.
- 07:10-07:25 and 07:39-10:55 (about 3 min 15 s): no speech (silent reading), only "Okay".
- 10:55-11:09: company name and "that'll be my address" wording is uncertain. No address is stated.
- 12:22-12:45: no usable speech.
- 13:12-13:20: version numbers unclear ("VO 20", "15 16 17").
- The phrase "get this done through that Discord and content" at 06:20 is uncertain.
