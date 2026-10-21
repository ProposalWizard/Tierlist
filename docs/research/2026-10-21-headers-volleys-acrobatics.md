# Headers, volleys and acrobatics: research (21 Oct 2026)

Research only. No game code was changed. Nothing was committed.

Harry's ask, word for word: "Research headers, volleys and acrobatics and try and really make it a really great feature, The same way other real highlights work, good animations, linked to a certain skill."

How to read the tags:

- **[M]** I measured it myself, this session. The method is in the appendix.
- **[C]** I read it in the code. I did not see it on a screen.
- **[S]** I read it in a source (a web page or a search summary). The source is named.
- **[R]** I reasoned it. It is my opinion, not a fact.

---

## 1. Summary for Harry (plain English)

### What real football says

1. **Headers are about 1 goal in 5.** About 16 shots in 100 are headers. About 18 goals in 100 are headers. [M, 34,853 shots from 1,401 matches] The Premier League's own figures are 16 to 20 headed goals in 100 in most seasons since 2003/04, with a low of 13.6 in 2019/20. [S, a search summary of premierleague.com, page not opened]
2. **Volleys and half-volleys are even more common.** About 21 shots in 100. About 23 goals in 100. [M]
3. **Bicycle kicks are very rare.** 6 shots in 1,000. 4 goals in 1,000. Only 13 goals in 1,401 matches, so one goal in about 108 matches. Only 6 in 100 of them score. [M]
4. **Diving headers are rare but good.** 4 shots in 1,000, but 20 in 100 score, because they only happen from very close (the middle one is 9 m out). [M]
5. **Distance decides almost everything.** A header from under 6 m scores 29 in 100. From 11 to 16 m it scores 4 in 100. [M]
6. **At the same distance a header is much harder than a foot shot.** From 6 to 11 m: foot 29 in 100, volley 20, header 9.5. [M] Headers look as good as feet overall (10 in 100 against 8.5) only because headers come from closer in. [M]
7. **Pressure hurts headers most.** Inside 16 m a header with a defender on him scores 7.6 in 100. A free header scores 13.7. [M]

### What we already have

1. **Headers and volleys are on.** They came back in build B10. Each is played as the end of one of the team's own cross drawings. [C, and REPORTS.md]
2. **The player's own strike has two checks.** Where you tap on the ball. When you tap (volleys only: the ball must be in the green band). [C]
3. **Technique already helps.** It slows the ball on the strike screen and softens a bad hit. [C]
4. **Power helps a little.** It sets how hard the header goes. [C]
5. **The animation clips for header and volley exist.** In 3D, in baked 2D sprites and in the drawn 2D figures. [C]
6. **There is no bicycle kick, scissor kick or diving header in the match.** A diving header clip exists in 3D but is not baked into the match sprites. [C]
7. **A flair stat and a bicycle kick are already planned** (`docs/plans/2026-10-20-flair-bicycle.md`). Nothing is built. [C]

### The biggest finding

**The real-highlights data already holds the right shots, with the real ball height.** [M, C]

- The ball height at the moment of the strike is in the tracking data. It comes from the DFL and SkillCorner matches.
- Of the open-play shots that pass the game's own checks, about 67 are header height (1.3 m or more, or a header) and about 102 are volley height (0.35 to 1.3 m). The rest, about 370, are on the ground. [M, my copy of the checks]
- The game serves none of these as headers or volleys today.
  - Real headers are left out. The check says "headers are switched off". That message is out of date. [C]
  - Real foot volleys are served as ordinary ground shots, with a still ball. [C]
- So "the same way other real highlights work" is mostly a switch. Serve those 169 shots as real headers and real volleys. No new drawings are needed.
- The game's rule is 5 real drawings before drawings take over. This pool is far bigger than 5.

### My recommendation in one table

| Move | Skill (from the skills we have) | Input on a phone | Picture |
|---|---|---|---|
| Header | **Power** (the jump and the neck) | Tap the ball where you want it (today) plus a timing band for the jump | Header clip exists. Add slow-mo and a camera punch. |
| Volley | **Technique** (clean contact) | The green band (today). Make Technique's effect visible. | Volley clip exists. |
| Bicycle kick and scissor | **Flair**, a new skill that grows with fame (already planned) | One more button on the strike screen: BICYCLE | Needs a new clip. It is the biggest job. |
| Diving header | Power, plus Flair for the dive | A DIVE button when the ball is low and wide | Clip exists in 3D. Needs baking. |

### What needs your yes (Harry)

1. **Changes to `canvasEngine.ts`.** Only needed to:
   - tune how team-mates head and volley by skill, or
   - add new move names to one type list (`BallActionMode`). I can avoid this one.
   - Everything else in my plan stays out of that file.
2. **The mix.** Real open play, inside 20 m: 13.6 in 100 shots are headers and 21.6 in 100 are volleys. [M] The game gives 10 in 100 to each. That is lighter than real, but the game's chances are not all shots. Your call. See section 6.
3. **Which skill for which move.** Section 2.
4. **Input for the bicycle kick.** A or B from the flair plan. I agree with the plan: A.

### Questions for you

1. Header = Power, volley = Technique, bicycle = Flair. Right?
2. Serve the real tracked headers and volleys now, ahead of any new animation?
3. Mix: keep 1 in 10 each, or move towards real (header 1 in 8, volley 1 in 6)?
4. Should a failed bicycle kick cost anything (a foul, an injury risk), or just waste the chance? The flair plan says just waste it.

