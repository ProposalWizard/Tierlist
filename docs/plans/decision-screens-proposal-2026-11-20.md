# Better decision screens and talk menu: research and proposal

For Harry. 20 Nov 2026. Nothing in the game was changed; these are pictures and a plan.

**Key point:** build direction C (the football hybrid). It takes the slow-motion clock and the "will remember that" notice from Telltale, the bubbles-around-a-person talk menu from The Sims, and adds a tone dial that only a football game has.
**Key number:** about 5 to 6 working days for a first playable version, in 4 steps, each one usable on its own.
**Key change:** a decision stops being "a card with 3 green buttons" and becomes a moment in the world: the 3D scene stays on screen, big moments run on a clock, and every answer has a tone.

All pictures are mock-ups (HTML drawn over real stills of the game). I looked at every one. None is in the game yet.

## Pictures

| What | File |
|---|---|
| All six phone screens side by side | `all-directions-sheet.jpg` |
| A: slow-motion moment with the clock | `A1-telltale-slowmo-timer.png` |
| A: clock nearly out (bar turns red) | `A1b-telltale-timer-low.png` |
| A: "Ferreira will remember that" | `A2-telltale-remember-toast.png` |
| A: 7.5 s video, slow-mo → clock → pick → notice | `A-telltale-slowmo.mp4` |
| B: talk bubbles around a person | `B1-sims-radial.png` |
| B: after tapping Banter | `B2-sims-radial-banter.png` |
| C: the tone dial (press, no clock) | `C1-hybrid-tone-dial.png` |
| C: how it landed | `C2-hybrid-outcome.png` |
| C: a big moment on a computer, with the clock | `C3-hybrid-big-moment-PC.png` |

All in `/tmp/claude-0/-home-user-Tierlist/b3e40a5d-8375-5f33-bf31-5b59e99a7327/scratchpad/decision-screens/`.

## 1. What the other games do, and why it feels heavy

Where a line has a link, it comes from that page. Where it says "(from memory)", it is my own knowledge of the game and I did not find a page for it today.

