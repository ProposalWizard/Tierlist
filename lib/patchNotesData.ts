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
    "version": "0.3",
    "title": "Harry's patch notes",
    "publishedAt": "2026-09-22T00:00:00Z",
    "summary": "Scenario gallery & auto-tuning · branch Harry · 151 test files green · every number measured, not guessed",
    "stats": [
      {
        "value": "15%→0%",
        "label": "broken chances from one bad drawing"
      },
      {
        "value": "10→21",
        "label": "scenarios you can actually see"
      },
      {
        "value": "34%→0%",
        "label": "team-mates standing in your shot"
      },
      {
        "value": "1",
        "label": "deploy to commit any number of scenarios"
      }
    ],
    "sections": [
      {
        "kind": "fixed",
        "title": "Scenarios & tuning — fixed",
        "items": [
          {
            "title": "One bad drawing could take the whole rule set down with it",
            "detail": "A law held only if EVERY drawing agreed, so a single slip silently switched real rules off.",
            "bars": [
              {
                "label": "Hard rules on",
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
              "summary": "What changed, and the trap that was worse than the bug",
              "points": [
                "Adding ONE drawing with a defender goal-side of the ball, to eleven clean ones, destroyed 2 of the 3 laws and 15.0% of every chance served then broke its own definition. One drawing outvoted eleven.",
                "A law now holds at nine in ten. The drawing that disagrees is NAMED as an outlier, and the generator never uses it as a base.",
                "Agreement alone was not enough, and getting that wrong would have been worse than the bug: \"3 defenders in the picture\" could easily hit nine in ten and become a law — and then a four-defender chance could never be served again.",
                "So a law must be a ZERO. Every real one is: no defender between ball and goal, none nearer the goal than the ball, no team-mate in your shot. \"None of X\" says what a situation IS. \"Three of X\" says what it usually looks like."
              ]
            }
          },
          {
            "title": "Your own team-mates were standing in your shot",
            "detail": "Fixed for one-on-ones earlier; the other kinds where YOU shoot never got it.",
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
              "summary": "Why tight angle is 1.2% and not 0, and what is deliberately excluded",
              "points": [
                "Keeping a man ONSIDE can pull him back into the lane. 11.2% → 1.2% is the trade, stated rather than chased — going after the last 1.2% is the over-fitting this project has been burnt by twice.",
                "NOT applied to a cutback, a cross or a through ball: those are played TO a team-mate, so moving him moves the chance itself.",
                "NOT applied to a volley or header either — measured, that made blocks WORSE (volley 17.8% → 38.0%, header 6.1% → 22.4%).",
                "A first version ran after the onside repair and put men offside — caught by breaking the fault rate down per kind instead of trusting the headline number."
              ]
            }
          },
          {
            "title": "Offside was being called wrong on your own scenarios",
            "detail": "Reported directly, and correct: 3 of 3 calls were on a man BEHIND the ball, who cannot be offside.",
            "more": {
              "summary": "Both halves of Law 11",
              "points": [
                "A player is offside only if nearer the goal than the second-last opponent AND nearer than the ball. The fault rule only ever tested the first.",
                "Measured on the authored one-on-ones: POACH 4.1m behind the ball, POACH 2.5m behind, SUP 1.5m behind — 100% wrong. Across raw builds of every kind, 46 of 153 calls (30.1%) were wrong.",
                "Fixed in the fault rule AND in both repairs, which had been physically moving men who were standing legally.",
                "Match play was never affected — the engine itself always had this right. This was the editor's red text and the auto-repair acting on it."
              ]
            }
          },
          {
            "title": "The keeper stopped following the ball when a chance was randomised",
            "detail": "He was copied off the drawing and nudged independently of it.",
            "bars": [
              {
                "label": "Worse cover",
                "was": 32.8,
                "now": 0,
                "state": "good",
                "unit": "%"
              }
            ],
            "more": {
              "summary": "What the numbers looked like",
              "points": [
                "Near-post cover as drawn: 0.13 to 0.45. After a nudge: −0.68 to 1.34. A NEGATIVE share means he had drifted to the FAR post — the opposite of the one thing all the drawings agree on.",
                "He is now DERIVED from the nudged ball: each drawing's own near-post share and distance off his line, re-applied to wherever the ball ended up.",
                "The character of the drawing survives — a keeper drawn rushing out still rushes out — he just tracks the ball now."
              ]
            }
          },
          {
            "title": "The plain generated one-on-one broke your own rules",
            "detail": "Measured against the rule set scanned from your drawings.",
            "bars": [
              {
                "label": "Obey rules",
                "was": 85.6,
                "now": 100,
                "state": "good",
                "unit": "%"
              }
            ],
            "more": {
              "summary": "Two causes",
              "points": [
                "The goal-side repair only fired on a defender within 14m of the middle. Your drawings have ZERO defenders goal-side at ANY width. It also allowed half a metre of grace, letting a man a shoulder ahead through.",
                "Nothing cleared a TEAM-MATE out of the shooting lane in a plain build — 4.3% of them put a man in the lane."
              ]
            }
          },
          {
            "title": "Leo couldn't see the scenarios the game was already using",
            "detail": "The gallery display and the generator were reading different places.",
            "more": {
              "summary": "The mismatch, and what it means",
              "points": [
                "The generator reads the committed code file — in everyone's build. The gallery display read ONLY the database.",
                "So a committed scenario drove the game for everyone but showed on no screen that hadn't synced. The generator was working the whole time.",
                "The display now reads both, and every saved scenario appears as its own card — including sim-saved ones that never had a slot."
              ]
            },
            "bars": [
              {
                "label": "Cards visible",
                "was": 10,
                "now": 21,
                "state": "good"
              }
            ]
          },
          {
            "title": "Your edits could slide onto a completely different picture",
            "detail": "A card picked its base by position in the list, so saving one scenario renumbered everything.",
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
              "summary": "Why 9% and not 0%",
              "points": [
                "Measured: adding ONE drawing repainted 199 of 400 cells onto a different base — with whatever you had dragged still on top of an arrangement it was never made for.",
                "Now each card keeps its own drawing. 9% against a theoretical floor of 1/12 = 8%, so this is essentially optimal.",
                "A first attempt at the fix measured 31% with one drawing winning 189 of 400 cells — the hash didn't spread. Fixed properly."
              ]
            }
          },
          {
            "title": "The poacher was the one team-mate you could never remove",
            "detail": "Reported as \"I can't remove teammates\" — it was only ever this one figure.",
            "more": {
              "summary": "Measured across all editors",
              "points": [
                "Every other team-mate and every defender was already removable. Clicking the three figures in a live one-on-one: SUP works, POACH greyed, D3 works.",
                "In a one-on-one he is often one of only two team-mates on screen, so half the time the one you reach for is the one that can't go. In a free kick he was the ONLY team-mate."
              ]
            }
          },
          {
            "title": "The build failed because of a font downloaded from Google",
            "detail": "No code change behind it — the deploy just landed while Google's font fetch failed.",
            "more": {
              "summary": "Why it happened and why it can't again",
              "points": [
                "`next/font/google` downloads the font DURING the build, so every production deploy depended on Google answering in a shape Next could parse.",
                "The font is now in the repo (26 KB). Proven: `next build` with the network fully off compiles 113/113 pages, and in a browser with Google blocked the font loads and renders at all three weights with ZERO requests to Google.",
                "Same font, same look — it is the exact file Google itself serves for the latin subset."
              ]
            }
          }
        ]
      },
      {
        "kind": "added",
        "title": "Scenarios & tuning — added",
        "items": [
          {
            "title": "Save vs Commit — and every scenario now says which it is",
            "detail": "Two different things that were easy to confuse. Each card carries a badge.",
            "more": {
              "summary": "The difference, in plain English",
              "points": [
                "SAVE writes to the shared database. Everyone sees it within seconds, no deploy. But it lives in ONE place — restore an old backup and it is gone.",
                "COMMIT writes it into the code as a real git commit. Reviewable, revertible, survives anything happening to the database, and ships inside every build — but only reaches the site on the next deploy.",
                "Think: Save is the shared whiteboard everyone is looking at now. Commit is the filing cabinet.",
                "A fourth state is shown too: \"code has an older copy\" — committed once, then edited and saved again. Compared on the actual picture, not timestamps, so a re-save that changed nothing doesn't clutter the list."
              ]
            }
          },
          {
            "title": "One commit, one deploy — however many scenarios",
            "detail": "Everything saved-but-not-committed is listed, with a single button that commits the lot.",
            "more": {
              "summary": "Why this matters",
              "points": [
                "Committing goes to main, and main auto-deploys production. One scenario at a time would be one full production rebuild each.",
                "The API already took an array and writes the file once, so this is one request, one commit, one deploy, whether it is 5 or 100.",
                "It deliberately does NOT flip the badges to \"Committed\" on success — the code file only reloads on deploy, so that would be a lie for two minutes. It says so instead."
              ]
            }
          },
          {
            "title": "Tune — fix a bad generation without it becoming a base scenario",
            "detail": "Nudge a bad picture, press Tune. It stays silent until a pattern shows up.",
            "more": {
              "summary": "Why it has to work this way",
              "points": [
                "Suppressing the one bad picture achieves nothing — the generator makes millions of distinct chances, so that exact one was never coming back anyway. The value is WHAT WAS WRONG WITH IT.",
                "A correction must not be measured as an exemplar either: a base is built on purpose, every figure placed deliberately. A correction is a minimal fix to generator output, with the other eight bodies still wherever the generator left them.",
                "So each correction records which MEASURABLE property it repaired — and only if that property was genuinely broken before and genuinely fine after.",
                "One is noise. Three agreeing is a rule worth PROPOSING — proposed, never applied. Scoped by situation too: two in a one-on-one plus two in a long range is not four."
              ]
            }
          },
          {
            "title": "Play any scenario, without leaving the editor",
            "detail": "The picture swaps for the real match engine and every control stays put.",
            "more": {
              "summary": "What it runs",
              "points": [
                "The REAL match engine, not a simplified copy — in sandbox mode, so nothing is tallied or credited to a career.",
                "Play it, see what is wrong, drag a defender, play it again, save. No screen change in between.",
                "Scoreboard, commentary and hint are hidden — none of them say anything about a scenario, and a goals tally is misleading on a screen that counts nothing."
              ]
            }
          },
          {
            "title": "Delete a scenario, everywhere",
            "detail": "Removes it from the database, this browser, and the committed code file.",
            "more": {
              "summary": "Why all three",
              "points": [
                "The display reads the committed file now, so deleting only from the database would let it reappear on the next load.",
                "Honest about a partial result: if the code half can't be reached it says \"removed here — still in the code\" rather than claiming a clean delete."
              ]
            }
          },
          {
            "title": "Infinite Highlights, with the editor built in",
            "detail": "Endless generated chances, per-type toggles, and the same edit tools as the gallery."
          }
        ]
      },
      {
        "kind": "changed",
        "title": "Changed",
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
            "title": "Scenarios now commit to main, so they reach everyone",
            "detail": "They were going to a personal branch, where nobody else would see them until it merged.",
            "more": {
              "summary": "Two consequences worth knowing",
              "points": [
                "Every commit triggers a production rebuild (~2 min). Fine for a handful — but the INSTANT path is Save, which needs no deploy at all. Commit is the durable copy, not the fast one.",
                "A feature branch that also commits scenarios will diverge on that one file and conflict on merge. Never a loss — the merge is keyed by id, so the resolution is always the union — but somebody resolves it."
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
                "The claude.ai artifact you keep republishing is untouched and still one link \u2014 https://claude.ai/artifact/YEuw3iut76VY2dZiQVarZd. It covers round 4 only, so this entry links a generated page that matches all four rounds instead.",
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