---

## 2. Real football, with numbers (question 1)

### 2.1 Source of the numbers

- **StatsBomb open data** [M]. I pulled every shot from 1,401 men's matches:
  - Premier League 2015/16
  - Bundesliga 2015/16
  - Serie A 2015/16
  - Ligue 1 2015/16
  - World Cup 2018 and 2022
  - Euro 2020 and 2024
- Penalties are left out. That leaves 34,853 shots and 3,213 goals (9.2%). StatsBomb tags each shot with a technique (Normal, Volley, Half Volley, Overhead Kick, Diving Header, Backheel, Lob) and a body part.
- **Licence warning.** The project removed its StatsBomb data on 19 Oct 2026 (CLAUDE.md). I stored nothing in the repo. If these numbers ever appear in the game or on a page, check the licence and add the credit line first.
- **The repo's own Wyscout data** [M]: 2,875 shots (2018 World Cup and Euro 2016). Used as a cross-check. It has a body part, but no volley or overhead tag.

### 2.2 How common each move is [M, StatsBomb]

| Move | Shots | % of all shots | Goals | % of all goals | Goals per 100 shots | Middle distance |
|---|---:|---:|---:|---:|---:|---:|
| Foot, normal | 21,247 | 61.0 | 1,797 | 55.9 | 8.5 | 21.0 m |
| Header (all) | 5,780 | 16.6 | 603 | 18.8 | 10.4 | 8.9 m |
| Volley | 2,333 | 6.7 | 271 | 8.4 | 11.6 | 14.0 m |
| Half-volley | 4,888 | 14.0 | 463 | 14.4 | 9.5 | 16.4 m |
| Overhead kick (bicycle, scissor) | 204 | 0.6 | 13 | 0.4 | 6.4 | 11.9 m |
| Diving header | 149 | 0.4 | 30 | 0.9 | 20.1 | 9.1 m |
| Backheel | 136 | 0.4 | 15 | 0.5 | 11.0 | 8.6 m |
| Lob | 269 | 0.8 | 53 | 1.7 | 19.7 | 19.0 m |

Notes:

- The "foot, normal" row leaves out every header, volley and special technique. The header row includes diving headers.
- Per match, both teams together: 4.0 headers, 5.2 volleys and half-volleys, 0.15 overhead attempts. [M]
- Overhead tags are uneven: Premier League 63, Serie A 55, Ligue 1 51, the rest under 15 each. [M] Some data sets may tag them less. Treat 0.6% as roughly right, not exact.
- Wyscout agrees on headers [M]: 16.2% of shots, 18.2% of goals (55 of 303 including penalties).
- In the 232 non-penalty World Cup and Euro goals [M, `wyscout_goals.json`]:
  - 55 were headers (23.7%).
  - 45 foot goals came off a high pass (19%). Those are the volley and first-time candidates.

Beach soccer is a different game, so do not use it for 11-a-side. [S, FIFA Training Centre] At the 2024 Beach Soccer World Cup:

- 37 goals were bicycle kicks, 17% of all goals.
- Defenders blocked half of them: 244 block attempts, 50% success.
- A beach player says he scores one "once a season" in 11-a-side. That is one man's remark, not data. [S, FIFA.com]

### 2.3 Open play only, near goal [M, StatsBomb]

Open play means "Regular Play" and "From Counter".

| Within | Open-play shots | Headers | Volleys and half-volleys | Overheads |
|---|---:|---:|---:|---:|
| 60 m | 13,284 | 8.0% | 16.9% | 0.4% |
| 20 m | 7,812 | 13.6% | 21.6% | 0.64% |
| 16 m | 5,181 | 20.3% | 24.3% | 0.87% |

The shares of goals in open play inside 20 m are 12.3% headers and 19.9% volleys.

### 2.4 Goals per 100 shots, by distance [M, StatsBomb]

| Distance | Foot, normal | Header | Volley | Half-volley | Overhead | Diving header |
|---|---:|---:|---:|---:|---:|---:|
| 0 to 6 m | 63.1 | 28.8 | 46.2 | 42.3 | 20 (10 shots) | 42.9 (14 shots) |
| 6 to 11 m | 29.1 | 9.5 | 19.7 | 21.8 | 7.8 | 21.6 |
| 11 to 16 m | 15.8 | 3.6 | 8.4 | 9.4 | 5.6 | 8.8 |
| 16 to 25 m | 5.2 | 2.7 | 4.0 | 3.5 | 0 (22 shots) | 0 (4 shots) |

Plain reading:

- A header scores about 0.45 as often as a foot shot at 0 to 6 m. About 0.33 at 6 to 11 m. About 0.23 at 11 to 16 m.
- A volley or half-volley scores about 0.7 as often as a foot shot up to 11 m, and about 0.55 at 11 to 16 m.
- Bicycle kicks are short on shots, so only the shape matters. They are worse than a volley at the same distance.

### 2.5 What makes each one work [M where marked, [R] otherwise]

- **Distance.** Far the biggest factor. See 2.4. [M]
- **Pressure.** Inside 16 m, goals per 100 shots with a defender on the man [M]:

| Move | Under pressure | Free |
|---|---:|---:|
| Header | 7.6 | 13.7 |
| Volley or half-volley | 14.5 | 17.7 |
| Foot, normal | 19.3 | 22.3 |