### Telltale: The Walking Dead, The Wolf Among Us, Batman
- **2 to 4 short answers, one per button.** Short enough to read in a second. (from memory)
- **A shrinking clock bar.** One study calls it "a rapidly shortening line" ([Erion, Games Criticism](https://gamescriticism.org/2023/08/23/erion-5-a/)). Giant Bomb says timed decisions add urgency and make talk more believable than people standing waiting for you ([Giant Bomb](https://giantbomb.com/wiki/Concepts/Timed_Decisions)).
- **Silence is an answer.** The game tells you so at the start. If the clock runs out, silence is picked for you ([Gamepressure guide](https://www.gamepressure.com/thewalkingdead/hints-and-information/zf417c)). People in the scene react to it; you may stay quiet because it means more ([Game Developer](https://gamedeveloper.com/business/why-the-slow-burn-of-telltale-s-the-walking-dead-works-)).
- **"Clementine will remember that."** A small notice in the top corner after an answer. Some answers matter with no notice at all (same Gamepressure guide). In Batman the notice itself tells story: "Harvey will remember that" becomes "Two-Face will remember that" ([Dread Central review](https://dreadcentral.com/reviews/206606/batman-telltale-series-video-game)).
- **The warning from Telltale's own history:** players turned on the notice when nothing came back later. "So and so will remember this", then nothing shows that they did ([The Outer Haven](https://www.theouterhaven.net/2016/12/batman-the-telltale-series-season-01-review), [PC Gamer](https://pcgamer.com/im-over-the-fact-that-choices-dont-really-matter-in-telltale-games)). Our rule must be: show the notice only when a real memory is stored. We already do store one (`Remember` in `lib/star/life/types.ts`), and callbacks already bring it back. So we can keep the promise Telltale broke.
- **End-of-episode numbers** ("you and 62% of players…"), and Batman's recaps added crowd numbers ([God is a Geek](https://godisageek.com/2016/07/batman-telltale-games-multiplayer-voting-system/)). These need a server.
- **Slow motion and drained colour during a timed choice, and quick-time button presses:** from memory. Telltale mostly holds the scene still while the bar runs; the full grey-out is stronger in Detroit and Life is Strange. Harry's "timed slow motion" idea is a blend of these, and it is the right blend.

### The Sims 4
- **A pie menu on the person you tap, by category:** Friendly, Funny, Mean, Mischief, Romance ([Prima guide](https://primagames.com/eguides/the-sims-4-eguide/meet-other-people/relationships-and-socializing)). A later update added sub-groups because the lists got too long ([Sims Community](https://simscommunity.info/2023/09/25/sims-4-relationships-guide/)). Lesson: 5 or 6 bubbles, then at most 3 lines each.
- **Mood changes the menu.** An angry Sim gets more mean options ([Prima, emotions](https://primagames.com/eguides/the-sims-4-eguide/feelings-lots-of-feelings/emotions)). The talk has a running mood too (pleasant, awkward) ([Carl's guide](https://carls-sims-4-guide.com/relationships)).
- **Bars over the head** (friendship green, romance pink) pop up and move after each line, with + and − signs; **picture bubbles** over heads show what people chat about on their own. (from memory)
- Why it works: you see the person, their mood and the bar move, all in the world, with no separate screen.

### Others
- **Mass Effect:** a wheel where position means tone (top = kind, bottom = hard), so you answer by feel before you read ([TechRadar](https://www.techradar.com/news/mass-effects-dialogue-system-started-with-real-promise-and-went-downhill-from-there)). Mass Effect 2 added a short flashing prompt to cut in mid-scene; not taking it is not punished ([TheSixthAxis](https://www.thesixthaxis.com/?p=30861), [Wikipedia](https://Wikipedia.com/wiki/Mass_Effect_2)). Critics' warning: a wheel can turn talk into "pick blue or red" ([TheGamer](https://www.thegamer.com/mass-effect-dialogue-wheels-are-flawed/)).
- **Detroit: Become Human:** after each chapter a flow chart shows the roads you took and the ones you did not, with world percentages ([Shacknews](https://shacknews.com/article/105092/choices-endings-and-walkthrough-detroit-become-human), [DiGRA paper](https://dl.digra.org/index.php/dl/article/download/1954/1953/1950)).
- **Life is Strange:** a butterfly in the corner says "this action will have consequences" ([Feral manual](https://www.feralinteractive.com/en/manual/lifeisstrange/latest/steam/)). Later games added a setting for longer choice times ([Square Enix](https://square-enix-games.com/en_AU/news/life-is-strange-double-exposure-accessibility)). We should have that setting from day one.
- **FIFA 17 The Journey:** three tones, Cool, Balanced, Fiery. Cool pleases the manager, Fiery wins followers and costs you with the manager ([PCGamesN](https://pcgamesn.com/fifa-17/fifa-17-pc-the-journey-rpg), [GamingBolt](https://gamingbolt.com/?p=268938)). Weakness: only two meters, so it became a formula.
- **Football Manager:** team talks have a tone as well as words, and each player shows how he took it; the same line lands differently by his mood and character ([SI manual](https://community.sigames.com/manual/football-manager-2022/matchday-r989/), [FM Scout](https://www.fmscout.com/a-team-talks-guide-managing-morale-and-confidence.html)).

### What makes them feel weighty (the 6 things to copy)
1. **The world stays on screen.** You answer a person, not a card.
2. **Time pressure, but rarely.** A clock on everything is tiring; on one moment in ten it is a thrill.
3. **Silence counts.** Not answering is an answer with its own result.
4. **Short answers with a clear tone.** You choose how to be, then read the words.
5. **The game says it noticed** ("will remember that"), and later proves it.
6. **You see who heard it** and their bars move.

## 2. Three directions

### A. Telltale style (pictures A1, A1b, A2, video)
- **Screen:** the 3D scene stays. For a big moment it slows to about a tenth speed and goes grey; the person you are answering keeps his colour. Black bars top and bottom. His line as a subtitle. A white bar shrinks to the middle, amber under 40%, red under 20%. Three answers with a colour strip and one tone word (Honest blue, Lie amber, Fiery red), plus "… Say nothing".
- **Clock:** only on events marked big, 8 seconds by default. Setting: Decision clock: Normal | Long (×2) | Off. With Off, the grey slow-mo still plays, with no bar.
- **Time runs out:** you said nothing. That is a written answer with its own results.
- **After:** colour and speed snap back. A notice slides in top-left: "Ferreira will remember that." Small chips under it. His reply as a subtitle.
- **Computer:** same layout, centred, keys 1 2 3 and Space for silence.
- **Good:** biggest drama for least building. **Weak:** it is somebody else's game; nothing in it is football.

### B. Sims style (pictures B1, B2)
- **Screen:** tap a person in 3D. Six bubbles open round his head: Friendly, Banter, Football, Business, Mean, See you. A small plate above him: name, mood face, Bond bar, Respect bar. Tap a bubble: three lines to pick from, each with a hint (▲ Bond, ▲▼ Risky). Other people get picture bubbles over their heads while they chat on their own.
- **Clock:** none. This is free time.
- **After:** the bar on his plate moves and a "+2" floats up; he answers in a speech bubble.
- **Computer:** the same wheel at the mouse; right-click closes.
- **Good:** makes the 3D world feel alive, replaces the plain Chat / See you card. **Weak:** it is a talk menu, not a decision screen, and it needs 15+ short lines per kind of person to not repeat. Bubbles must sit in clear space (the camera has to put him near the middle).

### C. Football hybrid (pictures C1, C2, C3) — recommended
- **Three sizes of moment, three looks.**
  - *Small talk* (garden, house, training ground): B's bubbles. No clock.
  - *Normal events* (press, agent, a text): the **tone dial**. Humble, Calm, Confident, Fiery on a half circle. Turn it and "You will say" changes. Under it, "Who is listening": Boss, Fans, Dressing room, the reporter, each with an arrow guess. A guess, not a promise: a man with a grudge may twist it. "… No comment" sits beside the green "Say it". No clock.
  - *Big moments* (half-time 0–2 down as captain, a team-mate squaring up, the manager's office): A's slow motion and clock, with either the dial or A's three answers. Expect about one in ten events.
- **Time runs out:** you say nothing, and silence is written per event (a captain who says nothing at half-time loses the room a little; a player who says nothing to a tabloid man is often right).
- **After (C2):** the "will remember that" notice, then "How it landed": four bars that grow or shrink, the change in green or red.
- **Numbers without a server.** Two honest ones:
  - "4 of 11 team-mates would have bitten back too": worked out from your own squad's characters, on the phone.
  - "Your voice this season": a bar of how often you were Humble, Calm, Confident, Fiery. This can later feed a reputation ("hot-head", "company man") that events read.
  - Real "62% of all players" numbers need a server. Not in this plan. We must never show an invented percentage.
- **Computer (C3):** scene and words on the left, dial on the right; ← → turn, Enter says it, Space is silence.
- **Good:** only a football game can have it (press room, dressing room, tone), and it reuses what we store today. **Weak:** each answer now needs a tone label, and dial events need a line per tone.

## 3. Recommendation

**C, built in the order A-parts first.** The clock, the slow-mo, silence and the notice give the largest lift and work on today's events with no new writing. Then the bubbles, then the dial.

Two rules to hold:
- **No notice without a memory.** "X will remember that" shows only when the answer stores one.
- **The clock is rare and can be turned off.** Big events only; Normal | Long | Off in Settings; "reduce motion" on the device also removes the slow-mo zoom.

One thing I disagree with in the brief: "% of players chose this" should not ship as a local fake. The squad number and "your voice" do the same job honestly.

## 4. Build plan

Read-only check of what exists: events are data (`LifeEvent`, with `size: small | medium | big`, `choices`, `remember`, `callbacks`); the card is `components/star/life/EventCard.tsx` (228 lines) with `life.css`; the 3D talk card is `InteractCard` / `personCard()` in `lib/star/world3d/interact.ts`, drawn by the page. So most of this is new screen work on data we already have.

| Step | What changes | Days |
|---|---|---|
| 1. Tone + silence in the data | `LifeChoice` gets optional `tone` and `silent`; big events get an optional `clockSeconds`. Tag the existing book (a tone word per answer; add a silence answer to big events). Validator checks every big event has one. Old saves need nothing. | 1 |
| 2. The big-moment screen (A) | New `DecisionMoment` component beside `EventCard`: grey slow-mo layer, clock bar, tone strips, silence, time-out picks silence. New "will remember" notice replacing the yellow chip in `OutcomeCard`; "How it landed" bars replace the chip list. Setting: Decision clock Normal / Long / Off. On `/star-life-dev` first. In 3D the slow-mo is one hook on the world kit's clock (scale time 0.1) plus a CSS grey filter on the canvas. | 2 |
| 3. Talk bubbles (B) | `personCard()` returns categories and lines instead of Chat / See you; the page draws bubbles round the person's screen position (the kit already knows where his head is for tap-to-talk); name plate with mood and two bars from `LifePerson`. Needs about 60 short lines (5 kinds × 3 lines × 4 sorts of person). | 1.5 |
| 4. The tone dial (C) | Dial control (drag, tap, arrow keys); events with `template: talk-scene` and a line per tone use it; "Who is listening" guesses from the outcome with the highest share; squad number and "your voice" count in `LifeState`. Write dial lines for press and dressing-room events first (about 10 events). | 1.5 |

About 6 days. Steps 1 and 2 alone (3 days) already give Harry the Telltale feel on every big event.

**Not in this plan:** quick-time button presses, a Detroit-style flow chart of the career (a good later idea for the season review), real all-player percentages, voice.

**Risks:**
- The slow-mo in 3D touches `lib/star/world3d`, which other builders are editing now. Step 2 should land on the life test page first and hook into 3D after their work is in.
- Backdrop filters over a live 3D canvas cost frames on weak phones. Grey the canvas with one CSS filter, no blur, and measure.
- Writing load: tone lines are the real cost of the dial. Start with 10 events.

Recommend a playtest once step 2 exists: the clock length (8 s) is a guess and only feel can set it.
