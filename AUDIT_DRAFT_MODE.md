# Draft Game Mode — Full Audit Report (17 July 2026)

> Read-only audit of every draft-mode subsystem: single-player flow, season simulator,
> result/crediting, multiplayer rooms, Hall of Fame/records/history, objectives/XP.
> Six parallel deep-audit passes, findings cross-verified. **No fixes applied yet** —
> this document is the implementation spec for the fix pass.
>
> Severity: CRITICAL = broken in production right now or hard game-killing deadlock.
> HIGH = exploit or major correctness failure on a common path. MEDIUM = real bug,
> narrower path or lower blast radius. LOW = minor/cosmetic/hardening.

---

## CRITICAL

### C1. Draft history saving has been silently broken in production since 15 July
- **Where:** `supabase/migrations/draft_runs.sql:18` (`players JSONB NOT NULL`, no default) vs `app/api/draft/history/route.ts:95-127` (neither insert path includes `players`).
- **Defect:** Commit `b3948d9` (15 July, "Drop squad list from draft history") removed `players` from the insert but the promised migration relaxing NOT NULL was never committed/run. Every insert fails with Postgres 23502, which matches neither the 23505 duplicate check (route.ts:131) nor the 42703/PGRST204 column-fallback (route.ts:136) → POST 500s, and the client (`components/draft/DraftResult.tsx:580-589` `saveRunToHistory`) swallows it with `catch {}`.
- **Impact:** Every season completed since 15 July saved nothing to history. History page, achievements, career stats, streak calc silently stopped accruing. Zero user-visible error.
- **Fix:** New migration: `ALTER TABLE draft_runs ALTER COLUMN players DROP NOT NULL;` (or `DROP COLUMN players;`). Run it in Supabase SQL Editor. Also make `saveRunToHistory` log non-OK responses so this failure class is observable.

### C2. Relegated host permanently deadlocks a multiplayer room
- **Where:** `components/draft/DraftResult.tsx:2934` (Season N+1 button hidden when own `actualFinish >= 18`), `app/api/draft/rooms/[code]/next-season/route.ts:27-29` (host-only), `app/api/draft/rooms/[code]/simulate/route.ts:33` (host-only), `app/draft/page.tsx:678-706` (ready retry loop).
- **Defect:** `/next-season` is only callable by the host and only reachable from the host's arrange-confirm flow — but a relegated host never sees the Season N+1 button (only SACKED + Share/New Draft). Room stays `complete`; survivors' ready submissions 409-loop forever (ready rejects while status is "complete"); non-hosts get 403 from next-season. Host handoff exists only in the leave route and there is no Leave button on the result screen. Dead room, unrecoverable.
- **Fix:** In `simulate/route.ts`, after writing results: if host's `actual_finish >= 18` and any active player finished < 18, reassign `draft_rooms.host_id` to the best-finishing surviving player. Also relax `next-season` to accept any non-"out" member when the current host's row is "out".

### C3. First season after any relegation runs a malformed league; odd relegation count crashes simulation deterministically
- **Where:** `app/api/draft/rooms/[code]/simulate/route.ts:75-77` (`aiOpponents = sortedAI.slice(0, 20 - N)`), `lib/seasonSimulator.ts:322-364` (`getSeasonTeams` keeps AI count constant), `:4887-4908` (circle scheduler self-pairs on odd N), `:4954-4959` (null destructure throws).
- **Defect:** `getSeasonTeams` relegates 3 AI and promotes 3 AI — it never backfills the slot vacated by a relegated human. After R relegations, the league has 20−R teams. Odd N → the round-robin self-pairs a team, `matchScores[i][i]` is null, destructuring throws → simulate 500s, resets to lobby, and every retry crashes identically (deterministic seed). Even R silently runs an 18-team, 34-match "season".
- **Fix:** In `simulate/route.ts`, when `seasonTeams.length < 20 - N`, top up from the unused pool (or pass relegated-human count into `getSeasonTeams` so it promotes `3 + R`). Add a hard assert `humans + AI === 20` before simulating with a clear error.