- **First time.** 71 in 100 volleys and half-volleys are first-time. [M] Foot shots hit first time score 12.6 in 100. The rest score 6.9. [M] Distance mixes in here, so do not read it as cause and effect.
- **On target.** [M] Header 31%, volley 28%, half-volley 27%, overhead 25%, foot 34%. A volley is a "hit it and hope" shot. A header is not much better.
- **Does the xG model miss them?** Goals against model expectation [M]:

| Move | Goals | Expected goals |
|---|---:|---:|
| Header | 573 | 595 |
| Volley and half-volley | 734 | 724 |
| Overhead | 13 | 16.0 |
| Diving header | 30 | 28.5 |
| Backheel | 15 | 20.3 |

  Nothing is far off, so these moves are not secretly easier or harder than their position says. Overheads and backheels are a little below the model, but the samples are small.
- **Ball height, approach angle, body shape.** I found no free numbers for these. [S] FIFA's own article gives no heights. It says the bicycle kick needs the player to "lift the ball up" first, and that it often follows a poor pass or a through ball. [R] My guess from physics: the ball must be above the head, the man must have his back to goal or be side-on, and the cross must come from behind or beside him. That is the rule the flair plan already uses.
- **Real ball height at the strike** [M, DFL and SkillCorner tracking, open play, up to 35 m]:
  - 12% of strikes are header height (1.3 m or more, or tagged a header).
  - 19% are volley height (0.35 to 1.3 m).
  - 69% are on the ground.
  - The 20 DFL open-play headers were struck between 1.5 and 2.6 m, middle about 2.05 m (one at 3.9 m). [M]
  - SkillCorner heights are estimated from broadcast video, so they are less exact. [S, README]
  - Goal counts by height in this data set are too small to use (about 8 of 67 header-height, 14 of 104 volley-height). Do not build numbers on them.

---

## 3. Which skill governs each move (question 2)

### 3.1 In real football and EA FC [S, search summaries]

- Attributes: Heading Accuracy ("accuracy when using the head to pass, shoot or clear"), Jumping, Strength, Volleys, Finishing, Agility, Balance. [S, fifplay.com glossary]
- PlayStyles (EA FC 24):
  - **Power Header** raises header power and accuracy.
  - **Acrobatic** raises volley accuracy and unlocks acrobatic volley animations. In FC 25 it can also trigger the bicycle kick on its own in some situations.
  - **Aerial** raises jump height.
  - [S, gamesradar, dexerto, soccergaming, mein-mmo. I could not open the EA page itself for the exact wording.]
- So EA splits it into three things: a body stat (jump, strength), a technique stat (volleys) and a trait that unlocks the fancy animation. That matches my plan.

### 3.2 In our data

- The career has five skills: `pace`, `power`, `technique`, `vision`, `freeKick`. [C, `lib/star/types.ts`]
- Real squad players carry six numbers: pace, shooting, passing, dribbling, defending, physical. [C] The `heading` and `finishing` numbers exist in the importer (`lib/playerAttributes.ts`) but do not reach the squad players. [C]
- Today team-mates use `physical` for header power and the receiver's `skill` for the rest. [C]

### 3.3 Proposal: ONE skill per move

| Move | Skill | Why | What the skill changes |
|---|---|---|---|
| Header | **Power** | Power is the nearest we have to jump and strength. It already sets header pace. | Wider timing band. Higher ball you can still meet. Harder header. |
| Volley | **Technique** | Clean contact is Technique. It already slows the strike screen and softens a miss. | Wider "sweet" band. Smaller miss when mistimed. |
| Bicycle, scissor | **Flair** (new) | Flair is a risk-and-nerve skill, not a body skill. It grows with fame. | How often you may try. How clean it is. |
| Diving header | **Power** | Same body skill as a header. | Reach of the dive. |

Trade-offs:

- **Power for headers.** Power already sets how hard every strike goes. A player who trains Power gets a second benefit. That is fine and is how EA does it, but a pure-Power build becomes a header machine. Alternative: a new "Heading" skill. It costs a new training drill and a balance pass for little gain. I do not recommend it. [R]
- **Technique for volleys.** It already does three things (curl, loft, contact softening). A fourth is acceptable, but Technique is the busiest skill we have. [R]
- **Flair is genuinely new.** It needs a save field, an old-save backfill, a Stats row and a fame floor. The plan sizes it as half a day. [C, flair plan] Without a new skill, a bicycle kick would have to borrow Technique, and then one skill would run two moves. That breaks "one skill per move".
- **No skill for backheels, rabonas and flicks.** They are 0.4% of shots. Leave them for a later Flair unlock. The flair plan already asks this as question 2.

---

## 4. How other games make it feel great (question 3)

I found little. Most of what follows comes from search summaries, not from playing the games.

### 4.1 Input on a phone

- **FIFA Mobile** [S, EA gameplay guide]: one straight swipe towards goal triggers a shot, a volley or a header. The speed of the swipe is the power. Too hard and it goes over.
- **eFootball** [S, pesmastery heading tutorial]: header timing is the whole game. Press after the ball has peaked and is falling. Early and the man jumps too soon and misses. Late and he does not jump at all.
- **EA FC console** [S, mein-mmo and fifplay]:
  - The shoot button covers shot, volley and header.
  - A bicycle kick is hold L2 or LT while charging the shot on a high pass or cross. Two of the four charge bars are enough.
  - The Acrobatic PlayStyle helps volleys land and can trigger the bicycle kick automatically.
