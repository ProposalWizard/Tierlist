# "HUGE UPDATES" review (Harry, 1 Oct 2026, 43 min): analysis

Source: `points.md` (111 points, P# below) and `pointing.md`. The video is a review of the v0.20 and v0.21/v0.22 pages, compared against NSS (New Star Soccer) on Kongregate.

## The verdict
1. **The game feels like a website, not an app** (P100, P74). It looks fine on a PC and much worse on a phone. The fixes he points at are the ones below: no floating pills (P73, P87), one heavy font everywhere (P105), a top HUD like NSS (P80, P86), arrows instead of stacked tab rows (P47), a fixed bottom bar (P41), and square progress bars (P85, P107).
2. **No explanatory text anywhere** (P4, P5, P12, P13, P15, P51, P85, P90). Explain with NSS-style pointer pop-ups that run in order over the real screen (P7, P9, P10, P42, P67, P68). A "?" brings one back later.
3. **Priorities, in his order:** UI and Home first, "even more important" (P61). Non-League North and South must be playable, "a final decision from me" (P62).
4. **Shipping:** "one push" of everything except the gameplay LOOK, so others can see it (P109). The look and feel of the engine (ball size and weight, pitch texture, camera, keeper, figures) is a separate, slower project with its own page (P110).

## Version number
He calls this batch "0.22" (42:09, 42:57). His rule in chat was "chronologically bump everything up one if I misspoke". The UI & Home page is already v0.22, so **this batch is v0.23**.

## Workstreams (who builds what)
- **W1, logic (top model):**
  - Non-League North and South become playable divisions (P62).
  - The trial ends in "a scout has spotted you". Where you start is random, and scoring the final shootout penalty raises your chance of the National League over North/South (P36, P63).
  - The star rating can go down: a sustained run of poor form can cost a whole level (P14).
- **W2, trial (everyday model):**
  - Your player is shown only for penalties and free kicks (P30).
  - The Technique drill no longer draws the penalty box (P31).
  - Find the Pass comes back as the 5th drill (P32).
  - The other drills are one attempt each (P33).
  - The trial ends with a quick shootout, Trialist v Academy, up to 3 kicks each, rigged so you take the winning kick (P33, P35, P37).
  - No trial score and no "No contract" card (P36).
  - The trial cards use the light, basic look (P34).
  - The whole trial is shorter (P35).
- **W3, Home + HUD + global look (everyday model):**
  - A top HUD of pills that changes per screen, with energy always shown and the can next to it (P79–P81, P86).
  - The star rating becomes a square pill with a real progress bar (P80).
  - The Energy row comes off the card, and the PK/FK pills go (P72, P78, P81).
  - Next fixture returns to how it was; the button reads BUY when you have no cans (P76).
  - Spin your player on Home; tap him for celebrations (P52, P77).
  - The Home background is a pitch with the goal behind, fading in rather than a pill (P75, P82).
  - The age chip no longer covers the floodlight (P72).
  - A mini league table sits under Next Match (P96).
  - Sponsors becomes a small arrow at the bottom right (P66).
  - The Pitch font is used everywhere (P105), the Pitch card blends into the green (P106), and progress bars are square (P107).
- **W4, screens (everyday model):**
  - Stats uses edge arrows instead of three tab rows, and the league table leaves Stats (P46, P47, P96).
  - Style loses its title and Back button, gets a fixed bottom bar, and its top 40% is reclaimed (P39–P41).
  - Relations has no text, square animated bars and a "?" (P85–P87).
  - Phone: the Close button becomes phone-like, the red dot shows only while something is unread, empty pages are not blank, and items you don't own are shown blacked out (P88–P90).
  - Pre-match becomes a short line-up animation, with a prompt only if energy is low (P91, P93).
  - The match opening looks like a pitch (P94).
  - The bolt buttons run green → yellow → red (P95).
  - The run-up options move to a Play style section (P84).
  - 3D/2D gets a pointer that explains it (P83).
- **W5, tutorial and flow (everyday model):**
  - NSS-style pointer tutorial that runs in order (Home, your player, then Go to training, the two drills, then "to earn coins, play your first game") (P67, P68, P104).
  - A "?" help button on each screen (P42).
  - The star popup becomes a short pointer; "1 to 100", "never goes down" and Star Pass lines are removed. The points breakdown moves to a Star Pass section that is locked until the tutorial is done (P10, P12, P13, P15).
  - Hidden numbers are removed everywhere: Penalties: Palmer, the +N star points lines, the "A session: 30 energy…" sentence (P4, P5, P51).
  - Post-match runs in order: rating, then relationships, then wage/bonus/cash, then achievements one at a time; you can't skip until all are seen (P27).
  - A short breaking-news pop-up appears after signing and after big events (P28, P50).
  - Boss meeting loss: −8 → −4 (P69, P98).
  - Phone: one item at about 800, the first Style unlock, lasts two seasons, and flashes with a pop-up. Apps cost real money (P70, P71, P102, P103).
- **W6, pictures (everyday model):**
  - Every shop picture becomes a Blender render, with no mix of drawings and renders (P56, P57).
  - No real photo faces on 3D figures unless it's your own player (P49).
- **W7, the rest of the UI points (everyday model, after W4/W5):**
  - Star gates open a scrolling level 1–5 view showing what each level unlocks (P11).
  - NSS-like title screen: pitch, ball and net, your player standing on the left (P82).
  - Fixtures and league on one page, with a notification bell in the middle of the bottom bar (P90).
  - The Pitch look used in training, drills and the match screens (P92).
  - The boss-meeting game and the phone purchase shown in the rendered style (P70).
- **Side project (later):** the 3D walk-around for the manager signing and a 3D home/garage (P59, P60, P97).
- **Separate page (later):** the gameplay look. The NSS comparisons are listed at the bottom of points.md.

## Questions for Harry (one word each)
1. "One push": put everything on the Harry branch (team can see it) or also on the live site? (Harry / live)
2. Star rating going down: a level is lost after about 5 poor matches in a row (rating under 5.5). OK? (yes / other)
3. NSS-style tutorial vs the existing unlock chain: keep the locks and replace only the pop-ups? (yes / no)

## Answered here (his direct questions)
- **ElevenLabs:** yes. Store the API key as an environment variable in this environment's settings (the variable name I will read is `ELEVENLABS_API_KEY`), not in chat. Its server is reachable from here.
- **3D shop:** it is real 3D running in the browser page itself (the same way the game runs), not Blender. Blender makes the still pictures. Blender models can be exported and loaded into it, which is how the textures could reach the render's level.