### C4. Hall of Fame GET 500s in the current (pre-migration) DB state
- **Where:** `app/api/draft/records/route.ts:29,58` — `try { query = query.eq("mode", mode) } catch {}` is dead code: the builder never throws synchronously; a missing `mode` column errors at await time (lines 31-34, 60-63) and returns 500.
- **Impact:** With `draft_records_full_fix.sql` still pending (per CLAUDE.md), the entire Hall of Fame page and the profile PersonalRecords widget error out.
- **Fix:** Mirror POST's fallback in both GET paths: on error code 42703/PGRST204, retry the query without the `.eq("mode", ...)` filter. **And run the two pending migrations** (`draft_records_full_fix.sql`, `draft_runs_stats.sql`) — they independently fix career-record inserts and history dedup.

---

## HIGH — exploits

### X1. Unlimited XP minting via `/api/xp`
- **Where:** `app/api/xp/route.ts:36-56`, `lib/xp.ts:79-90`.
- **Defect:** Any `event_type` in `XP_AWARDS` is accepted with a client-chosen `event_ref`; only `objective_*` events verify the underlying achievement. `join` (1000 XP), `draft_invincible` (500), `streak_7/30` (200/500), `tierlist_create`, `vote_cast` are **not** in `DAILY_CAPPED_EVENTS` → a loop posting fresh `event_ref`s mints unlimited XP. Capped events are still farmable at 10/day each with no proof (e.g. 10×1000 `hall_of_fame_record`).
- **Fix:** Award achievement-shaped events server-side from the routes that observe them (records/history/rooms) and reject them from the public endpoint; at minimum add every event type to the daily cap and validate season-scoped `event_ref`s against server-verifiable artifacts.

### X2. Objectives, records, and history all trust wholly client-fabricated data
- **Where:** `app/api/objectives/check/route.ts:12-69` (SeasonCheckData trusted wholesale), `app/api/draft/records/route.ts:151-233` (values bounded only by generous caps; `hasDevPlayers` skip is client-supplied; prune path can evict legitimate users), `app/api/draft/history/route.ts:95-127` (no field validation).
- **Impact:** One crafted fetch completes every published objective (and via `completed_at`, its XP + card become "legitimately" claimable); a crafted records POST takes permanent #1 on every leaderboard and evicts real users; fabricated history unlocks all achievements.
- **Fix (pragmatic tier):** the sim is seeded/deterministic — accept squad + seed and re-simulate (or spot-verify) server-side. Minimum: cross-field plausibility checks (wins+draws+losses = 38, points = 3W+D, goals ≤ plausible, `plMatchResults.length === 38`, event-set consistency like `treble ⇒ pl_win && cl_win`, `seasonNumber ∈ 1..5`), one submission per runKey per user, rate limiting.

### X3. Objective XP is permanently lost if the client dies between check and XP award
- **Where:** `components/draft/DraftResult.tsx:842-898`, `app/api/objectives/check/route.ts:71-92`.
- **Defect:** `/api/objectives/check` sets `completed_at` server-side, then relies on the client to sequentially call `/api/xp` per completed objective. Once `completed_at` is set the objective never reappears in `newlyCompleted` — tab close/refresh/network drop between the two steps forfeits the XP forever. (Same failure class as the animation-gated crediting fixed earlier.)
- **Fix:** Award the XP inside `/api/objectives/check` itself (service client already in hand; insert `xp_events` row with `event_ref = objective_<id>` in the same request that sets `completed_at`); return level-up info for the popups. Existing `event_ref` uniqueness makes it idempotent and correctly dedupes against the claim route.

---

## HIGH — multiplayer "out"/relegation mechanism (beyond C2/C3)