- **Score! Hero** [S, pocketgamer and others]: you swipe a path. Short is a gentle pass, long is power, an arc is curl. I found nothing about headers or volleys in it.
- **New Star Soccer** [S, pocketgamer and macworld]:
  - You pull back for direction and power.
  - A second screen lets you tap the ball for flight and curl.
  - Headers were added in the 1.52 update. I could not find how the input works.
  - This is already our strike screen.
- **Mini Football** and **PES (older)**: I found nothing usable.

What this tells us:

- Every game puts the move on the same button as a normal shot. The game decides which move it is from the ball's height. Our design does the same. [R]
- Timing is the skill test for headers. We have none for headers today. [C]
- The bicycle kick is a special extra, either a modifier or automatic. A button on the strike screen is our modifier. [R]

### 4.2 What makes it satisfying

These are my opinions, not sourced findings. [R]

- A short **slow-down** just before contact, then a **freeze** of a few frames at the hit.
- A **camera punch** at the contact.
- A **sound** that is different for a head, a volley and a clean strike.
- A **replay** of the best ones.

We already have the parts [C]:

| Part | Where |
|---|---|
| Wind-up, freeze at contact, camera punch, ball squash | `feelRef` in `components/star/CanvasMatch.tsx` and `lib/star/matchFeel.ts` |
| A "header" visual-effect event with 7 candidate looks | `lib/star/vfxLab.ts` |
| Goal videos with slow motion (0.35× through the strike) | `lib/star/goalClip/edit.ts` |
| Commentary lines for header and volley, and header replay lines | `lib/star/goalClip/commentary.ts` |
| Media feed "special goal" detector that already names volleys | `lib/star/media/detect/goals.ts` |

---

## 5. What exists in our code today (question 4)

### 5.1 Team-mates (AI) [C]

All in `lib/star/canvasEngine.ts`:

- `HEADER_MIN_Z` 1.3, `HEADER_MAX_REACH_Z` 2.6, `VOLLEY_MIN_Z` 0.35 (lines about 927 to 929).
- `strikeModeForHeight(kind, z)` (about line 3995). Only corners and byline crosses (`CROSS_DELIVERY_KINDS`) can give a header or volley. Height above the reach gives "ground".
- `firstTimeChance(mode, quality)` (about line 4033):
  - header: 0.55 + 0.35q, limited to 0.5 to 0.92
  - volley: 0.40 + 0.38q, limited to 0.35 to 0.85
  - ground: (q − 0.35) × 0.85, at most 0.55
- `launchReceiverShot` (about line 4044):
  - Header power is `(10 + composite × 0.11)` × a boost from `physical`. Its height is solved for a target of 1.5 to 2.15 m at the goal line. No curl.
  - Volley power is the ordinary power × 1.0 to 1.55, and it adds (1 − quality) × 9° of spread. [C]

### 5.2 The player's own strike [C]

- `components/star/ContactBall.tsx`:
  - "Head it?" is `motion = "float"`.
  - "Volley it?" is `motion = "bounce"`.
  - `handleTap` gives the tap position and the ball's height, and shows the verdict.
  - The ball slows with Technique: one sweep takes 2.2 s at Technique 40 or less, 3.2 s at 90.
- `lib/star/airborneChance.ts`:
  - `airContactRead` is pure, with no random number. The same tap is always the same strike.
  - `applyAirborne` starts the ball from its true height.
  - Header pace is ×0.72. Volley pace is ×1.06.
  - Constants are the `HEADER_*` and `VOLLEY_*` lines (glance 22°, slice 26°, sweet band 0.25 to 0.9).
- `lib/star/airDrawings.ts`: `derivedAirDrawings` makes header and volley pictures from the team's cross drawings. `HEADER_Z` is 1.85 m. `VOLLEY_MAX_Z` is 0.95 m. `airWaitZ` makes the hanging and bouncing ball.
- `components/star/CanvasMatch.tsx` (about lines 8863 to 8943): puts the air strike on the contact, passes your technique, calls `launch()` and then `applyAirborne()`.
- `launch()` in `canvasEngine.ts` (about line 5044): logs the animation mode from `scenario.kind` (header or volley).

What technique does on your strike [C, with the numbers worked out by me from the code constants]:

| Technique | Strike-screen speed | Volley sweet window per pass | Glance on a tap 0.6 from the middle |
|---|---|---|---|
| 30 | 2.2 s a sweep | 0.24 s | 12.3° and pace ×0.80 |
| 60 | 2.6 s | 0.29 s | 10.3° and pace ×0.84 |
| 90 | 3.2 s | 0.35 s | 8.4° and pace ×0.87 |

Header timing: **none.** A header's height only shifts from 1.57 to 1.85 m. [C] Power has no job on the strike screen, apart from header pace through the drag.

Measured by build B10 [REPORTS.md, not re-run by me]: goals from 500 headers at poor, average, elite finishers: 23.4%, 29.2%, 35.8%. Volleys: 23.0%, 28.4%, 35.4%. Before B10 they were headers 42.8 / 46.2 / 50.2 and volleys 37.4 / 40.6 / 33.6. The B10 test file `airChances.mts` passes when I run it (13 s). [M]

### 5.3 Real highlights (the pipeline to plug into) [C]

How it works today:

