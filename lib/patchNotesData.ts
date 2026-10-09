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
      "version": "0.43",
      "title": "Mikey's patch notes",
      "publishedAt": "2026-10-09T15:00:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/843j4zo8tXx2CKCzYceAFh",
      "summary": "Real Premier League 2015/16 shots (StatsBomb's free data) now play in our engine as test chances, and they show our close chances are too easy (a game-made one-on-one scores 68%, a real one 20%). A new Chance mix (testing) switch (Settings → More → Match, or the Preview version) builds a match from Harry Kane's real touches: about 9 highlights instead of 6, half of them deeper, half as many one-on-ones. Old stays the default. Mikey's notes call this v0.14.",
      "stats": [
        {
          "value": "7,807",
          "label": "real Premier League shots playable as test chances"
        },
        {
          "value": "6.1 → 9.0",
          "label": "highlights a match for a striker on Chances: New"
        },
        {
          "value": "68% vs 20%",
          "label": "a game-made one-on-one against a real one, same shooter"
        },
        {
          "value": "Old",
          "label": "stays the default; New is opt-in"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Chance mix (testing): New gives about 9 highlights a match",
              "detail": "Settings → More → Match → Chance mix (testing) → New (or the Preview version), then play a match"
            },
            {
              "title": "\"You drop off into midfield and get on the ball\" highlights",
              "detail": "In a match with Chances on New"
            },
            {
              "title": "Real moments page",
              "detail": "Admin → Real moments → Load moments file"
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Chance mix (testing): built from Kane's real touches",
              "detail": "Highlights 6.1 → 9.0 a match, deep touches 2.0 → 3.8, one-on-ones 0.67 → 0.49, own shots 2.1 → 2.5 (Kane: 2.5). Measured over 600 matches. Old is the default."
            },
            {
              "title": "Real moments page (admin, testing only)",
              "detail": "Real shots in the game's camera, playable, next to a game-made chance of the same kind. Data loaded from a file on your device."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Our close chances are easier than real ones",
              "detail": "Keeper 1.1 m off his line against 4.5 m for real. Kept out on purpose for now."
            },
            {
              "title": "Goals a match on New are estimated, not played",
              "detail": "About 0.92 → 0.99 of your own goals a match."
            }
          ]
        }
      ]
    },
    {
      "version": "0.42",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-08T21:00:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/GWaupeUSruCjKW2qYtnHWW",
      "summary": "The 3D world grew a casino and a training pitch (not seen on a phone), with five 3D training drills (picker, Two Touch, Free Roam, Headers & Volleys, Wembley), a 3D Crossbar challenge and a hand-made 3D kick. Settings rebuilt from 4,025 px to 931 px with a Classic / Standard / Preview version picker. Cheat locks on Draft records, legend shares, XP and the Hall of Fame. The server casino stays off; the horse-odds fix stays. Harry's notes called this v0.35; the site number 0.42 is the next free one.",
      "stats": [
        {
          "value": "2 new 3D places",
          "label": "a casino with 6 games and a training pitch, in the garden"
        },
        {
          "value": "4,025 → 931 px",
          "label": "Settings height in a career (5 screens → 1)"
        },
        {
          "value": "47% → 0%",
          "label": "of horse race cards with a horse that paid back more than you staked"
        },
        {
          "value": "20 → 1 tap",
          "label": "look switches set at once by the version picker"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "For Mikey, in order",
          "items": [
            {
              "title": "1. Run star_hall_of_fame.sql",
              "detail": "Now with a 30-career cap. Safe to re-run; verify queries at the bottom."
            },
            {
              "title": "2. Run star_legend_shares.sql",
              "detail": "Copies from the Hall, 30 shares at most. Safe to re-run."
            },
            {
              "title": "3. Run xp_atomic_award.sql (optional)",
              "detail": "Each XP reward pays once. Safe to re-run."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Training Pitch opens the drill picker; each drill plays",
              "detail": "Garden → TRAINING gate → Training Pitch"
            },
            {
              "title": "Wembley ends with one player left; the hint line fits",
              "detail": "Training Pitch → Wembley → Start"
            },
            {
              "title": "Casino in the 3D garden",
              "detail": "Garden → casino doors → each station"
            },
            {
              "title": "Close a casino game, then take the doors back",
              "detail": "Casino room"
            },
            {
              "title": "Home → Casino goes to the 3D room",
              "detail": "Home → Casino"
            },
            {
              "title": "Training pitch and gate",
              "detail": "Garden → back left → TRAINING gate"
            },
            {
              "title": "Crossbar challenge: 5 rounds to the result",
              "detail": "Training gate → Crossbar challenge"
            },
            {
              "title": "3D kick, celebrate, keepy-ups; ball bounces into the net",
              "detail": "Any 3D shot"
            },
            {
              "title": "Settings: version picker, each group, Classic then Standard",
              "detail": "Settings"
            },
            {
              "title": "Casino: 3D | Classic",
              "detail": "Settings → 3D world → Casino"
            },
            {
              "title": "A Draft season posts its records",
              "detail": "Play a Draft season to the end"
            },
            {
              "title": "New horse odds",
              "detail": "Casino → Horse racing"
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "3D training drills: a picker with five drills",
              "detail": "Training gate → Training Pitch opens a picker: Random drill, Crossbar Challenge (unchanged), Two Touch, Free Roam, Headers & Volleys, Wembley (Normal / Doubles). One shared 3D engine (movement, touches, passes, juggling, headers, volleys, tackles, keeper); shots use the 2D match's drag-and-aim maths, measured 0.0% difference in kick speed, lift and spin. Two Touch: best of 3 rallies, 6+ passes wins; a mate rated 85 averages 5.4 passes a rally, rated 55 averages 2.1. Free Roam: 2 minutes, score = goals + clean passes, 10+ wins. Headers & Volleys: your full-backs cross 10 balls; header 2, volley 3, other goal 1; 7 wins; an average player scores 3.6 per 10 vs a 60 keeper, 2.5 vs an 80. Wembley (Harry's rules): last player without a goal each round is out; a 4-player game takes about 4.0 minutes (was about 10), 0 of 200 test games stalled. New hand-made moves for headers, volleys, control, tackles and the keeper; the 3D shop and garden download about 150 KB more. Only stills seen: nothing watched in motion or on a phone."
            },
            {
              "title": "A 3D casino in the garden",
              "detail": "Back right, neon front, red carpet. Roulette, blackjack, 4 slots, horse screen, betting counter, Goalie Mode cabinet. Walk up to open each game; close it and you are back in the room. Settings → Look → Casino: 3D | Classic (default 3D)."
            },
            {
              "title": "A training pitch in the garden",
              "detail": "Back left: fence, floodlights, TRAINING gate."
            },
            {
              "title": "3D Crossbar challenge",
              "detail": "You against one real team-mate, 5 shots each. Crossbar 1, post 0, a draw counts as a win. Reward: the Team bar. Costs training energy. Your shots use the real match engine; his are an animation (about 1 in 10 at rating 60, 1 in 5 at 85)."
            },
            {
              "title": "3D kick and animations",
              "detail": "Hand-made: 3-step run-up and strike, left-foot mirror, fist-pump, hands on head, keepy-ups. The ball no longer freezes after the shot. Casino and training clips are made; wiring them onto people is coming in the next push."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Settings rebuilt: 4,025 px → 931 px",
              "detail": "Version picker Classic · Standard · Preview sets all 20 look switches. Groups: Match (13), 3D world (6), Screens (6), Career & saves. Developer tab for testers and admins. Only Chances and Animations differ between Standard and Preview."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Cheat locks on four places",
              "detail": "Draft records board (possible numbers only, matched to your saved season, real names); legend shares copy from your own Hall (30 max); XP pays each thing once; Hall of Fame 30 careers max."
            },
            {
              "title": "Horse odds",
              "detail": "47% of race cards had a horse that paid back more than you staked (up to ★9.57 per ★1). The best is now ★0.99 per ★1."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Decision: the casino stays on the phone",
          "items": [
            {
              "title": "Server casino switched off",
              "detail": "Harry decided against it for now: lag, and the free database is too small (60 days of plays is about 150 MB at 100 daily players). CASINO_ON_SERVER = false; code kept for later."
            },
            {
              "title": "Progress updates now include expected token use"
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "3D drills only seen as stills",
              "detail": "Keepy-up headers and foot keepy-ups still borrow other moves; no keeper move for a low-ball catch; your own shot from your feet has no wind-up."
            },
            {
              "title": "None of the 3D was seen on a phone"
            },
            {
              "title": "Chandeliers read as white blobs"
            },
            {
              "title": "Inside a casino game the back button says Menu"
            },
            {
              "title": "The Old 3D garden has no casino or pitch"
            },
            {
              "title": "Classic also flips UI to Old"
            },
            {
              "title": "Settings Developer tab only shows inside a career"
            },
            {
              "title": "Animations: weak fist pump from behind, a mechanical kick, a slight foot slide"
            },
            {
              "title": "Tour waits on Harry's video; Ballon d'Or difficulty is for later"
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Wire the casino and training clips onto people",
              "detail": "And keep you in frame for reactions."
            },
            {
              "title": "Mikey runs the three SQL files"
            },
            {
              "title": "Harry checks the 3D on his phone"
            }
          ]
        }
      ]
    },
    {
      "version": "0.41",
      "title": "Mikey's patch notes — Brackets, the real UEFA knockout, relegation",
      "publishedAt": "2026-10-08T22:00:00Z",
      "updatedAt": "2026-10-08T22:00:00Z",
      "artifactUrl": "https://claude.ai/artifact/D2mVBLe6QDF2jqzHnrjiWt",
      "summary": "Before each play-off match, and after every FA Cup, League Cup and European knockout tie, a round-up shows the results and, from the last 16, an animated \"Road to the Final\" bracket. The Champions and Europa League now use the real UEFA knockout bracket with every tie played. League Cup semi-finals are two legs. Going down with your club cuts your wage and bonuses by 25%; going up raises your wage by 25%. Relegation day gets a news flash and sad fan posts.",
      "stats": [
        { "value": "4", "label": "knockout competitions with a results board and a bracket" },
        { "value": "36 → 24", "label": "the real UEFA knockout after the league phase" },
        { "value": "2 legs", "label": "League Cup semi-finals" },
        { "value": "−25% / +25%", "label": "your wage down / up with your club" }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            { "title": "Play-off round-up before each play-off match", "detail": "Finish in the play-off places in any division below the Premier League." },
            { "title": "Cup results board and bracket", "detail": "After every FA Cup and League Cup tie; the bracket from the last 16." },
            { "title": "Champions/Europa League table split and bracket", "detail": "After the 8th league-phase match, and after each knockout tie." },
            { "title": "League Cup semi-final over two legs", "detail": "League Cup semi-final." },
            { "title": "Wage −25% down with your club, +25% up", "detail": "Contract screen, first week of the new season." },
            { "title": "Relegation day", "detail": "The last league match, finishing in the drop." },
            { "title": "Offers after dropping out of North/South follow your season", "detail": "Finish 21st–24th in North or South." }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            { "title": "Europe's knockout used random opponents", "detail": "Now the real UEFA bracket: 1st–8th to the last 16, 9th–24th play off, fixed path after. Every tie is played and the real winner crowned. Tested." },
            { "title": "An offer after dropping out of North/South could come from the club going up", "detail": "The champion and the play-off winner no longer offer. Measured." },
            { "title": "The feed said \"relegated\" for the bottom three everywhere", "detail": "Now each division's real number of places." }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            { "title": "Play-off, cup and European round-ups", "detail": "Results board, then the animated bracket: scores pop, losers fade, winners' lines grow and crests slide into the next tie. Seen on a test page at phone size." },
            { "title": "Relegation day", "detail": "News flash, five sad fan posts and a club statement. Tested, not seen on screen." }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            { "title": "League Cup semi-finals are two legs", "detail": "Aggregate; level goes straight to penalties." },
            { "title": "Wage when your club goes down or up", "detail": "Down: wage and bonuses −25%. Up: wage +25%. Not when you changed club that summer." },
            { "title": "Forced-move offers follow your season", "detail": "No goals: the weakest clubs. A great season: the strongest, and National League clubs from reputation 70." }
          ]
        }
      ]
    },
    {
      "version": "0.40",
      "title": "Mikey's patch notes — Ovation greetings made in Blender",
      "publishedAt": "2026-10-08T14:00:00Z",
      "updatedAt": "2026-10-08T14:00:00Z",
      "artifactUrl": "https://claude.ai/artifact/6tgaVydhSjEeQea6tkA3oX",
      "summary": "The standing ovation's hug, dap-up, pat and claps are now real animations made in Blender, with both players posed together so each hand lands on the other player's body. The 3D ovation was checked in a real farewell: it starts at 85' and plays to the end. Settings → Look → Ovation greetings: New | Old.",
      "stats": [
        { "value": "8", "label": "moves made in Blender" },
        { "value": "45 mm", "label": "median gap, hugging hand to his back" },
        { "value": "49 KB", "label": "the moves file" },
        { "value": "85'", "label": "3D ovation starts on time in a real farewell" }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            { "title": "The 3D standing ovation at 85' in a farewell", "detail": "Close the game fully and open it again first, so the phone loads the new version." },
            { "title": "The hug, dap-up, pat and claps", "detail": "Farewell at 85', or /star-retirement-dev → Standing ovation · 3D." },
            { "title": "Ovation greetings New | Old", "detail": "Settings → Look → Ovation greetings." }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            { "title": "\"The standing ovation didn't do anything\"", "detail": "No fault found: a real farewell showed the 3D scene at 85' for 23 s. Most likely the phone still had the page from before the update. Seen." }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            { "title": "Greetings made in Blender", "detail": "Hug, dap-up, pat (answered with a hand on the heart) and two claps, made with both players posed together. Seen in the 3D scene." }
          ]
        }
      ]
    },
    {
      "version": "0.39",
      "title": "Leo's patch notes — smart passing and highlights",
      "publishedAt": "2026-10-08T18:00:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/M9DmuMCkXzeMW9EJ6mJFtZ",
      "summary": "Good passers lay it off to your runner before he goes offside: a quicker touch, a pass into his run, lifted over a man in the lane, or a shot if only an offside pass is left. Through-balls reach a man on a run. Every match gets a HIGHLIGHTS video of all its goals, plus a video of your goals, made before other matches' videos. Dev tools to move to any English club and add any real player.",
      "stats": [
        {
          "value": "14% → 4%",
          "label": "offside lay-offs by a top passer"
        },
        {
          "value": "14% → 48%",
          "label": "through-balls to his feet that reach him"
        },
        {
          "value": "Every match",
          "label": "gets a HIGHLIGHTS video"
        },
        {
          "value": "273/273",
          "label": "tests pass"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Smart lay-offs",
              "detail": "In a match: send a team-mate on a run, tell another to lay it off to him, pass to the second man."
            },
            {
              "title": "Through-balls reach the runner",
              "detail": "In a match: send a man past the defence, then pass into the space ahead of him."
            },
            {
              "title": "HIGHLIGHTS after every match",
              "detail": "After a match with a goal → Post Match Reactions → 'HIGHLIGHTS | …'."
            },
            {
              "title": "A video of your goals",
              "detail": "Score or assist → your club's '<name> v <opponent>' post."
            },
            {
              "title": "Your videos made first",
              "detail": "Open the feed: highlights and your goals are ready first."
            },
            {
              "title": "Dev: any club, any player",
              "detail": "Settings → Dev — Career / Dev — Squad (testers only)."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed — the match engine",
          "items": [
            {
              "title": "Good passers keep your runner onside",
              "detail": "Problem: a top passer took a slow touch and played your runner offside. Why: every team-mate took the same long touch and aimed at where the runner was. Fix: a quicker touch the better he passes, released before the runner crosses the line, led into the run, lifted over a man in the lane; he shoots if only an offside pass is left. Top passer (88), 158 lay-offs: offside 14% → 4%, goals 34% → 39%. A weak passer plays as before."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Through-balls never really worked",
              "detail": "Problem: a man on a run ran back to the ball. Why: a run that finished while you aimed dropped the order, and a man on his run ignored a ball ahead of him. Fix: he holds the end of his run and meets the ball where it is going. Ball to his feet: he gets it 14% → 48%; 9 m ahead 24% → 57%."
            },
            {
              "title": "A lay-off assist could go to nobody",
              "detail": "Found while testing; credited to the man who played it now."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "HIGHLIGHTS video after every match",
              "detail": "Every goal of the match, both sides; goals nobody recorded are made up."
            },
            {
              "title": "A video of your goals",
              "detail": "From your club, whenever you score or assist."
            },
            {
              "title": "Your videos made first",
              "detail": "Highlights and your goals, then your match's posts, then other matches."
            },
            {
              "title": "Dev tools",
              "detail": "Move to any club in the seven English leagues; add/remove any real player; pin men to start. Testers only."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "A smart lay-off not seen on screen",
              "detail": "Measured in 158 simulated chances only."
            },
            {
              "title": "Your-goals post and 'highlights first' not seen",
              "detail": "Fixed after the playtest; tests only."
            },
            {
              "title": "Not seen on an iPhone",
              "detail": "Goal videos checked in a test browser only."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "0.38 — goal videos, round 3",
              "detail": "Commentary box (78 lines), videos made in the background, right-size players, new cameras and edits, other clubs' goals on video."
            }
          ]
        }
      ]
    },
    {
      "version": "0.38",
      "title": "Leo's patch notes — goal videos, round 3",
      "publishedAt": "2026-10-08T09:00:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/EGUKS4qyVUU6KoA1qkJAKn",
      "summary": "Goal videos now make themselves in the background and play as you scroll to them, with sound; Save video is the only wait. A new two-man commentary (a lead who calls the goal to fit how it went in, and a co-commentator over the replay), 78 new lines in a new voice, replacing the old 'look at the finish'. Players stand at the right size and the keeper stands in front of his net. Each account cuts its goals its own way, with a new TikTok edit, three new cameras and three new video accounts. Goals in other clubs' matches get their own videos too.",
      "stats": [
        {
          "value": "78",
          "label": "commentary lines (was 9)"
        },
        {
          "value": "0 taps",
          "label": "to play a goal video"
        },
        {
          "value": "17 → 29",
          "label": "goal videos in 30 test matches"
        },
        {
          "value": "270/270",
          "label": "tests pass"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Goal videos play by themselves",
              "detail": "Score → Post Match Reactions → scroll down; each video starts as it comes on screen."
            },
            {
              "title": "The new commentary",
              "detail": "Any goal video with sound: a call as it goes in, a second voice over the replay."
            },
            {
              "title": "Player and keeper sizes",
              "detail": "Any goal video: the keeper stands in front of the net, not in it."
            },
            {
              "title": "TikTok edit",
              "detail": "A @pitchside.edits or @footyloops post: tall, slowed down, big captions."
            },
            {
              "title": "Other clubs' goals",
              "detail": "Phone → England tab after a match week."
            },
            {
              "title": "Speaker and timer under the video",
              "detail": "Below each goal video, next to Save video."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Goal videos took a long time to start",
              "detail": "Problem: you tapped play and waited. Why: the video was only made when you tapped. Fix: it is made in the background as the post nears the screen, one at a time, and plays when on screen."
            },
            {
              "title": "The commentator sounded creepy and said the same thing",
              "detail": "Problem: one flat voice, 9 lines. Fix: a new voice, two commentators, 78 lines picked to fit the finish and the score."
            },
            {
              "title": "Players too big and the keeper in the net",
              "detail": "Problem: figures stood too tall and too far back. Why: the pictures hang past their feet. Fix: each figure is shrunk and lifted by the right amount."
            },
            {
              "title": "The speaker button covered the name strip",
              "detail": "Found in the playtest. The speaker and the timer now sit under the video."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Each account edits its own way",
              "detail": "Clubs and the league: TV with replays from new angles. Fans: a phone video. Meme pages: a TikTok edit. Others: behind the goal."
            },
            {
              "title": "More video posts",
              "detail": "Three new accounts and more goal posts; 17 → 29 goal videos in 30 test matches."
            },
            {
              "title": "Videos for other clubs' goals",
              "detail": "A made move for each goal in the England tab, played through the same recorder. 19 of 85 England posts had a video over 8 weeks."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Not seen on an iPhone",
              "detail": "Checked in a test browser only."
            },
            {
              "title": "England tab videos not seen in the real game",
              "detail": "The phone was locked in the test career. Checked in tests and stills."
            },
            {
              "title": "One video paused once while on screen",
              "detail": "Seen once in the playtest; cause not found."
            }
          ]
        }
      ]
    },
    {
      "version": "0.37",
      "title": "Mikey's patch notes — The standing ovation",
      "publishedAt": "2026-10-08T12:00:00Z",
      "updatedAt": "2026-10-08T12:00:00Z",
      "artifactUrl": "https://claude.ai/artifact/23eP6tYuyTjuvAbBisnkCj",
      "summary": "A 3D standing ovation at the farewell's 85th minute (the camera circles you, team-mates and rivals hug and dap you up, the sub hugs you on the line). Fixed: a centre-back winning the Golden Boot as a striker, clubs lining up as on day one after many seasons, kick-off jumping to a 44th-minute chance, the last match skipping End of Season. More assists; clearances, negotiations and Relations reworked; every men's Ballon d'Or winner saved for a future mode.",
      "stats": [
        {
          "value": "360°",
          "label": "3D standing ovation at 85'"
        },
        {
          "value": "0",
          "label": "centre-backs labelled strikers"
        },
        {
          "value": "10–14 → 14–17",
          "label": "Assist King's total"
        },
        {
          "value": "24–34 m/s",
          "label": "a clearance (was 18–26)"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "3D standing ovation at 85'",
              "detail": "Farewell match, or /star-retirement-dev → Standing ovation · 3D."
            },
            {
              "title": "Standing ovation New | Old",
              "detail": "Settings → Look → Standing ovation."
            },
            {
              "title": "Kick-off shows the commentary",
              "detail": "Any match whose first chance is after 12'."
            },
            {
              "title": "End of Season waits after the last match",
              "detail": "Home, after the season's last fixture."
            },
            {
              "title": "Career round-up page buttons",
              "detail": "End-of-career screen, the row under the title."
            },
            {
              "title": "Golden Boot winners are real attackers",
              "detail": "Season Awards."
            },
            {
              "title": "Clubs keep their transfers across seasons",
              "detail": "Team sheets of promoted clubs and the club you join."
            },
            {
              "title": "More assists",
              "detail": "Season Awards → Assist King."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "A centre-back won the Golden Boot as a striker",
              "detail": "Man City's Khusanov: the squad builder called him their second striker because no second real striker filled the slot. A player now keeps his own position; old saves are put right on load. 19 real-data seasons: every Golden Boot winner a real attacker."
            },
            {
              "title": "Man United and Wolves lined up as on day one",
              "detail": "Relegated clubs' squads were thrown away and reloaded fresh on promotion; the club you join was reloaded over its transfers. Squads now follow their clubs; no player at two clubs."
            },
            {
              "title": "Kick-off jumped to a 44th-minute chance",
              "detail": "Play only jumps straight to your first chance at or before 12'; a later one is read out."
            },
            {
              "title": "The last match skipped End of Season",
              "detail": "You land on Home with End of Season 🏆."
            },
            {
              "title": "No clear way back in the career round-up",
              "detail": "A row of page buttons."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "3D standing ovation",
              "detail": "About 24 s, skippable, drawn version for phones that can't run 3D."
            },
            {
              "title": "Every men's Ballon d'Or winner, 1956–2025",
              "detail": "From ballondor.com only, in data/ballondor/, for a future game mode."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Assists",
              "detail": "62 → 74 in 100 goals assisted; real creators weighted; Assist King 10–14 → 14–17."
            },
            {
              "title": "Clearances",
              "detail": "24–34 m/s up to 60°; miscues 30 in 100 at 50 down to 10 at 90; second balls (Settings → Look → Gameplay → Clearances)."
            },
            {
              "title": "Negotiations",
              "detail": "A hidden limit and a roll each counter; sponsors take it or leave it."
            },
            {
              "title": "Relations",
              "detail": "Happiness is the average of boss, team and fans; the manager's penalties; a harder signing session; games cost 30 energy."
            },
            {
              "title": "Smaller",
              "detail": "Basic KIB can 2 weeks' wage; star bar eases out; records once on Season Awards; ratings regraded; Star Pass rewards at any level; phone Home and Back buttons."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Why the farewell's first chance came at 44'",
              "detail": "Cause open; the background engine alone makes that under 1 in 100."
            },
            {
              "title": "Other clubs' players never age or retire",
              "detail": "Open since 5 Oct."
            }
          ]
        }
      ]
    },
    {
      "version": "0.36",
      "title": "Leo's patch notes",
      "publishedAt": "2026-10-08T01:30:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/2Uodrmk5Uj9Fm6ZBpUijAY",
      "summary": "Goal videos have sound: a crowd murmur that rises with the shot and roars at the goal, the kick, the keeper's gloves and the net on the frame they happen, and a commentator line after the goal and over the slow-motion replay (no commentator on a fan's phone video). A speaker button on every goal video mutes them all, remembered on this phone. A saved video keeps its sound. The nine commentator lines are on the Sound Board, so they can be replaced with better recordings.",
      "stats": [
        {
          "value": "9",
          "label": "commentator lines"
        },
        {
          "value": "~3×",
          "label": "louder crowd at the goal"
        },
        {
          "value": "0.2 s",
          "label": "to mix the sound"
        },
        {
          "value": "267/267",
          "label": "tests pass"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "A goal video plays with sound",
              "detail": "Score in a match → Post Match Reactions → your club's goal post → tap ▶."
            },
            {
              "title": "The speaker button",
              "detail": "Bottom left of a playing goal video → tap to mute, tap again for sound."
            },
            {
              "title": "Mute is remembered",
              "detail": "Mute one video, then play another goal video: it stays muted."
            },
            {
              "title": "A fan's video has no commentator",
              "detail": "A fan's goal post → crowd only."
            },
            {
              "title": "A saved video has sound",
              "detail": "Save video → open the file."
            },
            {
              "title": "The commentator lines on the Sound Board",
              "detail": "/admin/sound-board → Goal video commentator."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Headline: goal videos have sound",
          "items": [
            {
              "title": "Crowd, kick, net and a commentator",
              "detail": "Problem: the goal videos were silent. Fix: a crowd murmur that rises as the shot comes and roars at the goal; each kick, the keeper's gloves and the net on their frame; a commentator line just after the goal and one over the slow-motion replay. A fan's phone video has the crowd only. In the replay the crowd drops back and the kick and net sound slower. Measured on a real recorded goal: the crowd is about 3 times louder at the goal than before the shot; the saved file has a sound track."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "A speaker button on every goal video",
              "detail": "Bottom left. Mutes every goal video; remembered on this phone; starts the way Settings → Sound effects is set. A phone that blocks sound before a tap plays muted until the speaker is tapped. Seen in a browser: on → muted → on, saved."
            },
            {
              "title": "Nine commentator lines, replaceable on the Sound Board",
              "detail": "Made with a free offline British voice. Listed under Goal video commentator on /admin/sound-board; a replacement is used by the videos straight away."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "The commentator sounds calm, not excited",
              "detail": "A free reading voice. Replace the lines on the Sound Board with better takes; no code change."
            },
            {
              "title": "The commentator does not say names",
              "detail": "Each line is recorded in advance."
            },
            {
              "title": "Not heard on an iPhone",
              "detail": "Worked out, not seen: a phone that cannot put sound in the file plays it next to the video, but its saved video is silent."
            },
            {
              "title": "Still open from v0.10",
              "detail": "Recordings stay on one phone; a recording stops about 1.5 s after the goal; The League posts lower-league matches as Premier League; run star_legend_shares.sql and star_hall_of_fame.sql."
            }
          ]
        }
      ]
    },
    {
      "version": "0.35",
      "title": "Leo's patch notes",
      "publishedAt": "2026-10-07T22:45:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/Uq2eXdooybw4HrxqC6999X",
      "summary": "Goal videos: the match records every goal as you play (the ball, every player and the keeper's dive, 30 times a second, 7 to 15 KB a goal, kept on your phone). After the match, posts play it as a real video: your club on the TV pictures (its goal posts and its full-time highlights), highlights pages from behind the goal, fans on a phone in the stand. Two or more goals play as a highlights reel, and Save video puts it in your share menu or downloads it. Goal Replays play the recording, so a replay is always the same goal.",
      "stats": [
        {
          "value": "3",
          "label": "cameras: TV, behind the goal, a fan in the stand"
        },
        {
          "value": "7–15 KB",
          "label": "one recorded goal, kept on your phone"
        },
        {
          "value": "1.3–3.1 s",
          "label": "to make a video on a slow test machine"
        },
        {
          "value": "266 / 266",
          "label": "tests pass"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "A goal video in the feed",
              "detail": "Score in a match → after the match, Post Match Reactions → a post with a picture of the goal → tap ▶."
            },
            {
              "title": "Save video",
              "detail": "The same post → Save video (on an iPhone: the share menu → Save Video)."
            },
            {
              "title": "Three cameras",
              "detail": "Your club's post (TV) · a highlights page (behind the goal) · a fan's post (a phone in the stand)."
            },
            {
              "title": "A highlights reel",
              "detail": "Score 2 or more in a match, then find the HIGHLIGHTS post."
            },
            {
              "title": "No play button without a video",
              "detail": "A meme, a missed penalty or a match you skipped: a picture only."
            },
            {
              "title": "Goal Replays play the recording",
              "detail": "Settings → Goal Replays (admins) → a goal scored after this update → TV · Behind the goal · Fan in the stand."
            },
            {
              "title": "The players' moves follow Animations",
              "detail": "Settings → Look → Animations: New or Old, then watch a video again."
            },
            {
              "title": "The test page",
              "detail": "/star-goal-clips-dev → score → watch it from each camera → Save video."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Headline: goals in the feed are real videos now",
          "items": [
            {
              "title": "Every goal is recorded, and the feed plays it",
              "detail": "Problem: after a match, some posts looked like videos but nothing played, and a goal replay played the chance again with new luck, so it could end differently. Why: the game kept who scored and when, but not how. Fix: the match records every goal while you play (the ball, every player, the keeper's dive, 30 times a second). A post about a goal plays that recording as a real video: tap ▶, the phone makes it in a few seconds (a ring shows how far), then it loops. Your club posts the TV camera with a slow-motion replay from behind the goal (its goal posts and its full-time post); highlights pages post from behind the goal; fans post a tall, shaky phone video from the stand; a post about 2 or more goals plays them all. Seen in the real game: three goals played as one 12.7-second highlights video; after the fixes, a second match showed all three cameras in the feed (club TV made in 2.8 s, fan in 1.3 s, behind the goal), one playing at a time, no page errors."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Every goal is recorded as you play",
              "detail": "From the first kick of the move to just after the goal (12 seconds at most). 9 to 15 KB a goal, kept on this phone in the browser's own storage, not in the career save (the cloud save stays the same size). The newest 80 goals, plus every goal kept in Goal Replays. In the video every player and the ball are within 5 cm of where they really were (test). Your goals and team-mates' goals."
            },
            {
              "title": "Three cameras, like real posts",
              "detail": "TV: high at the side, a score bar, a GOAL banner, the scorer and the minute. Behind the goal: low behind the net, the keeper's back and the net bulge. A fan in the stand: a tall phone video, a bit shaky, heads in front, the account's @name. The crowd wears the two clubs' colours; some matches are at night."
            },
            {
              "title": "Save video",
              "detail": "Under every goal video: the share menu on a phone (Save Video puts it in Photos), a download on a computer. Most phones make an MP4 (worked out from the code); a browser that cannot makes a WebM. Named after the goal and the camera, e.g. Goal-Vance-44-Horsham-v-Farnborough-TV.mp4; several goals: Highlights-Horsham-v-Farnborough-TV.mp4. A browser that cannot make videos shows the picture with no play button."
            },
            {
              "title": "Goal Replays play the recording",
              "detail": "Settings → Goal Replays (admins): a goal recorded on this phone plays its video with the three camera buttons and Save video. A goal from before this update, or from another phone, plays the old way."
            },
            {
              "title": "The test page",
              "detail": "/star-goal-clips-dev: score a penalty, one-on-one, free kick or cut-back on the real match (weak keeper), then watch it from each camera and save it. Moves: Old / New."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "A post with no recorded goal is a picture",
              "detail": "A meme, a missed penalty, a match you skipped, or a goal from before this update: the headline on a card, with no play button."
            },
            {
              "title": "The players' moves follow Settings → Look → Animations",
              "detail": "New: the newer 3D moves (a shot, a header, a one-handed save). Old: the older moves. The same as your match."
            },
            {
              "title": "A post about 2 or more goals says HIGHLIGHTS",
              "detail": "It said GOAL. The label sits on the right of the picture now."
            },
            {
              "title": "Your club's goal posts and full-time post carry the goals on video",
              "detail": "TV pictures, only when the goal was recorded; otherwise the same words as before."
            },
            {
              "title": "A fan's goal post carries their phone video",
              "detail": "Filmed from the stand."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed (found by the playtest in the real game)",
          "items": [
            {
              "title": "Only highlights pages posted videos",
              "detail": "In the real feed only pages like Football Daily had a video, so you only saw the camera behind the goal. Your club's goal posts and full-time post (TV) and a fan's goal post (phone) carry it now. Over 30 test matches: club videos 0 → 7, fan videos 0 → 10."
            },
            {
              "title": "A second post of the same goals made the video again",
              "detail": "5.9 seconds more. Now the video is made once and shared, and plays at once."
            },
            {
              "title": "Two videos played at the same time",
              "detail": "Now one at a time: starting one pauses the others."
            },
            {
              "title": "A highlights video was saved under its first goal's name",
              "detail": "Now Highlights-Horsham-v-Farnborough."
            },
            {
              "title": "The TV and the fan's video of one goal saved under one name",
              "detail": "Found by the second check. The camera is in the name now (-TV, -Fan-cam, -Behind-the-goal)."
            },
            {
              "title": "Save video wrapped onto two lines; the GOAL label covered the account's name",
              "detail": "Both fixed: Save stays on one line, the label sits top right."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed (found while checking)",
          "items": [
            {
              "title": "The keeper stood on his head in the fan's video",
              "detail": "The players' drawings are made for the match's camera, which looks down from above, so a dive that runs down the screen read as a man on his head. A dive is drawn at most 35° from flat now, towards the ball. Tested over 2,701 ways he can face and dive; seen in stills from all three cameras."
            },
            {
              "title": "A post about one goal could play the match's other goals",
              "detail": "When that goal was not recorded. Now it plays that goal or shows a picture. Over 30 simulated matches, no post plays a wrong goal (test)."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Recordings stay on the phone that played the match",
              "detail": "Another phone shows the post's picture. On purpose: it keeps the cloud save small."
            },
            {
              "title": "Goals from before this update have no recording",
              "detail": "Their posts are pictures; their replays play the old way."
            },
            {
              "title": "The first play takes a few seconds",
              "detail": "1.3 to 3.1 seconds on a slow test machine. After that it plays at once until you leave the game."
            },
            {
              "title": "No sound yet",
              "detail": "The videos are silent."
            },
            {
              "title": "Only goals in the real match are recorded",
              "detail": "Simulated matches, five-a-side and training drills record nothing."
            },
            {
              "title": "Not seen on an iPhone",
              "detail": "An iPhone needs iOS 16.4 or later to make the video (worked out, not seen). Older phones show the picture."
            },
            {
              "title": "Goal Replays is for admins only",
              "detail": "As before. Players see their goals in the feed."
            },
            {
              "title": "The celebration in a video is short",
              "detail": "A recording stops when the match moves on, about 1.3 to 1.8 seconds after the goal (seen in the real game)."
            },
            {
              "title": "\"The League\" posts lower-league matches as Premier League",
              "detail": "Found by the playtest (@PremierLeague posting about Horsham, National League South). Older than this update; not fixed here."
            },
            {
              "title": "Still waiting from v0.9",
              "detail": "Run star_legend_shares.sql and star_hall_of_fame.sql. The world does not age."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "A short clip of a video playing in the feed, in the real game",
              "detail": "Added to the page after the push."
            },
            {
              "title": "Sound?",
              "detail": "Crowd noise and a commentator line on the videos. Say if you want it."
            }
          ]
        }
      ]
    },
    {
      "version": "0.34",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-07T18:00:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/73PxQFZCHbaKbkDd8MG96R",
      "summary": "Paid items cannot be faked any more: a Gems wallet only the server can write, and a Save guard that checks every cloud save (15 of 15 cheat edits caught, 0 false alarms in 7,696 saves). Plus 9 bug fixes, drawn club badges with symbols (118 of 248 clubs), 3D polish and a manager picker with two new office moments.",
      "stats": [
        {
          "value": "15 of 15",
          "label": "cheat edits to a saved career caught by the new Save guard"
        },
        {
          "value": "0 in 7,696",
          "label": "false alarms across saves from 15 simulated careers, big casino wins included"
        },
        {
          "value": "118 of 248",
          "label": "clubs now get a badge symbol picked from their nickname or name"
        },
        {
          "value": "9",
          "label": "bugs fixed, including Mikey's open list"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Gems wallet test page",
              "detail": "Admin → Gems (test). Mikey runs star_wallet.sql first"
            },
            {
              "title": "Save guard watching",
              "detail": "Nothing to tap. Mikey: check SUPABASE_SERVICE_ROLE_KEY in Vercel, then run star_save_guard.sql"
            },
            {
              "title": "Wall stays put after a deflected free kick",
              "detail": "A match free kick that the wall deflects"
            },
            {
              "title": "Byline dead ball no longer sits for seconds",
              "detail": "A cross or cutback along the byline that runs out"
            },
            {
              "title": "Players stay on their feet on byline crosses",
              "detail": "A byline cross with runners in the box"
            },
            {
              "title": "Left-footers kick with the left foot in 3D",
              "detail": "Any left-footed striker in a 3D match chance"
            },
            {
              "title": "Flat camera keeps players on screen",
              "detail": "Set the match camera to Flat, start a new chance"
            },
            {
              "title": "Back button clear of the header",
              "detail": "Line-up screen, any competition"
            },
            {
              "title": "Training Power drill: the goal is bigger",
              "detail": "Training, then Power"
            },
            {
              "title": "Woodwork and boss games look right when close",
              "detail": "Any close-camera feature"
            },
            {
              "title": "Trial skip/sim panel hidden from players",
              "detail": "The trial screen as a normal player"
            },
            {
              "title": "Drawn badges with symbols",
              "detail": "Settings → Look → Club badges: New | Old"
            },
            {
              "title": "Badges admin page",
              "detail": "/admin/badges"
            },
            {
              "title": "Tap to walk jogs",
              "detail": "Garden: tap the path, then the shop door. 3D shop: tap a car"
            },
            {
              "title": "Car park keeps your player in view",
              "detail": "Garden, the car park"
            },
            {
              "title": "3D shop is lit and lighter to draw",
              "detail": "3D shop, walk round the cars"
            },
            {
              "title": "Box Room and Shared Flat look different",
              "detail": "Store, Homes"
            },
            {
              "title": "Horse grazes and swishes its tail",
              "detail": "Garden, the stable"
            },
            {
              "title": "Relations → Boss picks 1 of 3",
              "detail": "Relations, Boss: Penalties, Office talk, Extra session"
            },
            {
              "title": "Made captain: office moment",
              "detail": "Get made captain, then go to Home"
            },
            {
              "title": "Dropped to the bench: office moment",
              "detail": "Before the line-up, after a run of low ratings"
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Headline: paid items cannot be faked any more",
          "items": [
            {
              "title": "The save safety work: a Gems wallet the phone cannot write to, and a guard on every cloud save",
              "detail": "Problem: the career is worked out on the phone and the server stored whatever it was sent, so anyone with browser tools (F12) could change ★5,000 to ★50,000,000, or write a save straight into the database with the public key every page carries. Why: the game was built to trust the phone. Fix 1, Gems wallet: gems and paid items live only on the server (4 tables), the phone reads but never writes, the server sets prices, a tap is never charged twice, only the server adds gems (an admin test button today) and the payment address refuses everything until Apple, Google or Stripe is connected. Test page: Admin → Gems (test). Fix 2, Save guard: every cloud save is checked against the last trusted one. 15 of 15 cheat edits caught (money ×10,000, skills to 99, fake trophies and Ballon d'Ors, season rewound, items without paying). 0 false alarms in 7,696 saves from 15 simulated careers, big casino wins included. It starts in watch-only mode for a week (logs, blocks nothing), then can be switched to correct faked numbers. Admins and testers are exempt.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Mikey runs star_wallet.sql and star_save_guard.sql. First check SUPABASE_SERVICE_ROLE_KEY is set in Vercel. star_save_guard.sql closes the direct-database write hole.",
                  "Known gaps: the casino runs on the phone (luck up to ×2,000 a week is only logged). Coins (the shop's current premium money) are in the save: do not sell Coins for real money. Other phone-trusted places: Hall of Fame and legend shares, Draft history and records, objectives, stats, XP.",
                  "How we know: measured (15 of 15 caught, 0 false alarms). Not seen: a real payment, or the guard on live saves."
                ]
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed: 9 bugs",
          "items": [
            {
              "title": "The wall chased the loose ball after a deflected free kick",
              "detail": "Problem: 2 or more wall men ran after the loose ball. Why: the wall men moved with the back line's shift. Fix: they stay out of it, and at most the nearest goes for a stopped ball. Kicks where 2+ wall men moved: 160 of 344 → 1 of 171 (core engine file).",
              "more": {
                "summary": "The detail",
                "points": [
                  "Measured in the real engine. Goals unchanged over 10 chance kinds, 400 each. Not seen in a played match."
                ]
              }
            },
            {
              "title": "A dead ball on the byline sat up to 1.88 seconds before the game called it",
              "detail": "Problem: a lost byline cross lay still for nearly 2 seconds. Why: the game waited for a defender to walk over. Fix: a ball that dies where only a defender can have it is called short after 0.3 s. Balls waiting 1 s or more: 17 of 460 → 0. Longest wait: 1.88 s → 0.85 s (core engine file).",
              "more": {
                "summary": "The detail",
                "points": [
                  "Measured over 460 byline chances. Not seen in a played match."
                ]
              }
            },
            {
              "title": "Players flipped between lying and standing on byline crosses",
              "detail": "Problem: runners flickered between a sprawled and a standing picture. Fix: 3D runners never use the sprawled picture. Sprawled frames while running: 90 of 360 → 0."
            },
            {
              "title": "Left-footers kicked with the right foot in 3D",
              "detail": "Fix: the kick picture is mirrored for left-footers. Seen in the before and after strike frames."
            },
            {
              "title": "The flat camera put extra players off screen on new chances",
              "detail": "Fix: Flat now frames everyone in the chance, as the 20° camera does. Players off screen: 1,597 of 1,650 → 838 (the rest hit the zoom-out limit)."
            },
            {
              "title": "\"‹ Back\" overlapped the competition header on the line-up screen",
              "detail": "Fix: the chip no longer runs under Back and takes two lines at most. Overlap on 4 competitions: 63 / 42 / 27 / 7 px → 0."
            },
            {
              "title": "The Training Power drill goal looked tiny",
              "detail": "Fix: the drill uses its own close camera. Goal width: 19% → 28% of the screen. Harry should check the Power drill on a phone."
            },
            {
              "title": "Close-camera features were drawn up to 36% stretched",
              "detail": "Fix: a feature's close camera now takes the new view's canvas shape. Harry should check woodwork and the boss games on a phone."
            },
            {
              "title": "The trial skip and simulate panel was open to every player",
              "detail": "Fix: testers and admins only."
            },
            {
              "title": "Already fixed or left alone",
              "detail": "Already fixed, dropped from the list: the dribble how-to card, 3 old failing tests, the old Sponsors bar. Not changed (Harry's call): the tight-angle defender at 1.9 to 2 m comes from the drawings (6 to 7% of chances)."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Every club uses a drawn badge, and 118 of 248 get a symbol from their nickname",
              "detail": "43 simple drawings: Gunners get a cannon, Magpies a magpie, Foxes a fox, Irons crossed hammers, Wolves a wolf. The other clubs keep a ball or a star. New page /admin/badges: all 248, a filter, a search box, and buttons to change a symbol or a pattern (saved on that device only). Settings → Look → Club badges: New (drawn badge for every club) | Old (real crest, or letters).",
              "more": {
                "summary": "The detail",
                "points": [
                  "Weakest drawings: the tiger reads a bit like a bear, the lion head a bit like a sun.",
                  "Seen in the real game page and the admin page. Not seen in a match on a phone."
                ]
              }
            },
            {
              "title": "Tap to walk now jogs",
              "detail": "Gate to shop door: 8.8 s → 6.3 s. A 4 m trip: 2.9 s → 1.6 s. Harry said it was too slow."
            },
            {
              "title": "Car park: your player was hidden",
              "detail": "The camera went outside the garden wall. It now keeps its distance inside the garden and stops at the wall."
            },
            {
              "title": "The 3D shop uses 2 real lights, not 6",
              "detail": "8 to 12% less time per frame on this machine. Not measured on a phone. The Old shop player keeps 6."
            },
            {
              "title": "Box Room and Shared Flat look different",
              "detail": "The two pictures are re-drawn: a corner shop and a tall cream Victorian house."
            },
            {
              "title": "The horse grazes and swishes its tail",
              "detail": "Grazes, stands, and its tail sways and flicks, at random times. Seen as a still only."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Relations → Boss: pick 1 of 3. The office also opens for captain and the bench.",
              "detail": "Penalties (unchanged), Office talk (3 questions, the best reply depends on his style: a random clicker averages −0.16 against +6 for the best replies, 2,800 talks) and Extra session (4 shots on the real match). The office opens for a club contract offer, manager news and being left out of the squad. New: made captain (once, on your next visit to Home) and dropped to the bench (before the line-up, with the real reason).",
              "more": {
                "summary": "The detail",
                "points": [
                  "Seen: the picker and the plain-card versions of both new moments. Not seen: the 3D office versions."
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
              "title": "Save guard is watch-only for a week",
              "detail": "It logs and blocks nothing until it is switched on."
            },
            {
              "title": "The casino and Coins still trust the phone",
              "detail": "Casino luck up to ×2,000 a week is only logged. Do not sell Coins for real money."
            },
            {
              "title": "Other places that trust the phone",
              "detail": "Hall of Fame and legend shares, Draft history and records, objectives, stats, XP."
            },
            {
              "title": "Two SQL files to run (Mikey)",
              "detail": "star_wallet.sql and star_save_guard.sql. Until the second runs, the direct-database write hole is open."
            },
            {
              "title": "Not seen or not measured",
              "detail": "3D office versions of the captain and bench moments; 3D shop lights on a phone. Tiger and lion drawings are weak."
            },
            {
              "title": "Still open from v0.30 and earlier",
              "detail": "The tight-angle defender at 1.9 to 2 m (Harry's call). The tour flow (half fixed). The Ballon d'Or may be too hard. Boots warnings in the New UI only. Tester access untried. SQL files still to run (Mikey): fix_two_digit_fifa_years, draft_records_full_fix, perf_indexes_jul2026, sofifa_search_indexes, fc27_clone_lower_leagues, star_hall_of_fame, star_legend_shares."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Mikey runs star_wallet.sql and star_save_guard.sql"
            },
            {
              "title": "Lock the other phone-trusted places"
            },
            {
              "title": "Move the casino to the server later"
            },
            {
              "title": "The look and style plan",
              "detail": "A plan only, nothing built: https://claude.ai/artifact/4hthbjbsdTx88UJfzCmV35"
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.30 — 5 to 6 Oct 2026 — 3D people with fingers, a 3D office, a rebuilt garden",
              "detail": "3D people are one body (3 bodies → 1, 15 finger joints a hand); a 3D manager's office; a rebuilt garden; the whole strike-screen ball takes a tap (69 of 69); faster 3D scenes; tap to move; 3D files about half the size and a 3D quality setting; drawn badges step 1; Boss picks 1 of 3; tester access links; the database security fix.",
              "more": {
                "summary": "Open from v0.30",
                "points": [
                  "Open on the artifact: https://claude.ai/artifact/AN3EiQVU8kb1cBWCFjn39A",
                  "Still open from v0.30: money and stats trusted from the saved career (the Save guard now watches this); the 3D office captain and bench moments (built, not seen); shop lights on a phone (not measured)."
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "version": "0.33",
      "title": "Leo's patch notes",
      "publishedAt": "2026-10-06T13:30:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/39iLwb8KpLGQmK9R7nbLgr",
      "summary": "Retirement, part 3: your retired careers' bests become 9 records your later careers chase, a share picture of a whole career (1080 x 1350, for WhatsApp or Instagram), a farewell match after the final whistle (Your XI against the Rivals XI, every chance and every set piece yours, off at 85' to a standing ovation), and sharing a career by code to compare it with a friend. Legacy points and playing on as your son are left for later; retiring still ends the save.",
      "stats": [
        {
          "value": "9",
          "label": "records your next careers chase, set by your retired ones"
        },
        {
          "value": "8.9",
          "label": "chances that come to a striker in the farewell before 85' (6.3 in a normal match)"
        },
        {
          "value": "1080 × 1350",
          "label": "the share picture: Instagram's portrait size"
        },
        {
          "value": "253",
          "label": "tests pass"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "The farewell invite",
              "detail": "Settings → Developer tools → Dev Skip to the end of season 20 → the Ballon d'Or night → The final whistle → Hang them up."
            },
            {
              "title": "Team sheets, guard of honour, the match",
              "detail": "The invite → Play it → KICK OFF."
            },
            {
              "title": "Off at 85', then full time",
              "detail": "Play the farewell to 85'."
            },
            {
              "title": "The Farewell strip on the end screen",
              "detail": "Full time → Hang them up."
            },
            {
              "title": "Share picture",
              "detail": "End screen → Share picture, or Hall of Fame → a career."
            },
            {
              "title": "Hall of Fame records",
              "detail": "A new career → Stats → flip to Records."
            },
            {
              "title": "\"3 goals off Calloway's record\" on Home",
              "detail": "A new career, close to one of your old records."
            },
            {
              "title": "Share link and Compare",
              "detail": "Hall of Fame → a career → Share link (signed in; needs the database file). Hall of Fame → Compare, or a friend's link → Compare."
            },
            {
              "title": "Every new screen on made-up careers",
              "detail": "/star-retirement-dev → The farewell match · Online."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Headline: the farewell match",
          "items": [
            {
              "title": "One last game after the final whistle",
              "detail": "After Hang them up, your last club invites you to one last game on the real match: Your XI (your best team-mates from every club, you in your own position) against the Rivals XI (every man who beat you to a Ballon d'Or starts, then the best players at the clubs that beat you to titles; the sides within 6 rating points). Invite (Play it or Skip) → team sheets → guard of honour (3D, or drawn without 3D) → the match: every chance and every set piece comes to you, your side makes extra chances, no energy, off at 85' to a standing ovation → full time → the career overview with a Farewell strip. Measured over 300 simulated matches for a striker with the real game's settings: chances to you by 85' 6.3 → 8.9; set pieces 0.4 → 1.7; team-mate goals a game 0.25 → 0.04. Nothing counts in your stats or trophies. Played in the real game: five farewells and a Skip, by the playtest."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Your records live on",
              "detail": "Nine records from your retired careers: goals and assists in a season, goals in a game, career goals, assists and appearances, trophies, Ballons d'Or, the furthest goal. Stats → Records: a Hall of Fame records card with who holds each and a bar for how close you are. Home: \"3 goals off Calloway's record\" when you get close. Breaking one makes news posts once, naming the old holder. Equalling never takes a record. Seen in the real game on a seeded save."
            },
            {
              "title": "Share picture",
              "detail": "One 1080 × 1350 picture of a whole career: name, legacy score, five big numbers, clubs, goals by season, the cabinet. Share (phone) or Save picture (computer), from the end screen and every Hall of Fame career."
            },
            {
              "title": "Share a career by code",
              "detail": "A Hall of Fame career can get a link like knowitball.co.uk/legend/K7Q2XM: read only, no sign-in to look, sign in to make one, Stop sharing turns it off. Codes are 6 letters and numbers with no look-alikes; nothing lists them (no public board)."
            },
            {
              "title": "Compare with a friend",
              "detail": "Head to head: 11 numbers, two bars each, and numbers won (Clubs is not counted). From a friend's link, or Hall of Fame → Compare → paste their code → pick one of yours."
            },
            {
              "title": "The test page shows all of it",
              "detail": "/star-retirement-dev: The farewell match (invite, team sheets, guard of honour 3D and drawn, full time, the overview) and Online (share link, head to head, the compare screen)."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Each season keeps your 5 best team-mates",
              "detail": "It fills Your XI in the farewell. The Hall of Fame copy leaves them out."
            },
            {
              "title": "The guard of honour follows Settings → Look → 3D quality",
              "detail": "Low 4 men a side, Medium 6, High 8."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed (found by the playtest)",
          "items": [
            {
              "title": "Free kicks and corners in the farewell went to team-mates",
              "detail": "The match picks a set-piece taker by position; the farewell never told it otherwise (a striker took 3 free kicks in 8, 1 corner in 4) and the playtest got 2 or 3 chances a match. Every set piece is yours now and your side makes extra chances: a striker's chances by 85' 6.3 → 8.9 (measured). The first check left position out and measured 7.3."
            },
            {
              "title": "Every farewell was the same match",
              "detail": "One fixed match script for every career ending at season 20 (same chances at 18' and 19', same rival goal at 84', all 0–1). Each career gets its own now."
            },
            {
              "title": "A Ballon d'Or rival's surname on both sides",
              "detail": "He is always picked, so the surname rule skipped him. Your team-mate with that surname sits out now: 3 clashes over 15 test careers → 0."
            },
            {
              "title": "The ovation came before the commentary reached 85'",
              "detail": "The banner and cheer now wait for the clock, and the banner says the same words as the commentary."
            },
            {
              "title": "The Back button covered the team-sheet label; the walk-out took 40-80 s on a slow device; '1 trophies'",
              "detail": "The label is 'Farewell match'; the walk-out runs in real time down to 4 frames a second; '1 trophy'."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed (found while checking)",
          "items": [
            {
              "title": "The same surname on both team sheets",
              "detail": "One surname once across both sides now (a Ballon d'Or rival is always picked). Rule off: 24 clashes over 15 test careers; on: 0."
            },
            {
              "title": "The Hall copy of a career drew a different overview",
              "detail": "The overview left the saved team-mates in; 12 Hall checks failed. Fixed."
            },
            {
              "title": "The guard of honour could not read Harry's smaller 3D files",
              "detail": "It now reads the packed files and picks its quality like every other 3D scene. Seen loading in 5 to 15 seconds on a test machine with no graphics chip."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Run supabase/migrations/star_legend_shares.sql",
              "detail": "Until then Share link says \"Sharing isn't switched on yet.\" Also still waiting: star_hall_of_fame.sql."
            },
            {
              "title": "Retiring still ends the save",
              "detail": "Legacy points and the son are Leo's to build later."
            },
            {
              "title": "Sharing and comparing not seen end to end",
              "detail": "The test machine cannot reach the database; screens, codes and the compare maths are tested."
            },
            {
              "title": "A farewell after this round's fixes is not seen played",
              "detail": "The chance numbers are measured; the banner timing is worked out from the code."
            },
            {
              "title": "Signed out on a test machine, a refresh during the farewell goes back to the Ballon d'Or night",
              "detail": "The older test-mode bug; signed-in players go back to the final whistle (worked out from the code)."
            },
            {
              "title": "The farewell is one go",
              "detail": "Skip it and it is gone; a refresh during it goes back to the final whistle."
            },
            {
              "title": "The Old UI has no farewell, share picture or compare",
              "detail": "It is frozen; its careers still go in the Hall and set records."
            },
            {
              "title": "The world does not age",
              "detail": "Carried from v0.7."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "A short clip of the 85' ovation",
              "detail": "Added to the page after the push. The guard of honour clip is on the page already."
            },
            {
              "title": "Legacy points and the son",
              "detail": "Leo's, after the base game."
            }
          ]
        }
      ]
    },
    {
      "version": "0.32",
      "title": "Leo's patch notes",
      "publishedAt": "2026-10-06T04:00:00Z",
      "updatedAt": null,
      "artifactUrl": "https://claude.ai/artifact/PhH1T34JAzEoWReV6NxWH6",
      "summary": "New animations: what you see in a match now matches what happens. One-hand keeper saves, catches, parries and fumbles; team-mates take touches and shoot, pass, head, block and clear with their own legs. A look-only layer with a New | Old switch and a test page. Stills only; short gameplay clips come after.",
      "stats": [
        {
          "value": "5,200 chances: same results",
          "label": "13 kinds x 400 seeds, every ball, keeper and defender identical"
        },
        {
          "value": "250 / 250",
          "label": "tests pass"
        },
        {
          "value": "16 dials, 8 switches",
          "label": "on the new Animations test page"
        },
        {
          "value": "0 physics changes",
          "label": "1 position fix, flagged"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Keeper top-corner save, one hand",
              "detail": "Infinite Highlights or a match: shoot at the top corner."
            },
            {
              "title": "Keeper catch held, parry then get-up, fumble",
              "detail": "A match, or Animations test page → Keeper."
            },
            {
              "title": "Team-mate touch (foot, thigh, chest)",
              "detail": "A match: a pass to a team-mate."
            },
            {
              "title": "Team-mate shot (5 shapes) and pass swing",
              "detail": "Infinite Highlights, or Animations → Shots / Passes."
            },
            {
              "title": "Header jump, block, clearance",
              "detail": "A corner or cross; Animations → Defenders."
            },
            {
              "title": "Contact flashes",
              "detail": "Where the ball meets a boot or a glove."
            },
            {
              "title": "Settings → Look → Animations: New | Old",
              "detail": "Old plays the game exactly as before."
            },
            {
              "title": "Play Area → Animations test page, dials and switches",
              "detail": "Testers and admins."
            },
            {
              "title": "A caught ball ends where the keeper is",
              "detail": "A match: any caught shot."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Headline: what you see matches what happens",
          "items": [
            {
              "title": "Saves, touches, shots, headers and blocks looked the same, or like nothing",
              "detail": "A team-mate's shot made YOUR figure kick; a defender cleared with no leg moving; every save was the same dive. The match had four outfield poses and one shared kick timer, and the engine never recorded who did what. Now the engine writes down who touched the ball and how (record only, no physics change), each player has his own animation clock, and each situation has its own pose. It is a look-only layer: Settings → Look → Animations: New | Old."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Keeper saves",
              "detail": "Top corner: one glove over his head, other arm tucked, diagonal body (before: both arms flung, body flat). Catch: ball held to his chest. Parry: palms it, gets up after about 0.75 s. Fumble: gathers it, hands fly apart, ball spills, he starts to rise. A 0.2 s white flash where ball meets hands."
            },
            {
              "title": "Team-mate touch",
              "detail": "He cushions the ball with foot, thigh or chest by its height, then sets himself, inside the same 0.45 s. Before: an arms-open pose, first runner only."
            },
            {
              "title": "Team-mate shot and pass with his own leg",
              "detail": "Five shapes: driven, curl, volley, chip, side-foot pass. Bent standing leg, balancing arm, 0.16 s contact flash, ground dust. No backswing: the animation starts at contact. Before: your figure kicked (a bug)."
            },
            {
              "title": "The Animations test page",
              "detail": "Every animation looping, Old v New or v First version; Flat or Shaded; right or left foot; 1x, 1/2x, 1/4x, Pause and a frame slider. 16 dials and 8 switches (one off = only that family draws the Old way). Reset, First version sizes, Copy settings. Play Area → Animations; Admin menu → Star Career → Animations; a Settings link for testers."
            },
            {
              "title": "Master switch",
              "detail": "Settings → Look → Animations: New | Old, default Old (switch to New to try it)."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Strikes are bigger than the first version (asked for by Leo)",
              "detail": "The first version was faint at match size. Boot rise / boot travel / body lean on a 40 px figure: driven 12→22 px / 15→37 px / 0°→14°; curl 11→21 / 15→32 / 11°→29°; volley 12→22 / 15→40 / 24°→38°; chip 7→9 / 8→15 / 0°→5°; side-foot pass 7→11 / 10→18 / 0°→6°; clearance 12→19 / 15→32 / 0°→17°. Driven-shot kicking leg widest angle 42°→82°."
            },
            {
              "title": "Headers, blocks, clearances",
              "detail": "Header: a real 0.55 s jump, height 0.62→0.74 of the figure's radius. Block: leg and body across the ball's path for 0.6 s, reach 1.25x. Clearance: big hoof, swing 1.6x; a headed clearance jumps. Touch 1.25x."
            },
            {
              "title": "3D sprite players",
              "detail": "A team-mate or defender who shoots, passes or clears plays the existing kick clip; a header lifts the sprite; a block tilts it; the keeper's dive clip is timed to the save. No new clips baked. Type-checked only."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "A caught ball stayed where the keeper stood while he slid away",
              "detail": "Over 234 catches the gap fell from a median 0.87 m (168 over half a metre) to a median 0.03 m (1 over half a metre). Outcome counts identical. This changes where the keeper and a caught ball end up, the only non-visual change; needs Leo's OK (question 4).",
              "bars": [
                {
                  "label": "Median gap (m)",
                  "was": 0.87,
                  "now": 0.03,
                  "state": "good"
                }
              ]
            }
          ]
        },
        {
          "kind": "added",
          "title": "Seen / not seen",
          "items": [
            {
              "title": "Measured: no physics change",
              "detail": "5,200 seeded chances (13 kinds x 400 seeds) hash ball, outcome, keeper, defenders and the next random number: identical to before the animation record was added (fingerprint 5c8b2374…). Outcome counts identical: goal 849, saved 794, blocked 540, wide 695, caught 234, over 294, out 531, tackled 391, rebound 416, post 70, offside 30, short 25, delivered 331."
            },
            {
              "title": "Measured: tests",
              "detail": "Match tests 7/7 with the same output except two figures that read where the ball lies after a catch (keeperDive 38.4→38.5%; keeperOneDive old-keeper saves behind his dive 40→51 and 38→54 of 200). Full star suite 250/250. tsc clean; build passes; the one-engine guard untouched."
            },
            {
              "title": "Seen",
              "detail": "Pose sheets and the test page at phone size; a real highlights page loading with no page errors."
            },
            {
              "title": "NOT seen",
              "detail": "Any strike in a real match (only pose sheets and the gallery); 3D sprite players (type-checked only, no graphics chip here); real squads (no database in the sandbox). Gallery keeper rows use a stand-in dive. \"Switch off draws Old\" checked by eye on the test page only."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Questions for Leo",
          "items": [
            {
              "title": "1. Strike size: right now, bigger, or smaller?",
              "detail": "Dials: strike swing size, strike lean."
            },
            {
              "title": "2. de Gea lean 1.15 rad: too much, too little, or fine?",
              "detail": "Dial: keeper one-hand lean."
            },
            {
              "title": "3. Pin the caught ball to his hands in the classic view?",
              "detail": "Today it may sit a little off the gloves."
            },
            {
              "title": "4. Keep the catch-position fix?",
              "detail": "The only non-visual change."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "The 3D keeper has no catch-hold or get-up, and 3D has no new clips",
              "detail": "The source models the sprite baker needs (player-idle, jog, sprint, kick, celebrate, keeper-dive) were never committed to the repo. Blocked on Harry (whoever baked them on 3 Oct 2026).",
              "pill": {
                "text": "blocked on Harry",
                "tone": "red"
              }
            },
            {
              "title": "A caught ball may sit slightly off the gloves in the classic view",
              "detail": "The figure is drawn a little offset from the engine's position."
            },
            {
              "title": "Strikes may still be subtle on a phone",
              "detail": "Dials exist."
            },
            {
              "title": "The earlier-noted dev-page gaps are untouched",
              "detail": "Nothing new found."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Short \"after\" clips of gameplay",
              "detail": "Filmed after this page is up, then added to the same page."
            },
            {
              "title": "3D clips",
              "detail": "Once the source models exist."
            },
            {
              "title": "Tune the dials from Leo's phone feedback"
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.7 (site 0.31) — 6 Oct 2026 — retirement, part 2: 20 seasons and a Hall of Fame",
              "detail": "Every career is 20 seasons; a Final season warning after season 19 and a final whistle after 20; the career overview is the end screen; every retired career is kept in a Hall of Fame; a new All seasons page; the last season's awards are counted. 108 → 15 KB per Hall copy; 246 tests. Still open: the Hall's database file (star_hall_of_fame.sql), the world does not age, the Old UI has no warning screen. Artifact: https://claude.ai/artifact/MmprHgEH6epYpooT4Cze7r"
            }
          ]
        }
      ]
    },
    {
      "version": "0.31",
      "title": "Leo's patch notes",
      "publishedAt": "2026-10-06T00:30:00Z",
      "updatedAt": null,
      "artifactUrl": null,
      "summary": "Retirement, part 2: every career is 20 seasons with a final-season warning after season 19, the career overview is the end screen, every retired career is kept in a Hall of Fame on the title screen, and the All seasons page gets the goals chart, the cabinet and every season. Plans for everything after retiring: https://claude.ai/artifact/DPNpkyaPoyHWj6xuLpGvGG",
      "stats": [
        {
          "value": "20",
          "label": "seasons in every career (was a yes/no every summer from age 33)"
        },
        {
          "value": "0",
          "label": "retired careers lost by starting again (the old end screen deleted them)"
        },
        {
          "value": "108 → 15 KB",
          "label": "one 20-season career, as kept in the Hall of Fame"
        },
        {
          "value": "246",
          "label": "tests pass"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "\"Final season\" after season 19",
              "detail": "Settings → Developer tools → Dev Skip to the end of season 19 → the Ballon d'Or night → Continue."
            },
            {
              "title": "\"The final whistle\" after season 20",
              "detail": "Dev Skip to the end of season 20 → the Ballon d'Or night."
            },
            {
              "title": "The career overview is the end screen",
              "detail": "The final whistle → Hang them up → Hall of Fame · New career · Menu."
            },
            {
              "title": "Hall of Fame on the title screen",
              "detail": "Menu (or open the game) → Hall of Fame → tap a career."
            },
            {
              "title": "New career keeps the old one",
              "detail": "End screen → New career → title → Hall of Fame."
            },
            {
              "title": "The new All seasons page, and its New | Old switch",
              "detail": "Stats → All seasons. Settings → Look → All seasons page."
            },
            {
              "title": "Every screen on made-up careers",
              "detail": "/star-retirement-dev → The screens, in order."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Headline: the Hall of Fame",
          "items": [
            {
              "title": "Retiring never deletes a career any more",
              "detail": "The end screen's \"Start a new career\" used to delete the retired career, on the phone and in the cloud. Now every retired career is copied into a Hall of Fame the moment it is saved (a slim copy: everything the overview shows). The title screen has a gold Hall of Fame button; tap a career for its whole overview; Remove asks first. A career retired before today goes in the next time the title screen opens. Before New career, New game or Delete can replace a retired career, the game checks it is in the Hall. Seen in the real game; the overview from a Hall copy matched the full career for 11 test careers."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Every career is 20 seasons",
              "detail": "No \"Do you go again?\" from age 33 (it was every summer, forced only at 50 seasons). A career starts at 16, so the last season is at 35. The limit is one number; \"no limit\" also works."
            },
            {
              "title": "The career overview replaced the old end screen",
              "detail": "Leo: \"just replace it\". Seven pages, then Hall of Fame · New career · Menu. No New | Old switch, as asked."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "\"Final season\" warning after season 19",
              "detail": "After the Ballon d'Or night, before the transfer window: \"Season 20 is your last before retirement. End your career the right way.\" A strip of 20 squares in your clubs' colours, the last one gold."
            },
            {
              "title": "\"The final whistle\" after season 20",
              "detail": "The verdict, apps, goals, trophies and the 20-season strip; Hang them up opens the overview."
            },
            {
              "title": "All seasons page: the goals chart, the cabinet and every season",
              "detail": "Stats → All seasons, drawn by the same pieces as the end screen. Settings → Look → All seasons page: New | Old."
            },
            {
              "title": "The test page shows every new screen",
              "detail": "/star-retirement-dev: five made-up 20-season careers and the screens in the order a player meets them."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed (found by the playtest)",
          "items": [
            {
              "title": "The Ballon d'Or button said \"Continue to next season\" after season 20",
              "detail": "There is no next season then; it now says \"Continue\"."
            },
            {
              "title": "A Hall card could name the wrong club",
              "detail": "It counted only seasons with games; it now counts every season, the same as the overview. New test."
            },
            {
              "title": "The final-season warning and the final whistle sat in the top half of the screen",
              "detail": "Now centred on a tall phone; still fits 390 x 664 without scrolling."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed (part 1, earlier today)",
          "items": [
            {
              "title": "The last season's Ballon d'Or, Golden Boot and Player of the Season were never counted",
              "detail": "Retiring skipped the end-of-season step that counts them; it now runs it."
            },
            {
              "title": "A season's row named the wrong club after a summer move",
              "detail": "It now records the club you played that season for (finish, wage, money)."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Run supabase/migrations/star_hall_of_fame.sql",
              "detail": "Until then the Hall stays on the phone it was made on (it says so). Nothing breaks without it."
            },
            {
              "title": "The world does not age",
              "detail": "Other clubs' players never get older or retire; after 20 seasons the squads are the same people at the same ages. Read in the code. Question 2 on the plans page."
            },
            {
              "title": "A save already past season 20 retires at the end of the season it is in",
              "detail": "Only saves from before this change; it gets the final whistle but no warning first."
            },
            {
              "title": "The Old UI has no warning screen and no Hall button",
              "detail": "It is frozen. It follows the 20-season rule, and its retired careers still go in the Hall."
            },
            {
              "title": "Signed out on a test machine, a refresh on the Ballon d'Or night can land on Home",
              "detail": "Carried from part 1. Test mode only."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Leo's choices on the plans page",
              "detail": "Suggested order: your records live on, the share card, the farewell match, Next generation, online, chairman."
            }
          ]
        }
      ]
    },
    {
      "version": "0.30",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-05T17:30:00Z",
      "summary": "Second update: the strike-screen ball takes a tap on its whole face (live), signing scene and office about 2x faster, a lighter garden, tap to move, a real walk. First publish: 3D people are one body with fingers, a 3D manager's office, a rebuilt garden, tester access links, the security database fix, a new match-engine rule and 244 of 244 tests passing. Harry's v0.30.",
      "stats": [
        {
          "value": "69 of 69",
          "label": "test taps on the strike-screen ball now land (plus 28 of 28 in the ring margin)"
        },
        {
          "value": "~2x faster",
          "label": "signing scene and manager's office (1478 to 741 ms a frame, measured on slow software drawing)"
        },
        {
          "value": "177 → 127",
          "label": "things drawn per frame at the garden gate"
        },
        {
          "value": "3 bodies → 1",
          "label": "different 3D people in the signing scene, shop and garden"
        },
        {
          "value": "0 → 15",
          "label": "finger joints on each hand"
        },
        {
          "value": "~half → all",
          "label": "of the garden's scenery now shows (trees, fence, fountain basin, plants were missing)"
        },
        {
          "value": "4 of 4",
          "label": "database tables that now refuse anonymous writes (tried on the live site)"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Strike screen: tap anywhere on the ball",
              "detail": "A match chance, then Where do you strike it?. Tap the top, the sides and just outside the ball. No see-through halo"
            },
            {
              "title": "Signing scene opens faster and the pen and laptop look right",
              "detail": "Join a club, then the signing scene"
            },
            {
              "title": "Manager's office: no black window, laptop has a screen",
              "detail": "Talk to your manager. Tap He talks and You talk"
            },
            {
              "title": "Garden is smoother and he walks, not jogs",
              "detail": "Home, then Garden. Use the stick, then stand still"
            },
            {
              "title": "Tap to move",
              "detail": "Garden: tap the path, then the shop door. 3D shop: tap a car. Touch the stick to cancel"
            },
            {
              "title": "Bench team-mates sit on the bench; the fountain is solid",
              "detail": "Garden, the gazebo and the shop front"
            },
            {
              "title": "Car park: is your player always drawn?",
              "detail": "Garden, the car park. We lost him once in 4 test runs"
            },
            {
              "title": "Does the 3D shop still lag?",
              "detail": "3D shop, walk round the cars. Its 6 spotlights are the likely cause"
            },
            {
              "title": "3D people are one body, with fingers",
              "detail": "Settings → Look → 3D people: New | Old. Then open the signing scene, the 3D shop and the garden"
            },
            {
              "title": "Fingers close round the pen, hands grip in the handshake",
              "detail": "The signing scene when you join a club"
            },
            {
              "title": "Talk to your manager opens a 3D office",
              "detail": "Settings → Look → Talk to your manager: 3D office | Old. Then Talk to your manager"
            },
            {
              "title": "The garden has all its scenery and a new shop front",
              "detail": "Settings → Look → 3D garden: New | Old. Then Home → Garden"
            },
            {
              "title": "Tester access links",
              "detail": "Admin → Testers makes a link. A signed-in player opens it and taps Become a tester"
            },
            {
              "title": "The security database fix is done",
              "detail": "Nothing to tap. Both SQL files are run in Supabase"
            },
            {
              "title": "The match engine can change now, with a warning",
              "detail": "Nothing to tap. A warning shows each time a session changes the engine"
            },
            {
              "title": "The full game test list passes",
              "detail": "Nothing to tap. 244 of 244 passed today"
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Talk to your manager happens in a 3D office",
              "detail": "A desk, a laptop, a trophy cabinet and a window onto the stadium. The camera turns to whoever is talking. Same words and choices. Switch: Settings → Look → Talk to your manager: 3D office | Old.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Seen on a combined copy of today's work: the close-up and the wide shots.",
                  "The window showed black once, in an earlier check. It showed correctly in the later one, so it may depend on how the page loads. It is on the In progress list."
                ]
              }
            },
            {
              "title": "Tester access links",
              "detail": "v0.29 locked the cheat menu and test pages to admins, so testers had no way in. /admin/testers makes links like /tester/K7Q2XM. A signed-in player opens one and taps Become a tester. A tester gets god mode (Settings → Developer tools) and the 13 play-only test pages, including the Play Area. The scenario gallery stays admin only. A career that used god mode carries a Tester save mark.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Mikey ran tester_access.sql. A live check showed both new parts answer.",
                  "Not seen: the whole flow. No tester link has been used yet."
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
              "title": "3D people are one body, with fingers",
              "detail": "The signing scene, the shop and the garden each used a different body, with a bodybuilder shape (waist 0.27 m under shoulders 0.46 m) and no fingers. Now one body everywhere, including the 3 garden bench team-mates, with a 0.30 m waist and 15 finger joints on each hand. Switch: Settings → Look → 3D people: New | Old.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Problem: three different bodies, a bodybuilder shape, and no fingers. The pen floated beside the hand and the handshake hands stopped 7 cm apart.",
                  "Why: each scene loaded its own body, and the hand was one flat piece with no finger joints.",
                  "Fix: one body everywhere; waist 0.27 → 0.30 m, shoulders about 2 cm narrower; fingers close round the pen; the hands meet and grip.",
                  "Seen in the pictures (old and new, same scene and camera). Sizes measured on the model.",
                  "Still rough: jagged finger edges, bent left thumbs, fingers poking through in the handshake, the pen sitting low. All on the In progress list."
                ]
              },
              "bars": [
                {
                  "label": "Different 3D bodies",
                  "was": 3,
                  "now": 1,
                  "target": 3,
                  "state": "good"
                },
                {
                  "label": "Finger joints per hand",
                  "was": 0,
                  "now": 15,
                  "target": 15,
                  "state": "good"
                },
                {
                  "label": "Thumb-to-finger gap on the pen (cm)",
                  "was": 4.8,
                  "now": 1.2,
                  "target": 4.8,
                  "state": "good"
                }
              ]
            },
            {
              "title": "The garden makeover, and a bug that hid half the scenery",
              "detail": "Every tree, the paddock fence, the fountain basin and the potted plants never appeared. Fixed. The shop is a brick shop front with awnings and shirts in your club's kit. Evening sun, mown lawn, hedge and brick boundary, tree line, a brighter stable. The camera no longer cuts into the fountain or gazebo roof. Switch: Settings → Look → 3D garden: New | Old.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Up to 263 thousand triangles at the bench, against 142 thousand before. A slow phone may lag.",
                  "Seen in the pictures. The weight numbers are measured on the scene.",
                  "Still to fix: the car-park camera, the see-through fountain over your player, team-mates floating above the bench, blocky trees."
                ]
              },
              "pill": {
                "text": "heavier, being cut",
                "tone": "amber"
              },
              "bars": [
                {
                  "label": "Garden weight (k triangles; lower is lighter)",
                  "was": 142,
                  "now": 263,
                  "target": 263,
                  "state": "bad"
                }
              ]
            },
            {
              "title": "The match engine can change now, with a warning",
              "detail": "Mikey's rule said never change the match engine, so two match bugs could not be fixed. The ban is gone (Harry's call). A check warns every time any session changes the engine, and the change must be named in the patch notes with before and after numbers and the match tests run.",
              "more": {
                "summary": "The detail",
                "points": [
                  "The two bugs: the wall chases the loose ball after a deflected free kick; a byline cutback sits for 1.6 s before it is called intercepted. Both will now be fixed in the engine itself.",
                  "Not seen: the warning firing. No engine change is in v0.30."
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
              "title": "Strike screen: the whole ball takes a tap (live)",
              "detail": "On an iPhone only the bottom 25% of the ball took a tap, with a see-through halo. Cause (reasoned, not seen): the pitch picture behind is tipped 20 degrees and Safari can let it catch taps. Now the whole screen hears the tap and checks it against the ball; a tap just outside, up to the ring, hits the nearest edge; the tipped pitch is hidden; the shadow is plain. Measured in WebKit: 69 of 69 points on the ball and 28 of 28 in the ring margin take a tap.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Not seen on a real iPhone after the fix. Harry to check.",
                  "Still: strike-ball.jpg (green dots take a tap, red do not)."
                ]
              }
            },
            {
              "title": "Signing scene and manager's office: about 2x faster, plus fixes",
              "detail": "Draws per frame in talk shots 54 to 5. Pixels 1.32M to 0.74M (-44%). Signing talk shot 1478 to 741 ms a frame; office 1562 to 779 ms. First picture 640-980 ms to 77-125 ms; the loading cover stays 0.7-2.5 s longer. The room is drawn once per camera and held shots run at 30 fps. Fixed: black office window, jagged fingers and bent left thumbs (one small frill left), laptop lid, pen. Handshake is better but still rough close up. Not bugs: the You talk highlight; long hair does not clip.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Measured on slow software drawing (no graphics chip). Compare before with after only. Not seen on a phone."
                ]
              }
            },
            {
              "title": "Garden and 3D shop: less lag, tap to move, a real walk, garden fixes",
              "detail": "Draws per frame at the gate 177 to 127, gazebo 117 to 70, car park 108 to 85, paddock 107 to 73, shop front 111 to 81, by the shop 179 to 117. Triangles at the gazebo 263k to 114k. 3D shop 48-80 to 39-71 draws. Tap the ground to walk round obstacles (gold ring); tap a thing and its card opens; a drag does not walk; touching the stick cancels. Real upright walk (was the standing pose). Bench mates no longer 16 cm through the deck. Fountain solid. Trees rounder. Car-park camera improved, not fully fixed. iPhone safety: retry with the old body, and one restart at low quality.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Measured on the scene; seen in the pictures. Not seen on a phone.",
                  "Open: player sometimes not drawn at the car park (once in 4 runs); the shop's 6 spotlights are likely its biggest remaining phone cost."
                ]
              }
            },
            {
              "title": "3D speed layer: measured, not switched on yet",
              "detail": "Fewer pixels -48%; flat bench mates -34%; office room drawn once -16% to -36%; garden shadows once -18%; smaller model files, download about halved; a background thread cuts a 3.4-5.3 s page freeze to 0.25 s. Next: smaller model files and a 3D quality setting."
            },
            {
              "title": "How we build now",
              "detail": "Builders do one quick check per change, and Harry judges 3D on his phone. Measured reason: the garden builder spent about 3 of 4.5 hours waiting on its own screenshots, because this machine has no graphics chip."
            },
            {
              "title": "The security database fix is done",
              "detail": "Both SQL files are run. July: votes, XP, objectives, rewards, draft rooms. August: cosmetics, streak trophies, username cooldown. A live check tried to write to four tables with no sign-in (community votes, XP, objectives, rewards). All four refused.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Seen live: 4 of 4 tables refused. The check covered these four only.",
                  "A player can still edit their own saved career. See Known issues."
                ]
              }
            },
            {
              "title": "The three tests that failed before now pass",
              "detail": "The full game test list passes: 244 of 244, run today."
            }
          ]
        },
        {
          "kind": "next",
          "title": "In progress",
          "items": [
            {
              "title": "Two match bugs, to be fixed in the engine itself",
              "detail": "The wall chases the loose ball after a deflected free kick. A cutback along the byline sits for 1.6 s before it is called intercepted. Each engine change will be named with before and after numbers, with the match tests run."
            },
            {
              "title": "Smaller model files and a 3D quality setting",
              "detail": "The speed layer is measured but not switched on."
            },
            {
              "title": "The player missing at the car park, and the 3D shop's spotlights",
              "detail": "Seen once in 4 runs; the cause is not found."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "The new garden was heavier than the old one",
              "detail": "263 thousand triangles at the gazebo against 142 thousand. Now 114 thousand at the gazebo. Not tried on a phone.",
              "pill": {
                "text": "being cut",
                "tone": "amber"
              }
            },
            {
              "title": "The black office window may come back",
              "detail": "It showed correctly in today's check."
            },
            {
              "title": "The 3D hands still look rough",
              "detail": "Jagged finger edges, bent left thumbs and fingers poking through in the handshake."
            },
            {
              "title": "Tester links are untried",
              "detail": "No link has been used yet, so Become a tester has not been tapped."
            },
            {
              "title": "Player money and stats are still trusted from the saved career",
              "detail": "A player can edit their own save. Needs a server fix before real money is involved."
            },
            {
              "title": "Next for the match builder",
              "detail": "Two players overlap and flip between lying and standing on byline crosses; left-footers kick with the wrong foot in 3D; the tight-angle defender; new chances put extra players off screen when the pitch is flat."
            },
            {
              "title": "Box Room and Shared Flat look the same",
              "detail": "Horses have one pose."
            },
            {
              "title": "The Back button overlaps the competition header on the line-up screen",
              "detail": "Not from this round."
            },
            {
              "title": "The tour flow still needs a proper rethink",
              "detail": "The Later button is only a first step.",
              "pill": {
                "text": "half fixed",
                "tone": "amber"
              }
            },
            {
              "title": "The Ballon d'Or may be too hard when you play the matches yourself",
              "detail": "The numbers come from simulated careers. The boots warnings are in the New UI only."
            },
            {
              "title": "Still to run in Supabase (Mikey)",
              "detail": "Five files, in plain English.",
              "more": {
                "summary": "What each file does",
                "points": [
                  "fix_two_digit_fifa_years.sql cleans up player rows saved with a two-digit year (26 instead of 2027) and an age of -1977. They hide next to the real rows.",
                  "draft_records_full_fix.sql fixes Career Records. Today every career record fails to save, because the database rules reject them.",
                  "perf_indexes_jul2026.sql speeds up tierlist like counts and the Draft records, which have no shortcut in the database yet.",
                  "sofifa_search_indexes.sql stops searches on a player's position or league from timing out.",
                  "fc27_clone_lower_leagues.sql gives League One, League Two and some National League clubs real players, copied from last year (43 clubs, 1,154 players). Today most of them play invented names."
                ]
              }
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.29 — 5 Oct 2026 — cheat menus locked, a harder Ballon d'Or",
              "detail": "The cheat menu and 18 test pages for admins only; the Ballon d'Or Premier League only with a major trophy; a new play-off every season; the trial shootout always 2-2; a Later button on the tour; commentary up to 8×; boots warnings. Numbers: 19 → 3 of 20 Championship starts win a Ballon d'Or; 70 → 4 in 213 seasons.",
              "more": {
                "summary": "Open from v0.29",
                "points": [
                  "Open on the artifact: https://claude.ai/artifact/SRj5ZaVsgWFWca9Dy5bNWx",
                  "Still open from v0.29: money and stats trusted from the saved career, the Back button overlap, the tour flow (half fixed), a possibly too hard Ballon d'Or, boots warnings in the New UI only. All listed above."
                ]
              }
            },
            {
              "title": "v0.27 — 3 Oct 2026 — a tipped-back camera, a keeper who behaves",
              "detail": "The pitch tipped back 20°, a zoom for each kind of highlight, an even mix of highlights, a drag that starts beside the ball, a keeper who faces out and stays down, a ball that no longer stops on the grass. Harry's own page numbering; not listed on this site."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/AN3EiQVU8kb1cBWCFjn39A",
      "updatedAt": null
    },
    {
      "version": "0.29",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-05T14:45:00Z",
      "summary": "Cheat menus and 18 test pages locked to admins, a much harder Ballon d'Or, a play-off bug fixed, a trial shootout that is always 2-2 before your kick, a tour Later button, commentary up to 8× and boots warnings. Harry's v0.29.",
      "stats": [
        {
          "value": "19 → 3 of 20",
          "label": "careers from a Championship start that win a Ballon d'Or (simulated)"
        },
        {
          "value": "70 → 4",
          "label": "Ballon d'Or wins in 213 simulated Premier League seasons"
        },
        {
          "value": "18",
          "label": "test pages that now say Admins only on the live site"
        },
        {
          "value": "1 in 3 → 5 of 5",
          "label": "trial shootouts at 2-2 before your kick (5 of 5 seen on screen)"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "The cheat menu is for admins only",
              "detail": "Settings → Developer tools. A normal account sees nothing. Can't be checked in a test copy."
            },
            {
              "title": "18 test pages say Admins only",
              "detail": "Type a test page's address (the Play Area, a 3D test area, the gallery) on the live site as a normal player"
            },
            {
              "title": "A new play-off every season",
              "detail": "Play on past season 1 in League One or Two, or the Championship"
            },
            {
              "title": "Ballon d'Or is much harder",
              "detail": "Awards after a season: Premier League only, and you need a major trophy"
            },
            {
              "title": "The trial shootout is 2-2 before your kick",
              "detail": "New game → trial → penalties"
            },
            {
              "title": "The tour has a Later button",
              "detail": "Home → the Tap Play pointer → Later"
            },
            {
              "title": "Commentary speed goes up to 8×",
              "detail": "Any match → the speed button under the minute"
            },
            {
              "title": "Boots warnings",
              "detail": "Line-up before kick-off, and the full-time screen after the match the boots die (New UI only)"
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "The cheat menu and 18 test pages are for admins only",
              "detail": "Developer tools (add money, coins, max skills, switch club, skip ahead) sat behind a plain Show button any player could press, and test pages opened for anyone who typed the address. Now admins only, in the New UI and the Old UI.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Problem: any player could give themselves money and skills, and open pages like the Play Area, the 3D test areas and the gallery.",
                  "Why: they were built as test tools and nothing checked who was using them.",
                  "Fix: Developer tools shows for admins only. The 18 test pages say Admins only on the live site.",
                  "Local and test copies treat everyone as an admin, so the lock cannot be seen there. Reasoned from the code, not seen as a normal player on the live site.",
                  "Testers who used the menu on the live site lose it too, until tester access is built."
                ]
              }
            },
            {
              "title": "The Ballon d'Or is much harder to win",
              "detail": "Premier League only, and you need a major trophy that season (Premier League, Champions League, World Cup or Euros). Championship: only as top scorer on the list AND a World Cup winner. League One and below are not shortlisted. The world's best rivals (86+) now have superstar seasons.",
              "bars": [
                {
                  "label": "Championship start: careers that win (of 20)",
                  "was": 19,
                  "now": 3,
                  "target": 20,
                  "state": "good"
                },
                {
                  "label": "National League start: careers that win (of 20)",
                  "was": 9,
                  "now": 3,
                  "target": 20,
                  "state": "good"
                },
                {
                  "label": "Wins in 213 Premier League seasons",
                  "was": 70,
                  "now": 4,
                  "target": 70,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "The detail",
                "points": [
                  "Before: a Championship start won it in 19 of 20 simulated careers, the first time in season 3. A National League start won in 9 of 20. Wins from League Two came in seasons 1 and 2.",
                  "A 90-rated striker now scores about 25 to 45 goals; a 93-rated one about 30 to 55.",
                  "A Championship start now wins about 4 seasons after reaching the Premier League.",
                  "Measured on simulated careers, not played by hand. It may be too hard once you play the matches yourself. It is one number to loosen."
                ]
              }
            },
            {
              "title": "The trial shootout is always 2-2 before your kick",
              "detail": "Harry: at least have 3 penalties scored. Both team-mates score and the Academy miss one of three. Before it was 0-0, 1-1 or 2-2, about a third each.",
              "bars": [
                {
                  "label": "Shootouts at 2-2 before your kick",
                  "was": 33,
                  "now": 100,
                  "target": 100,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "The detail",
                "points": [
                  "Seen on screen: 2-2 before the kick on 5 of 5 shootouts."
                ]
              }
            },
            {
              "title": "The tour has a Later button",
              "detail": "Steps that make you press a button used to block every other tap. Now a Later button hides the tour until that screen opens again.",
              "pill": {
                "text": "half fixed",
                "tone": "amber"
              },
              "more": {
                "summary": "The detail",
                "points": [
                  "A first step on Harry's ask to fix the tour flow. The flow itself still needs a proper rethink.",
                  "Seen working: the Home screen before and after tapping Later."
                ]
              }
            },
            {
              "title": "Commentary goes up to 8× speed",
              "detail": "The speed button now goes 1× → 2× → 4× → 8×. At 8× there are about 3 seconds between your chances.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Measured on screen: 3 gaps of 2.9 to 3.0 seconds."
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
              "title": "Last season's play-off result carried into every later season",
              "detail": "Last year's winner was promoted again from wherever they finished (15th in League Two and 19th in the Championship were seen in a 14-season simulation) and no new play-off was ever held. The result is now cleared each season.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Why: the play-off result was never cleared at the end of a season.",
                  "A new test fails without the fix and passes with it."
                ]
              }
            },
            {
              "title": "Boots wore out with no warning",
              "detail": "The line-up says Last match in these boots before kick-off. After the match they die, full time says Your boots just wore out. Buy a new pair in the Shop. New UI only.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Seen on screen: both messages.",
                  "A first try put the pre-match line on an old screen nobody sees any more. The browser check caught it."
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
              "title": "The security database fix is still waiting",
              "detail": "Two SQL files (security_rls_hardening_jul2026.sql, security_user_profiles_columns_aug2026.sql) are not run in Supabase. Until they run, anyone with the public database key can still write straight into community votes, the Draft leaderboards, multiplayer draft rooms and XP. (This is separate from the cheat menus: Star Career money and stats are still trusted from the saved career, which needs its own server fix.)",
              "pill": {
                "text": "blocked on running them",
                "tone": "red"
              }
            },
            {
              "title": "Player money and stats are still trusted from the saved career",
              "detail": "Needs a server fix before real money is involved."
            },
            {
              "title": "Tester access is not built yet",
              "detail": "Until it is, only admin accounts see the cheat menu and the test pages on the live site."
            },
            {
              "title": "The ‹ Back button overlaps the competition header on the line-up screen",
              "detail": "Seen by the browser check. Not from this round."
            },
            {
              "title": "The tour flow still needs a proper rethink",
              "detail": "Later is only a first step.",
              "pill": {
                "text": "half fixed",
                "tone": "amber"
              }
            },
            {
              "title": "The Ballon d'Or may now be too hard when you play the matches yourself",
              "detail": "The numbers come from simulated careers."
            },
            {
              "title": "Still open from v0.27 and earlier",
              "detail": "The wall chasing a loose free kick, a cutback along the byline sitting for 1.6 s, two players overlapping on byline crosses, new-chance extras off screen when flat, and the v0.26 items (3D kick foot for left-footers, signing hands, long-hair model, shop walk). Still to run in Supabase after the two security files: fix_two_digit_fifa_years.sql, draft_records_full_fix.sql, perf_indexes_jul2026.sql, sofifa_search_indexes.sql, fc27_clone_lower_leagues.sql."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Tester access links",
              "detail": "God mode for testers, so locking the cheat menu does not stop testing."
            },
            {
              "title": "One 3D body for every cutscene",
              "detail": "Being built now: the signing scene (fingers on the pen, a handshake), the manager's office for conversations, and the garden's look."
            },
            {
              "title": "Short gameplay clips",
              "detail": "For the trial shootout and the 8× commentary, added to the page after it is published."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.27 — 3 Oct 2026 — a tipped-back camera, a keeper who behaves",
              "detail": "The pitch tipped back 20°, a zoom for each kind of highlight, an even mix of highlights, a drag that starts beside the ball, a keeper who faces out and stays down, a ball that no longer stops on the grass. Harry's own page numbering; not listed on this site.",
              "more": {
                "summary": "Open from v0.27",
                "points": [
                  "The wall chasing a loose free kick, a cutback along the byline sitting for 1.6 s, two players overlapping on byline crosses, new-chance extras off screen when flat. All listed in Known issues above."
                ]
              }
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/SRj5ZaVsgWFWca9Dy5bNWx",
      "updatedAt": null
    },
    {
      "version": "0.28",
      "title": "Leo's patch notes",
      "publishedAt": "2026-10-05T03:30:00Z",
      "updatedAt": "2026-10-05T03:30:00Z",
      "artifactUrl": "https://claude.ai/artifact/PQCcbHkmPEQ3NrzA88nVZS",
      "summary": "Keepers made human (top corners, weaker keepers worse, goalie vision, easier trial free kicks and penalties), dribble runs with team-mates to pass to, knuckleball / power shot / keeper howlers in the test match only, five-a-side keepers that dive, and a way back from the trial, training and scout screens. Every gameplay change has a New / Old switch in Settings.",
      "stats": [
        {
          "value": "26 → 43%",
          "label": "top-corner shots that beat a 90-rated keeper"
        },
        {
          "value": "36 → 48%",
          "label": "trial free kicks that go in"
        },
        {
          "value": "0.8 · 2.8 · 8.2%",
          "label": "keeper howlers on a perfect power shot (top · average · worst), test match"
        },
        {
          "value": "243",
          "label": "tests pass"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Gameplay switches: Keepers and Dribble runs, New / Old",
              "detail": "Settings → Look → Gameplay · new vs old."
            },
            {
              "title": "New dials with the shipped values",
              "detail": "/star-tuning-dev → Keepers (new) · Dribble (new)."
            },
            {
              "title": "Keepers beatable in the top corner; slower with bodies in front",
              "detail": "Any match."
            },
            {
              "title": "Trial free kicks and penalties easier",
              "detail": "New career → trial."
            },
            {
              "title": "Five-a-side keepers crouch and dive",
              "detail": "Trial → Five-a-side, or /star-3d-dev → Five-a-side."
            },
            {
              "title": "✕ Exit on trial stages and training drills; Settings on scout, wage and offers screens",
              "detail": "Trial / Training / after the trial."
            },
            {
              "title": "Goalie Mode no longer scrolls",
              "detail": "Casino → Goalie Mode."
            },
            {
              "title": "Dribble: tap a team-mate to pass",
              "detail": "Any match → a dribble run."
            },
            {
              "title": "Knuckleball and power shot (test match only)",
              "detail": "/star-match-dev → New shots."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Keepers were too good",
              "detail": "Top corners vs a 90 keeper: 26% → 43%. Weak-vs-strong keeper gap 20 → 25 goals in 100. Vision: 3 bodies in front 44% → 47%. Average keeper concedes 24% → 28% of well-struck shots."
            },
            {
              "title": "Trial free kicks and penalties were too hard",
              "detail": "Free kicks 36% → 48%; penalty kick 1 62% → 65%, kick 3 41% → 45%. Match free kicks unchanged."
            },
            {
              "title": "Five-a-side keepers ran like outfielders",
              "detail": "Now use the real keeper pose: set, and diving on saves. Seen in a browser."
            },
            {
              "title": "No way back from trial stages, training drills, scout/wage/offers screens",
              "detail": "Exit and Settings buttons added. Seen in a browser."
            },
            {
              "title": "Goalie Mode was taller than the screen",
              "detail": "Now fits: page height 664 of 664. The match itself still scrolls a little on short phones (decision for Harry/Leo)."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Dribble runs: pass to a team-mate",
              "detail": "Three team-mates with green/amber/red rings (78 / 56 / 11 in 100 arrive). More waves beaten = a better chance (36 m long range → 11 m one-on-one). Runs harder: 33% → 25% cleared. Old version on the switch."
            },
            {
              "title": "Knuckleball (test match)",
              "detail": "Long range 9.5% → 17%. Keeper ends up the wrong way 65% of the time."
            },
            {
              "title": "Power shot with a green timing circle (test match)",
              "detail": "Up to 1.5× pace; long range 9.5% → 20% perfect. Always a laced drive, so it hits the wall on free kicks."
            },
            {
              "title": "Keeper howlers that grow with power (test match)",
              "detail": "Perfect power shot: 0.8% (90 keeper), 2.8% (70), 8.2% (40) — inside the asked-for bands. Backed by Opta errors-leading-to-goals data."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Measured, not played",
              "detail": "Keepers, new shots and dribble passes are measured with scripts; nobody has played them with a finger yet."
            },
            {
              "title": "The match still scrolls a little on short phones",
              "detail": "Locking it cut off the bottom of the pitch. Fix needs a slightly shorter pitch on short phones — a look decision."
            },
            {
              "title": "Dribble team-mates are plain blue shirts; the pass is instant",
              "detail": "No real names/faces, no ball flight to the team-mate."
            },
            {
              "title": "Dribble reward skips the even highlight mix",
              "detail": "Needs Harry's OK."
            },
            {
              "title": "Six database security holes still open",
              "detail": "Fix files written, not run."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Move knuckleball / power shot / howlers into the real game",
              "detail": "Needs Mikey's go-ahead (core engine file, sensitive)."
            },
            {
              "title": "Show the 'always fits' pitch side by side at phone size",
              "detail": "Decision 1 on the page."
            }
          ]
        }
      ]
    },
    {
      "version": "0.27",
      "title": "Mikey's patch notes — Relationships",
      "publishedAt": "2026-10-04T12:00:00Z",
      "updatedAt": "2026-10-04T12:00:00Z",
      "artifactUrl": "https://claude.ai/artifact/26Lh4jWsraDKYSaZZpqWWk",
      "summary": "Relationships rebuilt: bars move slowly (an ordinary 6.0-6.6 game moves nothing, harder near 100, drift to the middle), one game per relationship (Talk to your manager, Woodwork challenge, Signing session, Day off, Shoot an advert), happiness decides how much energy rest gives back, and the Sponsors bar is gone. Injuries switched off until their revamp.",
      "stats": [
        {
          "value": "~20 → never",
          "label": "matches until an average player's bars are all 100"
        },
        {
          "value": "1 → 5",
          "label": "relationship games"
        },
        {
          "value": "0.7× – 1.3×",
          "label": "energy back from rest, by happiness"
        },
        {
          "value": "Off",
          "label": "injuries, until their revamp"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Every relationship game on a test player",
              "detail": "Admin menu → Star Career → Relationship games (/star-relgames-dev)."
            },
            {
              "title": "Relations: no Sponsors bar, marks on Boss and Team",
              "detail": "Relations, after your first game."
            },
            {
              "title": "The four Relations games",
              "detail": "Relations → ▶ on each row, once a week each."
            },
            {
              "title": "Shoot an advert",
              "detail": "Sponsors → Deals → 🎬 on a deal."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "The headline: relationships rebuilt",
          "items": [
            {
              "title": "Bars no longer fill to 100 straight away",
              "detail": "Problem: an average player hit 100 on all three in ~20 matches. Fix: 6.0-6.6 moves nothing, gains shrink near 100, bars drift to the middle. After a season: average B68 T67 F82, good B87 T80 F97 (was all 100)."
            },
            {
              "title": "One game per relationship",
              "detail": "Talk to your manager (boss), Woodwork challenge on the real engine (team), Signing session (fans), Day off (you), Shoot an advert (one sponsor). Win +6 below 40, +4 to 70, +2 to 85; a loss -1 (manager chat -2)."
            },
            {
              "title": "Happiness decides recovery",
              "detail": "Rest days and Rest give 0.7× energy at 0 happiness, 1× at 50, 1.3× at 100."
            },
            {
              "title": "Relations page",
              "detail": "Sponsors bar removed (each brand has its own happiness); marks on Boss and Team; true ? lines (no fan mail)."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Relationship games test page",
              "detail": "/star-relgames-dev: every game on a made-up player."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Injuries switched off",
              "detail": "No match injures you; old-save injuries heal on load. Kept behind one switch for the revamp."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Taps went nowhere in the new games",
              "detail": "The bar's number was stretched over the whole screen; it stays on its bar now."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "No post/bar hit seen yet in the woodwork challenge",
              "detail": "Tested, not yet landed in a browser."
            },
            {
              "title": "Training's Power drill has the zoomed-out camera",
              "detail": "Left for Harry and Leo."
            }
          ]
        }
      ]
    },
    {
      "version": "0.26",
      "title": "Mikey's patch notes — XP rebuilt and the XP Book",
      "publishedAt": "2026-10-03T22:30:00Z",
      "updatedAt": "2026-10-03T22:30:00Z",
      "artifactUrl": "https://claude.ai/artifact/UTFsvaBcLbYJjWmnYtXLHg",
      "summary": "XP rebuilt: no cheap start (levels 1-4 cost 12k/13k/14k), XP by the minute, one rating bonus instead of star man + rating 8+ + hat-trick, cups at your league's multiplier, promotion pays 0.8x the title. Every amount now lives in the XP Book (/admin/star-xp). Plus the 3D garden, National League North/South 2026/27 and Club Data.",
      "stats": [
        {
          "value": "16k → 39k",
          "label": "XP to reach level 4"
        },
        {
          "value": "26 → 31",
          "label": "typical player: match at level 10"
        },
        {
          "value": "8.6× → 3.8×",
          "label": "hat-trick game vs a quiet win"
        },
        {
          "value": "1 page",
          "label": "every XP amount, editable"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "The XP Book",
              "detail": "Admin menu → Star Career → XP Book (/admin/star-xp)."
            },
            {
              "title": "The star bar over your first 10 matches",
              "detail": "Start a new career. Level 2 now needs 12,000 XP."
            },
            {
              "title": "The after-match XP card",
              "detail": "After any match."
            },
            {
              "title": "The 3D garden, into the shop and back",
              "detail": "Home → Garden."
            },
            {
              "title": "Club Data, now 75% filled",
              "detail": "Admin → Club Data (/admin/clubs)."
            },
            {
              "title": "National League North and South 2026/27",
              "detail": "A career in either league."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "The headline: XP rebuilt",
          "items": [
            {
              "title": "No more shooting up the levels at the start",
              "detail": "Problem: a level every match up to about 5. Why: levels 1→4 cost 8,000/4,000/4,000 and every achievement paid 2,400. Fix: 12,000/13,000/14,000; achievements 600/2,400/12,000 by difficulty. Typical player: level 5 at match 11 (was 4), level 10 at match 31 (was 26)."
            },
            {
              "title": "Match XP by the minute, one rating bonus",
              "detail": "10 XP a minute (was 600 play + 360 start), goal 1,200 (was 1,440), assist 840 (was 960), 400 per rating point above 6; hat-trick, star man and rating-8+ bonuses gone. A quiet win 1,320 → 1,660; a hat-trick win 11,400 → 6,260."
            },
            {
              "title": "Multipliers",
              "detail": "North/South ×1, National League ×1.25 (was ×1), Europa ×4 and Conference ×3 (were ×5); a cup tie uses your league's multiplier (was ×4 for everyone)."
            },
            {
              "title": "Promotion",
              "detail": "Win the league: the title XP only (was title + 36,000). Up any other way, play-offs included: 0.8× that league's title XP."
            },
            {
              "title": "Trophies, awards, achievements, fame",
              "detail": "World Cup 400,000, Euros 300,000, Super Cup 65,000; North/South award amounts; achievements by difficulty; Rising Star 9,000, National Name 24,000."
            },
            {
              "title": "Things that paid twice are gone",
              "detail": "Appearance and goal milestones, the 25/50/100-cap steps, a bigger club, skills at 100."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "The XP Book",
              "detail": "Every XP amount on one page: change numbers, mark each item Confirmed or Change it with a note, set each achievement's level, and add ideas for new achievements, records, awards and milestones."
            },
            {
              "title": "The 3D garden, joined to the 3D shop",
              "detail": "Walk round as the same footballer as the shop: stable, horse, trophy cabinet, fountain and bird, gazebo with team-mates, teqball, your cars. The shop's doors join the two."
            },
            {
              "title": "National League North/South 2026/27, Step 3, six-club play-offs",
              "detail": "The 24 clubs given; 1st up, 2nd-7th play off, 21st-24th down to Step 3."
            },
            {
              "title": "Club Data",
              "detail": "Every club and field: given, guessed, missing or researched. 51% → 75% filled; ratings for 67 lower-league clubs; 76 short names."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Shirt number matches between the garden and the 3D shop",
              "detail": "The shop always showed 10; it now reads your number."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Run star_xp_config.sql",
              "detail": "Until then the XP Book saves on that device only and the game uses the built-in amounts."
            },
            {
              "title": "3 star tests fail",
              "detail": "authoredChance, freeKickRules and longRangeRules; they fail on main too."
            }
          ]
        }
      ]
    },
    {
      "version": "0.25",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-03T01:42:00Z",
      "summary": "Live 3D scenes: your own player signs live in 3D, there is a 3D shop to walk round, and the garden is rebuilt. You now play your first game before the tutorials, Play goes straight into the first chance, and the shootout, defenders, full screen and sounds play fairer. Live on knowitball.co.uk from 3 Oct; stills only, so try the rest on the test build.",
      "stats": [
        {
          "value": "15.2 s → 0.5 s",
          "label": "from Play to your first chance"
        },
        {
          "value": "554 → 0",
          "label": "shootouts where both team-mates miss the same way (of 1,660 and 5,000)"
        },
        {
          "value": "31 of 48 → 0",
          "label": "won 50-50s that rolled at the defender's own goal"
        },
        {
          "value": "140 → 37",
          "label": "buttons that make a sound"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "3D signing scene: your player signs live",
              "detail": "Career Settings → 3D signing scene (beta) → sign for a club. Or Play Area → 3D Test Area → Signing"
            },
            {
              "title": "3D shop you can walk round",
              "detail": "Shop page (swipe right from Home) → Walk the 3D shop (beta)"
            },
            {
              "title": "New garden",
              "detail": "Home → Garden"
            },
            {
              "title": "Full goal on Home; no Reputation/Fame words",
              "detail": "Home"
            },
            {
              "title": "Match ball on the title screen; Shop is charcoal",
              "detail": "Title screen; Shop page"
            },
            {
              "title": "First game before the tutorials",
              "detail": "New game → finish the trial"
            },
            {
              "title": "Play goes straight into the first chance",
              "detail": "Home → Play"
            },
            {
              "title": "Scout moment is full screen",
              "detail": "End of the trial"
            },
            {
              "title": "Shootout scorecard; team-mates miss differently",
              "detail": "Trial → penalties"
            },
            {
              "title": "Defender clears the ball away from his own goal",
              "detail": "Any match"
            },
            {
              "title": "Left foot kicks with the left",
              "detail": "New game → Profile → Left foot → a pen or free kick"
            },
            {
              "title": "Different long shots after a restart",
              "detail": "Restart the same match a few times"
            },
            {
              "title": "Settings on the title screen is for this phone only",
              "detail": "Title → Settings"
            },
            {
              "title": "Full screen on iPhone: Add to Home Screen",
              "detail": "Title → Settings → Full screen → How?"
            },
            {
              "title": "Exit career uses the game's own pop-up",
              "detail": "Settings → Exit career"
            },
            {
              "title": "Fewer sounds; quiet taps on iPhone",
              "detail": "Tap round the menus"
            },
            {
              "title": "Boots: new box, level-5 reveal, Buy now",
              "detail": "Shop → Boots"
            },
            {
              "title": "Phone card says what you get and what you need",
              "detail": "Shop → Style → Phone"
            }
          ]
        },
        {
          "kind": "added",
          "title": "Live 3D scenes",
          "items": [
            {
              "title": "The signing is a live 3D scene, and it is your player",
              "detail": "Your skin tone, face picture, club kit and number, and your Store and Star Pass accessories. He picks up the pen, signs, and shakes the manager's hand. About 5 seconds; tap to skip.",
              "pill": {
                "text": "off by default",
                "tone": "amber"
              },
              "more": {
                "summary": "The detail",
                "points": [
                  "Turn it on in Career Settings → 3D signing scene (beta). Off means the old drawn scene.",
                  "The contract shows your real club, number and wage. Hair style and colour are picked on the profile screen; old saves get short brown hair.",
                  "Polish round: the manager is fully dressed from behind, no torn cloth in the handshake, palm meets palm, the face sits on the head, normal arms, a real pen grip.",
                  "Seen in stills at phone size, dark and light skin, in the 3D Test Area. Not yet seen inside a real career."
                ]
              }
            },
            {
              "title": "Walk round a 3D shop",
              "detail": "New button on the Shop page: Walk the 3D shop (beta). Real 3D boots (7) and cars (6); watches and jewellery hang as pictures in light boxes. Tap an item to look at it. Nothing is bought in 3D; 'See it in the shop' takes you to the normal shop.",
              "more": {
                "summary": "How we know",
                "points": [
                  "Seen in stills at phone size."
                ]
              }
            },
            {
              "title": "Left foot or right foot",
              "detail": "The foot you chose now swings the kick. A left-footer runs up from the right of the ball on a penalty or direct free kick. Team-mates and opponents get a fixed foot each; about 1 in 5 are left-footed. Only the picture changes.",
              "pill": {
                "text": "being fixed",
                "tone": "amber"
              },
              "more": {
                "summary": "Status",
                "points": [
                  "Harry said it isn't right. A builder is checking every kick in a real browser; a short clip follows."
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
              "title": "Problem: the start explained every page before you played. You now play your first game first",
              "detail": "New career: League, Stats and Play are open; Training, Relations and Phone are locked. After game 1 the manager wants a word, then Training opens. The Shop opens after the boss meeting and two drills. Every tour is 3 steps or fewer.",
              "more": {
                "summary": "How we know",
                "points": [
                  "Seen in a browser; new tests check the order."
                ]
              }
            },
            {
              "title": "Problem: after Play, the clock walked up slowly before anything happened",
              "detail": "The lines go straight into the commentary and the first chance loads half a second after kick-off. It never jumps past half time.",
              "bars": [
                {
                  "label": "Play to first chance, coming on as a sub",
                  "was": 15.2,
                  "now": 0.5,
                  "state": "good",
                  "unit": " s"
                }
              ],
              "more": {
                "summary": "How we know",
                "points": [
                  "Measured coming on as a sub. Starting the match uses the same code but was not timed."
                ]
              }
            },
            {
              "title": "Problem: a defender 'shot' at his own keeper",
              "detail": "When a defender wins a loose ball, or a rebound hits him, the ball now goes up the pitch. A shot blocked by a defender can still go in at an odd angle, as you asked in v0.15.",
              "bars": [
                {
                  "label": "Won 50-50s that roll at his own goal (of 4,800 chances)",
                  "was": 31,
                  "now": 0,
                  "state": "good"
                },
                {
                  "label": "Blocked rebounds that carry on at the keeper",
                  "was": 27,
                  "now": 0,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "How we know",
                "points": [
                  "Measured over 4,800 chances. Not seen on screen."
                ]
              }
            },
            {
              "title": "Problem: the same long-shot highlight came every restart",
              "detail": "Only a list of recent pictures in the browser stopped repeats, and a full browser store lost it on every reload. Now each visit starts on a different drawing.",
              "bars": [
                {
                  "label": "Different opening long shots in 50 restarts, storage full",
                  "was": 1,
                  "now": 16,
                  "state": "good"
                },
                {
                  "label": "Different opening long shots in 50 restarts, storage working",
                  "was": 6,
                  "now": 18,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "How we know",
                "points": [
                  "Measured in tests. Being checked on screen with real restarts."
                ]
              }
            },
            {
              "title": "Problem: full screen did not work on iPhone",
              "detail": "iPhone Safari does not let a web page go full screen. The way round is Add to Home Screen: the game then opens with no browser bars. Settings → Full screen shows 'How?' with 3 steps. Exit career and Delete career now use the game's own pop-up, which was what knocked you out of full screen.",
              "more": {
                "summary": "How we know",
                "points": [
                  "Seen in a phone-sized browser. Not tried on a real iPhone or Android."
                ]
              }
            },
            {
              "title": "Problem: sounds played too often, and taps were loud on iPhone",
              "detail": "Only green and gold buttons (Continue, Confirm, Play) make a sound. The same sound can't repeat straight away, and no more than 3 start at once. Sound effects off now also mutes the match.",
              "bars": [
                {
                  "label": "Buttons that make a sound",
                  "was": 140,
                  "now": 37,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "How we know",
                "points": [
                  "Rate limit measured (5 quick pops became 1). The iPhone part is worked out, not tried on a phone."
                ]
              }
            },
            {
              "title": "Problem: a tutorial started 13 px above the top of the phone",
              "detail": "If there is no room above or below the thing a tutorial points at, the bubble now sits inside it.",
              "more": {
                "summary": "How we know",
                "points": [
                  "Measured on a stand-in page with the same feed (13 px off screen → 167 px from the top). Not seen on the real reactions screen."
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
              "title": "Shootout: full pitch and a scorecard",
              "detail": "No white card; a scoreboard above the pitch with a tick or cross per kick, the score, who is next and a star on your kick. Team-mates never miss the same way twice.",
              "bars": [
                {
                  "label": "Shootouts where both team-mates miss the same way",
                  "was": 554,
                  "now": 0,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "How we know",
                "points": [
                  "Measured: 554 of 1,660 shootouts before, 0 of 5,000 after."
                ]
              }
            },
            {
              "title": "'A scout has spotted you' is full screen",
              "detail": "A floodlit stadium, the scout, a big headline and 'Tap to carry on'. The offer screen is full screen too, with the club badge."
            },
            {
              "title": "The garden is rebuilt",
              "detail": "Three layered scenes (garden, bench, stable) with real light in day, sunset and night. The house grows with the home you own, team-mates sit on the bench, fairy lights glow at night.",
              "more": {
                "summary": "How we know",
                "points": [
                  "Seen in stills in day, sunset and night at 390×844."
                ]
              }
            },
            {
              "title": "The Phone card says what you get and what you still need",
              "detail": "It lists Social, Messages and App Store. When you can't pay it says how much more and how many weeks: 'You need ★110 more · 2.6 wks of income'. The price itself is not changed."
            },
            {
              "title": "Home: the full goal, and no title words",
              "detail": "The goal is set back where the pitch meets the stands, both posts showing (copying your image 2). Reputation and Fame show the bar and number only."
            },
            {
              "title": "Title screen, Shop and the post-match star bar",
              "detail": "Title: no goal, the match ball at his feet. Shop: calm charcoal instead of green. Post-match star bar: the level number at each end, 1.5× slower."
            },
            {
              "title": "Settings on the title screen is for this phone only",
              "detail": "Only full screen, sound, reactions, skip the line-up, faces, names, player look and Old/New UI. The way out is '← Main menu'."
            },
            {
              "title": "Boots: a new box, a level-5 reveal, and Buy now",
              "detail": "The boot lies in the box, then rises upright facing you. Level 5 gets a gold box, two spotlights and a 'LEVEL 5 · MAX' plate. Every boot has a one-tap Buy now; the basket is switched off."
            },
            {
              "title": "Give-and-go and sponsors",
              "detail": "A forward pass comes back 92 in 100 times, a safe pass 60 in 100. Sponsors open with your first offer, not after 10 games.",
              "more": {
                "summary": "How we know",
                "points": [
                  "Measured in tests."
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
              "title": "The other trial drills still sit on the white card",
              "detail": "Only the shootout lost it."
            },
            {
              "title": "Reputation and Fame words still show on Stats, Reputation and Ownership",
              "detail": "Only Home was asked for."
            },
            {
              "title": "3D signing: handshake fingers are fairly flat",
              "detail": "When he bends to write, the aviators show as thin gold lines; arms are still a little muscular."
            },
            {
              "title": "Three tests fail, the same as before this round",
              "detail": "The drawings check (4 drawings deleted), the free-kick distance check and the long-range team-mate check. 231 of 234 pass."
            },
            {
              "title": "Not on a real phone yet",
              "detail": "Add to Home Screen, iPhone sound, full screen on Android.",
              "pill": {
                "text": "not seen",
                "tone": "amber"
              }
            },
            {
              "title": "Not decided: the unclear points from your recording",
              "detail": "'Spam through this area', 'needs to be bigger', the odd highlight, 'so many errors' in the 3D Test Area, the help-card position, 'numbers gone, says next up', the Star Pass badge reading like a notification, and the white 'Who's free?' card. Say which screen each was on and they go in v0.26."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Your calls and next",
          "items": [
            {
              "title": "The phone price: in National League South it costs ★150, you start with ★0 and earn about ★28 a week",
              "detail": "Options: give ★150 starting money; a cheaper first phone (about ★50); or keep it, with the card saying how long."
            },
            {
              "title": "60 goals in National League South: should the bottom league be this easy?",
              "detail": "Say harder, or leave it."
            },
            {
              "title": "The green bottom bar on Shop pages",
              "detail": "Every page shares it, so it stayed green. Make it charcoal on Shop pages too?"
            },
            {
              "title": "Next",
              "detail": "Left foot and long shots checked on screen with a short clip; the white card off the other trial drills; v0.26 for the unclear points."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/7LXrEgwm72sUVZH5Kcmeyz",
      "updatedAt": null
    },
    {
      "version": "0.24",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-02T22:06:00Z",
      "summary": "Highlights you can win, a reworked trial, and square top bars with 3D icons. Also a new Home with the energy cans under your player, help that opens by itself, a guided first training, unlocks announced one by one, a new title screen, boots on a plank with an unboxing and a basket, a Sound Board admin page, a 3D Test Area and a signing prototype. Everything is from your v0.23.1 review; nothing was live when written.",
      "stats": [
        {
          "value": "6.6% → 0%",
          "label": "tight-angle chances with a defender on the ball (measured)"
        },
        {
          "value": "13° → 6.5°",
          "label": "Take Him On camera swing"
        },
        {
          "value": "6% → 100%",
          "label": "Training Power level 1: pass within 3 tries at Power 40 (measured)"
        },
        {
          "value": "19",
          "label": "game sounds you can replace from one admin page"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Square top bars with a white edge",
              "detail": "Home, Shop, Style → top strip"
            },
            {
              "title": "Can and FULL badge gone; energy bar runs to the end",
              "detail": "Every screen → top strip"
            },
            {
              "title": "Bars slide instead of jumping",
              "detail": "Any bar that changes"
            },
            {
              "title": "3D star, bolt, Earth and smiley over the bars",
              "detail": "Home, Style, Relations → top strip"
            },
            {
              "title": "The star fills gold as you climb the level",
              "detail": "Home → star on the left of the strip"
            },
            {
              "title": "After-match star bar: fills, empties, refills; slower; square",
              "detail": "Play or sim a match → after-match"
            },
            {
              "title": "No defender on the ball at the start of a highlight",
              "detail": "Match on highlights → shooting stage"
            },
            {
              "title": "The give-and-go pass always comes back",
              "detail": "Highlights with a midfield pass"
            },
            {
              "title": "Help cards sit mid-pitch; one tap closes them",
              "detail": "New career → trial → free kick, cones"
            },
            {
              "title": "Trial pop-ups are see-through; tap anywhere",
              "detail": "Trial → any stage"
            },
            {
              "title": "Free kick pauses at the run-up and at the strike",
              "detail": "Trial → free kick"
            },
            {
              "title": "Take Him On: your player is back, camera calmer",
              "detail": "Trial → Take Him On"
            },
            {
              "title": "Take Him On new look: stadium, mown pitch, ball by his boot",
              "detail": "Trial → Take Him On"
            },
            {
              "title": "Find the Pass: five goes, 2.5 s down to 0.5 s",
              "detail": "Trial → Find the Pass"
            },
            {
              "title": "Shootout: team-mates kick first, you win it last",
              "detail": "Trial → penalty shootout"
            },
            {
              "title": "Training Power levels scale to your Power",
              "detail": "Training → Power → levels"
            },
            {
              "title": "Home: bigger player, cans at the bottom, goal behind him",
              "detail": "Home"
            },
            {
              "title": "PLAY AS ST sits in the pitch corner",
              "detail": "Home → Play → line-up"
            },
            {
              "title": "Kick-off page: the teams walk out",
              "detail": "Line-up → Kick off"
            },
            {
              "title": "Star Pass is a round “!” badge",
              "detail": "Home"
            },
            {
              "title": "Help opens by itself the first time on a screen",
              "detail": "Any screen, first visit"
            },
            {
              "title": "Training tutorial, forced Power drill, two drills a session",
              "detail": "First Training visit"
            },
            {
              "title": "Training level stars: three in a row",
              "detail": "Training → levels"
            },
            {
              "title": "First steps list; bottom-left button; shortcut question",
              "detail": "Achievements; Home → bottom-left"
            },
            {
              "title": "Unlocks: Relations and Shop after game 1, Sponsors after 10",
              "detail": "Home, Relations, Shop"
            },
            {
              "title": "Full-time energy tutorial; energy back; reactions tutorial not seen yet",
              "detail": "First match → full time → after-match"
            },
            {
              "title": "Title: logo lower, stadium picture, new goal",
              "detail": "Title screen"
            },
            {
              "title": "Boots on a plank, glass cases on the special pairs",
              "detail": "Shop → Boots"
            },
            {
              "title": "Unboxing when you buy a boot",
              "detail": "Shop → Boots → buy"
            },
            {
              "title": "Basket: up to 3 pairs, Pay for all, Sold out",
              "detail": "Shop → Boots"
            },
            {
              "title": "Sound Board admin page: play, replace, put the original back",
              "detail": "Admin → Sound Board"
            },
            {
              "title": "3D Test Area page",
              "detail": "Admin menu → 3D Test Area"
            },
            {
              "title": "Signing scene prototype",
              "detail": "3D Test Area → Signing"
            },
            {
              "title": "Blender 3D icons",
              "detail": "Top bars"
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "The headline: three things you said were wrong",
          "items": [
            {
              "title": "1. Highlights were impossible: a defender could start right on the ball",
              "detail": "In your first match, 2 of 7 highlights started that way. A defender can no longer start closer than 1.5 m to the ball.",
              "bars": [
                {
                  "label": "Tight angle: defender within 1.5 m of the ball",
                  "was": 6.6,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Cutback: defender within 1.5 m of the ball",
                  "was": 6,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Tight angle where the obvious play works",
                  "was": 97.6,
                  "now": 99.6,
                  "state": "good",
                  "unit": "%",
                  "target": 100
                }
              ],
              "more": {
                "summary": "Why and how we know",
                "points": [
                  "Nothing stopped the game putting a defender closer to the ball than any drawing ever does; the game now uses the drawings' own smallest gap, about 1.6 m.",
                  "Measured on simulated chances, not seen in a real match."
                ]
              }
            },
            {
              "title": "2. The trial: 'They take a pen every single time, the opponents miss in the same exact way and everyone does a Bruno run-up'",
              "detail": "Help cards sit mid-pitch and wait for one tap. Take Him On shows you and the camera is calmer. Find the Pass has five goes. The shootout has team-mates, 10 different paths and a run-up for each taker."
            },
            {
              "title": "3. New top bars",
              "detail": "Every top bar is square with a white edge. The can and FULL badge are gone. A 3D star, bolt, Earth and smiley sit over the left end of each bar. The star fills as you climb the level."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed: highlights and the trial",
          "items": [
            {
              "title": "The give-and-go pass always comes back, with a BACK TO YOU banner",
              "detail": "In a picture with no goal the pass came back only 73 in 100 times and said nothing either way. It is your call: see Your calls.",
              "bars": [
                {
                  "label": "How often the pass comes back to you",
                  "was": 73,
                  "now": 100,
                  "state": "good",
                  "unit": "%"
                }
              ]
            },
            {
              "title": "Help cards sit in the middle of the pitch; one tap closes them",
              "detail": "Before, the card sat at the bottom and play went on under it. Now it is see-through, with a faint 'Tap anywhere to continue', and nothing starts before that."
            },
            {
              "title": "Free kick: a card at the run-up and a second card at the strike",
              "detail": "The game pauses when the run-up starts and again on the strike screen. Each card shows once per device."
            },
            {
              "title": "Take Him On: your player is visible again, and the camera is calmer",
              "detail": "In v0.23 your figure was removed from the drills, which also took it out of Take Him On.",
              "bars": [
                {
                  "label": "Camera swing",
                  "was": 13,
                  "now": 6.5,
                  "state": "good",
                  "unit": "°"
                },
                {
                  "label": "Fastest camera turn",
                  "was": 51,
                  "now": 17,
                  "state": "good",
                  "unit": "°/s"
                }
              ]
            },
            {
              "title": "Find the Pass has five goes, each shorter than the last",
              "detail": "2.5, 2, 1.5, 1 and 0.5 seconds (before: one go of 2.5 s)."
            },
            {
              "title": "Penalty shootout: team-mates take your first two kicks, you take the last and win it",
              "detail": "10 different ways to reach your kick, and the score before it is 0-0, 1-1 or 2-2. Each taker has his own run-up and his name shows. It stays 3 kicks each."
            },
            {
              "title": "Training Power: level 1 is an open goal, and every level scales to your Power",
              "detail": "Levels 1 and 2 are an open goal; a keeper joins from level 3, defenders from level 5.",
              "bars": [
                {
                  "label": "Level 1: pass within 3 tries (Power 40)",
                  "was": 6,
                  "now": 100,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Level 3",
                  "was": 48,
                  "now": 86,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Level 5",
                  "was": 20,
                  "now": 48,
                  "state": "good",
                  "unit": "%"
                }
              ]
            },
            {
              "title": "Trial pop-ups: see-through card, no GOT IT button, a faint 'Tap anywhere to continue'",
              "detail": "The free-kick card now reads 'There is no way through the wall.'"
            },
            {
              "title": "Take Him On has a new look: a stadium, a mown pitch, and the ball by his boot",
              "detail": "The ball no longer draws on his body.",
              "bars": [
                {
                  "label": "Frames where the ball draws on his body",
                  "was": 55,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ]
            },
            {
              "title": "After-match star bar: fills to the end, empties, fills again. Slower and square",
              "detail": "Before, a level-up slid the bar backwards, so it looked like you lost rating. Measured on the bar: 70% → 99% → 0% → 35%, over about 2 seconds."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Home, match day, tutorials and unlocks",
          "items": [
            {
              "title": "Top bars: square with a white edge, the can and FULL badge gone, bars slide, 3D icons over them",
              "detail": "The energy cans move to the bottom of Home. The star fills gold with your progress through the level (20% through is 20% full)."
            },
            {
              "title": "Home: a bigger player, the cans under him, the new goal behind him",
              "detail": "The goal stands back where the pitch meets the stands. The sky is sunset by default, day only for 12:30 kick-offs and night only after dark (400 August Saturdays: 342 sunset, 58 day)."
            },
            {
              "title": "PLAY AS ST sits in the pitch corner by the keeper, not on the VS"
            },
            {
              "title": "A new look for the page before kick-off: the teams walk out",
              "detail": "A tunnel view with both crests; the duplicate KICK OFF row is gone."
            },
            {
              "title": "The Star Pass red square is now a round glossy '!' badge"
            },
            {
              "title": "Help opens by itself the first time you visit a screen",
              "detail": "13 screens; it starts with that screen's top bar. The ? stays so you can replay it."
            },
            {
              "title": "Training tutorial: no Skip, a forced Power drill, help inside the drill, then one more drill",
              "detail": "After the second drill: 'Training done. Next: the match.'"
            },
            {
              "title": "Training level stars: three in a row, filling left to right"
            },
            {
              "title": "First steps: a list on Achievements, and the bottom-left button follows your progress",
              "detail": "Two drills, first game, meet your boss, buy a phone, each with a Go button. When done, Home asks 'Switch this to League as a shortcut?'"
            },
            {
              "title": "Unlocks: Relations and Shop after game 1, Sponsors after 10 games",
              "detail": "Each unlock shows a pop-up, then 'See all achievements', then Go, then that feature's own tour."
            },
            {
              "title": "First match: energy explained at full time, '+N energy back' on Home, and the reactions explained",
              "pill": {
                "text": "not seen in a browser",
                "tone": "amber"
              }
            },
            {
              "title": "Title screen: logo lower, a stadium behind, a new goal, the player higher"
            },
            {
              "title": "Boots on a wooden plank, no card outlines, the special pairs in glass cases"
            },
            {
              "title": "Buying a boot opens a box: it drops, the lid flies off, the boot rises",
              "detail": "About 1.7 seconds; a tap skips it.",
              "pill": {
                "text": "stills only",
                "tone": "amber"
              }
            },
            {
              "title": "Basket: the boot flies in, up to 3 pairs, 'Pay for all', and the shelf shows Sold out",
              "detail": "Style items cannot go in the basket yet."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "A Sound Board admin page: play each sound, replace it, or put the original back",
              "detail": "At /admin/sound-board. It lists all 19 game sounds; replace with mp3, wav, ogg, m4a, aac or webm under 2 MB. 10 of the 19 are not in the game yet (kicks, goal net, keeper save, crowd, whistles)."
            },
            {
              "title": "A 3D Test Area page: every cutscene and 3D area in one list, and a store of the Blender files",
              "detail": "8 scenes and 250 files in 14 folders. The match view with Blender players is one mock-up picture only."
            },
            {
              "title": "Signing scene prototype: you sit across the desk, the contract turns to you, and you sign",
              "detail": "Five lines of talk, a SIGNED stamp, 3 skin tones. Not wired into the career."
            },
            {
              "title": "3D icons made in Blender: bolt, Earth, crown, smiley, coin, heart and star"
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "The signing prototype has weak spots",
              "detail": "The 'superhero' build shows through the suit, the pen floats near the hand, there is no handshake and thick black bars sit above and below the picture."
            },
            {
              "title": "Style items cannot go in the basket",
              "pill": {
                "text": "not done",
                "tone": "amber"
              }
            },
            {
              "title": "10 of 19 sounds are not in the game",
              "detail": "Putting them in the match needs Mikey's yes."
            },
            {
              "title": "Box Room and Shared Flat still read as a block of three",
              "detail": "Carried from v0.23.1.",
              "pill": {
                "text": "half fixed",
                "tone": "amber"
              }
            },
            {
              "title": "Horses have one pose per level",
              "detail": "Carried from v0.23.1."
            },
            {
              "title": "Not seen live",
              "detail": "Highlights (measured only), the unboxing (single frames), Sound Board upload, sound itself, two highlight clips, and the full-time energy tutorial, after-match pop-ups and reactions tutorial (not seen in a browser)."
            },
            {
              "title": "3 tests were already failing",
              "detail": "authoredChance, freeKickRules and longRangeRules fail on main and failed before this round."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Your calls and next",
          "items": [
            {
              "title": "Should the give-and-go always come back? Default yes.",
              "detail": "Other: bring back the old 73-in-100 chance."
            },
            {
              "title": "A basket for Style items too? Default later."
            },
            {
              "title": "Is the Training Power shape right? Default yes.",
              "detail": "Open goal for levels 1-2, a keeper from 3, defenders from 5."
            },
            {
              "title": "Put the 10 missing sounds in the match next?",
              "detail": "Needs Mikey's yes. Default next version."
            },
            {
              "title": "Are the unlock numbers right?",
              "detail": "Sponsors after 10 games, Relations and Shop after game 1."
            },
            {
              "title": "Wire the signing scene into the career next? Default not yet."
            },
            {
              "title": "Next",
              "detail": "Do all the Higgsfield pictures in one go; the full shop redesign (later); wire the signing scene into the career and build the match view with Blender players."
            }
          ]
        },
        {
          "kind": "history",
          "title": "Previous versions",
          "items": [
            {
              "title": "v0.23.1: liquid bars, signing and title look, sounds",
              "detail": "Smooth glowing bars, quieter arrows, Home bottom-left; a ? on Style, Settings and Shop; tap anywhere to start the match; boss meeting win +3, loss −2; contract paper; smaller starter house; Blender pictures in the Store; sound effects outside the match. Still open: Box Room and Shared Flat read as three flats; horses have one pose."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/CQ5gkXrcPk2gptL1EjX3au",
      "updatedAt": null
    },
    {
      "version": "0.23.1",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-01T20:05:00Z",
      "summary": "Fixes from your v0.23 review: liquid bars, a quieter look, a simple way home, a nicer signing and title screen, a smaller starter house, and sounds. Filmed once on one combined copy: every Before is v0.23 and every After is v0.23.1. Nothing was live.",
      "stats": [
        {
          "value": "−4 → −2",
          "label": "lost boss meeting (measured: 50 → 46 became 50 → 48)"
        },
        {
          "value": "3 + 9",
          "label": "sounds remade, and sounds now played outside the match"
        },
        {
          "value": "23",
          "label": "before and after clips of the game, plus shop stills"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Smooth glowing star and energy bars",
              "detail": "Home → top strip"
            },
            {
              "title": "Quieter bottom arrows",
              "detail": "Home, Stats, Shop → bottom corners"
            },
            {
              "title": "Heavy font only on titles and big numbers",
              "detail": "League, Stats, lists"
            },
            {
              "title": "Home bottom-left, Achievements as a ⭐ on Home",
              "detail": "Home → bottom-left and the ⭐ link"
            },
            {
              "title": "Each screen shows its own bar",
              "detail": "Relations, Style → top strip"
            },
            {
              "title": "? on Style, Settings and Shop",
              "detail": "Top bar → ?"
            },
            {
              "title": "Settings: compact switches, Sound effects, no Live scores",
              "detail": "Settings → Game"
            },
            {
              "title": "Line-up: tap anywhere to start. Bolts yellow, orange, red.",
              "detail": "Home → Play → line-up"
            },
            {
              "title": "Skip the line-up setting",
              "detail": "Settings → Game → Skip the line-up"
            },
            {
              "title": "After-match star bar, no numbers; achievement and record pop-ups",
              "detail": "Play a match → after-match; Home"
            },
            {
              "title": "Boss meeting win +3, loss −2",
              "detail": "Relations → boss meeting"
            },
            {
              "title": "Two set-piece chats, penalty then free kick",
              "detail": "Home → after your first match"
            },
            {
              "title": "Training level squares: bigger stars, smaller numbers",
              "detail": "Training → Technique → levels"
            },
            {
              "title": "Signing: contract paper with the full terms, varied manager faces",
              "detail": "Transfer signing → the desk"
            },
            {
              "title": "Title screen: smaller net, logo on one line, floodlights, Tutorial",
              "detail": "Title screen"
            },
            {
              "title": "Smaller starter house",
              "detail": "Shop → Style → Homes → Suburban House"
            },
            {
              "title": "Smaller boots on the shelf",
              "detail": "Shop → Boots"
            },
            {
              "title": "Suit, silver chain, diamond necklace and stable horses redone",
              "detail": "Shop → Style → item sheets"
            },
            {
              "title": "Blender pictures in the Store tabs",
              "detail": "Store → Coins, Accessories, Boots"
            },
            {
              "title": "Sound effects outside the match, with a Settings switch",
              "detail": "Settings → Game → Sound effects"
            },
            {
              "title": "Achievement and record pop-ups on Home",
              "detail": "Home → after earning one"
            },
            {
              "title": "Grass behind the match card kept as it was",
              "detail": "Match opening (unchanged: Harry prefers it)"
            },
            {
              "title": "Bolts yellow, orange, red",
              "detail": "Match → energy bolts"
            },
            {
              "title": "Live scores moved to League",
              "detail": "League → bell"
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Look and flow",
          "items": [
            {
              "title": "Home: smooth glowing bars, quieter arrows, Home bottom-left",
              "detail": "Star rating and energy are one smooth bar each (they were ticked yellow blocks). Bottom-left is Home (it was Achievements, so there was no way home); Achievements is now a ⭐ link on Home. The heavy font is only on titles and big numbers."
            },
            {
              "title": "Each screen shows its own bar",
              "detail": "Relations shows happiness, Style shows reputation, every other screen shows star rating. Energy is always on the right."
            },
            {
              "title": "A ? on Style, Settings and Shop",
              "detail": "Tap it and a short pointer tour explains the screen."
            },
            {
              "title": "Settings is one card of small switches",
              "detail": "Full screen, post-match reactions, skip the line-up, sound effects, player faces and player names. Live scores moved to the bell on the League page."
            },
            {
              "title": "Line-up: tap anywhere to start the match",
              "detail": "Before, the line-up started the match by itself after about 4 seconds. The bolt buttons are yellow, orange and red. The grass behind the match card is kept as it was."
            },
            {
              "title": "New switch: Skip the line-up",
              "detail": "Play goes straight to the match."
            },
            {
              "title": "After the match: a Star rating bar with no numbers",
              "detail": "Achievement pop-ups also come up on Home, and for records broken (furthest goal or assist, most goals in a match or season, Premier League records). Seen in a test page, not yet in a full match."
            },
            {
              "title": "Boss meeting: win +3, loss −2",
              "detail": "Lost meeting: −4 became −2 (50 → 46 became 50 → 48). Win is +3 (tested, not filmed).",
              "bars": [
                {
                  "label": "Points lost on a failed boss meeting",
                  "was": 4,
                  "now": 2,
                  "state": "good"
                }
              ]
            },
            {
              "title": "Two separate set-piece chats",
              "detail": "The manager talks about penalties first, on its own; the free-kick chat comes after a later match."
            },
            {
              "title": "Training levels: big stars, small numbers"
            },
            {
              "title": "Signing: a real contract paper, and different manager faces",
              "detail": "The paper lists length, wage, shirt, position and every bonus. Managers get varied drawn faces from a list made from memory: please check a few."
            },
            {
              "title": "Title screen: logo on one line, floodlights, Tutorial button",
              "detail": "With a save the Tutorial button replays the pointer tour on Home; with no save it starts a new career."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Shop pictures and sounds",
          "items": [
            {
              "title": "Starter house is smaller",
              "detail": "The first house was a row of three big houses; it is now one small tired two-up-two-down with a yard."
            },
            {
              "title": "Boots on the shelf are smaller",
              "detail": "About three-quarters of the card width, so they sit inside their cards."
            },
            {
              "title": "Suit, silver chain, diamond necklace and stable horses redone",
              "detail": "A proper jacket on a display form; chunky chain links; stones that keep their facets; real horses in tighter paddocks."
            },
            {
              "title": "The Store has Blender pictures",
              "detail": "Coin packs, the two boosts, ten accessories and three accessory boots. The Boots tab shows the same boots as the shop shelf."
            },
            {
              "title": "Sounds: three remade, nine played outside the match",
              "detail": "Coin-in, star-tick and achievement-pop were remade. Button taps and confirms, level-up, breaking news, phone notification and can-open now play outside the match. Settings → Game → Sound effects turns them off; the Old UI stays silent.",
              "pill": {
                "text": "not filmable",
                "tone": "amber"
              }
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "3 tests were already failing",
              "detail": "authoredChance, freeKickRules and longRangeRules failed before this round and still do."
            },
            {
              "title": "Box Room and Shared Flat still read as a block of three",
              "detail": "The starter house is fixed; these two are not.",
              "pill": {
                "text": "half fixed",
                "tone": "amber"
              }
            },
            {
              "title": "Horses have one pose per level"
            },
            {
              "title": "Not seen live",
              "detail": "Sound, the boss-meeting win (tested, not filmed), the free-kick chat (from a seeded save), and the shop pictures (stills from the shop test page)."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Your calls",
          "items": [
            {
              "title": "Home bottom-left on older saves? Built for new-style careers only. Default no."
            },
            {
              "title": "Liquid bars on every bar, or only star rating and energy? Default all."
            },
            {
              "title": "Is 'gold suit' right as suit level 5? Default yes."
            },
            {
              "title": "The Tutorial button on the title: replay with a save, new career without. Right?"
            },
            {
              "title": "Do the manager faces look right? Default fine."
            },
            {
              "title": "Shootout: 3 kicks each (about 42 s) or 2 each (about 28 s)? Default 3."
            },
            {
              "title": "The shootout is rigged so Academy never lead and you take the last kick. OK? Default yes."
            },
            {
              "title": "Want the legs back in Take Him On and Find the Pass? Default as now."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/8wzaQV41ZmrhtBXZV46Rav",
      "updatedAt": null
    },
    {
      "version": "0.23",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-01T18:10:00Z",
      "summary": "Harry's HUGE UPDATES review, built as test copies and filmed. Home and every screen now look like an app, National League North and South are playable, a new career starts with a scout and a pointer tutorial, the trial is half as long, and every shop picture is a Blender render. Settings has an Old UI / New UI switch. Nothing was live.",
      "stats": [
        {
          "value": "0 px",
          "label": "Home scroll at 360×640, 375×667 and 390×844, with the new 46 px top strip"
        },
        {
          "value": "5 → 7",
          "label": "playable divisions: 48 real non-league clubs in North and South"
        },
        {
          "value": "126 → 30 px",
          "label": "Stats tab rows: three rows now one arrow row"
        },
        {
          "value": "3 → 1",
          "label": "taps from Home to the match (was Play, Team sheets, Kick Off)"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Top HUD on Home",
              "detail": "Home → top strip"
            },
            {
              "title": "Home still fits one screen",
              "detail": "Home on a small phone (no scroll)"
            },
            {
              "title": "Next match back, mini league under it",
              "detail": "Home → under the player"
            },
            {
              "title": "You on a pitch, goal behind",
              "detail": "Home → the player"
            },
            {
              "title": "Spin and celebrate",
              "detail": "Home → drag or tap the player"
            },
            {
              "title": "Can: USE, or BUY when you have none",
              "detail": "Home → can beside the energy bar"
            },
            {
              "title": "Can button with none left",
              "detail": "Home → can with none left"
            },
            {
              "title": "HUD changes per screen",
              "detail": "Stats, League, Training, Relations, Shop → top strip"
            },
            {
              "title": "One heavy font",
              "detail": "Any screen → bold labels"
            },
            {
              "title": "Square bars",
              "detail": "Training, Relations → bars"
            },
            {
              "title": "Sponsors: a small arrow",
              "detail": "Home → bottom right"
            },
            {
              "title": "Pitch look: Home blends",
              "detail": "Settings → Pitch look → Home"
            },
            {
              "title": "Pitch look: team sheet",
              "detail": "Pitch look → team sheet"
            },
            {
              "title": "Your figure only on penalties and free kicks",
              "detail": "New career → trial → run, gate, find the pass"
            },
            {
              "title": "Technique drill without the penalty box",
              "detail": "Trial → technique (gate) drill"
            },
            {
              "title": "Find the Pass back as the 5th drill",
              "detail": "Trial → 4th of 5 drills"
            },
            {
              "title": "One attempt per drill",
              "detail": "Trial → every drill"
            },
            {
              "title": "Rigged Trialist v Academy shootout, up to 3 kicks each",
              "detail": "Trial → last stage"
            },
            {
              "title": "'A scout has spotted you', no score, no No contract",
              "detail": "New career → end of the trial"
            },
            {
              "title": "Light, basic cards",
              "detail": "Trial → countdown and score cards"
            },
            {
              "title": "Whole trial shorter",
              "detail": "New career → whole trial"
            },
            {
              "title": "National League North and South become playable",
              "detail": "Career → League table, bottom divisions"
            },
            {
              "title": "Stats: three tab rows become one row of arrows",
              "detail": "Stats → top row"
            },
            {
              "title": "Style: no title, no Back, no My stuff, bottom bar",
              "detail": "Shop → Style"
            },
            {
              "title": "Relations: no text, square animated bars, a ? on each",
              "detail": "Relations"
            },
            {
              "title": "Phone: a home bar instead of the Close pill",
              "detail": "Phone → bottom of the phone"
            },
            {
              "title": "Phone: the red dot shows only while something is unread",
              "detail": "Home → Phone button"
            },
            {
              "title": "Phone: empty pages are not blank, missing apps are blacked out",
              "detail": "Phone → Social, Fixtures, Messages"
            },
            {
              "title": "Pre-match: Play goes to a line-up animation, then the match",
              "detail": "Home → Play"
            },
            {
              "title": "Match opening: a pitch, not a black box",
              "detail": "Match → first seconds"
            },
            {
              "title": "Bolt buttons: green, yellow, red",
              "detail": "Match → energy bolts"
            },
            {
              "title": "Run-ups move to a Play style section",
              "detail": "Settings → Play style"
            },
            {
              "title": "Energy HUD on the shop pages, Store, Casino and Settings",
              "detail": "Shop pages, Store, Casino, Settings → top"
            },
            {
              "title": "Pointer tutorial, new career",
              "detail": "New career → first screen"
            },
            {
              "title": "Pointers after the two drills",
              "detail": "New career → after the two drills"
            },
            {
              "title": "Help button (?)",
              "detail": "Any main screen → ? beside settings"
            },
            {
              "title": "Post-match in order",
              "detail": "Play a match → after-match"
            },
            {
              "title": "Breaking news is a full-screen TV page",
              "detail": "After signing, first goal, trophy"
            },
            {
              "title": "Manager tells you about set pieces",
              "detail": "After your first match → manager chat"
            },
            {
              "title": "The phone",
              "detail": "Shop → Style → Gadgets"
            },
            {
              "title": "A broken phone locks the Phone button until you repair it",
              "detail": "Home → Phone button (after two seasons)"
            },
            {
              "title": "App Store prices",
              "detail": "Phone → App Store"
            },
            {
              "title": "Boss meeting loss",
              "detail": "Relations → boss meeting"
            },
            {
              "title": "Star rating popup",
              "detail": "Tap the star rating"
            },
            {
              "title": "Star Pass is a scrolling strip of levels",
              "detail": "Tap the star rating → Star Pass"
            },
            {
              "title": "Training: no explanation lines",
              "detail": "Training"
            },
            {
              "title": "Match tab: no penalty note",
              "detail": "Pre-match → Match tab"
            },
            {
              "title": "Every shop picture is a Blender render",
              "detail": "Shop → every Style tab, My stuff"
            },
            {
              "title": "Item sheet shows renders at every level",
              "detail": "Shop → tap an item → all five levels"
            },
            {
              "title": "Boots shelf with rendered boots",
              "detail": "Shop → Boots shelf"
            },
            {
              "title": "Signing scene: no real face on the manager",
              "detail": "Transfer signing → the manager"
            },
            {
              "title": "League page: fixtures, results, table and scout on one page",
              "detail": "Home → League"
            },
            {
              "title": "Bell in the middle of the bottom bar",
              "detail": "League → bottom bar"
            },
            {
              "title": "Play as: the position picker is back on the line-up",
              "detail": "Home → Play → line-up"
            },
            {
              "title": "League page has a ?",
              "detail": "League → beside the page name"
            },
            {
              "title": "Title screen like NSS, in our own style",
              "detail": "Title screen"
            },
            {
              "title": "Title screen clear of the menu on narrow phones",
              "detail": "Title screen on a small phone"
            },
            {
              "title": "Training screens use the pitch look in both looks",
              "detail": "Training"
            },
            {
              "title": "Match screen chrome uses the pitch look in both looks",
              "detail": "Match → scoreboard and buttons"
            },
            {
              "title": "The trial ends with 'a scout has spotted you'",
              "detail": "New career → end of the trial"
            },
            {
              "title": "The star rating can go down",
              "detail": "Measured only: no screen change"
            },
            {
              "title": "Settings → UI: Old | New",
              "detail": "Settings → UI"
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "The headline: Home and the whole look, like an app and not a website",
          "items": [
            {
              "title": "Problem: 'On the phone it looks so much worse.' Every screen had its own header, thin rounded bars, floating dark cards and a different font",
              "detail": "Home is now the one from your screenshot: you stand bottom-left in front of the goal, stat cards to your right, a mini league table and the next match on top. One top bar and star/energy strip on every screen, small arrows at the bottom, one heavy font, square bars, a lighter green. Nothing scrolls on three phone sizes.",
              "bars": [
                {
                  "label": "Home scroll at 390×844 (px)",
                  "was": 302,
                  "now": 0,
                  "state": "good",
                  "unit": " px"
                },
                {
                  "label": "Home scroll at 375×667 (px)",
                  "was": 479,
                  "now": 0,
                  "state": "good",
                  "unit": " px"
                },
                {
                  "label": "Home scroll at 360×640 (px)",
                  "was": 506,
                  "now": 0,
                  "state": "good",
                  "unit": " px"
                }
              ]
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Home and the new look",
          "items": [
            {
              "title": "Lighter green on every screen",
              "detail": "Grass #22763f / #1b6232 → #2c8a4b / #257a41; page darkening 42% → 18%. One change in the shared colours, so every screen follows."
            },
            {
              "title": "Top strip on all 11 screens",
              "detail": "Before, the strip sat at 102, 151 or 152 px, 34 or 54 px tall."
            },
            {
              "title": "Spin and celebrate",
              "detail": "Drag the player to turn him 360°; tap for one of 5 celebrations."
            },
            {
              "title": "Can: USE, or BUY when you have none",
              "detail": "2 cans: USE (55 → 100); 0 cans: BUY opens the cans shop."
            },
            {
              "title": "Sponsors is a small arrow at the bottom right"
            },
            {
              "title": "Pitch look: Home blends, and the team sheet is one pitch, not two"
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "The trial: half as long, and a scout at the end",
          "items": [
            {
              "title": "Your figure only on penalties and free kicks",
              "detail": "The run, gate and find-the-pass drills drew your figure although they only test the ball."
            },
            {
              "title": "Technique drill without the penalty box"
            },
            {
              "title": "One attempt per drill",
              "detail": "Free kick 3 → 1, gate 3 → 1, find the pass 6 → 1, run 3 waves → 2 waves."
            },
            {
              "title": "A rigged Trialist v Academy shootout, up to 3 kicks each",
              "detail": "Their kicks are rigged: 0 of 600 rigged misses went in, 599 of 600 rigged goals did."
            },
            {
              "title": "'A scout has spotted you', no score, no No-contract card",
              "detail": "The trial ends on one white scout card."
            },
            {
              "title": "Light, basic cards instead of dark rounded ones"
            },
            {
              "title": "The whole trial is shorter",
              "detail": "Bot, start to the scout card.",
              "bars": [
                {
                  "label": "Trial time (s)",
                  "was": 163,
                  "now": 75.8,
                  "state": "good",
                  "unit": " s"
                }
              ],
              "more": {
                "summary": "How it was measured",
                "points": [
                  "Before: 163 s or more, and Five-a-side unfinished, so the real time is longer. Same bot, final merged copy."
                ]
              }
            }
          ]
        },
        {
          "kind": "added",
          "title": "Non-League North and South, and the Old UI switch",
          "items": [
            {
              "title": "National League North and South become playable",
              "detail": "Playable divisions 5 → 7. 24 clubs each, 46 games, real 2025/26 members. 2 up from each region; 4 down from the National League, split two and two by where the ground is. Nobody goes down out of North/South.",
              "more": {
                "summary": "The detail",
                "points": [
                  "Squads are generated, average 52 (National League 55). Wages are the National League floor. Relegation from the National League no longer forces a move to a new club.",
                  "20 seasons played from each region: sizes stay 20/24/24/24/24/24/24, nobody doubled up."
                ]
              }
            },
            {
              "title": "Settings → UI: Old | New",
              "detail": "Old is today's game exactly: 11 screens at 0.00% of pixels different from branch Harry at 390×844 (53% before the fixes). New is v0.23. New players get New; saves carry across both ways."
            },
            {
              "title": "A scout places you: 'a scout has spotted you'",
              "detail": "Scored the last penalty: 50% National League, 25% North, 25% South; missed: 20 / 40 / 40 (measured over 40,000 each)."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Screens",
          "items": [
            {
              "title": "Stats: three tab rows become one row of arrows",
              "detail": "126 px → 30 px; first table row 501 px → 173 px down."
            },
            {
              "title": "Style: no title, no Back, no My stuff, a bottom bar",
              "detail": "First item 294 px → 129 px down."
            },
            {
              "title": "Relations: no text, square animated bars, a ? on each",
              "detail": "No scroll; Fame row at 506 px instead of off screen at 1022 px."
            },
            {
              "title": "Phone: a home bar instead of the Close pill; a red dot while something is unread; blacked-out apps and empty pages"
            },
            {
              "title": "Pre-match: Play goes to a line-up animation, then the match",
              "detail": "3 taps → 1."
            },
            {
              "title": "Match opening is a pitch, not a black box"
            },
            {
              "title": "Bolt buttons run green, yellow, red",
              "detail": "Red is the most intense."
            },
            {
              "title": "Run-ups move to a Play style section in Settings"
            },
            {
              "title": "Energy HUD on the shop pages, Store, Casino and Settings",
              "detail": "No energy on 5 screens → energy and money strip on all of them."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Tutorial, help and after-match",
          "items": [
            {
              "title": "Pointer tutorial for a new career",
              "detail": "4 'This is…' cards → 5 pointers on the real screen (Home, your player, star rating, energy, Go to training)."
            },
            {
              "title": "Pointers after the two drills",
              "detail": "League unlocked, Your league, then 'To earn coins, play your first game'. The Shop opens after the first game."
            },
            {
              "title": "A help button (?)",
              "detail": "Replays that screen's pointers on Home, Stats, Shop, Training, Relations and League."
            },
            {
              "title": "Post-match in order",
              "detail": "Star bar rises (no text), rating, relationships, pay, achievements one at a time."
            },
            {
              "title": "Breaking news is a full-screen TV page",
              "detail": "Seen for the first goal; signing and trophy are wired but not filmed."
            },
            {
              "title": "The manager tells you about set pieces, once",
              "detail": "Penalty and free-kick lines on the Match tab and Training card are gone."
            },
            {
              "title": "The phone: one phone, ★150, lasts 2 seasons",
              "detail": "A broken phone locks the Phone button until you repair it in Style (★150). The App Store has 7 apps priced ★1k to ★15k."
            },
            {
              "title": "Boss meeting: a loss costs 4 (50 → 46)",
              "detail": "Before, a lost meeting gave +4."
            },
            {
              "title": "Star rating popup is the Star Pass: a scrolling strip of levels",
              "detail": "The gold 'What it's for' box is gone."
            },
            {
              "title": "Training: no explanation lines. Match tab: no penalty note"
            }
          ]
        },
        {
          "kind": "added",
          "title": "Shop pictures in Blender",
          "items": [
            {
              "title": "Every shop picture is a Blender render: 186 pictures",
              "detail": "Every Style item at 5 levels, plus all 7 boots at 5 levels. Style shop pictures: 155 drawings → 151 renders. Weakest, still in: the gold suit, chains and necklaces, the horses, and the phone and tablet screens."
            },
            {
              "title": "Signing scene: no real face on the manager",
              "detail": "Real faces on the signing figures: 2 → 1 (only yours)."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "League page, title screen and pitch look",
          "items": [
            {
              "title": "League page: fixtures, results, table and scout on one page",
              "detail": "First club row 352 px → 202 px; bells on every game of the next 5 weeks."
            },
            {
              "title": "A bell in the middle of the bottom bar",
              "detail": "Live-score clubs: only in Settings → one tap."
            },
            {
              "title": "Play as: the position picker is back on the line-up",
              "detail": "ST / CAM / LW / RW."
            },
            {
              "title": "Title screen like NSS, in our own style",
              "detail": "Net behind, pitch, ball, you on the left, menu flush right; checked clear of the menu at 360 px."
            },
            {
              "title": "Training and match screens use the pitch look in both looks"
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Game rules",
          "items": [
            {
              "title": "The star rating can go down",
              "detail": "Five poor matches in a row (rating under 5.5) costs a level. Measured on 20 played careers per row.",
              "bars": [
                {
                  "label": "A struggling player (avg 5.7): level after 92 matches",
                  "was": 10,
                  "now": 3,
                  "state": "good"
                },
                {
                  "label": "5 poor matches from level 8: level after",
                  "was": 8,
                  "now": 7,
                  "state": "good"
                },
                {
                  "label": "15 poor matches from level 8: level after",
                  "was": 9,
                  "now": 5,
                  "state": "good"
                },
                {
                  "label": "A rising player (avg 7.3): level after 92 matches",
                  "was": 13,
                  "now": 13,
                  "state": "warn"
                }
              ]
            }
          ]
        },
        {
          "kind": "next",
          "title": "Your calls and still working",
          "items": [
            {
              "title": "Scouted start odds: scored = 50 / 25 / 25, missed = 20 / 40 / 40. Default yes."
            },
            {
              "title": "Star rating can drop: five poor matches in a row costs a level. Default yes."
            },
            {
              "title": "Team sheet: the line-up animation IS the team sheet and kicks off by itself after 3.8 s. Default animation."
            },
            {
              "title": "Where should the Play as picker live? Default on the line-up."
            },
            {
              "title": "Nobody is relegated out of North/South. Default yes."
            },
            {
              "title": "Low-energy prompt under 65. Default 65."
            },
            {
              "title": "Old UI shows the star rating ÷10 as before. Default keep."
            },
            {
              "title": "Inside a match the Old UI keeps the old energy-icon colours. Right line? Default yes."
            },
            {
              "title": "Still working",
              "detail": "Gameplay look and the 3D walk-around (v0.24); sound effects (19 made, not wired in)."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/HBE3svQRyVBbVcUMWjMW1g",
      "updatedAt": null
    },
    {
      "version": "0.22",
      "title": "Harry's patch notes",
      "publishedAt": "2026-10-01T11:15:00Z",
      "summary": "UI & Home: Harry's review of the home screen, built as test copies and filmed. Home fits one phone screen with no scrolling on three phone sizes, a new career unlocks the game step by step, and there is a green Pitch look to try. Nothing was live.",
      "stats": [
        {
          "value": "105 → 0 px",
          "label": "Home scroll at 390×844 (197 px spare)"
        },
        {
          "value": "282 → 0 px",
          "label": "Home scroll at 375×667 (20 px spare)"
        },
        {
          "value": "309 → 0 px",
          "label": "Home scroll at 360×640 (8 px spare)"
        },
        {
          "value": "138 → 0 px",
          "label": "Kick Off scroll on the team sheet"
        },
        {
          "value": "+18 → +2",
          "label": "boss meeting win, the most you can now get"
        },
        {
          "value": "+4 → −8",
          "label": "boss meeting loss"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Home fits one phone screen",
              "detail": "Home → bottom, at 390×844, 375×667 and 360×640"
            },
            {
              "title": "Dressing-room player card",
              "detail": "Home → player card"
            },
            {
              "title": "Energy and one can inside the card",
              "detail": "Home → energy row"
            },
            {
              "title": "Next match as one thin line",
              "detail": "Home"
            },
            {
              "title": "One money chip in the top bar",
              "detail": "League, Training, Relations, Shop"
            },
            {
              "title": "3D / 2D moves to Settings",
              "detail": "Settings → Player look"
            },
            {
              "title": "Sponsors pill off Home",
              "detail": "Home; the Shop tile stays"
            },
            {
              "title": "Relations page: calmer, one line each",
              "detail": "Relations"
            },
            {
              "title": "Phone: a Close phone button",
              "detail": "Phone → bottom"
            },
            {
              "title": "Red dot on the Phone button removed",
              "detail": "Home → Phone button"
            },
            {
              "title": "Pre-match at 100% energy: only sharpness and energy",
              "detail": "Pre-match → Match tab"
            },
            {
              "title": "Team sheet: Kick Off always on screen",
              "detail": "Team sheet"
            },
            {
              "title": "Match opening: no empty black panel",
              "detail": "Match → first seconds"
            },
            {
              "title": "Stats: the league card is one button",
              "detail": "Stats → Premier League card"
            },
            {
              "title": "Shop: My stuff strip removed",
              "detail": "Shop"
            },
            {
              "title": "New careers start at 50 / 50 / 50 / 45",
              "detail": "Relations"
            },
            {
              "title": "Boss meeting: losing costs 8, a win is +1 or +2",
              "detail": "Relations → boss meeting"
            },
            {
              "title": "Premium and Elite cans also give energy",
              "detail": "Home / Shop → KIB Cans"
            },
            {
              "title": "New career: tutorial, then only Home and Training",
              "detail": "New career → first screen"
            },
            {
              "title": "Two drills open League and Play",
              "detail": "Training"
            },
            {
              "title": "League explained once, then the first achievement",
              "detail": "League; Achievements"
            },
            {
              "title": "'Have a meeting with your boss' unlocks Relations",
              "detail": "Achievements → Go"
            },
            {
              "title": "Shop explained; Style locked except the phone",
              "detail": "Shop → Style"
            },
            {
              "title": "Phone: League + Settings + App Store",
              "detail": "Phone"
            },
            {
              "title": "Pitch look: Settings → Look: Classic | Pitch",
              "detail": "Settings"
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Home on one screen",
          "items": [
            {
              "title": "Home fits one phone screen",
              "detail": "Home was 677 px tall in a 572 px room at 390×844, so you scrolled; it is now 375 px. The player card measures the room it is given.",
              "bars": [
                {
                  "label": "Home scroll at 390×844",
                  "was": 105,
                  "now": 0,
                  "state": "good",
                  "unit": " px"
                },
                {
                  "label": "375×667",
                  "was": 282,
                  "now": 0,
                  "state": "good",
                  "unit": " px"
                },
                {
                  "label": "360×640",
                  "was": 309,
                  "now": 0,
                  "state": "good",
                  "unit": " px"
                }
              ]
            },
            {
              "title": "The player card is a dressing room: you, and four boxes",
              "detail": "Reputation, fame, goals and assists this season sit to the right of you; the rating pill still opens the star rating sheet. The layout is the best reading of Harry pointing left and right."
            },
            {
              "title": "Energy and one can live inside your card",
              "detail": "Tap Use: the can shakes and energy goes 55% → 100% (a Basic can gives 65). With no cans the button becomes Buy with the price."
            },
            {
              "title": "The next match is one thin line",
              "detail": "A card of about 190 px plus Last 5 boxes became one line 36 px tall."
            },
            {
              "title": "One money chip in the top bar",
              "detail": "Money showed on Home, Shop and the age strip; the big YOUR MONEY panel on Shop is gone."
            },
            {
              "title": "3D / 2D moves to Settings, and the Sponsors pill is off Home",
              "detail": "Nothing else links to Sponsors from Home now."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Screens",
          "items": [
            {
              "title": "Relations page: calmer, one line each, no week or lifestyle",
              "detail": "3 blocks removed; each card has a plain 'what it does' line."
            },
            {
              "title": "Phone: a Close phone button, and no red dot on the Phone button",
              "detail": "Before, the phone had no way out."
            },
            {
              "title": "Pre-match at 100% energy shows only sharpness and energy"
            },
            {
              "title": "Team sheet: Kick Off always on screen",
              "detail": "Scroll to reach it: 138 / 291 / 293 px → 0."
            },
            {
              "title": "Match opening: no empty black KICK OFF panel",
              "detail": "Team names in kit colours until the first line."
            },
            {
              "title": "Stats: the league card is one button. Shop: My stuff strip removed"
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Unlock chain and relationship numbers",
          "items": [
            {
              "title": "New careers start at 50 / 50 / 50 / 45, reputation 0, fame 1",
              "detail": "Manager 60→50, team-mates 60→50, fans 40→50, you 60→45, reputation 20→0, fame 0→1. Side effect measured: 9 of 20 Premier League and 12 of 24 Championship clubs now start a new player as a Substitute (0 of 44 before)."
            },
            {
              "title": "Boss meeting: losing costs 8, a win is +1 or +2",
              "detail": "Lose: +4 always before, now −8. Win: +14 to +18 before, now +1 or +2. The same scale for Team Bonding, Meet the Fans, Sponsor Event and Take a Break.",
              "bars": [
                {
                  "label": "Win: the most you can get",
                  "was": 18,
                  "now": 2,
                  "state": "good"
                }
              ]
            },
            {
              "title": "Premium and Elite cans also give energy",
              "detail": "Premium +0 → +30, Elite +0 → +40 (Basic stays +65)."
            },
            {
              "title": "New career: tutorial, then only Home and Training",
              "detail": "Four skippable cards; League and Play open after two training drills; Relations after any boss meeting; the Phone says 'Find out more in the future'. Existing saves: nothing locked, no tutorial."
            },
            {
              "title": "League explained once, then the first achievement",
              "detail": "Achievements takes the League slot in the bottom bar."
            },
            {
              "title": "Shop explained; Style locked except the phone",
              "detail": "Style: 1 of 36 items open at the start. Items unlock at star rating 4, 6, 8, 10, 15, 30."
            },
            {
              "title": "Phone: League + Settings + App Store",
              "detail": "Apps at start 13 → 6 (plus the App Store); Casino and the rest are GET in the App Store (free for now)."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Pitch look",
          "items": [
            {
              "title": "A second look for the whole game: green grass stripes, flat panels with chalk-white lines, club colours, tall heavy capitals",
              "detail": "Settings → Look: Classic | Pitch. Default Classic; layout, animations and sizes are untouched.",
              "pill": {
                "text": "reasoned, not measured",
                "tone": "amber"
              }
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "A new player starts on the bench at about half the clubs",
              "detail": "A measured side effect of the manager starting at 50 instead of 60."
            },
            {
              "title": "Sponsors has no way in from Home",
              "detail": "The Shop tile is the only door."
            },
            {
              "title": "The friend's two phone screenshots are missing",
              "detail": "Home fits three sizes, but other phone shapes are untested; 320×568 would still scroll a little."
            },
            {
              "title": "Daily energy ('5 to 6 a day') is not built",
              "detail": "The energy rule is that it returns only from Rest or Skip to Match Day."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Your calls",
          "items": [
            {
              "title": "Keep the manager at 50 (as built), start him at 58, or lower the bar to start?"
            },
            {
              "title": "Existing careers: everything unlocked, no tutorial? Default yes."
            },
            {
              "title": "Make Pitch the default look? Default no."
            },
            {
              "title": "Should Play stay locked until the two drills? Default yes."
            },
            {
              "title": "Want a way into Sponsors from Home? Default no."
            },
            {
              "title": "Does daily energy (5 to 6 a day) replace the Rest-only rule?",
              "detail": "Needs a yes or no."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/AHUmDmsxzNfG1UhEkn3N7n",
      "updatedAt": null
    },
    {
      "version": "0.21",
      "title": "Mikey's patch notes — Sponsors Revamp",
      "publishedAt": "2026-09-30T20:00:00Z",
      "updatedAt": "2026-09-30T20:00:00Z",
      "artifactUrl": "https://claude.ai/artifact/6degCbK833CTu3YAZtoyCz",
      "summary": "Sponsors rebuilt: brands send you offers, you have deal slots that grow with fame, deals pay every week with your wage, targets only ever add a bonus, and each brand's happiness decides the renewal. Plus bidding wars, buy-outs, scandals, one-off adverts and 25% off boots with a boots deal.",
      "stats": [
        {
          "value": "1 → 5",
          "label": "deal slots, Local Name to Icon"
        },
        {
          "value": "13",
          "label": "kinds of brand"
        },
        {
          "value": "every week",
          "label": "sponsor money, paid with your wage"
        },
        {
          "value": "25% off",
          "label": "boots with a boots deal"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "The Sponsors screen: Deals, Offers and Brands",
              "detail": "Shop → Sponsors, or Phone → Sponsors."
            },
            {
              "title": "Offers arrive while you are playing well",
              "detail": "A badge on the Phone."
            },
            {
              "title": "Sign, Decline, More money, Longer deal, Easier target",
              "detail": "Sponsors → Offers."
            },
            {
              "title": "Sponsor money on the after-match card",
              "detail": "After a weekend match."
            },
            {
              "title": "Targets fill up and pay a bonus; the brand's face shows its mood",
              "detail": "Sponsors → Deals."
            },
            {
              "title": "Boots 25% cheaper with a boots deal",
              "detail": "Shop → Boots."
            }
          ]
        },
        {
          "kind": "added",
          "title": "The headline: brands come to you",
          "items": [
            {
              "title": "Sponsors rebuilt",
              "detail": "Problem: a list of ten categories you signed yourself, paid once a season. Fix: invented brands send offers with a weekly fee, 1-3 seasons, one or two targets and sometimes a clause. Deal slots 1 (Local Name) to 5 (Icon), one per kind of brand; offers last 2 weeks; signing pays two weeks' fee."
            },
            {
              "title": "Who gets offers",
              "detail": "Only a player in the squad with recent ratings of 6.2 or better; more fame and form bring more, and each kind of brand wants something that fits it."
            },
            {
              "title": "Targets only ever add",
              "detail": "Hit one: a bonus and a happier brand. Miss one: no money lost, a little happiness."
            },
            {
              "title": "Brand happiness decides the renewal",
              "detail": "Happy: renewal with a 15-30% raise. On the fence: raise, same or a cut. Unhappy: they walk."
            },
            {
              "title": "Bidding wars, buy-outs, scandals, one-off adverts",
              "detail": "Two brands bid at once; a rival can buy you out (your brand may match); a corruption or casino story ends behaviour-clause deals; milestone adverts pay cash without a slot."
            },
            {
              "title": "Negotiating and walking away",
              "detail": "More money uses the transfer negotiation screen; leaving early costs every week the deal promised."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Sponsor money is weekly",
              "detail": "Your deals' weekly fees, paid with the wage on the weekend match. The old per-match image-rights money is gone."
            },
            {
              "title": "Headphones and a football video game",
              "detail": "Two new kinds of brand."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Not played through on a screen",
              "detail": "The screens were seen with example deals; the rest is checked by tests and a played-through test career."
            },
            {
              "title": "The old Sponsors relationship bar",
              "detail": "Still on Relations, but it no longer changes your money."
            }
          ]
        }
      ]
    },
    {
      "version": "0.20",
      "title": "Mikey's patch notes",
      "publishedAt": "2026-09-30T16:00:00Z",
      "updatedAt": "2026-09-30T16:00:00Z",
      "artifactUrl": "https://claude.ai/artifact/YYDBCrSHUiCb8kKSe9vVfo",
      "summary": "The headline: a new star rating, 1.0 to 10.0, that is your career and never goes down, separate from your overall. Plus 7 boots instead of 14, dearer top-level Style items, 2 training sessions a week, training screens restyled, and your real terms on the contract.",
      "stats": [
        {
          "value": "1.0 → 10.0★",
          "label": "the new star rating: your career, never goes down"
        },
        {
          "value": "×1 → ×5",
          "label": "match points, National League up to the Champions League"
        },
        {
          "value": "14 → 7",
          "label": "boot types, each with one job"
        },
        {
          "value": "★1.3m → ★10m",
          "label": "a level-5 Private Island"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Star rating starts at 1.0 with a bar under it, and Overall beneath",
              "detail": "Home."
            },
            {
              "title": "Tapping the rating opens the star rating screen",
              "detail": "Home → Rating."
            },
            {
              "title": "The after-match card shows Star Points earned",
              "detail": "After any match."
            },
            {
              "title": "Seven boots: Pure, Flash, Thunder, Control, Elite, Swerve, Maestro",
              "detail": "Shop → Boots."
            },
            {
              "title": "Level 3–5 Style items cost far more",
              "detail": "Shop → Style."
            },
            {
              "title": "2 training sessions a week, back after your Saturday match",
              "detail": "Training."
            },
            {
              "title": "The level picker and drills are in the Home-screen style",
              "detail": "Training → any skill."
            },
            {
              "title": "The contract shows your name and real terms",
              "detail": "After the trial, and any transfer."
            },
            {
              "title": "Their long shots in five-a-side are played out",
              "detail": "Trial → five-a-side."
            }
          ]
        },
        {
          "kind": "added",
          "title": "The headline: a new star rating, separate from your overall",
          "items": [
            {
              "title": "Star rating is now your career, 1.0 to 10.0★; Overall is how good you are",
              "detail": "Problem: the star rating was just skills divided by 20, so everyone started on 2.0★ and only training moved it. Fix: Overall is your skill average and everything that used the old rating still uses it, so matches play the same. The star rating is new: Star Points for everything you do, starts at 1.0★, never goes down."
            },
            {
              "title": "What earns Star Points",
              "detail": "A match: play 5, start +3, win +3, draw +1, goal 12, assist 8, hat-trick +20, Star Man 20, rating 8.0+ +8, multiplied by the stage (National League ×1 up to Premier League ×4 and Europe ×5). Trophies 250 to 3,000, promotions 300, awards, milestones, achievements, records, fame and owning things."
            },
            {
              "title": "Star gates, and the last star",
              "detail": "You can't pass 2.9, 3.9, 4.9 or 5.9★ until you have played 10 league games at that level or higher; a jump of two divisions opens two gates. Points above a gate are banked. 9.0 to 10.0★ is ten Legend tasks, 0.1★ each."
            },
            {
              "title": "Old saves keep their career",
              "detail": "Their Star Points are worked out from what they already hold; past matches count at the league they are in now."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Boots: 14 types down to 7",
              "detail": "Pure (starter), Flash (pace), Thunder (power), Control (technique), Elite (all-rounder), Swerve (curl), Maestro (extra touch). Each still has 5 levels."
            },
            {
              "title": "Style: the top levels cost far more",
              "detail": "Level 5 ×7.5 (Private Island ★1.33m → ★10m), level 4 ×12, level 3 ×4. Levels 1–2 unchanged."
            },
            {
              "title": "Training: 2 sessions a week instead of days",
              "detail": "They come back only after your Saturday match."
            },
            {
              "title": "Training screens in the Home-screen style",
              "detail": "Level picker and drills restyled; the drills themselves are unchanged."
            },
            {
              "title": "Home screen tidy-up",
              "detail": "Name centred with the badge on its left, age and money in the corners, shop items moved to the Shop page, PK and FK tags."
            },
            {
              "title": "Preferred number is earned",
              "detail": "Manager and team-mates both 90+ at the start of a season; a club that signs you later gives it about 8 times in 10."
            },
            {
              "title": "Trial marking",
              "detail": "Free kicks: goal 1, save ½. Penalties: goals out of 5, countdown 1.8 s (was 1.0, in matches too)."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "The contract shows your real terms",
              "detail": "Name, club, length, shirt number, position, wage and bonuses."
            },
            {
              "title": "Spin your player (test page)",
              "detail": "Admin menu → Spin your player. The back view is a stand-in."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Five-a-side: the other team's long shots are shown",
              "detail": "Goals conceded stay about the same: 1.20 → 1.16 a match over 300 matches."
            },
            {
              "title": "Smaller fixes",
              "detail": "Ball grab zone 28% → 10% of the screen; deleting a save keeps full screen; Settings text white; trial Start buttons; long club names fit; shop lists scroll with the page."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Not seen on a screen yet",
              "detail": "The after-match Star Points line, the new-star full screen, the 7 boots, Style prices and training sessions text were checked by tests, not by eye."
            },
            {
              "title": "Three tests fail on main too",
              "detail": "authoredChance, freeKickRules and longRangeRules; not from these changes."
            }
          ]
        }
      ]
    },
    {
      "version": "0.18",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-28T14:00:00Z",
      "summary": "The game is now the base for a real App Store and Play Store app. The headline is the road map to it (step 3 of 8), plus what shipped since v0.17: aiming three times smoother on a slow phone, a smaller download, and 3D as everyone's look.",
      "stats": [
        {
          "value": "3× faster",
          "label": "while aiming on a slow phone (124 → 44 ms a frame)"
        },
        {
          "value": "4.9 → 2.6 MB",
          "label": "to open the game"
        },
        {
          "value": "3D",
          "label": "is now everyone's look, with a 3D/2D button to flip it back"
        },
        {
          "value": "0",
          "label": "store reviews needed to ship a game change to the app"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Open Home and tap the 3D / 2D button",
              "detail": "Top right of your player card. Your player flips look straight away."
            },
            {
              "title": "Play a chance: does aiming feel smoother?",
              "detail": "Most noticeable on an older phone."
            },
            {
              "title": "Score updates during your match",
              "detail": "Back to the old pop-up card, not lines in the commentary."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "The headline: the road to the App Store and Play Store",
          "items": [
            {
              "title": "2 of 8 steps done: smooth on slow phones, and 3D players as standard",
              "detail": "Step 3, safe saves, is ready and waiting on your yes."
            },
            {
              "title": "Safe saves come next",
              "detail": "Stop careers being lost between phone and PC. Saves shrink from 1.4 MB to about 300 KB, so about 400 careers fit in the free database instead of about 85."
            },
            {
              "title": "Then accounts, the app itself, testing, 12 testers for 14 days, and store review",
              "detail": "Apple is $99 a year (1–3 days to approve); Google is $25 once. The 12-testers step is the slowest, so start it early.",
              "more": {
                "summary": "The rest of the steps",
                "points": [
                  "The app itself wraps the real game and adds what Apple requires: Sign in with Apple, a phone-style Google sign-in, saves kept on the phone, an offline screen and the back button.",
                  "Apple review takes about 1.5 days; Google's first review takes 7–14 days.",
                  "After it's live: no store review for game changes. The app opens the live game from the website, so anything pushed there reaches everyone next time they open it. Worked out from Apple's and Google's rules; not tested yet because the app doesn't exist yet."
                ]
              }
            },
            {
              "title": "Problem: 4 ways a player can lose a career today",
              "detail": "Offline on the phone then PC (the PC save wins with no warning), closing within 3 seconds of a change, an iPhone clearing website storage after 7 days, and a full phone silently dropping the save.",
              "more": {
                "summary": "Fixes, and how sure we are",
                "points": [
                  "Fixes: ask which save to keep, save the moment the app is hidden, keep saves on the phone in the app, smaller saves plus a storage warning.",
                  "Read from the save code, not reproduced on two real devices."
                ]
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Shipped since v0.17",
          "items": [
            {
              "title": "The match lag: each face was drawn 13 times from the full-size photo, every frame",
              "detail": "Now drawn once and reused. The fake-face pictures went from 1.9 MB to about 95 KB each. Faces look identical.",
              "bars": [
                {
                  "label": "Aiming, 2D look (ms a frame)",
                  "was": 124.5,
                  "now": 44.2,
                  "state": "good",
                  "unit": "ms"
                },
                {
                  "label": "Aiming, 3D look (ms a frame)",
                  "was": 155.1,
                  "now": 45.2,
                  "state": "good",
                  "unit": "ms"
                },
                {
                  "label": "Five-a-side (ms a frame)",
                  "was": 48.9,
                  "now": 31.7,
                  "state": "good",
                  "unit": "ms"
                },
                {
                  "label": "Ball in flight (ms a frame)",
                  "was": 50,
                  "now": 40.2,
                  "state": "good",
                  "unit": "ms"
                }
              ],
              "more": {
                "summary": "How it was measured",
                "points": [
                  "A real browser at phone size, processor slowed 6×, average of 2 runs. Lower is smoother."
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
              "title": "3D is the default look",
              "detail": "Your answer in v0.17. Classic 2D is one tap away."
            },
            {
              "title": "Dribble camera C1, a smoother 3D kick, League Two's top 3 go straight up",
              "detail": "Your answers to the v0.17 questions."
            },
            {
              "title": "Live scores are the pop-up card again",
              "detail": "\"Fit the aesthetic more.\""
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "National League North and South player names",
              "detail": "1,540 players at 63 clubs, from Wikipedia. Stored only; nothing plays with them yet. The ratings (42–56) are estimates, not real ratings."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "The 3D / 2D button sits on the card's dotted light icon",
              "detail": "Seen at both phone sizes. Quick fix."
            },
            {
              "title": "On small Androids (360 px) the match bar reads \"ASSISTSPASS\"",
              "detail": "The labels touch. Quick fix."
            },
            {
              "title": "Aiming is still about 20 frames a second on a slow phone",
              "detail": "The next step is to stop repainting the pitch while nothing moves, only if players notice.",
              "pill": {
                "text": "half fixed",
                "tone": "amber"
              }
            },
            {
              "title": "3 test files fail",
              "detail": "They fail on the live version too."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Your calls",
          "items": [
            {
              "title": "Start safe saves now?",
              "detail": "Recommended: yes. It protects players today, and the app needs it anyway."
            },
            {
              "title": "Apple account: you, or a company?",
              "detail": "Individual: your name shows as the seller, 1–3 days. Company: \"Knowitball\" shows, needs a company and a free D-U-N-S number, 1–2 weeks."
            },
            {
              "title": "Who are the 12 testers?",
              "detail": "They must opt in and play for 14 days in a row."
            },
            {
              "title": "Will coins ever cost real money?",
              "detail": "If yes, Apple and Google require their own payment system and take 15–30%."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/HvagWBceebfaR9KmxRKhgh",
      "updatedAt": null
    },
    {
      "version": "0.17",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-28T11:00:00Z",
      "summary": "The whole game reskinned in the new home-screen look, 3D players, face scans, a Blender footballer for later, run-ups and the Store, and YouTube links finally working. The headline is the look: every screen rebuilt on one shared kit.",
      "stats": [
        {
          "value": "40+",
          "label": "screens rebuilt in the new look, each filmed before and after at two phone sizes"
        },
        {
          "value": "12 → 0",
          "label": "of 42 dribble positions where the ball sat on your body (new C1 camera)"
        },
        {
          "value": "7 + 7",
          "label": "run-ups: penalties, and free kicks modelled on Ronaldo, Bale, Messi, Neymar, Maddison and Trent"
        },
        {
          "value": "198 / 201",
          "label": "tests pass. The 3 that fail also fail on the live version"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Open the game on your phone",
              "detail": "The new title screen: Continue, New Game, Load Game, Settings."
            },
            {
              "title": "Swipe Home, Stats and Shop with your finger",
              "detail": "It was filmed with a mouse drag, not a finger."
            },
            {
              "title": "Tap Play: can you see Play, energy, Sharpness and the three cans without scrolling?",
              "detail": "44 px spare on an iPhone 13, 9 px on a small Android."
            },
            {
              "title": "Play one match, then watch the post-match screen",
              "detail": "The score slams in, the rating counts up, pay and relationships float up."
            },
            {
              "title": "Settings → Player look → 3D, then play a chance",
              "detail": "Do the players look right on your phone, and does the kick look smooth?"
            },
            {
              "title": "Upload your own photo in Settings → Photo",
              "detail": "The scan animation runs, then your face sits on the avatar with hair."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "The headlines",
          "items": [
            {
              "title": "Problem: the home screen was \"all messed up\" and every other screen looked like an older game",
              "detail": "Flat cans, six squashed buttons, a 2D avatar with no flash, and uploaded photos sitting on it like a sticker.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: each screen was built on its own over the months with its own colours and buttons, so there was no single place to change the look.",
                  "Fix: one shared design kit (club-lit glass cards, pills, buttons that press in, bursts, count-ups) with every screen rebuilt on it, and 3D-look players.",
                  "A real title screen, and Home with you in the middle and Play raised in the middle.",
                  "Matchday: Play, role, energy, Sharpness and all three cans now fit above the pinned bar (the match box went from about 245 px tall to 80).",
                  "League, Stats, Training, Relations, Phone, Shop, Store, Casino, awards, transfers, votes, team sheets, cup draw and Settings all rebuilt. Every number stays on screen."
                ]
              }
            },
            {
              "title": "3D players on the pitch",
              "detail": "Shaded kits, boots, a soft shadow and a fitted face. A player with no photo gets drawn hair in 5 styles, so nobody is bald.",
              "more": {
                "summary": "How it works",
                "points": [
                  "They use the same skeleton as today's players, so every run, kick and dive moves exactly as before; only the drawing on top is new.",
                  "Off by default, tried from Settings → Player look. It's no slower: 67–69 ms a frame against Classic's 74–79 ms on a slowed-down phone test."
                ]
              }
            },
            {
              "title": "The dribble: 3D and three new cameras",
              "detail": "Your old complaint, the ball sitting on your body instead of in front, was measured over 42 ball positions.",
              "bars": [
                {
                  "label": "Ball drawn over your body, of 42",
                  "was": 12,
                  "now": 0,
                  "target": 0,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "The four views",
                "points": [
                  "Today: 12 of 42. C1 low over the shoulder: 0. C2 higher from behind: 0. C3 closing in near a defender: 0–2.",
                  "The cameras change the view only, not the difficulty. In the C1 view the legs look like a normal stride."
                ]
              }
            },
            {
              "title": "Face scan: your photo becomes your face",
              "detail": "Problem: \"still an issue when the player takes a picture\", and \"everyone can't be bald\". An uploaded photo is now cut out, straightened and fitted once, with a scan animation, and the hair is recreated.",
              "more": {
                "summary": "How it works",
                "points": [
                  "A face-finding tool that runs on the phone itself finds the face and outline, lines up the eyes, removes the background and redraws the hair. It works on busy backgrounds.",
                  "Your own photo has only been tested from a screenshot crop."
                ]
              }
            },
            {
              "title": "Recording tool: video links, and YouTube from your own Mac",
              "detail": "Problem: the tool only took files, and YouTube blocks cloud servers, so a pasted YouTube link failed every way it was tried.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "From the cloud: TikTok, Drive, Dropbox and about 1,000 other video sites now work from a link.",
                  "From your Mac: a one-click Download YouTube button on the desktop. You tested it: \"unreal, it worked\".",
                  "720p is the default; a 25-minute video is 133 MB at 720p against 263 MB at 1080p."
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
              "title": "Blender: a real 3D footballer, for celebrations and cut-scenes",
              "detail": "5 stills, hair in several styles and 3 animation loops, on its own test page. Nothing reaches the game yet."
            },
            {
              "title": "Run-ups: 7 for penalties, 7 for free kicks",
              "detail": "Chosen in Settings. Free kicks include Ronaldo's power stance, Bale, Messi's calm curl, Neymar, Maddison and Trent."
            },
            {
              "title": "The penalty keeper sometimes leans",
              "detail": "About 35% of penalties. Right-corner penalties score 86.1% if he leans left, 72.3% with no lean and 55.7% if he leans right."
            },
            {
              "title": "The Store and Coins, inside the career",
              "detail": "Daily specials, run-up animations, accessories and boosts. Coin packs say \"Coming soon\": there is no real payment."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Fixed",
          "items": [
            {
              "title": "Swiping between home pages didn't work with a finger",
              "detail": "It only worked with a mouse. Tested with real touch events now."
            },
            {
              "title": "Post-match always said your stars went up by +0.1",
              "detail": "It shows the real jump now."
            },
            {
              "title": "Two old display bugs in Settings",
              "detail": "A switch's knob sat outside its track, and the current save was cut off."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Fitness is now called Sharpness",
              "detail": "Same number; it goes up by playing and drops each week you don't."
            },
            {
              "title": "League table zones follow each division",
              "detail": "The Premier League shows title, Champions League, Europa League and relegation; lower divisions show promotion and play-offs."
            },
            {
              "title": "Settings, reorganised",
              "detail": "Game, You, Player graphics, Saves, Developer tools, then Exit career. Main menu is at the top right."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "3 test files fail",
              "detail": "They fail on the live version too. 198 of 201 pass."
            },
            {
              "title": "Not seen on a screen",
              "detail": "The Ballon d'Or countdown, a signing through a real transfer window, reduce-motion on a real phone, and the photo picker's camera and crop stages.",
              "pill": {
                "text": "not played",
                "tone": "amber"
              }
            },
            {
              "title": "Most reskinned screens were filmed on a test page",
              "detail": "Only Sim this match was filmed inside a real career.",
              "pill": {
                "text": "half fixed",
                "tone": "amber"
              }
            },
            {
              "title": "The 3D test switch is visible to real players",
              "detail": "Settings → Player look (test)."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Your calls",
          "items": [
            {
              "title": "Push the UI rebuild?",
              "detail": "Recommended: push, so it goes up to your branch for you to merge."
            },
            {
              "title": "Which dribble camera does the real game use?",
              "detail": "Recommended: C1, the ball is always clearly in front of you."
            },
            {
              "title": "When do the 3D players become everyone's look?",
              "detail": "Recommended: later. Check the kick first, then switch."
            },
            {
              "title": "Blender: what next?",
              "detail": "Recommended: a goal celebration clip after you score."
            },
            {
              "title": "League Two: is 3rd place promoted or in the play-offs?",
              "detail": "The reskinned table marks 3rd as promoted; the season code puts it in the play-offs. Recommended: real, top 3 promoted."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/45LCtddFQZAvSQsc2JWk6S",
      "updatedAt": null
    },
    {
      "version": "0.16",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-27T21:00:00Z",
      "summary": "The v0.15 plan, built for real, tested and filmed at phone size. The headline: the drawing is the team, so every player you drew now plays. Penalties get a run-up, a keeper who dives once and can read you, and your club plays at its real strength.",
      "stats": [
        {
          "value": "77% → 0",
          "label": "cutback chances that left out a defender you drew"
        },
        {
          "value": "88% → 75%",
          "label": "penalties into the corners that go in (all penalties 82% → 76%)"
        },
        {
          "value": "0.75 → 2.15",
          "label": "chances for a sub coming on at 80'"
        },
        {
          "value": "187 / 190",
          "label": "tests pass. The 3 that fail also fail on the live version"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Corners and byline crosses: is the whole goal on screen?",
              "detail": "Try any career match with a corner or byline cross."
            },
            {
              "title": "The penalty run-up and the keeper's hop",
              "detail": "Try any career penalty."
            },
            {
              "title": "Get closed down while holding the ball: about 1 in 3 should be a foul",
              "detail": "Pull back and wait on a Premier League side."
            },
            {
              "title": "Shootout: you take a kick and the result reads your score first",
              "detail": "A cup match that goes to penalties."
            },
            {
              "title": "Faces on a real phone: nobody has a blank head",
              "detail": "Any career match."
            },
            {
              "title": "Late subs get chances, and a sub only comes off for energy",
              "detail": "Settings → Energy low, get benched, come on late."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "The headlines",
          "items": [
            {
              "title": "The drawing is the team: every player you drew now plays",
              "detail": "Problem: you drew a cutback with 5 defenders and the game served 4, and it invented men you never drew.",
              "bars": [
                {
                  "label": "Cutback missing a drawn defender (%)",
                  "was": 77,
                  "now": 0,
                  "target": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Midfield pass missing one (%)",
                  "was": 79,
                  "now": 0,
                  "target": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Byline cross missing one (%)",
                  "was": 59,
                  "now": 0,
                  "target": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Corner keeper moved off your spot (%)",
                  "was": 100,
                  "now": 0,
                  "target": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: months of hand-written \"always\" rules piled on top of your drawings: keeper never on his line, pick some defenders, nudge the ball, move you after a pass, move the free-kick team-mate.",
                  "Fix: all of them deleted. The same men, keeper spot and ball you drew. Extra team-mates you drew become real runners with a name and a face.",
                  "Penalty ball moved off the spot 100% → 0; you moved after a pass 100% → 0; stacked players in through balls 75 → 0 per 400.",
                  "Left for you: 23 older drawings still carry the old keeper spots."
                ]
              }
            },
            {
              "title": "Penalties: a run-up, one dive, and a keeper who can read you",
              "detail": "Problem: penalties into the corners went in 88% of the time, the keeper dived and then dived back, and there was no run-up.",
              "bars": [
                {
                  "label": "Corner penalties scored (%)",
                  "was": 87.6,
                  "now": 75,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "All penalties scored (%)",
                  "was": 82.3,
                  "now": 76,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: the keeper could change his mind mid-dive, and the strike happened the instant you let go.",
                  "Fix: you stand 1.8 m behind the ball, aim, then jog in for 2.4 s with a 1-second countdown. Run out of time and you scuff it. He makes one dive and finishes it, and about half the time hops to a side first and dives that way.",
                  "Open question: watching the hop and aiming the other way scores 81.7% against 74.3% if you ignore it."
                ]
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Caught in the final playtest",
          "items": [
            {
              "title": "Corners and byline crosses cut the goal off",
              "detail": "The view widens a little when it needs to: whole goal in view 0 → 300 of 300 corners, 113 → 300 byline crosses."
            },
            {
              "title": "Test screens: a foul said PENALTY, then reloaded the same picture",
              "detail": "It now serves the penalty straight away (3 of 3)."
            },
            {
              "title": "Test screens: every penalty was the same",
              "detail": "The keeper now varies and hops there too (hop 0% → 51.5%)."
            },
            {
              "title": "Shootouts: you never got to kick, and a loss said \"Won 2–4\"",
              "detail": "You're always one of the five takers and the result reads your score first."
            },
            {
              "title": "The ball started off the bottom of the screen",
              "detail": "The pitch is scrolled into view when a chance starts: 44% → 0."
            },
            {
              "title": "Buildup: two team-mates standing 0.33 m apart",
              "detail": "That's how the drawing was made, not a code bug.",
              "pill": {
                "text": "blocked on Harry",
                "tone": "red"
              }
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "Match, camera and shots",
          "items": [
            {
              "title": "Your club now plays at its real strength",
              "detail": "The unseen match was told 60 for every club. Strongest clubs win 38–49% → 71–78% (planned figure, not re-measured after the build)."
            },
            {
              "title": "You can shoot past a man, and team-mates curl round him",
              "detail": "A body is 0.7 m wide now. Long-range shots blocked 26% → 18%, cutbacks 45% → 37%.",
              "bars": [
                {
                  "label": "Long range shots blocked (%)",
                  "was": 26,
                  "now": 18,
                  "state": "good",
                  "unit": "%"
                }
              ]
            },
            {
              "title": "A team-mate no longer takes your shot",
              "detail": "A team-mate right on your shot's line lets it go. Through balls he took 60% → 33%."
            },
            {
              "title": "The whole goal is always on screen",
              "detail": "The camera slides or zooms out instead of moving the chance closer. Through balls now score 21.8% → 25.2%."
            },
            {
              "title": "Subbed on, then subbed off: gone",
              "detail": "A sub only comes off for energy now."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Free-kick run-up",
              "detail": "Same jog and 1-second countdown as penalties."
            },
            {
              "title": "Shootouts and penalties won without you are played live",
              "detail": "Every kick on the real pitch. A top side wins one about every 6 games."
            },
            {
              "title": "A cheeky miss costs reputation",
              "detail": "A missed penalty down the middle or a missed chip: -1 each, at most -2 a match."
            },
            {
              "title": "Late subs get chances",
              "detail": "A 99 striker on at 80': 0.75 → 2.15 chances a cameo.",
              "bars": [
                {
                  "label": "Chances, on at 80'",
                  "was": 0.75,
                  "now": 2.15,
                  "state": "good"
                }
              ]
            },
            {
              "title": "Live scores during your match",
              "detail": "Cards only for clubs you tick, one at a time, and a Scores panel with every game."
            },
            {
              "title": "Sim this match",
              "detail": "Score, your goals and assists, rating and star bar. Deliberately a bit worse than playing."
            },
            {
              "title": "Real players in League One and Two",
              "detail": "43 clubs, 1,154 players copied from last season a year older. Needs a database step run first.",
              "pill": {
                "text": "blocked on Harry",
                "tone": "red"
              }
            },
            {
              "title": "Match Radar",
              "detail": "Watch the unseen 90 minutes, with injuries and energy at kick-off."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "One keeper everywhere, set to Middle",
              "detail": "He walks up to 2.2 m while you aim, then dives once, paced to arrive with the ball. Keepers who are 88 rated now concede fewer than 45-rated ones in every kind of chance; the Hard / Middle / Easier setting is a test-screen dial only."
            },
            {
              "title": "Every chance is made the same way: your drawings, varied",
              "detail": "Mirrored half the time and never one of the last 5. One-on-ones a match 0.34 → 1.85."
            },
            {
              "title": "The drag is 25% shorter, measured from your thumb",
              "detail": "Full power at power 55: 12.6% → 9.5% of the screen."
            },
            {
              "title": "Figures are the same size in training, trial and the match",
              "detail": "Drills were up to 46% too big; now within 2.3%."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "3 test files fail",
              "detail": "authoredChance, freeKickRules and longRangeRules. They fail on the live version too."
            },
            {
              "title": "23 drawings still carry the old keeper spots, and none of the 10 penalty drawings obey the penalty rules",
              "detail": "The game corrects the penalties when played, so nothing looks wrong in a match.",
              "pill": {
                "text": "blocked on Harry",
                "tone": "red"
              }
            },
            {
              "title": "Fouls when closed down and OFF THE WALL labels haven't been seen by a person",
              "pill": {
                "text": "not played",
                "tone": "amber"
              }
            },
            {
              "title": "Blank faces were seen only on the test machine",
              "detail": "A failed photo now shows a fake face. Not checked on a real phone.",
              "pill": {
                "text": "half fixed",
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
              "title": "Your answers to decisions (a) to (i)",
              "detail": "The penalty hop can be beaten, tight angles are now the most common striker chance, the 6.5 pull on short cameos, saves, National League data, shootout slot."
            },
            {
              "title": "Highlight choosing, redesigned",
              "detail": "\"The last big hurdle\": fun over realism, different kinds of striker."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/A9gwVhtt8dAVBwddYgrh7A",
      "updatedAt": null
    },
    {
      "version": "0.19",
      "title": "Mikey's patch notes",
      "publishedAt": "2026-09-27T12:00:00Z",
      "summary": "The headline: five levels of every boot and lifestyle item, each priced for its league. Plus a moving ball on the strike screen (headers float, volleys bounce, ground balls bobble), commentary that barely repeats, and new chants.",
      "stats": [
        {
          "value": "5 levels",
          "label": "of every boot and lifestyle item (70 boots, 155 items)"
        },
        {
          "value": "★30 → ★920",
          "label": "a Phone, level 1 to level 5"
        },
        {
          "value": "8.3 → 0.1",
          "label": "repeated commentary lines per match"
        },
        {
          "value": "3",
          "label": "ways the ball moves on the strike screen"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Every boot has L1–L5 buttons with a price",
              "detail": "Shop → Boots."
            },
            {
              "title": "Every lifestyle item has L1–L5 buttons; a higher level replaces the one you own",
              "detail": "Shop → Lifestyle."
            },
            {
              "title": "A ball at your feet sometimes bobbles on the strike screen",
              "detail": "One-on-ones, tight angles, long shots."
            },
            {
              "title": "Headers float across, volleys bounce across",
              "detail": "Once headers and volleys are switched back on; /star-dev/media-lab?contact=float."
            },
            {
              "title": "Commentary barely repeats",
              "detail": "Watch a full match's commentary."
            },
            {
              "title": "New chants for Ronaldo, Messi, Saka, Pogba and more",
              "detail": "The feed after a named player scores."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "The headline: five levels of everything in the shop",
          "items": [
            {
              "title": "Every boot and lifestyle item comes in 5 levels",
              "detail": "Problem: each item had one price and sat in one money tier. Fix: level 1 priced for National League money up to level 5 for the Premier League; boots about 25% more power and technique per level, lifestyle about 40% more fame. You own one level of each item; a higher one replaces it. Old saves keep what they own.",
              "bars": [
                {
                  "label": "Phone price, L1 → L5",
                  "was": 30,
                  "now": 920,
                  "state": "good",
                  "unit": "★"
                }
              ]
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "The ball moves on the strike screen",
              "detail": "Headers float across in an arc (\"Head it?\"), volleys bounce across, a ball at your feet bobbles about a third of the time. Dead balls stay still. Only where you tap counts; higher technique makes it slower."
            },
            {
              "title": "New chants",
              "detail": "Ronaldo, Messi, Wan-Bissaka, Rogers, João Pedro, Brobbey, Calvert-Lewin, Lukaku, plus Saka and Pogba. Names match despite accents and hyphens."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Commentary barely repeats",
              "detail": "About 300 new lines, and a line isn't reused while unused ones remain. Repeats per match: 8.3 → 0.1 (200 simulated matches).",
              "bars": [
                {
                  "label": "Repeated lines per match",
                  "was": 8.3,
                  "now": 0.1,
                  "state": "good"
                }
              ]
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "NS-Swerve and NS-Maestro abilities come with every level",
              "detail": "Touch Mode for about ★1,200 at level 1. Waiting on a decision.",
              "pill": {
                "text": "low",
                "tone": "amber"
              }
            },
            {
              "title": "Floating and bouncing balls don't appear in matches yet",
              "detail": "Headers and volleys are switched off in matches.",
              "pill": {
                "text": "low",
                "tone": "amber"
              }
            },
            {
              "title": "Google Analytics counts our own test browsers as new UK users",
              "detail": "Fix ready, waiting on a yes.",
              "pill": {
                "text": "high",
                "tone": "red"
              }
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/XCqpEXqtnZ7Dp4yf4vyTue",
      "updatedAt": null
    },
    {
      "version": "0.15",
      "title": "Harry's patch notes",
      "publishedAt": "2026-09-27T11:00:00Z",
      "summary": "The plan from your 40-minute playtest: every problem you raised and what we'd do about it, with 35 of the 38 changes built as a test version and filmed. The headline is that every match you play has told your club it was a 60-rated side.",
      "stats": [
        {
          "value": "60 → 83",
          "label": "the strength a Chelsea match was told, against Chelsea's real one"
        },
        {
          "value": "38–49% → 71–78%",
          "label": "wins for the strongest clubs once the real strength is used"
        },
        {
          "value": "35 of 38",
          "label": "changes built as a test version and filmed in the real game"
        },
        {
          "value": "7 of 11",
          "label": "hand-written rules nobody asked for, found moving your drawn chances"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Nothing on this page is kept until you say so",
              "detail": "It is a plan, filmed from a test version that was never saved to the project. Tick each change once you have looked at its pictures."
            },
            {
              "title": "Corner penalties would score 88%, not 79%",
              "detail": "With the keeper back on his line he reaches less of the angle. Your research says a bit more than 70%, so the plan tunes it with the new keeper."
            },
            {
              "title": "Trial gets easier with one dive",
              "detail": "Turning back was how the trial keeper saved kicks down the middle. Hardest kick goes 25% → 50% scored unless he sometimes reads a middle kick."
            },
            {
              "title": "A 99 power strike would look like an 82",
              "detail": "Was \"too strong\" about how fast it looks, or how often it scores? A 99 would still score slightly more, so the thing to change is the keeper."
            },
            {
              "title": "About 30 more one-word questions, each with a recommended answer",
              "detail": "Camera, drag length, run-up timer, live scores, cans, added time, home layout, lower-league faces."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "The four headlines",
          "items": [
            {
              "title": "Problem: in every match you play, your club has played like a 60-rated side",
              "detail": "Whatever club you're at you win about 4 in 10, top or bottom of the table. That's why a max-stat Chelsea striker went 20+ games without a penalty.",
              "bars": [
                {
                  "label": "Chelsea 99 striker, wins (%)",
                  "was": 30,
                  "now": 61,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Goals against a game",
                  "was": 1.78,
                  "now": 1.06,
                  "state": "good"
                },
                {
                  "label": "Games between penalties",
                  "was": 12.2,
                  "now": 6.1,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: the unseen part of the match was told your relationship with team-mates (60 for everyone) instead of your club's strength (Chelsea: 83). It has been like that in every match, every career, as far back as the history goes. Matches you don't play used real strengths, so the rest of the table was right.",
                  "Fix: tell the match your club's real strength. Team-mate relationship keeps its real job, how well team-mates combine inside a chance. It goes in first because it changes every other number.",
                  "Strongest clubs win 38–49% → 71–78%; middle 38–43% → 49–57%; weakest 34–42% → 30–36%."
                ]
              }
            },
            {
              "title": "Problem: a rule nobody asked for moved every drawn keeper at least 1.6 m off his line",
              "detail": "You drew all 10 penalty keepers on the line; the real match started him 1.6 m out every time (200 of 200). It also moved every cutback keeper and 44% of tight-angle keepers.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: one line added on 21 Sep, while all the drawings were one-on-ones, went into the shared step that places every drawn keeper. Nothing was measured. As more kinds got drawings it moved all of them, and it had been writing itself into saved drawings.",
                  "Fix: delete it. Each kind's keeper comes from its own drawings; penalties come from the penalty rules.",
                  "Correction: an earlier check said the penalty keeper wasn't off his line. That was wrong; the check didn't go through the real match.",
                  "A search found 11 rules sitting between your drawings and the screen: you asked for 3, one is a missing line, seven nobody asked for.",
                  "Free kicks: an ordinary taker scored 18% with him 1.6 m out against 6% on his line; your target is 4–7%."
                ]
              }
            },
            {
              "title": "Problem: the keeper moves differently in every kind of chance, and a 45 and an 88 are almost the same",
              "detail": "On your shots he stands still until the ball arrives (he moves early in 1% of one-on-ones); on penalties he dives, then dives back.",
              "bars": [
                {
                  "label": "One-on-ones conceded vs an 88 keeper (%)",
                  "was": 28,
                  "now": 17,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: several separate keeper rulebooks, one per situation, each hand-tuned.",
                  "Fix: one keeper who gets set while you aim, reacts in 0.29 s (45 rated) to 0.21 s (90), reads where the ball will cross, dives once and never turns round. Built from your idea.",
                  "He moves before the ball arrives in 71–93% of one-on-ones, up from 1%.",
                  "He deliberately does not read your arrow: that turns aiming into a feint game."
                ]
              }
            },
            {
              "title": "Problem: highlights look alike: 85% of tight angles look like one from your last 20",
              "detail": "Long shots are a straight copy of one drawing every time, and a striker gets 1.8 one-on-ones a match.",
              "bars": [
                {
                  "label": "Tight angles like one of your last 5 (%)",
                  "was": 51,
                  "now": 13,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: 68% of highlights are one of your drawings nudged up to 2 m, your 12 tight angles sit within about 2 m of each other, and the memory of recent pictures is wiped every match.",
                  "Fix: both ways built and switchable. (A) your drawings, cleaned up and mirrored half the time. (B) a true generator built from the spread of all your drawings.",
                  "Straight copies of a drawing: tight angles 31% → 2%, one-on-ones 48% → 7%, long shots 100% → 0% with (B)."
                ]
              }
            }
          ]
        },
        {
          "kind": "changed",
          "title": "The rest of the plan",
          "items": [
            {
              "title": "Penalties",
              "detail": "Goal drawn where the real one is, hard penalty rules nobody can edit, a run-up and 1-second timer, one dive, 99 power capped near 102 km/h, a reputation hit for a cheeky miss."
            },
            {
              "title": "Shootouts and penalties won without you",
              "detail": "Every kick played live on the real pitch, a Shootout button in the highlights, and penalties won at about one every 6 games for a top side."
            },
            {
              "title": "The keeper's pieces",
              "detail": "A dive that shows why he was beaten, and his lean set from where you drew him (8 of 10 dives leaned the wrong way first)."
            },
            {
              "title": "Around the shot",
              "detail": "A team-mate no longer takes your shot, you can shoot past a man, team-mates curl round one, and a block can go in."
            },
            {
              "title": "Camera and the drag",
              "detail": "The whole goal always on screen, byline crosses filmed from the corner flag, room near the side, a shorter drag, and captain runs that start when you pull back."
            },
            {
              "title": "Subs, ratings and energy",
              "detail": "Late subs get chances, a sub isn't taken off again, a ratings list, and a can button that fits kick-off."
            },
            {
              "title": "Match day and the season",
              "detail": "Added time and Fergie time, a cup tab that names the right round, no draw after you're out, live scores, and a Sim this match button."
            },
            {
              "title": "Screens and tools",
              "detail": "Swipe pages for Stats, Home and Training, real League One and Two players, and a Match Radar to watch the unseen 90 minutes."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "The keeper fixes and \"nobody moves after a pass\" are measured, not seen on screen",
              "pill": {
                "text": "not filmed",
                "tone": "amber"
              }
            },
            {
              "title": "Some drawings always carry a fault and would be served as drawn",
              "detail": "Byline crosses, cutbacks, corners and one one-on-one (offside 12 of 14 times).",
              "pill": {
                "text": "yours to fix",
                "tone": "amber"
              }
            },
            {
              "title": "60 of your 120 drawings have the keeper nearer than 1.6 m",
              "detail": "They'll look different once the 1.6 m rule goes."
            }
          ]
        },
        {
          "kind": "next",
          "title": "Build order once you approve",
          "items": [
            {
              "title": "First and alone: your club's real strength",
              "detail": "It changes every other number on the page."
            },
            {
              "title": "Then the keeper rules, penalties, highlights, camera, around the shot, the new keeper, subs, season and screens",
              "detail": "Each step is built only after you approve its pictures, then filmed again in the real game."
            }
          ]
        }
      ],
      "artifactUrl": null,
      "updatedAt": null
    },
    {
      "version": "1.0",
      "title": "V1: every problem and its fix",
      "publishedAt": "2026-09-26T18:00:00Z",
      "summary": "Every change from every patch notes version so far (v0.1 to v0.25), from Harry, Leo and Mikey, oldest first. Each item says what was wrong; open \"Why, and the fix\" for why it happened and what fixed it. The headlines are the drawing is the team (v0.16) and the guard (v0.10). v0.15 is the plan that v0.16 built; v0.19 is Mikey's page, first published as 1.1. Added 1 Oct: Mikey's v0.20 and v0.21, Harry's review of v0.20 and his v0.22. Added 3 Oct: Harry's v0.23, v0.23.1, v0.24 and v0.25, which went live that day.",
      "stats": [
        {
          "value": "450",
          "label": "problems fixed or features added, 21 Sep to 3 Oct"
        },
        {
          "value": "28",
          "label": "patch notes and review pages folded into this one"
        },
        {
          "value": "367 · 13 · 70",
          "label": "changes by Harry · Leo · Mikey"
        },
        {
          "value": "81",
          "label": "known issues still open (24 raised along the way are now fixed), plus 53 decisions for Harry"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "The headlines: the drawing is the team, and the guard",
          "items": [
            {
              "title": "The drawing is the team: every player you drew now plays (v0.16 · Harry)",
              "detail": "Problem: you drew a cutback with 5 defenders and the game served 4, and it invented men you never drew.",
              "bars": [
                {
                  "label": "Cutback missing a drawn defender (%)",
                  "was": 77,
                  "now": 0,
                  "target": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Midfield pass missing one (%)",
                  "was": 79,
                  "now": 0,
                  "target": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Byline cross missing one (%)",
                  "was": 59,
                  "now": 0,
                  "target": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Corner keeper moved off your spot (%)",
                  "was": 100,
                  "now": 0,
                  "target": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: months of hand-written \"always\" rules piled on top of your drawings: keeper never on his line, pick some defenders, nudge the ball, move you after a pass, move the free-kick team-mate.",
                  "Fix: all of them deleted. The same men, keeper spot and ball you drew. Extra team-mates you drew become real runners with a name and a face.",
                  "Penalty ball moved off the spot 100% → 0; you moved after a pass 100% → 0; stacked players in through balls 75 → 0 per 400.",
                  "Left for you: 23 older drawings still carry the old keeper spots."
                ]
              }
            },
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
            },
            {
              "title": "Players standing behind someone were drawn on top of him (v0.11 · Mikey)",
              "detail": "At a corner or cross, a striker standing behind his marker was drawn over him, head in the marker's shirt, as if standing on his shoulders. It happened from every camera angle.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Players weren't drawn in order of who was nearer. They were drawn in fixed groups (team-mates, runners, defenders, you, then the keeper), so a later group was always on top.",
                  "Fix: Every player, keeper included, is now drawn furthest-first by where his feet touch the grass, from any camera angle. The scenario gallery picture does the same."
                ]
              }
            },
            {
              "title": "The ball was drawn across the head of a player in front of it (v0.11 · Mikey)",
              "detail": "With a defender standing just in front of you, the ball at your feet was drawn across his head, as if he had it.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The ball was always drawn last, on top of everybody.",
                  "Fix: The ball now takes its place in the same nearest-in-front order, placed by its shadow on the grass, so anyone nearer the camera partly covers it. A lofted ball can pass behind a nearer player, and the landing cross and ball trail sit under the players."
                ]
              }
            },
            {
              "title": "Corners were taken 6 to 7.5 metres in from the flag (v0.11 · Mikey)",
              "detail": "In the real game and the gallery, every corner was taken 6 to 7.5 m in from the corner flag, not from the flag.",
              "bars": [
                {
                  "label": "Distance from the flag",
                  "was": 6.75,
                  "now": 0.6,
                  "state": "good",
                  "unit": " m"
                },
                {
                  "label": "Pitch shown on corners",
                  "was": 42,
                  "now": 48,
                  "state": "warn",
                  "unit": " m"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: It was done on purpose: the corner camera never zoomed out, and it couldn't fit the flag, room to drag back for power, and the far post all at once.",
                  "Fix: The ball now starts in the corner arc, 0.45 to 0.75 m from the flag. On corners only, the camera shows 48 m of pitch instead of 42 m, so players look about 13% smaller; the far post and the pull-back room are unchanged. This needed a change to the core match engine, normally off-limits, which Mikey approved. In the gallery, the goal line and touchline now stop at the corner with the quarter circle drawn, like the match. Byline crosses are unchanged."
                ]
              }
            },
            {
              "title": "Four small numbers were reading the wrong scale (v0.11 · Mikey)",
              "detail": "The energy colours on the dashboard and pre-match screen didn't match the real selection lines. The dev fame buttons added +1,000 and set 100,000. The feed didn't weigh the fame you actually see. Voting read its reputation numbers from its own list.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Found in a check of money, fame, reputation and energy. The cause of each was not recorded.",
                  "Fix: Energy colours now follow the selection lines: green 65+ (starts), amber 40+ (bench), red below (left out). Dev fame buttons are +10 and Max = 100. The feed counts earned plus owned fame. Voting reads from the one reputation table."
                ]
              }
            },
            {
              "title": "Training vision past 70 did nothing in matches (v0.12 · Mikey)",
              "detail": "Vision added team-mates to pass to in two jumps (+1 at 40, +2 at 70), so training it from 70 to 100 made no difference.",
              "bars": [
                {
                  "label": "Team-mates per chance at vision 100",
                  "was": 4.19,
                  "now": 4.69,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The extra team-mates came in two fixed steps that stopped at 70.",
                  "Fix: Vision now works on a smooth curve: 40 plays as before, and every 10 points after that adds a quarter of a man. Over 1,500 chances: 3.18 team-mates per chance at 40, 4.18 at 80, 4.69 at 100."
                ]
              }
            },
            {
              "title": "Penalties went in 44% of the time; real ones go in about 82% (v0.14 · Harry)",
              "detail": "With a normal spread of kicks (mostly placed, some down the middle, a few chipped), only 44% went in and the keeper saved 53%. Real Premier League keepers save about 16%. A shot down the middle went in 13%, when in real football it scores about as often as one in the corner.",
              "bars": [
                {
                  "label": "Penalties scored",
                  "was": 44,
                  "now": 80,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Keeper saves",
                  "was": 53,
                  "now": 15,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The keeper was built to be beatable, not realistic. He dived only 80% of the time and only ever 1.4 m, so he never left the middle: that's why the middle was nearly always saved, and why he could still reach balls he'd guessed wrong on.",
                  "Fix: Harry's rule stays: he waits in the middle until you strike, then reads your kick. Now he goes 96% of the time (real keepers almost always dive), guesses your side about half the time (a top keeper 59%, never worse than a coin flip), dives a real 1 to 2.5 m, and can't reach back once he's committed."
                ]
              }
            },
            {
              "title": "Half of all corners were filmed from the wrong side (v0.14 · Harry)",
              "detail": "The camera problem Harry and Mikey saw: in a real match, 50.2% of corners were filmed as if from the other corner, with the taker up in the top third of the screen. A third of corners (34%) had the ball nudged off the pitch, and every corner was zoomed out 1.4 times, so everyone looked about 28% smaller.",
              "bars": [
                {
                  "label": "Corners filmed from the wrong side",
                  "was": 50.2,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Three slips. The match picks a corner flag at random, then lays a drawing over it; the drawing moved the ball to its own flag, but the camera stayed turned for the match's flag. The small random nudge that stops a drawing repeating exactly was meant for open play, and at a corner it pushed the ball over the line.",
                  "Fix: When a drawing is from the other flag, the match mirrors it onto the match's flag, so the camera, the ball and everyone agree. Every corner drawing now plays from both flags, which doubles the variety from the same 9 drawings. No nudge moves the ball at a corner, and the sideways view keeps its true size."
                ]
              }
            },
            {
              "title": "Three in four direct free kicks went in; real ones about 4% (v0.14 · Harry)",
              "detail": "Nobody had measured it: a sensible player scored 74% of direct free kicks (real Premier League 2023/24: 3.9%; Ward-Prowse, the best, 12.4%). The wall was always 3 or 4 men, centred on the middle of the goal whatever the angle, and a team-mate stood offside on the penalty spot.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The keeper stood still wherever he was dropped, often on the same side as the wall, so anything that cleared the wall and wasn't straight at him went in.",
                  "Fix: The wall stands 9.15 m away: 4 or 5 men from the middle, 3 or 4 from a half angle, 2 or 3 from a tight angle, with the end man just outside the near post. It jumps 85% of the time and stays down 15%, so going under it is a gamble. The keeper stands on his line shading to the far post, can't see through his wall, and reacts a fifth of a second after the ball clears it."
                ]
              }
            },
            {
              "title": "A third of saved cards opened with players in the wrong places (v0.14 · Harry)",
              "detail": "Found by the new screenshot check: 2 of 16 simulated long shots had a team-mate standing in the goal, the keeper out in midfield and YOU nowhere near the ball. Checking every saved card, 31 of 91 were opening wrong, mostly one-on-ones with YOU on the poacher's spot.",
              "bars": [
                {
                  "label": "Saved cards that open exactly as saved (of 91)",
                  "was": 60,
                  "now": 91,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: A saved card remembers who stood where by slot number (slot 7 is the keeper, and so on), then lays that over a fresh build of the same picture. When the fresh build changes shape, the slots shift and the keeper's spot lands on a team-mate.",
                  "Fix: If a card's slots still line up, nothing changes. If they don't, it's matched by role: keeper to keeper, YOU to YOU, defenders to defenders, team-mates by name then in order. A test now opens all 91 committed cards and checks everyone is back where he was saved."
                ]
              }
            },
            {
              "title": "Half the admin tabs were off the side of a phone screen (v0.14 · Harry)",
              "detail": "On a phone, the admin tabs from Blind Rankings to Export Backup were off the edge with no way to reach them. Across 33 admin screens, 181 things ran off the edge, 671 buttons were too small to tap, and 94 text boxes made an iPhone zoom in.",
              "bars": [
                {
                  "label": "Things running off the edge",
                  "was": 181,
                  "now": 16,
                  "state": "good",
                  "unit": ""
                },
                {
                  "label": "Buttons too small to tap",
                  "was": 671,
                  "now": 67,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The admin area was only ever laid out for a laptop.",
                  "Fix: Tabs wrap; rows put their buttons under the title; the image ✕ shows on touch screens (it was hover-only); images reorder by press and hold, then drag; text boxes are 16 px, so an iPhone stops zooming. The laptop look is unchanged. Seen in a phone-sized browser; the iPhone zoom can only be tried in Safari."
                ]
              }
            },
            {
              "title": "Test screens on a phone: the ball, pinned bars, buttons and the scoreboard (v0.14 · Harry)",
              "detail": "The ball you strike was below the bottom of the screen, pinned bars scrolled away, Next and Save needed scrolling, the scoreboard's labels were 8 px, and dribble runs started under their how-to card.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The test screens were built on a laptop and never checked at phone size.",
                  "Fix: The pitch scrolls on screen whenever a chance is served, bars pin on the test screens only, Next sits in the top bar, tap targets are 40 px, scoreboard labels are 11 px, and dribble runs open ready behind a Tap to start button."
                ]
              }
            },
            {
              "title": "The site's patch notes lost the pictures (v0.14 · Harry)",
              "detail": "Harry: the patch notes page on the site didn't look like the artifacts, and lost the pictures.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The site only ever stored each version's text, redrawn in the site's own style. Pictures, diagrams and layout were never saved.",
                  "Fix: Each version's real page, pictures included, is now kept in the code, and the site shows it exactly as published in a Page tab; the old view is the Text tab. All 15 versions and V1 are there, and V1 gained Mikey's v0.11 to v0.13 (143 changes at the time)."
                ]
              }
            },
            {
              "title": "Penalties: a run-up, one dive, and a keeper who can read you (v0.16 · Harry)",
              "detail": "Problem: penalties into the corners went in 88% of the time, the keeper dived and then dived back, and there was no run-up.",
              "bars": [
                {
                  "label": "Corner penalties scored (%)",
                  "was": 87.6,
                  "now": 75,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "All penalties scored (%)",
                  "was": 82.3,
                  "now": 76,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: the keeper could change his mind mid-dive, and the strike happened the instant you let go.",
                  "Fix: you stand 1.8 m behind the ball, aim, then jog in for 2.4 s with a 1-second countdown. Run out of time and you scuff it. He makes one dive and finishes it, and about half the time hops to a side first and dives that way.",
                  "Open question: watching the hop and aiming the other way scores 81.7% against 74.3% if you ignore it."
                ]
              }
            },
            {
              "title": "Corners and byline crosses cut the goal off (v0.16 · Harry)",
              "detail": "The view widens a little when it needs to: whole goal in view 0 → 300 of 300 corners, 113 → 300 byline crosses."
            },
            {
              "title": "Test screens: a foul said PENALTY, then reloaded the same picture (v0.16 · Harry)",
              "detail": "It now serves the penalty straight away (3 of 3)."
            },
            {
              "title": "Test screens: every penalty was the same (v0.16 · Harry)",
              "detail": "The keeper now varies and hops there too (hop 0% → 51.5%)."
            },
            {
              "title": "Shootouts: you never got to kick, and a loss said \"Won 2–4\" (v0.16 · Harry)",
              "detail": "You're always one of the five takers and the result reads your score first."
            },
            {
              "title": "The ball started off the bottom of the screen (v0.16 · Harry)",
              "detail": "The pitch is scrolled into view when a chance starts: 44% → 0."
            },
            {
              "title": "Buildup: two team-mates standing 0.33 m apart (v0.16 · Harry)",
              "detail": "That's how the drawing was made, not a code bug.",
              "pill": {
                "text": "blocked on Harry",
                "tone": "red"
              }
            },
            {
              "title": "Your club now plays at its real strength (v0.16 · Harry)",
              "detail": "The unseen match was told 60 for every club. Strongest clubs win 38–49% → 71–78% (planned figure, not re-measured after the build)."
            },
            {
              "title": "You can shoot past a man, and team-mates curl round him (v0.16 · Harry)",
              "detail": "A body is 0.7 m wide now. Long-range shots blocked 26% → 18%, cutbacks 45% → 37%.",
              "bars": [
                {
                  "label": "Long range shots blocked (%)",
                  "was": 26,
                  "now": 18,
                  "state": "good",
                  "unit": "%"
                }
              ]
            },
            {
              "title": "A team-mate no longer takes your shot (v0.16 · Harry)",
              "detail": "A team-mate right on your shot's line lets it go. Through balls he took 60% → 33%."
            },
            {
              "title": "The whole goal is always on screen (v0.16 · Harry)",
              "detail": "The camera slides or zooms out instead of moving the chance closer. Through balls now score 21.8% → 25.2%."
            },
            {
              "title": "Subbed on, then subbed off: gone (v0.16 · Harry)",
              "detail": "A sub only comes off for energy now."
            },
            {
              "title": "The dribble: 3D and three new cameras (v0.17 · Harry)",
              "detail": "Your old complaint, the ball sitting on your body instead of in front, was measured over 42 ball positions.",
              "bars": [
                {
                  "label": "Ball drawn over your body, of 42",
                  "was": 12,
                  "now": 0,
                  "target": 0,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "The four views",
                "points": [
                  "Today: 12 of 42. C1 low over the shoulder: 0. C2 higher from behind: 0. C3 closing in near a defender: 0–2.",
                  "The cameras change the view only, not the difficulty. In the C1 view the legs look like a normal stride."
                ]
              }
            },
            {
              "title": "Swiping between home pages didn't work with a finger (v0.17 · Harry)",
              "detail": "It only worked with a mouse. Tested with real touch events now."
            },
            {
              "title": "Post-match always said your stars went up by +0.1 (v0.17 · Harry)",
              "detail": "It shows the real jump now."
            },
            {
              "title": "Two old display bugs in Settings (v0.17 · Harry)",
              "detail": "A switch's knob sat outside its track, and the current save was cut off."
            },
            {
              "title": "The match lag: each face was drawn 13 times from the full-size photo, every frame (v0.18 · Harry)",
              "detail": "Now drawn once and reused. The fake-face pictures went from 1.9 MB to about 95 KB each. Faces look identical.",
              "bars": [
                {
                  "label": "Aiming, 2D look (ms a frame)",
                  "was": 124.5,
                  "now": 44.2,
                  "state": "good",
                  "unit": "ms"
                },
                {
                  "label": "Aiming, 3D look (ms a frame)",
                  "was": 155.1,
                  "now": 45.2,
                  "state": "good",
                  "unit": "ms"
                },
                {
                  "label": "Five-a-side (ms a frame)",
                  "was": 48.9,
                  "now": 31.7,
                  "state": "good",
                  "unit": "ms"
                },
                {
                  "label": "Ball in flight (ms a frame)",
                  "was": 50,
                  "now": 40.2,
                  "state": "good",
                  "unit": "ms"
                }
              ],
              "more": {
                "summary": "How it was measured",
                "points": [
                  "A real browser at phone size, processor slowed 6×, average of 2 runs. Lower is smoother."
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
                  "Fix: A check inside every deploy: the site won't go live with a new copy of the match, and the build log says what to fix. A second review tried to break it; the first version missed 21 of 31 tricks, so it now reads the code the way the compiler does. It caught all 10 planted copies and left 2 harmless look-alikes alone. It also found Goalie Mode's own ball physics and the team-understanding gap. Adds about 20 seconds to each deploy."
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
            },
            {
              "title": "Every trophy was an emoji (v0.11 · Mikey)",
              "detail": "Every trophy and award showed as an emoji (🏆 🥇 🏅).",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: 14 real trophy pictures now show in the Trophy Cabinet (including the Ballon d'Or box and each award), on the end-of-season award cards, in feed posts about a trophy win, and on the Garden's glass shelves (your 6 most recent). Backgrounds were cut out and each file shrank from about 2 MB to 27–81 KB. Community Shield, Super Cup, Conference League, European Championship and Play-Offs keep their emoji until pictures arrive."
                ]
              }
            },
            {
              "title": "You couldn't like a post in the feed (v0.11 · Mikey)",
              "detail": "Posts in the phone feed showed a like count, but you couldn't like them yourself.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Tap the heart: it pops pink and the count goes up by one (84 → 85). Tap again to unlike. Your likes are saved with the career."
                ]
              }
            },
            {
              "title": "The gallery had no way to choose a chance's camera (v0.11 · Mikey)",
              "detail": "In the scenario gallery you couldn't pick where the camera framed an 11-a-side chance. The Scenario Builder could.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The Scenario Builder already had this; the gallery didn't.",
                  "Fix: Every 11-a-side card has a \"Camera: pick on the whole pitch\" button: zoom out to the whole pitch, drag the dashed frame, let go, then \"Done — back to editing\". The camera saves with the scenario and the game frames the chance from there. Chances facing left or right aren't included yet."
                ]
              }
            },
            {
              "title": "Long shots had no rules to build new ones from (v0.11 · Mikey)",
              "detail": "The gallery couldn't simulate new long-range chances.",
              "bars": [
                {
                  "label": "Long-range drawings",
                  "was": 1,
                  "now": 13,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The gallery builds rules for a chance type from saved drawings and needs at least 5. Long range had 1.",
                  "Fix: 12 new long-range drawings: a defender steps out 4–8 m to close the shooter, the back line holds 11–15 m out (it used to sit 3.5 m out, on the keeper), and the keeper is just off his line toward his near post. Simulate: 400 of 400 built from the drawings, 0 rules broken, 3.75% with a minor fault."
                ]
              }
            },
            {
              "title": "Level 1 started with no explanation (v0.12 · Mikey)",
              "detail": "The first level of each training game started straight away, with nothing explaining how it works.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Level 1 of every game now opens on a how-it-works card: a small drawing, three one-line steps, the star rule and a \"Let's go\" button. Nothing starts, and Vision's timer doesn't run, until you press it."
                ]
              }
            },
            {
              "title": "Vision's timer started the moment the pitch appeared (v0.12 · Mikey)",
              "detail": "In Vision training the players appeared and the clock started at the same moment, with no warning.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Before every try the pitch is hidden behind a big 3, 2, 1, GO! with \"Pick the free pass\" under it; then the players appear and the timer starts. A miss runs the countdown again on the same picture."
                ]
              }
            },
            {
              "title": "Testing a late training level meant playing every level before it (v0.12 · Mikey)",
              "detail": "There was no way to jump straight to, say, level 25 of a training game to judge it.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Needed to judge each game's difficulty quickly.",
                  "Fix: A new Training Levels dev page (also in the admin menu under Star Career): pick a game, tap any of the 30 levels (all open), set the player's skills to 40, 70 or 100, and step between levels while playing. Nothing is saved. The dev panel in Settings can also unlock all 30 levels inside a career (not yet seen on screen)."
                ]
              }
            },
            {
              "title": "Early cup rounds were picked like league games (v0.13 · Mikey)",
              "detail": "A player who wasn't a regular had no extra route into early cup games.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: A player who isn't a regular now starts about 60% of early cup rounds (anything before the quarter-final). A regular is never rotated out."
                ]
              }
            },
            {
              "title": "Penalties, free kicks, corners, cutbacks and byline crosses now come from Harry's drawings (drawings · Mikey)",
              "detail": "Only four chance kinds were built from the team's drawings. Every penalty, free kick, corner, cutback and byline cross was still laid out by the game's own builder.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Six commits by Mikey put Harry's drawings into the game: 10 penalties, 12 free kicks, 9 corners, 5 cutbacks and 5 byline crosses. In real matches all five kinds are now one of Harry's drawings."
                ]
              }
            },
            {
              "title": "No way to choose which flag a corner is taken from (v0.14 · Harry)",
              "detail": "Harry asked for a way to pick the side in the editor. The side came from the card's random seed, with no button for it.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Nobody had needed it: corner drawings were only ever looked at from whichever side they came up on.",
                  "Fix: A Swap flag ⇄ button on corner and byline cross cards mirrors the whole picture onto the other corner, camera and all. Press it again to swap back. It survives Save and a reload."
                ]
              }
            },
            {
              "title": "No way into the test screens from a phone (v0.14 · Harry)",
              "detail": "On a phone the menu only linked the Admin page: the gallery, Play Area, training and every other test screen had no link, and the full-screen pages (gallery, Play Area, highlights) hid the menu with no way out.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The list of test screens only existed as a tab on the edge of a laptop screen.",
                  "Fix: The phone menu has \"Admin & Dev tools →\", which opens the same list (40 px rows), and full-screen test pages show the Admin tab on a phone too. Seen in an iPhone 13-sized browser."
                ]
              }
            },
            {
              "title": "Free-kick run-up (v0.16 · Harry)",
              "detail": "Same jog and 1-second countdown as penalties."
            },
            {
              "title": "Shootouts and penalties won without you are played live (v0.16 · Harry)",
              "detail": "Every kick on the real pitch. A top side wins one about every 6 games."
            },
            {
              "title": "A cheeky miss costs reputation (v0.16 · Harry)",
              "detail": "A missed penalty down the middle or a missed chip: -1 each, at most -2 a match."
            },
            {
              "title": "Late subs get chances (v0.16 · Harry)",
              "detail": "A 99 striker on at 80': 0.75 → 2.15 chances a cameo.",
              "bars": [
                {
                  "label": "Chances, on at 80'",
                  "was": 0.75,
                  "now": 2.15,
                  "state": "good"
                }
              ]
            },
            {
              "title": "Live scores during your match (v0.16 · Harry)",
              "detail": "Cards only for clubs you tick, one at a time, and a Scores panel with every game."
            },
            {
              "title": "Sim this match (v0.16 · Harry)",
              "detail": "Score, your goals and assists, rating and star bar. Deliberately a bit worse than playing."
            },
            {
              "title": "Real players in League One and Two (v0.16 · Harry)",
              "detail": "43 clubs, 1,154 players copied from last season a year older. Needs a database step run first.",
              "pill": {
                "text": "blocked on Harry",
                "tone": "red"
              }
            },
            {
              "title": "Match Radar (v0.16 · Harry)",
              "detail": "Watch the unseen 90 minutes, with injuries and energy at kick-off."
            },
            {
              "title": "A playtest recording can be read, and three standing rules for pages and plans (Harry's branch · Harry)",
              "detail": "A tool turns a screen recording into a picture each time the screen changes plus a transcript, so a plan can't paraphrase away what was on screen.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Harry's 40-minute spoken playtest became a plan that got two things wrong, because his words were paraphrased without the picture.",
                  "Fix: Recordings go in a Drive folder and are broken down by time. Three standing rules came with it: plan changes are built as throwaway test versions and filmed, pages stack their text in one full-width column, and the two match files are called sensitive, never by a person's name."
                ]
              }
            },
            {
              "title": "3D players on the pitch (v0.17 · Harry)",
              "detail": "Shaded kits, boots, a soft shadow and a fitted face. A player with no photo gets drawn hair in 5 styles, so nobody is bald.",
              "more": {
                "summary": "How it works",
                "points": [
                  "They use the same skeleton as today's players, so every run, kick and dive moves exactly as before; only the drawing on top is new.",
                  "Off by default, tried from Settings → Player look. It's no slower: 67–69 ms a frame against Classic's 74–79 ms on a slowed-down phone test."
                ]
              }
            },
            {
              "title": "Face scan: your photo becomes your face (v0.17 · Harry)",
              "detail": "Problem: \"still an issue when the player takes a picture\", and \"everyone can't be bald\". An uploaded photo is now cut out, straightened and fitted once, with a scan animation, and the hair is recreated.",
              "more": {
                "summary": "How it works",
                "points": [
                  "A face-finding tool that runs on the phone itself finds the face and outline, lines up the eyes, removes the background and redraws the hair. It works on busy backgrounds.",
                  "Your own photo has only been tested from a screenshot crop."
                ]
              }
            },
            {
              "title": "Recording tool: video links, and YouTube from your own Mac (v0.17 · Harry)",
              "detail": "Problem: the tool only took files, and YouTube blocks cloud servers, so a pasted YouTube link failed every way it was tried.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "From the cloud: TikTok, Drive, Dropbox and about 1,000 other video sites now work from a link.",
                  "From your Mac: a one-click Download YouTube button on the desktop. You tested it: \"unreal, it worked\".",
                  "720p is the default; a 25-minute video is 133 MB at 720p against 263 MB at 1080p."
                ]
              }
            },
            {
              "title": "Blender: a real 3D footballer, for celebrations and cut-scenes (v0.17 · Harry)",
              "detail": "5 stills, hair in several styles and 3 animation loops, on its own test page. Nothing reaches the game yet."
            },
            {
              "title": "Run-ups: 7 for penalties, 7 for free kicks (v0.17 · Harry)",
              "detail": "Chosen in Settings. Free kicks include Ronaldo's power stance, Bale, Messi's calm curl, Neymar, Maddison and Trent."
            },
            {
              "title": "The penalty keeper sometimes leans (v0.17 · Harry)",
              "detail": "About 35% of penalties. Right-corner penalties score 86.1% if he leans left, 72.3% with no lean and 55.7% if he leans right."
            },
            {
              "title": "The Store and Coins, inside the career (v0.17 · Harry)",
              "detail": "Daily specials, run-up animations, accessories and boosts. Coin packs say \"Coming soon\": there is no real payment."
            },
            {
              "title": "National League North and South player names (v0.18 · Harry)",
              "detail": "1,540 players at 63 clubs, from Wikipedia. Stored only; nothing plays with them yet. The ratings (42–56) are estimates, not real ratings."
            },
            {
              "title": "The ball moves on the strike screen (v0.19 · Mikey)",
              "detail": "Headers float across in an arc (\"Head it?\"), volleys bounce across, a ball at your feet bobbles about a third of the time. Dead balls stay still. Only where you tap counts; higher technique makes it slower."
            },
            {
              "title": "New chants (v0.19 · Mikey)",
              "detail": "Ronaldo, Messi, Wan-Bissaka, Rogers, João Pedro, Brobbey, Calvert-Lewin, Lukaku, plus Saka and Pogba. Names match despite accents and hyphens."
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
            },
            {
              "title": "Feed posts looked like boxed cards, not social media (v0.11 · Mikey)",
              "detail": "Each post in the phone feed sat in its own box with category labels, which didn't look like a real social media app.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Posts now run edge to edge with a thin line between them. Name, tick, handle and time sit on one line, category labels are gone, there's a full row of replies, reposts, likes, views and share, and graphics sit under the words like an attached picture. Only the look changed."
                ]
              }
            },
            {
              "title": "Switching energy mode mid-match did almost nothing (v0.11 · Mikey)",
              "detail": "Tapping High or Low during the commentary carried on the current stretch of the match at the old mode, and High barely changed anything.",
              "bars": [
                {
                  "label": "High mode: extra chances",
                  "was": 23,
                  "now": 35,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: A new mode only started at the next stretch, and High's extra chances ran into a cap at about +23%.",
                  "Fix: A switch now replays the rest of the stretch from the next minute at the new mode; everything already on screen stays the same. High also gets an extra share of chances that come only to you. Over 1,500 simulated matches: High +35% chances, Low −35%, Medium unchanged."
                ]
              }
            },
            {
              "title": "Energy mode buttons were plain (v0.11 · Mikey)",
              "detail": "The Low, Medium and High energy buttons in the live commentary were plain buttons, not icons.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: They are now icons drawn from Mikey's concept images: a split ring with a lightning bolt, red for Low, amber for Medium and green for High, with 2, 4 or 6 sparks so the level reads without colour. The chosen one glows and the others dim."
                ]
              }
            },
            {
              "title": "KIB cans gave small energy top-ups (v0.11 · Mikey)",
              "detail": "The Basic can and the half-time can gave +25 energy; Premium gave +50 and Elite +100.",
              "bars": [
                {
                  "label": "Basic can energy",
                  "was": 25,
                  "now": 65,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Basic and the half-time can (which is a Basic can) now give +65. Premium gives you the NS-Swerve curve for your next match, and Elite gives NS-Maestro's Touch Mode for your next match. A missed week keeps the effect, cans you already own work the new way, and the Shop and dashboard say what each one does."
                ]
              }
            },
            {
              "title": "NS-Swerve was far cheaper than NS-Maestro (v0.11 · Mikey)",
              "detail": "NS-Swerve cost ★2,300 while NS-Maestro cost ★35,000.",
              "bars": [
                {
                  "label": "NS-Swerve price",
                  "was": 2300,
                  "now": 35000,
                  "state": "warn",
                  "unit": "★"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Both boots give a whole new ability rather than a stat boost, so they should sit at the same top price.",
                  "Fix: NS-Swerve now costs ★35,000, the same as NS-Maestro."
                ]
              }
            },
            {
              "title": "The Scout Report's tactics box took too much of the page (v0.11 · Mikey)",
              "detail": "Before the team sheets, the Scout Report showed a big box of formation, playstyle and \"sit in two banks…\" text.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: It took up too much of the page.",
                  "Fix: The box is hidden, not deleted, and one switch brings it back. The opponent still sets up that way in the match."
                ]
              }
            },
            {
              "title": "Training was a new random picture every time, and skills rose in lumps (v0.12 · Mikey)",
              "detail": "Every training session was a random new picture, so you could never learn one or aim to beat it. Points came in lumps: a perfect session at age 18 was worth 10 points, so a young player could go from 40 to 100 in about 7 sessions.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The drill's shape followed your skill number, and its details (where blockers stand, how the keeper moves) were re-rolled every time. Points came from how well each go went, times an age bonus.",
                  "Fix: Each game now has 30 fixed levels, the same picture every time: level 1 is the old drill at skill 40, level 30 the old drill at 100 (Power goes from 20 m, 1 blocker and a keeper of 60 to 34 m, 4 blockers and a keeper of 93). You get 3 tries: in first time is ★★★, second ★★, third ★. Any star unlocks the next level, all 90 stars take a skill from 40 to 100 (3 new stars = +2), only new stars count, age makes no difference, and one level costs a day and 30 energy like a session did. Old saves keep their skill (70 opens with levels 1–15 at ★★★), skills still drop without training, and passing a level wins lost points back, one per star."
                ]
              }
            },
            {
              "title": "Free kick started lower than every other skill (v0.12 · Mikey)",
              "detail": "A new player's Free Kick started at 30; every other skill started at 40.",
              "bars": [
                {
                  "label": "Free kick at the start",
                  "was": 30,
                  "now": 40,
                  "state": "good",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Every skill now starts at 40, with ★ n/90 shown under it on the Skills screen."
                ]
              }
            },
            {
              "title": "Matches raised every skill (v0.12 · Mikey)",
              "detail": "A great match (rating 8+) added about +0.6 to every skill, in the first team and the youth team.",
              "bars": [
                {
                  "label": "Skill points from a great match",
                  "was": 0.6,
                  "now": 0,
                  "state": "warn",
                  "unit": ""
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Matches now give 0 skill points. Skills come only from training."
                ]
              }
            },
            {
              "title": "Pace made no difference to the Touch Mode chase (v0.12 · Mikey)",
              "detail": "With Touch Mode, every player chased the ball down at the same flat 7.6 m/s, whatever his pace.",
              "bars": [
                {
                  "label": "8 m Touch Mode chase, pace 100",
                  "was": 1.01,
                  "now": 0.81,
                  "state": "good",
                  "unit": " s"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The chase used one speed for everyone.",
                  "Fix: The chase now runs from 6.8 m/s at pace 40 to 8.4 m/s at pace 100. An 8 m chase at pace 100 takes 0.81 s. Pace already set your dribble-run speed and how often you get space to run into."
                ]
              }
            },
            {
              "title": "Free kick didn't count on corners or decide who takes set pieces (v0.12 · Mikey)",
              "detail": "Your Free Kick skill wasn't used on corners, and a better rating didn't make you the taker any more often.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Corners now use the same 60% free kick / 40% technique mix as free kicks and penalties. A better rating makes you the taker more often: free kicks plus corners per match, playing CM, go from 0.59 at 40 to 0.81 at 100 (up to 1.5 times the old share)."
                ]
              }
            },
            {
              "title": "The Skills screen didn't say what each skill does (v0.12 · Mikey)",
              "detail": "The Skills screen listed skills without saying what they change in a match.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: Each skill now says what it does, e.g. Pace \"Faster dribbles, more runs into space, quicker Touch Mode chase\", Vision \"More team-mates to pass to in every chance\", Free Kick \"Free kicks, corners and penalties — and how many are yours\"."
                ]
              }
            },
            {
              "title": "A new 18-year-old started every game, even at Man City (v0.13 · Mikey)",
              "detail": "The other players at your club never counted. A brand-new 18-year-old started every game from week one, at Man City the same as at Barnet.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The manager only looked at you: his opinion of you, your form, your star rating and your fitness.",
                  "Fix: Your rival is now the best real team-mate in your position. Rated higher than him, you start. Rated the same or lower, you start on the bench (the pre-match screen names him and compares your forms) and take his place with 2+ appearances at a recent average of 6.8, or when he drops under 6.0 while you're at 6.3+. Once you've won the shirt, ratings stop mattering and you keep it on form; a new club means winning it again, old saves where you've been playing keep their place, and a made-up squad has no rival. The bar is 6.8, not 7.0, because a short sub appearance pulls your rating towards 6.5 and 7.0 would need two goals in three appearances."
                ]
              }
            },
            {
              "title": "Form took five games to count (v0.13 · Mikey)",
              "detail": "The manager judged your form over your last 5 matches, so a bad run took a long time to cost you your place, or to win it back.",
              "bars": [
                {
                  "label": "Matches judged for form",
                  "was": 5,
                  "now": 3,
                  "state": "good",
                  "unit": ""
                },
                {
                  "label": "Form's share of the manager's score",
                  "was": 30,
                  "now": 35,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Not recorded.",
                  "Fix: He now judges your last 3 matches, and form is 35% of his score (his opinion of you drops from 45% to 40%). Three poor games (5.5) bench you, three good ones off the bench (7.2) win your place back, and two dreadful games (4.8) are enough on their own."
                ]
              }
            },
            {
              "title": "A substitute always came on between 58' and 72' (v0.13 · Mikey)",
              "detail": "If you started on the bench, you came on somewhere between the 58th and 72nd minute, whatever the score.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The time was picked from a fixed window that ignored the score.",
                  "Fix: From the 50th minute, the sub now comes on when the game needs him: 2 down 50', 1 down 56', level 64', 1 up 72', well ahead 80', give or take up to 4 minutes. The pre-match screen says \"Bench (on when the game needs you)\"."
                ]
              }
            },
            {
              "title": "Hand-written corner rules made the pictures worse than the drawings (v0.14 · Harry)",
              "detail": "Harry: \"the corner and long range highlight sims suck.\" Earlier that evening, hand-written corner rules (who marks whom, where the keeper stands) had brought corners down to real-football numbers, but the pictures showed players stacked on each other, a stray team-mate nowhere near the play, and a defender standing on the goal l…",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The rules moved people away from where Harry had drawn them. Underneath, three more slips: the builder's own spare men were left wherever it put them (about one per picture), a corner came out a defender short of its drawing (4.9 against 6.0), and the random nudge could push two men into each other.",
                  "Fix: The rules are deleted: corners now work like one-on-ones, the drawings plus the rules scanned off them (a rule only counts if 90% of the drawings agree). A corner or long shot carries exactly its drawing's men, and no nudge brings two players closer than the drawing's own closest pair. Standing rule from now on: anything outside the drawings is checked by eye, on a sheet of screenshots, before it ships."
                ]
              }
            },
            {
              "title": "Hand-written long-shot rules bent every drawing (v0.14 · Harry)",
              "detail": "Same as corners: the long-shot pictures looked worse than the drawings. Earlier that evening a set of long-shot rules had brought an ordinary player's long shots from 13.6% down to a real-football 4.5%.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: The rules pulled every drawing closer to goal, closed up the back line, put a man in the shooting lane and moved team-mates. The 24 long-shot drawings are all 23 to 33 m out, so nearly every picture was bent away from what was drawn.",
                  "Fix: Rules deleted: a long shot is its drawing, as drawn, like a one-on-one. The cost: an ordinary player's long shot scores 13.8% again, about 3 times real football (4 to 6%). Harry's call: fun over real-life numbers, changed only if it feels wrong in play."
                ]
              }
            },
            {
              "title": "Being behind, or much stronger, didn't bring more long shots (v0.14 · Harry)",
              "detail": "Losing late made no difference to how often you got a long shot, and a much stronger side got fewer (a striker at 85 against 60: 4.7%, against 7.1% at 60 against 85). Real football is the other way round: a side facing a deep defence shoots from range more.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Nothing that picks the kind of chance looked at the score or the strength gap.",
                  "Fix: From the 60th minute when you're losing, or when your side is 15+ points better, a long shot is twice as likely wherever it's already an option. Overall it moves only 0.1 to 0.3 points, so long shots don't take over."
                ]
              }
            },
            {
              "title": "A drawing's camera fed into the chances a match serves (v0.14 · Harry)",
              "detail": "Harry: a camera change on one highlight must stay on that card, not feed the chances a match serves. The framing also cut off part of the goal on 29 of 300 served corners.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: Served chances could take their frame from a drawing's camera.",
                  "Fix: A served chance now gets its kind's standard frame, fitted to the players in it: sideways it's centred on everyone, the ball and you stay 3 m clear of the edge, and the goal is never cut off. Corners keep today's frame, Harry's pick. Frames move 1 to 2 m on average, so chances look the same. Checked by eye on sheets of 16 pictures."
                ]
              }
            },
            {
              "title": "One keeper everywhere, set to Middle (v0.16 · Harry)",
              "detail": "He walks up to 2.2 m while you aim, then dives once, paced to arrive with the ball. Keepers who are 88 rated now concede fewer than 45-rated ones in every kind of chance; the Hard / Middle / Easier setting is a test-screen dial only."
            },
            {
              "title": "Every chance is made the same way: your drawings, varied (v0.16 · Harry)",
              "detail": "Mirrored half the time and never one of the last 5. One-on-ones a match 0.34 → 1.85."
            },
            {
              "title": "The drag is 25% shorter, measured from your thumb (v0.16 · Harry)",
              "detail": "Full power at power 55: 12.6% → 9.5% of the screen."
            },
            {
              "title": "Figures are the same size in training, trial and the match (v0.16 · Harry)",
              "detail": "Drills were up to 46% too big; now within 2.3%."
            },
            {
              "title": "Problem: the home screen was \"all messed up\" and every other screen looked like an older game (v0.17 · Harry)",
              "detail": "Flat cans, six squashed buttons, a 2D avatar with no flash, and uploaded photos sitting on it like a sticker.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: each screen was built on its own over the months with its own colours and buttons, so there was no single place to change the look.",
                  "Fix: one shared design kit (club-lit glass cards, pills, buttons that press in, bursts, count-ups) with every screen rebuilt on it, and 3D-look players.",
                  "A real title screen, and Home with you in the middle and Play raised in the middle.",
                  "Matchday: Play, role, energy, Sharpness and all three cans now fit above the pinned bar (the match box went from about 245 px tall to 80).",
                  "League, Stats, Training, Relations, Phone, Shop, Store, Casino, awards, transfers, votes, team sheets, cup draw and Settings all rebuilt. Every number stays on screen."
                ]
              }
            },
            {
              "title": "Fitness is now called Sharpness (v0.17 · Harry)",
              "detail": "Same number; it goes up by playing and drops each week you don't."
            },
            {
              "title": "League table zones follow each division (v0.17 · Harry)",
              "detail": "The Premier League shows title, Champions League, Europa League and relegation; lower divisions show promotion and play-offs."
            },
            {
              "title": "Settings, reorganised (v0.17 · Harry)",
              "detail": "Game, You, Player graphics, Saves, Developer tools, then Exit career. Main menu is at the top right."
            },
            {
              "title": "2 of 8 steps done: smooth on slow phones, and 3D players as standard (v0.18 · Harry)",
              "detail": "Step 3, safe saves, is ready and waiting on your yes."
            },
            {
              "title": "Safe saves come next (v0.18 · Harry)",
              "detail": "Stop careers being lost between phone and PC. Saves shrink from 1.4 MB to about 300 KB, so about 400 careers fit in the free database instead of about 85."
            },
            {
              "title": "Then accounts, the app itself, testing, 12 testers for 14 days, and store review (v0.18 · Harry)",
              "detail": "Apple is $99 a year (1–3 days to approve); Google is $25 once. The 12-testers step is the slowest, so start it early.",
              "more": {
                "summary": "The rest of the steps",
                "points": [
                  "The app itself wraps the real game and adds what Apple requires: Sign in with Apple, a phone-style Google sign-in, saves kept on the phone, an offline screen and the back button.",
                  "Apple review takes about 1.5 days; Google's first review takes 7–14 days.",
                  "After it's live: no store review for game changes. The app opens the live game from the website, so anything pushed there reaches everyone next time they open it. Worked out from Apple's and Google's rules; not tested yet because the app doesn't exist yet."
                ]
              }
            },
            {
              "title": "Problem: 4 ways a player can lose a career today (v0.18 · Harry)",
              "detail": "Offline on the phone then PC (the PC save wins with no warning), closing within 3 seconds of a change, an iPhone clearing website storage after 7 days, and a full phone silently dropping the save.",
              "more": {
                "summary": "Fixes, and how sure we are",
                "points": [
                  "Fixes: ask which save to keep, save the moment the app is hidden, keep saves on the phone in the app, smaller saves plus a storage warning.",
                  "Read from the save code, not reproduced on two real devices."
                ]
              }
            },
            {
              "title": "3D is the default look (v0.18 · Harry)",
              "detail": "Your answer in v0.17. Classic 2D is one tap away."
            },
            {
              "title": "Dribble camera C1, a smoother 3D kick, League Two's top 3 go straight up (v0.18 · Harry)",
              "detail": "Your answers to the v0.17 questions."
            },
            {
              "title": "Live scores are the pop-up card again (v0.18 · Harry)",
              "detail": "\"Fit the aesthetic more.\""
            },
            {
              "title": "Every boot and lifestyle item comes in 5 levels (v0.19 · Mikey)",
              "detail": "Problem: each item had one price and sat in one money tier. Fix: level 1 priced for National League money up to level 5 for the Premier League; boots about 25% more power and technique per level, lifestyle about 40% more fame. You own one level of each item; a higher one replaces it. Old saves keep what they own.",
              "bars": [
                {
                  "label": "Phone price, L1 → L5",
                  "was": 30,
                  "now": 920,
                  "state": "good",
                  "unit": "★"
                }
              ]
            },
            {
              "title": "Commentary barely repeats (v0.19 · Mikey)",
              "detail": "About 300 new lines, and a line isn't reused while unused ones remain. Repeats per match: 8.3 → 0.1 (200 simulated matches).",
              "bars": [
                {
                  "label": "Repeated lines per match",
                  "was": 8.3,
                  "now": 0.1,
                  "state": "good"
                }
              ]
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
              "title": "One number was changed in the core engine file (sensitive) (raised in v0.4 · Harry)",
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
            },
            {
              "title": "Google Analytics counts our own test browsers as new UK users (raised in v0.11 · Mikey)",
              "detail": "Most of the ~120 \"new users\" (118 in the UK, no sign-ups) are likely automated test browsers. A fix to only count the real site and real browsers is ready, waiting on a yes.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Analytics loads on every copy of the site, including local test copies.",
                  "Status: Still open as of v0.13. A fix is ready, waiting on a yes. Mikey's v0.19 lists it as high priority: the fix is ready and waiting on a yes."
                ]
              }
            },
            {
              "title": "Pitch drawing fixes not yet seen in a real career match (raised in v0.11 · Mikey)",
              "detail": "Players in front, the ball behind, and corners were seen in Infinite Highlights, not in a career match.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Infinite Highlights draws with the same code as the match, so it was used to check them.",
                  "Status: Still open."
                ]
              }
            },
            {
              "title": "Trial: the dribble stage starts behind its how-to card (raised in v0.11 · Mikey)",
              "detail": "The run is already going while the teaching card is still up. The trial's dev skip panel is also open to everyone. Fixes ready, waiting on a yes.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not recorded.",
                  "Status: Still open."
                ]
              }
            },
            {
              "title": "Scenario editor \"ball at your feet\" was undone (raised in v0.11 · Mikey)",
              "detail": "It shipped, then Harry reverted it; the ball is placed on its own again.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The ball locked to your right side.",
                  "Status: Still open."
                ]
              }
            },
            {
              "title": "Winning a training level not yet seen on a screen (raised in v0.12 · Mikey)",
              "detail": "The star screen, \"Level 2 unlocked\" and the +2 haven't been seen. The rules pass their tests.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The playtest couldn't land a shot through the cones.",
                  "Status: Still not seen as of v0.13."
                ]
              }
            },
            {
              "title": "The \"Not this time\" screen wasn't caught (raised in v0.12 · Mikey)",
              "detail": "After three misses it should show for about 1.5 s before going back. The playtest went straight back to Training.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The playtest may have missed it.",
                  "Status: Still open."
                ]
              }
            },
            {
              "title": "Two drawing tests fail on main (raised in v0.12 · Mikey)",
              "detail": "The one-on-one drawings check fails 7 checks, and long shots show 40 faults in 300 (the limit is under 30). Both fail on main without these changes.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: One-on-one drawing changes on main, and a long-shot drawing being deleted.",
                  "Status: Still open as of v0.13: the one-on-one drawings check and the long-shot rules check."
                ]
              }
            },
            {
              "title": "Selection changes not seen in a real career yet (raised in v0.13 · Mikey)",
              "detail": "The rules pass their tests but nobody has watched them on a real career's pre-match screen.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The test browser can't load real squads, so it never gets a rival.",
                  "Status: Still open."
                ]
              }
            },
            {
              "title": "A penalty 2 m inside the post is the weakest place to aim (raised in v0.14 · Harry)",
              "detail": "Corners and the middle score about 85%, but a kick 2 m inside the post only 55 to 62%.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The match's keeper has one fixed body size, so when he guesses right he nearly always reaches a ball that close to him.",
                  "Status: Still inside Harry's 50% floor. Changing it needs the core engine file (sensitive), so Mikey's go-ahead. Not re-measured since v0.16's one-dive keeper and run-up."
                ]
              }
            },
            {
              "title": "Three shooting quirks sit in the core engine file (sensitive) (raised in v0.14 · Harry)",
              "detail": "Free kicks over the wall rarely go in (2.7%). Curl is strong even for an ordinary player: 10.7% of his curled long shots go in, twice his driven ones. A specialist's hard, low long shot hits the bar 12.6% of the time.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The ball has no dip in the air, so one that clears the wall arrives slow and high and the keeper gets there. How much a player can bend it, and how a hard strike lifts, are set inside the core engine file.",
                  "Status: Not started. Each needs a change to the core engine file (sensitive), so Mikey's go-ahead."
                ]
              }
            },
            {
              "title": "Harry's free-kick test still fails (raised in v0.16 · Harry)",
              "detail": "3 of 190 test files fail after v0.16: authoredChance, freeKickRules and longRangeRules. Two are the ones above (raised in v0.9 and v0.12); the free-kick one is the test that started failing when free kicks came from the drawings.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Not caused by v0.16: all three fail on the live version too.",
                  "Status: Still failing. 187 of 190 pass. Still failing in v0.17 and v0.18: 198 of 201 test files pass. (still failing)"
                ]
              }
            },
            {
              "title": "23 drawings still carry the old keeper spots (raised in v0.16 · Harry)",
              "detail": "Saved while the keeper rules were on, these drawings have the keeper exactly where the old rules put him. Now that the drawing is the team, that's where he stands.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Drawings weren't edited by the build.",
                  "Status: Harry to fix them in the gallery when ready. (awaiting Harry)"
                ]
              }
            },
            {
              "title": "None of the 10 penalty drawings obey the penalty rules (raised in v0.16 · Harry)",
              "detail": "The keeper is drawn 0.38 to 0.84 m behind his line in all 10, you're 1.3 m to the side of the ball, and in most, other players are 0.01 to 0.35 m inside the box. Worst: 7907 (POACH 0.35 m inside the box), 7906 (POACH 0.33 m inside), gallery-main-penalty (POACH/T1 2.77 m behind the line).",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The drawings were made before the rules; the game corrects them when a penalty is played, so nothing looks wrong in a match.",
                  "Status: Not edited. In the gallery they still show the old positions. (awaiting Harry)"
                ]
              }
            },
            {
              "title": "A buildup drawing has two team-mates 0.33 m apart (raised in v0.16 · Harry)",
              "detail": "Seen in the final playtest: two of your players almost on top of each other.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: That's how the drawing was made, and the drawing is now the team.",
                  "Status: Harry to fix it in the drawings, as he said. (awaiting Harry)"
                ]
              }
            },
            {
              "title": "Fouls when closed down, and OFF THE WALL labels, not seen by a person (raised in v0.16 · Harry)",
              "detail": "Both are built and measured, but nobody has played them yet.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Play a Premier League chance and hold the ball until you're closed down (about 1 in 3 should be a foul); hit a free kick into the wall. (not seen yet)"
                ]
              }
            },
            {
              "title": "Real League One and Two players need a database step (raised in v0.16 · Harry)",
              "detail": "fc27_clone_lower_leagues.sql hasn't been run in Supabase.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Pending. Until it's run, League One and Two keep invented players. (awaiting Harry)"
                ]
              }
            },
            {
              "title": "Changes to the core engine file (sensitive) for Mikey to see (raised in v0.16 · Harry)",
              "detail": "Each only switches on when its new setting is there, so old behaviour is unchanged without it.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Mikey to see them."
                ]
              }
            },
            {
              "title": "Much of the new look hasn't been seen on a real phone or in a real career (raised in v0.17 · Harry)",
              "detail": "Not seen on a screen: the Ballon d'Or countdown and final-two reveal (the test save had no shortlist), a signing reached through a real transfer window, reduce-motion on a real phone, and the photo picker's camera and crop stages. Most reskinned screens were filmed on a test page that uses the real screens with a test save;",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: Worked out from the code, but not played.",
                  "Status: Open. Swipe with a finger, tap Play on a small phone, play a match and watch the post-match screen. (not seen yet)"
                ]
              }
            },
            {
              "title": "The Phone button's red dot doesn't pop (raised in v0.17 · Harry)",
              "detail": "Badges only pop on the app icons inside the phone, not on the Phone button in the bottom bar.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Open. (small)"
                ]
              }
            },
            {
              "title": "Goalie Mode keeps its old top bar (raised in v0.17 · Harry)",
              "detail": "It lives inside the game canvas, which the reskin left alone.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Open. (small)"
                ]
              }
            },
            {
              "title": "\"Since you last looked\" is forgotten when you close the tab (raised in v0.17 · Harry)",
              "detail": "The League rows sliding and the Relations bars moving only happen within one visit.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Open. (small)"
                ]
              }
            },
            {
              "title": "There are two drawings of every player (raised in v0.17 · Harry)",
              "detail": "Classic and 3D share one skeleton but are drawn separately, so a change to body proportions has to be made twice.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Open. Nobody has asked to change it yet. (to remember)"
                ]
              }
            },
            {
              "title": "Blender's first clip and the Mac buttons are undecided (raised in v0.17 · Harry)",
              "detail": "The first Blender clip could be a goal celebration, a tunnel walk-out, or parked. The next Mac button could be a database checker (the security one first), a player-faces tool, or recordings copying themselves into the Drive folder.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Undecided in v0.18: Blender's first clip is open, and there are no Mac buttons for now. The database checker matters because 6 known security holes sit behind one database step. (your call)"
                ]
              }
            },
            {
              "title": "The face scan has only been tested on a screenshot crop of your photo (raised in v0.17 · Harry)",
              "detail": "The photo you use has only been tried from a screenshot crop.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: You're testing it in the game. (being tested)"
                ]
              }
            },
            {
              "title": "Shared files changed, for Mikey to see (raised in v0.17 · Harry)",
              "detail": "The title screen, Home button and exit wiring in the star-dev page, a new package (the face-scan library), and a new face-fitting file. The core engine file (sensitive) is untouched.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Mikey to see them."
                ]
              }
            },
            {
              "title": "The 3D / 2D button sits on the card's dotted light icon (raised in v0.18 · Harry)",
              "detail": "Seen at both phone sizes: the button overlaps the small dotted light on the Home card.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Quick fix, not done. (small)"
                ]
              }
            },
            {
              "title": "On small Androids the match bar reads \"ASSISTSPASS\" (raised in v0.18 · Harry)",
              "detail": "At 360 px wide the labels touch.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Quick fix, not done. (small)"
                ]
              }
            },
            {
              "title": "Aiming is still about 20 frames a second on a slow phone (raised in v0.18 · Harry)",
              "detail": "Aiming is three times faster than before, but not smooth on the slowest phones.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Why: The pitch is repainted while nothing moves.",
                  "Status: Half fixed. The next step is to stop repainting the pitch while nothing moves, only if players notice. (half fixed)"
                ]
              }
            },
            {
              "title": "NS-Swerve and NS-Maestro abilities come with every level (raised in v0.19 · Mikey)",
              "detail": "Touch Mode costs about ★1,200 at level 1, so the abilities come with every level of those boots.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Waiting on a decision. Low priority. (low)"
                ]
              }
            },
            {
              "title": "Floating and bouncing balls don't appear in matches yet (raised in v0.19 · Mikey)",
              "detail": "Headers and volleys are switched off in matches, so the new moving balls only show on the test page.",
              "more": {
                "summary": "Why, and where it stands",
                "points": [
                  "Status: Open. Low priority. (low)"
                ]
              }
            }
          ]
        },
        {
          "kind": "next",
          "title": "Decisions waiting on Harry",
          "items": [
            {
              "title": "(a) The penalty hop can be beaten (v0.16 · Harry)",
              "detail": "Watch the hop and aim the other way: 81.7% scored. Ignore it: 74.3%.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Smaller, later hop: less time to see it; 2. Sometimes a fake hop: he hops one way and dives the other (breaks Harry's \"no change of direction after the hop\"); 3. Leave it: reading the keeper is a skill",
                  "Recommended: Smaller, later hop. It keeps Harry's rule and closes most of the gap."
                ]
              }
            },
            {
              "title": "(b) Tight angles are now the most common striker chance (v0.16 · Harry)",
              "detail": "25.8% of a striker's chances (was 13.7%).",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Leave it; 2. Cap at about 15%; 3. Draw more of the other kinds so the drawings balance it",
                  "Recommended: Cap at about 15% now; drawing more is the long-term fix."
                ]
              }
            },
            {
              "title": "(c) Vision no longer changes how many team-mates a drawn chance has (v0.16 · Harry)",
              "detail": "The drawing now decides who's there.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Drawing wins: vision does nothing here; 2. Vision removes or adds a runner; 3. Vision changes which runners react: same men, better vision means more of them make a run",
                  "Recommended: Vision changes which runners react. The drawing stays intact and vision still matters."
                ]
              }
            },
            {
              "title": "(d) The 6.5 pull on short cameos (v0.16 · Harry)",
              "detail": "A sub's rating is pulled toward 6.5.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Keep; 2. Drop; 3. Smaller",
                  "Recommended: Smaller. Late subs now get 2+ chances, so there's more to judge them on."
                ]
              }
            },
            {
              "title": "(e) Saves (item 33) were left out: what should they be? (v0.16 · Harry)",
              "detail": "Harry wants other options.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. This device only; 2. Your account, 3 slots; 3. Both",
                  "Recommended: Your account, 3 slots. That mostly exists already and needs one database step."
                ]
              }
            },
            {
              "title": "(f) The National League has no player data (v0.16 · Harry)",
              "detail": "16 clubs play invented players.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Look for Football Manager / FM Scout data packs; 2. Keep invented players with fake faces",
                  "Recommended: Look, as Harry asked; keep fake faces meanwhile."
                ]
              }
            },
            {
              "title": "(g) Shootouts: as 5th taker you still miss about 44% of them (v0.16 · Harry)",
              "detail": "The shootout ends before your kick.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Keep your place by rating; 2. Always 1st to 3rd; 3. Choose your slot before it starts",
                  "Recommended: Always 1st to 3rd. You always get to kick, with no extra screen."
                ]
              }
            },
            {
              "title": "(h) The Home screen has no layout switch any more (v0.16 · Harry)",
              "detail": "Only \"you first\" was built.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Keep \"you first\" only; 2. Bring the switch back",
                  "Recommended: Keep."
                ]
              }
            },
            {
              "title": "(i) Keeper antics on his line (Harry's idea) (v0.16 · Harry)",
              "detail": "Not built.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Later; 2. Now",
                  "Recommended: Later, after the highlight-choosing redesign."
                ]
              }
            },
            {
              "title": "(A) Start safe saves now? (v0.18 · Harry)",
              "detail": "Safe saves are ready (see the App Store road map). They protect players today and the app needs them anyway.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. yes; 2. wait",
                  "Recommended: yes. It protects players today, and the app needs it anyway."
                ]
              }
            },
            {
              "title": "(B) Apple account: you, or a company? (v0.18 · Harry)",
              "detail": "The App Store account decides whose name shows as the seller.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Individual: your name shows as the seller, 1 to 3 days; 2. Company: \"Knowitball\" shows, needs a company and a free D-U-N-S number, 1 to 2 weeks",
                  "Recommended: company if you have or plan one, otherwise individual now."
                ]
              }
            },
            {
              "title": "(C) Who are the 12 testers? (v0.18 · Harry)",
              "detail": "Google requires 12 testers for 14 days before a new account's first app can go public. They must opt in and play for 14 days in a row.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. Friends; 2. The site's regulars; 3. A paid testing service (about $10 to $30, but Google checks for real use)",
                  "No recommendation given. Start early: it's the slowest step."
                ]
              }
            },
            {
              "title": "(D) Will coins ever cost real money? (v0.18 · Harry)",
              "detail": "If yes, Apple and Google require their own payment system and take 15 to 30%.",
              "more": {
                "summary": "Options and my pick",
                "points": [
                  "Options: 1. no; 2. later",
                  "No recommendation given."
                ]
              }
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Added in the 1 Oct and 3 Oct updates (v0.20 to v0.25)",
          "items": [
            {
              "title": "v0.20 · Mikey (12): a new 1 to 10 star rating, 7 boots, dearer Style, 2 training sessions a week",
              "detail": "Your star rating was just your skills divided by 20, so it told you nothing about your career.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Why: one number was doing two jobs, how good you are and how far you have come.",
                  "Fix: a separate star rating that you earn through your career. Overall stays what the manager picks on."
                ]
              }
            },
            {
              "title": "v0.21 · Mikey (7): Sponsors rebuilt",
              "detail": "Sponsor deals lasted forever once signed, and money came from a bar rather than from the brand.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Fix: brands send you offers, you have deal slots that grow with fame, deals pay every week with your wage, and each brand's happiness decides the renewal."
                ]
              }
            },
            {
              "title": "v0.20 review · Harry (35): star rating out of 100, a four-stage trial with a shootout, a picture shop, a signing scene",
              "detail": "Harry's review of Mikey's v0.20, built as test copies. Went live with v0.25."
            },
            {
              "title": "v0.22 · Harry (25): Home on one screen, an unlock chain, a green Pitch look",
              "detail": "Home was 677 px tall in a 572 px room, so you scrolled; a new career had everything open at once.",
              "bars": [
                {
                  "label": "Home scroll at 390×844",
                  "was": 105,
                  "now": 0,
                  "state": "good",
                  "unit": " px"
                },
                {
                  "label": "Home scroll at 360×640",
                  "was": 309,
                  "now": 0,
                  "state": "good",
                  "unit": " px"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Fix: Home is 375 px tall at 390×844 and fits three phone sizes. A new career starts with only Home and Training open and unlocks the rest step by step."
                ]
              }
            },
            {
              "title": "v0.23 · Harry (52): an app-style Home and look, a shorter trial, National League North and South, every shop picture in Blender",
              "detail": "Every screen had its own header, thin rounded bars and floating dark cards, and the trial dragged on.",
              "bars": [
                {
                  "label": "Whole trial, same bot (s)",
                  "was": 163,
                  "now": 75.8,
                  "state": "good",
                  "unit": " s"
                },
                {
                  "label": "Stats tab rows (px)",
                  "was": 126,
                  "now": 30,
                  "state": "good",
                  "unit": " px"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Fix: one top strip on every screen, a Home that never scrolls, one go per drill, a rigged shootout and a scout at the end. 186 shop pictures are now Blender renders, and North and South are playable divisions (5 to 7)."
                ]
              }
            },
            {
              "title": "v0.23.1 · Harry (17): liquid bars, a quieter look, a simple way home, a nicer signing and title screen, sounds",
              "detail": "The bars were ticked blocks and bottom-left said Achievements, so there was no button to get home.",
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Fix: smooth glowing bars, Home bottom-left, a ? on every main screen, tap anywhere to start the match, a full contract paper, and sounds outside the match."
                ]
              }
            },
            {
              "title": "v0.24 · Harry (31): winnable highlights, a reworked trial, square top bars with 3D icons",
              "detail": "Almost every highlight was impossible: a defender could start right on the ball.",
              "bars": [
                {
                  "label": "Tight angle with a defender on the ball (%)",
                  "was": 6.6,
                  "now": 0,
                  "state": "good",
                  "unit": "%"
                },
                {
                  "label": "Training Power level 1: pass within 3 tries (%)",
                  "was": 6,
                  "now": 100,
                  "state": "good",
                  "unit": "%"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Fix: a defender can no longer start closer than 1.5 m to the ball. Also a guided first training, help that opens by itself, a Sound Board admin page, a 3D Test Area, boots on a plank with an unboxing."
                ]
              }
            },
            {
              "title": "v0.25 · Harry (19): live 3D signing, a 3D shop, a rebuilt garden, a first game before the tutorials",
              "detail": "The signing was a flat picture, and the start explained every page before you played.",
              "bars": [
                {
                  "label": "Play to first chance (s)",
                  "was": 15.2,
                  "now": 0.5,
                  "state": "good",
                  "unit": " s"
                },
                {
                  "label": "Shootouts where both team-mates miss the same way",
                  "was": 554,
                  "now": 0,
                  "state": "good"
                }
              ],
              "more": {
                "summary": "Why, and the fix",
                "points": [
                  "Fix: your own player signs live in 3D (off by default), a 3D shop you can walk round, and the first game comes before the tutorials. Shootouts and defenders play fairer, iPhone full screen works through Add to Home Screen, and fewer buttons make a sound."
                ]
              }
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/YEK3ykwCQjUpH4S6bQbqKR",
      "updatedAt": "2026-10-03T03:00:00Z"
    },
    {
      "version": "0.13",
      "title": "Mikey's patch notes",
      "publishedAt": "2026-09-26T12:00:00Z",
      "summary": "The headline: how you get picked. A better-rated team-mate in your position starts ahead of you until you win the shirt; once won, you keep it on form. Form now counts over 3 games, subs come on when the score says, and fringe players start some early cup rounds.",
      "stats": [
        {
          "value": "5 → 3",
          "label": "matches the manager judges your form on"
        },
        {
          "value": "50'–80'",
          "label": "when a sub comes on now, going by the score (was always 58'–72')"
        },
        {
          "value": "6.8",
          "label": "recent form that wins you the shirt over a better-rated rival"
        },
        {
          "value": "60%",
          "label": "early cup rounds a fringe player starts"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Three poor games puts you on the bench; three good ones win it back",
              "detail": "Any career, watch the pre-match screen."
            },
            {
              "title": "Subs come on sooner when you're losing",
              "detail": "A match where you start on the bench."
            },
            {
              "title": "A better-rated team-mate in your position starts ahead of you until you win the shirt",
              "detail": "A new career, or a transfer to a club with a stronger player in your spot."
            },
            {
              "title": "Once you've won the shirt, you keep it on form",
              "detail": "Keep playing after winning it."
            },
            {
              "title": "Fringe players start some early cup rounds",
              "detail": "A cup game before the quarter-final while you're on the bench."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "The headline: how you get picked",
          "items": [
            {
              "title": "Win your shirt from a better-rated rival",
              "detail": "Problem: the rest of your squad never counted, so a new 18-year-old started every game at Man City. Fix: rated higher than the best team-mate in your position, you start; rated the same or lower, you start on the bench and take his place with 2+ appearances at a 6.8 average, or when he hits a bad patch (under 6.0) while you're at 6.3+. Once won, ratings stop mattering. A new club means winning it again; old saves keep their place; made-up squads have no rival."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Form counts faster",
              "detail": "Last 3 matches (was 5); form is 35% of the manager's score (was 30%). Three poor games (5.5) bench you, three good ones (7.2) win it back."
            },
            {
              "title": "A substitute comes on when the game needs him",
              "detail": "2 down 50', 1 down 56', level 64', 1 up 72', well ahead 80' (was always 58'–72')."
            },
            {
              "title": "Cup rotation",
              "detail": "A regular is never rotated out. A fringe player starts about 60% of early cup rounds."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Selection changes not seen in a real career yet",
              "detail": "The test browser can't load real squads, so it never gets a rival.",
              "pill": {
                "text": "low",
                "tone": "amber"
              }
            },
            {
              "title": "Google Analytics counts our own test browsers as new UK users",
              "detail": "Fix ready, waiting on a yes.",
              "pill": {
                "text": "high",
                "tone": "red"
              }
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/Q681hvwMs83X9895Aevav7",
      "updatedAt": null
    },
    {
      "version": "0.12",
      "title": "Mikey's patch notes",
      "publishedAt": "2026-09-25T22:00:00Z",
      "summary": "The headline: training works like New Star Soccer. 30 fixed levels per skill, three tries, stars raise the skill 40 → 100. Plus: pace, vision and free kick now matter in matches, every skill starts at 40, and matches no longer give skill points.",
      "stats": [
        {
          "value": "30 levels",
          "label": "per training game, each the same picture every time"
        },
        {
          "value": "90 ★",
          "label": "per skill; all 90 take it from 40 to 100"
        },
        {
          "value": "3.2 → 4.7",
          "label": "team-mates per chance, vision 40 → 100"
        },
        {
          "value": "0",
          "label": "skill points from matches now (training only)"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Training: pick a skill, then one of 30 levels",
              "detail": "Home → Training → tap a skill."
            },
            {
              "title": "3 tries a level: 1st ★★★, 2nd ★★, 3rd ★; any star unlocks the next",
              "detail": "Play level 1 of any skill."
            },
            {
              "title": "Level 1 opens on a how-it-works card",
              "detail": "Level 1 of each training game."
            },
            {
              "title": "Vision counts you in: 3, 2, 1, GO",
              "detail": "Any Vision level."
            },
            {
              "title": "Every skill starts at 40, with ★ n/90 under it",
              "detail": "New career → Training."
            },
            {
              "title": "Matches no longer raise skills",
              "detail": "Play a match, check Training before and after."
            },
            {
              "title": "Vision, pace and free kick now matter in matches",
              "detail": "Team-mates per chance, the Touch Mode chase, corners and set-piece duty."
            },
            {
              "title": "New dev page to play any training level",
              "detail": "/star-training-dev, or the admin menu → Training Levels."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "The headline: training works like New Star Soccer",
          "items": [
            {
              "title": "30 fixed levels per skill, three tries, stars raise the skill",
              "detail": "Problem: every session was a random new picture, and a perfect one at 18 gave 10 points, so 40 → 100 took about 7 sessions. Fix: 30 fixed levels (level 1 = the old drill at 40, level 30 = the old drill at 100), 3 tries (★★★ / ★★ / ★), any star unlocks the next, all 90 stars take a skill from 40 to 100, only new stars count, age makes no difference. Old saves keep what they had (a skill at 70 opens with levels 1–15 at ★★★)."
            },
            {
              "title": "Level 1 of every game opens on a how-it-works card",
              "detail": "A small drawing, three one-line steps, the star rule, and a Let's go button."
            },
            {
              "title": "Vision counts you in: 3, 2, 1, GO",
              "detail": "The pitch is hidden until GO, with \"Pick the free pass\" under the number. A miss runs it again on the same picture."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Every skill starts at 40",
              "detail": "Free kick used to start at 30."
            },
            {
              "title": "Matches no longer give skill points",
              "detail": "A great match used to add about +0.6 to every skill. Now 0, first team and youth team."
            },
            {
              "title": "Vision: more team-mates on a smooth curve",
              "detail": "Team-mates per chance: 3.18 at 40, 4.18 at 80, 4.69 at 100 (used to stop rising at 70).",
              "bars": [
                {
                  "label": "Team-mates per chance at vision 100",
                  "was": 4.19,
                  "now": 4.69,
                  "state": "good"
                }
              ]
            },
            {
              "title": "Pace speeds up the Touch Mode chase",
              "detail": "6.8 m/s at 40 up to 8.4 at 100 (was a flat 7.6). An 8 m chase: 1.01 s → 0.81 s."
            },
            {
              "title": "Free kick counts on corners, and hands you more set pieces",
              "detail": "Corners use the 60/40 free-kick mix. Free kicks + corners per match (CM): 0.59 at 40 → 0.81 at 100."
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added (dev tools)",
          "items": [
            {
              "title": "Training Levels page: play any level of any game",
              "detail": "/star-training-dev. All 30 levels open, skills 40 / 70 / 100, ‹ All levels and ◀ L13 ▶. Nothing is saved."
            },
            {
              "title": "Dev panel: Unlock all 30 training levels",
              "detail": "One star on every level of every skill."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Winning a training level not yet seen on a screen",
              "detail": "The star screen and \"Level 2 unlocked\" haven't been seen; the rules pass their tests.",
              "pill": {
                "text": "low",
                "tone": "amber"
              }
            },
            {
              "title": "Two drawing tests fail on main",
              "detail": "authoredChance (one-on-one drawings) and longRangeRules (40/300 faults after a drawing was deleted).",
              "pill": {
                "text": "low",
                "tone": "amber"
              }
            },
            {
              "title": "Google Analytics counts our own test browsers as new UK users",
              "detail": "Fix ready, waiting on a yes.",
              "pill": {
                "text": "high",
                "tone": "red"
              }
            }
          ]
        },
        {
          "kind": "next",
          "title": "Next",
          "items": [
            {
              "title": "Play a few levels of each game and judge the difficulty",
              "detail": "/star-training-dev is the quickest way."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/FYpjCv5GQ4NPTN9qv4BhwQ",
      "updatedAt": null
    },
    {
      "version": "0.11",
      "title": "Mikey's patch notes",
      "publishedAt": "2026-09-25T12:00:00Z",
      "summary": "The headline: what you see on the pitch now matches where people really stand. Nearer players in front, the ball behind whoever is in front of it, corners from the flag. Plus real trophy pictures, instant energy modes, likes on posts and new KIB cans.",
      "stats": [
        {
          "value": "14",
          "label": "trophies now shown as real pictures, not emoji"
        },
        {
          "value": "6 m → 0.5 m",
          "label": "how far corners are taken from the flag"
        },
        {
          "value": "+35% / −35%",
          "label": "chances in High / Low energy mode, from the minute you switch"
        },
        {
          "value": "12",
          "label": "new long-shot drawings, so long shots get their own rules"
        }
      ],
      "sections": [
        {
          "kind": "changed",
          "title": "Check these",
          "items": [
            {
              "title": "Players standing behind someone are drawn behind him",
              "detail": "Any match; corners and crosses show it best."
            },
            {
              "title": "The ball is hidden behind a player standing in front of it",
              "detail": "Any match, and the gallery picture."
            },
            {
              "title": "Corners are taken from the corner flag",
              "detail": "Any corner in a match, Infinite Highlights, the scenario gallery."
            },
            {
              "title": "Trophy pictures",
              "detail": "Trophy Cabinet, end-of-season awards, feed trophy posts, the Garden cabinet."
            },
            {
              "title": "Energy mode buttons are icons, and switching changes the match straight away",
              "detail": "Live commentary during a match."
            },
            {
              "title": "Feed posts look like real social media, and you can like them",
              "detail": "The phone feed after a match."
            },
            {
              "title": "KIB cans: Basic +65, Premium = Swerve curve, Elite = Touch Mode; half-time can +65",
              "detail": "Home, KIB cans panel; the Shop; half-time."
            },
            {
              "title": "NS-Swerve costs ★35,000, the same as NS-Maestro",
              "detail": "Shop, boots."
            },
            {
              "title": "Gallery: \"Camera: pick on the whole pitch\", and a Long Range rule set",
              "detail": "/star-gallery-dev."
            },
            {
              "title": "Scout Report no longer shows the tactics text box",
              "detail": "Match day, before the team sheets."
            }
          ]
        },
        {
          "kind": "fixed",
          "title": "The headline: the pitch matches where people stand",
          "items": [
            {
              "title": "Players standing behind someone are no longer drawn on top of him",
              "detail": "Problem: a striker behind his marker was drawn over him, as if standing on top of him. Why: players were drawn in fixed groups (team-mates, runners, defenders, you, keeper), so a later group was always on top. Fix: everyone, keeper included, is drawn furthest-first by where his feet touch the grass, from every camera angle."
            },
            {
              "title": "The ball is hidden behind a player standing in front of it",
              "detail": "Problem: a ball at your feet with a defender in front of you was drawn across his head. Why: the ball was always drawn last. Fix: the ball joins the same nearest-in-front order, placed by its shadow."
            },
            {
              "title": "Corners are taken from the corner flag",
              "detail": "Problem: corners were taken 6–7.5 m in from the flag. Why: the fixed corner camera couldn't fit the flag, pull-back room and the far post. Fix: ball in the corner arc (0.45–0.75 m); corner camera shows 48 m instead of 42 m, so players on corners are about 13% smaller. Byline crosses unchanged. The gallery picture also stops the goal line and touchline at the corner and draws the quarter circle, like the match.",
              "bars": [
                {
                  "label": "Distance from the flag (m)",
                  "was": 6.75,
                  "now": 0.6,
                  "state": "good",
                  "unit": " m"
                }
              ]
            }
          ]
        },
        {
          "kind": "added",
          "title": "Added",
          "items": [
            {
              "title": "Real trophy pictures",
              "detail": "14 trophies, backgrounds cut out, about 2 MB → 27–81 KB each. Community Shield, Super Cup, Conference League, European Championship and Play-Offs keep their emoji until pictures arrive."
            },
            {
              "title": "Like a post in the feed",
              "detail": "Tap the heart: it pops pink and the count goes up by one; tap again to unlike. Saved with the career."
            },
            {
              "title": "Gallery: \"Camera: pick on the whole pitch\"",
              "detail": "Zoom out, drag the dashed frame, let go. The camera saves with the scenario. Left/right facing not included yet."
            },
            {
              "title": "Long shots get their own rule set",
              "detail": "12 new long-range drawings (was 1; 5 are needed). Simulate: 400/400 built, 0 rules broken, 3.75% with a minor fault."
            }
          ]
        },
        {
          "kind": "changed",
          "title": "Changed",
          "items": [
            {
              "title": "Switching energy mode changes the match straight away",
              "detail": "The rest of the stretch re-runs from the next minute at the new mode; what's on screen stays identical. High now gets extra chances that come only to you (1,500 simulated matches).",
              "bars": [
                {
                  "label": "High mode: extra chances (%)",
                  "was": 23,
                  "now": 35,
                  "state": "good",
                  "unit": "%"
                }
              ]
            },
            {
              "title": "Energy mode buttons are icons",
              "detail": "Red Low, amber Medium, green High, with 2/4/6 sparks. The chosen one glows."
            },
            {
              "title": "KIB cans",
              "detail": "Basic +25 → +65. Half-time can +25 → +65. Premium +50 energy → the NS-Swerve curve for your next match. Elite +100 energy → NS-Maestro Touch Mode for your next match."
            },
            {
              "title": "NS-Swerve costs the same as NS-Maestro",
              "detail": "★2,300 → ★35,000.",
              "bars": [
                {
                  "label": "NS-Swerve price",
                  "was": 2300,
                  "now": 35000,
                  "state": "good",
                  "unit": "★"
                }
              ]
            },
            {
              "title": "Feed posts look like real social media",
              "detail": "Edge to edge, name + tick + handle + time on one line, no category labels, a full action row, graphics under the words."
            },
            {
              "title": "Scout Report: tactics text box hidden",
              "detail": "Took too much of the page. Hidden, not deleted; the opponent still sets up that way."
            },
            {
              "title": "Smaller fixes: energy colours, dev fame buttons, feed fame, voting numbers",
              "detail": "Energy colours follow the real selection lines (green 65+, amber 40+, red below). Dev fame buttons are +10 / Max 100 (were +1,000 / 100,000)."
            }
          ]
        },
        {
          "kind": "known",
          "title": "Known issues",
          "items": [
            {
              "title": "Google Analytics counts our own test browsers as new UK users",
              "detail": "Most of the ~120 new users (118 UK, no sign-ups) are likely test browsers. Fix ready, waiting on a yes.",
              "pill": {
                "text": "high",
                "tone": "red"
              }
            },
            {
              "title": "authoredChance.mts fails 7 checks on main",
              "detail": "From the one-on-one drawing changes; identical before and after this round.",
              "pill": {
                "text": "low",
                "tone": "amber"
              }
            },
            {
              "title": "Pitch drawing fixes not yet seen inside a real career match",
              "detail": "Seen in Infinite Highlights, which draws with the same code.",
              "pill": {
                "text": "low",
                "tone": "amber"
              }
            },
            {
              "title": "Trial: the dribble stage starts behind its how-to card",
              "detail": "And the trial's dev skip panel is open to everyone. Fixes ready.",
              "pill": {
                "text": "low",
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
              "title": "Pictures for the last 5 trophies",
              "detail": "Waiting on images."
            },
            {
              "title": "Home page as three swipeable pages",
              "detail": "Waiting on a decision to build."
            },
            {
              "title": "App Store / Play Store app via Capacitor",
              "detail": "Waiting on a decision."
            }
          ]
        }
      ],
      "artifactUrl": "https://claude.ai/artifact/SoBMWDhZGj58LXwP4CFARm",
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
              "detail": "The site won't deploy with a new copy of the match. A second review tried to break it, and the gaps it found are closed or listed.",
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
