-- One-off (Harry, 20 Oct 2026: "push the to do for everyone on the lag").
-- Puts the lag-test job on Harry's, Mikey's and Leo's To-do, and pins the
-- prompt to paste into your Claude chat in Team chat (a job's text is max 200
-- characters, so the prompt lives in the pinned message). Needs team_room.sql.
-- Safe to run twice: nothing is added again if it is already there.

INSERT INTO public.team_tasks (owner, made_by, title)
SELECT p, 'Harry', 'Lag test on your phone, 10 min, after the next push: Settings → Developer tools → Lag test. The prompt to paste into your Claude chat is pinned in Team chat.'
FROM unnest(ARRAY['Harry', 'Mikey', 'Leo']) AS p
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_tasks t
  WHERE t.owner = p AND t.title LIKE 'Lag test on your phone, 10 min%'
);

INSERT INTO public.team_messages (person, body, pinned)
SELECT 'Harry', $prompt$LAG TEST PROMPT (paste into your own Claude chat when you do your Lag test to-do)

Lag test for Knowitball (B18). Merge main into my branch first.
I'm going to run the in-game Lag test on my phone now. Walk me through it one step at a time, short and plain:
1. Open knowitball.co.uk/star-dev on my phone, signed in. Settings → Developer tools → Lag test.
2. Pick my device on the first screen (iPhone 16 or newer / iPhone 13 or 14 / older Android / a PC tier) and my name.
3. Follow the pill at the top: go to each screen it names, tap "I'm there", wait for "Done", tap Next. Skip any step I can't reach.
4. At the end, screenshot the ✓/✗ table and tap Save.
When I say done, run `npx tsx scripts/lag-runs.mts` and tell me: my run is saved (yes/no), my device, and each step that failed with its numbers.
If it says "Saved on this device only", tell me to tap "Copy results" and paste them into the Team chat instead.
Don't change any game code for this.$prompt$, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_messages m WHERE m.body LIKE 'LAG TEST PROMPT%'
);

-- Check: 3 jobs and 1 pinned message.
SELECT owner, title FROM public.team_tasks WHERE title LIKE 'Lag test on your phone, 10 min%';
SELECT id, person, pinned, left(body, 40) FROM public.team_messages WHERE body LIKE 'LAG TEST PROMPT%';