1. The match asks for a chance. `lib/star/chanceMaker.ts` picks its kind.
2. If it is an open-play chance of a kind the real moments have, 1 in 4 (`REAL_MOMENT_SHARE_IN` in `lib/star/fhr/realMomentHighlights.ts`) is a real moment.
3. The kinds are `REAL_MOMENT_KINDS = one_on_one, tight_angle, long_range`.
4. `serveRealMoment` builds the real positions of all 22 men, and `realMomentLeadIn` plays the real 4 seconds before.
5. Marks ("Use" or "Don't use") live in `data/realmoments/picks.json` and the `star_real_moments_picks` table. Today there are none.
6. A switch in Settings turns it on. It is off by default. `?fhr=on&realmoments=every` forces it for testing.

Why headers and volleys are missing:

- `lib/star/realMoments/shots.ts`:
  - `kindForShot` sends a header to kind "volley".
  - `playKindForShot` sends a foot shot in a crowded box to "one_on_one". So a real air-ball foot shot is served as a ground shot.
- `autoCheck` in `realMomentHighlights.ts` turns a header away with the text "a header (headers are switched off)". This is stale since B10. The comment at about line 52 says the same.
- `tracks.json` carries the ball height for every 0.2 s of the 4 s before the strike. `lib/star/realMoments/track.ts` already reads it (`z`). [C]

The data [M]:

| Data | Header height | Volley height | Ground |
|---|---:|---:|---:|
| DFL, passing the game's checks (my copy of them) | 28 | 16 | 87 |
| SkillCorner, passing | 39 | 86 | 283 |
| Total | 67 | 102 | 370 |

SoccerTrack has no ball height at all, so it cannot be used for this.

### 5.4 What is missing [C]

- Any timing for a header.
- Any visible link from Power to a header.
- Any skill number on the strike screen for volleys.
- Varying ball height. Every header arrives at 1.85 m and every volley bounces to 0.95 m. Real headers are struck between 1.5 and 2.6 m. [M]
- Real air-ball shots served with their true kind.
- Bicycle, scissor, diving-header and backheel moves, in input, physics and animation.
- Commentary, media and sound for a bicycle kick.

---

## 6. Animation (question 5)

### 6.1 Clips we have [C]

| Clip | Where | Notes |
|---|---|---|
| `header_stand` | Hand-made (`tools/anims3d/clips.py`, 1.1 s, contact at 0.50 s). Also a mocap version (`tools/mocap3d/clipdefs.py`, CMU trial 13_39, with a neck-snap edit). | Squat, jump, arch, neck snap, land. |
| `header_diving` | Hand-made only. Not in the mocap file. | 1.3 s, head contact at 0.40 s about 1.2 m up, body ends 0.8 m forward. |
| `volley` | Hand-made (1.15 s, contact 0.45 s). Also mocap (CMU 143_24, contact 0.56 s). | Right foot, side-on. Right foot only. |
| `chest_control`, `thigh_control`, `pass_lofted`, `shot_r`, `chip`, `first_touch` | Both sets | Support moves. |
| Baked 2D sprite clips | `lib/star/sprite3dAnim.ts`: `volley` 4 frames (strike on 2), `header` 5 frames (strike on 3) | Chosen by the ball action mode. |
| Drawn 2D figures | `lib/star/actionAnim.ts` (`HEADER_S` 0.55 s, a header jump, a volley whip) | Used when 3D is off. |

The ball action mode is a list in `canvasEngine.ts` line 73: `ground | volley | header | chip | curl`. [C]

### 6.2 Clips we would need

| Clip | New or edit | How I would make it |
|---|---|---|
| Header with a timed jump (peak, early, late) | An edit of `header_stand` | Run the contact time as a variable. Add an early-jump and a late-jump variant (two small edits in `clips.py`). |
| Mirrored volley (left foot) | A mirror | `mirror()` exists in `clips.py`. |
| Diving header baked into match sprites | Bake an existing clip | Add to the sprite bake. Needs a new frame list in `NEW_CLIP_SHAPE`. |
| **Bicycle kick** | **New** | Hand-key in `tools/mocap3d/keyed.py` (the way dives and tackles were made: no free capture exists). 3 phases: launch and lie back, legs scissor, land on the back and hands. About 1.3 s. |
| Scissor (sideways) | A variant of the bicycle clip | Same keyed move with less body roll and a lower body. |
| Backheel, flick | New and small | Optional. Later. |

Notes:

- **Higgsfield is OFF**, so no picture-to-3D and no generated reference video. [CLAUDE.md]
- **Motion capture.** `tools/mocap3d/video.py` can turn a video into a clip with MediaPipe. [C] All current video sources were Higgsfield-made ("hq-" clips). A new source would need a video we have the right to use. [R] MediaPipe struggles with an upside-down body and crossed legs (the limbs hide each other), so I would not rely on it for a bicycle kick.
- **CMU mocap.** I could not confirm whether CMU has a bicycle kick trial. I checked once and found only a "soccer kick" for subject 10. [S] Before keying by hand, someone should search mocap.cs.cmu.edu for "overhead", "scissor" and "bicycle" in the subject list. This is a ten-minute job. I did not do it. [R]
- **The "no body part inside another" rule (Harry, 20 Oct 2026)** [CLAUDE.md]. A bicycle kick is the hardest move there is for this rule: both legs cross over the torso, the thigh passes close to the chest, the arms land behind the body.
  - The checker exists: `tools/motionref/body_overlap.mts` (14 parts, every pair, every frame, `--gate`, named exceptions in `overlap_exceptions.json`). [C, REPORTS.md B5c]
  - The new clip must pass it with no new exceptions.
  - Plan time for this check. [R]
