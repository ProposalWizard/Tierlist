/**
 * lib/patchNotesData.ts — THE PATCH NOTES THEMSELVES.
 *
 * ── Why these are a file and not a database table ──
 *
 * They were a table first. Asked directly, looking at a page that said
 * MIGRATION NOT RUN: "why is this needed". It was not.
 *
 * Nothing authors a patch note through the web UI — they are written in a
 * session, alongside the work they describe. So the content was already in
 * the repo, as a 314-line SQL file, and the table was a middleman you had to
 * hand-feed: write a migration, paste it into the Supabase SQL Editor, and
 * until you did, the page showed a red banner instead of the notes. Two
 * copies of one truth, and the copy that shipped was the one nobody could
 * read.
 *
 * As a file it is in git, reviewable in a diff, revertible, survives
 * anything that happens to the database, and is live the moment it deploys.
 * Same argument authoredScenarios.json already makes for scenarios.
 *
 * The table, its migration and its API route are gone. Keeping a disabled
 * half of a system around is how two copies of one truth start again.
 */

import type { PatchNote } from "./patchNotes";

/** Newest first — the order the archive shows them in. */
export const BUILT_IN_PATCH_NOTES: PatchNote[] = [
    {
      "version": "1.0",
      "title": "V1: every problem and its fix",
      "publishedAt": "2026-09-25T12:00:00Z",
      "summary": "Every change from every patch notes version so far (v0.1 to v0.10.1), from Harry, Leo and Mikey, oldest first. Each item says what was wrong; open \"Why, and the fix\" for why it happened and what fixed it. The guard is the headline.",
      "stats": [
        {
          "value": "115",
          "label": "problems fixed or features added, 21–24 Sep"
        },
        {
          "value": "12",
          "label": "patch notes versions folded into this one"
        },
        {
          "value": "85 · 13 · 18",
          "label": "changes by Harry · Leo · Mikey"
        },
        {
          "value": "27",
          "label": "known issues still open (16 raised along the way are now fixed)"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "The headline: the guard",
          "items": [
            {
              "title": "The guard: the game can't quietly split into copies again (v0.10 · Harry)",
              "detail": "The trial, training and five-a-side felt slightly different from a real match: the keeper dived differently, kicks came out harder or softer, and five-a-side's arrow pointed a bit off.",
              "bars": [
                {
                  "label": "Copies of the match",
                  "was": 6,
                  "now": 4,
                  "state": "warn",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Six screens had their own copy of the match. Each was right on the day it was made; the real match kept improving and the copies drifted (12 differences in the trial and training alone). Nothing stopped a new copy.",
                  "Fix: Every screen now plays the real match through one door and adds its extras around it. An automatic check (the guard) reads the code before every deploy and stops the site going live if anyone adds a copy. 4 copies left, down from 6; the list can only shrink."
                ]
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Problems fixed",
          "items": [
            {
              "title": "Scoring was halved (v0.1 · Harry)",
              "detail": "With the new chance generator switched on, far fewer chances went in: a cutback or a one-on-one converted only 9.8% of the time.",
              "bars": [
                {
                  "label": "Cutback",
                  "was": 9.8,
                  "now": 41.3,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "One-on-one",
                  "was": 9.8,
                  "now": 47.6,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Tight angle",
                  "was": 13.3,
                  "now": 39.7,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Header",
                  "was": 6.6,
                  "now": 26.8,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Through ball",
                  "was": 11.2,
                  "now": 18.7,
                  "state": "warn",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Four separate bugs. The keeper's tuned position was overwritten so he was always in the right place; cutbacks came from the touchline (20.2m off centre instead of 11.5m); the check for a defender in the way was blind (it found 0 of the 223 real blockers in 300 cutbacks); and two rules ran in the wrong order, so one put a man straight back in the shooting lane.",
                  "Fix: All four fixed, nothing re-tuned by hand. A one-on-one now scores more than its old number on purpose: the old one had a defender in the way 99.8% of the time, so it was never a real one-on-one. Through balls are still low."
                ]
              }
            },
            {
              "title": "The goal changed size from chance to chance (v0.1 · Harry)",
              "detail": "Harry reported the goal should look the same every time, just moved up, down, left or right. 69% of chances were framed at the wrong size.",
              "bars": [
                {
                  "label": "Frame sizes in use",
                  "was": 3,
                  "now": 1,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Three causes: the Scenario Builder had a free zoom slider with a 5x range; the generator used three different frame heights (69.2% weren't the standard one); and the frame quietly grew to keep the keeper in shot (another 10%).",
                  "Fix: One frame size everywhere, so the goal sits in the same place every chance. Cost: a tight angle from right on the touchline no longer fits, so that one band of tight angles was dropped."
                ]
              }
            },
            {
              "title": "A tighter camera made the goal go missing (v0.1 · Harry)",
              "detail": "A camera that zoomed in closer shipped, and in play the goal was often not on screen. Harry sent five screenshots. The whole goal showed in only 63.9% of chances, and 0% of tight angles.",
              "bars": [
                {
                  "label": "Whole goal on screen",
                  "was": 63.9,
                  "now": 87.4,
                  "state": "warn",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: It was signed off by checking the chances before the match adds its own camera on top, which scored 100%. Nobody checked what the match actually shows until the screenshots arrived.",
                  "Fix: Undone the same day on Harry's instruction. The whole goal now shows in 87.4% of chances, a little better than the old camera's 83.4%. Still not good enough: about 1 chance in 8 misses part of the goal."
                ]
              }
            },
            {
              "title": "Chances didn't match their own name (v0.1 · Harry)",
              "detail": "A one-on-one didn't look like a one-on-one: 99.7% of them had a defender between you and the goal. Corners (19.7%) and byline crosses (8.7%) were broken too.",
              "bars": [
                {
                  "label": "One-on-ones broken",
                  "was": 99.7,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Corners broken",
                  "was": 19.7,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Byline crosses broken",
                  "was": 8.7,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Every chance is now checked against its own definition and anything clearly illegal is repaired. Broken one-on-ones, corners and byline crosses are all at 0%."
                ]
              }
            },
            {
              "title": "On long shots the defence sat on its own keeper (v0.1 · Harry)",
              "detail": "Harry reported the back line looked wrong on long shots. It sat 10.4-13.6m from goal, 3 to 6m deeper than the edge of the box, every time.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The rule places the line at a fixed share of the ball's distance, which keeps dropping deeper as the ball gets further out. Past the box, that stops being what a real defence does.",
                  "Fix: The line now holds the edge of the box when the ball is outside it: 13.8-16.1m out. This made long shots easier to score (21.8% to 26.7%), not harder."
                ]
              }
            },
            {
              "title": "A team-mate's rebound counted as your goal (v0.1 · Harry)",
              "detail": "You shot, it came back off the keeper, a team-mate scored, and the goal went down as yours with your assist gone.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The game remembers 'you shot' and only cleared it on one of the two ways a team-mate can finish a loose ball. On the other way, his goal was credited to you. An earlier fix only covered the first way, which is why it kept happening.",
                  "Fix: Once a team-mate strikes the ball it stops being your shot, whichever way he finished it."
                ]
              }
            },
            {
              "title": "Your own team-mates stood in front of your shot (v0.1 · Harry)",
              "detail": "On generated chances, a team-mate was in your shooting line on 28% of long shots and 22.3% of tight angles.",
              "bars": [
                {
                  "label": "Long range",
                  "was": 28.0,
                  "now": 0.3,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Tight angle",
                  "was": 22.3,
                  "now": 0.5,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The rule only worked for shots from 14m or more, so close chances had no protection, and it measured against the middle of the goal rather than the line the ball actually travels.",
                  "Fix: Now measured from where you stand, at every distance. Volleys and headers were left alone on purpose: moving team-mates aside there pushed defenders into the lane and blocks went up (volley 17.8% to 38%)."
                ]
              }
            },
            {
              "title": "The first camera showed a giant head, not a goal (v0.2 · Leo)",
              "detail": "On the first version, the goalposts were far off both edges of the screen, the grass vanished, the keeper was one giant head, and the ball was a few pixels wide.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The camera sat 0.75m behind the goal line, a position worked out wrongly by hand, and the ball was drawn at its true size, which is tiny on a phone.",
                  "Fix: The camera distance was picked by measuring what each option actually puts on screen: at 7m back both posts are in frame with room to spare. The ball is drawn larger on purpose, like elsewhere in the game."
                ]
              }
            },
            {
              "title": "On a phone, any touch dived straight away (v0.2 · Leo)",
              "detail": "Touching the screen at all locked in the dive, so there was no way to aim first. On a computer you could hover the mouse to preview.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: A touch has no hover, so the first touch was treated as the final choice.",
                  "Fix: Pressing now only starts aiming, dragging moves the aim, and letting go dives, as Leo suggested. A plain click on a computer still dives at once."
                ]
              }
            },
            {
              "title": "The camera zoom made the shot hard to judge (v0.2 · Leo)",
              "detail": "Round 2 rebuilt the camera to copy three reference videos: a tight push-in on the striker, then a pull back wide for the save. In play it was reported as 'the weird zooming in thing sucks', and the goal wasn't big enough to judge the shot.",
              "bars": [
                {
                  "label": "Goal width on screen",
                  "was": 94.2,
                  "now": 96.9,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: With the push-in, the whole goal and your full dive only came into view once the camera move had finished.",
                  "Fix: One fixed wide shot for the whole sequence, set slightly closer, so the goal, both posts and your full dive reach are always on screen. The screen is also less tall, so the goal fills more of it."
                ]
              }
            },
            {
              "title": "Your aim wasn't under your cursor (v0.2 · Leo)",
              "detail": "Reported on PC: the aim was 'very offset and not at all on my cursor'. Aiming at a low corner landed about 0.42m away, around a fifth of the goal's height, on every aim.",
              "bars": [
                {
                  "label": "Aim error",
                  "was": 0.42,
                  "now": 0,
                  "state": "good",
                  "unit": "m"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The camera was tilted slightly downward, and the maths that turns a point on screen back into a spot in the goal assumed a level camera.",
                  "Fix: The tilt is now exactly level, which makes the aim exact. Checked over 500 random targets: the error is effectively zero."
                ]
              }
            },
            {
              "title": "The pitch looked like an ice rink (v0.2 · Leo)",
              "detail": "Reported: 'i dont even see any green... looks like im on an ice rink'. No grass, stripes or goal line were drawn.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The near edge of the grass was set 0.05m in front of the camera, inside the zone the camera cuts off, so the whole grass area silently failed to draw on every device since the first version.",
                  "Fix: The grass edge is now placed where the bottom of the screen really is, using the same maths the game already uses to work out where you tapped on the ground."
                ]
              }
            },
            {
              "title": "A committed scenario only reached one person (v0.3 · Harry)",
              "detail": "Leo could commit a scenario and Harry would never see it.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Commits went to a branch named after one person, so they reached nobody else until that branch was merged.",
                  "Fix: Commits now go to the main branch: one press and everyone has it."
                ]
              }
            },
            {
              "title": "One odd drawing switched the rules off (v0.3 · Harry)",
              "detail": "In a test with eleven good drawings and one odd one, two of the three rules switched off without warning, and 15 in every 100 chances didn't match their name.",
              "bars": [
                {
                  "label": "Rules kept",
                  "was": 1,
                  "now": 3,
                  "state": "good",
                  "unit": " of 3"
                },
                {
                  "label": "Chances not matching their name",
                  "was": 15,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: A rule needed every single drawing to agree, so one slip outvoted eleven.",
                  "Fix: A rule now holds if nine in ten drawings agree. The odd one is named as an outlier on its own card and never used as a starting point."
                ]
              }
            },
            {
              "title": "Your own team-mates stood in front of your shot (v0.3 · Harry)",
              "detail": "On long shots a team-mate was in your shooting line a third of the time.",
              "bars": [
                {
                  "label": "Long range",
                  "was": 34.4,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Tight angle",
                  "was": 11.2,
                  "now": 1.2,
                  "state": "warn",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: An earlier fix covered one-on-ones; the other chances where you are the one shooting never got the same treatment.",
                  "Fix: Applied to long shots and tight angles. Tight angle stops at 1.2% because the only place left to move that team-mate is offside. Not applied to cutbacks, crosses or through balls (he's who you're passing to), or to volleys and headers (it made blocks more likely)."
                ]
              }
            },
            {
              "title": "Offside was called on players who weren't offside (v0.3 · Harry)",
              "detail": "All three offside warnings on Harry's drawings were wrong, and 46 of 153 calls overall. The auto-repair then dragged legally placed players around.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Offside needs a player to be past both the last defender and the ball; only the defender half was checked, so a man behind the ball got flagged.",
                  "Fix: Both halves are checked now. The match itself was never affected; this was the editor's warning and the repair acting on it."
                ]
              }
            },
            {
              "title": "A randomised chance put the keeper in the wrong place (v0.3 · Harry)",
              "detail": "A third of the time, moving the ball left the keeper worse placed than in the drawing, sometimes shading the wrong post.",
              "bars": [
                {
                  "label": "Keeper left worse placed",
                  "was": 32.8,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: He was copied off the drawing and nudged on his own, without looking at where the ball ended up.",
                  "Fix: He's now placed from the ball, using the drawing's own near-post shade and distance off his line. A keeper drawn rushing out still rushes out."
                ]
              }
            },
            {
              "title": "Plain one-on-ones broke the drawn rules (v0.3 · Harry)",
              "detail": "About one in seven plain generated one-on-ones broke a rule taken from the drawings.",
              "bars": [
                {
                  "label": "Obeyed the rules",
                  "was": 85.6,
                  "now": 100,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The repair that moves a defender out of the way only worked within 14m of the middle and let a man half a metre in front through; and nothing cleared a team-mate out of your shooting line (1 in 23 had one).",
                  "Fix: Both fixed: every plain one-on-one now obeys the rules."
                ]
              }
            },
            {
              "title": "Leo couldn't see scenarios the game was using (v0.3 · Harry)",
              "detail": "Committed scenarios were in the game for everyone but showed on nobody's gallery.",
              "bars": [
                {
                  "label": "One-on-one cards shown",
                  "was": 10,
                  "now": 21,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The game reads the code; the gallery only read the database.",
                  "Fix: The gallery reads both, and every saved scenario gets its own card, including ones saved from a simulation."
                ]
              }
            },
            {
              "title": "Saving one scenario repainted others (v0.3 · Harry)",
              "detail": "Saving one scenario could silently change the picture on half the other cards.",
              "bars": [
                {
                  "label": "Cards repainted by a save",
                  "was": 50,
                  "now": 9,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Each card picked its drawing by position in the list, so when the list reordered after a save, cards picked different drawings.",
                  "Fix: Cards pick by identity now. The 9% left is the floor: when a new drawing joins the pool, about one card in eleven genuinely lands on a different one."
                ]
              }
            },
            {
              "title": "The poacher couldn't be removed (v0.3 · Harry)",
              "detail": "Reported as 'I can't remove teammates'. It was only ever the poacher: his Remove button was greyed out in every editor, and in a free kick he's the only team-mate.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The game has exactly one slot for the poacher, with no way to leave it empty, so the editor never offered to remove him.",
                  "Fix: He can be removed like everyone else; a saved scenario then has no poacher at all."
                ]
              }
            },
            {
              "title": "A deploy failed because of a font (v0.3 · Harry)",
              "detail": "The whole site build failed with no code at fault.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The site downloaded its Cinzel font from Google on every build, and Google's font service didn't answer that time.",
                  "Fix: The font file is now stored in the project, so nothing is fetched during a build."
                ]
              }
            },
            {
              "title": "The patch notes page showed MIGRATION NOT RUN (v0.3 · Harry)",
              "detail": "The admin patch notes page showed a red MIGRATION NOT RUN banner instead of the notes.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The notes were stored in a database table that had to be filled by hand, and it hadn't been.",
                  "Fix: The notes now live in the code, so the page shows them the moment it deploys. The shareable page for each version is generated from the same notes, so the two can't disagree."
                ]
              }
            },
            {
              "title": "Delete only seemed to work on one-on-ones (v0.3.5 · Harry)",
              "detail": "Leo added a scenario for another kind of chance and could not delete it. Delete looked like a one-on-one-only button, which blocked him from building other kinds.",
              "bars": [
                {
                  "label": "Volley cards",
                  "was": 10,
                  "now": 9,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The Delete button only appeared once a scenario had been saved, and the only saved scenarios were one-on-ones. A generated card had no way to be removed at all, because versions came from a count rather than a list.",
                  "Fix: Delete is always shown now. On a saved scenario it still clears the database and the code; on a card that was never saved it just takes the card out and remembers that after a reload (volley went from 10 cards to 9 and stayed at 9)."
                ]
              }
            },
            {
              "title": "Nobody could tell what the X button did (v0.3.5 · Harry)",
              "detail": "On the call it was asked twice whether the X meant delete or something else.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The X is the reject mark for a scenario, not a delete, but nothing on screen said so.",
                  "Fix: The button now reads \"No good\"."
                ]
              }
            },
            {
              "title": "The scenario picture was phone-sized on a computer (v0.3.5 · Harry)",
              "detail": "On a wide desktop screen the scenario picture stayed at phone size (340×544) and hugged the left, with empty space beside it.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The picture's size was fixed to phone size on every screen, and the drawing step reset any bigger size straight back to the phone default.",
                  "Fix: The desktop picture now uses the screen and sits centred. A first pass went too big (500×800), so it settled at 400×640. Phones are unchanged."
                ]
              }
            },
            {
              "title": "Pressing Play moved everything you'd drawn (v0.4 · Harry)",
              "detail": "Play in the scenario gallery moved the players around. On the card where this was reported, the goalie was drawn 4.6m off his line and the ball 11.6m out, but Play put them at 2.2m and 19.2m every time.",
              "bars": [
                {
                  "label": "Goalie off his line",
                  "was": 2.2,
                  "now": 4.6,
                  "state": "good",
                  "unit": "m"
                },
                {
                  "label": "Ball from goal",
                  "was": 19.2,
                  "now": 11.6,
                  "state": "good",
                  "unit": "m"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Every other part of a card combines two layers: the saved drawing, then whatever you're dragging right now. Play only applied the second layer, so it ignored the saved drawing and played the raw generated chance.",
                  "Fix: Play now uses your drawing, so the goalie and ball stay where you put them. The real match was never affected: it uses your saved scenarios and places the goalie from your drawing, so draw him where he should be."
                ]
              }
            },
            {
              "title": "On a computer, the buttons fell off the bottom of the scenario card (v0.4 · Harry)",
              "detail": "At 400×640 the scenario picture pushed the buttons below it off the bottom of a desktop screen. This was the third attempt at the size: 340 was too small and 520×800 was too big.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The picture was too tall for a normal window, and desktop used its own layout with a separate right-hand column.",
                  "Fix: The picture is now 325×520, so the whole card fits on a 900-pixel-tall window (about 80 pixels are still hidden on an 800-pixel one). As asked for, Simulate is now a small square with a play triangle, Across formations sits under the picture, and desktop uses the same single centred column as the phone."
                ]
              }
            },
            {
              "title": "Untouched chances were labelled \"Draft\" (v0.4 · Harry)",
              "detail": "In Infinite Highlights, a chance the generator had just rolled said \"Draft — this browser only\", even though nobody had touched it.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The label treated anything not yet saved as a draft.",
                  "Fix: An untouched chance now reads \"Straight from the generator\"."
                ]
              }
            },
            {
              "title": "Five-a-side froze when the other team got the ball (v0.5 · Leo)",
              "detail": "In the trial's five-a-side, the match sometimes froze solid when the other team got the ball, and the only way past it was a dev skip.",
              "bars": [
                {
                  "label": "Freeze points with a way out",
                  "was": 0,
                  "now": 3,
                  "state": "good",
                  "unit": " of 3"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Three steps of the match gave up without doing anything when a piece of the screen they needed was missing, and nothing ever called them again. 2,300 test runs of the ball physics and the full match flow found no faults, so the exact trigger is a screen-timing issue that can't be reproduced outside a real browser.",
                  "Fix: All three steps now check what the match is waiting for and try again, instead of going silent. At worst a chance replays from the start, so the permanent freeze can't happen whatever triggers it."
                ]
              }
            },
            {
              "title": "Careers got stuck at End of Season (v0.6 · Mikey)",
              "detail": "On Leo's save (Arsenal, season 5), pressing End of Season did nothing, so the season never rolled over. Any save with an older Rule Book could hit this.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: His save held a UEFA Rule Book from before the \"custom clubs in Europe\" rule existed. That rule was missing, and building next season's Champions League draw crashed trying to read it. The browser error Leo sent pointed straight to it.",
                  "Fix: Saved Rule Books now get any newer rules filled in with their defaults instead of crashing."
                ]
              }
            },
            {
              "title": "Careers ended after about 22 seasons (v0.6 · Mikey)",
              "detail": "A career could only run about 22 seasons, not the length it was meant to. At first this looked like a hard 5-season limit.",
              "bars": [
                {
                  "label": "Longest possible career",
                  "was": 22,
                  "now": 50,
                  "state": "good",
                  "unit": " seasons"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Players were forced to retire at age 40, which ends an 18-year-old's career after roughly 22 seasons.",
                  "Fix: Forced retirement at 40 is gone. A career now ends after season 50, and you can still choose to retire from age 33."
                ]
              }
            },
            {
              "title": "Pressing Play made the picture jump (v0.7 · Harry)",
              "detail": "In the scenario gallery, pressing Play made every player seem to shift before the kick.",
              "bars": [
                {
                  "label": "How much bigger Play was than the picture",
                  "was": 13,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Nothing actually moved (watched for 4 seconds in a real browser). Play was drawn about 13% wider than the picture, with players about half as big again, so everything looked like it jumped.",
                  "Fix: The picture now draws players at the match's own size, and Play runs at the picture's exact width. Side by side, keeper, ball and every player land within a few pixels. Still different: the goal net is drawn a bit deeper in the match."
                ]
              }
            },
            {
              "title": "The ball was stuck to your player (v0.7 · Harry)",
              "detail": "In the scenario editor the ball always sat to your right and couldn't be moved, and Play ignored where a saved drawing had put it. That's how a ball ended up on top of a defender after pressing Play.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Mikey's change that made the ball ride at your feet locked it to your figure.",
                  "Fix: That change is undone at Harry's request: the ball can be dragged on its own again."
                ]
              }
            },
            {
              "title": "False \"attacker offside\" with everyone behind the ball (v0.7 · Harry)",
              "detail": "3 of 65 saved scenarios were flagged \"attacker offside\" even though every attacker was behind the ball.",
              "bars": [
                {
                  "label": "Saved scenarios wrongly flagged offside (of 65)",
                  "was": 3,
                  "now": 0,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Removing the poacher parked him 400m past the goal line, which counts as offside.",
                  "Fix: A removed poacher is now parked behind the ball. 0 of 65 flagged."
                ]
              }
            },
            {
              "title": "Approving a simulated chance didn't save it (v0.7 · Harry)",
              "detail": "Pressing ✓ on a good simulated chance just ticked it, and it was lost.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: ✓ only saved a card if you had dragged something on it.",
                  "Fix: ✓ now saves anything not yet saved, and it becomes that type's next card."
                ]
              }
            },
            {
              "title": "The next \"Commit all\" would have put old scenarios back (v0.7 · Harry)",
              "detail": "Leo's 11 scenarios reached the game, but the database still held older copies of 5 tight angles. The next \"Commit all\" from anyone would have written the old copies back, and those cards claimed the game had the older copy (the opposite of true).",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Those 5 were committed without being saved first, so the game's copy and the database's copy drifted apart.",
                  "Fix: Every commit now also saves the same copy to the database. When the game's copy is newer than the database, the card reads \"Committed\" and is left off the Commit all list."
                ]
              }
            },
            {
              "title": "Team-mates added with \"+ Mate\" just stood there (v0.7 · Harry)",
              "detail": "A team-mate added with \"+ Mate\" never reacted when you pressed Play.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: \"+ Mate\" only added scenery, not a real player.",
                  "Fix: He's now a real support runner: he goes for a ball played near him and can receive a pass or an order."
                ]
              }
            },
            {
              "title": "Highlights saved in Infinite Highlights never reached the gallery (v0.7 · Harry)",
              "detail": "A highlight you saved didn't show up as a scenario card.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: It was saved somewhere the gallery never looked.",
                  "Fix: It's now saved exactly like a gallery simulation, so it shows as a card of that type, counts and can be committed. The one saved the old way still shows up."
                ]
              }
            },
            {
              "title": "You couldn't keep a good chance straight from a match (v0.8 · Harry)",
              "detail": "Infinite Match had one Edit button above the scoreboard that scrolled away, with no Save or Commit. Infinite Highlights only showed Save after you dragged someone, and had no Commit at all.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Infinite Match now has Edit, Save and Commit pinned to the top for the whole match, and Save keeps the chance exactly as it stands. Every highlight has Save and Commit underneath. A saved chance lands in the gallery as a new card of its type; a test rebuilt 156 of 156 saved chances exactly, and caught it (0/156) when the save was broken on purpose. Not yet tried signed in as admin."
                ]
              }
            },
            {
              "title": "The keeper seemed to move when you pressed Play on a phone (v0.8 · Harry)",
              "detail": "On a 340px phone, pressing ▶ Play made everything jump: Play was drawn 9% bigger than the still picture, which read as the keeper moving.",
              "bars": [
                {
                  "label": "Play vs picture size, phone",
                  "was": 9,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The picture drew 340px wide inside a 312px space and got cut off, while Play shrank to fit the space.",
                  "Fix: Both are drawn at 312px now. Side by side in a browser, the keeper, ball and players land within 5px of each other. The goal net is still drawn differently (see known issues)."
                ]
              }
            },
            {
              "title": "A gallery card could go blank when the screen resized (v0.8 · Harry)",
              "detail": "Resizing the window could crash a gallery card and leave it blank: 7 errors on one resize.",
              "bars": [
                {
                  "label": "Errors on one resize",
                  "was": 7,
                  "now": 0,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: A side effect of the phone fix above: before the page had measured the screen, the picture was given a negative size.",
                  "Fix: The picture now starts at a safe default size until the screen is measured. 0 errors on the same resize."
                ]
              }
            },
            {
              "title": "Buttons fell off the edge of a phone screen (v0.8 · Harry)",
              "detail": "On Infinite Highlights, Delete was cut off. In the gallery, \"+ Mate\" and \"Remove\" were clipped once the Tune button appeared.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The button rows were wider than the phone: Infinite Highlights' row ran to 433px on a 390px screen, and the gallery's row grew when Tune was added to it.",
                  "Fix: Every button now fits on a 390px screen, in both places, measured."
                ]
              }
            },
            {
              "title": "A drag kicked harder or softer than in a career (v0.9 · Harry)",
              "detail": "The same drag in the gallery hit 7.6% harder than in a career on a phone, and 16% softer on a laptop.",
              "bars": [
                {
                  "label": "Kick strength vs a career, phone",
                  "was": 7.6,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Kick strength vs a career, laptop (softer)",
                  "was": 16,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The game measures a drag as a share of the pitch's height, so a smaller pitch means a harder kick. The gallery played at 340px on a phone and 460px on a laptop, not the real match's size.",
                  "Fix: Every test screen (gallery Play, Infinite Highlights, Infinite Match) now plays at the real match's size, 366px on a phone. Kick strength is the same as a career on both."
                ]
              }
            },
            {
              "title": "Test screens played with nobody in the shirts (v0.9 · Harry)",
              "detail": "In the gallery, team-mates finished like anonymous men (no curl, no chip, no first-time finish) and every keeper was a flat 62.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The gallery never loaded a squad, and the first chance of any match never had real players put into the shirts. Gallery Play only ever plays its first chance, so it never had any.",
                  "Fix: Test screens load the same real squads a career does, including the first chance. Checked in a match: Eze, Saka and Rice for Arsenal against Coventry's own keeper, Rushworth."
                ]
              }
            },
            {
              "title": "Test screens never had any weather (v0.9 · Harry)",
              "detail": "A career has wind or rain in about 4 matches in 10; the test screens had none.",
              "bars": [
                {
                  "label": "Test matches with wind or rain",
                  "was": 0,
                  "now": 42,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The test screens set the real match up differently from a career, and weather was one of the settings left out.",
                  "Fix: They now use the real weather, and a line above the pitch says when it's windy. Play Area → Weather → Clear turns it off."
                ]
              }
            },
            {
              "title": "Infinite Match quietly weakened every kick after minute 150 (v0.9 · Harry)",
              "detail": "From about minute 150, every kick was 30% weaker for the rest of the run.",
              "bars": [
                {
                  "label": "Kick weakened, minute 150 onwards",
                  "was": 30,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Your energy drained as if one 90-minute match was stretched over 10,000 minutes.",
                  "Fix: You get fresh legs every 90 minutes. Worked out from the code, not played."
                ]
              }
            },
            {
              "title": "Team understanding was ignored in test screens (v0.9 · Harry)",
              "detail": "A career passes in how well your team combines; the test screens always used 60 instead.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The setting was never passed to the test screens, so they fell back to 60 without saying so.",
                  "Fix: The test screens now get the real value. The new deploy guard caught this on its very first run."
                ]
              }
            },
            {
              "title": "Gallery Play restarted in the middle of a kick (v0.9 · Harry)",
              "detail": "A chance in gallery Play could be thrown away mid-kick, even by a phone's address bar hiding.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Anything that redrew the card restarted the chance.",
                  "Fix: It now restarts only if the picture itself actually changes."
                ]
              }
            },
            {
              "title": "The trial's penalties and free kicks didn't play like a match (v0.10 · Harry)",
              "detail": "The trial keeper was already diving as you struck, and the ball flew a little differently from a real match.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The trial ran its own copy of the match (about 1,280 lines) that had drifted.",
                  "Fix: The trial now plays the real match and only sets up and scores each rep. Its stats are invisible, as Harry asked."
                ]
              }
            },
            {
              "title": "Penalties in the corner always went in (v0.10 · Harry)",
              "detail": "In a real match a penalty aimed at the corner scored 99.8% of the time; down the middle scored 0%.",
              "bars": [
                {
                  "label": "Corner, scored",
                  "was": 99.8,
                  "now": 70,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Down the middle, scored",
                  "was": 0,
                  "now": 22,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The keeper didn't react to penalties. He stood in the middle.",
                  "Fix: Harry's answer to question 1: he waits in the middle, then dives 80% of the time and picks your side 60%. The trial turns those two numbers up rep by rep."
                ]
              }
            },
            {
              "title": "Training kicked differently from a match (v0.10 · Harry)",
              "detail": "Power, Technique and Free Kick drills kicked harder or softer than a match, and the free-kick wall stood squashed together.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Training had its own copy of the match. Its wall was 0.75m apart; the match uses 1.15m.",
                  "Fix: The drills play the real match; Technique's cones are on the real pitch; Pace is the match's first-person run; the wall is spaced like the match."
                ]
              }
            },
            {
              "title": "Five-a-side's arrow and drag didn't match the match (v0.10 · Harry)",
              "detail": "The arrow pointed slightly away from where the ball went, a sideways drag hit about 20% harder, and a drag up the screen hit harder too.",
              "bars": [
                {
                  "label": "Arrow vs where the ball went",
                  "was": 3.7,
                  "now": 0.01,
                  "state": "good",
                  "unit": "°"
                },
                {
                  "label": "40px drag up, power (match 54.1%)",
                  "was": 67.7,
                  "now": 54.1,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Five-a-side measured your drag against its own, differently shaped pitch.",
                  "Fix: It uses the match's exact drag maths, draws the arrow along the ball's real path, and reads your drag against the match's height (Harry's answer to question 11)."
                ]
              }
            },
            {
              "title": "A gallery corner looked different when you pressed Play (v0.10 · Harry)",
              "detail": "The corner picture was drawn flat, but Play turned it sideways like the real game, so it looked like a different chance. It was also small on a laptop, with made-up kits.",
              "bars": [
                {
                  "label": "Gallery picture on a laptop",
                  "was": 384,
                  "now": 493,
                  "state": "good",
                  "unit": "px"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The picture was drawn with different settings from Play.",
                  "Fix: The picture is turned like Play (40 of 40 within 0.6px), up to 520px on a laptop, with real kits."
                ]
              }
            },
            {
              "title": "Some teams wore the same two colours, swapped (v0.10 · Harry)",
              "detail": "Man United (red shirts, white shorts) against Bournemouth's change kit (white shirts, red shorts): both sides red and white.",
              "bars": [
                {
                  "label": "Fixtures with swapped colours",
                  "was": 2634,
                  "now": 0,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The clash check only compared shirts.",
                  "Fix: Harry's answer to question 6: it checks shirt and shorts together, and the away side changes its shorts first."
                ]
              }
            },
            {
              "title": "Five-a-side froze when a team-mate had the ball (v0.10.1 · Harry)",
              "detail": "In the trial's five-a-side the game got stuck, usually around a team-mate's chance, and you needed dev tools to skip past it.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The next line of code wiped the team-mate's chance as soon as it was set. The result was then filed as the other team's attack, so the match kept asking for the same chance, forever.",
                  "Fix: The chance is kept until it resolves and is filed as your team-mate's. In a browser, a phone run went past a team-mate's chance (15' to 17') and runs finished at 43' and 44' with nothing stuck."
                ]
              }
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "No way to see a chance exactly as the match serves it (v0.1 · Harry)",
              "detail": "The gallery only showed fixed example versions, not the chances a real match would give you.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Needed to check what players actually get, rather than hand-picked examples.",
                  "Fix: A Simulate button: one press, one chance built exactly as the match builds it. Over 1,300 presses: 1,221 different pictures, no repeats in a row, no faults. Penalties are the exception (23 different in 100) because there is almost nothing to vary."
                ]
              }
            },
            {
              "title": "Checking chances meant one at a time (v0.1 · Harry)",
              "detail": "There was no quick way to look at lots of real chances, which is how the broken camera slipped through.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: A check that measures the wrong thing still passes; a person flicking through a hundred real chances catches it in a minute.",
                  "Fix: Infinite Highlights: an endless Next button in the gallery, plus a page where you pick which of the 13 chance types to see. Faults are ringed in red with one line of English, and Flag saves a bad one to find again. On day one it found four fault messages ringing the ball instead of the player they named, now fixed."
                ]
              }
            },
            {
              "title": "You couldn't add or remove players in a scenario (v0.1 · Harry)",
              "detail": "Harry reported you couldn't add team-mates or add or remove opponents in the editor.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Needed to build and correct chances by hand.",
                  "Fix: Tap a figure, then + Team-mate, + Opponent or Remove. It's real: adding an opponent to a one-on-one moves the offside line and the warning changes to 'not a one-on-one'. The keeper, the poacher and you couldn't be removed yet."
                ]
              }
            },
            {
              "title": "Only 10 versions per chance type (v0.1 · Harry)",
              "detail": "Each chance type stopped at 10 versions in the gallery.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Harry asked for more versions per type after using the gallery.",
                  "Fix: An Add version tile adds more, up to 60 per type, and remembers how many you have."
                ]
              }
            },
            {
              "title": "No way out of the full-screen dev pages (v0.1 · Harry)",
              "detail": "On immersive pages like the scenario gallery the normal menu is hidden, so getting to another admin page was awkward.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Harry asked for every admin and test page to be reachable from anywhere.",
                  "Fix: An ADMIN tab on the left edge lists all 25 admin and dev pages, even where the menu is hidden. Only admins see it, and only on desktop."
                ]
              }
            },
            {
              "title": "Commit to repo had never really been used (v0.1 · Harry)",
              "detail": "The button that saves a scenario into the game's code had only ever been tested against a fake.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Mikey's first genuine commit through the button landed this round."
                ]
              }
            },
            {
              "title": "No way to play as the keeper (v0.2 · Leo)",
              "detail": "There was no keeper game anywhere in the career.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Asked for: a Casino minigame where you face shots in goal and bet on a run of saves.",
                  "Fix: Goalie Mode, in the Casino. You drag to aim your dive, and diving takes real time, so the best play is to commit right as the ball is struck: that saves 90-100% of shots, while diving before the shot saves about 28%, barely above the 12% of never diving at all. Cash out any time, or push on to a harder shot; the multiplier climbs to a 12x cap and one goal loses the lot."
                ]
              }
            },
            {
              "title": "The goal stood in front of a flat sky (v0.2 · Leo)",
              "detail": "Behind the goal there was nothing but a flat sky.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Asked for better, more in-game-looking graphics.",
                  "Fix: A stadium behind the goal: a curved roof, two floodlight towers, a crowd, advertising boards and a running track."
                ]
              }
            },
            {
              "title": "Every shot felt the same (v0.2 · Leo)",
              "detail": "Leo asked for different scenarios: long shots, near and far post, headers from crosses, volleys, first-time shots, curl, different power and placement.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Variety is what makes each save a new read.",
                  "Fix: A new first-time strike; near-post and far-post finishes rolled separately (56.9% near, 43.1% far in a real batch); and a label on screen for each shot: HEADER FROM A CROSS, VOLLEY, FIRST-TIME STRIKE, CURLING EFFORT, LONG RANGE, NEAR POST, FAR POST."
                ]
              }
            },
            {
              "title": "The goalmouth was empty apart from the striker (v0.2 · Leo)",
              "detail": "Reported: 'obvs other attackers and defenders should be in there even if they arent involved.'",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Other bodies make the shot harder to read, like in a real match.",
                  "Fix: Attackers and defenders now stand in real goalmouth positions, swaying and shuffling so they look alive. Visual only: they don't touch the ball yet. Left out for penalties (the box is empty by the rules) and free kicks (the wall takes their place)."
                ]
              }
            },
            {
              "title": "No penalties or free kicks to face (v0.2 · Leo)",
              "detail": "Leo asked for two more shot types he'd forgotten: penalty and free kick.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: They're the set pieces every keeper faces.",
                  "Fix: Penalty: struck from the real spot, and the striker gives away much less about where it's going (0.6x the usual clue), so it's a pure guessing duel. Free kick: a wall of 3 to 5 players at the real 9.15m, on the line between ball and goal, jumping as the ball is struck; shots are bent round it or lifted over it. The wall doesn't block the ball yet."
                ]
              }
            },
            {
              "title": "Nothing said whether a scenario was saved or committed (v0.3 · Harry)",
              "detail": "Save and Commit to repo were confused for each other, and no card said which had happened.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: They go to two different places. Save puts a scenario in the database: instant, everyone sees it, the game uses it straight away. Commit to repo puts it in the game's code: about two minutes to rebuild, but permanent even if the database is wiped.",
                  "Fix: Every card now shows a badge: DRAFT (only in your browser), SAVED (in the database), COMMITTED (in the code), or MODIFIED (committed, but changed since and the change isn't committed yet)."
                ]
              }
            },
            {
              "title": "There was no way to delete a scenario (v0.3 · Harry)",
              "detail": "Once saved or committed, a scenario could not be got rid of.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Delete removes it from the database, your browser and the code in one press. If the code part can't be reached, it says so rather than claiming it's gone."
                ]
              }
            },
            {
              "title": "Drawn chances didn't shape the chances the game makes (v0.3 · Harry)",
              "detail": "Hand-drawn one-on-ones were just pictures; the game's own generated chances didn't follow them.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The game needs rules that describe what a chance is, so it can make endless new ones that still look right.",
                  "Fix: The tuner reads all the drawings (17 one-on-ones) and finds what's true in every one: no defender between ball and goal, nobody nearer the goal than the ball, no team-mate in your shooting line. Every generated chance must pass these or is repaired before you see it. It only makes 'none of this' rules, never 'usually three defenders', which would have banned most of football."
                ]
              }
            },
            {
              "title": "No way to correct a bad generated chance (v0.3 · Harry)",
              "detail": "If the game made a bad chance, the only options were to ignore it or save it as a new drawing.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: One bad chance you happened to see isn't evidence of anything, so it shouldn't change the rules on its own.",
                  "Fix: Tune: drag a player to where he should be and press Tune. It's recorded and nothing else happens. The same kind of fix three times on different chances becomes a proposal in the commit tab, in plain words, which you approve or ignore. Nudges under about half a metre don't count."
                ]
              }
            },
            {
              "title": "Test settings could only be changed in the code (v0.4 · Harry)",
              "detail": "Power, technique, curving boots, extra-touch boots, opposition, goalie, position, division and match length were stuck at whatever a dev page had set, and changing them needed a code change.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Testing how chances feel means changing those settings, and a number set once has to mean the same thing in every play tool.",
                  "Fix: A Play Area puts both play tools behind one door, with one shared set of dials on top. The settings are saved on your own device and never touch a career or the live game."
                ]
              }
            },
            {
              "title": "There was no way to check which chances a match actually gives you (v0.4 · Harry)",
              "detail": "\"I've played like 5 games and seen ZERO of these one on ones\" couldn't be checked. Also, a very long test match was ending at around minute 75.",
              "bars": [
                {
                  "label": "Test match lasted",
                  "was": 75,
                  "now": 138,
                  "state": "good",
                  "unit": " min"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The match picked each chance internally and never reported it. The manager can also take you off from minute 60, which ended long test matches early.",
                  "Fix: The Infinite Match is the real match, but it doesn't stop and it counts every chance it serves. In a live test it served 9 chances in 138 minutes (5.9 per 90) across six kinds, 3 of them one-on-ones. Both additions stay off in a real career."
                ]
              }
            },
            {
              "title": "You couldn't see scenarios before committing them (v0.4 · Harry)",
              "detail": "\"Not being able to see them before committing is annoying.\" The commit list was just a line of IDs.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Committing puts a scenario into the code permanently, and an ID doesn't show you the drawing.",
                  "Fix: Tuning & Commit now has \"Look through all first\". It shows one drawing at a time, with back and forward, \"Open to edit\" and \"Leave out\" to drop one from this batch without deleting it. The button then shows the count, such as \"Commit 10 of 11 to the repo\". Looking changes nothing."
                ]
              }
            },
            {
              "title": "Infinite Highlights couldn't tune or properly delete a chance (v0.4 · Harry)",
              "detail": "You flick through chances on this screen, but it was the one screen that couldn't record a correction. It only had Revert, which left a committed copy still in the game, and it didn't show whether a chance was saved or committed.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Infinite Highlights now has Tune, which counts exactly the same as a correction made in the gallery. It also has Delete, which clears both the database and the code after an \"Are you sure?\" (asked for on the call), and the Saved/Committed pills."
                ]
              }
            },
            {
              "title": "Testing a late-game situation meant playing the whole game to get there (v0.5 · Leo)",
              "detail": "To test something like the captaincy, high reputation or a different club, you had to play from the start until you got there.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Faster testing was asked for, so any part of the game that takes time to reach can be reached straight away.",
                  "Fix: Settings now has six one-tap cheats: make yourself captain, set reputation, fame or happiness, max all skills to 99, and switch club. The club switch goes through a real transfer, so the save stays consistent. Like the existing money and skip tools, these have no login check."
                ]
              }
            },
            {
              "title": "Owning the club you played for gave you less power, not more (v0.5 · Leo)",
              "detail": "\"Right now if you own the club you play at you have LESS opportunity, power... you should have MORE.\" For your own club, the Boardroom's Powers tab only showed a placeholder.",
              "bars": [
                {
                  "label": "Chances your way (Talisman on)",
                  "was": 1,
                  "now": 2.2,
                  "state": "good",
                  "unit": "×"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The Boardroom's powers were only built for clubs you own but don't play for.",
                  "Fix: A majority owner of their own club now has three powers: appoint yourself captain outright, sell yourself to any club in your division, and a Talisman tactic. Talisman sends 2.2 times as many chances your way, fewer to team-mates, and the team plays worse overall. A minority stake gives none of these."
                ]
              }
            },
            {
              "title": "You could only sell your whole stake in a club (v0.6 · Mikey)",
              "detail": "The Portfolio had one \"Sell entire stake\" button: no way to sell part of a stake or top it up, and no confirm step.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: A single mis-click could cost you a whole stake.",
                  "Fix: Two buttons, Buy more (up to 100%) and Sell some, each with a slider for how much. Every buy and sell asks you to confirm and warns if you're about to gain or lose majority ownership."
                ]
              }
            },
            {
              "title": "No way to choose how hard to work in a match (v0.6 · Mikey)",
              "detail": "You had no say in how much energy a match used or how involved you were.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: An energy bar with Low / Medium / High buttons now sits at the bottom of the commentary screen, where the repeated stats row was. A full Premier League match costs 30 / 60 / 95 energy. High gives about 35% more chances, Low about 35% fewer, Medium plays exactly as before. Measured in a real match: Medium drained 0.667 a minute (100 → 64 by minute 54), High 1.075 a minute."
                ]
              }
            },
            {
              "title": "No way to top up energy at half time (v0.6 · Mikey)",
              "detail": "Energy cans couldn't be used during a match.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: A \"Use KIB can\" button sits beside Second Half, showing how many Basic cans you own. Each tap gives +25 energy; the cans come off your stock once the match is saved."
                ]
              }
            },
            {
              "title": "A chance in Infinite Match couldn't be kept or fixed (v0.7 · Harry)",
              "detail": "If Infinite Match served a good or broken chance, there was no way to edit it, save it or put it in the game.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: A chance in a real match can't be rebuilt afterwards, so it has to be copied the moment it's served.",
                  "Fix: An \"Edit this chance\" button above the match opens the chance as it was before the kick. Drag, add or remove players, then Save (it becomes a gallery card of that type) or Commit (it goes in the game), and carry on playing. Checked on 144 chances: every card showed exactly the chance you were on, with the match's own camera framing. A normal career doesn't take these copies."
                ]
              }
            },
            {
              "title": "Admin pages didn't explain their own buttons (v0.8 · Harry)",
              "detail": "Nothing on the admin and dev pages said what each button did, where saving went, or whether anything reached the game.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Harry asked for \"a little eye on how to use whatever's currently on the page\", the same on every admin page.",
                  "Fix: An eye (ⓘ) in the bottom-right corner of all 26 admin and dev pages explains the page, every button by its on-screen name, where saving goes, whether it commits, and where it shows up in the game. Anyone who changes a button now has to update its explanation in the same change. Writing them turned up several of the known issues below."
                ]
              }
            },
            {
              "title": "There was no step-by-step guide to building scenarios (v0.8 · Harry)",
              "detail": "Building scenarios meant knowing the difference between Unsaved, Saved and Committed, what every gallery button did, and when real matches actually start using a drawing.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The team needs 30–50 drawings per chance type, and only committed ones ever reach real matches.",
                  "Fix: A ten-step guide: open the gallery, pick a type, read the two pills, drag to fix, ▶ Play to check, Save & Approve, ▶ Sim for more, Tune, then Commit all from Tuning & Commit. It also states the rule: a type needs 5 committed drawings before matches use any, and each chance served nudges one drawing by up to 2m. At the time: one on one 21 committed, tight angle 11, free kick 0."
                ]
              }
            },
            {
              "title": "The team disagreed on difficulty with no evidence either way (v0.8 · Harry)",
              "detail": "Harry wanted a slow road to the top as the main mode, Leo wanted players to pick a quick route before they start, and Mikey wanted both without the game going flat. Nobody had numbers.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The default mode decides who stays and who pays, so it needed research before building.",
                  "Fix: Research plus two live simulations. At 20 hours to the Premier League and 30 minutes a day, about 10 in 1,000 players are still playing on the day they'd get there (17 in 1,000 if the road is halved). Adding a casual mode comes out at 95 on Harry's assumptions, 183 on Leo's, 163 on Mikey's and 71 at worst, against 100 for the main mode alone. Recommendation: Road to Glory as the default with a casual Superstar Start beside it, decided with PostHog data. The decision is Harry's."
                ]
              }
            },
            {
              "title": "Test screens felt like a different game from a career (v0.9 · Harry)",
              "detail": "Four screens ran their own copy of the match, and the ones that did use the real match set it up differently, so a test never felt quite like a career.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Each copy was right on the day it was made, then the real match kept improving and the copies didn't. Harry asked that any new feature use the base engine, with extras built on top.",
                  "Fix: One door into the real match for every test screen: gallery Play, Infinite Highlights and Infinite Match now go through it with a career's settings. A new feature plugs in and adds its buttons and scoring around the outside, never its own copy. A written rule now tells every Claude session the same. The trial and training are not moved yet."
                ]
              }
            },
            {
              "title": "Nothing stopped someone adding a new copy of the match (v0.9 · Harry)",
              "detail": "Any new screen could quietly build its own copy of the match, and it would drift like the others.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Copies are how the trial, training and test screens ended up feeling different.",
                  "Fix: A check inside every deploy: the site won't go live with a new copy of the match, and the build log says what to fix. Fable 5.1 tried to break it; the first version missed 21 of 31 tricks, so it now reads the code the way the compiler does. It caught all 10 planted copies and left 2 harmless look-alikes alone. It also found Goalie Mode's own ball physics and the team-understanding gap. Adds about 20 seconds to each deploy."
                ]
              }
            },
            {
              "title": "No way to switch off the real keeper or weather when testing (v0.9 · Harry)",
              "detail": "Once the test screens played the real keeper and real weather, there was no way to test a chance with a set keeper rating or clear skies.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Testing sometimes needs a fixed keeper or no wind, without touching a career.",
                  "Fix: Two Play Area rows: Keeper (Real / Set) and Weather (Real / Clear). Both start on Real; Keeper → Set brings back the rating slider. Every dial now says it only changes the test screens, never a career."
                ]
              }
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "The same few chances kept coming up (v0.1 · Harry)",
              "detail": "The match only had 14 different chance situations to show you, so highlights repeated.",
              "bars": [
                {
                  "label": "Different situations",
                  "was": 14,
                  "now": 64,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: The new chance generator is switched on: 64 different situations, and you never get the same situation twice in a row. It had been built earlier but held back until the scoring drop above was fixed."
                ]
              }
            },
            {
              "title": "The gallery was 15 screens of scrolling (v0.1 · Harry)",
              "detail": "The front page took about 15 phone screens to scroll through and was mostly explanation text.",
              "bars": [
                {
                  "label": "Scrolling",
                  "was": 12921,
                  "now": 1596,
                  "state": "good",
                  "unit": "px"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: It had been built as an essay rather than a gallery.",
                  "Fix: Rebuilt: the front page is one screen, and a problem is shown as a red ring on the thing that's wrong instead of a paragraph. Across formations is now behind a toggle, off by default, because it took 60% of the screen and didn't work yet."
                ]
              }
            },
            {
              "title": "Too many long shots, not enough one-on-ones (v0.1 · Harry)",
              "detail": "Harry reported lots of long shots and build-up, few one-on-ones, no headers and no byline crosses.",
              "bars": [
                {
                  "label": "Long range",
                  "was": 13.1,
                  "now": 10.6,
                  "state": "warn",
                  "unit": "%"
                },
                {
                  "label": "One-on-one",
                  "was": 11.9,
                  "now": 14.3,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Through ball",
                  "was": 13.0,
                  "now": 12.6,
                  "state": "bad",
                  "unit": "%"
                },
                {
                  "label": "Build-up",
                  "was": 9.5,
                  "now": 9.5,
                  "state": "bad",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The table that sets how often each chance type comes up was guessed, not measured.",
                  "Fix: Half fixed: fewer long shots and more one-on-ones. Through balls and build-up barely moved (see known issues)."
                ]
              }
            },
            {
              "title": "Every commit meant its own two-minute rebuild (v0.3 · Harry)",
              "detail": "Committing five scenarios meant five rebuilds of the site.",
              "bars": [
                {
                  "label": "Rebuilds for 20 scenarios",
                  "was": 20,
                  "now": 1,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Each commit was sent on its own. Harry: 'imagine all three of us are doing a bunch of scenarios... we commit, and it's one production.'",
                  "Fix: Everything saved but not committed sits in one tab, and one press commits the lot as one change with one rebuild. Save while you work, commit at the end."
                ]
              }
            },
            {
              "title": "No-go didn't really stop bad chances (v0.3 · Harry)",
              "detail": "No-go was a bin for chances you never want to see again, but it was unclear what it should do.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: There are millions of possible chances, so binning one exact picture stops almost nothing coming back.",
                  "Fix: Removed completely, as asked. Tune (below) does the job instead: you fix what's wrong with a chance and the fix applies to every chance like it."
                ]
              }
            },
            {
              "title": "Playing a chance took over the screen with no way back (v0.3 · Harry)",
              "detail": "Once you pressed Play there was no way back to editing; you had to leave and find the card again.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Play opened as a full-screen layer that covered the editor.",
                  "Fix: Play now swaps only the picture for the live match. Edit buttons, Save and Next stay where they are, and the match commentary is hidden while editing. Works in the gallery and in Infinite Highlights."
                ]
              }
            },
            {
              "title": "Leo's Goalie Mode was spread over three versions (v0.3 · Harry)",
              "detail": "Leo's 0.2, 0.3 and 0.4 were all Goalie Mode, which read as three separate features.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Each round of the same feature had been given its own number.",
                  "Fix: Merged into one v0.2 with his wording kept. Side effect: this v0.3 is Harry's, so an older link or screenshot saying 'Leo v0.3' now means something different."
                ]
              }
            },
            {
              "title": "It was unclear whether to commit each scenario (v0.3.5 · Harry)",
              "detail": "On the call it wasn't clear how scenario work should be split, or whether to press commit after every scenario.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Save and commit do different things. A kind of chance with no drawings has no rules of its own yet, so its first drawings are what teach the game what that chance is.",
                  "Fix: Agreed on the call: each person picks a kind of chance, makes ten to fifteen varied ones and saves each one as they go, then commits the whole batch once from Tuning & Commit. Tune is not the same as Save: it only records a correction and waits until several agree."
                ]
              }
            },
            {
              "title": "Your position barely changed which chances you got (v0.4 · Harry)",
              "detail": "A striker got a one-on-one only 13.4% of the time, and a left winger got a byline cross only 2.2% of the time.",
              "bars": [
                {
                  "label": "Striker one-on-ones",
                  "was": 13.4,
                  "now": 21.7,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Left wing byline crosses",
                  "was": 2.2,
                  "now": 9.7,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Striker build-ups",
                  "was": 10.6,
                  "now": 5.8,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The call agreed that your position should tilt which chances you get without deciding them completely.",
                  "Fix: Every position now pulls chances towards itself: striker one-on-ones went up to 21.7%, left winger byline crosses to 9.7%, and striker build-up play fell from 10.6% to 5.8%. Every position still gets 6.1 to 6.6 chances a match. One engine setting changed in this round (a striker's long-range weighting, 6 to 3) was flagged as Mikey's call."
                ]
              }
            },
            {
              "title": "Premier League wages topped out at ★11,933 a week (v0.6 · Mikey)",
              "detail": "Even with everything maxed, the best Premier League wage was ★11,933 a week, and a big club paid no more than a small one for the same player.",
              "bars": [
                {
                  "label": "Top weekly wage, everything maxed",
                  "was": 11933,
                  "now": 100000,
                  "state": "good",
                  "unit": "★"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Wages didn't take into account how much a club really spends on wages, its recent trophies or your star rating.",
                  "Fix: Premier League wages now stack three things: the club's real 2025-26 wage bill (Liverpool 13.5× Coventry in real life, softened to 3.7× so squad players don't out-earn stars elsewhere), last season's honours (league ×1.2, Champions League ×1.3, Ballon d'Or ×1.5) and star rating (up to ×1.5 at 5★). Capped at ★100,000 a week. Examples: Coventry bench ★2,534, Chelsea starter ★13,798, Liverpool star ★29,831. Other divisions unchanged."
                ]
              }
            },
            {
              "title": "Energy cans cost the same whatever you earned, and Stat Cans are gone (v0.6 · Mikey)",
              "detail": "Energy cans had one flat price whatever you earned. The shop also sold three Stat Cans that boosted Power and Technique for a few matches.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Pricing off your wage means a can always costs something real. Why the Stat Cans were removed: Not recorded.",
                  "Fix: The three Stat Cans are removed. The three energy cans now cost half a week (Basic), one week (Premium) and two weeks (Elite) of your own wage."
                ]
              }
            },
            {
              "title": "First boots were expensive and lasted too long (v0.6 · Mikey)",
              "detail": "The cheapest boots, NS-Pure, cost ★725, and Starter, Semi-Pro and Pro boots lasted about twice as long as intended.",
              "bars": [
                {
                  "label": "NS-Pure price",
                  "was": 725,
                  "now": 365,
                  "state": "good",
                  "unit": "★"
                },
                {
                  "label": "NS-Pure lifespan",
                  "was": 70,
                  "now": 35,
                  "state": "warn",
                  "unit": " matches"
                },
                {
                  "label": "NS-Blast lifespan",
                  "was": 115,
                  "now": 30,
                  "state": "warn",
                  "unit": " matches"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: NS-Pure is half price at ★365. Lower-tier boots wear out about twice as fast: NS-Pure 70 → 35 matches, NS-Blast 115 → 30, NS-Swerve 70 → 15."
                ]
              }
            },
            {
              "title": "Fame had no ceiling and came just from playing (v0.6 · Mikey)",
              "detail": "Fame had no levels or top limit, and it went up simply from playing matches.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Fame is one number, 0-100, with six levels: Unknown, Local Name (10), Rising Star (25), National Name (40), Global Star (60), Icon (80). Each level unlocks more sponsors. It comes only from big moments, e.g. promotion +3 to +10, league title +12, Champions League +15, winning the Ballon d'Or +15. You lose it for relegation (-5), a season mostly on the bench (-4), and by drifting back toward your division's normal level each season."
                ]
              }
            },
            {
              "title": "An advert gave more fame than winning the league (v0.6 · Mikey)",
              "detail": "Choosing an advert in a dilemma could give up to +15 fame, more than a league title (+12).",
              "bars": [
                {
                  "label": "Best dilemma fame reward",
                  "was": 15,
                  "now": 3,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Dilemma fame rewards are now +1 to +3. Also: a league title counts 10× a Community Shield toward your star rating (was about 6×), and country call-ups come at fame 40 (was 45)."
                ]
              }
            },
            {
              "title": "Things you owned gave fame forever (v0.6 · Mikey)",
              "detail": "A car or a watch gave a flat fame bonus and never wore out.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Each item adds fame on a flattening curve, so the more you own the less each one adds (the whole current shop is worth about 33). Items now wear out: a phone after about 2 seasons, a car after 5, property and jewellery never. A worn-out item gives no fame and shows \"WORN OUT — REPLACE\" in the shop."
                ]
              }
            },
            {
              "title": "A scandal only took fame away (v0.6 · Mikey)",
              "detail": "Getting caught in a scandal simply cut your fame.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Being infamous is still fame; it should cost you somewhere else instead.",
                  "Fix: A scandal or getting caught now adds 1-4 fame (it's a news story) and costs reputation."
                ]
              }
            },
            {
              "title": "Reputation was four separate bars (v0.6 · Mikey)",
              "detail": "Reputation was split across four bars, and merging two clubs cost only 5.",
              "bars": [
                {
                  "label": "Reputation cost of a merger",
                  "was": 5,
                  "now": 20,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Reputation is one number, 0-100, starting at 20. At 30+ boards take your recommendations seriously, at 60+ you can propose Rule Book changes, at 90+ you can run for president. Merging clubs costs 20. Old saves take the average of their four old bars."
                ]
              }
            },
            {
              "title": "Sponsor deals lasted forever once signed (v0.6 · Mikey)",
              "detail": "Once you signed a sponsor, the deal never ended.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Deals last one season (two for Watch, Jewellery and Car), then you have to qualify again. Unlocks follow fame levels, and the luxury brands now want a car or property you own instead of lifestyle points."
                ]
              }
            },
            {
              "title": "The match minute jumped around (v0.6 · Mikey)",
              "detail": "The minute jumped unpredictably from one commentary line to the next.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: The clock now ticks up one minute at a time (1, 2, 3 … 90), about 0.7 seconds per minute at normal speed, and your energy falls with it live."
                ]
              }
            },
            {
              "title": "Doing nothing all week refilled your energy (v0.6 · Mikey)",
              "detail": "Each weekly action you didn't use was worth +20 energy, so a week of doing nothing gained you 28. Rest gave +20 and training cost only 15.",
              "bars": [
                {
                  "label": "Energy from Rest",
                  "was": 20,
                  "now": 10,
                  "state": "warn",
                  "unit": ""
                },
                {
                  "label": "Energy cost of training",
                  "was": 15,
                  "now": 30,
                  "state": "warn",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Energy now comes back from real rest days: +8 for every day between matches (Saturday to Saturday is 6 days, Saturday to Wednesday is 3), plus a little for owning a property and for your club's training ground. Rest gives +10, training costs 30. All adjustable in the tuning editor."
                ]
              }
            },
            {
              "title": "Every competition was equally tiring (v0.6 · Mikey)",
              "detail": "How big the game was made no difference to how much energy it took.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: The Premier League costs the most, down to the National League at 78% of that. FA Cup, League Cup and Community Shield cost whatever the opponent's league costs. Europa League is 6% more; Champions League and Super Cup 11% more."
                ]
              }
            },
            {
              "title": "Being tired barely mattered (v0.6 · Mikey)",
              "detail": "You were only benched below 35 energy and left out of the squad below 15, and tiredness cut your power and curve by at most 15%.",
              "bars": [
                {
                  "label": "Benched below",
                  "was": 35,
                  "now": 65,
                  "state": "warn",
                  "unit": " energy"
                },
                {
                  "label": "Out of the squad below",
                  "was": 15,
                  "now": 40,
                  "state": "warn",
                  "unit": " energy"
                },
                {
                  "label": "Most power/curve lost when tired",
                  "was": 15,
                  "now": 30,
                  "state": "warn",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Benched below 65, out of the squad below 40. Power and curve up to 30% weaker when tired. Tired-legs substitutions below 25, extra injury risk below 30. Tiredness no longer changes how many chances you get; the energy mode does."
                ]
              }
            },
            {
              "title": "Each browser showed a different scenario count (v0.7 · Harry)",
              "detail": "The number next to each scenario type differed between people: Harry saw 21, Mikey saw 23.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: It counted each browser's own generated cards.",
                  "Fix: It now reads \"in the game / saved\", counted from the shared list, so everyone sees the same numbers. At the time: One on one 21 / 21, Tight angle 11 / 13, Free kick 0 / 1."
                ]
              }
            },
            {
              "title": "On a computer, the card buttons were a phone-style stack (v0.7 · Harry)",
              "detail": "On anything wider than a phone, the card used the stacked phone layout.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: The picture sits in the middle: No good on the left; ✓, the menu and Simulate/Next on the right; the edit row right under the picture, with nothing needing a scroll. Phones keep the stacked layout. \"+ Opponent\" now reads \"+ Opp\" because the full word no longer fit under the narrower picture."
                ]
              }
            },
            {
              "title": "Tune corrections only lived in one browser (v0.8 · Harry)",
              "detail": "A correction recorded with Tune stayed in the browser that recorded it, so the team never saw each other's.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The shared list for corrections didn't exist in the database until its setup script was run.",
                  "Fix: Mikey ran it, and it's confirmed live: corrections are one shared team list. At the time, 3 corrections recorded and 0 proposals."
                ]
              }
            },
            {
              "title": "Leo's 11 scenarios weren't in the game yet (v0.8 · Harry)",
              "detail": "Leo had built 11 scenarios that real matches couldn't use.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Mikey merged them into the game's code."
                ]
              }
            },
            {
              "title": "Every drill had a keeper and a goal, even the ones that don't need one (v0.10.1 · Harry)",
              "detail": "After the trial and training moved onto the real match, every drill showed a full match picture: a goal, a keeper and team-mates, including the technique drill, which is just you, a ball and two cones.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Joining the real match brought its whole picture along, when those modes only needed its ball, drag, contact and flight.",
                  "Fix: Each mode now chooses what is on the pitch: keeper, goal, team-mates and the GOAL/PASS banners can each be switched off. The ball physics stay the real match's. Technique training is now you, a ball and cones. Free kicks keep the keeper and wall. Trial penalties lose the stray team-mates. This is a named test-only setting in the guard, not a copy of the match."
                ]
              }
            },
            {
              "title": "Volley and header chances are switched off for now (v0.10.1 · Harry)",
              "detail": "Harry asked for volleys and headers out of the scenario gallery and out of the game for now.",
              "bars": [
                {
                  "label": "Different chances in 100 highlights",
                  "was": 98,
                  "now": 91,
                  "state": "warn",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not a bug: a decision while they're reworked.",
                  "Fix: One list turns them off. Matches swap them for another chance before it is shown (0 got through in the test). The gallery and Infinite Highlights no longer list them. Team-mates can still head a cross in open play. Delete the word from the list to bring one back."
                ]
              }
            }
          ]
        },
        {
          "kind": "known",
          "title": "Still open",
          "items": [
            {
              "title": "Six security holes are still open (raised in v0.1 · Harry)",
              "detail": "Anyone with the site's public key can write their own XP and rewards, delete every user's progression, or wipe community votes. Two fixes are written but not run on the database.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The two database scripts haven't been run yet.",
                  "Status: Still open. The fix is written; it has to be run in Supabase's SQL editor. Highest priority."
                ]
              }
            },
            {
              "title": "Still too much build-up (raised in v0.1 · Harry)",
              "detail": "Build-up, midfield passes and dribbles are 23% of what a striker sees, and none of them show the goal. Through balls didn't respond to the retune, and the top three chance types are 37.5% of everything against a 32% target. 'The goal wasn't on screen' reports are this, not the camera.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded. Something other than the weighting is driving through balls.",
                  "Status: Not revisited since v0.1."
                ]
              }
            },
            {
              "title": "Byline crosses are rare for a striker (raised in v0.1 · Harry)",
              "detail": "1.7% against a 5% target.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Possibly not a bug: a striker receives crosses rather than delivering them, and a left winger gets 9.2%.",
                  "Status: Not revisited since v0.1."
                ]
              }
            },
            {
              "title": "5 chances in 6,612 have an attacker offside (raised in v0.1 · Harry)",
              "detail": "0.076% of chances build with an attacker offside. Flagged in the gallery, not hidden.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still flagged in the gallery; not revisited."
                ]
              }
            },
            {
              "title": "The wall and the extra players don't touch the ball (raised in v0.2 · Leo)",
              "detail": "They look like they're in the way, but a shot passes straight through them. Blocks and deflections are the next step.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Built as a visual pass first; making them physical is a separate build.",
                  "Status: Still only for show. Blocks and deflections were named as Leo's next step."
                ]
              }
            },
            {
              "title": "How hard the keeper covers his near post is undecided (raised in v0.3 · Harry)",
              "detail": "The generator shades him towards the near post twice as much as the drawings (0.46 against 0.23), and over half of wide one-on-ones have the near post completely closed. 0.20 keeps both corners open but he won't look like he's covering.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: A design choice for Harry, not a bug.",
                  "Status: Waiting on Harry's go for 0.50 on tight angles."
                ]
              }
            },
            {
              "title": "How often anyone should be offside is undecided (raised in v0.3 · Harry)",
              "detail": "Zero offside means offside doesn't exist; before the repair, 391 of 400 one-on-ones ended offside.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not decided yet.",
                  "Status: Not decided yet."
                ]
              }
            },
            {
              "title": "Two base faults left alone on purpose (raised in v0.3 · Harry)",
              "detail": "16.1% of long shots have an 11m+ gap in the defence; 7.0% of tight angles have nobody in the middle.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: It's not clear they're actually wrong.",
                  "Status: Left for a human decision."
                ]
              }
            },
            {
              "title": "Only one-on-ones have drawn scenarios (raised in v0.3 · Harry)",
              "detail": "The other 12 chance types are still made purely by the generator.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Nobody has drawn them yet; the rules adapt automatically once they do.",
                  "Status: Partly: tight angles got drawings in v0.8 (Leo's 11). Most chance types still have none."
                ]
              }
            },
            {
              "title": "The Infinite Match showed 1-7 at half time (raised in v0.4 · Harry)",
              "detail": "Unconfirmed. The test player missed 36 of its 45 attempts, so it may be nothing, but it's worth a proper look.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Unconfirmed, not looked at since."
                ]
              }
            },
            {
              "title": "Half time still happens at minute 45 in a very long match (raised in v0.4 · Harry)",
              "detail": "The half-time banner and the \"Second Half\" button appear once, then the match carries on. This is only cosmetic.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Cosmetic, still open."
                ]
              }
            },
            {
              "title": "One number was changed in the engine file Mikey said never to touch (raised in v0.4 · Harry)",
              "detail": "A striker's long-range weighting went from 6 to 3. It can be undone in one character and needs Mikey's call.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: It was part of making positions pull chances towards themselves.",
                  "Status: Waiting on Mikey's call (a striker's long-range weighting, 6 → 3)."
                ]
              }
            },
            {
              "title": "5 of 11 dev tool pages have no login check (raised in v0.5 · Leo)",
              "detail": "The bicycle, gallery, play, highlights and media-lab pages load without checking for an admin. The other 6 do check.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded. It was found during this round's audit and left alone because nobody had asked for it.",
                  "Status: Still open."
                ]
              }
            },
            {
              "title": "Switching energy mode changes your chances a little late (raised in v0.6 · Mikey)",
              "detail": "Energy use changes from the very next minute, but how many chances you get only changes from the next stretch of play, usually a few match minutes later.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Making it instant means rebuilding how the part of the match you don't play is run.",
                  "Status: Not revisited."
                ]
              }
            },
            {
              "title": "Buying a stake can quietly buy less than you typed (raised in v0.6 · Mikey)",
              "detail": "10% of AEK Athens became 5.2%.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Likely the amount is capped at what's in your bank. Not confirmed against the save; the new confirm box now shows the real % before you commit.",
                  "Status: Not revisited."
                ]
              }
            },
            {
              "title": "The goal net is deeper in the match than on the picture (raised in v0.7 · Harry)",
              "detail": "After the Play fix, the net is still drawn a bit deeper in the match than on the gallery picture.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still open: in Play the net rises above the goal line and the six-yard box isn't drawn."
                ]
              }
            },
            {
              "title": "Team-mates right next to you steal your shot as a pass (raised in v0.7 · Harry)",
              "detail": "A team-mate standing very close takes your shot as if it were a pass to him.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded. Leo's fix (ignore a team-mate that close for about 0.4s after the kick) and Harry's view that everyone's reach is too big both mean changing the match engine, which needs Mikey's OK.",
                  "Status: Still open. Fixing it means touching the match physics file, which needs Mikey's OK."
                ]
              }
            },
            {
              "title": "Keepers on rebounds are too good, and too often off their line (raised in v0.7 · Harry)",
              "detail": "\"Permanent prime Neuer\" on rebounds, and near-post positioning too far out.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still open."
                ]
              }
            },
            {
              "title": "The draft-dev pages aren't sandboxes (raised in v0.8 · Harry)",
              "detail": "/draft-dev and /draft-dev2 share the real Draft's saved game on that device, post to real Draft history, XP and records, and create real multiplayer rooms.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still open: they write to the real Draft save, history, XP and rooms."
                ]
              }
            },
            {
              "title": "The Scenario Builder can't reach the game (raised in v0.8 · Harry)",
              "detail": "Its text says \"saved locally\" but it actually saves to the team's list, and it has no commit, so nothing built there reaches matches.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still open: no commit, and its \"saved locally\" text is wrong."
                ]
              }
            },
            {
              "title": "The Tuning editor saves in that browser only (raised in v0.8 · Harry)",
              "detail": "Nothing on /star-tuning-dev commits, even though earlier notes describe it as part of the commit system.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still open."
                ]
              }
            },
            {
              "title": "Small admin gaps (raised in v0.8 · Harry)",
              "detail": "Squad Builder's Best XI fills 7 bench spots but the bench holds 9; Infinite Highlights is missing from the admin menu; the XP, custom clubs and football admin pages have no admin check on the page itself (their data is still admin-only); nobody knows whether the custom clubs database setup has been run.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still open: bench 7 vs 9 in the squad builder, Infinite Highlights missing from the admin menu."
                ]
              }
            },
            {
              "title": "Goalie Mode has no engine at all (raised in v0.9 · Harry)",
              "detail": "Its keeper stops dead when the result lands.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: It uses its own scripted ball flight instead of the real match.",
                  "Status: Leo's area, left alone as asked. It stays on the guard's watch list."
                ]
              }
            },
            {
              "title": "Two dev prototypes are full copies of the match (raised in v0.9 · Harry)",
              "detail": "The bicycle kick and Live Attack. Neither is reachable in the game.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still copies (the bicycle-kick and Live Attack labs), kept as labs by Harry's call."
                ]
              }
            },
            {
              "title": "Players barely react after shots in drawn one-on-ones (raised in v0.9 · Harry)",
              "detail": "1.17 team-mates move after the shot in a drawn one-on-one, against 2.04 in a generated one (0.81 against 1.69 on tight angles). Highlights and the real game show the same gap.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Hand-drawn one-on-ones start 11.9m from goal against 16.3m, so the shot arrives in 1.84s instead of 2.32s, before anyone has time to move.",
                  "Status: Waiting on Harry's answer to question 8."
                ]
              }
            },
            {
              "title": "A scenario test fails on main (raised in v0.9 · Harry)",
              "detail": "It expects 27 one-on-one drawings.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: 4 of them were deleted in recent commits.",
                  "Status: Still failing: 4 one-on-one drawings were deleted. Mikey and Leo's area."
                ]
              }
            },
            {
              "title": "The guard can't stop a person editing its list (raised in v0.9 · Harry)",
              "detail": "Someone can edit the guard's list to turn a red build green, and physics copied under a new name with no animation loop of its own isn't caught automatically.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Code can't stop a person editing code; only the written rule covers it, until Harry answers on locking it.",
                  "Status: Partly fixed in v0.10: Claude now asks before touching it. A GitHub sign-off (question 10) would close it."
                ]
              }
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/YEK3ykwCQjUpH4S6bQbqKR",
      "updatedAt": null
    },
    {
      "version": "0.10",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-24T12:00:00Z",
      "summary": "The headline is the guard: why the trial, training and five-a-side felt different from a match, and what now stops it happening again. Then every change as the problem, why it happened, and the fix.",
      "stats": [
        {
          "value": "6 → 4",
          "label": "copies of the match left. The trial and training are now the real match"
        },
        {
          "value": "99.8% → 70.3%",
          "label": "a corner penalty in the real game, now the keeper reads your kick at the strike"
        },
        {
          "value": "3.7° → 0.01°",
          "label": "five-a-side: how far the arrow pointed from where the ball went"
        },
        {
          "value": "2,634 → 0",
          "label": "fixtures where both teams wore the same two colours, swapped"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "The headline: the guard",
          "items": [
            {
              "title": "Problem: the trial, training and five-a-side felt slightly different from a real match",
              "detail": "The keeper dived differently, kicks came out harder or softer, and five-a-side's arrow pointed a bit off."
            },
            {
              "title": "Why: six screens had their own copy of the match",
              "detail": "Each copy was right on the day it was made. The real match kept improving and the copies drifted: 12 differences in the trial and training alone. Nothing stopped new copies."
            },
            {
              "title": "Fix: one door into the real match, and a guard on every deploy",
              "detail": "Every screen plays the real match and adds its extras around it. The guard reads the code before each deploy and stops the site going live if anyone adds a copy. 4 copies left, down from 6; the list can only shrink.",
              "more": {
                "summary": "What this means for you",
                "points": [
                  "When you play: the trial, training and gallery feel like the real game because they are the real game.",
                  "Want a screen to play differently? Ask for it by name. It becomes a named dial, not a copy.",
                  "A deploy fails with ONE ENGINE GUARD: players see nothing wrong, the live site keeps the last good version. Paste the message into Claude.",
                  "Claude asks to edit the guard: say yes only if you asked for that change.",
                  "Cost: each deploy takes about 20 seconds longer."
                ]
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Check these",
          "items": [
            {
              "title": "Trial penalties: keeper stays in the middle until you kick, then dives",
              "detail": "New career → Trial → Penalties"
            },
            {
              "title": "Trial free kicks: real match, wall jumps",
              "detail": "Trial → Free kicks"
            },
            {
              "title": "Real match penalties: same keeper, central until the strike",
              "detail": "Any career match with a penalty"
            },
            {
              "title": "Training Technique: cones on the pitch, ball judged through them",
              "detail": "Training → Technique"
            },
            {
              "title": "Training Power and Free Kick: the real match, result after each rep",
              "detail": "Training → Power / Free Kick"
            },
            {
              "title": "Training Pace: the first-person run",
              "detail": "Training → Pace"
            },
            {
              "title": "Five-a-side: the arrow points where the ball goes",
              "detail": "Trial → Five-a-side"
            },
            {
              "title": "Five-a-side: a sideways drag isn't stronger than in the match",
              "detail": "Trial → Five-a-side"
            },
            {
              "title": "Gallery corner: picture turned sideways, same as Play",
              "detail": "/star-gallery-dev → corner"
            },
            {
              "title": "Gallery: real kits, and a bigger picture on a laptop",
              "detail": "/star-gallery-dev on a laptop"
            },
            {
              "title": "Play Area power dial changes Gallery Play and Highlights",
              "detail": "/star-play-dev → Power, then Gallery Play"
            },
            {
              "title": "Kits: teams never wear the same two colours swapped (e.g. Man United v Bournemouth)",
              "detail": "Any career match · /star-gallery-dev corner"
            },
            {
              "title": "Five-a-side: a drag up the screen hits the same as in the match",
              "detail": "Problem: a drag up the screen hit harder than the same drag in a match (67.7% vs 54.1%).",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: five-a-side's pitch is shorter than the match's, and it measured your drag against its own height.",
                  "Fix: it reads your drag against the match's height (your answer to question 11)."
                ]
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Problems fixed",
          "items": [
            {
              "title": "The trial's penalties and free kicks are the real match",
              "detail": "Problem: the trial keeper was already diving as you struck, and the ball flew a little differently.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: the trial ran its own copy of the match (about 1,280 lines) that had drifted.",
                  "Fix: the trial plays the real match and only sets up and scores each rep (about 600 lines). Stats are invisible, like you asked."
                ]
              }
            },
            {
              "title": "Training's strike drills and Pace run are the real match",
              "detail": "Problem: Power, Technique and Free Kick kicked harder or softer than a match, and the wall stood squashed together.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: training had its own copy too. Its wall was 0.75m apart; the match uses 1.15m.",
                  "Fix: the drills play the real match; cones are on the real pitch; Pace is the match's first-person run; the wall is spaced like the match."
                ]
              }
            },
            {
              "title": "Five-a-side shoots like the match",
              "detail": "Problem: the arrow pointed slightly away from where the ball went, and a sideways drag hit about 20% harder.",
              "bars": [
                {
                  "label": "Sideways 40px drag, power",
                  "was": 83.7,
                  "now": 69.8,
                  "target": 69.8,
                  "unit": "%",
                  "state": "good"
                },
                {
                  "label": "Arrow vs ball direction",
                  "was": 3.7,
                  "now": 0.01,
                  "target": 0,
                  "unit": "°",
                  "state": "good"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: it measured your drag against its own, differently shaped pitch.",
                  "Fix: it uses the match's exact drag maths and draws the arrow along the ball's real path."
                ]
              }
            },
            {
              "title": "Gallery corners are turned like Play and the real match",
              "detail": "Problem: the corner picture was flat, but Play turned it sideways, so it looked like a different chance.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: the picture was drawn with different settings from Play.",
                  "Fix: the picture is turned like Play (40/40 within 0.6px), bigger on a laptop, with real kits."
                ]
              }
            },
            {
              "title": "Kits: no more two teams in the same two colours swapped",
              "detail": "Problem: Man United (red/white) v Bournemouth's change kit (white/red) were hard to tell apart.",
              "bars": [
                {
                  "label": "Fixtures with swapped colours (of 14,280)",
                  "was": 2634,
                  "now": 0,
                  "target": 0,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: the clash check only compared shirts.",
                  "Fix: it checks shirt and shorts together, and the away side changes its shorts first."
                ]
              }
            },
            {
              "title": "Five-a-side: a drag up the screen hits the same as in the match",
              "detail": "Problem: a drag up the screen hit harder than the same drag in a match (67.7% vs 54.1%).",
              "bars": [
                {
                  "label": "40px drag up, power",
                  "was": 67.7,
                  "now": 54.1,
                  "target": 54.1,
                  "unit": "%",
                  "state": "good"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: five-a-side's pitch is shorter than the match's, and it measured your drag against its own height.",
                  "Fix: it reads your drag against the match's height (your answer to question 11)."
                ]
              }
            },
            {
              "title": "The first chance of every match was built on every redraw and thrown away",
              "detail": "It's built once now. No change to how it plays."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "The penalty keeper reads your kick (real game, every penalty)",
              "detail": "Problem: a corner penalty scored 99.8% of the time; down the middle scored 0%.",
              "bars": [
                {
                  "label": "Corner, scored",
                  "was": 99.8,
                  "now": 70.3,
                  "unit": "%",
                  "state": "good"
                },
                {
                  "label": "2m from centre, scored",
                  "was": 67.5,
                  "now": 41.5,
                  "unit": "%",
                  "state": "good"
                },
                {
                  "label": "Down the middle, scored",
                  "was": 0,
                  "now": 22,
                  "unit": "%",
                  "state": "good"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: the keeper didn't react to penalties at all.",
                  "Fix: he waits in the middle, then dives 80% of the time and picks your side 60% (your answer to question 1)."
                ]
              }
            },
            {
              "title": "A harder trial keeper, as a named dial",
              "detail": "Harder reps turn up how often he goes and how well he reads. Corner scored: 73% on the easiest trial, 45% on the hardest. It's a listed test dial, not a copy."
            },
            {
              "title": "Claude checks the guard at the end of every turn, and asks you before touching it"
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "authoredChance test fails on main",
              "detail": "4 one-on-one drawings were deleted. Mikey and Leo's area."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/5njEpoPHxLK1oWvin2NLhZ",
      "updatedAt": null
    },
    {
      "version": "0.9",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-24T00:00:00Z",
      "summary": "One engine: why the trial, the training and the test screens felt like a different game, what is fixed, every open problem, and ten questions to paste back.",
      "stats": [
        {
          "value": "12",
          "label": "ways the trial and the training differed from the real match, all fixed by one move next round"
        },
        {
          "value": "340 → 366px",
          "label": "gallery Play now runs at the real match's size, so a drag hits exactly as hard as in a career"
        },
        {
          "value": "6 → no 7th",
          "label": "copies of the match left, and every build now refuses a new one"
        },
        {
          "value": "10/10",
          "label": "hidden copies planted to test the guard, all caught, and 2 look-alikes correctly left alone"
        }
      ],
      "sections": [
        {
          "kind": "fixed",
          "title": "Fixed: the test screens now play the real game",
          "items": [
            {
              "title": "A drag now hits exactly as hard as in a career",
              "detail": "The game measures a drag against the pitch's height, so a smaller pitch meant a harder kick. Every test screen now plays at the real match's size.",
              "bars": [
                {
                  "label": "Kick strength vs a career, gallery on a phone",
                  "was": 7.6,
                  "now": 0,
                  "target": 0,
                  "unit": "%",
                  "state": "good"
                },
                {
                  "label": "Kick strength vs a career, laptop",
                  "was": 16,
                  "now": 0,
                  "target": 0,
                  "unit": "%",
                  "state": "good"
                }
              ]
            },
            {
              "title": "Real players, not nobody",
              "detail": "The test screens now load the same real squads a career does: real finishing, real faces, the opposition's own keeper."
            },
            {
              "title": "Real weather, with a switch",
              "detail": "Windy or wet in about 4 matches in 10, as in a career. Play Area → Weather → Clear turns it off."
            },
            {
              "title": "Infinite Match stopped quietly weakening you",
              "detail": "From about minute 150 every kick was 30% weaker. You now get fresh legs every 90 minutes. Worked out from the code, not measured in play."
            },
            {
              "title": "Team understanding now counts in test screens",
              "detail": "The test screens silently used 60. The guard caught it on its first run."
            },
            {
              "title": "Gallery Play: the first chance has people in it, and it no longer restarts mid-kick"
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "One door into the engine for every test screen",
              "detail": "New features plug into it and add their extras around the outside. They never get a copy of the match."
            },
            {
              "title": "A guard inside every deploy",
              "detail": "The site won't deploy with a new copy of the match. Fable 5.1 tried to break it, and the gaps it found are closed or listed.",
              "more": {
                "summary": "What it checks",
                "points": [
                  "No new copy of the match, however it's hidden (renamed, re-routed, loaded late).",
                  "No screen writing its own ball physics (every animation loop is on a list that only shrinks).",
                  "The test screens get every setting a career gets.",
                  "It fails if it goes blind (10 planted copies) or jumpy (2 harmless look-alikes)."
                ]
              }
            },
            {
              "title": "Play Area: Keeper (Real / Set) and Weather (Real / Clear)",
              "detail": "Both start on the real game, and they only ever change the test screens."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "The trial and the training are still copies (12 differences)",
              "detail": "The keeper guesses before the kick, the ball is drawn at half height and always in front of the keeper, and training uses a coarser physics step. The fix is to move them onto the one door next round.",
              "pill": {
                "text": "question 1–2",
                "tone": "amber"
              }
            },
            {
              "title": "Five-a-side: a sideways drag hits 20% harder, and the arrow points wider than the ball goes",
              "pill": {
                "text": "question 3",
                "tone": "amber"
              }
            },
            {
              "title": "Goalie Mode has no engine, and the two prototypes are copies",
              "pill": {
                "text": "questions 4–5",
                "tone": "amber"
              }
            },
            {
              "title": "Two teams in near-identical kits pass the clash check",
              "detail": "The check only compares shirts.",
              "pill": {
                "text": "question 6",
                "tone": "amber"
              }
            },
            {
              "title": "The gallery picture is blue against red, but Play wears club kits",
              "detail": "Caused this round.",
              "pill": {
                "text": "question 7",
                "tone": "red"
              }
            },
            {
              "title": "Drawn one-on-ones start 11.9m out against 16.3m, so fewer players react",
              "detail": "The real game has the same gap. It isn't a highlights bug.",
              "pill": {
                "text": "question 8",
                "tone": "amber"
              }
            },
            {
              "title": "The guard can't stop a person editing its list",
              "pill": {
                "text": "questions 9–10",
                "tone": "amber"
              }
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Trial and training onto the one door",
              "detail": "Clears all 12 differences."
            },
            {
              "title": "Then difficulty scaling",
              "detail": "Tuned on the real game."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/5njEpoPHxLK1oWvin2NLhZ",
      "updatedAt": null
    },
    {
      "version": "0.8",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-23T00:00:00Z",
      "summary": "How to build scenarios, step by step · Save and Commit from inside Infinite Match and Infinite Highlights · the difficulty argument, researched and simulated · an eye (ⓘ) on every admin page",
      "stats": [
        {
          "value": "156/156",
          "label": "chances saved from a match that come back in the gallery exactly as they were"
        },
        {
          "value": "26",
          "label": "admin and dev pages that now have the eye explaining every button"
        },
        {
          "value": "9% → 0%",
          "label": "how much bigger Play was than the picture on a phone — the goalie that \"still moved\""
        },
        {
          "value": "~1 in 100",
          "label": "players still playing on the day they'd reach the Premier League at today's pace (model)"
        }
      ],
      "sections": [
        {
          "kind": "added",
          "title": "How to build scenarios",
          "items": [
            {
              "title": "1. Open the gallery, then 11-a-side",
              "detail": "knowitball.co.uk/star-gallery-dev, signed in as admin. 5-a-side is for looking only. Tuning & Commit is where saved-but-not-live scenarios wait."
            },
            {
              "title": "2. Pick a chance type",
              "detail": "Each chip reads in the game / saved, with the same numbers on every device. one on one · 21/22 = 22 saved, 21 committed."
            },
            {
              "title": "3. Open a card and read the two pills",
              "detail": "Unsaved (this browser) → Saved (the team sees it, not in matches) → Committed (live). A red line names what breaks the chance's own rules."
            },
            {
              "title": "4. Fix it: drag anyone, or the ball",
              "detail": "+ Mate adds a runner who makes a real run, + Opp adds an opponent, Remove takes out whoever you tapped. A blue border means unsaved."
            },
            {
              "title": "5. Check it plays right: ▶ Play",
              "detail": "It plays exactly the picture, drags and all. On a phone the keeper, ball and players now land in the same places."
            },
            {
              "title": "6. Keep it or bin it",
              "detail": "Save & Approve (✓) saves it for the team. ✕ No good marks it on your device only.",
              "more": {
                "summary": "The ⋯ menu",
                "points": [
                  "Save, Revert to built-in, Commit to repo, Export JSON, Discard unsaved edits.",
                  "Revert only removes the saved copy. A committed copy stays in the game. Delete removes both."
                ]
              }
            },
            {
              "title": "7. Want more? ▶ Sim",
              "detail": "Rolls a fresh chance of this type the way a match does. Next → rolls another, and Save & Approve adds a good one as the type's next card. The fastest way to reach 30–50 per type."
            },
            {
              "title": "8. Tune: only for teaching the generator",
              "detail": "After a drag, Tune records what was wrong without saving the picture. Once 3 agree, ask Claude for \"the tuner proposals\". Now: 3 recorded, 0 proposals."
            },
            {
              "title": "9. Put it in the game: Tuning & Commit",
              "detail": "Look through all N, then press Commit all N once. It makes one commit and one deploy, about 2 minutes. Every commit also saves the same copy to the team's list."
            },
            {
              "title": "10. When the game actually uses them",
              "detail": "A type needs 5 committed drawings. Each chance served is one drawing nudged up to 2m and checked against the type's laws (true in 9 of 10 drawings). A drawing that breaks a law is never used as a base.",
              "bars": [
                {
                  "label": "one on one, committed",
                  "was": 0,
                  "now": 21,
                  "target": 50,
                  "state": "good"
                },
                {
                  "label": "tight angle, committed",
                  "was": 0,
                  "now": 11,
                  "target": 50,
                  "state": "good"
                },
                {
                  "label": "free kick, committed",
                  "was": 0,
                  "now": 0,
                  "target": 50,
                  "state": "warn"
                }
              ]
            }
          ]
        },
        {
          "kind": "added",
          "title": "Save straight from a match",
          "items": [
            {
              "title": "Infinite Match: Edit, Save and Commit pinned to the top",
              "detail": "Save keeps the chance you're on exactly as it stands. Commit puts it in the game. ✎ Edit opens it to drag first."
            },
            {
              "title": "Infinite Highlights: Save and Commit on every highlight",
              "detail": "Save used to appear only after a drag, and there was no Commit on that screen."
            },
            {
              "title": "It lands in the gallery as a card of that type",
              "detail": "It counts in the chips and shows up in Tuning & Commit.",
              "bars": [
                {
                  "label": "saved chances rebuilt exactly",
                  "was": 0,
                  "now": 156,
                  "target": 156,
                  "state": "good"
                }
              ]
            },
            {
              "title": "Not yet seen signed in as admin",
              "detail": "Both reach the server. My test browser was refused, as expected, because it isn't signed in as admin."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Difficulty, scaling & paying: deep dive",
          "items": [
            {
              "title": "All three of you want modes. You disagree on the default and on who pays",
              "detail": "Harry: slow road as the main mode, casual clearly labelled. Leo: let players choose; a quick route keeps people. Mikey: have both, never let it go flat."
            },
            {
              "title": "A few long-stayers pay for everything",
              "detail": "The top 5% of spenders make 70% of revenue, rising to 81% by month 10. 87% of top spenders bought nothing in month 1 (Moloco, 55 games)."
            },
            {
              "title": "Most players leave on day one",
              "detail": "The typical game keeps 16% to day 2 and 3.7% to day 7; the top quarter keeps 26–28% and 7–8% (GameAnalytics, 11,600 games)."
            },
            {
              "title": "Swings and lulls drive quitting more than a hard start",
              "detail": "263k players: uneven difficulty mattered more than average difficulty; winning streaks protect; losing streaks didn't make beginners quit."
            },
            {
              "title": "Easier for players about to quit meant more money overall",
              "detail": "330k-player trial (Ascarza, Netzer & Runge 2025): they spent less that round but stayed longer, about 7–8 cents more per player over 30 days. \"Harder means they spend more\" didn't hold up."
            },
            {
              "title": "Simulation: ~10 in 1,000 players are still playing on the day they'd reach the Prem",
              "detail": "At 20 hours to the top and 30 minutes a day. Halving the road to 10 hours makes it 17 in 1,000. The live dials are on the linked page."
            },
            {
              "title": "Simulation: does a casual mode make more money?",
              "detail": "Harry's view 95, Leo's 183, Mikey's 163, worst case 71 (main mode alone = 100). It flips on how many new players casual brings and how long they stay. On Harry's own assumptions it pays for itself at about 1 new player for every 5 you already have."
            },
            {
              "title": "In-game purchases",
              "detail": "Sell rewarded ads, cosmetics, a cheap starter pack, and expensive time-savers. Hold interstitial ads back until players are well in. Never sell stat boosts for real money.",
              "more": {
                "summary": "Why",
                "points": [
                  "Cheap skips make the climb feel worthless (Pay to (Not) Play).",
                  "KIB Stat Cans are fine bought with stars. Selling them for real money is the pay-to-win line.",
                  "Score! Hero waits until level 25 before interstitial ads."
                ]
              }
            },
            {
              "title": "Recommendation: Road to Glory as the default, Superstar Start (casual) beside it",
              "detail": "Casual is the same game with different settings. A hard mode is earned later. Plan pace in hours, and decide with PostHog data at about 1,000 players per mode.",
              "pill": {
                "text": "decision for Harry",
                "tone": "amber"
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Infinite Match had no Save or Commit in reach",
              "detail": "There was one Edit button that scrolled away above the scoreboard. Edit, Save and Commit are now pinned to the top."
            },
            {
              "title": "Infinite Highlights had no Commit, and no Save until you dragged",
              "detail": "Both are now under every highlight."
            },
            {
              "title": "The keeper \"still moved\" when you pressed Play on a phone",
              "detail": "At 340px the picture drew 340px in a 312px space and got cut off, while Play fitted: a 9% jump. Both are 312px now, seen in a browser.",
              "bars": [
                {
                  "label": "Play vs picture size, phone",
                  "was": 9,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ]
            },
            {
              "title": "A gallery card could go blank on a resize",
              "detail": "This came from the phone fix, which is already on main: a negative picture size before the screen was measured. 7 errors → 0."
            },
            {
              "title": "Button rows cut off on a phone",
              "detail": "Infinite Highlights ran to 433px on a 390px screen. The gallery clipped \"+ Mate\" and \"Remove\" once Tune appeared. Everything fits now, measured."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "An eye (ⓘ) on all 26 admin and dev pages",
              "detail": "It explains every button by its on-screen name, where saving goes, whether anything commits, and where it shows up in the game. Anyone who changes a button now has to update its explanation in the same change."
            },
            {
              "title": "A test for saving from a match",
              "detail": "156/156 saved live chances rebuild exactly. When the save was broken on purpose, the test caught it: 0/156."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Tune corrections are shared now",
              "detail": "Mikey ran the migration, and it's confirmed live: 3 corrections, 0 proposals."
            },
            {
              "title": "Leo's 11 scenarios are in the code",
              "detail": "Merged to main."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "draft-dev pages aren't sandboxes",
              "detail": "/draft-dev and /draft-dev2 share the real Draft's saved game, post to real history, XP and records, and create real rooms.",
              "alert": true
            },
            {
              "title": "The goal is drawn differently in Play and in the picture",
              "detail": "In Play the net rises above the goal line. The players, keeper and ball are in the same places."
            },
            {
              "title": "The Scenario Builder can't reach the game",
              "detail": "Its text says it saves locally, but it actually saves to the team's list, and it has no commit."
            },
            {
              "title": "The Tuning editor saves in that browser only",
              "detail": "Nothing on /star-tuning-dev commits."
            },
            {
              "title": "Team-mates right next to you steal your shot as a pass",
              "detail": "Carried over. Needs the match engine file.",
              "pill": {
                "text": "needs Mikey",
                "tone": "amber"
              }
            },
            {
              "title": "\"Not the same game in the play area\": which part?",
              "detail": "Carried over.",
              "pill": {
                "text": "blocked on Harry",
                "tone": "amber"
              }
            },
            {
              "title": "Not seen with an admin sign-in",
              "detail": "Save and Commit from Infinite Match and Infinite Highlights."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.7 — Play matches the picture, the difficulty research",
              "detail": "Fixed: Play no longer made the picture jump; the ball drags on its own; false \"attacker offside\" 3/65 → 0/65; ✓ on a sim saves; commits also save. Added: Edit this chance in Infinite Match. Still open: team-mates stealing the shot, keeper near-post, camera framing."
            },
            {
              "title": "v0.4 — Play Area, Infinite Match, commit review",
              "detail": "Play in the gallery used your saved drawing, the Play Area and Infinite Match arrived, and scenarios could be reviewed before committing."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/DYAaW3Bma3zowkG5DcoQaS",
      "updatedAt": null
    },
    {
      "version": "0.7",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-23T00:00:00Z",
      "summary": "Play now looks exactly like the picture · the ball moves on its own again · every browser counts the same scenarios · edit a chance mid-match in Infinite Match · the difficulty argument, researched",
      "stats": [
        {
          "value": "0/65",
          "label": "saved scenarios wrongly showing \"attacker offside\" (was 3/65)"
        },
        {
          "value": "13% → 0%",
          "label": "how much bigger Play was drawn than the picture"
        },
        {
          "value": "5",
          "label": "tight angles newer in the code than the database — can't be written back over any more"
        },
        {
          "value": "1",
          "label": "Supabase step for you: star_scenario_corrections.sql"
        }
      ],
      "sections": [
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Pressing Play no longer makes the picture jump",
              "detail": "Nothing actually moved before the kick — I watched it for 4 seconds in a real browser. Play was drawn about 13% wider than the picture, with players about half as big again, so everything looked like it shifted.",
              "more": {
                "summary": "What changed",
                "points": [
                  "The picture now draws players at the match's own size, so they are the same size before and after Play.",
                  "Play now runs at the picture's exact width. Checked side by side: keeper, ball and every player land within a few pixels of where they were.",
                  "Still different: the goal net is drawn a bit deeper in the match than on the picture. Worth a look before calling it identical."
                ]
              }
            },
            {
              "title": "The ball can be dragged on its own again",
              "detail": "Mikey's \"ball rides at your feet\" change is undone, as you asked. It had also made Play ignore where you put the ball — that's how a ball ended up on top of a defender after pressing Play."
            },
            {
              "title": "False \"attacker offside\" when everyone was behind the ball",
              "detail": "When you removed the poacher, he was parked 400m past the goal line — which counts as offside. He's parked behind the ball now.",
              "bars": [
                {
                  "label": "Saved scenarios flagged offside",
                  "was": 3,
                  "now": 0,
                  "state": "good"
                }
              ]
            },
            {
              "title": "✓ on a simulated chance now actually saves it",
              "detail": "It used to save only if you'd dragged something, so approving a good sim just ticked it and lost it. Now ✓ on anything not yet saved saves it, and it becomes that type's next card."
            },
            {
              "title": "Leo's commit worked, but left a trap",
              "detail": "His 11 scenarios are in the code. But 5 of the tight angles were committed without being saved first, so the database held the older copy — and the next \"Commit all\" from anyone would have written the old copy back.",
              "more": {
                "summary": "Two fixes",
                "points": [
                  "Every commit now also saves the same copy to the database, so the two can't drift apart.",
                  "When the code is newer than the database, the card now reads \"Committed\" and is left off the Commit all list, instead of saying the game has the older copy (the opposite of true)."
                ]
              }
            },
            {
              "title": "Team-mates you add in the gallery now play",
              "detail": "\"+ Mate\" used to add scenery that never reacted. Now he's a real support runner: he goes for a ball played near him and can receive a pass or an order. Not seen in a live Play yet."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Edit this chance, mid-match, in Infinite Match",
              "detail": "A button above the match opens the chance you're on, as it was before the kick. Drag, add or remove players, then Save (it becomes a card of that type in the gallery) or Commit (it goes in the game). Close it and carry on playing.",
              "more": {
                "summary": "How it works",
                "points": [
                  "A chance in a real match can't be rebuilt later, so a copy is taken when it's served. The match only makes that copy when a screen asks for it; a normal career doesn't.",
                  "The chance is saved on a base picture of the same type, with your players dragged onto it. Checked on 144 chances: every card shows exactly the chance you were on, with the match's own camera framing.",
                  "Opponents show in red in the editor whatever kit they wore in the match."
                ]
              }
            },
            {
              "title": "A highlight you save in Infinite Highlights now goes into that type's scenarios",
              "detail": "It used to be saved somewhere the gallery never looked. It's now saved exactly like a gallery sim, so it shows as a card, counts, and commits. The one saved the old way still shows up."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "The picture sits in the middle, the verdict buttons down its sides",
              "detail": "On anything wider than a phone: No good on the left; ✓, the menu and Simulate/Next on the right; the edit row right under the picture. Nothing needs scrolling to reach. Phones keep the stacked layout."
            },
            {
              "title": "Every browser shows the same number for each type",
              "detail": "The number next to each type now reads in the game / saved, counted from the shared list, so everyone sees the same thing. It used to count each browser's own generated cards, which is why you saw 21 and Mikey saw 23.",
              "more": {
                "summary": "Right now",
                "points": [
                  "One on one: 21 in the game, 21 saved.",
                  "Tight angle: 11 in the game, 13 saved (2 saved, not committed).",
                  "Free kick: 0 in the game, 1 saved."
                ]
              }
            },
            {
              "title": "\"+ Opponent\" reads \"+ Opp\"",
              "detail": "The full word didn't fit on the button once the row sat under a narrower picture."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Difficulty and scaling — what the research says",
          "items": [
            {
              "title": "You're all right about different things",
              "detail": "Everyone agreed modes should exist. The argument is about which one is the main game and what the others change.",
              "more": {
                "summary": "What the evidence backs, person by person",
                "points": [
                  "Harry — backed: money comes from players who stay for months. In games that live off big spenders, the top 5% of spenders make over 70% of revenue, rising to 81% by month 10. 87% of eventual top spenders hadn't bought anything in month one (Moloco, Aug 2026, 55 games).",
                  "Harry — not backed: \"harder means they spend more\". A 330,000-player trial gave players who were about to quit easier levels. They spent less in that round but stayed longer, so they spent more overall — about 7-8 cents more per player over 30 days (Ascarza, Netzer & Runge, 2025).",
                  "Leo — backed: day one is where most players are lost. The typical game keeps 15-16% of players to day 2 and 3.4-3.9% to day 7 (GameAnalytics, 11,600 games).",
                  "Leo — not backed: no study I found shows starting at United keeps more players than starting low.",
                  "Mikey — backed: a study of 263,000 players found swings in difficulty drove quitting more than how hard the game was on average. Losing streaks didn't make beginners quit; winning streaks kept everyone. New Star Soccer's own creator put its pull down to pace: \"you're only two minutes away from another result, another wage packet\"."
                ]
              }
            },
            {
              "title": "Recommendation: a slow road to the top as the main mode, a clearly labelled casual mode beside it",
              "detail": "Main mode pre-selected. \"Superstar Start (casual)\" next to it on the same screen, not buried in settings. A harder mode later, unlocked by earning it.",
              "more": {
                "summary": "What each mode changes",
                "points": [
                  "Main mode: start low as now. Judge the pace in hours played, not seasons. Something big every session — a promotion chase or a cup tie against a Premier League club in season 1, and an unlock every season (Mikey's free trial of the curve boots fits here).",
                  "Casual mode: the same game with different settings — where you start, how strong opponents are, shop prices, how easy transfers are. Its own saves and achievements. The main mode's flow doesn't change for it — Harry's condition.",
                  "Hard mode later, earned (you suggested a Ballon d'Or). No paid boosts in it: real-money stat boosts are what gets a game called pay-to-win.",
                  "Inside the main mode, even out difficulty spikes without making it easier on average — the research points at spikes, not the average. For example, a retry after watching an ad instead of rigging results.",
                  "Money: rewarded ads for players who don't pay; hold interstitial ads back until well in (Score! Hero waits until level 25); cosmetics; time-savers priced high enough not to cheapen the climb.",
                  "Settle it with data, not argument: PostHog is already set up. Compare day-1 and day-7 retention and payer rate by mode, and test how long season 1 takes, once there are about 1,000 players in each mode."
                ]
              }
            },
            {
              "title": "What the research couldn't answer",
              "detail": "No published split of casual vs hardcore spending in football games, no Celeste assist-mode usage numbers, and no test of starting weak vs starting strong. Treat the above as direction, not proof — almost all of it is mobile free-to-play data, not a browser football game."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Team to-dos from today's chat",
          "items": [
            {
              "title": "Leo and Mikey: fill the scenario gallery",
              "detail": "At least 5 per type, no maximum — aim for 30-50 each, because a rule set from 5 is much worse than one from 50. Harry makes the rule sets after."
            },
            {
              "title": "Check for bugs first",
              "detail": "Anything not saving, and whether it works in game."
            },
            {
              "title": "Team-mates right next to you steal your shot as a pass",
              "detail": "Leo's fix: ignore a team-mate that close for about 0.4s after the kick; Harry also thinks everyone's reach is too big. Both mean changing canvasEngine.ts, which Mikey said never to touch — needs his OK first.",
              "pill": {
                "text": "needs Mikey",
                "tone": "amber"
              }
            },
            {
              "title": "Keepers on rebounds are too good, and too often off their line",
              "detail": "\"Permanent prime Neuer\" on rebounds, and near-post positioning too far out. The per-type keeper setting exists; tight angle near-post 0.50 is still waiting on your go."
            },
            {
              "title": "Camera framing can't be changed in the builder",
              "detail": "Saved cards can now carry their own framing (added for Infinite Match), so a zoom/pan control is a small step from here. Not built."
            },
            {
              "title": "Commits must land on main and be saved",
              "detail": "Now true by construction: every commit also saves the same copy to the shared list."
            },
            {
              "title": "Energy changes are Mikey's",
              "detail": "Left alone this round, as you asked."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Run star_scenario_corrections.sql in Supabase",
              "detail": "Until then Tune corrections stay in the browser that made them.",
              "alert": true
            },
            {
              "title": "\"It's not the same game in the play area\" — which part?",
              "detail": "The picture-vs-Play mismatch is fixed. For the rest I need to know what looks or feels different: the kits, the faces, the ball, how the shot feels?",
              "pill": {
                "text": "blocked on Harry",
                "tone": "amber"
              }
            },
            {
              "title": "Not seen live: added team-mates reacting in Play",
              "detail": "I read the code and worked it out; I haven't watched one take a pass."
            },
            {
              "title": "The 5 tight angles are still older in the database",
              "detail": "Nothing breaks — the gallery shows the newer code copy. They'll match again the next time anyone saves or commits them."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.4 — Play Area, Infinite Match, commit review",
              "detail": "Play in the gallery used your saved drawing, the Play Area and Infinite Match arrived, and scenarios could be looked through before committing."
            },
            {
              "title": "v0.3.5 — from the 40-minute call",
              "detail": "Delete on any scenario, the X relabelled No good, and every decision and idea from the call written down."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/U1uHCBfUzgsoozGaFnKxTG",
      "updatedAt": null
    },
    {
      "version": "0.6",
      "title": "Mikey's patch notes",
      "publishedAt": "2026-09-22T00:00:00Z",
      "summary": "Premier League wages tied to real wage-bill spending · fame, reputation and careers rebuilt · buy/sell your stake properly · in-match energy modes with a real ticking clock · 151 test files green",
      "stats": [
        {
          "value": "★100,000",
          "label": "cap on weekly wage in the Premier League (was uncapped)"
        },
        {
          "value": "0-100",
          "label": "fame is now one capped number with six real levels"
        },
        {
          "value": "22 → 50",
          "label": "seasons a career can now run for"
        },
        {
          "value": "95 / 60 / 30",
          "label": "energy a full match costs on High / Medium / Low"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "The economy — wages, energy cans, boots",
          "items": [
            {
              "title": "Premier League wages now scale off what your club actually spends on wages in real life",
              "detail": "Liverpool, Man City and Arsenal pay far more than Ipswich or Hull for the same player, plus a boost for recent honours and star rating — capped at ★100,000 a week so it never runs away."
            },
            {
              "title": "KIB Stat Cans removed entirely",
              "detail": "Only the three energy cans remain. Their price now scales off your own weekly wage instead of being a flat number."
            },
            {
              "title": "Boot prices and lifespans corrected",
              "detail": "NS-Pure is now half price. Starter, Semi-Pro and Pro boots wear out roughly twice as fast as before, matched per boot."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Fame and Reputation, rebuilt from the ground up",
          "items": [
            {
              "title": "Fame is now one number, 0-100, with six real levels",
              "detail": "Unknown, Local Name, Rising Star, National Name, Global Star, Icon. Earned only from big moments — promotions, trophies, awards, Ballon d'Or — never just from playing matches."
            },
            {
              "title": "What you own adds fame too, but it wears out",
              "detail": "A car or a watch adds fame with a diminishing curve, not a flat bonus, and stops counting once it's worn out — items now genuinely wear out over time instead of lasting forever."
            },
            {
              "title": "A scandal now adds fame and costs reputation, instead of just subtracting fame",
              "detail": "Being infamous is still fame. It costs you somewhere else instead."
            },
            {
              "title": "Reputation is now one number, 0-100, not four separate bars",
              "detail": "Unlocks real powers at 30, 60 and 90. Merging two clubs now costs 20 reputation, not 5."
            },
            {
              "title": "Sponsors have to be re-earned",
              "detail": "Every deal now expires after 1 season (2 for Watch, Jewelry and Car brands) instead of lasting forever once signed."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "A career was quietly capped at around 22 seasons",
              "detail": "Not a hard 5-season limit as first suspected — forced retirement at age 40 was ending an 18-year-old's career far earlier than it should. Careers can now run 50 seasons."
            },
            {
              "title": "Leo's career, stuck since season 5, is fixed",
              "detail": "His save carried an old-shaped rule book from before a newer field existed, which crashed the Champions League draw every time his season tried to roll over. Rule books now fill in anything missing instead of crashing on it."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Ownership — real buy/sell, not all-or-nothing",
          "items": [
            {
              "title": "Buy more or sell some, with a slider and a confirm step",
              "detail": "The Portfolio's old \"sell entire stake\" button is now two real buttons — Buy more and Sell some — with a slider for how much and a confirmation screen before anything happens, so a mis-click can't cost you a stake."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Energy master plan — in-match modes, a real clock, rest days",
          "items": [
            {
              "title": "Three switchable energy modes during a match",
              "detail": "Low, Medium and High sit as buttons on a live energy bar at the bottom of the commentary screen, in place of the old repeated stats row. High burns energy faster for noticeably more chances; Low burns half as much for noticeably fewer. Medium plays exactly like before.",
              "bars": [
                { "label": "Low", "was": 30, "now": 30, "target": 95, "state": "good" },
                { "label": "Medium", "was": 60, "now": 60, "target": 95, "state": "warn" },
                { "label": "High", "was": 95, "now": 95, "target": 95, "state": "bad" }
              ]
            },
            {
              "title": "A real, ticking match clock",
              "detail": "The minute now counts up one at a time — 1, 2, 3 … 45, 46 … 90 — instead of jumping unpredictably between commentary lines, and energy drains with it live."
            },
            {
              "title": "A KIB can button at half time",
              "detail": "Sits beside the Second Half button, shows how many Basic cans you own, and gives +25 energy per tap."
            },
            {
              "title": "Energy now recovers from real rest days between fixtures",
              "detail": "Every day you don't play adds energy back — Saturday to Saturday is 6 days' recovery, Saturday to a midweek cup game is 3. A property and a good training ground add a little more."
            },
            {
              "title": "Bigger competitions cost more energy",
              "detail": "The Premier League costs the most, down to the National League at about three-quarters of that. Domestic cup ties cost whatever the opponent's own league would cost. Europa League, Champions League and the Super Cup cost more again."
            },
            {
              "title": "Being tired matters more than it used to",
              "detail": "Bench threshold raised to below 65 energy (was 35), left out of the squad below 40 (was 15). Power and curve can now be cut by up to 30% when tired, and tired legs raise substitution and injury risk."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Switching energy mode mid-match changes chances a little late",
              "detail": "Energy use changes from the very next minute; how many chances you get only changes from the next stretch of play, usually a few match minutes later.",
              "pill": { "text": "low priority", "tone": "amber" }
            },
            {
              "title": "Production build hasn't been run for this version",
              "detail": "The machine was out of memory when it was tried. Type-check and every test pass; the build should be re-run once memory is free.",
              "pill": { "text": "low priority", "tone": "amber" }
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Play a full season with the new energy system live",
              "detail": "Then tune rest-day recovery, training cost and the bench threshold in the tuning editor if any of them feel wrong."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/4fuKfUh73WvRmxLdiU9tPu",
      "updatedAt": null
    },
    {
      "version": "0.5",
      "title": "Leo's patch notes",
      "publishedAt": "2026-09-23T02:30:00Z",
      "summary": "Five-a-side could freeze solid mid-match — fixed and fuzz-tested · dev cheats to skip the grind · real power for owning the club you play for · PR #568 · 156 tests green",
      "stats": [
        {
          "value": "2,300 → 0",
          "label": "fuzzed trials against the real engine, zero failures"
        },
        {
          "value": "156",
          "label": "tests green (was 151)"
        },
        {
          "value": "3",
          "label": "new powers for owning your own club"
        },
        {
          "value": "6",
          "label": "new dev cheats to skip the grind"
        }
      ],
      "sections": [
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Five-a-side could freeze solid mid-match",
              "detail": "Reported directly: \"when the other team gets the ball it just like freezes and essentially is stuck, i have to use dev tools to skip to get past.\"",
              "bars": [
                {
                  "label": "Resolve fns with a fallback",
                  "was": 0,
                  "now": 3,
                  "state": "good",
                  "unit": " of 3"
                }
              ],
              "more": {
                "summary": "How it was actually found",
                "points": [
                  "2,000 seeded trials replaying the opponent's attack physics on the real engine — 0 timeouts, 0 throws. Ruled out ball physics.",
                  "300 seeded trials replaying a full simulated match end to end — 300 of 300 clean. Ruled out the match state machine too.",
                  "The real gap: three functions read a screen reference that's sometimes missing, and did nothing when it was — forever, since nothing else was ever going to call them again.",
                  "Fixed by having all three re-ask the match what it's actually waiting for and try again, instead of going silent. Worst case a chance replays from scratch — far better than needing a dev-only skip.",
                  "The exact trigger is a screen-timing thing that can't be reproduced outside a real browser. The fix removes the freeze regardless of what causes it."
                ]
              }
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Dev cheats for testing without the grind",
              "detail": "Captain, reputation, fame, skills, happiness, a club switch — six one-tap shortcuts in Settings, same unguarded spirit as the existing money/skip tools."
            },
            {
              "title": "Real extra power for owning the club you play for",
              "detail": "Asked for directly: \"right now if you own the club you play at you have LESS opportunity, power... you should have MORE.\"",
              "bars": [
                {
                  "label": "Chances your way (Talisman)",
                  "was": 1,
                  "now": 2.2,
                  "state": "good",
                  "unit": "×"
                }
              ],
              "more": {
                "summary": "The three new powers",
                "points": [
                  "Appoint yourself captain outright — skips the normal earn-it route.",
                  "Talisman tactic — everyone plays for you. More chances come your way, fewer for team-mates — one shared roll, not a bolted-on second mechanic.",
                  "Sell yourself to a club of your choice, anywhere in your current division.",
                  "All three need majority ownership of the club you actually play for. A minority stake gets none of this."
                ]
              }
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Not a feature — do this first",
              "detail": "Six security holes anyone with the public key can still reach: writing their own XP/rewards, deleting every user's progression, wiping community votes. Two SQL files, both written, both still unrun.",
              "alert": true
            },
            {
              "title": "Not confirmed live this round either",
              "detail": "Same honest flag as every round on this game. Confidence rests on the fuzzing numbers above, a clean type-check, a green suite and a clean build — not a screenshot.",
              "pill": {
                "text": "unverified",
                "tone": "amber"
              }
            },
            {
              "title": "The ball still \"feels different\" across modes — re-checked, no new cause found",
              "detail": "Reported again this round. The actual drag-to-power mapping is provably identical everywhere it's used — whatever's still reading as different is either framing/feel on a real phone, or somewhere this pass didn't look."
            },
            {
              "title": "5 of 11 dev tool pages have no login check",
              "detail": "Found auditing the dev tooling this round. The other 6 check admin status before loading; these 5 (bicycle, gallery, play, highlights, media-lab) don't. Out of scope for this round — nobody asked for it.",
              "pill": {
                "text": "flagged, not fixed",
                "tone": "amber"
              }
            },
            {
              "title": "Goalie Mode's wall and extra players are still decorative, not physical",
              "detail": "Carried from v0.4 — nothing has touched that code since."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Two rounds shipped between v0.4 and this one with no patch notes of their own",
              "detail": "Trial/training brought in line with the real match engine, then five more consistency gaps fixed (arrow, faces, ball scale, a frozen training keeper) — both real, both shipped, neither got its own version. Say the word and they're written up too."
            },
            {
              "title": "Fix the 5 ungated dev routes",
              "detail": "Flagged this round, not yet scheduled."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.4 — 22 Sep 2026 — the ice-rink pitch bug, other players, penalty and free kick",
              "detail": "Fixed: the pitch was never actually drawing — a hard-coded near edge sat inside the camera's own clip since the first build. Added: other players actually on the pitch (visual only), a penalty from the real spot, a free kick with a real wall at football's own 9.15m minimum. 151 tests green. Still open: the six security holes, above · the wall and extra players are decorative, not physical — carried into this version above."
            },
            {
              "title": "v0.3 — 21 Sep 2026 — the real cursor bug, one fixed camera, real shot variety",
              "detail": "Fixed: the aim reticle wasn't actually where your cursor was — ~0.42m off, every aim. Added: a first-time strike, a real near/far-post split, an on-screen name for every shot. Changed: the camera stopped zooming, one fixed wider shot. 151 tests green. Still open: the six security holes, above."
            },
            {
              "title": "v0.2 — 21 Sep 2026 — Goalie Mode ships, then rebuilt against a real reference video",
              "detail": "Fixed: the keeper's own camera showed a giant head, not a goal; on phone, touching the screen instantly dove. Added: Goalie Mode itself in the Casino, a real stadium behind the goal. Changed: the camera pushed in then pulled back, matching a reference video — later reversed in v0.3 after it didn't survive real play. 151 tests green. Still open: the six security holes, above."
            },
            {
              "title": "v0.1 — 21 Sep 2026 — the chance-formula camera and gallery rebuild",
              "detail": "Fixed: scoring was halved, now isn't; the goal stopped changing size; the camera stopped moving the players; chances now match their own name. Added: Simulate, add/remove players in the editor, up to 60 versions per chance type, a real commit-to-repo. 14→64 chance situations, 0% repeats, 8× less scrolling. Still open: the six security holes, above · star_scenarios.sql may still be unrun."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/YEuw3iut76VY2dZiQVarZd",
      "updatedAt": null
    },
    {
      "version": "0.4",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-22T12:00:00Z",
      "summary": "The Play button was throwing your drawing away · a new Play Area with an Infinite Match that counts what it actually serves you · and you can finally look at scenarios before committing them",
      "stats": [
        {
          "value": "2.4m",
          "label": "the goalie was out by every time you pressed Play"
        },
        {
          "value": "138′",
          "label": "minutes played in one go, where a match used to stop at 90"
        },
        {
          "value": "0 of 11",
          "label": "saved scenarios that are actually in the code"
        },
        {
          "value": "155",
          "label": "test files green"
        }
      ],
      "sections": [
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Play in the scenario gallery was throwing your saved drawing away",
              "detail": "It played the raw generated chance instead. Reported directly: “the play in the scenario gallery moves everything around, and the goalie isn't in the same position that I place him in.”",
              "bars": [
                {
                  "label": "Goalie off line",
                  "was": 2.2,
                  "now": 4.6,
                  "state": "good",
                  "unit": "m"
                },
                {
                  "label": "Ball from goal",
                  "was": 19.2,
                  "now": 11.6,
                  "state": "good",
                  "unit": "m"
                }
              ],
              "more": {
                "summary": "What it was doing, and the answer to “is the game wrong too?”",
                "points": [
                  "Every other part of a card stacks TWO layers: the drawing you saved, then whatever you are dragging right now. The picture does it, the fault rings do it, the formation strip does it. Play was the one thing that only applied the second one — so it quietly ignored the whole scenario you had saved.",
                  "The numbers above are the real card it was reported from: your drawing had the goalie 4.6m off his line and the ball 11.6m out; Play put them on 2.2m and 19.2m. That is the goalie 2.4m out of place and the ball 7.6m too deep, on every single press.",
                  "THE GAME WAS NEVER WRONG. In a real match it picks one of your saved scenarios and uses it. The goalie specifically is rebuilt from two things your drawing holds — how far he shades the near post, and how far off his line he comes — both measured against where the ball is. Drawn exactly as you left him when nothing moves, and he follows the ball when the variant nudges it. So a goalie you draw rushing out still rushes out.",
                  "SO: place him where he should be in the drawing. That is what the game uses."
                ]
              }
            },
            {
              "title": "The desktop picture was too big to see the buttons under it",
              "detail": "Third pass at this size. 340 was too small, 520×800 was “too big”, 400×640 still pushed the buttons off the bottom. It is 325×520 now.",
              "more": {
                "summary": "What fits now",
                "points": [
                  "On a 900-pixel-tall window the whole card is on screen at once — picture, edit row, the Saved/Committed pills, the verdict row, Simulate and Across formations.",
                  "On an 800-pixel window the last strip is still about 80 pixels below the fold. Say the word and it goes smaller again — but any smaller and the picture starts being hard to judge, which is the thing it is for."
                ]
              }
            },
            {
              "title": "A chance nobody had touched was labelled “Draft — this browser only”",
              "detail": "In Infinite Highlights. A chance the generator just rolled is not a draft of anything; it now reads “Straight from the generator”."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "A Play Area — both play tools behind one door, with the dials on top",
              "detail": "Power, technique, curving boots, extra-touch boots, opposition, goalie, position, division and match length. One set, shared by both modes.",
              "more": {
                "summary": "Why the dials are shared rather than one set per screen",
                "points": [
                  "A number set here means the same thing in whichever mode you open next. Two copies would mean turning the power up in the match and wondering why a highlight still felt identical.",
                  "None of these are new mechanics. Every one of them was already a real setting the game runs on — they were just fixed at whatever a dev page happened to have typed into it, and could not be changed without a code change.",
                  "Saved on your own device. Nothing here is part of a career and nothing here reaches the live game."
                ]
              }
            },
            {
              "title": "The Infinite Match — a real match that does not stop, counting what it serves you",
              "detail": "Asked for twice, and the reason was “I've played like 5 games and seen ZERO of these one on ones.” That sentence could not be checked against anything until now.",
              "bars": [
                {
                  "label": "Match minutes",
                  "was": 75,
                  "now": 138,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "What it measured, live, in a real browser",
                "points": [
                  "9 chances over 138 minutes — 5.9 per 90 — across six different kinds: one-on-one 3, header 2, then a free kick, a long range, a midfield pass and a through ball.",
                  "It is the REAL match, not a copy of one. The same match a career plays, against a real career, so anything it shows you is genuinely what the game does.",
                  "It needed two things the game did not have. One: a way to be told which chance was served — there was none, the match decided it internally and never said, which is exactly why “zero one-on-ones in five games” had nothing to check against. Two: a way to stop the manager taking you off, which can happen from minute 60. Measured: a 10,000-minute match was ending around minute 75.",
                  "Both are off unless this tool asks for them, so a real career behaves exactly as it did.",
                  "Infinite Highlights answers a DIFFERENT question, and both are worth having: it shows what the generator can produce, this shows what a match actually hands you. A match picks an area of the pitch first and the chance second, so the two are not the same list."
                ]
              }
            },
            {
              "title": "You can look through scenarios before committing them",
              "detail": "Reported directly: “not being able to see them before committing is annoying.” It was a line of ids, and an id is not a picture.",
              "more": {
                "summary": "How the last check works",
                "points": [
                  "“Look through all 11 first” in Tuning & Commit: one scenario at a time, the real drawing, drawn by the same thing its own card draws with.",
                  "Back and forward through the whole batch, “Open to edit” if one needs a last drag, and “Leave out” to drop one from this commit without deleting it.",
                  "The button then reads “Commit 10 of 11 to the repo”, so what you are about to do is never a guess.",
                  "Looking writes nothing. Leaving one out changes only this batch."
                ]
              }
            },
            {
              "title": "Infinite Highlights got Tune, Delete and the Saved/Committed pills",
              "detail": "The screen you actually flick through chances on was the one screen that could not record a correction from one.",
              "more": {
                "summary": "The three that were missing",
                "points": [
                  "TUNE — drag a player where he should have been and record what was wrong, without saving it as a drawing. Same store, same threshold as everywhere else, so a correction made here counts exactly as much as one made in the gallery.",
                  "DELETE — database AND code, with the “Are you sure?” asked for on the call. It only had Revert before, which clears the database and leaves a committed copy still being served.",
                  "THE PILLS — whether this one is saved, committed, or only in your browser, and whether it is feeding the auto-tuner. You could save a fix here and have no idea which."
                ]
              }
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Every position now pulls chances toward itself",
              "detail": "A striker lives in the box, the ten finds the through ball and the shot from range, the wingers get the byline and the dribble.",
              "bars": [
                {
                  "label": "ST one-on-ones",
                  "was": 13.4,
                  "now": 21.7,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "LW byline cross",
                  "was": 2.2,
                  "now": 9.7,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "ST build-ups",
                  "was": 10.6,
                  "now": 5.8,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "The whole table, and the thing that nearly went unnoticed",
                "points": [
                  "Striker: one-on-one 21.7%, through ball 15.6%, header 10.9%.",
                  "Attacking mid: through ball 19.7%, one-on-one 13.4%, long range 11.6%.",
                  "Wingers: dribble 13.3%, one-on-one 12.1%, byline cross 9.7%.",
                  "Chances per match stay level across all four — 6.1 to 6.6 — so no position is starved of the ball to give another one more.",
                  "One thing only showed up by measuring: adding the pull first made striker build-ups go UP, not down. Fewer involvements meant more time starved of the ball, and the rule that rescues a starved player was dragging him back into his own half to find it. Gating that rule by the same pull fixed it."
                ]
              }
            },
            {
              "title": "Simulate is a small square with a play triangle, and Across formations moved underneath",
              "detail": "Asked for directly. The desktop right-hand column is gone — one centred column now, same order as the phone, so there is one layout rather than two."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "The five-a-side froze mid-game",
              "detail": "Reported on WhatsApp while starting a new save. Not reproduced yet and not on any idea list — this is a live bug, not a polish item, and it needs chasing on its own.",
              "alert": true,
              "pill": {
                "text": "not chased yet",
                "tone": "red"
              }
            },
            {
              "title": "Nothing is actually in the code yet — 11 saved, 0 committed",
              "detail": "Every scenario made so far lives in the database only. They work everywhere and they do tune the generator, but nothing survives the database. The new review screen exists to make that one press.",
              "pill": {
                "text": "one press away",
                "tone": "amber"
              }
            },
            {
              "title": "The Infinite Match showed 1-7 at half time",
              "detail": "With a test driver that missed 36 of its 45 attempts, so it may be nothing. Worth a real look when someone plays it properly — surfacing exactly this is what the tool is for.",
              "pill": {
                "text": "unconfirmed",
                "tone": "amber"
              }
            },
            {
              "title": "Half time still happens at minute 45 in a 10,000-minute match",
              "detail": "The banner and the “Second Half” button fire once and then the match carries on. Cosmetic, left alone."
            },
            {
              "title": "One number was changed in the file Mikey said never to touch",
              "detail": "A striker's long-range weighting, 6 to 3, in the match engine's chance table. It is a single row of data and reversible in one character — flagged rather than done quietly.",
              "pill": {
                "text": "Mikey's call",
                "tone": "amber"
              }
            },
            {
              "title": "Mikey's branch will clash with this one in a single place",
              "detail": "His energy work multiplies the same line the position pull was added to. They compose fine; the two edits just sit on top of each other and will need merging by hand once."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next — the trial, after scenarios",
          "items": [
            {
              "title": "Stop calling it a trial. It is the game, and you are a free agent.",
              "detail": "“If I visited the game and started a save I don't think I would complete the trial.” Agreed on WhatsApp, not started.",
              "more": {
                "summary": "The shape agreed",
                "points": [
                  "Open in a Sunday league match. A short tutorial of a few highlights, PLAYED, not explained.",
                  "A scout spots you. You have a conversation with him. Skip a few days in the menu, then go to the scouting session.",
                  "The session is scenarios — and it should use the live attacks already built for some of them: volleys off a cross, headers, one-twos.",
                  "NO score per drill and no screens in between. One scouting assessment at the end, the way a real trial ends.",
                  "The feel: Alex Hunter. Your guy walks in, talks to the scout, an animation to start, the scout egging you on, in a real non-league stadium.",
                  "“It needs to feel quick and still entertaining while giving you a feel of the real game.” Higgsfield for the cutscenes and animations."
                ]
              }
            },
            {
              "title": "A random crazy injury animation",
              "detail": "Your guy gets clattered in 3D, out for six months, loses stats. From the same conversation."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.3.5 — from the 40-minute call",
              "detail": "Delete made to work on any scenario rather than looking one-on-one-only, the X relabelled “No good”, and everything decided or raised on the call written down: the sprint to something releasable, ownership staying while the son mechanic goes elsewhere, and fourteen parked ideas."
            },
            {
              "title": "v0.3 — the scenario gallery, Save vs Commit, and the auto-tuner",
              "detail": "Commits go to main and batch into one deploy, every card says whether it is saved or committed, Tune records a correction without saving it as a base scenario, and the rule set is read off your own drawings."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/XcQqdgi1WDVUcPBwKf8vbC",
      "updatedAt": null
    },
    {
      "version": "0.3.5",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-22T00:00:00Z",
      "summary": "From the 40-minute call with Leo and Mikey · what got fixed off the back of it, what was decided, and every idea that came up · nothing here is built unless it says it is",
      "stats": [
        {
          "value": "3",
          "label": "things fixed straight off the call"
        },
        {
          "value": "6",
          "label": "decisions made, written down so they stay made"
        },
        {
          "value": "14",
          "label": "ideas parked, none of them started"
        },
        {
          "value": "0",
          "label": "of those ideas built — this is a list, not a changelog"
        }
      ],
      "sections": [
        {
          "kind": "fixed",
          "title": "Fixed off the back of the call",
          "items": [
            {
              "title": "Delete works on any scenario now, not just one-on-ones",
              "detail": "Leo was blocked: “I added one and I can't delete it”, and Delete looked like a one-on-one-only feature.",
              "bars": [
                {
                  "label": "Volley cards",
                  "was": 10,
                  "now": 9,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "Two causes, neither about one-on-ones",
                "points": [
                  "The Delete button only appeared once a scenario had been SAVED. The only saved scenarios were one-on-ones, so it looked kind-specific. It is always there now.",
                  "A generated card had nowhere to be deleted TO — versions come from a count, not a list, so there was no way to say “not this one”. There is now, and it is remembered after a reload.",
                  "On a saved scenario Delete still clears the database and the code. On a card that was never saved it just takes the card out, and says so, instead of reporting a server error for something that never reached a server."
                ]
              }
            },
            {
              "title": "The X is the reject mark, not a delete — it says so now",
              "detail": "Asked twice on the call what it meant: “is that delete, or does that mean something else?” It reads “No good”."
            },
            {
              "title": "The scenario picture on desktop — too small, then too big, now 400×640",
              "detail": "It was hard-coded to phone size on any screen. First pass overshot to 500×800. Phone is unchanged throughout."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Decided on the call",
          "items": [
            {
              "title": "Sprint to something releasable, then tune it",
              "detail": "“This could release today, I'm not even joking” — if the scenarios were done, the trial was done, and the engine worked everywhere.",
              "more": {
                "summary": "What that means in practice",
                "points": [
                  "The three things between here and a release: every chance kind has drawings, the trial works, and the same match engine runs in the trial and in training rather than only in a match.",
                  "Everything else on this page waits behind those three. The reason is that tuning a chance is guesswork until the chances themselves exist — “it's hard to make the scenario stuff good when it's not done”."
                ]
              }
            },
            {
              "title": "A stronger opponent means FEWER chances, not different ones",
              "detail": "Non-league against another non-league side might be ten chances. Against Liverpool it might be two or three. A one-on-one is still one of the things those two can be.",
              "more": {
                "summary": "Where it was left",
                "points": [
                  "Agreed: the opponent's strength changes how many chances you get.",
                  "Open: whether two one-on-ones against Liverpool as a non-league side is wrong. Harry's read is that it does not strictly need to make sense, so long as chances are rarer.",
                  "Also agreed: your position should tilt which chances you get, not decide it. A striker getting only striker chances was called out as wrong — whatever position you play should get you into the game a lot."
                ]
              }
            },
            {
              "title": "Extra modes arrive through the game, never through a settings switch",
              "detail": "The home screen already has casino, sponsors, awards, trophies. Adding ownership and garden to that list was called overwhelming.",
              "more": {
                "summary": "The shape agreed, and the one that was rejected",
                "points": [
                  "Rejected: a Settings toggle that says “turn on funky features”. Called silly, and for a good reason — nobody finds it, so nobody uses it, so why build it.",
                  "Agreed instead: it arrives as an event. Around £1m, an investor approaches you with a chance to buy into some clubs, and ownership unlocks from that moment.",
                  "Mikey's version was a profile tab you scroll down to. Same instinct, and worth keeping in mind — the difference is whether it is discovered or given to you."
                ]
              }
            },
            {
              "title": "Ownership stays. The son mechanic and the agent game go somewhere else.",
              "detail": "Investing and eventually owning a club is wanted. Spawning a son, ageing him up, running an agency is a different game wearing this one's clothes.",
              "more": {
                "summary": "Why the line is drawn there",
                "points": [
                  "The test used on the call: would somebody see this and think “what the hell is this?” Investing survives it. A potion that ages up your son does not.",
                  "The concern is not that the ideas are bad — they were both wanted originally. It is that a game with all of them in reads as a gimmick rather than as a football career.",
                  "Manager after you retire is fine, and is mostly built already. Agent and the chaotic simulation stuff become their own game, using this as the base."
                ]
              }
            },
            {
              "title": "This engine is a base for more than one game",
              "detail": "“We could make the best possible NSS, then the best possible other game.” Anything cut from here is not thrown away, it is the start of the next one."
            },
            {
              "title": "Scenario work is split by chance kind, and everyone saves into the same place",
              "detail": "Pick a kind, make ten to fifteen varied ones, save each as you go, then commit the whole lot at once from Tuning & Commit.",
              "more": {
                "summary": "The bit that was unclear on the call",
                "points": [
                  "Do NOT press commit per scenario. Save them, then commit once — that is the whole reason the Tuning & Commit page exists.",
                  "A kind with no drawings has no rule set, so the first ten for a new kind are what teach it what that chance IS. Range matters more than polish.",
                  "Tune is not the same as Save. Tune records a correction and changes nothing on its own; it waits until several corrections agree before proposing anything."
                ]
              }
            }
          ]
        },
        {
          "kind": "next",
          "title": "Ideas from the call — none of these are started",
          "items": [
            {
              "title": "Chances should come out of the passage of play",
              "detail": "You held it up, played it wide, the cross comes in, you head it. Right now a chance is picked from your position and where the ball is, with no memory of what just happened."
            },
            {
              "title": "Difficulty settings, with a mode you have to earn",
              "detail": "Easy is roughly original NSS — five goals a game from day one. Hard makes training brutal (five drills for +1) and the opposition far stronger. Win the Ballon d'Or on Hard and something harder again unlocks.",
              "more": {
                "summary": "Why this came up",
                "points": [
                  "It answers the split in the room: one of us finds easy scoring boring, and a casual player bounces off a game that is hard from minute one.",
                  "Named as being like FM's challenge modes rather than a difficulty slider."
                ]
              }
            },
            {
              "title": "Keepers that get better as you climb",
              "detail": "From playing real NSS for research: early keepers only go to ground, and a bouncing ball straight at them can go over. Higher up they start reaching top corners.",
              "more": {
                "summary": "What it buys",
                "points": [
                  "Scoring is easy at the start because the keeper is bad, not because the game is generous — and you can feel the difference when you move up.",
                  "Same idea for everything around you: your energy drink does 10% in the bottom division and a lot more once you have a real gym behind you."
                ]
              }
            },
            {
              "title": "Unlocks tied to star rating and to reaching a new league",
              "detail": "New mechanics arrive as you climb, so a promotion changes what the game is, not just the badge next to your name. Compared to Spore and Blue Lock on the call."
            },
            {
              "title": "Achievements paying out coins",
              "detail": "Something to spend progress on beyond the shop."
            },
            {
              "title": "Tap a team-mate to pass, and play carries on",
              "detail": "From the five-a-side build. Tap him, he goes, he can lay it back to you — the move does not cut away the moment you release."
            },
            {
              "title": "A ball that is already moving when it reaches you",
              "detail": "A cross should arrive travelling. Right now the ball you strike is sitting still even when it was just played into you."
            },
            {
              "title": "Take a touch round the keeper",
              "detail": "Rather than only shooting from where the chance starts."
            },
            {
              "title": "Left and right mid should probably be wingers",
              "detail": "Raised as a real doubt about the position list rather than a decision."
            },
            {
              "title": "The goal and the six-yard box might be the wrong size",
              "detail": "Mikey: the goal and six-yard box look too small, and a tight angle does not look like a tight angle. Harry: the pitch is deliberately bigger than life because it is cartoony. Unresolved — worth measuring rather than arguing.",
              "pill": {
                "text": "disagreed",
                "tone": "amber"
              }
            },
            {
              "title": "The tight-angle chance is too easy",
              "detail": "“I could score every time.” The keeper is not on his line where he should be, and a tight angle in real football is a hard chance, not an easy one."
            },
            {
              "title": "Goalie mode needs a reason to be in a player's career",
              "detail": "“What is goalie mode doing in my career as a player?” Liked as a thing to play, questioned as a thing that belongs here.",
              "pill": {
                "text": "question",
                "tone": "amber"
              }
            },
            {
              "title": "The engine should run in the trial and in training too",
              "detail": "Mikey's view is that the opening is the hook and matters as much as anything. Harry's is that scenarios come first. Both agreed it is near the top either way.",
              "pill": {
                "text": "disagreed",
                "tone": "amber"
              }
            },
            {
              "title": "Scale the whole game to the player, because we actually can",
              "detail": "NSS did not scale its world because it could not. Playing Liverpool could mean genuinely worse team-mates around you, not just a higher number on the opposition."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Still open from before the call",
          "items": [
            {
              "title": "The infinite match is not built yet",
              "detail": "The tool for seeing what a real match actually serves you, over thousands of minutes. Looked for on the call and not there."
            },
            {
              "title": "One-on-ones are showing up in game again",
              "detail": "Confirmed live on the call — “finally”. Worth saying plainly that this was confirmed by playing, not by a test."
            },
            {
              "title": "Only one-on-one has drawings",
              "detail": "Tight angle and free kick have one each, which is below the five needed for a rule. Eleven kinds have none and run on the generator's built-in shapes."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.3 — the scenario gallery, Save vs Commit, and the auto-tuner",
              "detail": "Commits go to main and batch into one deploy, every card says whether it is saved or committed, Tune records a correction without saving it as a base scenario, and the rule set is read off your own drawings."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/L4zdK7X44YctKBvHsPTZhB",
      "updatedAt": null
    },
    {
      "version": "0.3",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-22T00:00:00Z",
      "summary": "The scenario gallery and the auto-tuner, explained from the top · three of the boxes below are things you can actually press · 151 test files green, every number measured",
      "stats": [
        {
          "value": "15%→0%",
          "label": "chances that did not match their own name"
        },
        {
          "value": "10→21",
          "label": "scenarios you can actually see"
        },
        {
          "value": "34%→0%",
          "label": "shots blocked by your own team-mate"
        },
        {
          "value": "1",
          "label": "rebuild, however many you commit at once"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Start here — the two buttons everything hangs off",
          "items": [
            {
              "title": "Save puts a scenario in the database. Commit to repo puts it in the game's code.",
              "detail": "Two different places, two different lifespans. This is the thing that was unclear yesterday, so it is first.",
              "demo": "save-vs-commit",
              "more": {
                "summary": "What each one actually does",
                "points": [
                  "SAVE writes the scenario to the database. It is instant, there is no waiting, and the next person to open the gallery sees it. The game starts using it straight away.",
                  "COMMIT TO REPO writes the scenario into the code itself. It takes about two minutes, because the site has to rebuild.",
                  "So why bother committing? Because the database can be wiped, restored, or swapped, and the code cannot. A committed scenario is in the game permanently — it is there on a brand-new machine that has never touched the database, and it is there in the version history if anyone ever needs to see what changed.",
                  "Rule of thumb: Save while you are working. Commit when you are happy and want it to stick."
                ]
              }
            },
            {
              "title": "Yesterday there were three reasons this went wrong",
              "detail": "None of them were about the scenarios themselves.",
              "more": {
                "summary": "The three, and what each one does now",
                "points": [
                  "Commits were going to a branch named after one person, so they reached nobody else until that branch was merged. Leo could commit a scenario and Harry would never see it. They go to the main branch now — one press, everyone has it.",
                  "Every single commit kicked off its own two-minute rebuild. Committing five scenarios meant five rebuilds. They batch now — see below.",
                  "Nothing on screen said whether a scenario was saved, committed, both or neither. Every card carries a badge now — see below."
                ]
              }
            },
            {
              "title": "Every card now says which it is",
              "detail": "Four badges, and you never have to remember which you pressed.",
              "more": {
                "summary": "What each badge means",
                "points": [
                  "DRAFT — only in this browser. Nobody else can see it, and it is gone if you clear your browser data.",
                  "SAVED — in the database. Everyone sees it, the game is using it, but it is not in the code yet.",
                  "COMMITTED — in the code. Permanent.",
                  "MODIFIED — it is committed, but you have changed it since, and the change is not committed yet. This is the one worth watching: it means the version in the code and the version on your screen no longer match."
                ]
              }
            },
            {
              "title": "Everything you have saved but not committed sits in one tab, and one press commits the lot",
              "detail": "Save all morning, commit once. Twenty scenarios is one two-minute rebuild, not twenty.",
              "bars": [
                {
                  "label": "Rebuilds",
                  "was": 20,
                  "now": 1,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "How to use it",
                "points": [
                  "The tab lists every scenario that is saved or drafted but not in the code yet. If it is empty, nothing is waiting.",
                  "Press Commit and the whole list goes in one go, as one change, with one rebuild.",
                  "Work normally, and treat committing as the thing you do at the end, not after every drag."
                ]
              }
            },
            {
              "title": "No-go is gone",
              "detail": "Asked for it to be taken out until it is clearer what it should do, so it is out rather than sat there half-explained.",
              "more": {
                "summary": "What it was, and what to use instead",
                "points": [
                  "The idea was a bin for chances you never want to see again. The problem is there are millions of possible chances, so binning one specific picture stops almost nothing from coming back.",
                  "It was deleted outright, not hidden — the code and its file are gone. Nothing is quietly still running.",
                  "Tune does the job you actually wanted from it: instead of banning one picture, you show what is wrong with it, and the fix applies to every chance like it. That is the section below."
                ]
              }
            },
            {
              "title": "Delete removes a scenario from both places at once",
              "detail": "Out of the database and out of the code, in one press. Before this there was no way to get rid of one at all."
            },
            {
              "title": "Play a scenario without leaving the editor",
              "detail": "Press Play and the chance becomes the real game, in the same panel. Your edit tools and Save button stay on screen, and Next moves you on.",
              "more": {
                "summary": "What changed from yesterday",
                "points": [
                  "Yesterday, playing a highlight took over the screen and there was no way back — you had to leave and start again.",
                  "The commentary at the bottom is gone during editing, as asked. It was describing the match, which is not what you are looking at when you are building a chance.",
                  "This works in the gallery and in Infinite Highlights."
                ]
              }
            }
          ]
        },
        {
          "kind": "added",
          "title": "The auto-tuner, in plain English",
          "items": [
            {
              "title": "You draw chances. It works out the rules you were following. Every chance the game makes then obeys them.",
              "detail": "You never write a rule. Draw more, and the rules update on their own — that is the whole point of it.",
              "demo": "how-tuning-works",
              "more": {
                "summary": "The three steps, in order",
                "points": [
                  "1. You draw. Right now there are 17 hand-drawn one-on-ones.",
                  "2. It reads all of them and asks what is true in every single one. In your one-on-ones: no defender between the ball and the goal, nobody standing nearer the goal than the ball, and no team-mate in the way of your shot.",
                  "3. Every chance the game builds has to pass those. One that does not gets repaired before you ever see it.",
                  "Draw ten more tomorrow and it re-reads all 27 and adjusts. Nothing to update by hand."
                ]
              }
            },
            {
              "title": "A rule is always “none of this”, never “usually about three of these”",
              "detail": "This sounds like a small detail. It is the difference between the tuner working and it quietly ruining everything.",
              "more": {
                "summary": "Why, with the example that nearly happened",
                "points": [
                  "Suppose it noticed that nearly all your drawings have three defenders in them, and made that a rule.",
                  "From then on, a chance with four defenders could never be built. Neither could one with two. You would have accidentally banned most of football by drawing three pictures that happened to look alike.",
                  "“No defender between the ball and the goal” cannot do that. It says what a one-on-one IS. “Three defenders” only says what your drawings happened to look like.",
                  "So it only ever takes a rule from something that appears zero times across your drawings."
                ]
              }
            },
            {
              "title": "Nine drawings out of ten have to agree. Yesterday it needed all ten.",
              "detail": "Needing every drawing to agree meant one slip switched real rules off — and you would not have been told.",
              "bars": [
                {
                  "label": "Rules kept",
                  "was": 1,
                  "now": 3,
                  "state": "good",
                  "unit": " of 3"
                },
                {
                  "label": "Bad chances",
                  "was": 15,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "What was actually happening, measured",
                "points": [
                  "Test: eleven good drawings, plus one with a defender in a place a one-on-one would never have him.",
                  "That one drawing switched off two of the three rules. Not weakened them — off. And then 15 out of every 100 chances the game served did not look like the thing they were called.",
                  "One drawing outvoted eleven, silently. Nothing on screen said a rule had stopped applying.",
                  "Now: a rule holds if nine in ten agree. The odd one out gets named as an outlier on its own card, and the game never uses it as a starting point for a new chance.",
                  "The point is you can draw a duff one and it does not matter. You get told which one it is."
                ]
              }
            },
            {
              "title": "Tune: one correction does nothing. The same correction three times becomes a proposal.",
              "detail": "Drag a player where he should have been and press Tune. It is recorded and nothing else happens. Do the same kind of fix three times and it turns into a suggested change you can approve.",
              "demo": "corrections",
              "more": {
                "summary": "Why it waits for three, and where the proposals show up",
                "points": [
                  "A correction is not a new drawing. It does not join the 17 and it does not start pulling the rules around — a single bad chance you happened to see is not evidence of anything.",
                  "What it records is the SHAPE of what you fixed: not “this defender, this picture” but “a defender was between the ball and the goal, and I moved him out”.",
                  "Do that once and it is one data point. Do it three times on different chances and it is a pattern — the game is repeatedly making the same mistake, and that is worth changing the rules over.",
                  "At three, a proposal appears in the commit tab, in plain words, saying what it thinks the new rule should be. You approve it or you ignore it. It never changes anything on its own.",
                  "A nudge of less than about half a metre is ignored, so tidying up a picture does not count as a correction."
                ]
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Your own team-mates were standing in front of your shot",
              "detail": "On long shots this was happening in a third of them. Fixed for one-on-ones a while back; the other kinds where you are the one shooting never got the same treatment.",
              "bars": [
                {
                  "label": "Long range",
                  "was": 34.4,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Tight angle",
                  "was": 11.2,
                  "now": 1.2,
                  "state": "warn",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why tight angle is not zero, and where this is deliberately left alone",
                "points": [
                  "Tight angle went from about 1 in 9 chances to about 1 in 80. The last few are a real trade, not laziness: from a tight angle the only place left to move that team-mate is offside, and swapping a blocked shot for a wrongly-placed player is not a fix.",
                  "It is not applied to a cutback, a cross or a through ball. Those chances are you passing TO a team-mate, so moving him out of the way would be moving the chance itself.",
                  "It is not applied to a volley or a header either — measured, doing so made the shot MORE likely to be blocked, not less."
                ]
              }
            },
            {
              "title": "Offside was being called on players who were not offside",
              "detail": "Every one of the three offside warnings on your own drawings was wrong. The rule has two halves and only one was being checked.",
              "more": {
                "summary": "The half that was missing",
                "points": [
                  "A player is only offside if he is nearer the goal than the last defender AND nearer the goal than the ball. Being behind the ball means you cannot be offside, whatever the defenders are doing.",
                  "Only the defender half was being tested. So a team-mate standing a few metres BEHIND the ball got flagged.",
                  "On your drawings: three warnings, all three on a man behind the ball. Across everything, 46 of 153 calls were wrong.",
                  "Worse than the warning: the auto-repair believed it, and was physically dragging players who were standing perfectly legally.",
                  "The match itself was never affected — the game always had this right. This was the red text in the editor and the repair acting on it."
                ]
              }
            },
            {
              "title": "The keeper stopped following the ball when a chance was randomised",
              "detail": "A third of the time, moving the ball left him worse positioned than the drawing had him — sometimes at the wrong post entirely.",
              "bars": [
                {
                  "label": "Left worse",
                  "was": 32.8,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "What was happening",
                "points": [
                  "He was copied straight off your drawing and then nudged on his own, with no reference to where the ball had ended up.",
                  "In your drawings he always shades the near post. After a nudge he could end up shading the FAR post — the exact opposite of the one thing all seventeen drawings agree on.",
                  "Now he is worked out from the ball: your drawing's own near-post shade and distance off his line, re-applied to wherever the ball actually is. A keeper you drew rushing out still rushes out. He just looks at the ball now."
                ]
              }
            },
            {
              "title": "The plain generated one-on-one did not obey your own rules",
              "detail": "About one in seven broke a rule taken from your own drawings.",
              "bars": [
                {
                  "label": "Obeyed",
                  "was": 85.6,
                  "now": 100,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Two causes",
                "points": [
                  "The repair that moves a defender out from between ball and goal only fired if he was within 14 metres of the middle. Your drawings have no defender there at ANY width. It also let a man half a metre in front through.",
                  "Nothing was clearing a TEAM-MATE out of your shooting line in a plain build, so 1 in 23 put one there."
                ]
              }
            },
            {
              "title": "Leo could not see the scenarios the game was already using",
              "detail": "The gallery and the game were looking in two different places.",
              "bars": [
                {
                  "label": "Cards shown",
                  "was": 10,
                  "now": 21,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "The mismatch",
                "points": [
                  "The game reads the committed code, which everyone has. The gallery was only reading the database.",
                  "So a committed scenario was driving the game for everybody while showing on nobody's screen. The game was working the whole time — the display was not.",
                  "It reads both now, and every saved scenario gets its own card, including ones saved off a simulation that never had a slot of their own."
                ]
              }
            },
            {
              "title": "Your edits could land on a completely different picture",
              "detail": "Saving one scenario could silently repaint half the others.",
              "bars": [
                {
                  "label": "Repainted",
                  "was": 50,
                  "now": 9,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and why 9% and not 0%",
                "points": [
                  "Each card picked which drawing to build from by its POSITION in the list. Save one scenario, the list reorders, and every card after it is now building from a different drawing than it was a second ago.",
                  "Cards now pick by identity, not position, so adding or saving one leaves the rest alone.",
                  "9% is the floor, not a leftover bug: with 17 drawings and a card having to pick one of them, roughly one in eleven will land on a different drawing purely because the pool it is choosing from has genuinely changed. The first attempt at this fix measured 31%, with one drawing winning 189 times out of 400 — that was a real bug, and it is gone."
                ]
              }
            },
            {
              "title": "The poacher was the one team-mate you could never remove",
              "detail": "Reported as “I cannot remove team-mates”. It was only ever this one figure, and it was the same in every editor.",
              "more": {
                "summary": "Checked properly before fixing",
                "points": [
                  "Measured across all the editors rather than assumed: the supporting runner could be removed, extra defenders could be removed, the poacher could not — his button was greyed out everywhere.",
                  "He is removable now, the same as everybody else."
                ]
              }
            },
            {
              "title": "The site failed to build because of a font",
              "detail": "Nothing to do with any code change. The build happened to run while Google's font service did not answer, and the whole deploy failed.",
              "more": {
                "summary": "Why it cannot happen again",
                "points": [
                  "The site was downloading the Cinzel font from Google every time it built. If that download fails, the build fails, however good the code is.",
                  "My first guess was wrong and I said so rather than pushing a fix on a hunch — the build ran clean locally, which ruled it out.",
                  "The font file now lives in the project. Nothing is fetched at build time, so there is nothing left to fail."
                ]
              }
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Also changed — patch notes themselves",
          "items": [
            {
              "title": "The shareable page is now generated from this file, so the two cannot disagree",
              "detail": "Every version here has an Open-the-artifact link at the bottom. The page behind it is built from the same array this archive reads.",
              "more": {
                "summary": "How it works, and the one thing it cannot do",
                "points": [
                  "npx tsx scripts/patch-notes-artifact.mts 0.3 prints the page. Publish it as an artifact and paste the link into that version's artifactUrl.",
                  "Written by hand, the archive and the artifact drift: one gets a correction, the other keeps the old number, and nobody can tell which is right. There is now one copy of the words.",
                  "It uses Harry's own v0.1 artifact as the visual template, so a generated page looks like the ones already shared.",
                  "What it cannot do is screenshots — there is nowhere in the data to put an image, so a page that needs one gets it added by hand after. That is why v0.1 has no link: its artifact has six screenshots whose files are not in the repo.",
                  "Fixed on the way through: the template's CSS had no rule for an explicit light choice, so a reader on a dark system who picked light still got the dark page. It now has one."
                ]
              }
            },
            {
              "title": "Leo's 0.2, 0.3 and 0.4 are one entry now — all three were Goalie Mode",
              "detail": "Merged into a single v0.2, his wording kept exactly. The full note for him, including which number to use next, is in that entry's Known issues.",
              "more": {
                "summary": "Why they were merged, and the one thing it breaks",
                "points": [
                  "Three separate version numbers for three rounds of the same feature read as three features. One entry with a round-by-round history at the bottom says what actually happened.",
                  "Nothing was dropped: 18 of his 20 items carried over word for word, and the 2 that did not were his own one-line summaries of 0.2 and 0.3, which the new history section replaces.",
                  "What it breaks: this v0.3 is Harry's, and Leo already shipped a v0.3. Any older link or screenshot saying “v0.3” now points at something else."
                ]
              }
            },
            {
              "title": "Patch notes live in the code, not a database table",
              "detail": "The page showed MIGRATION NOT RUN instead of the notes, because nothing had been loaded into the table.",
              "more": {
                "summary": "Why the table was the wrong shape",
                "points": [
                  "Nothing authors a patch note through the web — they are written alongside the work. So the content was already in the repo, and the table was a second copy somebody had to hand-feed.",
                  "As a file it is in git, reviewable in a diff, revertible, and live the moment it deploys. The page now has no request, no loading state and nothing that can fail."
                ]
              }
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues & open decisions",
          "items": [
            {
              "title": "The keeper's near-post shading is still yours to pick",
              "detail": "The generator shades twice as hard as you actually drew — and more is worse, not better.",
              "more": {
                "summary": "The measured trade",
                "points": [
                  "Engine today: 0.46 of the ball's width. Your drawings: 0.23. Over half of wide one-on-ones today have the near post completely dead.",
                  "0.20 (what you drew) is the only value where BOTH corners stay shootable at every ball width. Past ~0.35 the near post stops existing and the chance collapses to one answer.",
                  "The cost of 0.20: he will not LOOK like he is covering his near post. That is the trade, and it is a decision, not a bug."
                ]
              }
            },
            {
              "title": "How often anyone should be offside is undecided",
              "detail": "Zero offside means offside doesn't exist; the engine's own notes record 391/400 one-on-ones ending offside before the repair existed."
            },
            {
              "title": "Three base faults left deliberately unfixed",
              "detail": "long_range 16.1% show an 11m+ hole in the line; tight_angle 7.0% have an empty central channel. Both are \"is this actually wrong?\" design calls."
            },
            {
              "title": "Only one-on-ones have hand-drawn scenarios",
              "detail": "The other 12 kinds still run purely procedurally. The rule set adapts automatically as you draw more."
            },
            {
              "title": "A security migration is still unrun",
              "detail": "security_rls_hardening_jul2026.sql closes six confirmed holes reachable with the public key. Highest-priority non-feature item.",
              "alert": true
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Draw scenarios for a second kind",
              "detail": "Cutback or tight angle — the first real test of whether the scanner reads a situation it has never seen."
            },
            {
              "title": "Formations and playstyles",
              "detail": "Parked deliberately. A formation should MODULATE a drawn shape rather than replace it."
            },
            {
              "title": "Trial plus three full seasons",
              "detail": "Play it through and report everything."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.2 — Leo's Goalie Mode, rounds 1-4 combined",
              "detail": "The keeper-POV minigame, its camera rebuilt against reference footage, the cursor bug, real shot variety, and the pitch actually drawn."
            },
            {
              "title": "v0.1 — the scenario gallery and the chance formula",
              "detail": "14→64 distinct chance situations, 0% same chance twice running, 8× less scrolling."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/PhoNj7N3AvoR8keYRMAkZN",
      "updatedAt": null
    },
    {
      "version": "0.2",
      "title": "Leo's patch notes",
      "publishedAt": "2026-09-22T00:00:00Z",
      "summary": "Goalie Mode · rounds 1-4 combined · a new keeper-POV minigame, its camera rebuilt against real reference footage, a real cursor bug fixed, real shot variety, and the pitch actually drawn - 151 star tests green",
      "stats": [
        {
          "value": "0→real",
          "label": "grass — was silently never drawn at all"
        },
        {
          "value": "9",
          "label": "shot kinds now (was 7)"
        },
        {
          "value": "9.15m",
          "label": "the free-kick wall's real IFAB distance"
        },
        {
          "value": "151",
          "label": "star test files, all green"
        }
      ],
      "sections": [
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "The camera didn't match what \"goalie mode\" should look like",
              "detail": "Three real screen recordings of a reference game were sent, called close to the exact template wanted. The camera was rebuilt from measured reference frames — a tight personal push-in right up to the strike, then a hard cut wide for the save itself."
            },
            {
              "title": "A real mobile bug: a tap instantly committed the dive",
              "detail": "On phone, touching the screen at all locked in the save spot immediately — no way to preview an aim the way a mouse can hover without clicking. Fixed to the same design a mouse already had: touch-down only starts tracking, touch-move live-updates the aim, and release commits."
            },
            {
              "title": "Your aim was never actually under your cursor",
              "detail": "Reported directly, on PC: \"the aim/cursor thing is very offset and not at all on my cursor.\"",
              "more": {
                "summary": "The real cause, worked out by hand",
                "points": [
                  "Reading a screen tap back into a world position is only the exact inverse of the camera's own projection when the camera looks dead level.",
                  "The previous camera was tilted slightly downward for a \"looking down\" feel — which the aim math never accounted for.",
                  "Checked by hand: aiming at a genuine low corner inverted back roughly 0.42m off target — about a fifth of the goal's own playable height, on every single aim.",
                  "Fixed by dropping the tilt to exactly zero, which makes the exact same formula provably exact again — proven with a script: max error over 500 random targets was about 1e-16m, floating-point noise, not an approximation."
                ]
              }
            },
            {
              "title": "The zoom that \"sucked\" — removed, not retuned",
              "detail": "Reported directly: \"the weird zooming in thing sucks.\" Replaced the 3-stage push-in/reveal camera with one fixed, wide shot for the whole sequence — goal, both posts and your full dive reach always on screen, never something that only resolves once a camera move finishes."
            },
            {
              "title": "The pitch is grass again, not an ice rink",
              "detail": "Reported directly: \"i dont even see any green... looks like an ice rink.\" A real bug, not a taste note.",
              "more": {
                "summary": "The actual cause",
                "points": [
                  "The ground quad's near edge was hard-coded to a flat 0.05m in front of the camera, whatever the camera's real distance actually was.",
                  "The projection clips anything nearer than 0.35m — so that edge was ALWAYS inside the clip, every frame, on every device.",
                  "Both near corners of the grass polygon came back null, so the whole fill — stripes, goal line, all of it — silently skipped drawing. Nothing else on screen depended on it, so nothing else looked wrong.",
                  "Fixed by computing the real depth that lands on the canvas's own bottom row, the same formula the game's own ground hit-testing already uses, instead of a guessed offset."
                ]
              }
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Goalie Mode — a new minigame, in the Casino",
              "detail": "You're the keeper, facing a shot. A real timing tension: diving too early sags and costs you reach by the time the ball actually arrives, so reading the tell and committing at or right after the strike is the genuinely best play — not holding your gloves in a corner from the start.",
              "more": {
                "summary": "How the bet works",
                "points": [
                  "A real push-your-luck ladder: cash out any time and bank the current multiplier, or push on into a harder shot for a bigger one.",
                  "One goal conceded busts the run and the stake with it — no partial credit.",
                  "The multiplier climbs steeply (nearly 5x by streak 5) but is bounded, capped at 12x."
                ]
              }
            },
            {
              "title": "A real first-time strike",
              "detail": "A firm, rushed shot off an already-moving ball — its own distinct timing and arc, not a relabelled drive."
            },
            {
              "title": "Real near-post vs far-post variety",
              "detail": "Rolled independently of the tell, so a shot is sometimes tucked in near post and sometimes struck across the body to the far corner. Measured: 56.9% near vs 43.1% far of the eligible drives in a real batch — a genuine split, not one dominating."
            },
            {
              "title": "A real on-screen shot tag",
              "detail": "HEADER FROM A CROSS, VOLLEY, FIRST-TIME STRIKE, CURLING EFFORT, LONG RANGE, NEAR POST, FAR POST — so the variety is something you consciously notice, not just something the physics knows about."
            },
            {
              "title": "Other players are actually on the pitch now",
              "detail": "Reported directly: \"obvs other attackers and defenders should be in there even if they arent involved.\" Ambient goalmouth figures — real positions, a gentle idle sway and shuffle so they read as alive, not a diagram.",
              "pill": {
                "text": "visual only this round",
                "tone": "amber"
              },
              "more": {
                "summary": "What this is, and isn't, yet",
                "points": [
                  "They genuinely make the shot harder to read at a glance — that part is real.",
                  "They do NOT yet touch the ball. Blocking or deflecting off them is a real, named next step, not quietly half-built.",
                  "Skipped for a penalty — the real rule is an empty box, not a missing one.",
                  "Skipped for a free kick — the wall (below) already is the other players in that picture."
                ]
              }
            },
            {
              "title": "Penalty",
              "detail": "Struck from the exact real spot, dead in front of goal. The only thing to read is the disguise — no wall, no angle, nothing else."
            },
            {
              "title": "Free kick",
              "detail": "A real defensive wall, positioned at football's actual minimum distance (9.15m), on the real sightline between the ball and the goal.",
              "more": {
                "summary": "How it plays",
                "points": [
                  "3 to 5 bodies, evenly spaced, standing exactly where a real wall would.",
                  "They jump reactively, right as the ball is struck — never held up early.",
                  "A shot aimed through the wall's own footprint gets bent around its nearest edge or lofted clear over real jump height instead — the two genuine techniques a free-kick taker actually has.",
                  "Doesn't block or deflect the ball yet either — same honest scope as the decorative players above."
                ]
              }
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Leo — your three versions were renumbered into this one, so the next number is free",
              "detail": "0.2, 0.3 and 0.4 were all Goalie Mode, so they are one entry now. Nothing was deleted; every item is still here, word for word.",
              "alert": true,
              "more": {
                "summary": "What this means for your next set of notes",
                "points": [
                  "Your shipped 0.3 and 0.4 no longer exist as their own entries on this page. Their content is in the Fixed/Added lists above, and the round-by-round breakdown is in “What each round did” at the bottom.",
                  "0.3 on this page is now Harry's — the scenario gallery and auto-tuning round. That is the same number your Goalie Mode round 3 used to have, so a link or screenshot pointing at “v0.3” means something different now.",
                  "Your saved artifact HTML in .claude/skills/creating-patch-notes/references/ still has files named v0.2, v0.3 and v0.4. They were left alone — only this page was renumbered.",
                  "The claude.ai artifact you keep republishing is untouched and still one link — https://claude.ai/artifact/YEuw3iut76VY2dZiQVarZd. It covers round 4 only, so this entry links a generated page that matches all four rounds instead.",
                  "Next time you write notes, the number to use on this page is 0.4, not 0.5. Pick it by looking at what is already listed here rather than by adding one to your last artifact.",
                  "There is still no collision guard — version is one shared text field across both tracks, so two people can pick the same number and nothing stops them. Worth a proper fix; say the word and it gets one."
                ]
              }
            },
            {
              "title": "The push-in/reveal camera itself wasn't re-confirmed live after this round's rebuild",
              "detail": "Confidence rested on the measured reference frames and the re-verified projection math, not a fresh recording — and it went on to be reported back as still not right (see v0.3)."
            },
            {
              "title": "Not confirmed with a fresh live look this round",
              "detail": "A real attempt was made and got stuck on an unrelated harness/timing issue in the trial-penalty skip sequence — cut off rather than keep burning time on it. Confidence rested on the cursor fix's exact computed proof and a full clean test suite, said plainly rather than claimed as seen."
            },
            {
              "title": "Not re-confirmed with a fresh live look this round",
              "detail": "Same honest flag as the last two rounds. Confidence here rests on the grass bug's exact root-cause math, deterministic tests for the wall's geometry and the penalty's tighter tell, and a full clean suite + build — not a screenshot.",
              "more": {
                "summary": "What's actually been verified",
                "points": [
                  "The grass fix: the exact same depth formula the game's own ground hit-testing already trusts, not a new guess.",
                  "The penalty's tell: proven exactly 0.6× an ordinary kind's, at the identical difficulty, to floating-point precision — a real test, not an eyeballed claim.",
                  "The wall: always 3-5 bodies, always at the real 9.15m distance, always evenly spaced — checked on every single generated free kick in the test batch, not sampled.",
                  "151 star test files pass on their real exit code, tsc --noEmit is clean, and a full production build succeeds."
                ]
              }
            },
            {
              "title": "The wall and the extra players are decorative, not physical",
              "detail": "Named directly above too — worth repeating here since it's the one thing this round didn't do that it plausibly could look like it does."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Real deflection off a nearby player",
              "detail": "The ask mentioned it directly as a maybe — genuinely interesting, genuinely a separate build from this round's visual pass."
            },
            {
              "title": "The wall and extras actually touching the ball",
              "detail": "Once that's real, a shot through the wall should sometimes just get blocked, not always bend around it."
            }
          ]
        },
        {
          "kind": "history",
          "title": "What each round did",
          "items": [
            {
              "title": "Round 1–2 — Goalie Mode ships, then its camera is rebuilt",
              "detail": "A new keeper-POV minigame in the Casino, then the camera matched against real reference footage. Plus a real mobile bug: a tap instantly committed the dive."
            },
            {
              "title": "Round 3 — the cursor bug, the zoom, and real shot variety",
              "detail": "Aim was never under your cursor (~0.42m off, every aim). The zoom removed rather than retuned. Near-post vs far-post variety and a real first-time strike."
            },
            {
              "title": "Round 4 — real grass, real bodies, two new shot types",
              "detail": "The pitch was silently never drawn. Other players actually on the pitch. Penalty and free kick added, with the wall at its real 9.15m IFAB distance."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/HD5yGHLCNQxHHwGAnrXS7o",
      "updatedAt": null
    },
    {
      "version": "0.1",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-21T00:00:00Z",
      "summary": "Star Career · branch Harry · 8 commits · 147 tests green · every number measured, not guessed",
      "stats": [
        {
          "value": "14→64",
          "label": "different chance situations"
        },
        {
          "value": "0%",
          "label": "same chance twice running"
        },
        {
          "value": "8×",
          "label": "less scrolling in the gallery"
        },
        {
          "value": "−15pp",
          "label": "empty grass on screen"
        }
      ],
      "sections": [
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Scoring was halved. Now it isn't.",
              "detail": "Four separate bugs, each found by measuring.",
              "bars": [
                {
                  "label": "Cutback",
                  "was": 9.8,
                  "now": 41.3,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "One-on-one",
                  "was": 9.8,
                  "now": 47.6,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Tight angle",
                  "was": 13.3,
                  "now": 39.7,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Header",
                  "was": 6.6,
                  "now": 26.8,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Through ball",
                  "was": 11.2,
                  "now": 18.7,
                  "state": "warn",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "What the four bugs were",
                "points": [
                  "The keeper was never beaten. A one-on-one is a chance about the keeper, and his tuned positioning had been overwritten. 9.8% conversion with 0% blocked — nothing in the way, he just always saved it.",
                  "Cutbacks came from the touchline — 20.2m off centre, where the real game puts them at 11.5m.",
                  "The \"is he blocking?\" test was blind. Of 300 cutbacks it found 0 blockers. 223 had a man within 1.5m of the ball's real path.",
                  "Two rules cancelled each other — one filled the middle, one cleared the shooting lane, in the wrong order.",
                  "One-on-one is above its old number on purpose: the old one had a defender in the way 99.8% of the time, so it was never really a one-on-one."
                ]
              }
            },
            {
              "title": "The goal stopped changing size",
              "detail": "One zoom band, goal in the same spot every chance. 69% of chances used to be framed wrong.",
              "more": {
                "summary": "Three causes",
                "points": [
                  "The builder had a free zoom slider with a 5× range.",
                  "The generator used three different heights — 69.2% weren't the standard one.",
                  "The frame secretly grew to keep the keeper in shot — another 10%.",
                  "Zooming out doesn't help: a long shot framed wider is emptier, 75% grass vs 60.9%."
                ]
              }
            },
            {
              "title": "The camera stopped moving the players",
              "detail": "It was physically dragging defenders into frame, so zooming in squashed the defence and changed the football.",
              "more": {
                "summary": "What it was breaking",
                "points": [
                  "Passes found a man 97 times in 220.",
                  "A defender a test deliberately planted in the shooting path was being moved by the camera instead.",
                  "Both normal again, nothing re-tuned. Now: ball, you, keeper and every runner in frame 100%. Only defenders drift off — 1.44 per chance. Corners and crosses exempt, because you're delivering into that box.",
                  "To revert: CAMERA_MOVES_PLAYERS = true and VIEW_MIN_H = 42 at the top of canvasEngine.ts. Tests pass either way."
                ]
              }
            },
            {
              "title": "Chances now match their own name",
              "detail": "One-on-ones broken 99.7% → 0%. Corners 19.7% → 0%. Byline crosses 8.7% → 0%."
            },
            {
              "title": "Defenders stopped hiding near their own keeper on long shots",
              "detail": "The back line now holds the edge of the box. Was 10.4–13.6m out, now 13.8–16.1m."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Simulate",
              "detail": "Press it, get one chance exactly as the match would give it you. 1,300 presses: 1,221 different pictures, 0 repeats in a row, 0 faults.",
              "more": {
                "summary": "The one honest exception",
                "points": [
                  "Penalties: 23 different pictures in 100. It's the ball on the spot, you behind it, keeper on his line — there's almost nothing to vary, and faking variety there would be inventing it."
                ]
              }
            },
            {
              "title": "Add and remove players in the editor",
              "detail": "Tap a figure → + Team-mate, + Opponent, Remove. Real, not cosmetic — adding an opponent to a one-on-one moves the offside line and flips the fault to \"not a one-on-one\"."
            },
            {
              "title": "More than 10 versions per chance type",
              "detail": "Up to 60, and it remembers."
            },
            {
              "title": "Admin panel on every page",
              "detail": "25 admin and dev pages, one tab, works on the immersive screens where the normal nav is hidden. Invisible to everyone else. Desktop only."
            },
            {
              "title": "Saving a scenario into the code works for real",
              "detail": "Mikey's first genuine commit through that button landed this run. It had only ever been tested against a fake."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Gallery rebuilt",
              "detail": "12,921px → 1,596px of scrolling. Front page is one screen, not fifteen. All the explaining is gone — a problem is a red ring on the thing that's wrong."
            },
            {
              "title": "Across formations hidden behind a toggle",
              "detail": "It owned 60% of the screen for something that doesn't work yet. Not deleted — one tap brings it back."
            },
            {
              "title": "Chance mix retuned",
              "detail": "Half done. Below."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Not a feature — do this first",
              "detail": "Six security holes anyone with the public key can reach: writing their own XP and rewards, deleting every user's progression, wiping community votes. Two SQL files, both written, both unrun.",
              "alert": true
            },
            {
              "title": "Too much build-up, too many long shots",
              "detail": "What a striker actually gets:",
              "pill": {
                "text": "half fixed",
                "tone": "amber"
              },
              "bars": [
                {
                  "label": "Long range",
                  "was": 13.1,
                  "now": 10.6,
                  "state": "warn",
                  "unit": "%"
                },
                {
                  "label": "Through ball",
                  "was": 13,
                  "now": 12.6,
                  "state": "bad",
                  "unit": "%"
                },
                {
                  "label": "Build-up",
                  "was": 9.5,
                  "now": 9.5,
                  "state": "bad",
                  "unit": "%"
                },
                {
                  "label": "One-on-one",
                  "was": 11.9,
                  "now": 14.3,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Headers",
                  "was": 9.7,
                  "now": 8.9,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Where it still misses",
                "points": [
                  "Build-up: untouched. With midfield passes and dribbles it's 23% of what you see, and none of it has a goal in the picture.",
                  "Through balls got worse and didn't respond to the weighting — something else is driving them.",
                  "Top-3 share 37.5%, target under 32%, and worse than the 28.2% it started at.",
                  "Byline crosses 1.7% vs 5% target — possibly not a bug. A striker receives crosses; a left winger measures 9.2%."
                ]
              }
            },
            {
              "title": "A rebound scored by someone else counts as your goal",
              "detail": "Reported, not yet investigated."
            },
            {
              "title": "Your own teammates block your shot",
              "detail": "There's a rule keeping opponents out of the shooting lane. There's none for your own side."
            },
            {
              "title": "\"The goal wasn't on screen\" — not the camera",
              "detail": "Goal on screen 100% of the time on all 11 shooting types. It's 0% on build-up and midfield passes, by design. Same bug as too much build-up."
            },
            {
              "title": "Three pictures need a human call",
              "more": {
                "summary": "See them",
                "points": [
                  "Long range: 14.5% have an 11m+ hole in the line. Wrong, or what a distance shot looks like?",
                  "Tight angle: 6.3% have nobody in the middle.",
                  "Byline cross: always 9.7m from centre. A real one comes from 16–20m.",
                  "Not auto-fixed on purpose — a wrong repair rule is worse than none. We proved that when a bad rule flagged 32.2% of pictures as broken and the real figure was 0.64%."
                ]
              }
            },
            {
              "title": "Small stuff",
              "more": {
                "summary": "Four things",
                "points": [
                  "star_scenarios.sql may still be unrun — saving to the database couldn't be tested end to end.",
                  "The production build needs NODE_OPTIONS=--max-old-space-size=4096 or it dies looking like broken code. Cost an hour.",
                  "None of the camera work has been seen in a live match — only through the gallery's renderer.",
                  "5 chances in 6,612 still build with an attacker offside (0.076%). Flagged, not hidden."
                ]
              }
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next — live scenarios",
          "items": [
            {
              "title": "Movement arrows",
              "detail": "Drag a line from your player, a teammate or an opponent to set what happens when the chance starts."
            },
            {
              "title": "When you release the ball",
              "detail": "A real fork — pick one deliberately.",
              "more": {
                "summary": "The two options",
                "points": [
                  "Manual: drag your run, choose the moment to play it. More control, more skill, more to learn.",
                  "Auto-dribble: your player carries it in a direction, you only pick the shot or pass. Simpler, closer to now."
                ]
              }
            },
            {
              "title": "Keeper rushes out",
              "detail": "On a one-on-one. Already exists in the engine — this makes it visible and something you can time a chip against."
            },
            {
              "title": "Opposition quality drives all of it",
              "detail": "How fast they close, how likely they block, how early the keeper commits. This is where formations finally matter — which is why that toggle is hidden, not deleted."
            },
            {
              "title": "Play button on everything",
              "detail": "Play a live scenario out, and play any gallery scenario on demand."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next — everything else",
          "items": [
            {
              "title": "Rule sets per chance type",
              "detail": "You build the perfect bases, the rules get read off them, the game generates inside those rules.",
              "pill": {
                "text": "blocked on Harry",
                "tone": "amber"
              },
              "more": {
                "summary": "Why it's the key to formations",
                "points": [
                  "A draft read off the current one-on-ones already found something: only 96.2% have the ball ahead of every defender. Should be 100% — that's the definition.",
                  "\"Ball 8–16m out\" is a fixed box and breaks when a formation moves the defence. \"Ball ahead of every defender\" stays true wherever they stand.",
                  "That's why a 3-5-2 must not put three defenders in front of a one-on-one: the chance's own rules outrank the formation."
                ]
              }
            },
            {
              "title": "Talk to Claude from inside a scenario",
              "detail": "A comment box on the exact picture that reaches me as a real instruction.",
              "more": {
                "summary": "Why this one matters",
                "points": [
                  "An automatic checker only catches rules somebody already wrote down. Every real bug on this project so far has been a rule nobody had written yet.",
                  "A box where you type \"the defender shouldn't be there\" on the picture is how that gap closes."
                ]
              }
            },
            {
              "title": "Dribbling and heading scenarios in the gallery"
            },
            {
              "title": "Matchup simulation",
              "detail": "Pick two teams, see what chances that fixture produces."
            },
            {
              "title": "Formation and playstyle toggles",
              "detail": "Last — depends on the rule sets."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.1 is the first — nothing before this",
              "detail": "From v0.2 onwards every older version sits in this archive as its own entry, newest first.",
              "more": {
                "summary": "How history works here",
                "points": [
                  "Each older version holds that version's Fixed / Added / Changed headlines, its top-line numbers, and which of its known issues are still open — that last part being the reason anyone goes back.",
                  "Anything still broken stays up in Known Issues above, not down here; history is for what changed, not what is outstanding."
                ]
              }
            }
          ]
        }
      ],
      "artifactUrl": null,
      "updatedAt": null
    }
  ];
