# Working rules, as they stood in CLAUDE.md on 21 Oct 2026 (frozen source)

> Moved word for word out of CLAUDE.md. This is the SOURCE the Brain notes cite (`brain/`).
> Do not edit it: a changed rule gets a new Brain note (see `kits/brain-kit/SEARCH.md`).
> Search the Brain index (`brain/_index.md`) instead of reading this file.

## The 3D files are packed small (6 Oct 2026)

`scripts/perf3d/shrink-models.mjs` packs the GLBs in place: meshopt geometry
and clips, WebP textures (Draco kept for props, boots, cars, where it is
smaller). **Every GLTFLoader must call `withMeshopt(loader)`**
(`lib/star/three3d/meshopt.ts`) or it fails on them. The 3D builders re-pack
at their end; a new file needs a POLICY line in the script. Details:
`scripts/perf3d/README.md`.

**Any 3D, animation, mocap, model or cut-scene work: merge `main` first, then read `docs/3D_HANDBOOK.md` (skill `3d-building`).**

## ONE ENGINE — every screen that plays football runs the real match

Asked for by Harry (24 Sep 2026): *"there has to be a way that ANY new feature
used the base engine … extra stuff built on top of the base engine."*

- **The real match** (`app/star-dev/page.tsx`) mounts `CanvasMatch` directly.
- **Everything else mounts `EnginePlay`** (`components/star/EnginePlay.tsx`).
  It plays the real game's size, squads and weather, with the Play Area's
  dials on that one mount only. A feature is extras around it, reading
  `onChanceServed` and `onChanceResolved`. It never gets its own loop.
- **`scripts/one-engine-guard.mjs` runs inside `npm run build`, so it
  blocks every Vercel deploy.** It fails on:
  - a new copy of the loop
  - a direct `<CanvasMatch>` mount
  - a grown `KNOWN_COPIES` list
  - a new canvas animation loop (a screen writing its own ball physics)
  - the test screens missing a setting the real match passes
  - a guard that has stopped seeing its planted canary, or flags a harmless one
- **Never** add to `KNOWN_COPIES`, raise `CEILING`, touch the canary, or remove
  the guard from the `build` script without being asked in those words. Load the `one-engine` skill
  first.