- **Camera.** The 3D match camera frames the 2D box and has a "set-piece" closer view. [C, handbook] A bicycle kick would want a low side-on cut-in. That is new work. Option: use the goal-video side camera for the replay only (`lib/star/goalClip/cameras.ts`, "side" and "tight" exist). [C]

---

## 7. Recommended design (question 6)

### 7.1 One rule for all moves

The ball's **height and direction when it reaches you** decide which move is on offer. This is the same way the real highlights and EA do it. [R]

| Ball height | Move |
|---|---|
| Under 0.35 m | Ordinary shot (today) |
| 0.35 to 1.3 m | Volley (half-volley if it just bounced) |
| 1.3 to 2.6 m | Header |
| Above reach, ball behind or beside you, 6 to 14 m out | Bicycle on offer, if Flair allows |
| Low ball, wide of you, close in | Diving header on offer |

The numbers 0.35, 1.3 and 2.6 are the engine's own (`HEADER_MIN_Z` and the others). I did not invent new ones. [C]

### 7.2 Header (skill: Power)

- **When.** A header chance from a cross drawing (today). Plus real tracked headers (new, section 7.7 step 1). Ball height varies from 1.5 to 2.6 m, drawn from the real spread. [M]
- **Input.** Same "Head it?" screen. Keep the tap on the ball (top nods it down, sides glance it, under loops it up). **Add one thing: a timing band**, like the volley's green band. The ball drops through the band once. Tap inside it for a clean jump. This is the eFootball lesson: early and late must both fail. [S, R]
- **Skill link, proposed numbers (design targets, not measured).**

| Power | Timing band (share of the drop) | Highest ball you can meet | Header pace |
|---:|---:|---:|---:|
| 30 | narrow | 2.1 m | ×0.9 |
| 60 | middle | 2.35 m | ×1.0 |
| 90 | wide | 2.6 m | ×1.1 |

- **Goal chance on a typical header chance** (target, to be measured before shipping; today it is 23 / 29 / 36 [REPORTS.md]):

| Power | 30 | 60 | 90 |
|---|---:|---:|---:|
| Goals per 100 | 20 | 29 | 40 |

  Keep the middle where it is. Widen the spread a little. [R]
- **Pressure.** Real headers with a defender on them score half as often (7.6 against 13.7). [M] Reuse the drawing's marker: if a defender is within about 1.5 m of you, narrow the band. The pictures already hold the marker. [R]
- **Picture.** `header_stand` with the jump timed to the tap. Slow-motion for the 0.3 s before contact. Freeze 3 frames. Camera punch. Replay in the goal video.
- **Sound.** A new head-on-ball thump. `public/sfx` has no header sound today. [C]

### 7.3 Volley (skill: Technique)

- **When.** A volley chance from a cross drawing (today) and real tracked volley-height shots (new).
- **Input.** Keep the green band. Show Technique's effect: make the band's width on screen match the table in 5.2 (0.24 s at 30, 0.35 s at 90 per pass). Today the player cannot see why a higher Technique helps. [R]
- **Skill link.** Technique already softens a miss (×1.12 at 30, ×0.76 at 90). [C] Add: a mistimed volley at Technique 90 still goes on target about half the time. At 30 it almost never does. (target, not measured) [R]
- **Goal chance target** (today 23 / 28 / 35): 18 / 28 / 40.
- **Picture.** `volley` clip. The mirrored version for a left-footed player. Hit-stop and camera punch from `matchFeel`.

### 7.4 Bicycle kick and scissor (skill: Flair)

I accept the flair plan almost whole (`docs/plans/2026-10-20-flair-bicycle.md`). My changes:

- **Offer rule.** Only on a header or volley chance where the ball arrives from behind or beside you, 6 to 14 m out. The rule only picks among chances that already exist. It places nobody. [R]
- **Offer rate.** The plan says Flair ÷ 2 in 100 of those chances. The real world offers it 0.15 times a match for two teams. [M] A new player at Flair 15 sees about 1 in 14 matches. An Icon sees about 1 in 3. That is a good game rate and is not real. It is fine, because the move should be a treat. [R]
- **Skill link, proposed targets** (to be measured):

| Flair | 15 | 45 | 80 |
|---|---:|---:|---:|
| Clean contact | 15 in 100 | 35 in 100 | 60 in 100 |
| Goal, per attempt | 4 in 100 | 10 in 100 | 20 in 100 |

  Real attempts score 6.4 in 100. [M] So a Flair 45 player sits just above real life, and the best sit well above. That is a fair price for rare, spectacular moves. [R]
- **Failure.** A miss wastes the chance. No injury or foul. That matches the plan.
- **Input.** Option A: one more choice on the strike screen: BICYCLE. The ring is half the size and the timing band is half as wide. I agree with the plan.
- **Picture.** The new keyed clip. A low side-on camera for the replay only.
- **Reward.** Media feed treats a clean one like a hat-trick goal. The plan says the same. New commentary lines. A new crowd roar.

### 7.5 Diving header (skills: Power, Flair for the dive)

- **When.** A low ball (0.5 to 1.2 m) arriving wide of you, 4 to 11 m out. Real diving headers are 0.4% of shots, 9 m out, and score 20 in 100. [M]
- **Input.** A DIVE button on the strike screen.
- **Goal chance target.** Same as a header, a little higher because the real figure is higher: Power 30 / 60 / 90 gives 22 / 30 / 40. [R]
- **Picture.** `header_diving` exists in 3D. It needs baking into the sprites and a recheck with the overlap tool.