### R1. "out" player can re-enter the league via the ready endpoint
- **Where:** `app/api/draft/rooms/[code]/ready/route.ts:33-37` (sets `status: "ready"` unconditionally); client shows the arrange button to "out" rejoiners (`components/draft/MultiplayerLobby.tsx:756-766`).
- **Fix:** ready route: select caller's row first, 409 if `status === "out"`. Client: when `myPlayer?.status === "out"`, render an eliminated/spectator state instead of the arrange button.

### R2. Host handoff on leave can select an "out" player
- **Where:** `app/api/draft/rooms/[code]/leave/route.ts:27-44` — handoff picks `others[0]` by `joined_at`, never reads `status`. An "out" new host is stuck on the SACKED screen → same deadlock as C2.
- **Fix:** Select `status` too; hand off to the first non-"out" player; if only "out" players remain, delete the room (`roomClosed: true`).

### R3. "New Draft" abandons the room without leaving → survivors deadlock
- **Where:** `app/draft/page.tsx:734-755` (`handleNewRun` never POSTs `/leave`; contrast `handleLeaveRoom` at 575-593).
- **Defect:** The abandoner's row resets to "drafting" next season and never readies → `allReady` never true → simulate rejects forever. This is the exact lingering-row deadlock the leave route's own comment says it prevents.
- **Fix:** In `handleNewRun`, when `roomCode` is set, fire the same fire-and-forget leave POST before resetting state.

---

## HIGH — shared-season European path (simulator)

