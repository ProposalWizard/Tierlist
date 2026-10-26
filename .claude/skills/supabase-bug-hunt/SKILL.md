---
name: supabase-bug-hunt
description: Find and fix a player's bug using the live Supabase data as a layer - read the bug report, find that player's career save, compare it with normal saves, spot the impossible state, reproduce it with the career soak or the star sandbox, then fix the code and test. Load when someone says "bug report", "find this bug", "why did this career break", "look at the saves", "my career didn't save", "check the feedback", or pastes a player's complaint about Road to Ballon d'Or. Look-only queries; nothing in the database changes without Harry's yes.
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes. This skill's note: PRO-DAT-002.
Every Supabase request follows RUL-DAT-002 (header in the SQL, same lines in chat before the Allow box).
Every change goes out as an RUL-DAT-001 page first and waits for Harry's yes.

# Supabase bug hunt

Harry, 25 Oct 2026: "Looking inside career saves: useful, to find bugs and compare against normal
games." Before the Supabase connector, a bug like "my career didn't save" was guessed at. Now the
chat can read the real report, the real save and the save guard's flags, and prove the cause.

## The four rules (never skip)

1. **Look-only by default.** Every query is a SELECT that opens with
   `-- READ ONLY. What: … Why: …`. No insert, update, delete or migration in this skill.
2. **A change needs Harry's yes and a page.** Repairing a save, deleting a report or any other row
   change: write the SQL (header `-- CHANGES THE DATABASE. What: … Why: …`), build the page with
   `python3 scripts/supabase/sql-page.py`, publish it, wait. Usually the real fix is in the code, not the row.
3. **No personal data in chat or the repo.** Never paste an email, a user id, a real name or a
   message that names someone. Call the player "player A" (B, C…). Keep the id in your working
   memory only. A downloaded save goes to the scratchpad, never into the repo, and has
   `player.firstName/lastName` swapped for "Player A" before anyone else sees it.
4. **Say what you saw.** Each finding says measured (a query result), seen (a screenshot) or reasoned.
   Give the number (RUL-ALL-006, RUL-ALL-007).

If the Supabase connector is not available in this chat, write the look-only queries to
`supabase/checks/<bug>.sql`, give Harry an RUL-DAT-001 page to run them, and continue from his results.

## Where things live (check the columns before trusting this list)

| What | Table | Columns (from the migrations) |
|---|---|---|
| Bug reports / feedback | `feedback` | `id, message, page_url, created_at, user_id` (`supabase/migrations/feedback.sql`, `feedback_user_id.sql`; user_id may be empty for signed-out players) |
| Career saves | `star_careers` | `user_id, slot (1-3), career (jsonb, ~240 KB), updated_at` (`app/api/star/career/route.ts:57-114`, `star_career_slots.sql`) |
| Save guard findings | `star_save_flags` | `id, user_id, slot, at, mode (observe/enforce), verdict (cheat/watch), findings, prev_keys, next_keys, corrected` (`star_save_guard.sql:30-44`) |
| Gems and paid items | `star_wallet`, `star_wallet_ledger`, `star_entitlements` | `star_wallet.sql` |

Inside `career`: `version` (2), `season`, `week`, `division`, `money`, `fame`, `starRating`,
`player.club`, `player.age`, `league[]` (the table), `fixtures[]`, `squad[]`, `serverGuard`
(written by the server only). Full shape: `CareerState` in `lib/star/types.ts`.

## The method

### 1. Read the report
```sql
-- READ ONLY. What: the 20 newest bug reports, message cut to 400 letters. Why: find the report Harry means.
SELECT id, created_at, page_url, user_id IS NOT NULL AS signed_in, left(message, 400) AS message
FROM feedback ORDER BY created_at DESC LIMIT 20;
```
Quote the message in chat only after removing names and emails. Note the time and the page.