### 7.6 What I would not do

- No backheel, rabona or flick yet (0.4% of shots).
- No separate "Heading" or "Volleys" skills (section 3.3).
- No injury risk for acrobatics.
- No beach-soccer rates.

### 7.7 Build order, in small pieces

Each piece is checked and signed off before the next (CLAUDE.md: "build slowly and correctly").

| # | Piece | Touches `canvasEngine.ts`? | Size |
|---|---|---|---|
| 1 | **Serve real headers and volleys.** Change `kindForShot`, `playKindForShot` and `autoCheck`. Add the kinds to `REAL_MOMENT_KINDS`. Set the ball's start height from the real z. Update the stale text and the tests. Show them on `/star-real-moments-dev`. | No | Small |
| 2 | **Header timing and the Power link.** `airborneChance.ts`, `ContactBall.tsx`. Measure goals by Power 30, 60 and 90 with the same method as B10. | No (`CanvasMatch.tsx` is on the "may drift" list) | Small to medium |
| 3 | **Volley: show Technique on screen.** Same files. Measure 30, 60, 90. | No | Small |
| 4 | **Varying ball height** for crosses (1.5 to 2.6 m). | No | Small |
| 5 | **Juice.** Slow-down, hit-stop, camera punch, header sound, commentary, goal-video slow-mo. All parts exist. | No | Small to medium |
| 6 | **Flair stat** (plan section 1). | No | Half a day |
| 7 | **Bicycle button and strike rule** (plan sections 2 to 4). | No | Small |
| 8 | **Bicycle clip.** Key it by hand, run the overlap check, bake the sprite. | A type name only (see below) | Medium to large |
| 9 | **Diving header.** Bake the clip, add the button. | A type name only | Medium |
| 10 | **Team-mates head and volley by skill.** | **Yes**: `firstTimeChance`, `launchReceiverShot` | Small, but needs Harry's yes and the match tests |

### 7.8 Flags

**Needs Harry's yes (the match engine file, `lib/star/canvasEngine.ts`):**

- Piece 10.
- Adding `bicycle` and `diveHeader` to the list `BallActionMode` (line 73). I can avoid this by storing the style on the strike (`contact.air.style`) and letting the sprite code read it there. Then pieces 8 and 9 stay out of the engine file. [R]

**If the engine file does change:** say so in the reply and the patch notes, run `node scripts/run-star-tests.mjs finishing keeper aiming outcomes`, and playtest. [CLAUDE.md]

**Other files with warnings:** `CanvasMatch.tsx` and `scenePicture.ts` ask for confirmation as "may drift". [CLAUDE.md]

**Conflicts with "scenario rules come from the drawings":**

1. **Header and volley pictures from cross drawings.** Allowed. Harry said so on 21 Oct 2026. [harry-answers-round.md]
2. **The two hand-set heights** (1.85 m and 0.95 m). Drawings are flat, so no drawing sets a height. They are hand-written numbers. Using the real height spread (1.5 to 2.6 m) is closer to the rule than the constants. Check each by eye. [R]
3. **The bicycle offer rule** (6 to 14 m, ball behind or beside). It is a hand-written filter. It does not place anybody, so the risk is low. The rule still says anything outside the drawings must be checked by eye: generate a sheet of pictures, look at every one, show them. [CLAUDE.md]
4. **Real moments.** Positions are real. No conflict. The "placed" Wyscout shots use the kind rules.
5. **Any new "bicycle" chance kind with its own placement would break the rule.** Do not add one. A bicycle is a way to strike an existing air chance.

**Other rules:**

- 3D sizes never change. Do not scale anybody for a bicycle kick. [CLAUDE.md]
- No test-page toggles for new work. Build as THE game, and keep unfinished work on a test page. [CLAUDE.md]
- Patch notes need a still for each look change and a short clip for animation changes. [CLAUDE.md]

---

## 8. Open questions already on file

- The 1-in-10 mix (OPEN-QUESTIONS.md). My numbers are in section 1 and 2.3. The honest answer is "lighter than real". It is also what keeps the game from being a cross-and-header game, because the game has about 6 chances a match and the real game has 12 shots a team. [R]
- Input A or B for the bicycle (flair plan). I vote A.
- Should the Kane mix get headers and volleys (Mikey)? Not looked at. Needs a re-measure.

---

## Appendix A. How I measured

1. **StatsBomb open data.** Fetched `competitions.json` and each match's events from the public GitHub `statsbomb/open-data` repo. Kept each Shot event's location, technique, body part, outcome, xG, first-time flag, play pattern and pressure flag. Dropped penalties and shots with no location. Kept 34,853 shots.
   - Distance is from the shot to the goal's middle, with StatsBomb's 120 × 80 yard pitch converted to metres (× 0.9144).
   - "Foot, normal" means technique Normal and body part not Head.
   - "Header" means body part Head, so it includes diving headers in the header row. The diving-header row is by technique.
   - Scratch script and data: `/tmp/claude-0/-home-user-Tierlist/06265a1b-84e9-513f-a9d9-be07aadc231e/scratchpad/sb/fetch.py` and `shots.json`. Not in the repo.