- **Shared mechanics, not a shared picture** (Harry, 24 Sep 2026: "different
  modes ... will be COMPLETELY looking different ... it has to be allowed").
  A mode keeps the real ball, drag, contact and flight, and chooses what is on
  the pitch with `scene` (`lib/star/scenePicture.ts`): no keeper, no goal, no
  team-mates, no GOAL/PASS text. Technique training is you, a ball and cones.
- **Ported (24 Sep 2026):** trial penalties and free kicks, training strike
  drills and the gauntlet. They mount `EngineFeature` (EnginePlay.tsx) and only
  build each rep's picture and score it. A trial/training difference is a
  named dial (`TEST_ONLY` in the guard), never a copy.
- **Still copies, to port next:** five-a-side only. Mikey's `/star-match-dev` fork and
  the 2 dev prototypes were deleted with their pages (Harry, 18 Oct 2026). The live list is in the guard.

**3D games are the exception (Harry, 8 Oct 2026):** *"the match engine rule has
got to be changed for 3D — surely it would be a completely different set of
rulesets almost? And that's okay as long as it doesn't infringe on the base
game."* Fully 3D games (move around, touch, keep-ups, headers, volleys, free
roam) get their OWN physics and rules, in their own folder (`lib/star/play3d/`).
Limits: they never import from or change `lib/star/canvasEngine.ts` or the 2D
match; the 2D base game is untouched by them; shared basics (ball size, gravity,
how a player's skills scale a kick) come from one shared file so the 3D ball
still feels like the same sport. Screens built on the 2D engine (trial, drills,
Crossbar Challenge's aim) keep the one-engine rule as before.

## How to talk to this team (standing, not per-session)

Neither Harry nor Mikey writes code. Stated directly: *"we AREN'T coders -
english only."* Everything below is a standing instruction, confirmed more
than once.

**Progress updates follow `.claude/skills/progress-update/SKILL.md`: every 5
minutes on every task, with % + time left on every bar and the token/weekly
usage block on every update (Harry, 12 Oct 2026: "why aren't we using the
progress skill with the estimated tokens"). Its "auto-deploy" section is
replaced by "Deploy only when told" below.**

**No forced new chats; a nudge every 3 hours instead (Harry, 20 Oct 2026). Replaces "one build per
chat, then a handoff" (15 Oct).** *"completely disregard this - instead every 3 hours of chat give a
prompt that it could be a good time to restart the chat."* Keep building in the same chat. Once a chat
has run about 3 hours (check the first and latest message times), add one line to a reply: "It's been
about 3 hours in this chat: a good time to restart it if things feel slow. Say 'handoff' and I'll
write the starter." Then again every 3 hours. Write a handoff only when someone asks for one.

**Build slowly and correctly (Harry, 15 Oct 2026, for the admin/patch-notes/lag round).** *"instead
of running 5 parallel full builds let's build slowly and CORRECTLY."* Deep plan first, iterate it,
design (Higgsfield), then build one piece at a time, each checked and signed off before the next.

**Jobs for the team go in team/jobs.json and arrive by push, never SQL (Harry, 20 Oct 2026: "just use pushes").** See team/README.md.

**Deploy only when told (Harry, 12 Oct 2026; replaces "auto-deploy at every
major update").** *"what happened to patch notes? What happened to telling me
if I tell you to push everything currently, push it? Don't just be pushing
stuff, because sometimes it's not ready to go."* Later the same day: *"When I
say it's ready to be pushed, push it into the game … If I'm saying I need to
see patch notes first, do that. We'll just play it by ear."* So: Harry decides
each time whether to push now or see the patch notes first. Commit and push to the `Harry`
branch freely, but merge to `main` (= live) ONLY when Harry says push / deploy /
merge. Every deploy comes with patch notes. "Preview" (game version) is used
only when someone asks for it in those words; otherwise a change goes straight
into the game when it is deployed.

**No body part inside another (Harry, 20 Oct 2026).** *"as a rule something like a chin or any body part can't overlap inside another body part."* In 3D, no part of a person may pass into another part (chin into chest, arms into the torso, hands into hips, knees or feet through each other), in any clip or pose. Measure it with the self-overlap check, not by eye alone.

**3D sizes never change (Harry, 12 Oct 2026).** *"no changes in size for any
player or goalie or goal should ever occur."* In 3D, every man, the keeper and
the goal each have ONE fixed scale, the same in every chance and every frame.
Never resize them per chance, per camera move or per screen.

**Pictures as they come in, not in one go (Harry, 12 Oct 2026).** *"I want
pictures constantly as they come in instead of in one go, easier to tweak
missteps."* Builders save each finished still to the top of their output folder
the moment it is made (scratch frames in `raw/`). The lead watches those folders
(a Monitor) and sends each new still straight to Harry with a one-line caption.

**Answer shape — key point, key number, key change.** Reported directly:
*"there's sometimes too much fluff in how you speak… I'm having to skim
through too much yap."* No preamble, no restating the request, no praise for
the idea, no tour of the code. Name things the way they appear on screen; put
the file in brackets after, once, only if someone needs to find it.

**Write about 80% of the way to ASD-STE100; draw stats and rules (Harry, 2 Oct
2026).** Short sentences (20–25 words at most), active voice, simple tenses,
one word for one thing, no coder words. Any stat, rate or rule with conditions
gets a picture (bar, flow diagram, ✓/✗ table) before the words. Applies to chat
replies and every artifact. **Don't overdo the diagrams (Harry, 2 Oct): only
where a picture is clearer than one plain line.** Use the new skills as needed,
not by default. Full rules: `artifact-house-style` skill.

**Every claim carries a number, or admits it has none.** "Scoring is hard" is
not a finding. "A clean one-on-one converts at 0.0% over 250 simulated
matches" is. Always give the before alongside the after.

**Say whether you saw it, measured it, or reasoned it.** This project's real
bugs have all lived in "reasoned it" — a keeper who reacted and didn't, a
price that was three weeks and was three weeks *per match*. "I read the code
and worked it out, I haven't seen it on a screen" is a fine thing to say and
tells them whether to go and look.

**Show, don't describe, anything with a size or a shape in it.** Goal width,
figure proportions, prices, framing, difficulty. Render the options at real
phone size and let them point. Use the `show-options` agent.

**Play it before claiming it works.** A type-check and a green suite cannot
see a frozen figure or a box sitting on the ball. Use `star-playtest`.

**Ask about the one ambiguous word; build the rest.** Never block a whole
message on one unclear clause. Build what is clear, then ask one question with
its options so it can be answered in a word from a phone.

**When Harry points at a picture, name it back before building (2 Oct 2026).**
In v0.24 the Home goal was built from the wrong picture and had to be moved
twice ("move the goal back and have it exactly like image 2"). Say which
picture you are copying, in one line ("copying image 2: the goal set back where
the pitch meets the stands"), and build from that.

**Do not agree to be agreeable.** Caught directly: *"a lot of times you're
just agreeing with us… I want to know for sure if that is a good idea."*
Before agreeing with a design call, go and find what argues against it. If
nothing does, say what you checked.

**Build straight onto the branch, then film it (Harry, 27 Sep 2026).** Building
every change twice — a throwaway prototype first, then the real thing — took
about half of the v0.16 round, so it stops: approved changes are built on
`Harry` directly, filmed at phone size in the real game, and kept or undone
from the film. **The prototype-first rule survives only for things Harry has
to judge by eye** — a size, a camera, how a figure or keeper looks, a layout:
those are still prototyped in a throwaway worktree and shown before/after
before they're built for real (Harry, 27 Sep: *"film and show images of every
change … so that I can tell you if it's good now before you go ahead"*). How
the filming works: "Checking what a frame can't show" in
`scripts/playtest-video/README.md`.

**Decide, don't toggle (Harry, 12 Oct 2026). This retires the old "every new
look gets a toggle" rule.** *"We're bloating the game up so much with
different settings ... it's best to just decide things and be done with it. If
we need to revert, then it's in the files."* A new look or gameplay change is
built as THE game: no new "New | Old" row in Settings. Old versions live in
git, not in the game. Settings keeps only real player preferences (sound,
full screen, 3D quality, faces, names and the like) and Settings → UI: Old |
New. Something still being judged is tried on a test/dev page, not behind an
in-game switch.

**Decided, no toggle (12 Oct 2026).** Removed in commits `32f8d6c` and
`5681ed6` (branch of this session). To see or bring back an old option, read
the files at `ebe02ad`, the commit before both. Old phones' stored values for
these rows are ignored. Where the old code was big it is left in the files but
unreachable (the getter returns the kept value), marked "Decided, no toggle".
- **Chances:** the team's drawn chances only, everywhere (match, highlights,
  Play Area). The New chance library, its drawings, script, tests and test
  page, and the Play Area's "Generator", were DELETED ("they're wrong").
- **Chance mix:** the basic even mix. **Kane drawings:** deleted with the StatsBomb data (19 Oct 2026; real moments now come from free data, `lib/star/realMoments`).
- **Animations:** New. **Clearances:** always on. (Keepers left this list:
  "Keepers: New | Old row kept, default New, Harry 12 Oct".)
- **Dribble:** top-down in every match, with team-mates to pass to; Dribble
  duels Old. The first-person duel is on `/star-dribble-dev` only.
- **Match camera (action fit):** Old until the rebuilt camera lands.
- **2D match:** match view New, chance framing Zoom, wide chances Old, camera
  angle 20°, players 3D-made sprites, 2D players Style A, ball New.
- **Your player:** shown on EVERY chance (Mikey, 20 Oct 2026; was hidden on
  shooting chances, Harry's 12 Oct call, to be re-agreed with Harry). When a
  chance opens he is moved clear of the ball and the aim arrow
  (`lib/star/youSpot.ts`; `showYouFigure`, `lib/star/newLook.ts`).
- **Shot spread cone:** drawn in the test area only (`lib/star/testArea.ts`).
- **3D world:** garden New, house New, 3D look H, shop player New, 3D people
  New, body Before, player style New, players in a 3D match Style A, 3D quality
  look New, player light Old, motion Mocap, manager's 3D office, casino 3D +
  New look, signing 3D, 3D drill controls Auto.
- **Screens:** badges, all seasons, Ballon d'Or night, home, shop, ovation and
  ovation greetings New; drawn players Shaded; post-match reactions on.
- **Rows that stay:** full screen, sound, 3D quality, skip the line-up (main
  Settings only), Keepers New | Old (default New), Match view 3D, player names (default off), UI Old | New, the
  v0.15 test box (keeper pro, shots, knuckleball, ball physics, match flow,
  radar). **No Version picker and no Preview** — something becomes a
  "Preview" only when someone asks for that in those words.
- **Cut scenes (12 Oct 2026, later):** people and camera New, no row ("the new
  cut scenes will be staying"). The Version picker (Classic | Standard) went
  with them; the rows left live in `lib/star/lookRows.ts`.
- **Faces (12 Oct 2026, later):** photo faces OFF for everyone (real photos,
  fake faces, your uploaded photo): every head is the drawn one, Style A where
  the picture is Style A. `PHOTO_FACES` in `lib/star/faceStyle.ts`; stored
  values ignored. The Photo picker and face editors are hidden until the photo
  revamp; their code stays. Player names stay a row (default off).
- **New work (Harry, 12 Oct 2026, standing):** no New | Old row and no
  Preview entry for anything new. It goes straight into the game when Harry
  says push. Unfinished work lives on a test page, not behind a switch in
  the real game.

**No more version toggles for new work; unfinished work lives on test pages
(Harry, 12 Oct 2026). Replaces the toggle rule below for new work.** *"I don't
like that system in the slightest … when I push changes, I now create a new
version toggle. He creates a new version toggle … When I'm ready to push my
stuff, we'll push it into the actual game because I trust my own judgement.
For Leo, I think he needs to push the version 1.50 changes … into the test
pages or create new test pages."*
- Harry's changes go straight into the game when he says push. No new
  New | Old row, no Preview entry.
- Work that isn't finished (Leo's v0.15 gameplay switches and similar) goes on
  a test page (a `/star-*-dev` page, new or existing), not behind a switch in
  the real game. It moves into the game when it is ready, as a normal change.
- Existing switches stay until someone decides each one. Never delete one unasked.

**No test build link on patch notes (Harry, 3 Oct 2026, latest): mostly stills, clips only for gameplay.**
*"the test build stuff doesn't work imo so stop doing that for patch notes, lets just stick to mostly stills except gameplay stuff."*
Patch-notes pages no longer link or point to the Vercel test build, and never ask anyone to try things there.
Each change gets a still; gameplay (and animation) changes also get a short "after" clip.
This overrides the test-build parts of the two rules below.

**Stills for looks, videos only for gameplay and animation (Harry, 3 Oct 2026).
This refines the rule below.** *"the statics are fine, only gameplay and
animations need videos and u can start with a still and then push and do
those last."* Order: stills on the page, push, publish; THEN film the short
"after" clips for gameplay/animation changes and add them to the same page.
Never hold the page or the push back for a video.
Also (Harry, 3 Oct): don't write "needs Mikey's yes" on patch notes.

**Superseded filming rules (1-2 Oct 2026: before/after videos, one filming pass, the test build link on patch notes) are in `SESSION_LOG.md`.** The live rules are the two above (3 Oct 2026).

**Clear disk space before every new build (Harry, 2 Oct 2026).** *"from now on
always clear the previous worktree and disc space when starting a new build."*
Before launching builders: remove every old agent worktree from earlier rounds
(`git worktree remove --force`, then `git worktree prune`), delete old film and
render folders in the scratchpad that are no longer needed, and check `df -h`.
Keep the current round's base and anything a builder is still using.

**Perfection with efficiency (Harry, 1 Oct 2026).** *"we have to combine
perfection with efficiency. If its gonna take 30 mins less to get to the same
outcome at some points you can use a bit less effort but the layout should
always be the same."* Cut effort where it doesn't change the outcome (fewer
re-takes, lighter checks on small items); never cut the page layout — the
same cards, clips, speed buttons and toggles every time.

**Builders check light; Harry judges 3D on his phone (Harry, 5 Oct 2026).**
*"im more concerned about getting the time down."* Measured: the garden builder
spent about 3 of 4½ hours waiting on its own browser checks, because this
machine has no graphics chip (1–5 s per 3D frame). So a builder does ONE quick
check per change (it loads, no console errors, one still), measures lag only
when lag is the job, and stops there. Harry judges look and feel on his phone,
with the Old toggle as the safety net. Keep each builder's job small.

**The change list goes out before the push, every time** — written so it
survives being forwarded to someone who wasn't in the conversation. Shared
files (`app/star-dev/page.tsx`, `lib/star/types.ts`, tailwind config) get
named explicitly.

**Mikey's `STAR_ROADMAP.md` is his own list (Harry, 5 Oct 2026).** *"mikeys
list is for his own brain, we work seperately to that although it is a
useful reference if I run out my own ideas."* In Harry's sessions, Harry sets
the order; don't push back on his priorities because the roadmap ranks
something differently.

**The match engine may change, with a warning (Harry, 5 Oct 2026).** *"remove
Mikeys never change the match engine rule and make it a general guard - instead
of a rule that warns when it's happening."* Mikey's old rule (never modify
`lib/star/canvasEngine.ts`) is gone. Any session may change the engine, but
`scripts/hooks/engine-warn.mjs` (a PreToolUse hook in `.claude/settings.json`)
flags every edit as it happens. Since 19 Oct 2026 (Harry: "put it in bright red … I'm just clicking Allow, allow, allow") it ASKS every time with a red "THIS IS A MATCH ENGINE CHANGE" notice, and also asks, as "SOMETHING MAY DRIFT", on the files that decide what a play screen hands the engine (CanvasMatch, EnginePlay, ScenarioPlay, InfiniteMatch, hiddenMatch, engineProfile, playArea, scenePicture, matchView). When it fires: say so plainly in the reply and
the patch notes (what changed, why, before/after numbers), run the match tests
(`node scripts/run-star-tests.mjs finishing keeper aiming outcomes`) and
playtest before pushing.

### Which model for what (Harry, 29 Sep 2026 — standing)

Said directly when the everyday model's new version came out. Worded by role,
not by version number, so it doesn't go stale at the next release.

- **The everyday model, at medium or high effort, for common tasks:**
  reviewing for bugs, writing long artifacts and patch notes, breaking down
  playtest videos, running playtests and measurements, data pulls, merges and
  routine fixes. "Run of the mill stuff."
- **The top model for making things:** building new features, solving hard
  problems, and UI/design work.
- **Subagents follow the same split.** Pass the model when launching one:
  the everyday model for `star-playtest`, video breakdowns, reviews and
  research; the top model for a build agent doing a new feature or a UI
  rebuild. Harry's own words on heavy playing: "waste of tokens" on the
  expensive model.
- If a task straddles both, do the building on the top model and hand the
  checking and writing-up to the everyday one.
- **Update (Harry, 1 Oct 2026), overrides the lines above where they differ:**
  the everyday model at **medium** effort for reviewing recordings, building
  from recordings, and **building artifacts/pages**; the top model for the
  **logic** tasks (game rules, curves, maths, engine behaviour, hard bugs).
- **Playtest/walkthrough videos (Harry, 30 Sep 2026):** the everyday model at
  medium effort does the breakdown (download, transcript, pictures, a
  timestamped list of every point); the top model does the analysis and the
  answers. Never the other way round.

### The agent skills, and when each fires

| Agent | Use it when |
|-------|-------------|
| `star-playtest` | Any change to `lib/star/**`, `components/star/**`, `app/star-dev/**`. Boots a real browser and reports what it SAW. |
| `show-options` | A number, size, colour, shape or layout a non-coder has to judge. Renders candidates at phone size, labels each with its cost, never ships the choice. |
| `explain-and-prompt` | Writing up a build so it can be judged without opening a file, or working out which of two meanings a request had. |
| `playtest-video` (skill) | They hand over a screen recording. `scripts/playtest-video/` turns it into timestamped pictures + a transcript; every claim is checked in the real game before it's reported. |
| `make-artifact` | A build, review or batch of changes that needs a shareable page. Verdict, decisions needed, changes, numbers, what's broken, what wasn't seen — in that order. |

## Pending Migrations

> Run in Supabase SQL Editor before touching related features.

| File | Status | Impact if missing |
|------|--------|-------------------|
| `draft_club_seasons.sql`, `draft_runs_stats.sql`, `draft_records_full_fix.sql`, `draft_american_mode.sql`, `sofifa_search_indexes.sql`, `perf_indexes_jul2026.sql`, `security_rls_hardening_jul2026.sql`, `fix_two_digit_fifa_years.sql`, `fc27_clone_premier_league.sql`, `fc27_clone_lower_leagues.sql`, `tester_access.sql`, `security_user_profiles_columns_aug2026.sql`, `star_lineups.sql`, `high_potential.sql`, `world_class_potential.sql`, `star_scenarios.sql`, `star_career_slots.sql`, `star_pass_config.sql`, `star_hall_of_fame.sql`, `star_legend_shares.sql`, `xp_atomic_award.sql`, `star_wallet.sql`, `star_scenario_corrections.sql`, `star_real_moments_picks.sql`, `star_training_levels.sql`, `team_room_v2.sql`, `star_save_guard.sql` | **RUN** (no action) | Full rows (who ran it, when, what breaks without it) are in `SESSION_LOG.md`. |
| `star_xp_config.sql` | **PENDING** (seen missing in the live database, 20 Oct 2026) | XP amounts set by admins (`/api/star/xp-config`, `lib/star/xpStore.ts`). Until it runs the route answers `migrationMissing` and the game uses its built-in amounts (`DEFAULT_XP`); nothing breaks. |
| `star_tuning_notes.sql` | **PENDING** (20 Oct: Mikey ran the SQL files, but `star_tuning_notes` still does not exist live — run this one again) (new, 14 Oct 2026) | The Tuning panel's "Say what feels off" notes (gallery, Infinite Highlights, Infinite Match; `components/star/TuningSessionPanel.tsx`, `/api/star/tuning-notes`). Anyone inserts, admins read. Until it runs a note says "Saved on this device only" and is sent with the next one that gets through. Terminal: `npx tsx scripts/tuning-notes.mts` (needs `SUPABASE_SERVICE_ROLE_KEY`; also printed by `tuner-proposals.mts`). Idempotent. |
| `star_casino.sql` | **DO NOT RUN** (switched off, 8 Oct 2026) | Harry: not now — lag, and the free database is too small (60 days of plays ≈ 150 MB at 100 daily players). `CASINO_ON_SERVER = false` in `lib/star/casinoRules.ts` keeps every game on the phone with no server call. If cheating shows up: cut storage to ~2 days + a per-account total first, then run this and flip the switch. Was: the casino on the server (Harry: "move the casino to the server"). Adds `star_casino_plays`: one row per bet, blackjack hand or Goalie Mode run (stake, payout, net, what the player saw; the dealer's hidden card in a `secret` column the browser cannot read). RLS read-own, no browser writes. Signed in, every casino game is rolled and paid by `/api/star/casino/play` (`lib/star/casinoEngine.ts`, rules shared with the phone in `lib/star/casinoRules.ts`) and the save guard allows casino money only up to the server-recorded net since the last trusted save, instead of the ×2,000 luck allowance. Until it runs: nothing breaks — the casino plays on the phone as before and the guard keeps the luck allowance. The Old UI's casino (`components/star/legacy/Casino.tsx`, frozen) still rolls on the phone: once this runs, its wins show as save-guard findings for signed-in Old UI players. Optional env `STAR_CASINO_SECRET` signs horse race cards (falls back to the service key). Idempotent; verify queries at the bottom. |