### 2. Find that player's save
```sql
-- READ ONLY. What: player A's saves (headline numbers only, not the whole save). Why: see the state the bug left.
SELECT slot, updated_at, pg_size_pretty(pg_column_size(career)::bigint) AS size,
       career->>'season' AS season, career->>'week' AS week, career->>'division' AS division,
       career->'player'->>'club' AS club, career->>'money' AS money, career->>'fame' AS fame,
       jsonb_array_length(COALESCE(career->'squad', '[]')) AS squad_size,
       jsonb_array_length(COALESCE(career->'fixtures', '[]')) AS fixtures
FROM star_careers WHERE user_id = '<id from the report>' ORDER BY slot;
```
Pull deeper keys one at a time (`career->'league'`, `career->'injury'`…), never the whole 240 KB
blob into chat. Did `updated_at` move after the report time? If not, the save never reached the server.

### 3. Read the save guard
```sql
-- READ ONLY. What: what the save guard said about player A's saves. Why: a refused or corrected save looks like "my career didn't save".
SELECT at, slot, mode, verdict, corrected, findings
FROM star_save_flags WHERE user_id = '<id>' ORDER BY at DESC LIMIT 20;
```
`mode = enforce` with `corrected` filled means the server changed the save (`lib/star/saveGuard.ts`).

### 4. Compare with normal saves
```sql
-- READ ONLY. What: spread of headline numbers across every save (no ids). Why: is player A's number normal?
SELECT count(*) AS saves,
  percentile_cont(ARRAY[0.1,0.5,0.9]) WITHIN GROUP (ORDER BY (career->>'money')::numeric) AS money_p10_p50_p90,
  percentile_cont(ARRAY[0.1,0.5,0.9]) WITHIN GROUP (ORDER BY (career->>'season')::numeric) AS season_p10_p50_p90,
  percentile_cont(ARRAY[0.1,0.5,0.9]) WITHIN GROUP (ORDER BY pg_column_size(career)) AS bytes_p10_p50_p90
FROM star_careers
WHERE jsonb_typeof(career->'money') = 'number' AND jsonb_typeof(career->'season') = 'number';
```
Then the flags overall: `SELECT verdict, mode, count(*) FROM star_save_flags WHERE at > now() - interval '30 days' GROUP BY 1, 2;`
(same READ ONLY header). Many players with the same finding = a game bug, not one save.

### 5. Name the impossible state
Check the save against the rules the game must always keep. The list lives in
`scripts/soak/careerSoak.mts` (`audit`, line 33): table sums (played = won + drawn + lost), own club
in own table, money/fame/rating finite, money under 1e13, squad 11-60, no club squad over 70, the
right number of clubs per division. Plus: a past fixture still unplayed, week beyond the season,
two fixtures on one day (`tests/star/fixtureClashes.mts`). Write the finding as one line:
"Player A's save has 25 clubs in League One (should be 24)."

### 6. Reproduce it on this machine
- **From the save:** put the anonymised save in the scratchpad and load it in a scratch script with
  `loadCareerFromStoredForm(raw)` (`lib/star/storage.ts:677`, the same loader the game uses; it
  never throws, null = would not load). Then step it with `careerFlow.ts` the way the soak does.
- **From scratch:** `npx tsx scripts/soak/careerSoak.mts 20` (every division, 20 seasons, ~85 s;
  add a division name to run one). Add a check for the impossible state if the soak lacks one.
- **On screen:** the star sandbox (`scripts/star-sandbox/README.md`), signed out. Seed the save in
  the browser under the key `star-career-v2::anon` (a Playwright `page.addInitScript` in a scratch
  script), then `node scripts/star-sandbox/drive.mjs --resume --shot <file>`.
A bug that does not reproduce is not fixed yet; say so.

### 7. Fix and test
Fix the code (not the row). Add the impossible state to the soak or a `tests/star/*.mts` suite so it
cannot come back. Run `npm run test:star` and the soak. If the player's own save also needs
repairing, write that SQL as a CHANGES THE DATABASE file and an RUL-DAT-001 page; it waits for Harry.

## The reply (RUL-ALL-003)
1. The cause in one line, with the measured number.
2. Where it is in the code (file:line).
3. The fix, and the test that now catches it.
4. Any row change still waiting for Harry's yes (with the page link).
