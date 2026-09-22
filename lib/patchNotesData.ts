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
  "version": "0.4",
  "title": "Leo's patch notes",
  "publishedAt": "2026-09-22T00:00:00Z",
  "summary": "Goalie Mode · round 4 · a real rendering bug fixed, a real defensive presence, two new shot types — 151 star tests green, tsc and a full build both clean",
  "stats": [
    { "value": "0→real", "label": "grass — was silently never drawn at all" },
    { "value": "9", "label": "shot kinds now (was 7)" },
    { "value": "9.15m", "label": "the free-kick wall's real IFAB distance" },
    { "value": "151", "label": "star test files, all green" }
  ],
  "sections": [
    {
      "kind": "fixed",
      "title": "Fixed",
      "items": [
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
          "title": "Other players are actually on the pitch now",
          "detail": "Reported directly: \"obvs other attackers and defenders should be in there even if they arent involved.\" Ambient goalmouth figures — real positions, a gentle idle sway and shuffle so they read as alive, not a diagram.",
          "pill": { "text": "visual only this round", "tone": "amber" },
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
      "title": "Previous versions",
      "items": [
        {
          "title": "v0.3 — the real cursor bug, one fixed camera, real shot variety",
          "detail": "A genuine PC bug (aim was visibly off your actual cursor), root-caused to the camera's pitch breaking the aim math's exact-inverse assumption — fixed by dropping the pitch to exactly 0, proven exact to floating-point noise. The 3-stage zoom was removed outright for one fixed wide shot. Added a first-time strike kind, independent near/far-post variety, and an on-screen shot-type tag."
        },
        {
          "title": "v0.2 — Goalie Mode ships, then rebuilt against real reference footage",
          "detail": "The original keeper-POV reflex minigame: real dive timing (committing at the strike beats guessing early), a push-your-luck streak multiplier. Rebuilt after three reference clips showed the first camera didn't match, and a real mobile bug (a tap instantly committed the dive with no way to preview) was fixed to match desktop's hover-then-release."
        }
      ]
    }
  ],
  "artifactUrl": "https://claude.ai/artifact/YEuw3iut76VY2dZiQVarZd",
  "updatedAt": null
},
{
  "version": "0.3",
  "title": "Leo's patch notes",
  "publishedAt": "2026-09-21T00:00:00Z",
  "summary": "Goalie Mode · round 3 · a real cursor bug fixed, the zoom removed, real shot variety",
  "stats": [
    { "value": "~1e-16m", "label": "aim error after the fix (was ~0.42m)" },
    { "value": "1", "label": "fixed camera shot (was 3 stages)" },
    { "value": "7", "label": "real shot kinds (was 5)" },
    { "value": "~1.5%", "label": "margin either side of the posts, genuinely tighter framing" }
  ],
  "sections": [
    {
      "kind": "fixed",
      "title": "Fixed",
      "items": [
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
        }
      ]
    },
    {
      "kind": "added",
      "title": "Added",
      "items": [
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
        }
      ]
    },
    {
      "kind": "known",
      "title": "Known issues",
      "items": [
        {
          "title": "Not confirmed with a fresh live look this round",
          "detail": "A real attempt was made and got stuck on an unrelated harness/timing issue in the trial-penalty skip sequence — cut off rather than keep burning time on it. Confidence rested on the cursor fix's exact computed proof and a full clean test suite, said plainly rather than claimed as seen."
        }
      ]
    }
  ],
  "artifactUrl": null,
  "updatedAt": null
},
{
  "version": "0.2",
  "title": "Leo's patch notes",
  "publishedAt": "2026-09-21T00:00:00Z",
  "summary": "Goalie Mode · round 1-2 · a new keeper-POV minigame ships, then its camera rebuilt against real reference footage",
  "stats": [
    { "value": "12x", "label": "streak multiplier cap" },
    { "value": "3", "label": "reference clips the camera was matched against" },
    { "value": "3-stage", "label": "camera: establishing → push-in → reveal" },
    { "value": "0", "label": "taps that instantly commit a dive, after the mobile fix" }
  ],
  "sections": [
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
        }
      ]
    },
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
        }
      ]
    },
    {
      "kind": "known",
      "title": "Known issues",
      "items": [
        {
          "title": "The push-in/reveal camera itself wasn't re-confirmed live after this round's rebuild",
          "detail": "Confidence rested on the measured reference frames and the re-verified projection math, not a fresh recording — and it went on to be reported back as still not right (see v0.3)."
        }
      ]
    }
  ],
  "artifactUrl": null,
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
