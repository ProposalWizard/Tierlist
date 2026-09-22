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
