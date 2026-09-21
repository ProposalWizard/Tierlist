-- Patch notes v0.1 — the first version, loaded into the archive.
--
-- Content taken verbatim from the artifact that shipped it
-- (.claude/skills/artifact-house-style/references/patch-notes-v0.1.html).
-- Every number here was measured, not estimated, so none of them have been
-- rounded, re-derived or tidied on the way in. Screenshots do not come
-- across — the artifact keeps those, and artifact_url points at it.
--
-- Requires patch_notes.sql to have been run first.
-- ON CONFLICT (version) DO UPDATE, so this is safe to re-run: it overwrites
-- v0.1 with whatever this file currently says rather than erroring or
-- silently doing nothing.
--
-- The JSON below is dollar-quoted rather than single-quoted, so the prose
-- inside keeps its own apostrophes without a wall of escaping.

INSERT INTO patch_notes (version, title, published_at, summary, stats, sections, artifact_url, updated_at)
VALUES (
  '0.1',
  'Knowitball patch notes',
  '2026-09-21T00:00:00Z',
  'Star Career · branch Harry · 8 commits · 147 tests green · every number measured, not guessed',
  $json$[
    { "value": "14→64", "label": "different chance situations" },
    { "value": "0%",    "label": "same chance twice running" },
    { "value": "8×",    "label": "less scrolling in the gallery" },
    { "value": "−15pp", "label": "empty grass on screen" }
  ]$json$::jsonb,
  $json$[
    {
      "kind": "fixed",
      "title": "Fixed",
      "items": [
        {
          "title": "Scoring was halved. Now it isn't.",
          "detail": "Four separate bugs, each found by measuring.",
          "bars": [
            { "label": "Cutback",      "was": 9.8,  "now": 41.3, "state": "good", "unit": "%" },
            { "label": "One-on-one",   "was": 9.8,  "now": 47.6, "state": "good", "unit": "%" },
            { "label": "Tight angle",  "was": 13.3, "now": 39.7, "state": "good", "unit": "%" },
            { "label": "Header",       "was": 6.6,  "now": 26.8, "state": "good", "unit": "%" },
            { "label": "Through ball", "was": 11.2, "now": 18.7, "state": "warn", "unit": "%" }
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
          "pill": { "text": "half fixed", "tone": "amber" },
          "bars": [
            { "label": "Long range",   "was": 13.1, "now": 10.6, "state": "warn", "unit": "%" },
            { "label": "Through ball", "was": 13.0, "now": 12.6, "state": "bad",  "unit": "%" },
            { "label": "Build-up",     "was": 9.5,  "now": 9.5,  "state": "bad",  "unit": "%" },
            { "label": "One-on-one",   "was": 11.9, "now": 14.3, "state": "good", "unit": "%" },
            { "label": "Headers",      "was": 9.7,  "now": 8.9,  "state": "good", "unit": "%" }
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
          "pill": { "text": "blocked on Harry", "tone": "amber" },
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
        { "title": "Dribbling and heading scenarios in the gallery" },
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
  ]$json$::jsonb,
  NULL,
  now()
)
ON CONFLICT (version) DO UPDATE SET
  title        = EXCLUDED.title,
  published_at = EXCLUDED.published_at,
  summary      = EXCLUDED.summary,
  stats        = EXCLUDED.stats,
  sections     = EXCLUDED.sections,
  artifact_url = COALESCE(EXCLUDED.artifact_url, patch_notes.artifact_url),
  updated_at   = now();

-- ── Verify ───────────────────────────────────────────────────────────────
-- select version, title, jsonb_array_length(sections) as sections
-- from patch_notes order by published_at desc;
-- Expect v0.1 with 7 sections.