### E1. Cup winners / holders silently lose European qualification in multiplayer
- **Where:** `lib/seasonSimulator.ts:5044-5053` (entrant routing) vs `:4257`/`:4108` (personal-phase gates hard-return `qualified: false` outside league positions 6-7 / 1-5); `:5039-5043` never reads `prevResults.uclWinner`.
- **Defect:** FA Cup/League Cup winner finishing >7, or UEL winner finishing >5, is added to entrants but the personal-phase function rejects them (no bypass param, unlike single-player's `faCupWinnerQualifies`/`uelWinnerQualifies`). Defending UCL champion finishing 8th doesn't re-enter (single-player at `:3271` handles this).
- **Fix:** Add a `qualifiesOverride`/pot parameter to both personal-phase functions (pot 4 UCL holders/UEL-winner entry, pot 2 cup winners, matching single-player), pass from entrant routing; add `wonUCLLast && !qualifiesThroughLeague` to the UCL entrant condition.

### E2. Two humans can be paired against each other as uncoordinated "AI" opponents in Europe — contradictory results per viewer
- **Where:** R32 pairing `:4431-4448` (UCL), `:4685-4703` (UEL); R16+ AI pools `:4499-4505`, `:4745-4747` exclude only `t.isPlayer` (self).
- **Defect:** R32 pairing is `33 − leaguePosition` over a table where other humans have `isPlayer: false`; mirrored human pairs each independently simulate the tie with their own RNG → both can "win". In R16+, a living human's team can be drawn as an AI opponent for another human while playing its own tie.
- **Fix:** Build a shared set of qualified human team names; resolve mirrored human R32 pairs once via the coordinated human-vs-human path (as R16+ already does via `humanVsHuman`); in all AI-draw pools exclude every human team name, not just self.

### E3. Engine-dependent `.sort(() => rng() - 0.5)` shuffles remain in the shared European path
- **Where:** Shared path: `:4138`, `:4143`, `:4207`, `:4290`, `:4295`. Single-player: `:2344, 2349, 2393, 2447, 2643, 2648, 2689, 2742`.
- **Defect:** Random-comparator shuffles consume RNG in engine-dependent order (V8 vs JavaScriptCore differ). The comment at `:4468-4471` documents this exact pattern previously desyncing the shared draw — but it survives in the shared personal-phase opponent draws and the shared background filler table, which must be byte-identical across viewers.
- **Fix:** Replace every one with the seeded Fisher-Yates already used at `:4472-4475`. Shared-path sites first; single-player sites too for replay determinism.

---

## HIGH — objectives evaluator

### O1. Seasons with European qualification are posted as `cl_draft`, so `pl_draft`-scoped objectives silently stop progressing
- **Where:** `components/draft/DraftResult.tsx:787-788` (`inEurope ? "cl_draft" : "pl_draft"`) + `lib/objectiveEvaluator.ts:141` (skip on competition mismatch).
- **Impact:** After qualifying for Europe in season 1, seasons 2–5 skip every `pl_draft`-scoped condition — exactly the seasons where the player is strongest — while PL achievements wrongly credit `cl_draft`-scoped conditions.
- **Fix:** Always send `pl_draft` for this flow and carry CL eligibility as a separate flag, or make `competitionMatches` accept a set of active competitions.

### O2. `any_player` career progress keys are never reset on a new run
- **Where:** `lib/objectiveEvaluator.ts:131` (`{ ...currentProgress }` carries all keys), `:169-187` (on `isNewRun` only current-squad players get `base = 0`), `:347-352` (`isConditionMet` scans every prefixed key).
- **Impact:** Stale per-player totals from an old run satisfy "within one draft run" conditions in a new run; re-drafting the same player resumes his old total.
- **Fix:** On `isNewRun`, delete all keys starting with `${cond.id}__` before writing current-season values (mirror the `squad_total`/`win_event` resets).

### O3. Season 1 of ANY flow (multiplayer, dev, new solo run) resets the single shared career-progress store
- **Where:** `app/api/objectives/check/route.ts:69` (`seasonNumber === 1` → `isNewRun`); `user_objectives` keyed only `(user_id, objective_id)` with one `progress` blob.
- **Impact:** Joining a friend's multiplayer room wipes solo career counters; interleaved runs cross-credit each other's "one draft run" totals.
- **Fix:** Include a client run identifier in `SeasonCheckData`, namespace career keys by run (`${runId}:${cond.id}`), reset only that namespace. (Pairs naturally with the M-level dedup fix below.)

### O4. `applyStatChange` corrupts missing (zero) attributes → season 2+ squad strength silently collapses
- **Where:** `app/draft/page.tsx:98-111` (`Math.max(1, attr + change)` turns 0-sentinel attrs into 1–3, even for change 0) interacting with `lib/seasonSimulator.ts:509-513` (`hasAttrs` = any attr > 0), `:519-596`.
- **Impact:** A player from an edition with no detailed stats (real supported path — roster emits 0s, sim falls back to OVR) gets all attrs bumped to ≥1 after season 1; `hasAttrs` flips true; his effective rating blends ~1-3 stat values → an 85-OVR player performs like ~60 with no UI indication.
- **Fix:** Only adjust attributes already > 0: `if ((attrs[key] as number) > 0) attrs[key] = Math.max(1, Math.min(100, attr + change))`; skip the loop when `change === 0`.

---

## MEDIUM

### Crediting / XP integrity
- **M1. Credited-marker written before crediting succeeds, and even when signed out** — `DraftResult.tsx:704-708`. Failed fetches (offline/401) or a guest season permanently block later re-credit of that deterministic season. Fix: write `draft-credited-${runKey}` only after the history POST returns ok, and never when `!isSignedIn`. (Also gate on auth actually resolved — `app/draft/page.tsx:334,364` starts `isSignedIn` false while `getUser` is in flight.)
- **M2. `/api/stats` has no idempotency key — cross-device replay double-counts** — `DraftResult.tsx:925-935`, `app/api/stats/route.ts`. Fix: pass runKey and record it (0-XP sentinel in `xp_events` or a dedicated column) so replays no-op.
- **M3. Non-atomic read-modify-write on `user_xp.total_xp` and objectives `progress` JSONB** — `app/api/xp/route.ts:93-109`, `check/route.ts:45-88`, `check-login/route.ts:51-111`, `claim/route.ts:47-56`. Concurrent awards lose increments/progress. Fix: atomic SQL increment RPC for XP (derive levels from returned value); merge progress in a Postgres function. Daily-cap count-then-insert race tolerable once amounts capped.
- **M4. No server-side dedup of objective progress** — only guard is per-device localStorage; `base + seasonTotal` accumulation double-credits on a second device. Fix: send runKey, store `credited_keys` in progress (or column), skip when already credited.
- **M5. `hall_of_fame_record` (1000 XP) is advertised but never awarded by any code path** — `components/profile/WaysToEarnXP.tsx:17`; no client or server posts it. Fix: award server-side in the records POST when a global top-5 insert actually occurs, deterministic `event_ref` per (mode, competition, record_type) per day (prevents farm-by-beating-own-record-by-1); keep under the daily cap.

### Objectives evaluator (cont.)
- **M6. `cl_r16`/`cl_qualify` credited to teams eliminated in the R32 playoff** — `DraftResult.tsx:803` pushes both whenever `knockoutTies.length > 0`, but positions 9-24 play a `'Round of 32'` playoff (`seasonSimulator.ts:2471-2496`). Fix: push `cl_r16` only when winner, or exitStage ∈ {R16, QF, SF, Final}, or a non-R32 tie exists.
- **M7. check-login completes ANY objective type with naive `progress >= count`** — `check-login/route.ts:83-95` ignores `same_season`/`same_player` and squad_count's current-season requirement (contrast `objectiveEvaluator.ts:310-315`). Fix: only complete objectives whose conditions are all `login_streak`; for mixed ones just update streak progress.
- **M8. `or_groups` holes** — `check-login/route.ts:43-46,75` scans base conditions only (login-streak OR branches never progress); `check/route.ts:37-40` skips objectives with empty base `conditions` even when `or_groups` is populated (pure-OR objectives never evaluated). Fix: include flattened or_groups in both.
- **M9. Multi-season `atMost` conditions complete with too few seasons** — `objectiveEvaluator.ts:246-263`: in season 1 the window is one season, and a smaller window trivially passes "concede ≤ X across N seasons". Fix: require `historicalPlMatchResults.length >= seasonCount - 1` first.
- **M10. Substring matching over-matches** — `objectiveEvaluator.ts:9-14,25-31,49-57`: "Niger"⊂Nigeria, "Ireland"⊂Northern Ireland, "Guinea"⊂Equatorial Guinea; position "RW"⊂"RWB". Applies to exclusions too. Fix: tokenize on commas, compare trimmed lowercase tokens for equality.
- **M11. Admin condition edits don't reset user progress** — `app/api/admin/objectives/route.ts:68`. Narrowing a condition keeps progress earned under the old rules. Fix: on conditions/or_groups/same_* change, clear affected progress keys on non-completed `user_objectives`.

### Multiplayer rooms (cont.)
- **M12. Strangers can join mid-career** — `join/route.ts:32-34` only checks `status !== "lobby"`, but next-season returns to "lobby" each season. Fix: block new joins unless `status === "lobby" && (season_number ?? 1) === 1`.
- **M13. Team rename allowed post-simulate via direct API** — `team-name/route.ts:31-33` checks only `season_number > 1`; after season-1 simulate the room is "complete" with season_number 1. Renaming voids the carried league record and name-matched European qualification. Fix: also reject when room status isn't "lobby"/"started".
- **M14. Crash mid-simulation strands the room in "simulating" forever** — `simulate/route.ts:54-62`: the claim excludes "simulating" from reclaimable states; a serverless timeout after the claim leaves every client on "Simulating season..." forever. Fix: stamp `settings.simulatingSince`; allow reclaim after ~2 minutes.
- **M15. next-season's three sequential writes are unchecked** — `next-season/route.ts:70-86`: a failed mark-out or room write silently wedges the room in inconsistent state. Fix: check each error and 500 (route is idempotent-gated) or collapse into one RPC.

### Single-player flow
- **M16. Pre-season auto-continue discards a convinced player / skips the convince flow** — `components/draft/Season2Overview.tsx:123-128` fires `onContinue("")` after 1.5s without passing `retainedPlayer` and can preempt the 2.3s convince resolution. Fix: pass the retained player like the manual path (412-426) and gate the timer on `!convinceThinking`.
- **M17. Roster-fetch race: stale response overwrites a re-spun club** — `DraftPick.tsx:321-338` has no staleness guard; late responses (or their error path, which yanks phase back to "spin") clobber the current spin. Fix: spin-id ref or AbortController; ignore mismatched results.
- **M18. No save during result/pre-season/signing/sell phases → refresh replays an already-played season** — `app/draft/page.tsx:387-406` (checkpoints only at manage/arrange), `629-644`. Lost pre-season work + potential re-credit (history dedup migration still pending). Fix: extend `SavedProgress` with a pre-season snapshot and/or write/clear the save the moment a season result is produced.
- **M19. Selling a starter lets you simulate a 10-man XI** — sell replacement always arrives as sub (`DraftPick.tsx:384`), and `SquadManagerDev.tsx:489-497` Confirm never validates 11 starters. Fix: disable Confirm with a hint while `starters.length !== 11`.
- **M20. Signing-phase club-years not added to `nextUsedClubYears`** — `page.tsx:861-870` vs `1255-1263`: the sell-signing spin can reuse a club/season already used in the signing phase. Fix: append the new signings' club-year keys in `handleSigningComplete`.

### Simulator (cont.)
- **M21. Shared Charity Shield logic inverted/incomplete** — `seasonSimulator.ts:5128-5151`: `opponentIsPlayer = !playerWonPL` is not "opponent is human"; FA-Cup-winning humans who didn't win the PL never play it; PL-winning non-cup-winners get none (outer gate on `prevRes.faCupWinner`). Fix: gate on `faCupWinner || playerWonPL`; check opponent name against human-team set.
- **M22. Shared Super Cup: wrong pool + hidden shootout** — `:5101-5125`: UEL-winner opponent drawn from `UCL_TEAMS` with strength looked up in `UEL_TEAMS` (miss → 76); drawn matches resolved by invisible extra-time without setting `extraTime`/`penalties`; `aiOpponentsForCups.sort()` mutates the caller's array. Fix: draw from `UEL_TEAMS`; carry ET/pens into the stored result like single-player `simulateSuperCup` (`:2957-2975`); copy before sort.
- **M23. Cup finals give the AI opponent home advantage** — `:2057-2064`, `:1466-1472`, `:1580-1590`: `isHome=false` in finals routes +3 to the opponent (and to slot-B humans in shared finals). Fix: neutral venue in finals — no bonus either side. (UCL final `:2235` randomly grants one side home — make consistent.)
- **M24. League Cup semi second legs: ET goals have no scorers; leg-2 assists dropped entirely** — `:1352-1376`, `:1976-1994`, `FaCupMatch.leg2` type `:61-69` (no assists field), stats loops `:3506`, `:5270`. Fix: generate ET scorers; add and count leg-2 assistProviders.
- **M25. Shared schedule has an unguarded even-20 invariant** — `:4887-4907`, non-null assert `:5177`; odd N self-pairs/throws; duplicate human display names collapse to one table row. Fix: assert N===20 and unique names at the top of `simulateSharedSeason`. (Overlaps C3; this is the simulator-side guard.)

### Records / history (cont.)
- **M26. One user's first seasons fill a global top-5 board with duplicates** — `records/route.ts:317-329` inserts unconditionally while a board has <5 rows, no per-user dedup. Fix: keep at most one row per user per board (update in place when better).
- **M27. Prime-mode personal bests invisible in profile widget** — `components/profile/PersonalRecords.tsx:44` fetches without `mode` (server defaults `normal`). Fix: fetch both modes, merge best-per-key (reuse records/page.tsx `mergePersonal`).
- **M28. Personal-record 23505 recovery can silently drop a record post-migration** — `records/route.ts:399-418`: recovery re-fetch omits mode filter, `.maybeSingle()` errors on 2 rows → record discarded. Fix: include `.eq("mode", ...)` when mode column exists; rename the `any` variable.
- **M29. Multiplayer reveal trusts client wall clock** — `simulate/route.ts:118` (server `Date.now()+3000`) vs `DraftResult.tsx:651-674` (client `Date.now()`); a slow client stares at an empty reveal (no skip in rooms), a fast one desyncs. Fix: return server "now" (or relative `startsInMs`) and offset.
- **M30. Career Recap unreachable when sacked before season 5** — `DraftResult.tsx:2922-2931` requires `!onPlayNextSeason`, but the page passes it whenever `currentSeason < MAX_SEASONS`. Fix: show when `(!onPlayNextSeason || season.actualFinish >= 18) && seasonNumber > 1 && allSeasonResults?.length`.

---

## LOW

- **L1.** Re-spin not persisted until next pick — refresh refunds it (`page.tsx:651-665`, `1190`). Persist in `onUseRespin`.
- **L2.** DraftPick "% fit" badge uses a different fitness table than the sim (`DraftPick.tsx:72-91` vs `seasonSimulator.ts:463-505`, missing LM↔LW equivalence). Compute from `positionFitness`.
- **L3.** Prime mode overwrites positions after the wing-expansion pass (`roster/route.ts:164-179` before `181-242`), losing LW/RW aliases. Reorder or re-apply.
- **L4.** Convinced-to-stay player skips the season-review rating change everyone else gets (`page.tsx:844-845`). Confirm intent or apply the delta.
- **L5.** Career stats computed from at most 200 history rows (`history/route.ts:17`, `history/page.tsx:29-58`). Aggregate server-side.
- **L6.** Record ties never enter a full board / never refresh a PB (`records/route.ts:332,411,423`). Pick and document a tie policy.
- **L7.** History day-streak uses UTC dates (`history/page.tsx:83-97`). Use local date parts. Same UTC-boundary question for login streak (`schema-additions.sql:93-95`) — decide deliberately.
- **L8.** History POST: no field validation — missing fields → 23502 → 500 instead of 400 (`history/route.ts:95-107`).
- **L9.** Login streak only advances on /profile visits (`app/profile/page.tsx:33`, `ProfileClient.tsx:633`) — daily draft players who skip /profile lose streaks. Fire from GlobalNav/layout once per session.
- **L10.** `update_login_streak(p_user_id)` callable for any user id by any authenticated user (`schema-additions.sql:80-113`). Use `auth.uid()` internally.
- **L11.** `treble` event fires with PL + UCL only (`DraftResult.tsx:809`); `double` can be pushed twice (`:800,815`). Require a domestic cup for treble; dedupe events.
- **L12.** Missing age/OVR serialized as `0` defeats evaluator null-guards (`DraftResult.tsx:855-856` vs `objectiveEvaluator.ts:59-62`) — unknown-age players pass wonderkid filters. Omit instead of `?? 0`.
- **L13.** Objectives `matchResults` payload omits Charity Shield/Super Cup (`DraftResult.tsx:823-840`); "GK clean sheets" record counts team clean sheets regardless of GK appearances (RecordsSection 100-105); empty-squad runKey collapses to `q0` (`:703`).
- **L14.** Multiplayer: "out" players show the yellow "Drafting" badge in the lobby (`MultiplayerLobby.tsx:672-679`) — add an "Out/Relegated" badge.
- **L15.** dev-skip / dev-skip-career revive "out" players (`dev-skip/route.ts:80-88`, `dev-skip-career/route.ts:92-100,187-195`) — filter them like simulate does.
- **L16.** `/draft?room=CODE` is written to the URL but never parsed on load (`page.tsx:356-359`) — auto-join on mount.
- **L17.** Room GET is unauthenticated and returns full squads incl. overalls (`rooms/[code]/route.ts:55-85`), defeating `hiddenRatings` via direct API. Add membership check.
- **L18.** next-season idempotency is read-then-write (`next-season/route.ts:32`) — make the room update conditional and reset players only after the claim.
- **L19.** simulate reads players before the claim (`simulate/route.ts:36-49`) — a concurrent leave simulates a ghost team. Re-fetch after claiming.
- **L20.** Max-6 join check and team-name uniqueness are TOCTOU races (`join/route.ts:23-37`, `team-name/route.ts:44-53`) — DB-side enforcement.
- **L21.** Fast rejoin can skip squad/ready restoration if `userId` state hasn't loaded (`page.tsx:488`).
- **L22.** Simulator small stuff: commutative seed sums collide (`:3136,4967,5163` — fold with `Math.imul`); `localeCompare` tiebreak is ICU-dependent in shared tables (`:974,2421,2717,4235` — compare code units); cup bracket padding always lands lower-league clubs in trailing slots (`:1229-1243` — pad before shuffle); Golden Glove falls back to top scorer when no GK (`:3722,5318`); `getSeasonTeams` default promotionSeed constant (`:340`); AI-vs-AI shootouts add a phantom goal to the scoreline (`:1210`); `calculateSeasonOdds` can use a different league than the sim (`:3145,3876-3878`); shared League Cup RNG and stats RNG share a seed (`:4989` vs `:5251`).
- **L23.** DraftResult small stuff: biggest-win tiebreak parses `parseInt("")` → NaN (`:979`); AET/pens badges lost for two-legged semis in Match Results (`:1300` label mismatch); Twitter share window opened after an await → popup-blocked (`:1198-1215`); PL+UCL banner says "THE DOUBLE" while the dead treble branch says otherwise (`:1715` vs `:1151`).
- **L24.** CareerRecap: FA Cup round abbreviations expect "Round 3/4/5" but sim emits "Round of 32/16" (`CareerRecap.tsx:394-404`); "Comeback Wins" counts every win that conceded (oppFirstGoalMin hardcoded 1, `:369-380`).

---

## Verified clean (no action needed)

- Core league sim: no `Math.random`/`Date.now` anywhere; double-entry-consistent table math; exact 19H+19A double round-robin (single and shared); correct points>GD>GF tie-break; NaN/zero-division defended; ratings clamped; assists structurally ≤ goals; clean-sheet and GK-injury logic correct; OVR fallback directionally consistent.
- `/api/xp` amount handling: client `xp_amount` ignored, server-resolved, clamped 1000, unknown types rejected.
- Dedup plumbing: `xp_events UNIQUE(user_id, event_type, event_ref)`; claim route can't double-award; history 23505/42703 fallbacks work as documented (modulo C1).
- Run-key determinism (squad+season seeded) — refresh/resume reproduce the same key; no remaining animation-gated crediting.
- Relegation threshold `>= 18` consistent across all files.
- Room auth: all mutating routes authed; host-only enforced where intended; dev-skip admin+host gated; players can only touch their own rows; team-name validated/escaped; room-code generation sound; simulate double-click claim atomic; stale-result replay guarded client-side.
- clubs/roster APIs: parameterized, validated, correct pagination and JSONB extraction; formations all 11-slot/1-GK; duplicate-pick prevention solid; localStorage parse errors handled.
- Objectives: `withinCompetition: pl_only` routing, `historicalPlMatchResults` ordering, `same_player` evaluation, continent exact-token lookup all correct.

---

## Suggested implementation order

1. **C1** (migration + observability) — history is broken in prod *right now*; every day loses data.
2. **C4** + run pending migrations (`draft_records_full_fix.sql`, `draft_runs_stats.sql`) — unbreaks Hall of Fame and career records, enables history dedup.
3. **C2, C3, R1–R3** — the multiplayer relegation cluster (one coherent change set across simulate/next-season/ready/leave routes + client gating).
4. **X1–X3** — XP/objective economy integrity (server-side awarding + caps + validation).
5. **O1–O4** — objectives correctness cluster.
6. **E1–E3** — shared European path.
7. **M-level** by cluster (crediting M1–M5, evaluator M6–M11, rooms M12–M15, single-player M16–M20, simulator M21–M25, records M26–M30).
8. **L-level** opportunistically alongside their cluster.