2. **Repo data.** `data/realmoments/wyscout_shots.json` (2,875 shots), `wyscout_goals.json` (232 goals), `tracked.json` and `tracks.json` (ball height at the strike frame, index `−t0 ÷ dt`). I counted open-play DFL and SkillCorner shots up to 35 m whose keeper is by his goal, with at least 19 men and a track of at least 21 frames. This copies `autoCheck` without calling it, so the counts may differ by a few from the game's.
3. **Technique numbers in 5.2** are worked out from the constants in `airborneChance.ts` and `ContactBall.tsx`. They were computed, not seen on a screen.
4. **Test run.** `node scripts/run-star-tests.mjs airChances`: 1 passed, 13 s.

## Appendix B. Sources

- Premier League, headed-goal share by season: [Season trends: Headed goals drop despite rise of target men](https://www.premierleague.com/news/1657048) and [planetsport](https://planetsport.com/soccer/feature/the-analyst-premier-league-headed-goals-crouch-benteke-antonio-kane). Read as a search summary only.
- FIFA Beach Soccer: [Bicycle kicks continue to be an effective attacking weapon](https://fifatrainingcentre.com/en/game/tournaments/fifa-beach-soccer-world-cup/2024/post-tournament-analysis/bicycle-kicks-continue-to-be-an-effective-attacking-weapon.php). Opened.
- FIFA.com: [The bicycle kick, football's most spectacular sight](https://inside.fifa.com/news/the-bicycle-kick-football-s-most-spectacular-sight-2862019). Opened. No numbers on height.
- EA FC PlayStyles: [gamesradar](https://gamesradar.com/fc-24-playstyles-list), [dexerto](https://www.dexerto.com/ea-sports-fc/ea-fc-24-2216389/), [soccergaming](https://soccergaming.com/fc-24-playstyles-explained/). Search summaries only. I could not open the EA deep-dive for entries.
- EA FC bicycle kick controls: [mein-mmo](https://mein-mmo.de/en/ea-fc-25-how-to-perform-the-bicycle-kick-for-spectacular-goals,1245071), [fifplay controls](https://www.fifplay.com/fc-25-controls/). Search summaries.
- Attributes glossary: [fifplay](https://www.fifplay.com/fc-25-attributes/). Search summary.
- FIFA Mobile controls: [EA guide](https://www.ea.com/games/fifa/news/gameplay-guide). Search summary.
- eFootball heading: [pesmastery](https://pesmastery.com/efootball-heading-tutorial/). Search summary.
- Score! Hero: [pocketgamer](https://www.pocketgamer.com/score-hero/review/), [trustedreviews](https://www.trustedreviews.com/score-hero-review). Search summary.
- New Star Soccer: [pocketgamer 1.52 update](https://www.pocketgamer.com/articles/054583/r/), [macworld](https://www.macworld.com/article/666864/new-star-soccer-for-ios-review.html). Search summary.
- StatsBomb open data: [github.com/statsbomb/open-data](https://github.com/statsbomb/open-data).
- Repo: `docs/plans/2026-10-20-flair-bicycle.md`, `docs/handoffs/2026-10-20-builds/REPORTS.md` (B10), `OPEN-QUESTIONS.md`, `docs/plans/2026-10-19/harry-answers-round.md`, `data/realmoments/README.md`, `docs/3D_HANDBOOK.md`.

## Appendix C. Code map

| Topic | File and function |
|---|---|
| Team-mate header, volley | `lib/star/canvasEngine.ts`: `HEADER_MIN_Z`, `HEADER_MAX_REACH_Z`, `VOLLEY_MIN_Z`, `strikeModeForHeight`, `firstTimeChance`, `launchReceiverShot`, `receiverQuality` |
| Player's strike | `launch()` (canvasEngine.ts), `lib/star/airborneChance.ts` (`airContactRead`, `applyAirborne`), `components/star/ContactBall.tsx` (`ballMotionAt`, `handleTap`), `components/star/CanvasMatch.tsx` (about 8863 to 8943) |
| Header and volley pictures | `lib/star/airDrawings.ts` (`derivedAirDrawings`, `HEADER_Z`, `VOLLEY_MAX_Z`, `airWaitZ`, `airArrival`) |
| Switched-off list (empty) | `lib/star/switchedOffKinds.ts` |
| Real moments | `lib/star/realMoments/shots.ts` (`kindForShot`, `playKindForShot`), `lib/star/fhr/realMomentHighlights.ts` (`REAL_MOMENT_KINDS`, `autoCheck`, `serveRealMoment`), `lib/star/realMoments/track.ts`, `data/realmoments/*.json` |
| Real Goals (test page) | `lib/star/realGoals.ts` |
| Skills | `lib/star/types.ts` (`Skills`: pace, power, technique, vision, freeKick) |
| Body reach | `lib/star/hitbox.ts` (`jumpHeight` 0.5, `headerBonus` 0.3) |
| Clips | `tools/anims3d/clips.py` (`header_stand`, `header_diving`, `volley`), `tools/mocap3d/clipdefs.py`, `tools/mocap3d/keyed.py`, `lib/star/sprite3dAnim.ts`, `lib/star/actionAnim.ts` |
| Overlap check | `tools/motionref/body_overlap.mts`, `overlap_exceptions.json` |
| Juice | `lib/star/matchFeel.ts`, `lib/star/vfxLab.ts`, `lib/star/goalClip/edit.ts`, `lib/star/goalClip/commentary.ts` |
| 3D drill (test bed) | `lib/star/play3d/headersVolleys.ts` (header 2 points, volley 3) |
